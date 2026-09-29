import { randomInt } from 'node:crypto'
import type { PlinkoDrop, PlinkoRisk } from '../../shared/plinko'
import { PLINKO_PAYOUTS, PLINKO_RISKS, PLINKO_ROWS, PLINKO_SLOTS } from '../../shared/plinko'
import { betCap, getGameCornerPerks } from './title-perks'
import { changeCoins, getCoins } from './game-corner-store'
import { countAchievement } from './achievement-progress'

/**
 * Game Corner Plinko: every bounce of every ball is decided here, up front (the renderer
 * only plays the ball down the path it took - see shared/plinko for the payouts). The bet
 * is taken and the slot's payout paid in one go.
 */
export function dropPlinko(bet: number, risk: PlinkoRisk): PlinkoDrop {
  if (!PLINKO_RISKS.includes(risk)) throw new Error('Pick a risk level')
  if (!Number.isInteger(bet) || bet < 1) throw new Error('Bet at least 1 coin')
  if (bet > betCap()) throw new Error(`Bet at most ${betCap()} coins`)
  if (getCoins() < bet) throw new Error('Not enough coins - buy some at the Coin Shop')

  const path = Array.from({ length: PLINKO_ROWS }, () => randomInt(2) === 1)
  const slot = path.filter(Boolean).length
  const edge = slot === 0 || slot === PLINKO_SLOTS - 1
  // The Edge Lord title doubles the edge slots.
  const multiplier = PLINKO_PAYOUTS[risk][slot] * (edge ? getGameCornerPerks().plinkoEdgeMultiplier : 1)
  const payout = Math.floor(bet * multiplier)
  changeCoins(payout - bet)

  countAchievement('plinkoDrops')
  if (edge) countAchievement('plinkoEdges')
  return { path, slot, multiplier, bet, payout, coins: getCoins() }
}
