import { randomInt } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import type { CoinBalance, DailyCoinMon, DailyCoinMonPurchase, DailyCoinOffer, SlotRules, SlotSpinResult, SlotSymbol } from '../../shared/slots'
import {
  CHERRY_ONE,
  CHERRY_TWO,
  COIN_PACKS,
  DAILY_COIN_OFFER,
  DAILY_MON_MARKUP,
  DAILY_MON_STARS,
  MAX_PRIZE_BULK,
  COIN_PRICE,
  COIN_PRIZES,
  SLOT_PAYOUTS,
  SLOT_REELS,
  SLOT_RULES,
  slotWins
} from '../../shared/slots'
import { POKEMON_SELL_PRICES } from '../../shared/battle-types'
import { GOLDEN_TOUCH_JACKPOT_BONUS, GOLDEN_TOUCH_PAYOUT_MULTIPLIER } from '../../shared/titles'
import { betCap, hasTitle } from './title-perks'
import { getMoney, spendMoney } from './money-store'
import { addItem } from './bag-store'
import {
  buildBasicSet,
  getEditorOptions,
  isLateGameItem,
  pickDailyShopSpecies,
  randomNatureName,
  randomSlotPokemon,
  rollGiftShiny,
  speciesRarityTier
} from './sim-access'
import { addCaughtMon } from './box-store'
import { restoredLevel } from './fossil-store'
import { lateItemsUnlocked } from './progression-store'
import { playerPathFor } from './save-paths'
import { onPlayerChange } from './player-session'
import { countAchievement } from './achievement-progress'

/**
 * The Game Corner: the player's coins (bought with Poke Dollars, never sold back), the
 * slot machine they're bet on, and the prizes they trade for. Every spin is decided
 * here - the renderer only plays the reels out to where they already stopped.
 */

interface StoredCoins {
  coins: number
  // The day (local date) the daily coin offer was last bought.
  dailyOfferDay?: string
  // The Pokemon of the day: picked the first time the shop is looked at each day, and
  // kept for the rest of it.
  dailyMon?: { day: string; species: string; bought: boolean }
}

let state: StoredCoins | null = null

onPlayerChange(() => {
  state = null
})

function getState(): StoredCoins {
  if (!state) {
    try {
      const parsed = JSON.parse(readFileSync(playerPathFor('coins.json'), 'utf8')) as StoredCoins
      state = {
        coins: typeof parsed.coins === 'number' ? parsed.coins : 0,
        dailyOfferDay: typeof parsed.dailyOfferDay === 'string' ? parsed.dailyOfferDay : undefined,
        dailyMon:
          parsed.dailyMon && typeof parsed.dailyMon.species === 'string' && typeof parsed.dailyMon.day === 'string'
            ? { day: parsed.dailyMon.day, species: parsed.dailyMon.species, bought: !!parsed.dailyMon.bought }
            : undefined
      }
    } catch {
      state = { coins: 0 }
    }
  }
  return state
}

function persist(): void {
  writeFileSync(playerPathFor('coins.json'), JSON.stringify(getState()), 'utf8')
}

export function getCoins(): number {
  return getState().coins
}

/** The Debug menu: sets the coins outright (a whole number, never below zero). */
export function setCoins(amount: number): number {
  if (!Number.isFinite(amount)) throw new Error('Enter a number of coins')
  getState().coins = Math.max(0, Math.floor(amount))
  persist()
  return getCoins()
}

/** Takes (negative) or pays (positive) coins for another Game Corner game - never below zero. */
export function changeCoins(delta: number): number {
  if (getCoins() + delta < 0) throw new Error('Not enough coins - buy some at the Coin Shop')
  getState().coins += delta
  persist()
  return getCoins()
}

/** Buys one of the coin packs with Poke Dollars. */
export function buyCoins(amount: number): CoinBalance {
  if (!COIN_PACKS.includes(amount)) throw new Error("That coin pack isn't sold")
  if (!spendMoney(amount * COIN_PRICE)) throw new Error("You don't have enough money for those coins")
  getState().coins += amount
  persist()
  return { coins: getCoins(), money: getMoney() }
}

// Today's local date, as the daily offer's key.
function today(): string {
  const now = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** The Coin Shop's daily offer, and whether it's been bought today. */
export function getDailyCoinOffer(): DailyCoinOffer {
  return {
    coins: DAILY_COIN_OFFER.coins,
    price: DAILY_COIN_OFFER.price,
    fullPrice: DAILY_COIN_OFFER.coins * COIN_PRICE,
    bought: getState().dailyOfferDay === today()
  }
}

/** Buys the daily offer - once a day. */
export function buyDailyCoinOffer(): CoinBalance {
  if (getState().dailyOfferDay === today()) throw new Error("Today's offer is gone - it's back tomorrow")
  if (!spendMoney(DAILY_COIN_OFFER.price)) throw new Error("You don't have enough money for today's offer")
  getState().coins += DAILY_COIN_OFFER.coins
  getState().dailyOfferDay = today()
  persist()
  return { coins: getCoins(), money: getMoney() }
}

// Today's Pokemon of the day - a new one picked once the day has turned.
function todaysMon(): { day: string; species: string; bought: boolean } {
  const s = getState()
  if (!s.dailyMon || s.dailyMon.day !== today()) {
    s.dailyMon = { day: today(), species: pickDailyShopSpecies(), bought: false }
    persist()
  }
  return s.dailyMon
}

// What it costs in coins: its 2-star sell price (POKEMON_SELL_PRICES, before any title's
// bonus) in coins, plus DAILY_MON_MARKUP.
function dailyMonCoins(tier: DailyCoinMon['tier']): number {
  const copies = 2 ** DAILY_MON_STARS
  return Math.round((POKEMON_SELL_PRICES[tier] * copies * DAILY_MON_MARKUP) / COIN_PRICE)
}

/** The Coin Shop's Pokemon of the day, its price, and whether it's been bought today. */
export function getDailyCoinMon(): DailyCoinMon {
  const mon = todaysMon()
  const tier = speciesRarityTier(mon.species) === 'legendary' ? 'legendary' : 'epic'
  return { species: mon.species, tier, coins: dailyMonCoins(tier), stars: DAILY_MON_STARS, bought: mon.bought }
}

/**
 * Buys the Pokemon of the day - once a day. It goes straight to the box at DAILY_MON_STARS
 * merge stars, arriving the way a restored fossil does (a little under the level cap, a
 * random nature, the gift shiny chance).
 */
export function buyDailyCoinMon(): DailyCoinMonPurchase {
  const offer = getDailyCoinMon()
  if (offer.bought) throw new Error("Today's Pokemon is gone - a new one arrives tomorrow")
  if (getCoins() < offer.coins) throw new Error(`${offer.species} costs ${offer.coins.toLocaleString('en-US')} coins`)
  const shiny = rollGiftShiny()
  getState().coins -= offer.coins
  todaysMon().bought = true
  persist()
  addCaughtMon(
    { ...buildBasicSet(offer.species, restoredLevel()), nature: randomNatureName(), shiny },
    { copies: 2 ** DAILY_MON_STARS }
  )
  return { coins: getCoins(), money: getMoney(), species: offer.species, shiny }
}

/** Trades coins for one of the prizes (several at once in bulk) - they go into the bag. */
export function buyCoinPrize(itemId: string, quantity = 1): CoinBalance & { itemName: string; quantity: number } {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_PRIZE_BULK) throw new Error(`Trade 1 to ${MAX_PRIZE_BULK} at a time`)
  const prize = COIN_PRIZES.find((p) => p.itemId === itemId)
  if (!prize) throw new Error("That isn't one of the prizes")
  // Late items (the Raid Crystal, the Shiny Patch) wait for the same boss as the Shop's.
  if (isLateGameItem(prize.itemId) && !lateItemsUnlocked()) throw new Error("That prize isn't unlocked yet")
  const cost = prize.coins * quantity
  if (getCoins() < cost) throw new Error(`That costs ${cost.toLocaleString('en-US')} coins`)
  getState().coins -= cost
  persist()
  addItem(prize.itemId, quantity)
  const itemName = getEditorOptions().items.find((i) => i.id === prize.itemId)?.name ?? prize.itemId
  return { coins: getCoins(), money: getMoney(), itemName, quantity }
}

/** One pull of the slot machine: takes the bet (any whole number of coins it has), stops each reel at random, pays the rows. */
export function spinSlots(bet: number): SlotSpinResult {
  if (!Number.isInteger(bet) || bet < 1) throw new Error('Bet at least 1 coin')
  if (bet > betCap()) throw new Error(`Bet at most ${betCap()} coins`)
  if (getCoins() < bet) throw new Error('Not enough coins - buy some at the Coin Shop')
  const stops = SLOT_REELS.map((strip) => randomInt(strip.length))
  const wins = slotWins(stops, bet, slotPayouts(), slotCherryPayouts())
  const payout = wins.reduce((sum, w) => sum + w.payout, 0)
  getState().coins += payout - bet
  persist()
  countAchievement('slotSpins')
  countAchievement('slotCoinsWon', payout)
  if (wins.some((w) => w.symbol === 'gholdengo')) countAchievement('jackpots')
  return { stops, wins, payout, coins: getCoins() }
}

// The Golden Touch title: every payout 10% more (on top of its bigger jackpot).
const goldenTouch = (multiplier: number): number =>
  hasTitle('Golden Touch') ? Math.round(multiplier * GOLDEN_TOUCH_PAYOUT_MULTIPLIER * 100) / 100 : multiplier

// What three of each symbol pays - the jackpot more with the Golden Touch title, and every
// one of them 10% more on top.
function slotPayouts(): Record<SlotSymbol, number> {
  const bonus = hasTitle('Golden Touch') ? GOLDEN_TOUCH_JACKPOT_BONUS : 0
  const base: Record<SlotSymbol, number> = { ...SLOT_PAYOUTS, gholdengo: SLOT_PAYOUTS.gholdengo + bonus }
  return Object.fromEntries(Object.entries(base).map(([symbol, x]) => [symbol, goldenTouch(x)])) as Record<SlotSymbol, number>
}

// What one and two cherries pay - also 10% more with Golden Touch.
function slotCherryPayouts(): { one: number; two: number } {
  return { one: goldenTouch(CHERRY_ONE), two: goldenTouch(CHERRY_TWO) }
}

/** The machine's rules for this time it's opened - with three freshly picked Pokemon. */
export function getSlotRules(): SlotRules {
  const [high, mid, low] = randomSlotPokemon()
  const cherry = slotCherryPayouts()
  return { ...SLOT_RULES, payouts: slotPayouts(), cherryOne: cherry.one, cherryTwo: cherry.two, pokemon: { high, mid, low } }
}
