import type { RarityTier, WildLocationId } from './battle-types'

// The DexNav: a key item (from the Pokedex Scholar achievement) that hunts one species the
// player has registered. In a wild battle where the target can live, it turns up
// DEXNAV_BASE_CHANCE of the time, rising evenly with the chain to DEXNAV_MAX_CHANCE at its
// max. The chain grows by one for each hunted Pokemon beaten or caught, and breaks on
// running from or losing to one (other encounters leave it be).
// (DEXNAV_ITEM_ID itself lives with the other key items in battle-types.)
export const DEXNAV_BASE_CHANCE = 0.15
export const DEXNAV_MAX_CHANCE = 0.75
// The chain stops counting here: the most it can do (75%, and twice the shiny odds). With
// the Professor title it maxes out sooner - each link counts for more, to the same top.
export const DEXNAV_MAX_CHAIN = 30
export const PROFESSOR_DEXNAV_MAX_CHAIN = 20
// The hunted Pokemon's shiny odds rise with the chain, up to this multiplier at its max.
export const DEXNAV_MAX_SHINY_MULTIPLIER = 2

// How far the chain is towards its max, from 0 to 1.
function chainProgress(chain: number, maxChain: number): number {
  return Math.min(1, Math.max(0, chain) / maxChain)
}

/** How often the target turns up at this chain: 15% at none, rising evenly to 75% at the max. */
export function dexNavChance(chain: number, maxChain: number): number {
  return DEXNAV_BASE_CHANCE + (DEXNAV_MAX_CHANCE - DEXNAV_BASE_CHANCE) * chainProgress(chain, maxChain)
}

/** The shiny multiplier a hunted Pokemon gets at this chain: 1x at none, rising evenly to 2x. */
export function dexNavShinyMultiplier(chain: number, maxChain: number): number {
  return 1 + (DEXNAV_MAX_SHINY_MULTIPLIER - 1) * chainProgress(chain, maxChain)
}

/** A species the DexNav can hunt: registered, and found in the wild. */
export interface DexNavCandidate {
  species: string
  num: number
  // The wild areas it lives in ('all' - Anywhere - always counts too).
  locations: WildLocationId[]
  // The lowest wild level it can be met at (its evolution stage, and how strong it is).
  minLevel: number
  rarityTier: RarityTier
}

export interface DexNavState {
  // Whether the player has the DexNav at all.
  owned: boolean
  target: DexNavCandidate | null
  chain: number
  // Where the chain stops counting (sooner with the Professor title).
  maxChain: number
}
