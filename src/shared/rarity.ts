import type { RarityTier, WildLocationId } from './battle-types'

/**
 * An item's rarity colour by what the Shop charges for it: grey, then blue from 1,000,
 * purple from 5,000, red from 7,500 and gold from 20,000. The Shop's cards, the Bag's
 * and the Lock Capsule's reel all colour items this way.
 */
export function priceRarityTier(price: number): RarityTier {
  if (price >= 20000) return 'legendary'
  if (price >= 7500) return 'epic'
  if (price >= 5000) return 'rare'
  if (price >= 1000) return 'uncommon'
  return 'common'
}

/** A Coin Shop prize's rarity colour, by its price in coins: blue, purple from 1,000, red from 5,000, gold from 20,000. */
export function coinPrizeRarityTier(coins: number): RarityTier {
  if (coins >= 20000) return 'legendary'
  if (coins >= 5000) return 'epic'
  if (coins >= 1000) return 'rare'
  return 'uncommon'
}

/** The rarity colours from grey up to gold. */
export const RARITY_TIERS: RarityTier[] = ['common', 'uncommon', 'rare', 'epic', 'legendary']

/** The chance (0-1) of each rarity colour coming out of something random - a case, a raid, a search. */
export type RarityOdds = Record<RarityTier, number>

/** One kind of outcome's chance, listed instead of the rarity colours (a raid boss being Gigantamax...). */
export interface OddsKind {
  label: string
  chance: number
  // Its colour: a rarity's, or its own.
  tone: RarityTier | 'gigantamax' | 'secret'
}

/** A tooltip's odds: each rarity colour's (a case, a TM search), or each kind's (a raid). */
export type RarityOddsReport = RarityOdds | { kinds: OddsKind[] }

/** What a rarity-odds tooltip is for: a Max Raid's boss, an openable bag item, or a TM search in an area. */
export type RarityOddsSource = { kind: 'raid' } | { kind: 'item'; itemId: string } | { kind: 'tm'; location: WildLocationId }

/** Several outcomes' odds put together, each counted at its own chance of happening. */
export function mixRarityOdds(parts: [chance: number, odds: RarityOdds][]): RarityOdds {
  const mixed: RarityOdds = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 }
  for (const [chance, odds] of parts) for (const tier of RARITY_TIERS) mixed[tier] += chance * odds[tier]
  return mixed
}

/** A sure thing: this colour every time. */
export function certainRarity(tier: RarityTier): RarityOdds {
  return { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0, [tier]: 1 }
}
