// Title perks: each achievement title carries a small bonus, working for good once it's
// claimed - the player can turn any of them off. A few clash (see TITLE_CLASHES), and
// turning one of those on turns its rivals off. The title shown beside the player's name
// is just for show. They stack with the charms. The main process applies them where each
// thing happens (see title-perks.ts); the renderer only shows what they do.

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
  | 'Five-Star'
  | 'Alchemist'
  | 'Raid Leader'
  | 'Gigantamax Hunter'
  | 'Starlight'
  | 'Diligent'
  | 'Croupier'
  | 'Long Shot'
  | 'Grand Drafter'
  | 'Prospector'
  | 'Light Sleeper'
  | 'Walking Disc'
  | 'Specialist'
  | 'Steady Hands'
  | 'Hex Master'
  | 'Unstoppable'
  | 'AFK'

// What each title does, for the title pickers.
export const TITLE_PERKS: Record<Title, string> = {
  Veteran: 'Double exp from battles',
  'Ace Trainer': '+50% prize money from trainers and bosses',
  'Badge Collector': '50% chance of a bonus Rare Candy after any battle won',
  Champion: 'Running from trainers is free',
  Collector: '25% chance a catch is free',
  Professor: "Pokemon you haven't registered turn up more often in the wild, and the DexNav chain maxes out at 20 instead of 30",
  'Shiny Hunter': 'Wild shiny odds 1 in 384 instead of 1 in 512 (not raid bosses)',
  'Legend Keeper': 'Random Legendary is likelier to give a box legendary',
  Tycoon: '25% off when buying 5 or more of an item at once in the Shop',
  Survivor: 'Roguelite runs start with a free item pick',
  Daredevil: 'Roguelite runs start with a free move and ability pick',
  'Golden Touch': 'The slots jackpot pays ×75 instead of ×50, and every slots win 10% more',
  'High Roller': 'Bet up to 10,000 coins in the Game Corner',
  'Edge Lord': "Plinko's edge slots pay double and the slots next to them 25% more, at every risk",
  Heartless: 'Pokemon sell for 15% more',
  Broker: 'Grey, blue and purple Pokemon sell for double',
  '9+10': 'Blackjack pays 4:1 instead of 3:2, and a regular win 3:2 instead of 1:1',
  'Five-Star': 'Gold legendaries turn up twice as often as raid bosses',
  Alchemist: '10% chance to find a random evolution item when selling a Pokémon',
  'Raid Leader': 'Raid bosses are caught with 2 extra copies',
  'Gigantamax Hunter': 'Raid bosses Gigantamax more often (65% instead of 50%)',
  Starlight: 'Raid bosses are 3× as likely to be shiny (5× with the Shiny Charm)',
  Diligent: 'One extra daily mission reroll',
  Croupier: 'A losing roulette spin has a 10% chance to give every bet back, and a winning one a 10% chance to pay double winnings',
  'Long Shot': 'A losing Dice roll has a 10% chance to give the bet back, and a winning one a 10% chance to pay double winnings',
  'Grand Drafter': 'Drafts cost 25% less to enter',
  Prospector: 'TM searches find gold TMs twice as often',
  'Light Sleeper': 'A TM search takes one extra miss before a wild Pokemon wakes',
  'Walking Disc': 'A TM you already own pays double, and new TMs turn up more often',
  Specialist: "A TM search that finds a TM has a 50% chance to give the area's search back",
  'Steady Hands': "A TM search's Great slice is 50% wider",
  'Hex Master': 'A TM search needs one less Great to come up a rarity higher',
  Unstoppable: "The Scanner's quick check is twice as likely to turn up a TM",
  AFK: "A missed check doesn't knock a TM search back a step"
}

/**
 * Titles that pull against each other: the lead and its rivals are never on together.
 * Turning the lead on turns the rivals off, and turning it off turns them back on; turning
 * a rival on turns the lead off, and once every rival is off the lead comes back on.
 * - Five-Star against Gigantamax Hunter: a Gigantamax boss is never a gold one, so the
 *   two undercut each other.
 */
export const TITLE_CLASHES: { lead: Title; rivals: Title[] }[] = [
  { lead: 'Five-Star', rivals: ['Gigantamax Hunter'] }
]

/** The clash a title is part of, if any. */
export function titleClash(title: string): { lead: Title; rivals: Title[] } | undefined {
  return TITLE_CLASHES.find((c) => c.lead === title || c.rivals.includes(title as Title))
}

/**
 * The titles to turn off for a save from before titles worked for good: in each clash
 * where the lead and a rival are both claimed, the lead goes off - unless it's the title
 * the player was showing (the one whose perk was working), then the rivals do.
 */
export function startingDisabledTitles(claimed: string[], shown: string | null): string[] {
  const off: string[] = []
  for (const { lead, rivals } of TITLE_CLASHES) {
    const claimedRivals = rivals.filter((r) => claimed.includes(r))
    if (!claimed.includes(lead) || claimedRivals.length === 0) continue
    if (shown === lead) off.push(...claimedRivals)
    else off.push(lead)
  }
  return off
}

/** A title's perk, for showing beside it ("" for a title without one). */
export function titlePerk(title: string): string {
  return TITLE_PERKS[title as Title] ?? ''
}

export const VETERAN_EXP_MULTIPLIER = 2
export const ACE_TRAINER_MONEY_MULTIPLIER = 1.5
export const BADGE_COLLECTOR_CANDY_CHANCE = 0.5
export const COLLECTOR_FREE_CATCH_CHANCE = 0.25
// How much likelier an unregistered species is in the wild (a weight on the pick).
export const PROFESSOR_UNREGISTERED_WEIGHT = 2
export const SHINY_HUNTER_ODDS = 384
// With Legend Keeper, how often a Random Legendary is drawn from the box legendaries alone.
export const LEGEND_KEEPER_RESTRICTED_CHANCE = 0.15
// Tycoon: buying at least this many of one item at once takes this much off each.
export const TYCOON_BULK_MIN = 5
export const TYCOON_BULK_MULTIPLIER = 0.75
export const GOLDEN_TOUCH_JACKPOT_BONUS = 25
// ...and every payout (the jackpot included, after its bonus) 10% more.
export const GOLDEN_TOUCH_PAYOUT_MULTIPLIER = 1.1
export const HIGH_ROLLER_BET_CAP = 10000
export const GRAND_DRAFTER_FEE_MULTIPLIER = 0.75
export const EDGE_LORD_EDGE_MULTIPLIER = 2
// ...and the slots next to the edges pay 25% more.
export const EDGE_LORD_NEAR_EDGE_MULTIPLIER = 1.25
export const HEARTLESS_SELL_MULTIPLIER = 1.15
// Broker: these rarity tiers (grey, blue, purple) sell for double.
export const BROKER_DOUBLE_TIERS = new Set(['common', 'uncommon', 'rare'])
// A natural blackjack's payout, to 1: 3:2 normally, 4:1 with 9+10.
export const BLACKJACK_PAYOUT = 1.5
export const NINE_PLUS_TEN_BLACKJACK_PAYOUT = 4
// An ordinary win, to 1: 1:1 normally, 3:2 with 9+10.
export const BLACKJACK_WIN_PAYOUT = 1
export const NINE_PLUS_TEN_WIN_PAYOUT = 1.5
// Max Raid and merging perks.
export const FIVE_STAR_RESTRICTED_CHANCE = 0.3
// Alchemist: how often each Pokemon sold turns up a random evolution item.
export const ALCHEMIST_ITEM_CHANCE = 0.1
export const RAID_LEADER_EXTRA_COPIES = 2
export const GIGANTAMAX_HUNTER_CHANCE = 0.65
export const DILIGENT_EXTRA_REROLLS = 1
// Croupier: how often a losing roulette spin gives every bet on it back, and how often a
// winning one pays its winnings twice.
export const CROUPIER_REFUND_CHANCE = 0.1
export const CROUPIER_DOUBLE_CHANCE = 0.1
// Long Shot: the same two for Dice rolls.
export const LONG_SHOT_REFUND_CHANCE = 0.1
export const LONG_SHOT_DOUBLE_CHANCE = 0.1
// Starlight's raid boss shiny multiplier - in place of the Shiny Charm's 3x, not on top of it.
export const STARLIGHT_RAID_MULTIPLIER = 3
export const STARLIGHT_RAID_CHARM_MULTIPLIER = 5
// TM perks (see tm-store.ts).
export const PROSPECTOR_LEGENDARY_WEIGHT_MULTIPLIER = 2
export const LIGHT_SLEEPER_EXTRA_MISSES = 1
export const WALKING_DISC_PAYOUT_MULTIPLIER = 2
export const WALKING_DISC_NEW_TM_CHANCE = 0.5
export const SPECIALIST_REFUND_CHANCE = 0.5
export const STEADY_HANDS_GREAT_MULTIPLIER = 1.5
export const HEX_MASTER_SPARE_CHECKS = 1
export const UNSTOPPABLE_QUICK_CHECK_MULTIPLIER = 2

// What the Game Corner's games need to know about the player's title.
export interface GameCornerPerks {
  betCap: number
  // Multiplies Plinko's two edge slots, and the two next to them.
  plinkoEdgeMultiplier: number
  plinkoNearEdgeMultiplier: number
  // What a natural blackjack pays, and an ordinary win, to 1.
  blackjackPayout: number
  blackjackWinPayout: number
  // The titles on that change a Game Corner game (see GAME_CORNER_TITLES), for its badges.
  titles: Title[]
}

// The titles that change each Game Corner game: High Roller's bet cap for every one, and
// each game's own payout title.
export const GAME_CORNER_TITLES: Record<'slots' | 'blackjack' | 'roulette' | 'plinko' | 'dice', Title[]> = {
  slots: ['Golden Touch', 'High Roller'],
  blackjack: ['9+10', 'High Roller'],
  roulette: ['Croupier', 'High Roller'],
  plinko: ['Edge Lord', 'High Roller'],
  dice: ['Long Shot', 'High Roller']
}
