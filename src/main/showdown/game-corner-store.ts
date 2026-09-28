import { randomInt } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import type { CoinBalance, SlotRules, SlotSpinResult } from '../../shared/slots'
import { COIN_PACKS, COIN_PRICE, COIN_PRIZES, SLOT_REELS, SLOT_RULES, slotWins } from '../../shared/slots'
import { getMoney, spendMoney } from './money-store'
import { addItem } from './bag-store'
import { getEditorOptions, randomSlotPokemon } from './sim-access'
import { playerPathFor } from './save-paths'
import { onPlayerChange } from './player-session'

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
  if (getCoins() < bet) throw new Error('Not enough coins - buy some at the Coin Shop')
  const stops = SLOT_REELS.map((strip) => randomInt(strip.length))
  const wins = slotWins(stops, bet)
  const payout = wins.reduce((sum, w) => sum + w.payout, 0)
  getState().coins += payout - bet
  persist()
  return { stops, wins, payout, coins: getCoins() }
}

/** The machine's rules for this time it's opened - with three freshly picked Pokemon. */
export function getSlotRules(): SlotRules {
  const [high, mid, low] = randomSlotPokemon()
  return { ...SLOT_RULES, pokemon: { high, mid, low } }
}
