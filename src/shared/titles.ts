// Title perks: each achievement title carries a small bonus, active only while it's the
// title being shown (so which one to wear is a choice). They stack with the charms. The
// main process applies them where each thing happens (see title-perks.ts); the renderer
// only shows what they do.

export type Title =
  | 'Veteran'
  | 'Ace Trainer'
  | 'Badge Collector'
  | 'Champion'
  | 'Collector'
  | 'Professor'
  | 'Shiny Hunter'
  | 'Legend Keeper'
  | 'Tycoon'
  | 'Survivor'
  | 'Daredevil'
  | 'Golden Touch'
  | 'High Roller'
  | 'Edge Lord'
  | 'Heartless'
  | 'Broker'
  | '9+10'

// What each title does, for the title pickers.
export const TITLE_PERKS: Record<Title, string> = {
  Veteran: '+10% exp from battles',
  'Ace Trainer': '+10% prize money from trainers and bosses',
  'Badge Collector': '10% chance of a bonus Rare Candy after any battle won',
  Champion: 'Running from trainers is free',
  Collector: '10% chance a catch is free',
  Professor: "Pokemon you haven't registered turn up more often in the wild",
  'Shiny Hunter': 'Wild shiny odds 1 in 400 instead of 1 in 512',
  'Legend Keeper': 'Random Legendary is likelier to give a box legendary',
  Tycoon: '10% off everything in the Shop',
  Survivor: 'Roguelite runs start with a free item pick',
  Daredevil: 'Roguelite runs start with a free item, move and ability pick',
  'Golden Touch': 'The slots jackpot pays ×60 instead of ×50',
  'High Roller': 'Bet up to 2,000 coins in the Game Corner',
  'Edge Lord': "Plinko's edge slots pay double, at every risk",
  Heartless: 'Pokemon sell for 15% more',
  Broker: 'Grey, blue and purple Pokemon sell for double',
  '9+10': 'Blackjack pays 3:1 instead of 3:2'
}

/** A title's perk, for showing beside it ("" for a title without one). */
export function titlePerk(title: string): string {
  return TITLE_PERKS[title as Title] ?? ''
}

export const VETERAN_EXP_MULTIPLIER = 1.1
export const ACE_TRAINER_MONEY_MULTIPLIER = 1.1
export const BADGE_COLLECTOR_CANDY_CHANCE = 0.1
export const COLLECTOR_FREE_CATCH_CHANCE = 0.1
// How much likelier an unregistered species is in the wild (a weight on the pick).
export const PROFESSOR_UNREGISTERED_WEIGHT = 2
export const SHINY_HUNTER_ODDS = 400
// With Legend Keeper, how often a Random Legendary is drawn from the box legendaries alone.
export const LEGEND_KEEPER_RESTRICTED_CHANCE = 0.15
export const TYCOON_SHOP_MULTIPLIER = 0.9
export const GOLDEN_TOUCH_JACKPOT_BONUS = 10
export const HIGH_ROLLER_BET_CAP = 2000
export const EDGE_LORD_EDGE_MULTIPLIER = 2
export const HEARTLESS_SELL_MULTIPLIER = 1.15
// Broker: these rarity tiers (grey, blue, purple) sell for double.
export const BROKER_DOUBLE_TIERS = new Set(['common', 'uncommon', 'rare'])
// A natural blackjack's payout, to 1: 3:2 normally, 3:1 with 9+10.
export const BLACKJACK_PAYOUT = 1.5
export const NINE_PLUS_TEN_BLACKJACK_PAYOUT = 3

// What the Game Corner's games need to know about the player's title.
export interface GameCornerPerks {
  betCap: number
  // Multiplies Plinko's two edge slots.
  plinkoEdgeMultiplier: number
  // What a natural blackjack pays, to 1.
  blackjackPayout: number
}
