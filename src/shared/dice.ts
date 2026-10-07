// Game Corner Dice's rules, shared by the main process (which rolls and pays) and the
// renderer (which only shows the roll).
//
// A roll lands anywhere from 0.00 to 100.00. The player puts a divider somewhere on that
// line and bets the roll lands over it or under it. The smaller the side picked, the more
// it pays: the payout is 99 divided by the chance to win, so the house keeps 1%.

// The share of a fair payout a win pays.
export const DICE_RETURN = 0.99
// Where the divider can go: never so far that a side is under 2% or over 98% to win.
export const DICE_MIN_TARGET = 2
export const DICE_MAX_TARGET = 98
// A win at this chance or less counts for the Against the Odds achievement.
export const DICE_LONG_SHOT_CHANCE = 5

/** The chance (in %) a bet wins: the stretch of the line on the side picked. */
export function diceWinChance(target: number, over: boolean): number {
  return over ? 100 - target : target
}

/** What a win multiplies the bet by, to four decimals. */
export function diceMultiplier(target: number, over: boolean): number {
  return Math.floor((DICE_RETURN * 100 * 10000) / diceWinChance(target, over)) / 10000
}

/** A divider within the line's limits, in steps of 0.5. */
export function clampDiceTarget(target: number): number {
  if (!Number.isFinite(target)) return 50
  return Math.min(DICE_MAX_TARGET, Math.max(DICE_MIN_TARGET, Math.round(target * 2) / 2))
}

export interface DiceRoll {
  // 0.00 to 100.00.
  roll: number
  target: number
  over: boolean
  won: boolean
  multiplier: number
  bet: number
  // Coins handed back: the bet times the multiplier on a win, 0 on a loss.
  payout: number
  // The Long Shot title: a loss that gave the bet back, or a win that paid its winnings twice.
  refunded: boolean
  doubled: boolean
  coins: number
}
