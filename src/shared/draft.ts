// Draft mode: six Pokemon picked one at a time from packs of three (each with a Smogon
// set and its item, all at the same level), then a gauntlet of battles - singles bringing
// three of the six, or doubles bringing four, after seeing the opponent's whole team. Each
// format drafts from its own Smogon sets (Gen 9 Ubers to ZU, or Doubles OU). It ends at DRAFT_MAX_WINS
// wins or DRAFT_MAX_LOSSES losses, and pays Game Corner coins by the wins. Shared by the
// main process (see draft-store.ts, which decides everything) and the renderer.

import type { PokemonSummary, RarityTier } from './battle-types'

export const DRAFT_ROUNDS = 6
export const DRAFT_PACK_SIZE = 3
export type DraftFormat = 'singles' | 'doubles'
export const DRAFT_FORMATS: { id: DraftFormat; label: string }[] = [
  { id: 'singles', label: 'Singles' },
  { id: 'doubles', label: 'Doubles' }
]

// How many of the six go into each battle: three in singles (the first leads), four in
// doubles (the first two lead).
export function draftBring(format: DraftFormat): number {
  return format === 'singles' ? 3 : 4
}

// How many of those brought start out on the field.
export function draftLeads(format: DraftFormat): number {
  return format === 'singles' ? 1 : 2
}
export const DRAFT_LEVEL = 50
export const DRAFT_MAX_WINS = 7
export const DRAFT_MAX_LOSSES = 3
// Coins to enter a draft.
export const DRAFT_ENTRY_FEE = 2000
// The coins a finished draft pays, by its number of wins (0 to DRAFT_MAX_WINS).
export const DRAFT_REWARDS = [0, 1250, 2500, 3750, 6250, 8750, 12500, 20000]

export function draftReward(wins: number): number {
  return DRAFT_REWARDS[Math.max(0, Math.min(DRAFT_MAX_WINS, wins))]
}

// One Pokemon as the draft shows it: its set in full, plus the Smogon set's name.
export interface DraftMonView extends PokemonSummary {
  setName: string
  itemSpritenum: number | null
  // Its moves with their types, for the move chips.
  moveList: { name: string; type: string }[]
  // Its rarity colour (as in the box) - rarer cards make more of a show when revealed.
  rarityTier: RarityTier
}

export interface DraftOpponentView {
  name: string
  spriteId: string
  team: DraftMonView[]
}

export interface DraftView {
  status: 'drafting' | 'battling' | 'finished'
  format: DraftFormat
  // Singles: the tiers it drafts from ("Ubers", "OU"...), strongest first - null for doubles.
  tiers: string[] | null
  // The picks so far (all six once drafting is done).
  picks: DraftMonView[]
  // Drafting: the pack to take one from, and which pick this is (1 to DRAFT_ROUNDS).
  pack: DraftMonView[]
  round: number
  wins: number
  losses: number
  // Battling: who's next, whole team on show.
  opponent: DraftOpponentView | null
  // Finished: the coins it paid.
  reward: number
}

// A draft battle's end, for the result window.
export interface DraftBattleResult {
  wins: number
  losses: number
  over: boolean
  reward: number
}
