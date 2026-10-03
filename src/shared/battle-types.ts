import type { TmInfo } from './tms'
import type { ChoiceRequest } from 'pokemon-showdown/dist/sim/side.js'
import type { DraftBattleResult } from './draft'

// Not a real Dex item - stands in for "a trade partner" for evolutions that
// need a trade but no specific item (this project has no trading). See
// getEditorOptions() in sim-access.ts, where it's merged into the item list.
export const LINK_CABLE_ITEM_ID = 'linkcable'

// Also not a real Dex item (Rare Candy isn't a held/battle item, so the sim
// has no entry for it) - shop-only for now, see getEditorOptions() in
// sim-access.ts.
export const RARE_CANDY_ITEM_ID = 'rarecandy'

// Also not real Dex items in this Showdown version - the evolution items for
// Kleavor and Ursaluna, added the same way (see getEditorOptions() in
// sim-access.ts).
export const BLACK_AUGURITE_ITEM_ID = 'blackaugurite'
export const PEAT_BLOCK_ITEM_ID = 'peatblock'

// Shop items that are opened from the bag for a random Pokemon in the box: any
// unevolved Pokemon (legendaries included), or only a legendary/mythical/ultra
// beast/paradox one. Not real Dex items - see getEditorOptions() in sim-access.ts.
export const RANDOM_POKEMON_ITEM_ID = 'randompokemon'
export const RANDOM_LEGENDARY_ITEM_ID = 'randomlegendary'
// Opened from the bag for a random item from the shop - the pricier, the rarer.
export const LOCK_CAPSULE_ITEM_ID = 'lockcapsule'
export const OPENABLE_ITEM_IDS = new Set([RANDOM_POKEMON_ITEM_ID, RANDOM_LEGENDARY_ITEM_ID, LOCK_CAPSULE_ITEM_ID])

// Used from the bag to give every Pokemon on the team this much exp. Not real
// Dex items - see getEditorOptions() in sim-access.ts.
export const EXP_CANDY_EXP: Record<string, number> = {
  expcandys: 10000,
  expcandym: 50000,
  expcandyl: 100000
}

// Spent from a Pokemon's right-click menu to make it shiny. Not a real Dex item -
// see getEditorOptions() in sim-access.ts.
export const SHINY_PATCH_ITEM_ID = 'shinypatch'
// Starts a Max Raid Battle from the Classic menu (used up when the raid begins).
export const WISHING_PIECE_ITEM_ID = 'wishingpiece'

// Key items: never sold back - each is unlocked by an achievement (or, the Scanner, bought
// in the Coin Shop) and kept for good.
// The Rotom Catalog changes a Rotom's form from its right-click menu; the Exp. Charm gives
// 1.5x exp from battles; the Shiny Charm triples the odds of a shiny wild one.
export const ROTOM_CATALOG_ITEM_ID = 'rotomcatalog'
export const EXP_CHARM_ITEM_ID = 'expcharm'
export const SHINY_CHARM_ITEM_ID = 'shinycharm'
export const EXP_CHARM_MULTIPLIER = 1.5
export const SHINY_CHARM_MULTIPLIER = 3
// The Friendship Charm doubles the friendship from each battle won; the Catching Charm
// makes half of all catches free (no Poke Ball used, nothing paid); the Item Charm makes
// a wild Pokemon's item drops 1.5x as likely.
export const FRIENDSHIP_CHARM_ITEM_ID = 'friendshipcharm'
export const CATCHING_CHARM_ITEM_ID = 'catchingcharm'
export const ITEM_CHARM_ITEM_ID = 'itemcharm'
export const FRIENDSHIP_CHARM_MULTIPLIER = 2
export const CATCHING_CHARM_FREE_CHANCE = 0.5
export const ITEM_CHARM_DROP_MULTIPLIER = 1.5
// The fusion items: each fuses a legendary with its partner (who waits inside until
// they're unfused) - see FUSIONS.
export const N_SOLARIZER_ITEM_ID = 'nsolarizer'
export const N_LUNARIZER_ITEM_ID = 'nlunarizer'
export const DNA_SPLICERS_ITEM_ID = 'dnasplicers'
export const REINS_OF_UNITY_ITEM_ID = 'reinsofunity'
// The form-change items (see FORM_CHANGES).
export const PRISON_BOTTLE_ITEM_ID = 'prisonbottle'
export const REVEAL_GLASS_ITEM_ID = 'revealglass'
export const GRACIDEA_ITEM_ID = 'gracidea'
export const METEORITE_ITEM_ID = 'meteorite'
export const ZYGARDE_CUBE_ITEM_ID = 'zygardecube'
export const DECORATION_BOX_ITEM_ID = 'decorationbox'
export const FASHION_CASE_ITEM_ID = 'fashioncase'
// The one key item bought instead (in the Coin Shop): it opens the TM quick check after wild wins.
export const SCANNER_ITEM_ID = 'scanner'

// Pikachu's forms the Fashion Case changes between: plain Pikachu, the caps, the Cosplay
// outfits, Partner and World. Owning three different ones at once unlocks it.
export const PIKACHU_FORMS = [
  'Pikachu',
  'Pikachu-Original',
  'Pikachu-Hoenn',
  'Pikachu-Sinnoh',
  'Pikachu-Unova',
  'Pikachu-Kalos',
  'Pikachu-Alola',
  'Pikachu-Partner',
  'Pikachu-World',
  'Pikachu-Cosplay',
  'Pikachu-Rock-Star',
  'Pikachu-Belle',
  'Pikachu-Pop-Star',
  'Pikachu-PhD',
  'Pikachu-Libre'
]

// Alcremie's nine creams - each its own Pokedex form here. Vanilla Cream is plain Alcremie.
export const ALCREMIE_FORMS = [
  'Alcremie',
  'Alcremie-Ruby-Cream',
  'Alcremie-Matcha-Cream',
  'Alcremie-Mint-Cream',
  'Alcremie-Lemon-Cream',
  'Alcremie-Salted-Cream',
  'Alcremie-Ruby-Swirl',
  'Alcremie-Caramel-Swirl',
  'Alcremie-Rainbow-Swirl'
]
// Minior's seven cores (plain Minior is the red one) - all of them for an achievement.
export const MINIOR_COLORS = [
  'Minior',
  'Minior-Orange',
  'Minior-Yellow',
  'Minior-Green',
  'Minior-Blue',
  'Minior-Indigo',
  'Minior-Violet'
]
export const KEY_ITEM_IDS = new Set([
  ROTOM_CATALOG_ITEM_ID,
  EXP_CHARM_ITEM_ID,
  SHINY_CHARM_ITEM_ID,
  FRIENDSHIP_CHARM_ITEM_ID,
  CATCHING_CHARM_ITEM_ID,
  ITEM_CHARM_ITEM_ID,
  N_SOLARIZER_ITEM_ID,
  N_LUNARIZER_ITEM_ID,
  DNA_SPLICERS_ITEM_ID,
  REINS_OF_UNITY_ITEM_ID,
  PRISON_BOTTLE_ITEM_ID,
  REVEAL_GLASS_ITEM_ID,
  GRACIDEA_ITEM_ID,
  METEORITE_ITEM_ID,
  ZYGARDE_CUBE_ITEM_ID,
  DECORATION_BOX_ITEM_ID,
  FASHION_CASE_ITEM_ID,
  SCANNER_ITEM_ID
])

// The form-change key items: with one in the bag, a Pokemon in its group can be changed
// into any other form in that group from its right-click menu.
export const FORM_CHANGES: { itemId: string; forms: string[] }[] = [
  {
    itemId: ROTOM_CATALOG_ITEM_ID,
    forms: ['Rotom', 'Rotom-Heat', 'Rotom-Wash', 'Rotom-Frost', 'Rotom-Fan', 'Rotom-Mow']
  },
  { itemId: PRISON_BOTTLE_ITEM_ID, forms: ['Hoopa', 'Hoopa-Unbound'] },
  { itemId: REVEAL_GLASS_ITEM_ID, forms: ['Tornadus', 'Tornadus-Therian'] },
  { itemId: REVEAL_GLASS_ITEM_ID, forms: ['Thundurus', 'Thundurus-Therian'] },
  { itemId: REVEAL_GLASS_ITEM_ID, forms: ['Landorus', 'Landorus-Therian'] },
  { itemId: REVEAL_GLASS_ITEM_ID, forms: ['Enamorus', 'Enamorus-Therian'] },
  { itemId: GRACIDEA_ITEM_ID, forms: ['Shaymin', 'Shaymin-Sky'] },
  { itemId: METEORITE_ITEM_ID, forms: ['Deoxys', 'Deoxys-Attack', 'Deoxys-Defense', 'Deoxys-Speed'] },
  { itemId: ZYGARDE_CUBE_ITEM_ID, forms: ['Zygarde', 'Zygarde-10%'] },
  // Only the cream changes - the same Pokemon otherwise (see changeForm).
  { itemId: DECORATION_BOX_ITEM_ID, forms: ALCREMIE_FORMS },
  // Only the outfit changes, as with Alcremie.
  { itemId: FASHION_CASE_ITEM_ID, forms: PIKACHU_FORMS }
]

export interface FusionRule {
  // The Pokemon fused (in its plain form), the partner taken in, and what they become.
  base: string
  partner: string
  result: string
  itemId: string
}

export const FUSIONS: FusionRule[] = [
  { base: 'Necrozma', partner: 'Solgaleo', result: 'Necrozma-Dusk-Mane', itemId: N_SOLARIZER_ITEM_ID },
  { base: 'Necrozma', partner: 'Lunala', result: 'Necrozma-Dawn-Wings', itemId: N_LUNARIZER_ITEM_ID },
  { base: 'Kyurem', partner: 'Zekrom', result: 'Kyurem-Black', itemId: DNA_SPLICERS_ITEM_ID },
  { base: 'Kyurem', partner: 'Reshiram', result: 'Kyurem-White', itemId: DNA_SPLICERS_ITEM_ID },
  { base: 'Calyrex', partner: 'Glastrier', result: 'Calyrex-Ice', itemId: REINS_OF_UNITY_ITEM_ID },
  { base: 'Calyrex', partner: 'Spectrier', result: 'Calyrex-Shadow', itemId: REINS_OF_UNITY_ITEM_ID }
]

// Bag-only items: they exist to be spent, not held in battle, so the held-item
// picker leaves them out.
export const NON_HELD_ITEM_IDS = new Set([
  LINK_CABLE_ITEM_ID,
  RARE_CANDY_ITEM_ID,
  BLACK_AUGURITE_ITEM_ID,
  PEAT_BLOCK_ITEM_ID,
  SHINY_PATCH_ITEM_ID,
  WISHING_PIECE_ITEM_ID,
  ...KEY_ITEM_IDS,
  ...OPENABLE_ITEM_IDS,
  ...Object.keys(EXP_CANDY_EXP)
])

// Friendship runs 0-255. Pokemon join the box at 0, gain FRIENDSHIP_PER_BATTLE
// after each battle won, and every friendship-style evolution needs it maxed.
export const MAX_HAPPINESS = 255
export const FRIENDSHIP_PER_BATTLE = 10

// The only ball this game tracks - shared between the shop (sim-access.ts)
// and catching a defeated wild Pokemon (battle-runtime.ts), so both always
// agree on the id/price.
export const DEFAULT_POKEBALL_ID = 'pokeball'
export const POKEBALL_PRICE = 200

// Prize money for beating a trainer: a set amount for every Pokemon on the team
// they fielded, or one flat sum for a boss.
export const TRAINER_PRIZE_PER_POKEMON = 250
export const BOSS_PRIZE = 2500

// Every wild Pokemon defeated has this percent chance to also drop one item, picked
// at random from everything the game has (see getWildDropPool). Independent of any
// drop configured for that species.
export const WILD_RANDOM_DROP_CHANCE = 10

// The base prize grows with progress: the level cap the fight was held under is
// added on as a percentage of it (cap 80 -> +80%, so a boss pays 2500 + 2000).
export function prizeMoneyFor(isBoss: boolean, teamSize: number, levelCap: number): number {
  const base = isBoss ? BOSS_PRIZE : TRAINER_PRIZE_PER_POKEMON * teamSize
  return Math.round(base * (1 + levelCap / 100))
}

// Which wild Pokemon a Wild Battle can roll, picked from the main menu's
// location row. A species qualifies if any of its types are in `types`, or
// if any of its egg groups are in `eggGroups` (a loose habitat proxy - the
// closest thing pokemon-showdown's data has to one, since it strips out the
// mainline games' own Pokedex habitat field entirely), or if it's one of the
// named exceptions - lines that belong somewhere thematically despite their
// actual typing/egg group (e.g. Zubat's line in a cave). `types: null` means
// no type filtering at all (the old, pre-location behavior); `eggGroups`
// works the same way when omitted. Exceptions match on base species name, so
// every stage of a line is included by naming just one of them.
export type WildLocationId = 'cave' | 'mountain' | 'forest' | 'city' | 'industry' | 'cemetery' | 'ocean' | 'all' | 'lab'

export interface WildLocationConfig {
  id: WildLocationId
  label: string
  icon: string
  types: string[] | null
  eggGroups?: string[]
  exceptionBaseSpecies: string[]
  // Only there once every boss is beaten, with an encounter table of its own
  // (the Lab - see generateLabWildMon) instead of the type filters.
  requiresAllBosses?: boolean
}

// Weather and terrain a battle can start with (a boss's Field setting, or the chance of
// weather in a wild area): up from the first turn, and lasting until something replaces it.
export const FIELD_START_WEATHERS: { id: string; label: string }[] = [
  { id: 'sunnyday', label: 'Sun' },
  { id: 'raindance', label: 'Rain' },
  { id: 'sandstorm', label: 'Sandstorm' },
  { id: 'snowscape', label: 'Snow' }
]

export const FIELD_START_TERRAINS: { id: string; label: string }[] = [
  { id: 'electricterrain', label: 'Electric' },
  { id: 'grassyterrain', label: 'Grassy' },
  { id: 'mistyterrain', label: 'Misty' },
  { id: 'psychicterrain', label: 'Psychic' }
]

// The chance a wild battle starts with a random one of those weathers - anywhere but
// the places with no sky (the Cave and the Lab).
export const WILD_WEATHER_CHANCE = 0.15
export const WILD_WEATHERLESS_LOCATIONS: WildLocationId[] = ['cave', 'lab']

/** The weather a wild battle in this area starts with, if the 15% roll comes up. */
export function rollWildWeather(location: WildLocationId | null | undefined): string | null {
  if (location && WILD_WEATHERLESS_LOCATIONS.includes(location)) return null
  if (Math.random() >= WILD_WEATHER_CHANCE) return null
  return FIELD_START_WEATHERS[Math.floor(Math.random() * FIELD_START_WEATHERS.length)].id
}

export const WILD_LOCATIONS: WildLocationConfig[] = [
  {
    id: 'cave',
    label: 'Cave',
    icon: '🗻',
    types: ['Rock', 'Dark', 'Steel', 'Ground'],
    eggGroups: ['Mineral', 'Amorphous'],
    exceptionBaseSpecies: ['Zubat', 'Woobat', 'Noibat']
  },
  {
    id: 'mountain',
    label: 'Mountain',
    icon: '⛰️',
    types: ['Rock', 'Ice', 'Fire', 'Dragon'],
    eggGroups: ['Monster', 'Dragon'],
    exceptionBaseSpecies: ['Sneasel']
  },
  {
    id: 'forest',
    label: 'Forest',
    icon: '🌲',
    types: ['Grass', 'Bug', 'Fairy', 'Normal', 'Flying'],
    eggGroups: ['Grass', 'Bug', 'Field'],
    exceptionBaseSpecies: ['Pansear', 'Panpour', 'Mankey', 'Heatmor']
  },
  {
    id: 'city',
    label: 'City',
    icon: '🏙️',
    types: ['Fighting', 'Psychic', 'Poison', 'Fairy', 'Normal'],
    eggGroups: ['Human-Like', 'Fairy'],
    exceptionBaseSpecies: []
  },
  {
    id: 'industry',
    label: 'Industry',
    icon: '🏭',
    types: ['Electric', 'Steel', 'Fighting', 'Fire', 'Poison'],
    eggGroups: ['Mineral', 'Amorphous'],
    exceptionBaseSpecies: []
  },
  {
    id: 'cemetery',
    label: 'Graveyard',
    icon: '🪦',
    types: ['Ground', 'Ghost', 'Bug', 'Dark'],
    eggGroups: ['Amorphous'],
    exceptionBaseSpecies: []
  },
  {
    id: 'ocean',
    label: 'Ocean',
    icon: '🌊',
    types: ['Water', 'Ice', 'Flying'],
    // Dragon deliberately left out here too (see exceptionBaseSpecies) - the
    // Water egg groups already cover nearly everything Water-typed does.
    eggGroups: ['Water 1', 'Water 2', 'Water 3'],
    exceptionBaseSpecies: ['Dratini', 'Tynamo']
  },
  {
    id: 'all',
    label: 'All',
    icon: '🌐',
    types: null,
    exceptionBaseSpecies: []
  },
  {
    id: 'lab',
    label: 'Lab',
    icon: '🧪',
    types: null,
    exceptionBaseSpecies: [],
    requiresAllBosses: true
  }
]

// What it costs to have a fossil restored into a Pokemon.
export const FOSSIL_RESTORE_COST = 100

export type BoostStat = 'atk' | 'def' | 'spa' | 'spd' | 'spe' | 'accuracy' | 'evasion'

export interface StatBlock {
  hp: number
  atk: number
  def: number
  spa: number
  spd: number
  spe: number
}

export interface MoveInfo {
  id: string
  name: string
  type: string
  category: string
  basePower: number
  accuracy: number | true
  pp: number
  description: string
  target: string
  // Whether it makes physical contact (Physical moves without this flag,
  // like most tail/head moves, still don't count) and whether it hits more
  // than once - both drive which generic animation it gets (see
  // moveAnimations.ts): a lunge for contact, a flung effect otherwise, and
  // extra reps for a move that hits multiple times.
  contact: boolean
  multihit: boolean
  // Above 0 for a priority move (Quick Attack, Extreme Speed...) - it animates faster.
  priority: number
  // A status move that raises or lowers stats: which way, overall - its animation shows
  // rising or falling arrows (see moveAnimations.ts).
  boostDir?: 'up' | 'down'
  // The Showdown flags that change how it animates (punch, bite, slicing, sound...).
  animFlags?: string[]
  // In the box's editor: this Pokemon learns it only by TM, and the player doesn't own
  // that TM yet (see tm-store's lockedTmMoves).
  tmLocked?: boolean
}

export interface PokemonSummary {
  species: string
  level: number
  types: string[]
  ability: string
  item: string
  nature: string
  teraType: string
  stats: StatBlock
  moveIds: string[]
  // 'M', 'F' or 'N' (genderless) - '' when it isn't set.
  gender: string
  shiny: boolean
}

export interface VolatileBadge {
  // The effect's id ("taunt", "perish") - one badge per id.
  id: string
  label: string
  // Colours it: good for its side (Aqua Ring), bad (Taunted) or neither (Uproar).
  kind: 'good' | 'bad' | 'neutral'
}

// One move against one foe: who it is, and the type multiplier (0, 0.5, 2...).
export interface MoveMatchup {
  foeName: string
  multiplier: number
}

export interface ActivePokemonView extends PokemonSummary {
  // Its rarity colour (see speciesRarityTier), for its card on the team panel.
  rarityTier?: RarityTier
  // Dynamaxed right now (a Max Raid's boss), and in its Gigantamax form.
  dynamaxed?: boolean
  gigantamax?: boolean
  // The player's cosmetic Gigantamax look: just its Gigantamax sprite, not Dynamaxed.
  gmaxLook?: boolean
  // Where it is in its side's roster (the order the team was built in) - tells two of
  // the same species apart.
  rosterIndex?: number
  /**
   * What its types are without any change made in battle - "types" (from
   * PokemonSummary) is what they are right now, so the two differ after Soak,
   * Forest's Curse, Trick-or-Treat, Reflect Type, Terastallizing and the like.
   */
  baseTypes: string[]
  hpPercent: number
  fainted: boolean
  status: string | null
  // Substitute is up - the renderer fades the real sprite and shows a doll
  // in front of it, the same idea as Showdown's own battle screen.
  substituted: boolean
  // A Protect-family move is up for the rest of this turn (Protect, Detect,
  // Spiky Shield, King's Shield, ...) - the renderer shows a shield overlay
  // for as long as this is true. Cleared at the start of the next turn, same
  // as the real "singleturn" volatile it mirrors.
  protecting: boolean
  // Its Tera type once it has Terastallized (for the rest of the battle), else null -
  // shown even when Terastallizing didn't change its types (a Fire Tera on a Fire type).
  terastallized: string | null
  // It has Mega Evolved (or Primal Reverted / Ultra Bursted) - shown with a Mega icon
  // in the same place as the Tera one.
  megaEvolved: boolean
  boosts: Partial<Record<BoostStat, number>>
  // A wild Pokemon of a species the player has caught (had in their box) before -
  // a Poke Ball shows by its name, like the games do.
  caughtBefore?: boolean
  // Temporary conditions on it (Confused, Taunted, Leech Seed, Perish 2, ...), shown as
  // badges under its HP bar like Showdown does - see volatile-badges.ts.
  volatiles: VolatileBadge[]
  /**
   * The stats it has at this moment - the base stats above with its stat stages
   * and the effect of its item, ability, status and the field applied. Only set
   * on the Pokemon out in battle, in the field snapshots.
   */
  effectiveStats?: StatBlock
  /**
   * Each of its moves' type effectiveness against each opposing Pokemon out, in screen
   * order (left to right), keyed by move id - for its tooltip. Only set in battle; a
   * status move (or one the type chart doesn't apply to) has no entry.
   */
  moveMatchups?: Record<string, MoveMatchup[]>
  /**
   * Increments only when this side's active slot is switched to a new team
   * member (not on in-place form changes like Mega Evolution) - lets the UI
   * tell "a switch happened" apart from "the same Pokemon just changed form
   * or took damage", so it knows when to play the recall/send-out animation.
   */
  switchSeq: number
}

export interface EvolutionItemUse {
  name: string
  spritenum: number
  quantity: number
}

export interface BoxPokemonView extends PokemonSummary {
  id: string
  // At the top of the friendship scale - the only Pokemon that can be a companion.
  maxFriendship?: boolean
  // In the companion slot - it can take merges, but can't be merged into anything.
  companion?: boolean
  // Only present for the player's own persisted box/team Pokemon - premade
  // trainer team mons (also built from this type) have no exp progression
  // or evolution mechanic of their own.
  exp?: number
  expPercent?: number
  eligibleEvolutions?: string[]
  // The bag item each item evolution above would use up (by target species), and how
  // many of it the bag has - a level/friendship evolution has no entry.
  evolutionItems?: Record<string, EvolutionItemUse>
  // The evolutions above already in the Pokedex - marked with a Poke Ball in the menu.
  registeredEvolutions?: string[]
  canLevelUpWithCandy?: boolean
  // Not shiny yet, and there's a Shiny Patch in the bag to make it so.
  canUseShinyPatch?: boolean
  // How many Shiny Patches the bag holds, shown beside that menu option.
  shinyPatches?: number
  // Every Pokemon it can evolve into, ready or not, with what it takes and whether it's
  // already in the Pokedex (the edit window lists them all).
  evolutionPaths?: { species: string; method: string; ready: boolean; registered: boolean }[]
  // A Pokemon with a form-change item for it in the bag (the Rotom Catalog, Prison Bottle,
  // Reveal Glass...): the forms it can change into, and the item.
  formChanges?: { forms: string[]; itemName: string; spritenum: number; ready: boolean }
  // A plain Necrozma, Kyurem or Calyrex with its fusion item: each partner in the box it
  // can fuse with, and what they'd become.
  fusions?: {
    partnerId: string
    partnerSpecies: string
    partnerLevel: number
    // The partner is a favorite - shown with a heart so it isn't fused away by mistake.
    partnerFavorite?: boolean
    result: string
    itemName: string
  }[]
  // A fused one, with its fusion item: who unfusing hands back.
  unfuse?: { partnerSpecies: string; itemName: string }
  itemSpritenum?: number | null
  favorite?: boolean
  // Caught Gigantamax (from a Max Raid): it takes its Gigantamax form when it Dynamaxes.
  gigantamax?: boolean
  // Shown with its Gigantamax sprite (the editor's cosmetic toggle).
  gmaxLook?: boolean
  // How many copies have been merged into it (1 = none), and the stars that makes.
  copies?: number
  mergeStars?: number
  // The same species elsewhere in the box, that could be merged into this one.
  mergeCandidates?: MergeCandidateView[]
  // Its colour on the Random Pokemon roulette (see speciesRarityTier) - the box and
  // team squares are bordered with it.
  rarityTier?: RarityTier
  // What selling it pays right now (its rarity's price, with a title's bonus).
  sellPrice?: number
  // For sorting the box: its National Dex number, base stat total, and when it arrived
  // (its place in the box's arrival order - 0 the first ever).
  dexNum?: number
  bst?: number
  arrival?: number
}

export interface BoxState {
  mons: BoxPokemonView[]
  team: (string | null)[]
  // The companion beside the team (one of the box's own Pokemon - companionId), and whether
  // the companion slot has been unlocked yet (see COMPANION_ACHIEVEMENT_ID).
  companion?: BoxPokemonView | null
  companionId?: string | null
  companionUnlocked?: boolean
  // The size it's drawn at, and what was picked - 'auto' goes by its height.
  companionSize?: CompanionSize
  companionSizeChoice?: CompanionSizeChoice
}

// How big the companion is drawn, on the menu and in battle. XL looks like L on the menu,
// but in battle it's twice that - spilling past the trainer box, which cuts it off.
export type CompanionSize = 'S' | 'M' | 'L' | 'XL'
export const COMPANION_SIZES: CompanionSize[] = ['S', 'M', 'L', 'XL']
export type CompanionSizeChoice = CompanionSize | 'auto'

// Auto size by the species' real height: about a third of all Pokemon in each.
export const COMPANION_AUTO_M_HEIGHT = 0.7
export const COMPANION_AUTO_L_HEIGHT = 1.5
// Only the very biggest - Wailord, Steelix and most of the box legendaries - are XL, and so
// is any Gigantamax Pokemon showing its Gigantamax look.
export const COMPANION_AUTO_XL_HEIGHT = 3.5

export function autoCompanionSize(heightm: number, gmaxLook = false): CompanionSize {
  if (gmaxLook || heightm >= COMPANION_AUTO_XL_HEIGHT) return 'XL'
  return heightm > COMPANION_AUTO_L_HEIGHT ? 'L' : heightm >= COMPANION_AUTO_M_HEIGHT ? 'M' : 'S'
}

// The achievement - maxing out a Pokemon's friendship - that unlocks the companion slot.
export const COMPANION_ACHIEVEMENT_ID = 'bestfriend'

// A named snapshot of a team lineup, saved from the box - see loadout-store.ts.
// Loading one just calls setTeam with its ids (any that are no longer in the
// box are dropped, leaving that slot empty, rather than failing outright).
export interface LoadoutView {
  id: string
  name: string
  team: (string | null)[]
}

// ---- Players (login)

export const MAX_USERNAME_LENGTH = 20

// Names Windows won't allow as a folder name, which is what a player's save is.
const RESERVED_USERNAMES = new Set([
  'con', 'prn', 'aux', 'nul',
  ...Array.from({ length: 9 }, (_, i) => `com${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `lpt${i + 1}`)
])

/** A username as it's stored: trimmed, with runs of spaces collapsed to one. */
export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

/** Why a username can't be used, or null if it's fine. Names are not case-sensitive. */
export function usernameProblem(raw: string): string | null {
  const name = normalizeUsername(raw)
  if (!name) return 'Enter a username'
  if (name.length > MAX_USERNAME_LENGTH) return `Usernames can be at most ${MAX_USERNAME_LENGTH} characters`
  if (!/^[A-Za-z0-9 _-]+$/.test(name)) return 'Use only letters, numbers, spaces, _ and -'
  if (RESERVED_USERNAMES.has(name.toLowerCase())) return 'That name is reserved - pick another'
  return null
}

export interface SessionInfo {
  // The logged-in player, or null on the login screen.
  username: string | null
  // The last name used on this machine, to pre-fill the login box.
  lastUsername: string | null
  // Every player with a save on this machine.
  players: string[]
  // The logged-in player's chosen trainer sprite, or null if they haven't picked one.
  trainerSprite: string | null
  // Whether this save is an admin: it can use the Debug menu and Admin Edit.
  isAdmin: boolean
  // Whether the login screen's "remember me" starts ticked: yes while developing,
  // no in the packaged game, which may be passed around between people.
  rememberByDefault: boolean
}

export type AiDifficulty = 'easy' | 'normal' | 'hard'

export type TeamMode = 'random' | 'monotype' | 'custom'

export interface ItemDropConfig {
  itemId: string | null
  chance: number
}

// One item a battle might drop, and where the chance comes from: the trainer's own
// drops, the drop set on the team they chose, or the wild species' drop.
export interface RewardItemView {
  itemId: string
  itemName: string
  spritenum: number
  chance: number
  source: 'trainer' | 'team' | 'wild'
}

export interface BattleRewardsView {
  // Prize money for a trainer or boss win (none for a wild Pokemon).
  money: number | null
  items: RewardItemView[]
  // Percent chance of one extra item picked at random from the whole drop pool.
  randomDropChance: number
  // The trainer's TMs the player doesn't own yet - all of them given on a win.
  tms?: TmInfo[]
}

// Items that do nothing in this game, only worth selling: Bottle Caps (there's no Hyper
// Training), Rare Bone and Pretty Feather. The bag's Quick sell always picks them up.
export const SELL_ONLY_ITEM_IDS = new Set(['bottlecap', 'goldbottlecap', 'rarebone', 'prettyfeather'])

// The berries worth holding, which the bag's Quick sell leaves alone (they can still be
// sold by hand): Sitrus and Lum, and the competitive pinch berries.
export const QUICK_SELL_KEPT_BERRY_IDS = new Set([
  'sitrusberry',
  'lumberry',
  'liechiberry',
  'ganlonberry',
  'salacberry',
  'petayaberry',
  'apicotberry',
  'lansatberry',
  'starfberry',
  'micleberry',
  'custapberry',
  'keeberry',
  'marangaberry',
  'jabocaberry',
  'rowapberry'
])

// A trainer can hand out up to this many different items after a win; each is
// rolled on its own chance.
export const MAX_TRAINER_DROPS = 3

// Debug-configured drop for one wild species - only ever applied to wild
// encounters of exactly that species, never to trainer battles.
export interface WildDropEntry {
  species: string
  drop: ItemDropConfig
}

export type RogueliteBossClass = 'gymLeader' | 'eliteFour' | 'champion' | 'villainGrunt' | 'villainElite'

// The villains are no boss floor's: they're met in a Villain Takeover (see run-store), so
// a generation never needs any to be picked for a run.
export const ROGUELITE_BOSS_CLASSES: { id: RogueliteBossClass; label: string; villain?: boolean }[] = [
  { id: 'gymLeader', label: 'Gym Leader' },
  { id: 'eliteFour', label: 'Elite Four' },
  { id: 'champion', label: 'Champion' },
  { id: 'villainGrunt', label: 'Villain Grunt', villain: true },
  { id: 'villainElite', label: 'Villain Elite', villain: true }
]

/** The class of a run's n-th boss (0 = the first): Gym Leaders, the Elite Four, then the Champion. */
export function rogueliteBossClassAt(bossIndex: number, difficulty?: RunDifficulty): RogueliteBossClass {
  const { gymLeaders, eliteFour } = runDifficultyInfo(difficulty)
  if (bossIndex < gymLeaders) return 'gymLeader'
  if (bossIndex < gymLeaders + eliteFour) return 'eliteFour'
  return 'champion'
}

/** "Gym Leader 3/8", "Elite Four 2/4", "Champion" - the n-th boss (0 = the first). */
export function rogueliteBossLabelAt(bossIndex: number, difficulty?: RunDifficulty): string {
  const { gymLeaders, eliteFour } = runDifficultyInfo(difficulty)
  const bossClass = rogueliteBossClassAt(bossIndex, difficulty)
  if (bossClass === 'gymLeader') return `Gym Leader ${bossIndex + 1}/${gymLeaders}`
  if (bossClass === 'eliteFour') return `Elite Four ${bossIndex - gymLeaders + 1}/${eliteFour}`
  return 'Champion'
}

/** How many bosses a run on this difficulty has, the Champion last. */
export function runBossCount(difficulty?: RunDifficulty): number {
  const { gymLeaders, eliteFour } = runDifficultyInfo(difficulty)
  return gymLeaders + eliteFour + 1
}

/** A run's last floor on this difficulty - the Champion's. */
export function runFinalFloor(difficulty?: RunDifficulty): number {
  return ROGUELITE_BOSS_EVERY * runBossCount(difficulty)
}

export interface Trainer {
  id: string
  name: string
  spriteId: string
  difficulty: AiDifficulty
  teamMode: TeamMode
  monotype: string | null
  isBoss: boolean
  drops: ItemDropConfig[]
  // TMs (move ids) beating this trainer gives - each one only while the player doesn't
  // own it yet, so in practice on the first win (see tm-store's grantRewardTms).
  tmRewards?: string[]
  // A Team Rocket member: the only trainers the Trainer Battle button fights while a
  // Team Rocket event boss is queued (see rocketEvent).
  teamRocket?: boolean
  // Always available in a random fight: its cap-relative teams (level = the cap
  // minus something) can be fielded at any level cap. Normally a cap-relative team
  // waits until every member is within the stat ceiling for the cap, which keeps a
  // late-game team from showing up at level 15.
  alwaysAvailable?: boolean
  // One of the Roguelite mode's bosses: picked at random for a run's boss floors, and
  // never fought in the normal game (neither as a boss nor as a random trainer).
  rogueliteBoss?: boolean
  // What kind of boss a Roguelite boss is: a run meets 8 Gym Leaders, the Elite Four,
  // then the Champion.
  rogueliteClass?: RogueliteBossClass
  // A Roguelite boss's reward: beating it offers this ability (id) to one of the run's
  // Pokemon, instead of the usual item pick.
  rogueliteRewardAbility?: string
  // The generation a Roguelite boss is from (1-9) - a run set to a generation only
  // meets that generation's bosses.
  rogueliteGeneration?: number
  // Bosses only: while this boss is the next one queued, the Trainer Battle button
  // only fights Team Rocket members, and shows a grunt. On for Giovanni's fights.
  rocketEvent?: boolean
  // Bosses only (classic and Roguelite): weather and terrain up from the start of the
  // fight, lasting until a move or ability replaces them. Off (none) by default.
  fieldWeather?: string | null
  fieldTerrain?: string | null
  // Bosses only: Trick Room up from the start, until someone uses Trick Room to end it.
  fieldTrickRoom?: boolean
  // Set on trainers created by an importer (e.g. "rr41:0x19e"), so importing
  // again can tell what it already made instead of adding duplicates.
  importKey?: string
}

export interface RadicalRedImportResult {
  trainersAdded: number
  trainersSkipped: number
  teamsAdded: number
}

export interface PremadeTeamSummary {
  id: string
  trainerId: string
  name: string
  mons: BoxPokemonView[]
  drop: ItemDropConfig
  isDoubleBattle: boolean
  // The level cap this team first becomes eligible at: its highest fixed
  // level (a team can't be fought while that's above the cap) - shown as a
  // badge so it's obvious why a team isn't being picked yet. 1 when every
  // member's level follows the cap.
  requiredLevelCap: number
}

export interface BossStep {
  id: string
  trainerId: string
  requiredTrainerWins: number
  levelCapAfterWin: number
  // Beating this boss puts the late-game items (Exp. Candies and evolution
  // items) in the shop - hidden from it until then. Drops aren't affected.
  unlocksLateItems?: boolean
}

export interface ProgressionState {
  levelCap: number
  bossOrder: BossStep[]
  bossesDefeated: string[]
  trainerWinsSinceLastBoss: number
}

export interface NextBossInfo {
  trainerId: string
  trainerName: string
  spriteId: string
  requiredTrainerWins: number
  trainerWinsSinceLastBoss: number
  ready: boolean
}

// One boss in the rematch menu (Boss Battle once every boss is beaten), in boss order.
export interface BossRematchInfo {
  // Its place in the boss order, from 1 - the same number the trainer list shows.
  number: number
  trainerId: string
  trainerName: string
  spriteId: string
  // Only a boss already beaten can be rematched.
  defeated: boolean
}

export interface BattleEligibility {
  // True while a Team Rocket event boss is queued: the Trainer Battle button is
  // Team Rocket only.
  rocketEvent: boolean
  hasTrainer: boolean
  hasBoss: boolean
  nextBoss: NextBossInfo | null
  // Every boss in the order is beaten - the Boss Battle button opens the rematch menu.
  allBossesDefeated: boolean
  // Raid Crystals in the bag - each starts one Max Raid.
  wishingPieces: number
  // Max Raids open (with the Exp. Candies and evolution items in the Shop) once the boss
  // flagged to unlock late items is beaten - named here for the locked button's hint.
  raidsUnlocked: boolean
  raidUnlockBoss: string | null
}

// ---- Max Raids ----
// One Pokemon a Max Raid can bring, for the Max Raid page's carousel: in its Gigantamax
// form when it raids as one, and only named if it's registered in the player's Pokedex.
export interface RaidBossPreview {
  species: string
  num: number
  gigantamax: boolean
  registered: boolean
  rarityTier: RarityTier
}

// A Raid Crystal starts one: a doubles battle, the player's two against one boss that's
// Dynamaxed (Gigantamax when it can) for the whole fight, at the level cap and with 3
// merge stars. Winning catches it, stars and all.
export const RAID_STARS = 3
// A raid boss's HP is this many times its own before Dynamaxing doubles it again, and it
// attacks this many times a turn.
export const RAID_HP_MULTIPLIER = 2
// A raid boss's soft cap on one hit: the first RAID_SOFT_CAP_SHARE of its max HP is taken
// in full, and only RAID_OVERFLOW_FACTOR of whatever goes past it - so a huge hit still
// hurts, but can't burst it down.
export const RAID_SOFT_CAP_SHARE = 0.25
export const RAID_OVERFLOW_FACTOR = 0.5

/** One hit's damage to a raid boss with this max HP, after the soft cap. */
export function raidSoftCappedDamage(damage: number, maxHp: number): number {
  const cap = Math.floor(maxHp * RAID_SOFT_CAP_SHARE)
  return damage <= cap ? damage : cap + Math.floor((damage - cap) * RAID_OVERFLOW_FACTOR)
}
export const RAID_ATTACKS_PER_TURN = 2
// What a raid's boss is: a Gigantamax Pokemon this often, otherwise a red Pokemon, or a
// gold one (restricted legendary) this often.
export const RAID_GIGANTAMAX_CHANCE = 0.5
export const RAID_RESTRICTED_CHANCE = 0.15

export interface RaidView {
  gigantamax: boolean
  stars: number
  // Won: the boss joined the box.
  caught: { species: string; shiny: boolean } | null
}

export const POKEMON_TYPES: string[] = [
  'Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Poison', 'Ground',
  'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy'
]

export interface EditablePokemonSet {
  name: string
  species: string
  item: string
  ability: string
  moves: string[]
  nature: string
  gender: string
  evs: StatBlock
  ivs: StatBlock
  level: number
  shiny: boolean
  happiness: number
  teraType: string
  // Premade team Pokemon only: when set, its level follows the player's level cap -
  // always this many levels under it - and `level` is just what that works out to
  // right now. Null (or absent) means `level` is fixed.
  capOffset?: number | null
  // Cosmetic only: shown with its Gigantamax sprite everywhere (same size, no glow) -
  // only offered when its species has a Gigantamax form (canGmax, read-only).
  gmaxLook?: boolean
  canGmax?: boolean
}

// Options → Check for updates (see src/main/updater.ts).
export interface UpdateCheckResult {
  current: string
  // The newest release's version, or null when the repo has no releases yet.
  latest: string | null
  available: boolean
  notes: string
  sizeBytes: number
  // False in the dev copy, which updates with git rather than replacing itself.
  canInstall: boolean
}

export interface UpdateProgress {
  phase: 'downloading' | 'unpacking' | 'restarting'
  received: number
  total: number
}

// One set the Pokemon editor's Auto-fill can apply (see auto-sets.ts).
export interface AutoSetOption {
  id: string
  // E.g. "Sun Sweeper · Gen 9 OU".
  label: string
}

// A set fitted to the game's rules, for the editor to fill in. A null ability or
// item means leave the current one; `notes` says what had to change to fit.
export interface AutoSetResult {
  moves: string[]
  ability: string | null
  item: string | null
  nature: string
  evs: StatBlock
  ivs: StatBlock
  teraType: string | null
  notes: string[]
}

export interface EditorOptionEntry {
  id: string
  name: string
}

export interface DescribedOptionEntry extends EditorOptionEntry {
  description: string
}

export interface SpeciesOptionEntry {
  name: string
  types: string[]
  abilities: string[]
  baseStats: StatBlock
}

export interface NatureOptionEntry {
  name: string
  plus: string | null
  minus: string | null
}

export interface ItemOptionEntry extends DescribedOptionEntry {
  spritenum: number
}

export interface ShopItemEntry extends ItemOptionEntry {
  price: number
  // Each one's price when buying in bulk (the Tycoon title - see shopTotal), if lower.
  bulkPrice?: number
  category: string
}

/** A key item, for the Key Items tab: never sold - whether the player has it, and the achievement that unlocks it. */
export interface KeyItemView extends ItemOptionEntry {
  owned: boolean
  unlockedBy: string
  // Bought in the Coin Shop (the Scanner) rather than unlocked by an achievement.
  coinShop: boolean
}

/** What buying this many of a Shop item costs - at its bulk price from TYCOON_BULK_MIN on. */
export function shopTotal(item: { price: number; bulkPrice?: number }, count: number, bulkMin = 5): number {
  return (count >= bulkMin && item.bulkPrice !== undefined ? item.bulkPrice : item.price) * count
}

/** A shop item as the admin price editor sees it: its current price and the default. */
export interface ShopPriceEntry extends ShopItemEntry {
  defaultPrice: number
}

export interface EditorOptions {
  items: ItemOptionEntry[]
  natures: NatureOptionEntry[]
  types: string[]
  species: SpeciesOptionEntry[]
}

export interface SpeciesEditInfo {
  abilities: DescribedOptionEntry[]
  moves: MoveInfo[]
  genders: string[]
}

// A weather, terrain, room-style field effect or timed side condition
// currently in play. `kind` decides how it's drawn: weather and terrain get a
// full-scene overlay, everything gets a line in the turns-left badge.
export interface FieldEffectView {
  id: string
  name: string
  // 'hazard' is a permanent entry-hazard on one side (Stealth Rock, Spikes,
  // ...) - drawn on the ground rather than listed in the turns-left badge.
  kind: 'weather' | 'terrain' | 'field' | 'side' | 'hazard'
  // Only set for kind 'side' and 'hazard'
  side?: 'p1' | 'p2'
  // null when it doesn't expire on its own (Desolate Land, Delta Stream, ...)
  turnsLeft: number | null
  // Stacking hazards only (Spikes 1-3, Toxic Spikes 1-2)
  layers?: number
}

// Index 0 is slot 'a', index 1 is slot 'b' - always length 2 even in a
// singles battle, where slot 'b' just stays null the whole time.
export interface FieldSnapshot {
  p1: (ActivePokemonView | null)[]
  p2: (ActivePokemonView | null)[]
  effects: FieldEffectView[]
}

// A floating label over a sprite, like Showdown's own "Missed"/"Immune"/"Protected" -
// one of these lines up with each entry in BattleView.log, or null if that line has none.
export type BattleSlotKey = 'p1a' | 'p1b' | 'p2a' | 'p2b'

export interface FeedbackEvent {
  slot: BattleSlotKey
  label: string
  tone: 'good' | 'bad' | 'neutral'
  // The results worth seeing at a glance get a bigger label and their own effect on
  // the sprite: a crit's white flash and hard shake, a flinch's stagger, confusion's
  // spinning stars, and for a Pokemon that can't move: full paralysis's electric jolt,
  // sleep's drifting Zs, a freeze's icy shiver; and the end-of-turn hurt from a burn
  // (rising flames) or poison (bubbles).
  emphasis?: 'crit' | 'flinch' | 'confusion' | 'paralysis' | 'sleep' | 'freeze' | 'burn' | 'poison'
}

// An ability doing something (Intimidate, Drizzle, Rough Skin, Volt Absorb...) - the
// battle screen pops up a "Gyarados's Intimidate" banner by the Pokemon that has it,
// like Showdown does.
export interface AbilityEvent {
  slot: BattleSlotKey
  pokemon: string
  ability: string
  // Set when it's a held item at work (Leftovers, Focus Sash, a berry...) rather than an
  // ability - the banner then shows the item's icon. `ability` is the item's name.
  itemSpritenum?: number
}

// A move being used, for the animation layer - which slot used it, which
// slot(s) it's aimed at (more than one only for a spread move in doubles),
// and whether it missed (an animation still plays, just without impact).
// A Pokemon Terastallizing or Mega Evolving (Primal Reversion and Ultra Burst count as
// Mega) - the battle screen plays a short animation over it.
export interface GimmickEvent {
  slot: BattleSlotKey
  kind: 'tera' | 'mega'
  // The Tera type, for a tera.
  teraType?: string
}

// The moveId of the MoveEvent for Leech Seed sapping HP at the end of a turn: the
// "attacker" is the seeded Pokemon, the target the one it heals.
export const LEECH_SEED_DRAIN_EVENT = '$leechseeddrain'

export interface MoveEvent {
  moveId: string
  attackerSlot: BattleSlotKey
  targetSlots: BattleSlotKey[]
  // The targets it missed - the animation flies past these instead of hitting them.
  missedSlots: BattleSlotKey[]
}

export interface RosterSlotView {
  species: string
  fainted: boolean
  status: string | null
  // Where it is in the roster (see ActivePokemonView.rosterIndex).
  rosterIndex?: number
}

export interface TrainerBattleInfo {
  name: string
  spriteId: string
}

export interface ExpGainResult {
  species: string
  gained: number
  levelBefore: number
  levelAfter: number
  cappedOut: boolean
}

export interface ItemDropResult {
  itemId: string
  itemName: string
  spritenum: number
}

export interface BagItemView {
  id: string
  name: string
  // The group it's listed under - the same categories as the shop, plus Mega Stones
  // and Evolution Items for what the shop doesn't sell.
  category: string
  description: string
  spritenum: number
  quantity: number
  // Half the shop price, or null for anything the shop doesn't sell (mega
  // stones, evolution stones...), which therefore can't be sold back either.
  sellPrice: number | null
  // Can be opened from the bag for a random Pokemon (see OPENABLE_ITEM_IDS).
  opens: boolean
  // 'single' fossils restore on their own into `restoresTo`; 'galar' ones need a
  // second, complementary fossil (see GalarFossilPartner).
  fossil: 'single' | 'galar' | null
  restoresTo: string | null
  // An Exp. Candy: how much exp using it gives each Pokemon on the team.
  teamExp: number | null
  // Its card's colour (see bagItemRarity).
  rarityTier: RarityTier
}

// ---- Trainer profile

export interface PlayerStats {
  // Regular trainers beaten (not bosses, not friendly matches against other players).
  trainersDefeated: number
  bossesDefeated: number
  // Wild Pokemon knocked out, and how many of those were then caught (a wild
  // Pokemon is caught from the win screen, so every catch is also a knockout).
  wildDefeated: number
  wildCaught: number
  // Max Raids won (every one a catch too - not counted as wild).
  raidsWon: number
  // Roguelite: the furthest floor any run has reached (0 before the first run).
  bestFloor: number
  // The difficulty that floor was reached on (null before the first run, or for a best
  // set before difficulties were recorded).
  bestFloorDifficulty: RunDifficulty | null
}

// One notch on the profile's league progress bar.
export interface LeagueMilestone {
  label: string
  group: 'gym' | 'eliteFour' | 'champion'
  spriteId: string
  // Null when that trainer isn't in the trainer list (so it can never be beaten).
  defeated: boolean | null
}

// One National Dex number in the trainer profile's Pokedex.
export interface PokedexEntry {
  num: number
  species: string
  // Had in the box at some point, in this exact form (see box-store's registered forms).
  registered: boolean
  // An alternate form (Alolan, Hisuian, Rotom-Wash...) listed after its species.
  form: boolean
  // Where to look for it (see pokedexLocationHints).
  hints: PokedexHint[]
  // Its rarity colour (see speciesRarityTier), for its cell.
  rarityTier: RarityTier
}

// One place a Pokemon can be found: a wild location, the Lab, Max Raids...
export interface PokedexHint {
  icon: string
  label: string
}

export interface TrainerProfile {
  stats: PlayerStats
  league: LeagueMilestone[]
}

// How rare a Pokemon looks on the case-opening reel, like a CS case: grey, blue,
// purple, pink, gold.
export type RarityTier = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'

// What the shop pays for a Pokemon, by its rarity colour: grey, blue, purple, red, gold.
export const POKEMON_SELL_PRICES: Record<RarityTier, number> = {
  common: 150,
  uncommon: 300,
  rare: 500,
  epic: 10000,
  legendary: 50000
}

// ---- Merging duplicates ----
// Merging a duplicate into a Pokemon adds its copies to it: stars go up each time the
// copies double (2 = 1 star, 4 = 2 stars ... 32 = 5 stars), and each star is +10% to all
// its stats in classic battles and friendly matches (never in a Roguelite run) - less for
// the strongest: +7.5% a star for a red Pokemon and +5% for a gold one.
export const MERGE_MAX_STARS = 5
export const MERGE_MAX_COPIES = 2 ** MERGE_MAX_STARS
export const MERGE_STAT_BONUS_PER_STAR = 0.1
export const MERGE_STAT_BONUS_BY_TIER: Partial<Record<RarityTier, number>> = { epic: 0.075, legendary: 0.05 }

/** What one star adds to all its stats, for a Pokemon of this rarity. */
export function mergeBonusPerStar(tier: RarityTier | undefined): number {
  return (tier && MERGE_STAT_BONUS_BY_TIER[tier]) ?? MERGE_STAT_BONUS_PER_STAR
}

/** "+37.5%" - its whole bonus at this many stars. */
export function mergeBonusText(stars: number, tier: RarityTier | undefined): string {
  return `+${Math.round(stars * mergeBonusPerStar(tier) * 1000) / 10}%`
}

export function mergeStarsFor(copies: number | undefined): number {
  return Math.min(MERGE_MAX_STARS, Math.floor(Math.log2(Math.max(1, copies ?? 1))))
}

/**
 * How a merge fills a Pokemon up to the top (MERGE_MAX_COPIES): the others go in smallest
 * first, each whole while it fits. The one that doesn't fit gives only what's needed and
 * keeps the rest - staying in the box with fewer copies (and maybe fewer stars) - and any
 * after that aren't touched.
 */
export interface MergePlan {
  // Merged in whole (they leave the box).
  whole: string[]
  // The one merged in part: what it gives, and what it's left with.
  partial: { id: string; given: number; left: number } | null
  // Picked but not needed - the top was reached first.
  unused: string[]
  copiesAfter: number
}

export function planMerge(keeperCopies: number, others: { id: string; copies: number }[]): MergePlan {
  let room = Math.max(0, MERGE_MAX_COPIES - keeperCopies)
  const plan: MergePlan = { whole: [], partial: null, unused: [], copiesAfter: keeperCopies }
  for (const other of [...others].sort((a, b) => a.copies - b.copies)) {
    if (room <= 0) plan.unused.push(other.id)
    else if (other.copies <= room) {
      plan.whole.push(other.id)
      room -= other.copies
      plan.copiesAfter += other.copies
    } else {
      plan.partial = { id: other.id, given: room, left: other.copies - room }
      plan.copiesAfter += room
      room = 0
    }
  }
  return plan
}

export function mergeStatMultiplier(stars: number, tier: RarityTier | undefined): number {
  return 1 + mergeBonusPerStar(tier) * stars
}

// A duplicate that could be merged into a Pokemon (see BoxPokemonView.mergeCandidates).
export interface MergeCandidateView {
  id: string
  species: string
  level: number
  shiny: boolean
  favorite: boolean
  copies: number
  onTeam: boolean
  // Its held item goes back to the bag.
  item: string
  // A pre-evolution evolves on its way in: the items that uses up (with how many of each
  // the bag has), or why it can't yet ("Needs a Whipped Dream", "Level 36") - see mergeEvolutionFor.
  evolveItems?: { itemId: string; name: string; spritenum: number | null; owned: number }[]
  notReady?: string
}

// A shiny sells for this much more, whatever its rarity (on top of any title's bonus).
export const SHINY_SELL_BONUS = 5000

// Selling one of these asks for a second click first (as does selling a shiny).
export const CONFIRM_SELL_TIERS = new Set<RarityTier>(['epic', 'legendary'])

// One card on the case-opening strip: a Pokemon (species) or an item (spritenum).
export interface ReelEntry {
  name: string
  species?: string
  spritenum?: number
  tier: RarityTier
}

export interface OpenItemResult {
  // A Random Pokemon / Random Legendary gives a Pokemon, a Lock Capsule an item.
  kind: 'pokemon' | 'item'
  // The Pokemon's species, or the item's name.
  name: string
  // Pokemon only (0 for an item).
  level: number
  shiny: boolean
  tier: RarityTier
  // The case-opening animation's strip: other picks from the same pool, with the one
  // actually won at reel[winnerIndex].
  reel: ReelEntry[]
  winnerIndex: number
  // How many more of the opened item are left in the bag - for "open another".
  remaining: number
  // An item won (Lock Capsule): its id, and what the shop would pay for it (null if it
  // can't be sold) - so it can be sold straight from the result.
  itemId?: string
  sellPrice?: number | null
  // A Pokemon won: its id in the box, so it can be sold from the result (at sellPrice).
  monId?: string
  // ...or merged straight into the box Pokemon it would go into (see autoMergeMon), if any -
  // with the evolution items that would use up.
  mergeKeeper?: { species: string; stars: number; uses: string[] } | null
  // An item won: its full shop price, shown by its name.
  price?: number
  // A Pokemon not in the Pokedex yet, or an item the bag didn't have - marked "New".
  isNew: boolean
}

// Running from an ordinary trainer battle (never a boss) costs this much.
export const TRAINER_RUN_COST = 200

export interface SellResult {
  sold: number
  money: number
}

// Some number of one bag item, for selling several at once.
export interface ItemQuantity {
  itemId: string
  quantity: number
}

// One of the fossils a Galar fossil can be combined with, and what the pair
// would restore into.
export interface GalarFossilPartner {
  itemId: string
  itemName: string
  spritenum: number
  quantity: number
  species: string
}

export interface RestoreFossilResult {
  species: string
  level: number
  shiny: boolean
  money: number
}

export interface CatchResult {
  money: number
  pokeballs: number
  // The Catching Charm made it free.
  free?: boolean
}

/**
 * What one of the player's moves does right now, worked out by the battle
 * itself against the Pokemon currently out - so Reversal follows the user's HP,
 * Heavy Slam the two weights, Gyro Ball the speeds, and so on.
 */
export interface LiveMovePower {
  // The power it hits with (before item, ability, weather and type boosts); null
  // when it has none. With two different foes out this is the lowest of them.
  basePower: number | null
  // The highest of the foes' values, only when it differs from basePower.
  basePowerMax: number | null
  // Damage that doesn't use power at all (Seismic Toss, Dragon Rage, Super Fang).
  fixedDamage: number | null
  // The power depends on the situation, as opposed to being the move's printed number.
  dynamic: boolean
  // Different every time it's used (Magnitude, Present, Psywave).
  varies: boolean
  // Doubled against a Dynamaxed foe (Behemoth Blade, Behemoth Bash, Dynamax Cannon).
  dynamaxBonus?: boolean
  // Its type right now when that isn't its printed one: Judgment with a plate, Tera Blast
  // once Terastallized, Weather Ball in the rain, a Normal move under Pixilate...
  type?: string
}

export interface BattleView {
  log: string[]
  logStates: FieldSnapshot[]
  // Parallel to log - null wherever that line has no result to flash.
  feedback: (FeedbackEvent | null)[]
  // Parallel to log - null wherever that line isn't a move being used.
  moveEvents: (MoveEvent | null)[]
  // Parallel to log - set on the line where a Pokemon Terastallizes or Mega Evolves.
  gimmickEvents: (GimmickEvent | null)[]
  abilityEvents: (AbilityEvent | null)[]
  request: ChoiceRequest | null
  ended: boolean
  winner: string | null
  expGains: ExpGainResult[]
  itemDrops: ItemDropResult[]
  // Won a Classic wild battle: one quick skill check for a TM from its area (see tm-store).
  tmQuickCheck?: boolean
  // The TMs a beaten trainer gave (only ones the player didn't own yet).
  tmRewards?: TmInfo[]
  moneyGained: number
  p1: (ActivePokemonView | null)[]
  p2: (ActivePokemonView | null)[]
  team: ActivePokemonView[]
  // One entry per active slot, keyed by move id - empty while no choice is being asked for.
  movePowers: (Record<string, LiveMovePower> | null)[]
  // Same shape: each move's type effectiveness against each foe slot (index 0 = p2a,
  // 1 = p2b) - null for a foe slot that's empty, or a move it doesn't apply to
  // (status moves, fixed damage that isn't blocked by an immunity).
  moveEffectiveness: (Record<string, (number | null)[]> | null)[]
  // Parallel to team: how well each team member's own types hit each foe slot (the
  // best of them; index 0 = p2a, 1 = p2b) - null for a fainted member or an empty slot.
  teamMatchups: (number | null)[][]
  // Parallel to team too: how hard each foe slot's types hit each team member (the
  // worst of them) - the defensive side of the same matchup.
  teamDefense: (number | null)[][]
  opponentTrainer: TrainerBattleInfo | null
  // What running away costs: 0 from a wild Pokemon, TRAINER_RUN_COST from an ordinary
  // trainer, null when it isn't allowed at all (a boss, a Roguelite trainer or boss).
  runCost: number | null
  // Whether the player has the money to run (always, when it's free).
  canAffordRun: boolean
  opponentRoster: RosterSlotView[]
  // A Roguelite run's battle: catching is free and fills the run's team, and there's
  // no money or items. Set with the Pokemon that fainted - they leave the run's team.
  runBattle: boolean
  runFainted: string[]
  // Won a run's trainer or boss battle: an item reward waits on the run menu.
  runItemReward: boolean
  // A Draft mode battle, once it has ended: the draft's record after it.
  draftResult?: DraftBattleResult | null
  // Against a boss (Classic or Roguelite) - it's fought in the gym.
  bossBattle?: boolean
  // A Max Raid (see RaidView) - null for any other battle.
  raid?: RaidView | null
  // What winning this battle can pay out, for the opponent's hover tooltip - null
  // for a friendly match against another player's team, which pays nothing.
  rewards: BattleRewardsView | null
}

// ---- Roguelite mode ----

// A run's floors: every ROGUELITE_BOSS_EVERY-th one is a boss - 8 Gym Leaders, then
// the Elite Four, then the Champion on the final floor, whose defeat wins the run. Those
// are the full run's (Hard and Extreme); Easy and Normal have fewer (see runBossCount),
// ending sooner on the same climb - each boss as strong as it is at that place in a full
// run, so their Champion is met below the top level cap. The level curve is always the
// full run's (ROGUELITE_BOSS_COUNT).
export const ROGUELITE_BOSS_EVERY = 5
export const ROGUELITE_GYM_LEADERS = 8
export const ROGUELITE_ELITE_FOUR = 4
export const ROGUELITE_BOSS_COUNT = ROGUELITE_GYM_LEADERS + ROGUELITE_ELITE_FOUR + 1
export const ROGUELITE_FINAL_FLOOR = ROGUELITE_BOSS_EVERY * ROGUELITE_BOSS_COUNT
export const ROGUELITE_START_LEVEL = 5
export const ROGUELITE_MAX_TEAM = 6

export type RunNodeKind = 'wild' | 'trainer' | 'item' | 'heal' | 'boss' | 'ability' | 'move' | 'swap' | 'villain'

// Villain Takeover: now and then a villain takes a regular floor over. Every tile is
// corrupted - taking one costs up to this many gems (free with none) - except the fight
// against the villain itself, the floor's only trainer, which is free.
export const RUN_TAKEOVER_CHANCE = 0.1
export const RUN_TAKEOVER_TILE_COST = 3

// Keep or change moves: a starter's own moves against a run moveset, or an evolving
// Pokemon's moves against what it would get as its new species (locked moves kept).
export interface RunMovesPreview {
  current: MoveInfo[]
  proposed: MoveInfo[]
}

// Everything the run's own moves editor needs: what it can learn (its whole learnset),
// Smogon's sets for it, and the moves it has now.
export interface RunMonEditInfo {
  species: string
  learnable: MoveInfo[]
  autoSets: AutoSetOption[]
  moves: string[]
  lockedMoves: string[]
  // Its Tera Type, and every one it could be.
  teraType: string
  teraTypes: string[]
  // What its ability and held item do, for their tooltips ('' when unknown or none).
  abilityDescription: string
  itemDescription: string
}

// What the run's moves editor saves: moves (ids, up to 4), the ones locked, and its Tera Type.
export interface RunMonEdit {
  moves: string[]
  lockedMoves: string[]
  teraType?: string
}

// One of the four choices a New Ability / New Move floor offers.
export interface RunPickOption {
  id: string
  name: string
  description: string
  // Moves only.
  type?: string
  category?: string
  basePower?: number
}

export type RunDifficulty = 'easy' | 'normal' | 'hard' | 'extreme'

// What each boss beaten is worth once the run ends (won, lost or given up) - the same
// for every boss unless a class is named. Paid into the classic game's bag and money.
export interface RunBossReward {
  money: number
  // Exp. Candy item id (S / M / L).
  expCandy: string
  // Only for bosses of these classes (all bosses when left out).
  randomPokemon?: RogueliteBossClass[] | 'all'
  randomLegendary?: RogueliteBossClass[] | 'all'
  // Raid Crystals: for these bosses, this many each.
  raidCrystals?: { from: RogueliteBossClass[] | 'all'; count: number }
}

export interface RunDifficultyInfo {
  id: RunDifficulty
  label: string
  // What changes in the run itself.
  rules: string
  // The rewards, in words.
  rewardText: string
  reward: RunBossReward
  // Every trainer's and boss's AI is set to this (null keeps each trainer's own).
  aiOverride: AiDifficulty | null
  // The AI wild Pokemon use.
  wildAi: AiDifficulty
  // Extra Pokemon on every trainer's and boss's team (up to 6).
  extraOpponentMons: number
  // Every boss brings a full team of 6.
  fullBossTeams: boolean
  // No Pokémon Center floors and no heal after beating a boss.
  noHealing: boolean
  // How many Gym Leaders and Elite Four members come before the Champion.
  gymLeaders: number
  eliteFour: number
}

export const RUN_DIFFICULTIES: RunDifficultyInfo[] = [
  {
    id: 'easy',
    label: 'Easy',
    rules: 'A short run: 4 Gym Leaders and 2 Elite Four before the Champion. Trainers and bosses use the Normal AI, you start with a Full Restore, and trainer and boss wins pay 1 extra gem.',
    rewardText: 'Per boss: Exp. Candy S and ₽1,000. Beating the Champion: a Random Pokémon.',
    reward: { money: 1000, expCandy: 'expcandys', randomPokemon: ['champion'] },
    aiOverride: 'normal',
    wildAi: 'easy',
    extraOpponentMons: 0,
    fullBossTeams: false,
    noHealing: false,
    gymLeaders: 4,
    eliteFour: 2
  },
  {
    id: 'normal',
    label: 'Normal',
    rules: 'A shorter run: 6 Gym Leaders and 3 Elite Four before the Champion.',
    rewardText: 'Per boss: Exp. Candy M and ₽5,000. Each Elite Four member and the Champion: a Random Pokémon and a Raid Crystal.',
    reward: {
      money: 5000,
      expCandy: 'expcandym',
      randomPokemon: ['eliteFour', 'champion'],
      raidCrystals: { from: ['eliteFour', 'champion'], count: 1 }
    },
    aiOverride: null,
    wildAi: 'easy',
    extraOpponentMons: 0,
    fullBossTeams: false,
    noHealing: false,
    gymLeaders: 6,
    eliteFour: 3
  },
  {
    id: 'hard',
    label: 'Hard',
    rules: 'Trainers and bosses use the Hard AI, wild Pokémon the Normal AI, and every team has one more Pokémon.',
    rewardText: 'Per boss: a Random Pokémon, a Raid Crystal, Exp. Candy M and ₽10,000. Beating the Champion: a Random Legendary.',
    reward: {
      money: 10000,
      expCandy: 'expcandym',
      randomPokemon: 'all',
      randomLegendary: ['champion'],
      raidCrystals: { from: 'all', count: 1 }
    },
    aiOverride: 'hard',
    wildAi: 'normal',
    extraOpponentMons: 1,
    fullBossTeams: false,
    noHealing: false,
    gymLeaders: ROGUELITE_GYM_LEADERS,
    eliteFour: ROGUELITE_ELITE_FOUR
  },
  {
    id: 'extreme',
    label: 'Extreme',
    rules: 'Everything in Hard, but wild Pokémon use the Hard AI too, every boss brings 6 Pokémon, and there is no healing at all.',
    rewardText: 'Per boss: a Random Legendary, 2 Raid Crystals, Exp. Candy L and ₽20,000.',
    reward: { money: 20000, expCandy: 'expcandyl', randomLegendary: 'all', raidCrystals: { from: 'all', count: 2 } },
    aiOverride: 'hard',
    wildAi: 'hard',
    extraOpponentMons: 1,
    fullBossTeams: true,
    noHealing: true,
    gymLeaders: ROGUELITE_GYM_LEADERS,
    eliteFour: ROGUELITE_ELITE_FOUR
  }
]

export function runDifficultyInfo(id: RunDifficulty | undefined): RunDifficultyInfo {
  return RUN_DIFFICULTIES.find((d) => d.id === id) ?? RUN_DIFFICULTIES[1]
}

// The generations a boss can be from.
export const POKEMON_GENERATIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9]

// One reward line paid out when a run ends.
export interface RunRewardLine {
  itemId: string | null
  label: string
  spritenum: number | null
  quantity: number
}

// One of a floor's options. A wild one says where (Cave, Ocean... or the
// Lab); an older run's wild option may not, and draws from everywhere.
export interface RunChoice {
  kind: RunNodeKind
  location?: WildLocationId
}

// A Pokemon on the run's team: a copy, never the one in the box.
export interface RunMonView extends BoxPokemonView {
  // Carried between battles (heal nodes and beaten bosses top it back up).
  hpPercent: number
  status: string | null
  // Its moves by name, and which were taught on a New Move floor - those stay put
  // when its moves update.
  moveList: { id: string; name: string; locked: boolean }[]
  // Its ability came from a New Ability floor (and stays through evolution).
  abilityLocked: boolean
  // What resetting that pick would give it back (null with no pick to reset).
  abilityResetTo: string | null
  // The abilities an Ability Capsule can give it: its species' normal and hidden ones.
  abilityChoices: { id: string; name: string; description: string }[]
}

export interface RunItemOffer {
  itemId: string
  itemName: string
  spritenum: number
  // What it does, for its tooltip.
  description: string
}

export interface RunView {
  // 'active' while the run goes on; a finished run stays around (as 'lost' or 'won')
  // only so the menu can say how it went, until the next one starts.
  status: 'active' | 'lost' | 'won'
  floor: number
  bossesBeaten: number
  // The most any run Pokemon can level to - it only goes up by beating a boss.
  levelCap: number
  // The level this floor's opponents are fielded at (bosses a little above).
  opponentLevel: number
  // Who the next boss is, by class: "Gym Leader 3/8", "Elite Four 1/4", "Champion".
  nextBossLabel: string
  team: RunMonView[]
  // What this floor offers - a boss floor offers only the boss.
  choices: RunChoice[]
  // Set after picking an item node: choose one of these to give to a team member.
  itemOffer: RunItemOffer[] | null
  // An item floor, or the reward for beating a trainer or boss.
  itemOfferReason: 'floor' | 'reward' | 'bonus' | 'shop' | null
  // An item floor's offer that hasn't been rerolled yet (once per floor).
  canRerollItems: boolean
  // A New Ability / New Move floor: the four choices, until one is given to someone.
  pickOffer: { kind: 'ability' | 'move'; options: RunPickOption[] } | null
  // A floor's pick, or the reward for beating a boss.
  pickReason: 'floor' | 'reward' | 'bonus' | 'shop' | null
  // A Random Swap floor waiting on its choice: one Pokemon, the whole team, or neither.
  swapOffer: boolean
  // The level a swapped-in Pokemon arrives at (the next boss's).
  swapLevel: number
  // An item a newly given one replaced, waiting for a new holder before the run goes on.
  displacedItem: { itemName: string; spritenum: number; fromMonId: string } | null
  // A Villain Takeover on this floor: who took it over, and what taking any other tile costs now.
  takeover: { villainName: string; spriteId: string; classLabel: string; tileCost: number } | null
  // A beaten villain's reward: one of these three Pokemon (each holding an item) joins the team.
  monOffer: RunMonView[] | null
  // The species the run started with, for the result banner.
  starterSpecies: string
  difficulty: RunDifficulty
  // Only bosses from this generation (null = any).
  generation: number | null
  // What the run paid out when it ended (empty while it's still going).
  rewards: RunRewardLine[]
  // Gems, consumables, fainted Pokemon to revive and the boss floor's shop.
  consumables: RunConsumablesView
}

export type RunChoiceResult = { run: RunView } | { battle: BattleView; location?: WildLocationId }

// ---- Roguelite consumables and gems ----
// Items used from the run screen (never in battle), bought with gems - the run's own
// currency - in the shop on every boss floor.
export type RunConsumableId = 'fullrestore' | 'revive' | 'abilitycapsule'

export interface RunConsumableInfo {
  id: RunConsumableId
  name: string
  description: string
  // Under the renderer's public folder.
  icon: string
}

export const RUN_CONSUMABLES: RunConsumableInfo[] = [
  {
    id: 'fullrestore',
    name: 'Full Restore',
    description: 'Fully heals one Pokémon: all its HP back and no status.',
    icon: './icons/run-fullrestore.png'
  },
  {
    id: 'revive',
    name: 'Revive',
    description: "Brings back a Pokémon that fainted this run, at half HP and this floor's opponent level.",
    icon: './icons/run-revive.png'
  },
  {
    id: 'abilitycapsule',
    name: 'Ability Capsule',
    description: "Changes a Pokémon's ability to one of its species' normal or hidden abilities.",
    icon: './icons/run-abilitycapsule.png'
  }
]

export const RUN_GEM_ICON = './icons/run-gem.png'
// Gems for beating a trainer and a boss.
export const RUN_GEMS_PER_TRAINER = 1
export const RUN_GEMS_PER_BOSS = 2
// What each consumable costs in a boss floor's shop, in gems.
export const RUN_CONSUMABLE_PRICES: Record<RunConsumableId, number> = { fullrestore: 3, revive: 5, abilitycapsule: 1 }
// A boss floor's shop's Rare Candy: used on the spot on a team member - one level up,
// past the run's level cap if need be (up to 100). Never kept.
export const RUN_RARE_CANDY_PRICE = 1
export const RUN_RARE_CANDY_ICON = './sprites/misc/rarecandy.png'
// A boss floor's shop also sells one of each of these picks (Random Swap is free).
export type RunShopTile = 'ability' | 'move' | 'item' | 'swap'
export const RUN_SHOP_TILE_PRICES: Record<RunShopTile, number> = { ability: 1, move: 1, item: 1, swap: 0 }
// The consumables a difficulty doesn't allow: Extreme has no healing of any kind.
export function runLockedConsumables(difficulty: RunDifficulty): RunConsumableId[] {
  return runDifficultyInfo(difficulty).noHealing ? ['fullrestore', 'revive'] : []
}

export interface RunConsumablesView {
  gems: number
  counts: Record<RunConsumableId, number>
  // Greyed out on this difficulty (see runLockedConsumables).
  locked: RunConsumableId[]
  // Team members that fainted this run, newest first - a Revive brings one back.
  fainted: RunMonView[]
  // The level a revived Pokemon comes back at (this floor's opponents').
  reviveLevel: number
  // On a boss floor: the shop, and the picks already bought from it this floor.
  bossShop: { usedTiles: RunShopTile[] } | null
}

export function toSpriteId(species: string): string {
  return species.toLowerCase().replace(/[^a-z0-9]/g, '')
}
