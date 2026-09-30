import { randomInt } from 'node:crypto'
import type { RouletteBetResult, RouletteSpin } from '../../shared/roulette'
import { ROULETTE_MAX_FULL_BETS, ROULETTE_NUMBERS, betOdds, betWins, isRouletteBet } from '../../shared/roulette'
import { betCap } from './title-perks'
import { changeCoins, getCoins } from './game-corner-store'
import { onPlayerChange } from './player-session'
import { countAchievement } from './achievement-progress'

/**
 * Game Corner roulette, spun here (the renderer only turns the wheel to where the ball
 * already landed - see shared/roulette for the table). Every bet on the board is taken
 * when the wheel spins and each winning one paid at once.
 */

const HISTORY_KEPT = 12

// The last few pockets, newest first - only while the game runs, like a real table's board.
let history: number[] = []

onPlayerChange(() => {
  history = []
})

export function getRouletteHistory(): number[] {
  return [...history]
}

/** Spins the wheel with these bets on the board (bet key -> coins on it). */
export function spinRoulette(bets: Record<string, number>): RouletteSpin {
  const entries = Object.entries(bets).filter(([, amount]) => amount > 0)
  if (entries.length === 0) throw new Error('Place a bet on the board first')
  for (const [key, amount] of entries) {
    if (!isRouletteBet(key)) throw new Error("That isn't a bet on this table")
    if (!Number.isInteger(amount)) throw new Error('Bets are whole coins')
    if (amount > betCap()) throw new Error(`Each spot takes at most ${betCap()} coins`)
  }
  const totalBet = entries.reduce((sum, [, amount]) => sum + amount, 0)
  const tableCap = betCap() * ROULETTE_MAX_FULL_BETS
  if (totalBet > tableCap) throw new Error(`The table takes at most ${tableCap} coins a spin`)
  if (getCoins() < totalBet) throw new Error('Not enough coins - buy some at the Coin Shop')

  changeCoins(-totalBet)
  const pocket = randomInt(ROULETTE_NUMBERS)
  const results: RouletteBetResult[] = entries.map(([key, amount]) => ({
    key,
    amount,
    returned: betWins(key, pocket) ? amount * (betOdds(key) + 1) : 0
  }))
  const totalReturned = results.reduce((sum, r) => sum + r.returned, 0)
  if (totalReturned > 0) changeCoins(totalReturned)

  history = [pocket, ...history].slice(0, HISTORY_KEPT)
  countAchievement('rouletteSpins')
  if (results.some((r) => r.key.startsWith('n:') && r.returned > 0)) countAchievement('rouletteNumberWins')
  return { pocket, bets: results, totalBet, totalReturned, coins: getCoins(), history: [...history] }
}
