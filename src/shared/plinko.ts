// Game Corner Plinko: a Poke Ball dropped through rows of pegs, bouncing left or right at
// each, into one of the slots along the bottom - most land near the middle, a few reach
// the edges. Shared by the main process (which drops every ball - see plinko-store.ts)
// and the renderer (which plays the ball down the path it took).

export const PLINKO_ROWS = 12
// One more slot than rows: slot k is where a ball that bounced right k times lands.
export const PLINKO_SLOTS = PLINKO_ROWS + 1

export type PlinkoRisk = 'low' | 'medium' | 'high'
export const PLINKO_RISKS: PlinkoRisk[] = ['low', 'medium', 'high']
export const PLINKO_RISK_LABELS: Record<PlinkoRisk, string> = { low: 'Low', medium: 'Medium', high: 'High' }

// What each slot pays, times the bet (rounded down to whole coins), left to right. Each
// table pays back about 98% of what's bet over time - worked out exactly from the odds
// of reaching each slot (1 in 4,096 for an edge, about 1 in 4.4 for the middle) - and
// the higher the risk, the more of that sits in the edge slots and the less in the middle.
export const PLINKO_PAYOUTS: Record<PlinkoRisk, number[]> = {
  low: [10, 3.2, 1.6, 1.3, 1.1, 1, 0.5, 1, 1.1, 1.3, 1.6, 3.2, 10],
  medium: [25, 10, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 10, 25],
  high: [150, 30, 5, 2, 0.8, 0.3, 0.2, 0.3, 0.8, 2, 5, 30, 150]
}

/** Coins a slot pays for this bet. */
export function plinkoPayout(bet: number, risk: PlinkoRisk, slot: number): number {
  return Math.floor(bet * PLINKO_PAYOUTS[risk][slot])
}

export interface PlinkoDrop {
  // Which way the ball bounced at each row: true = right.
  path: boolean[]
  slot: number
  multiplier: number
  bet: number
  payout: number
  // The player's coins once it's paid.
  coins: number
}
