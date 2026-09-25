import type { ChoiceRequest } from 'pokemon-showdown/dist/sim/side.js'

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

// Bag-only items: they exist to be spent, not held in battle, so the held-item
// picker leaves them out.
export const NON_HELD_ITEM_IDS = new Set([
  LINK_CABLE_ITEM_ID,
  RARE_CANDY_ITEM_ID,
  BLACK_AUGURITE_ITEM_ID,
  PEAT_BLOCK_ITEM_ID,
  SHINY_PATCH_ITEM_ID,
  ...OPENABLE_ITEM_IDS,
  ...Object.keys(EXP_CANDY_EXP)
])

// Friendship runs 0-255. Pokemon join the box at 0, gain FRIENDSHIP_PER_BATTLE
// after each battle won, and every friendship-style evolution needs it maxed.
export const MAX_HAPPINESS = 255
export const FRIENDSHIP_PER_BATTLE = 50

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
  // (the Professor's Lab - see generateLabWildMon) instead of the type filters.
  requiresAllBosses?: boolean
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
    label: "Professor's Lab",
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
  shiny: boolean
}

export interface VolatileBadge {
  // The effect's id ("taunt", "perish") - one badge per id.
  id: string
  label: string
  // Colours it: good for its side (Aqua Ring), bad (Taunted) or neither (Uproar).
  kind: 'good' | 'bad' | 'neutral'
}

export interface ActivePokemonView extends PokemonSummary {
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
   * Increments only when this side's active slot is switched to a new team
   * member (not on in-place form changes like Mega Evolution) - lets the UI
   * tell "a switch happened" apart from "the same Pokemon just changed form
   * or took damage", so it knows when to play the recall/send-out animation.
   */
  switchSeq: number
}

export interface BoxPokemonView extends PokemonSummary {
  id: string
  // Only present for the player's own persisted box/team Pokemon - premade
  // trainer team mons (also built from this type) have no exp progression
  // or evolution mechanic of their own.
  exp?: number
  expPercent?: number
  eligibleEvolutions?: string[]
  canLevelUpWithCandy?: boolean
  // Not shiny yet, and there's a Shiny Patch in the bag to make it so.
  canUseShinyPatch?: boolean
  itemSpritenum?: number | null
  favorite?: boolean
}

export interface BoxState {
  mons: BoxPokemonView[]
  team: (string | null)[]
}

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
}

// A trainer can hand out up to this many different items after a win; each is
// rolled on its own chance.
export const MAX_TRAINER_DROPS = 3

// Debug-configured drop for one wild species - only ever applied to wild
// encounters of exactly that species, never to trainer battles.
export interface WildDropEntry {
  species: string
  drop: ItemDropConfig
}

export type RogueliteBossClass = 'gymLeader' | 'eliteFour' | 'champion'

export const ROGUELITE_BOSS_CLASSES: { id: RogueliteBossClass; label: string }[] = [
  { id: 'gymLeader', label: 'Gym Leader' },
  { id: 'eliteFour', label: 'Elite Four' },
  { id: 'champion', label: 'Champion' }
]

/** The class of a run's n-th boss (0 = the first): Gym Leaders, the Elite Four, then the Champion. */
export function rogueliteBossClassAt(bossIndex: number): RogueliteBossClass {
  if (bossIndex < ROGUELITE_GYM_LEADERS) return 'gymLeader'
  if (bossIndex < ROGUELITE_GYM_LEADERS + ROGUELITE_ELITE_FOUR) return 'eliteFour'
  return 'champion'
}

/** "Gym Leader 3/8", "Elite Four 2/4", "Champion" - the n-th boss (0 = the first). */
export function rogueliteBossLabelAt(bossIndex: number): string {
  const bossClass = rogueliteBossClassAt(bossIndex)
  if (bossClass === 'gymLeader') return `Gym Leader ${bossIndex + 1}/${ROGUELITE_GYM_LEADERS}`
  if (bossClass === 'eliteFour') return `Elite Four ${bossIndex - ROGUELITE_GYM_LEADERS + 1}/${ROGUELITE_ELITE_FOUR}`
  return 'Champion'
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
  // The generation a Roguelite boss is from (1-9) - a run set to a generation only
  // meets that generation's bosses.
  rogueliteGeneration?: number
  // Bosses only: while this boss is the next one queued, the Trainer Battle button
  // only fights Team Rocket members, and shows a grunt. On for Giovanni's fights.
  rocketEvent?: boolean
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
  category: string
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
  // Roguelite: the furthest floor any run has reached (0 before the first run).
  bestFloor: number
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
  // Had in the box at some point (see box-store's registered species).
  registered: boolean
}

export interface TrainerProfile {
  stats: PlayerStats
  league: LeagueMilestone[]
}

// How rare a Pokemon looks on the case-opening reel, like a CS case: grey, blue,
// purple, pink, gold.
export type RarityTier = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'

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
}

export interface SellResult {
  sold: number
  money: number
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
  request: ChoiceRequest | null
  ended: boolean
  winner: string | null
  expGains: ExpGainResult[]
  itemDrops: ItemDropResult[]
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
  opponentRoster: RosterSlotView[]
  // A Roguelite run's battle: catching is free and fills the run's team, and there's
  // no money or items. Set with the Pokemon that fainted - they leave the run's team.
  runBattle: boolean
  runFainted: string[]
  // Won a run's trainer or boss battle: an item reward waits on the run menu.
  runItemReward: boolean
  // What winning this battle can pay out, for the opponent's hover tooltip - null
  // for a friendly match against another player's team, which pays nothing.
  rewards: BattleRewardsView | null
}

// ---- Roguelite mode ----

// A run's floors: every ROGUELITE_BOSS_EVERY-th one is a boss - 8 Gym Leaders, then
// the Elite Four, then the Champion on the final floor, whose defeat wins the run.
export const ROGUELITE_BOSS_EVERY = 5
export const ROGUELITE_GYM_LEADERS = 8
export const ROGUELITE_ELITE_FOUR = 4
export const ROGUELITE_BOSS_COUNT = ROGUELITE_GYM_LEADERS + ROGUELITE_ELITE_FOUR + 1
export const ROGUELITE_FINAL_FLOOR = ROGUELITE_BOSS_EVERY * ROGUELITE_BOSS_COUNT
export const ROGUELITE_START_LEVEL = 5
export const ROGUELITE_MAX_TEAM = 6

export type RunNodeKind = 'wild' | 'trainer' | 'item' | 'heal' | 'boss'

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
}

export interface RunDifficultyInfo {
  id: RunDifficulty
  label: string
  // What changes in the run itself.
  rules: string
  // The rewards, in words.
  rewardText: string
  reward: RunBossReward
  // Every opponent's AI is set to this (null keeps each trainer's own).
  aiOverride: AiDifficulty | null
  // Extra Pokemon on every trainer's and boss's team (up to 6).
  extraOpponentMons: number
  // Every boss brings a full team of 6.
  fullBossTeams: boolean
  // No Rest floors and no heal after beating a boss.
  noHealing: boolean
}

export const RUN_DIFFICULTIES: RunDifficultyInfo[] = [
  {
    id: 'easy',
    label: 'Easy',
    rules: 'Every opponent uses the Normal AI.',
    rewardText: 'Per boss: Exp. Candy S and ₽1,000. Beating the Champion: a Random Pokémon.',
    reward: { money: 1000, expCandy: 'expcandys', randomPokemon: ['champion'] },
    aiOverride: 'normal',
    extraOpponentMons: 0,
    fullBossTeams: false,
    noHealing: false
  },
  {
    id: 'normal',
    label: 'Normal',
    rules: 'No changes.',
    rewardText: 'Per boss: Exp. Candy M and ₽5,000. Each Elite Four member and the Champion: a Random Pokémon.',
    reward: { money: 5000, expCandy: 'expcandym', randomPokemon: ['eliteFour', 'champion'] },
    aiOverride: null,
    extraOpponentMons: 0,
    fullBossTeams: false,
    noHealing: false
  },
  {
    id: 'hard',
    label: 'Hard',
    rules: 'Every opponent uses the Hard AI, and every team has one more Pokémon.',
    rewardText: 'Per boss: a Random Pokémon, Exp. Candy M and ₽10,000. Beating the Champion: a Random Legendary.',
    reward: { money: 10000, expCandy: 'expcandym', randomPokemon: 'all', randomLegendary: ['champion'] },
    aiOverride: 'hard',
    extraOpponentMons: 1,
    fullBossTeams: false,
    noHealing: false
  },
  {
    id: 'extreme',
    label: 'Extreme',
    rules: 'Everything in Hard, every boss brings 6 Pokémon, and there is no healing at all.',
    rewardText: 'Per boss: a Random Legendary, Exp. Candy L and ₽20,000.',
    reward: { money: 20000, expCandy: 'expcandyl', randomLegendary: 'all' },
    aiOverride: 'hard',
    extraOpponentMons: 1,
    fullBossTeams: true,
    noHealing: true
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

// One of a floor's options. A wild one says where (Cave, Ocean... or the Professor's
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
  itemOfferReason: 'floor' | 'reward' | null
  // An item floor's offer that hasn't been rerolled yet (once per floor).
  canRerollItems: boolean
  // An item a newly given one replaced, waiting for a new holder before the run goes on.
  displacedItem: { itemName: string; spritenum: number; fromMonId: string } | null
  // The species the run started with, for the result banner.
  starterSpecies: string
  difficulty: RunDifficulty
  // Only bosses from this generation (null = any).
  generation: number | null
  // What the run paid out when it ended (empty while it's still going).
  rewards: RunRewardLine[]
}

export type RunChoiceResult = { run: RunView } | { battle: BattleView; location?: WildLocationId }

export function toSpriteId(species: string): string {
  return species.toLowerCase().replace(/[^a-z0-9]/g, '')
}
