import type { RarityTier } from './battle-types'

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
