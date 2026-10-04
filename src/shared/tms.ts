import type { ItemDropResult, RarityTier, WildLocationId } from './battle-types'

/**
 * TMs: one for every move any Pokemon learns by TM (in any generation), kept forever
 * once found. They're found by searching the wild areas (a few skill checks - see
 * SkillCheck), now and then picked up after a wild win, or bought in the Coin Shop -
 * a small set of them only ever sold there, a different handful each day.
 */

export interface TmInfo {
  moveId: string
  name: string
  type: string
  category: 'Physical' | 'Special' | 'Status'
  tier: RarityTier
  // Only sold in the Coin Shop - never found by searching.
  coinOnly: boolean
  // The areas whose searches can turn it up (empty for a Coin Shop one).
  locations: WildLocationId[]
}

export const TM_TIERS: RarityTier[] = ['common', 'uncommon', 'rare', 'epic', 'legendary']

// How a search's TM rarity is rolled: most are grey or blue, gold is rare. The Lab - open
// once every boss is beaten - leans far more to the good end.
export const TM_TIER_WEIGHTS: Record<RarityTier, number> = { common: 45, uncommon: 30, rare: 15, epic: 8, legendary: 2 }
export const TM_LAB_TIER_WEIGHTS: Record<RarityTier, number> = { common: 10, uncommon: 25, rare: 35, epic: 22, legendary: 8 }

// Searches a day in each area, back at midnight.
export const TM_SEARCH_CHARGES_PER_DAY = 3

// Pity: this many searches in one area without a purple or better, and the next one there
// is sure to be at least purple.
export const TM_PITY_SEARCHES = 10

// A search ends badly after this many missed checks - the noise wakes a wild Pokemon.
export const TM_SEARCH_MAX_MISSES = 3

// The skill check's ring: the zone's size in degrees (the Great slice at its start) and
// how long the needle takes to go once round.
export interface SkillCheckSettings {
  goodDeg: number
  greatDeg: number
  spinMs: number
}

export const DEFAULT_SKILL_CHECK: SkillCheckSettings = { goodDeg: 48, greatDeg: 11, spinMs: 1100 }

// The rarer the TM a search is after, the more checks it takes and the harder each one is:
// a smaller zone and a faster needle.
export const TM_SEARCH_DIFFICULTY: Record<RarityTier, SkillCheckSettings & { checks: number }> = {
  common: { checks: 3, goodDeg: 48, greatDeg: 11, spinMs: 1100 },
  uncommon: { checks: 4, goodDeg: 42, greatDeg: 10, spinMs: 1000 },
  rare: { checks: 4, goodDeg: 36, greatDeg: 8, spinMs: 900 },
  epic: { checks: 5, goodDeg: 30, greatDeg: 7, spinMs: 820 },
  legendary: { checks: 6, goodDeg: 26, greatDeg: 6, spinMs: 750 }
}

// Finding a TM already owned pays Poke Dollars instead.
export const TM_DUPLICATE_PAYOUT: Record<RarityTier, number> = {
  common: 300,
  uncommon: 750,
  rare: 1500,
  epic: 3000,
  legendary: 6000
}

// The Coin Shop: this many of its own TMs on sale each day, at these prices in coins.
export const TM_DAILY_COIN_OFFERS = 12
export const TM_COIN_ONLY_COUNT = 48
export const TM_COIN_PRICES: Record<RarityTier, number> = {
  common: 300,
  uncommon: 600,
  rare: 1500,
  epic: 3000,
  legendary: 6000
}

// The Scanner: a key item, bought once in the Coin Shop.
export const TM_SCANNER_COINS = 20000

// With the Scanner, a wild win offers one quick check: each result's chance to turn up a TM
// from the area. Without it there's no quick check at all.
export const TM_QUICK_CHECK_CHANCE: Record<SkillCheckResult, number> = { great: 0.15, good: 0.05, miss: 0 }

// A Good or a Great that found no TM still has this chance to turn up one random item
// instead - picked like a wild Pokemon's random drop.
export const TM_QUICK_CHECK_ITEM_CHANCE = 0.3

export type SkillCheckResult = 'great' | 'good' | 'miss'

export interface TmState {
  owned: string[]
  // Searches left today in each area.
  charges: Record<WildLocationId, number>
  // Searches since the area last gave a purple or better.
  pity: Record<WildLocationId, number>
}

export interface TmSearchStart {
  location: WildLocationId
  // The rarity this search is after - shown as the ring's colour.
  tier: RarityTier
  checks: number
  settings: SkillCheckSettings
  maxMisses: number
  // The pity kicked in for this one.
  pityTriggered: boolean
  state: TmState
}

export interface TmFind {
  tm: TmInfo
  // Already had it: paid out instead.
  duplicate: boolean
  payout: number
  // Every check a Great: rolled one rarity higher.
  upgraded: boolean
}

export interface TmSearchProgress {
  progress: number
  needed: number
  misses: number
  done: boolean
  // Set once it's done: what was found, or null when the noise woke a wild Pokemon.
  find: TmFind | null
  ambush: boolean
  // Specialist gave the area's search back.
  refunded: boolean
  state: TmState
}

export interface TmQuickCheckResult {
  find: TmFind | null
  // The random item found when no TM turned up, with its colour as in the Bag.
  item?: (ItemDropResult & { tier: RarityTier }) | null
}

export interface TmShopOffer {
  tm: TmInfo
  coins: number
  owned: boolean
}

export interface TmShopView {
  offers: TmShopOffer[]
  scannerCoins: number
  hasScanner: boolean
}
