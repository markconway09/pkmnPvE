import type { RarityTier } from '../../shared/battle-types'
import { POKEMON_SELL_PRICES, SHINY_SELL_BONUS } from '../../shared/battle-types'
import type { GameCornerPerks, Title } from '../../shared/titles'
import {
  BLACKJACK_PAYOUT,
  BROKER_DOUBLE_TIERS,
  EDGE_LORD_EDGE_MULTIPLIER,
  EDGE_LORD_NEAR_EDGE_MULTIPLIER,
  HEARTLESS_SELL_MULTIPLIER,
  HIGH_ROLLER_BET_CAP,
  NINE_PLUS_TEN_BLACKJACK_PAYOUT,
  NINE_PLUS_TEN_WIN_PAYOUT,
  BLACKJACK_WIN_PAYOUT,
  TYCOON_BULK_MULTIPLIER
} from '../../shared/titles'
import { MAX_BET } from '../../shared/slots'
import { getAchievementProgress } from './achievement-progress'

/**
 * Title perks (see shared/titles): whether the logged-in player is showing a title, and
 * the few perks that change a number used in more than one place. The rest are applied
 * right where they happen (a battle's exp, a catch, a run's start...).
 */

/** Whether the player is showing this title right now - only the shown title's perk works. */
export function hasTitle(title: Title): boolean {
  try {
    return getAchievementProgress().title === title
  } catch {
    // Nobody logged in.
    return false
  }
}

/** What a Pokemon of this rarity sells for, with Heartless or Broker. */
export function monSellPrice(tier: RarityTier, shiny = false, copies = 1): number {
  // A merged Pokemon pays for every copy that went into it.
  return rarityPrice(tier) * Math.max(1, copies) + (shiny ? SHINY_SELL_BONUS : 0)
}

// Its rarity's price, with a title's bonus.
function rarityPrice(tier: RarityTier): number {
  const base = POKEMON_SELL_PRICES[tier]
  if (hasTitle('Broker') && BROKER_DOUBLE_TIERS.has(tier)) return base * 2
  if (hasTitle('Heartless')) return Math.round(base * HEARTLESS_SELL_MULTIPLIER)
  return base
}

/** A Shop price for one (Tycoon's discount is only for buying in bulk - see bulkShopPrice). */
export function shopPrice(price: number): number {
  return price
}

/** Each one's price when buying TYCOON_BULK_MIN or more at once - lower with Tycoon, else none. */
export function bulkShopPrice(price: number): number | undefined {
  return hasTitle('Tycoon') ? Math.max(1, Math.round(price * TYCOON_BULK_MULTIPLIER)) : undefined
}

/** The most one Game Corner bet can be. */
export function betCap(): number {
  return hasTitle('High Roller') ? HIGH_ROLLER_BET_CAP : MAX_BET
}

export function getGameCornerPerks(): GameCornerPerks {
  return {
    betCap: betCap(),
    plinkoEdgeMultiplier: hasTitle('Edge Lord') ? EDGE_LORD_EDGE_MULTIPLIER : 1,
    plinkoNearEdgeMultiplier: hasTitle('Edge Lord') ? EDGE_LORD_NEAR_EDGE_MULTIPLIER : 1,
    blackjackPayout: hasTitle('9+10') ? NINE_PLUS_TEN_BLACKJACK_PAYOUT : BLACKJACK_PAYOUT,
    blackjackWinPayout: hasTitle('9+10') ? NINE_PLUS_TEN_WIN_PAYOUT : BLACKJACK_WIN_PAYOUT
  }
}
