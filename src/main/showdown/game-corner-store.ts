import { randomInt } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import type { CoinBalance, SlotRules, SlotSpinResult, SlotSymbol } from '../../shared/slots'
import { CHERRY_ONE, CHERRY_TWO, COIN_PACKS, COIN_PRICE, COIN_PRIZES, SLOT_PAYOUTS, SLOT_REELS, SLOT_RULES, slotWins } from '../../shared/slots'
import { GOLDEN_TOUCH_JACKPOT_BONUS, GOLDEN_TOUCH_PAYOUT_MULTIPLIER } from '../../shared/titles'
import { betCap, hasTitle } from './title-perks'
import { getMoney, spendMoney } from './money-store'
import { addItem } from './bag-store'
import { getEditorOptions, isLateGameItem, randomSlotPokemon } from './sim-access'
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
}

let state: StoredCoins | null = null

onPlayerChange(() => {
  state = null
})

function getState(): StoredCoins {
  if (!state) {
    try {
      const parsed = JSON.parse(readFileSync(playerPathFor('coins.json'), 'utf8')) as StoredCoins
      state = { coins: typeof parsed.coins === 'number' ? parsed.coins : 0 }
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

/** Trades coins for one of the prizes - it goes into the bag. */
export function buyCoinPrize(itemId: string): CoinBalance & { itemName: string } {
  const prize = COIN_PRIZES.find((p) => p.itemId === itemId)
  if (!prize) throw new Error("That isn't one of the prizes")
  // Late items (the Raid Crystal) wait for the same boss as the Shop's.
  if (isLateGameItem(prize.itemId) && !lateItemsUnlocked()) throw new Error("That prize isn't unlocked yet")
  if (getCoins() < prize.coins) throw new Error(`That prize costs ${prize.coins.toLocaleString('en-US')} coins`)
  getState().coins -= prize.coins
  persist()
  addItem(prize.itemId, 1)
  const itemName = getEditorOptions().items.find((i) => i.id === prize.itemId)?.name ?? prize.itemId
  return { coins: getCoins(), money: getMoney(), itemName }
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
