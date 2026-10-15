import { randomInt } from '../platform'
import type { PlinkoDrop, PlinkoRisk } from '../../shared/plinko'
import { PLINKO_RISKS, PLINKO_ROWS, PLINKO_SLOTS, plinkoSlotMultiplier } from '../../shared/plinko'
import { betCap, getGameCornerPerks } from './title-perks'
import { changeCoins, getCoins } from './game-corner-store'
import { countAchievement } from './achievement-progress'
import { t } from '../i18n'

/**
 * Game Corner Plinko: every bounce of every ball is decided here, up front (the renderer
 * only plays the ball down the path it took - see shared/plinko for the payouts). The bet
 * is taken and the slot's payout paid in one go.
 */
export function dropPlinko(bet: number, risk: PlinkoRisk): PlinkoDrop {
  if (!PLINKO_RISKS.includes(risk)) throw new Error(t('err.pickARiskLevel'))
  if (!Number.isInteger(bet) || bet < 1) throw new Error(t('err.betAtLeast1Coin'))
  if (bet > betCap()) throw new Error(t('err.betAtMostCoins', { a: betCap() }))
  if (getCoins() < bet) throw new Error(t('err.notEnoughCoinsBuySomeAt'))

  const path = Array.from({ length: PLINKO_ROWS }, () => randomInt(2) === 1)
  const slot = path.filter(Boolean).length
  const edge = slot === 0 || slot === PLINKO_SLOTS - 1
  // The Edge Lord title boosts the edge slots and the ones next to them.
  const multiplier = plinkoSlotMultiplier(risk, slot, getGameCornerPerks())
  const payout = Math.floor(bet * multiplier)
  changeCoins(payout - bet)

  countAchievement('plinkoDrops')
  if (edge) countAchievement('plinkoEdges')
  return { path, slot, multiplier, bet, payout, coins: getCoins() }
}
