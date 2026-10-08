import { randomInt } from '../platform'
import type { DiceRoll } from '../../shared/dice'
import { DICE_LONG_SHOT_CHANCE, DICE_MAX_TARGET, DICE_MIN_TARGET, diceMultiplier, diceWinChance } from '../../shared/dice'
import { LONG_SHOT_DOUBLE_CHANCE, LONG_SHOT_REFUND_CHANCE } from '../../shared/titles'
import { betCap, hasTitle } from './title-perks'
import { countAchievement } from './achievement-progress'
import { changeCoins, getCoins } from './game-corner-store'

/**
 * Game Corner Dice, rolled here (the renderer only slides the marker to where it landed -
 * see shared/dice for the payouts). The bet is taken and the win paid in one go.
 */
export function rollDice(bet: number, target: number, over: boolean): DiceRoll {
  if (!Number.isInteger(bet) || bet < 1) throw new Error('Bet at least 1 coin')
  if (bet > betCap()) throw new Error(`Bet at most ${betCap()} coins`)
  if (getCoins() < bet) throw new Error('Not enough coins - buy some at the Coin Shop')
  if (typeof target !== 'number' || target < DICE_MIN_TARGET || target > DICE_MAX_TARGET || (target * 2) % 1 !== 0) {
    throw new Error(`Put the divider between ${DICE_MIN_TARGET} and ${DICE_MAX_TARGET}`)
  }
  over = !!over

  // Any of the 10,001 hundredths from 0.00 to 100.00. Landing right on the divider loses.
  const roll = randomInt(10001) / 100
  const won = over ? roll > target : roll < target
  const multiplier = diceMultiplier(target, over)
  let payout = won ? Math.floor(bet * multiplier) : 0
  // The Long Shot title: now and then a loss gives the bet back, or a win pays its winnings
  // (what it pays on top of the bet) twice.
  const longShot = hasTitle('Long Shot')
  const refunded = !won && longShot && Math.random() < LONG_SHOT_REFUND_CHANCE
  const doubled = won && longShot && Math.random() < LONG_SHOT_DOUBLE_CHANCE
  if (refunded) payout = bet
  if (doubled) payout += payout - bet
  changeCoins(payout - bet)
  if (won && diceWinChance(target, over) <= DICE_LONG_SHOT_CHANCE) countAchievement('diceLongShots')
  return { roll, target, over, won, multiplier, bet, payout, refunded, doubled, coins: getCoins() }
}
