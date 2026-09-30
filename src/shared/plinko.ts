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
// table pays back about 99.7% of what's bet over time - worked out exactly from the odds
// of reaching each slot (1 in 4,096 for an edge, about 1 in 4.4 for the middle). Low and
// Medium win on every slot but the middle (about 77% of drops), Medium keeping more in its
// edges; High wins on about 39% of drops, with most of its payback in the edges.
export const PLINKO_PAYOUTS: Record<PlinkoRisk, number[]> = {
  low: [7, 3, 1.3, 1.2, 1.2, 1.1, 0.4, 1.1, 1.2, 1.2, 1.3, 3, 7],
  medium: [15, 6, 2.5, 1.5, 1.1, 1.1, 0.1, 1.1, 1.1, 1.5, 2.5, 6, 15],
  high: [110, 20, 4, 2, 1.1, 0.5, 0.1, 0.5, 1.1, 2, 4, 20, 110]
}

/**
 * A slot's multiplier with the title's boosts (Edge Lord): one for the two edge slots and
 * one for the two next to them.
 */
export function plinkoSlotMultiplier(
  risk: PlinkoRisk,
  slot: number,
  perks: { plinkoEdgeMultiplier: number; plinkoNearEdgeMultiplier: number }
): number {
  const fromEdge = Math.min(slot, PLINKO_SLOTS - 1 - slot)
  const boost = fromEdge === 0 ? perks.plinkoEdgeMultiplier : fromEdge === 1 ? perks.plinkoNearEdgeMultiplier : 1
  return PLINKO_PAYOUTS[risk][slot] * boost
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
