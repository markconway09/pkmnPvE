// Draft mode: six Pokemon picked one at a time from packs of four (each with a Smogon
// set and its item, all at the same level), then a gauntlet of battles - singles bringing
// three of the six, or doubles bringing four, after seeing the opponent's whole team. Each
// format drafts from its own Smogon sets (Gen 9 Ubers to ZU, or Doubles OU). It ends at DRAFT_MAX_WINS
// wins or DRAFT_MAX_LOSSES losses, and pays Game Corner coins by the wins. Shared by the
// main process (see draft-store.ts, which decides everything) and the renderer.

import type { PokemonSummary, RarityTier, StatBlock } from './battle-types'

export const DRAFT_ROUNDS = 6
export const DRAFT_PACK_SIZE = 4
// Chaos: a just-for-fun singles draft (see CHAOS_* below) - started from its own button,
// so it isn't in DRAFT_FORMATS.
export type DraftFormat = 'singles' | 'doubles' | 'chaos'
export const DRAFT_FORMATS: { id: DraftFormat; label: string }[] = [
  { id: 'singles', label: 'Singles' },
  { id: 'doubles', label: 'Doubles' }
]

// How many of the six go into each battle: three in singles (the first leads), four in
// doubles (the first two lead). Chaos brings its whole team, however many that is so far.
export function draftBring(format: DraftFormat, teamSize = DRAFT_ROUNDS): number {
  return format === 'chaos' ? teamSize : format === 'singles' ? 3 : 4
}

// How many of those brought start out on the field.
export function draftLeads(format: DraftFormat): number {
  return format === 'doubles' ? 2 : 1
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
  // Chaos: its stat modifiers in words ("Attack x2", "Glass Cannon") - the summary's
  // stats already include them.
  chaosTags?: string[]
  // Chaos: how many Pokemon modifiers it has taken (see CHAOS_MON_MODIFIER_CAP).
  chaosModifiers?: number
}

export interface DraftOpponentView {
  name: string
  spriteId: string
  team: DraftMonView[]
  // Chaos: the battle-start modifiers they bring (their stat boosts are on their team).
  chaosField?: ChaosField
}

export interface DraftView {
  // Chaos adds 'modifier': picking one of the offered modifiers.
  status: 'drafting' | 'modifier' | 'battling' | 'finished'
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
  // Chaos: the picks this drafting stretch ends at (2, 4 or 6), and whether this step's one
  // reroll (of the pack, or of the modifier offer) is still there to use.
  pickTarget?: number
  canReroll?: boolean
  // Chaos: whether this modifier step's one free item swap is still there to use.
  canSwapItem?: boolean
  // Chaos: the field modifiers taken so far, and the modifiers on offer right now.
  chaosField?: ChaosField
  modifierOffer?: ChaosModifier[]
}

// A draft battle's end, for the result window.
export interface DraftBattleResult {
  wins: number
  losses: number
  over: boolean
  reward: number
  // The first Draft win of the day: it gave a Shiny Patch.
  shinyPatch?: boolean
}

// ---- Chaos mode ----
// A singles draft just for fun (same tiers, same 7-win / 3-loss gauntlet): draft two, take
// a modifier, then a hard trainer with as many Pokemon as you. There's a modifier after
// every battle, and after the 1st, 3rd, 5th... two more picks come before it, until the
// team is full. Every step happens whether the battle was won or lost.
// Each modifier step offers a random few (see CHAOS_OFFER_SIZE), some Pokemon ones pinned
// to one Pokemon, and each Pokemon takes at most CHAOS_MON_MODIFIER_CAP of them - so the
// whole team gets stronger rather than one unbeatable Pokemon. Each drafting stretch and
// each modifier step can reroll once, and each modifier step has one free item swap (any
// held item on any one Pokemon - not a modifier, so it doesn't count toward the cap).
// Opponents bring modifiers too: half the battle number (rounded down) of them - battle-
// start ones on their side, or +50% to one of their Pokemon's best stat.

export const CHAOS_PICKS_PER_STAGE = 2
// A stat boost multiplies the stat by this (boosts on the same stat stack).
export const CHAOS_STAT_BOOST = 1.5
// How many modifiers each step offers: at least one battle-start and one Pokemon one while
// there are any left to give, never two of the same kind.
export const CHAOS_OFFER_SIZE = 5
// The chance an offered Pokemon modifier comes pinned to one Pokemon (picked at random).
export const CHAOS_PINNED_CHANCE = 0.5
// The most Pokemon modifiers one Pokemon can take (a Wild Card's replacement keeps the count).
export const CHAOS_MON_MODIFIER_CAP = 2

// Glass Cannon: both attacking stats and Speed times the first, both defending ones times
// the second. Fortress is the other way round: both attacking stats and Speed times its
// second, HP and both defending stats times its first.
export const CHAOS_GLASS_CANNON = { attack: 1.5, defense: 0.7 }
export const CHAOS_FORTRESS = { defense: 1.5, attack: 0.7 }
// Spikes stack up to three layers.
export const CHAOS_MAX_SPIKES = 3

export type ChaosHazard = 'stealthrock' | 'spikes' | 'stickyweb'

export type ChaosModifier =
  // Battle start: the field every battle begins with.
  | { kind: 'weather'; id: string }
  | { kind: 'terrain'; id: string }
  | { kind: 'trickroom' }
  | { kind: 'tailwind' }
  | { kind: 'screens' }
  | { kind: 'hazard'; id: ChaosHazard }
  | { kind: 'intimidate' }
  // One Pokemon (see CHAOS_MON_MODIFIERS) - `pick` when it's pinned to that one.
  | { kind: 'ability'; pick?: number }
  | { kind: 'stat'; pick?: number }
  | { kind: 'tutor'; pick?: number }
  | { kind: 'glasscannon'; pick?: number }
  | { kind: 'fortress'; pick?: number }
  | { kind: 'wildcard'; pick?: number }

// The Pokemon a modifier is pinned to (its index in the picks), if it is.
export function chaosModifierPin(modifier: ChaosModifier): number | undefined {
  return 'pick' in modifier ? modifier.pick : undefined
}

// The modifiers that go on one of the player's Pokemon.
export const CHAOS_MON_MODIFIERS: ChaosModifier['kind'][] = ['ability', 'stat', 'tutor', 'glasscannon', 'fortress', 'wildcard']

// How every chaos battle starts from now on. Weather and terrain last until a move or
// ability replaces them, Trick Room until someone uses Trick Room; Tailwind (4 turns) and
// Reflect + Light Screen (5 turns) on the player's side; hazards on the opponent's; and
// the opponent's lead at -1 Attack.
export interface ChaosField {
  weather: string | null
  terrain: string | null
  trickRoom: boolean
  tailwind?: boolean
  screens?: boolean
  stealthRock?: boolean
  stickyWeb?: boolean
  spikes?: number
  intimidate?: boolean
}

// What a Pokemon modifier needs once picked: which Pokemon, and the ability, stat, or
// (Move Tutor) the move slot to replace and the move to learn.
export interface ChaosModifierTarget {
  pick: number
  ability?: string
  stat?: keyof StatBlock
  moveSlot?: number
  newMove?: string
}

// A move the Move Tutor can teach (any move in the game).
export interface ChaosTutorMove {
  id: string
  name: string
  type: string
  category: string
  description: string
}

export const CHAOS_STAT_LABELS: Record<keyof StatBlock, string> = {
  hp: 'HP',
  atk: 'Attack',
  def: 'Defense',
  spa: 'Sp. Atk',
  spd: 'Sp. Def',
  spe: 'Speed'
}

// Abilities an Ability modifier can't give: the ones that break a fight on their own, and
// those tied to one species' forms (they do nothing - or worse - on anyone else).
export const CHAOS_BANNED_ABILITIES = [
  'wonderguard',
  'hugepower',
  'purepower',
  'shadowtag',
  'arenatrap',
  'moody',
  'parentalbond',
  'imposter',
  'comatose',
  'multitype',
  'rkssystem',
  'stancechange',
  'schooling',
  'zenmode',
  'battlebond',
  'powerconstruct',
  'shieldsdown',
  'disguise',
  'iceface',
  'gulpmissile',
  'zerotohero',
  'commander',
  'terashift',
  'teraformzero',
  'asoneglastrier',
  'asonespectrier',
  'hungerswitch',
  'flowergift',
  'forecast',
  'embodyaspectcornerstone',
  'embodyaspecthearthflame',
  'embodyaspectteal',
  'embodyaspectwellspring',
  'poisonpuppeteer'
]
