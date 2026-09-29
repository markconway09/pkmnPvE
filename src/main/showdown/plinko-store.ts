import { randomInt } from 'node:crypto'
import type { PlinkoDrop, PlinkoRisk } from '../../shared/plinko'
import { PLINKO_PAYOUTS, PLINKO_RISKS, PLINKO_ROWS, PLINKO_SLOTS, plinkoPayout } from '../../shared/plinko'
import { MAX_BET } from '../../shared/slots'
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
  if (bet > MAX_BET) throw new Error(`Bet at most ${MAX_BET} coins`)
  if (getCoins() < bet) throw new Error('Not enough coins - buy some at the Coin Shop')

  const path = Array.from({ length: PLINKO_ROWS }, () => randomInt(2) === 1)
  const slot = path.filter(Boolean).length
  const payout = plinkoPayout(bet, risk, slot)
  changeCoins(payout - bet)

  countAchievement('plinkoDrops')
  if (slot === 0 || slot === PLINKO_SLOTS - 1) countAchievement('plinkoEdges')
  return { path, slot, multiplier: PLINKO_PAYOUTS[risk][slot], bet, payout, coins: getCoins() }
}
