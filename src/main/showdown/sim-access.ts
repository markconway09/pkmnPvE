import { createRequire } from 'node:module'
import type { PokemonSet as ShowdownPokemonSet } from 'pokemon-showdown/dist/sim/teams.js'
import type { Battle } from 'pokemon-showdown/dist/sim/battle.js'
import type { Pokemon } from 'pokemon-showdown/dist/sim/pokemon.js'
import {
  BLACK_AUGURITE_ITEM_ID,
  DEFAULT_POKEBALL_ID,
  EXP_CANDY_EXP,
  LINK_CABLE_ITEM_ID,
  MAX_HAPPINESS,
  OPENABLE_ITEM_IDS,
  PEAT_BLOCK_ITEM_ID,
  POKEBALL_PRICE,
  RANDOM_LEGENDARY_ITEM_ID,
  RANDOM_POKEMON_ITEM_ID,
  RARE_CANDY_ITEM_ID,
  SHINY_PATCH_ITEM_ID
} from '../../shared/battle-types'
import type {
  EditablePokemonSet,
  EditorOptions,
  ItemOptionEntry,
  LiveMovePower,
  MoveInfo,
  PokemonSummary,
  ShopItemEntry,
  SpeciesEditInfo,
  StatBlock,
  WildLocationConfig
} from '../../shared/battle-types'

import { getShopPriceOverrides } from './shop-price-store'
import { FOSSIL_SPECIES } from './fossils'
import { REGIONAL_STARTER_SPECIES } from '../../shared/starters'

// pokemon-showdown is CommonJS; Node's static named-export detection misses
// some of these under ESM, so the package is loaded via require() instead.
const require = createRequire(import.meta.url)
const { BattleStream, getPlayerStreams, Teams, Dex, toID } =
  require('pokemon-showdown') as typeof import('pokemon-showdown')
const { BattlePlayer } = require('pokemon-showdown/dist/sim/battle-stream.js') as typeof import(
  'pokemon-showdown/dist/sim/battle-stream.js'
)

// Teams/Dex aren't re-exported directly: their method signatures reference
// pokemon-showdown internal types (e.g. Teams' ExportOptions) that aren't
// themselves exported, which TS refuses to name in an exported const's
// inferred type. Wrapper functions with our own nameable return types avoid
// the issue.
export { BattleStream, getPlayerStreams, BattlePlayer, toID }

export type PokemonSet = ShowdownPokemonSet

export function generateTeam(format: string): PokemonSet[] {
  return Teams.generate(format)
}

export function packTeam(team: PokemonSet[]): string {
  return Teams.pack(team)
}

export function getTypeEffectivenessMultiplier(moveType: string, defenderTypes: string[]): number {
  if (!Dex.getImmunity(moveType, defenderTypes)) return 0
  return Math.pow(2, Dex.getEffectiveness(moveType, defenderTypes))
}

export function parseCondition(condition: string): { hpPercent: number; fainted: boolean; status: string | null } {
  if (condition.includes('fnt')) return { hpPercent: 0, fainted: true, status: null }
  const [hpPart, statusPart] = condition.split(' ')
  const [current, max] = hpPart.split('/').map(Number)
  const hpPercent = max ? Math.round((current / max) * 100) : 0
  return { hpPercent, fainted: false, status: statusPart ?? null }
}

export function computeStats(
  baseStats: StatBlock,
  level: number,
  ivs: StatBlock,
  evs: StatBlock,
  natureName: string
): StatBlock {
  const nature = Dex.natures.get(natureName || 'Serious')
  const calc = (stat: keyof StatBlock, base: number): number => {
    const iv = ivs[stat]
    const ev = evs[stat]
    if (stat === 'hp') {
      if (base === 1) return 1
      return Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + level + 10
    }
    let value = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + 5
    if (nature.plus === stat) value = Math.floor(value * 1.1)
    if (nature.minus === stat) value = Math.floor(value * 0.9)
    return value
  }
  return {
    hp: calc('hp', baseStats.hp),
    atk: calc('atk', baseStats.atk),
    def: calc('def', baseStats.def),
    spa: calc('spa', baseStats.spa),
    spd: calc('spd', baseStats.spd),
    spe: calc('spe', baseStats.spe)
  }
}

export function findRosterIndex(team: PokemonSet[], speciesName: string): number {
  // Match by base species, not exact form - some Pokemon display a different
  // form the instant they switch in (Zamazenta-Crowned, Greninja-Bond, etc.)
  // before any -formechange/detailschange line is ever sent.
  const targetBase = toID(Dex.species.get(speciesName).baseSpecies)
  return team.findIndex((p) => toID(Dex.species.get(p.species).baseSpecies) === targetBase)
}

export function speciesStatsAndTypes(species: string, set: PokemonSet | null): { types: string[]; stats: StatBlock } {
  const dexSpecies = Dex.species.get(species)
  const types = [...dexSpecies.types]
  const stats = set
    ? computeStats(dexSpecies.baseStats, set.level, set.ivs, set.evs, set.nature)
    : { ...dexSpecies.baseStats }
  return { types, stats }
}

export function buildPokemonSummary(species: string, set: PokemonSet | null): PokemonSummary {
  const { types, stats } = speciesStatsAndTypes(species, set)
  return {
    species,
    level: set?.level ?? 100,
    types,
    ability: set?.ability ?? '',
    item: set?.item ?? '',
    nature: set?.nature ?? '',
    teraType: set?.teraType || types[0] || '',
    stats,
    moveIds: set?.moves ?? [],
    shiny: !!set?.shiny
  }
}

export function toEditableSet(set: PokemonSet): EditablePokemonSet {
  const { types } = speciesStatsAndTypes(set.species, null)
  return {
    name: set.name,
    species: set.species,
    item: set.item,
    ability: set.ability,
    moves: [...set.moves],
    nature: set.nature,
    gender: set.gender || 'N',
    evs: { ...set.evs },
    ivs: { ...set.ivs },
    level: set.level,
    shiny: !!set.shiny,
    happiness: set.happiness ?? 255,
    teraType: set.teraType || types[0] || 'Normal'
  }
}

function clampInt(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(Number.isFinite(n) ? n : min)))
}

function clampStatBlock(stats: StatBlock, min: number, max: number): StatBlock {
  return {
    hp: clampInt(stats.hp, min, max),
    atk: clampInt(stats.atk, min, max),
    def: clampInt(stats.def, min, max),
    spa: clampInt(stats.spa, min, max),
    spd: clampInt(stats.spd, min, max),
    spe: clampInt(stats.spe, min, max)
  }
}

export function applyEditableSet(existing: PokemonSet, input: EditablePokemonSet): PokemonSet {
  const species = input.species.trim() || existing.species
  return {
    ...existing,
    name: input.name.trim() || species,
    species,
    item: input.item,
    ability: input.ability,
    moves: input.moves.filter(Boolean).slice(0, 4),
    nature: input.nature,
    gender: input.gender,
    evs: clampStatBlock(input.evs, 0, 252),
    ivs: clampStatBlock(input.ivs, 0, 31),
    level: clampInt(input.level, 1, 100),
    shiny: !!input.shiny,
    happiness: clampInt(input.happiness, 0, 255),
    teraType: input.teraType
  }
}

export function generateRandomSingle(format = 'gen9randombattle'): PokemonSet {
  const generated = generateTeam(format)
  return generated[Math.floor(Math.random() * generated.length)]
}

const LEGENDARY_TAGS = new Set(['Restricted Legendary', 'Sub-Legendary', 'Mythical', 'Ultra Beast'])

/**
 * True for a forme that only exists as an in-battle transformation - Mega,
 * Primal, Gigantamax, and similar (Alakazam-Mega, Charizard-Gmax, ...). These
 * report `prevo: ''` just like a genuine base form, so they'd otherwise slip
 * through as "unevolved"; they should never be picked as a standalone
 * species for a starter, wild encounter, or trainer's team. `battleOnly`
 * catches Mega/Primal/Zen/etc, but Gigantamax formes don't set it, so `forme`
 * is checked too.
 */
function isBattleOnlyForme(species: ReturnType<typeof Dex.species.get>): boolean {
  return !!species.battleOnly || species.forme === 'Gmax'
}

/**
 * The level at which this species would first naturally exist, walking up
 * its evolution chain and taking the highest level-up evolution requirement
 * along the way. Item/trade/friendship evolution steps aren't level-gated
 * (no natural "level" applies), so they're skipped - only level-up steps
 * count. A base-form Pokemon (or one only reachable via non-level methods)
 * returns 1.
 */
export function minLevelForSpecies(speciesName: string): number {
  let species = Dex.species.get(speciesName)
  let maxLevel = 1
  while (species.prevo) {
    if (species.evoLevel) maxLevel = Math.max(maxLevel, species.evoLevel)
    species = Dex.species.get(species.prevo)
  }
  return maxLevel
}

// An evolution with no level of its own (stone, trade, friendship...) is treated
// as happening at NON_LEVEL_EVO_LEVEL - or NON_LEVEL_EVO_GAP levels after the
// previous stage was reached, if that's later. Without the gap a middle stage
// that evolves at 30+ (Magneton, Seadra, Dusclops...) would have no levels of its
// own: below 30 its line falls straight back to the first stage.
const NON_LEVEL_EVO_LEVEL = 30
const NON_LEVEL_EVO_GAP = 10
// Baby Pokemon (Pichu, Azurill, Cleffa...) grow up early - their friendship
// evolution comes well before level 30, or Marill would never get levels of its
// own (Azumarill already evolves at 18).
const BABY_EVO_LEVEL = 10

// A baby: the first stage of its line, unable to breed (egg group Undiscovered)
// yet hatchable, and not a legendary.
function isBabySpecies(species: ReturnType<typeof Dex.species.get>): boolean {
  return (
    !species.prevo &&
    species.evos.length > 0 &&
    species.canHatch &&
    species.eggGroups.includes('Undiscovered') &&
    !species.tags.some((tag) => LEGENDARY_TAGS.has(tag))
  )
}

// The level at which a stage of an evolution line is plausibly reached (1 for a first stage).
function stageReachLevel(species: ReturnType<typeof Dex.species.get>): number {
  if (!species.prevo) return 1
  if (species.evoType === undefined) return species.evoLevel ?? 1
  const prevo = Dex.species.get(species.prevo)
  if (isBabySpecies(prevo)) return BABY_EVO_LEVEL
  return Math.max(NON_LEVEL_EVO_LEVEL, stageReachLevel(prevo) + NON_LEVEL_EVO_GAP)
}

/**
 * Steps a species back down its evolution chain until every remaining
 * evolution it's "used" is one it could plausibly have reached at this
 * level: a plain level-up evolution needs its usual evoLevel, and one with no
 * inherent level (stone, trade, friendship...) is placed after the stage before
 * it (see stageReachLevel) - a low-level wild Vaporeon makes no sense, but a
 * level-30+ one is fine.
 */
function deevolveUnderleveled(speciesName: string, level: number): string {
  let species = Dex.species.get(speciesName)
  while (species.prevo) {
    if (level >= stageReachLevel(species)) break
    species = Dex.species.get(species.prevo)
  }
  return species.name
}

const bstCache = new Map<string, number>()

/**
 * The stage of this evolution line a trainer would field at a level cap: as
 * evolved as the species can plausibly be at that level (see
 * deevolveUnderleveled), then stepped back further, one stage at a time, until
 * its base stats are within the ceiling. Null if even the first stage is too
 * strong (a Pokemon with no earlier form, like Great Tusk at a low cap).
 */
function stepBackToFit(speciesName: string, levelCap: number, maxBst: number): string | null {
  let species = Dex.species.get(deevolveUnderleveled(speciesName, levelCap))
  while (bstOf(species.name) > maxBst) {
    if (!species.prevo) return null
    species = Dex.species.get(species.prevo)
  }
  return minLevelForSpecies(species.name) > levelCap ? null : species.name
}

/** Whether the species can still evolve - what Eviolite needs. */
export function isNotFullyEvolved(speciesName: string): boolean {
  return !!Dex.species.get(speciesName).nfe
}

export function bstOf(speciesName: string): number {
  const cached = bstCache.get(speciesName)
  if (cached !== undefined) return cached
  const { hp, atk, def, spa, spd, spe } = Dex.species.get(speciesName).baseStats
  const bst: number = hp + atk + def + spa + spd + spe
  bstCache.set(speciesName, bst)
  return bst
}

// Random trainer teams get a base-stat-total ceiling that rises with the level
// cap: BST_AT_START_CAP at the starting cap, climbing in a straight line to
// BST_AT_FULL_CAP at FULL_POWER_LEVEL_CAP, and from there on anything goes.
// (720 is above every non-legendary in the Dex - Slaking's 670 is the highest.)
const START_LEVEL_CAP = 15
const BST_AT_START_CAP = 350
const FULL_POWER_LEVEL_CAP = 60
const BST_AT_FULL_CAP = 720
const MIN_MAX_BST = 300

export function maxBstForLevelCap(levelCap: number): number {
  if (levelCap >= FULL_POWER_LEVEL_CAP) return Infinity
  const progress = (levelCap - START_LEVEL_CAP) / (FULL_POWER_LEVEL_CAP - START_LEVEL_CAP)
  // Floored so a cap below the starting one (only reachable by hand-editing it)
  // can't shrink the pool to nothing.
  return Math.max(MIN_MAX_BST, Math.round(BST_AT_START_CAP + progress * (BST_AT_FULL_CAP - BST_AT_START_CAP)))
}

export function generateRandomTrainerTeam(
  options: { count?: number; format?: string; type?: string; levelCap?: number } = {}
): PokemonSet[] {
  const { count = 6, format = 'gen9randombattle', type, levelCap = 100 } = options
  const maxBst = maxBstForLevelCap(levelCap)
  const team: PokemonSet[] = []
  const usedBaseSpecies = new Set<string>()
  let attempts = 0
  const maxAttempts = count * (type ? 80 : 20)
  while (team.length < count && attempts < maxAttempts) {
    attempts++
    for (const mon of generateTeam(format)) {
      if (team.length >= count) break
      const dexSpecies = Dex.species.get(mon.species)
      const isLegendary = dexSpecies.tags.some((tag) => LEGENDARY_TAGS.has(tag))
      if (isLegendary) continue
      if (isBattleOnlyForme(dexSpecies)) continue
      // A Pokemon that is too evolved or too strong for the cap isn't skipped: it
      // steps back down its evolution line to the stage that fits (Garchomp
      // becomes Gible, Arcanine becomes Growlithe). Everything after this is
      // judged on that stage - what actually ends up on the team - so a monotype
      // team takes it only if the stage it lands on still has the type.
      const finalSpecies = stepBackToFit(mon.species, levelCap, maxBst)
      if (!finalSpecies) continue
      const finalDex = Dex.species.get(finalSpecies)
      if (type && !finalDex.types.includes(type)) continue
      // No repeats of a species, including two lines that step back to the same
      // one (Vaporeon and Jolteon are both Eevee at a low cap).
      const ids = [toID(dexSpecies.baseSpecies), toID(finalDex.baseSpecies)]
      if (ids.some((id) => usedBaseSpecies.has(id))) continue
      for (const id of ids) usedBaseSpecies.add(id)
      team.push(finalSpecies === mon.species ? { ...mon, level: levelCap } : buildBasicSet(finalSpecies, levelCap))
    }
  }
  return team
}

const WILD_SHINY_ODDS = 512

// Pokemon handed to the player outright - a starter, a restored fossil, one
// opened from a Random Pokemon / Random Legendary - get better odds than the wild.
const GIFT_SHINY_ODDS = 128

export function rollGiftShiny(): boolean {
  return Math.random() < 1 / GIFT_SHINY_ODDS
}

export function randomNatureName(): string {
  const natures = Dex.natures.all()
  return natures[Math.floor(Math.random() * natures.length)].name
}

const WEATHER_NAMES: Record<string, string> = {
  raindance: 'Rain',
  primordialsea: 'Heavy Rain',
  sunnyday: 'Harsh Sunlight',
  desolateland: 'Extremely Harsh Sunlight',
  sandstorm: 'Sandstorm',
  hail: 'Hail',
  snowscape: 'Snow',
  deltastream: 'Strong Winds'
}

// Weather, terrain, rooms and side conditions are all moves (or weather
// conditions) as far as the Dex is concerned - this turns any of their ids
// into the name a player would recognise.
export function effectDisplayName(id: string): string {
  if (WEATHER_NAMES[id]) return WEATHER_NAMES[id]
  const move = Dex.moves.get(id)
  if (move.exists) return move.name
  const condition = Dex.conditions.get(id)
  return condition.exists ? condition.name : id
}

// The id of the very first stage of a species' evolution line (walking prevo
// all the way down), resolving through a forme's own base species first
// (Sneasel-Hisui -> Sneasel) so every stage - and every forme of every stage -
// of a line resolves to the same root. Dex's own `baseSpecies` field does
// NOT do this on its own: it only differs from a species' own name for an
// alternate forme, so Golbat/Crobat, Simisear, Primeape/Annihilape etc. each
// report themselves as their own "base species" - naming just the line's
// first stage in a location's exceptionBaseSpecies (see battle-types.ts)
// still has to match every later stage too.
function evolutionRootId(speciesId: string): string {
  let current = Dex.species.get(speciesId)
  const seen = new Set<string>()
  while (!seen.has(current.id)) {
    seen.add(current.id)
    if (current.prevo) {
      current = Dex.species.get(current.prevo)
    } else if (toID(current.baseSpecies) !== current.id) {
      current = Dex.species.get(current.baseSpecies)
    } else {
      break
    }
  }
  return current.id
}

// How many evolutions a species is from the root of its line (0 for a base
// form, 1 for a middle stage, 2+ for a final one) - same prevo/forme walk as
// evolutionRootId, just counting hops instead of returning the root.
function evolutionStage(speciesId: string): number {
  let current = Dex.species.get(speciesId)
  let stage = 0
  const seen = new Set<string>()
  while (!seen.has(current.id)) {
    seen.add(current.id)
    if (current.prevo) {
      current = Dex.species.get(current.prevo)
      stage++
    } else if (toID(current.baseSpecies) !== current.id) {
      current = Dex.species.get(current.baseSpecies)
    } else {
      break
    }
  }
  return stage
}

function clampedLerp(x: number, x0: number, x1: number, y0: number, y1: number): number {
  if (x <= x0) return y0
  if (x >= x1) return y1
  return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0)
}

// A wild encounter's rarity - lower is rarer. Two independent signals, both
// roughly "how strong is this Pokemon really": how far it is into its
// evolution line (a Pidgeotto is a rung rarer than a Pidgey), and its raw BST
// (catches strong single-stage Pokemon like Snorlax that a stage check alone
// would miss). Halves per evolution stage; BST fades a candidate down to a
// fifth of its weight between 300 and 600.
function wildRarityWeight(speciesName: string): number {
  const stageFactor = 1 / Math.pow(2, evolutionStage(speciesName))
  const bstFactor = clampedLerp(bstOf(speciesName), 300, 600, 1, 0.2)
  return stageFactor * bstFactor
}

function weightedPick<T>(items: T[], weight: (item: T) => number): T {
  const weights = items.map(weight)
  const total = weights.reduce((sum, w) => sum + w, 0)
  let roll = Math.random() * total
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i]
    if (roll <= 0) return items[i]
  }
  return items[items.length - 1]
}

// Gen 9 Random Battles only know Pokemon that are in Scarlet/Violet, so whole
// lines (Pidgey, Aron, Patrat...) would never turn up in the wild. These are the
// final stages of every non-legendary line the random sets don't cover at all -
// they join each wild roll with a basic level-up set (see buildBasicSet), and
// get de-evolved to the rolled level like everything else.
let cachedWildExtraSpecies: string[] | null = null

function wildExtraSpecies(): string[] {
  if (cachedWildExtraSpecies) return cachedWildExtraSpecies
  const randomSets = require('pokemon-showdown/dist/data/random-battles/gen9/sets.json') as Record<string, unknown>
  // Every stage of every line the random sets already cover.
  const covered = new Set<string>()
  for (const id of Object.keys(randomSets)) {
    let species = Dex.species.get(id)
    while (species.exists && !covered.has(species.id)) {
      covered.add(species.id)
      if (!species.prevo) break
      species = Dex.species.get(species.prevo)
    }
  }
  cachedWildExtraSpecies = Dex.species
    .all()
    .filter(
      (s) =>
        s.exists &&
        s.num > 0 &&
        (!s.isNonstandard || s.isNonstandard === 'Past') &&
        s.evos.length === 0 &&
        !covered.has(s.id) &&
        !isBattleOnlyForme(s) &&
        isPlainSpecies(s) &&
        !s.tags.some((tag) => LEGENDARY_TAGS.has(tag))
    )
    .map((s) => s.name)
  return cachedWildExtraSpecies
}

// How many lines the random sets themselves supply, to mix the extras in at a fair share.
let cachedRandomSetCount: number | null = null
function randomSetCount(): number {
  if (cachedRandomSetCount === null) {
    cachedRandomSetCount = Object.keys(require('pokemon-showdown/dist/data/random-battles/gen9/sets.json')).length
  }
  return cachedRandomSetCount
}

// A wild Pokemon that could have evolved with an item (Growlithe -> Arcanine, Onix
// -> Steelix, Eevee -> Vaporeon...) has usually not been given one: it's met
// evolved only WILD_ITEM_EVO_CHANCE_START of the time at the level it first
// could be, rising to WILD_ITEM_EVO_CHANCE_END WILD_ITEM_EVO_CHANCE_SPAN levels later.
const WILD_ITEM_EVO_CHANCE_START = 0.25
const WILD_ITEM_EVO_CHANCE_END = 0.5
const WILD_ITEM_EVO_CHANCE_SPAN = 40

// deevolveUnderleveled for the wild: the same level rules, plus the roll above
// for every step that takes an item - lost, it steps back to the form before.
function deevolveWild(speciesName: string, level: number): string {
  let species = Dex.species.get(speciesName)
  while (species.prevo) {
    const reachLevel = stageReachLevel(species)
    if (level >= reachLevel) {
      if (!evolutionItemsFor(species)) break
      const chance = clampedLerp(
        level,
        reachLevel,
        reachLevel + WILD_ITEM_EVO_CHANCE_SPAN,
        WILD_ITEM_EVO_CHANCE_START,
        WILD_ITEM_EVO_CHANCE_END
      )
      if (Math.random() < chance) break
    }
    species = Dex.species.get(species.prevo)
  }
  return species.name
}

// Fossil Pokemon only come from restoring fossils, never the wild.
let cachedFossilRoots: Set<string> | null = null
function isFossilLine(speciesId: string): boolean {
  if (!cachedFossilRoots) cachedFossilRoots = new Set(FOSSIL_SPECIES.map((s) => evolutionRootId(toID(s))))
  return cachedFossilRoots.has(evolutionRootId(speciesId))
}

// The regional starters are still findable in the wild, just rarely: each one a
// roll brings up only makes it through this often.
const WILD_STARTER_CHANCE = 0.25
let cachedStarterRoots: Set<string> | null = null
function isStarterLine(speciesId: string): boolean {
  if (!cachedStarterRoots) cachedStarterRoots = new Set(REGIONAL_STARTER_SPECIES.map((s) => evolutionRootId(toID(s))))
  return cachedStarterRoots.has(evolutionRootId(speciesId))
}

export function generateRandomWildMon(
  levelCap: number,
  location?: WildLocationConfig | null,
  format = 'gen9randombattle'
): PokemonSet | null {
  const min = Math.max(1, levelCap - 14)
  const max = Math.max(min, levelCap - 4)
  const level = min + Math.floor(Math.random() * (max - min + 1))
  // Scales from ~360 at the starting cap up to ~720 (roughly legendary-tier)
  // by the max cap, so a level-5 wild encounter can't roll something like a
  // base-stage Passimian just because it happens to skip evolution gating.
  const maxBST = Math.min(720, 300 + levelCap * 4)
  const allowedTypes = location?.types ? new Set(location.types) : null
  const allowedEggGroups = location?.eggGroups ? new Set(location.eggGroups) : null
  const exceptionBaseSpecies = new Set((location?.exceptionBaseSpecies ?? []).map((s) => toID(s)))
  let attempts = 0
  const extras = wildExtraSpecies()
  // Each of a roll's slots is an extra species this often - their share of all lines.
  const extraChance = extras.length / (extras.length + randomSetCount())
  while (attempts < 40) {
    attempts++
    const generated = generateTeam(format).map((mon) =>
      Math.random() < extraChance ? buildBasicSet(extras[Math.floor(Math.random() * extras.length)], level) : mon
    )
    const candidates: PokemonSet[] = []
    for (const mon of generated) {
      const dexSpecies = Dex.species.get(mon.species)
      if (dexSpecies.tags.some((tag) => LEGENDARY_TAGS.has(tag))) continue
      if (isBattleOnlyForme(dexSpecies)) continue
      // De-evolve first, then check whether what's left still makes sense at
      // this level cap - checking the raw generated species (always its most
      // evolved form) here would reject the whole line before de-evolution
      // ever got a chance to hand back an earlier, level-appropriate stage.
      if (isFossilLine(dexSpecies.id)) continue
      // Dropped outright rather than down-weighted: at a low cap a roll often has
      // only one or two candidates left, where a lower weight would change nothing.
      if (isStarterLine(dexSpecies.id) && Math.random() >= WILD_STARTER_CHANCE) continue
      const finalSpecies = deevolveWild(mon.species, level)
      if (minLevelForSpecies(finalSpecies) > levelCap) continue
      if (bstOf(finalSpecies) > maxBST) continue
      if (allowedTypes || allowedEggGroups) {
        const finalDex = Dex.species.get(finalSpecies)
        const isException = exceptionBaseSpecies.has(evolutionRootId(finalDex.id))
        const typeMatch = !!allowedTypes && finalDex.types.some((t) => allowedTypes.has(t))
        const eggGroupMatch = !!allowedEggGroups && finalDex.eggGroups.some((g) => allowedEggGroups.has(g))
        if (!isException && !typeMatch && !eggGroupMatch) continue
      }
      candidates.push(
        finalSpecies === mon.species ? { ...mon, level } : buildBasicSet(finalSpecies, level)
      )
    }
    if (candidates.length > 0) {
      const wild = weightedPick(candidates, (c) => wildRarityWeight(c.species))
      // Overrides whatever the random set generator rolled, so the odds are
      // exactly WILD_SHINY_ODDS regardless of format. The generator leaves the
      // nature blank (and a de-evolved set is Hardy) - a wild Pokemon gets a
      // real random one instead, which a caught copy then keeps.
      return { ...wild, shiny: Math.random() < 1 / WILD_SHINY_ODDS, nature: randomNatureName() }
    }
  }
  return null
}

// The Professor's Lab (a wild location once every boss is beaten) has its own table:
// an unevolved regional starter 70% of the time, a fully evolved Pokemon that evolves
// with an item (or a trade) 20%, and a Mythical, Ultra Beast or Paradox Pokemon the
// last 10%, split evenly between them. Never a proper legendary.
const LAB_STARTER_CHANCE = 0.7
const LAB_ITEM_EVO_CHANCE = 0.2
const LAB_RARE_TAGS = new Set(['Mythical', 'Ultra Beast', 'Paradox'])
// Paradox Pokemon from the DLC that this Showdown version doesn't tag as Paradox.
const UNTAGGED_PARADOX_IDS = new Set(['gougingfire', 'ragingbolt', 'ironboulder', 'ironcrown'])

let cachedLabPools: { itemEvos: string[]; rare: string[] } | null = null

function labPools(): { itemEvos: string[]; rare: string[] } {
  if (!cachedLabPools) {
    const usable = Dex.species
      .all()
      .filter(
        (s) =>
          s.exists &&
          s.num > 0 &&
          (!s.isNonstandard || s.isNonstandard === 'Past') &&
          !isBattleOnlyForme(s) &&
          isPlainSpecies(s)
      )
    cachedLabPools = {
      itemEvos: usable
        .filter((s) => s.evos.length === 0 && !!s.prevo && !!evolutionItemsFor(s))
        .filter((s) => !s.tags.some((tag) => LEGENDARY_TAGS.has(tag)))
        .map((s) => s.name),
      rare: usable
        .filter((s) => s.tags.some((tag) => LAB_RARE_TAGS.has(tag)) || UNTAGGED_PARADOX_IDS.has(s.id))
        .filter((s) => !s.tags.includes('Restricted Legendary') && !s.tags.includes('Sub-Legendary'))
        .map((s) => s.name)
    }
  }
  return cachedLabPools
}

export function generateLabWildMon(levelCap: number): PokemonSet {
  const min = Math.max(1, levelCap - 14)
  const max = Math.max(min, levelCap - 4)
  const level = min + Math.floor(Math.random() * (max - min + 1))
  const { itemEvos, rare } = labPools()
  const roll = Math.random()
  const pool =
    roll < LAB_STARTER_CHANCE ? REGIONAL_STARTER_SPECIES : roll < LAB_STARTER_CHANCE + LAB_ITEM_EVO_CHANCE ? itemEvos : rare
  const species = pool[Math.floor(Math.random() * pool.length)]
  return { ...buildBasicSet(species, level), shiny: Math.random() < 1 / WILD_SHINY_ODDS, nature: randomNatureName() }
}

const TERA_TYPES = [
  'Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Poison', 'Ground',
  'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy', 'Stellar'
]

// Some evolutions need a trade rather than any item at all (Kadabra,
// Machoke, Haunter, Graveler, Gigalith, Conkeldurr, the Karrablast/Shelmet
// pair...), and this project has no trading, so this stands in for "a trade
// partner" wherever the bag needs to gate one of those. spritenum -1 is a
// sentinel the renderer treats as "no real sprite, show a fallback" since
// there's no matching icon in Showdown's sheet.
const LINK_CABLE_ITEM: ItemOptionEntry = {
  id: LINK_CABLE_ITEM_ID,
  name: 'Link Cable',
  description: 'Stands in for a trade partner - lets a trade-evolving Pokemon evolve without one.',
  spritenum: -1
}

// Rare Candy isn't a held/battle item, so the sim has no Dex entry for it -
// shop/bag-only, same "no real sprite" sentinel treatment as Link Cable but
// with its own value so the renderer can show a different fallback glyph.
const RARE_CANDY_ITEM: ItemOptionEntry = {
  id: RARE_CANDY_ITEM_ID,
  name: 'Rare Candy',
  description: 'A candy that is packed with energy. Sold in the shop.',
  spritenum: -2
}

// The evolution items for Kleavor and Ursaluna. This Showdown version has no
// Dex entry for either, so - like the Link Cable - they're made up here so
// they can sit in the shop and the bag. Neither is a held item (see
// NON_HELD_ITEM_IDS). Negative spritenums have no sheet icon; the renderer
// draws its own (see ItemSprite).
const BLACK_AUGURITE_ITEM: ItemOptionEntry = {
  id: BLACK_AUGURITE_ITEM_ID,
  name: 'Black Augurite',
  description: 'A black crystal that holds a strange power. Makes Scyther evolve into Kleavor.',
  spritenum: -3
}

const PEAT_BLOCK_ITEM: ItemOptionEntry = {
  id: PEAT_BLOCK_ITEM_ID,
  name: 'Peat Block',
  description: 'A block of peat with an odd energy. Makes Ursaring evolve into Ursaluna.',
  spritenum: -4
}

// The two "open it for a Pokemon" shop items. Not real Dex items, so - like the
// Link Cable - they're made up here; they borrow the Ultra Ball's and Master
// Ball's icons from the item sheet.
const RANDOM_POKEMON_ITEM: ItemOptionEntry = {
  id: RANDOM_POKEMON_ITEM_ID,
  name: 'Random Pokemon',
  description: 'Open it from the bag for a random unevolved Pokemon in your box - a legendary is possible.',
  spritenum: Dex.items.get('ultraball').spritenum ?? 0
}

const RANDOM_LEGENDARY_ITEM: ItemOptionEntry = {
  id: RANDOM_LEGENDARY_ITEM_ID,
  name: 'Random Legendary',
  description: 'Open it from the bag for a random legendary, mythical, ultra beast or paradox Pokemon in your box.',
  spritenum: Dex.items.get('masterball').spritenum ?? 0
}

// Not in this Showdown version's Dex either. -5/-6/-7 map to their own images
// (see ItemSprite).
const EXP_CANDY_ITEMS: ItemOptionEntry[] = [
  ['expcandys', 'Exp. Candy S', -5],
  ['expcandym', 'Exp. Candy M', -6],
  ['expcandyl', 'Exp. Candy L', -7]
].map(([id, name, spritenum]) => ({
  id: id as string,
  name: name as string,
  description: `Use it from the bag to give every Pokemon on your team ${EXP_CANDY_EXP[id as string].toLocaleString('en-US')} exp.`,
  spritenum: spritenum as number
}))

// -8 maps to its own image (see ItemSprite).
const SHINY_PATCH_ITEM: ItemOptionEntry = {
  id: SHINY_PATCH_ITEM_ID,
  name: 'Shiny Patch',
  description: 'Right-click a Pokemon in your box or team and use it to make that Pokemon shiny.',
  spritenum: -8
}
const SHINY_PATCH_PRICE = 10000

const EXP_CANDY_PRICE: Record<string, number> = {
  expcandys: 1000,
  expcandym: 5000,
  expcandyl: 10000
}

let cachedEditorOptions: EditorOptions | null = null

export function getEditorOptions(): EditorOptions {
  if (cachedEditorOptions) return cachedEditorOptions
  const byName = <T extends { name: string }>(a: T, b: T): number => a.name.localeCompare(b.name)
  const items = Dex.items
    .all()
    .filter((i) => i.exists)
    .map((i) => ({ id: i.id, name: i.name, description: i.shortDesc || i.desc || '', spritenum: i.spritenum ?? 0 }))
    .concat([
      LINK_CABLE_ITEM,
      RARE_CANDY_ITEM,
      BLACK_AUGURITE_ITEM,
      PEAT_BLOCK_ITEM,
      RANDOM_POKEMON_ITEM,
      RANDOM_LEGENDARY_ITEM,
      SHINY_PATCH_ITEM,
      ...EXP_CANDY_ITEMS
    ])
    .sort(byName)
  const natures = Dex.natures
    .all()
    .map((n) => ({ name: n.name, plus: n.plus ?? null, minus: n.minus ?? null }))
    .sort((a, b) => a.name.localeCompare(b.name))
  const species = Dex.species
    .all()
    .filter((s) => s.exists && s.num > 0)
    .map((s) => ({
      name: s.name,
      types: [...s.types],
      abilities: [s.abilities[0], s.abilities[1], s.abilities.H, s.abilities.S].filter(
        (a): a is string => !!a
      ),
      baseStats: { ...s.baseStats }
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
  cachedEditorOptions = { items, natures, types: TERA_TYPES, species }
  return cachedEditorOptions
}

let itemSpritenumByName: Map<string, number> | null = null

// A set's `item` field is stored as the display name (not an id) throughout
// this codebase - this resolves one to a sprite for display purposes only.
export function getItemSpritenum(itemName: string): number | null {
  if (!itemSpritenumByName) {
    itemSpritenumByName = new Map(getEditorOptions().items.map((i) => [i.name, i.spritenum]))
  }
  return itemSpritenumByName.get(itemName) ?? null
}

const RARE_CANDY_PRICE = 800
const RANDOM_POKEMON_PRICE = 5000
const RANDOM_LEGENDARY_PRICE = 50000
const BERRY_PRICE = 500
const FOSSIL_PRICE = 2000
const COMPETITIVE_ITEM_PRICE = 5000

// TR01-TR100 (id "tr00".."tr99") - teach items with no purpose here, there's
// no separate "teach a move outside battle" flow to spend them on.
const TR_ITEM_PATTERN = /^tr\d\d$/

// EV-training items - Power Weight/Bracer/Belt/Lens/Band/Anklet. Power Herb
// (a real one-time-move item, unrelated despite the name) is deliberately
// not in this list.
const POWER_TRAINING_ITEM_IDS = new Set([
  'poweranklet',
  'powerband',
  'powerbelt',
  'powerbracer',
  'powerlens',
  'powerweight'
])

function isFossilItemName(name: string): boolean {
  return name.includes('Fossil') || name === 'Old Amber'
}

// Held-item novelties that have no place in this game - a cosmetic
// battle-facing item (Mail), flavor collectibles (Big Nugget, the two bows),
// and a joke/troll item (Vile Vial).
const MISC_EXCLUDED_ITEM_IDS = new Set(['vilevial', 'mail', 'bignugget', 'polkadotbow', 'pinkbow'])

// Berries whose own Dex text says "Cannot be eaten by the holder" - these
// only do something when used outside battle (cooking, Pomeg-style EV
// berries, ...), so as a plain held item they're dead weight here.
function isUneatableByHolder(dexItem: ReturnType<typeof Dex.items.get>): boolean {
  return `${dexItem.shortDesc || ''} ${dexItem.desc || ''}`.toLowerCase().includes('cannot be eaten by the holder')
}

// Groups the catalog by what the item actually is, in shop display order -
// everything not otherwise categorized (Leftovers, Choice items, vitamins,
// Power Herb, the Link Cable stand-in, evolution hold items, ...) falls into
// the "Items" catch-all. "Recommended" (the default Pokeball, Rare Candy)
// always leads.
const SHOP_CATEGORY_ORDER = [
  'Recommended',
  'Berries',
  'Fossils',
  'Z-Crystals',
  'Plates',
  'Memories',
  'Drives',
  'Evolution Items',
  'Items'
]

function shopCategoryFor(dexItem: ReturnType<typeof Dex.items.get>): string {
  if (dexItem.isPokeball) return 'Recommended'
  if (dexItem.isBerry) return 'Berries'
  if (isFossilItemName(dexItem.name)) return 'Fossils'
  if (dexItem.zMove) return 'Z-Crystals'
  if (dexItem.onPlate) return 'Plates'
  if (dexItem.name.endsWith(' Memory')) return 'Memories'
  if (dexItem.name.endsWith(' Drive')) return 'Drives'
  return 'Items'
}

// The bag groups items the way the shop does, plus two groups for things the shop
// doesn't sell: mega stones and the evolution items it no longer stocks.
export const BAG_CATEGORY_ORDER = [
  'Recommended',
  'Berries',
  'Fossils',
  'Z-Crystals',
  'Plates',
  'Memories',
  'Drives',
  'Mega Stones',
  'Evolution Items',
  'Items'
]

let cachedShopCategoryById: Map<string, string> | null = null

/** Which bag group an item belongs to: its shop category, or one of the two extra groups. */
export function bagCategoryFor(itemId: string): string {
  if (!cachedShopCategoryById) cachedShopCategoryById = new Map(getShopCatalog().map((i) => [i.id, i.category]))
  const shopCategory = cachedShopCategoryById.get(itemId)
  if (shopCategory) return shopCategory
  if (getEvolutionOnlyItemIds().has(itemId)) return 'Evolution Items'
  const dexItem = Dex.items.get(itemId)
  if (!dexItem.exists) return 'Items'
  if (dexItem.megaStone) return 'Mega Stones'
  return shopCategoryFor(dexItem)
}

let cachedBaseShopCatalog: ShopItemEntry[] | null = null
let cachedShopCatalog: ShopItemEntry[] | null = null

let cachedEvolutionStoneIds: Set<string> | null = null

// Anything ending in "Stone" that some species' evolution actually requires, as
// opposed to a same-named but unrelated held item like Hard Stone or Everstone.
function getEvolutionStoneIds(): Set<string> {
  if (!cachedEvolutionStoneIds) {
    cachedEvolutionStoneIds = new Set(
      Dex.species
        .all()
        .map((s) => s.evoItem)
        .filter((name): name is string => !!name && name.toLowerCase().includes('stone'))
        .map((name) => toID(name))
    )
  }
  return cachedEvolutionStoneIds
}

// Alcremie's seven Sweets - each one only evolves Milcery.
const EVOLUTION_SWEET_IDS = [
  'strawberrysweet',
  'lovesweet',
  'berrysweet',
  'cloversweet',
  'flowersweet',
  'starsweet',
  'ribbonsweet'
]

let cachedEvolutionOnlyItemIds: Set<string> | null = null

/**
 * Items whose only job is to evolve something: the evolution stones, the
 * trade/use items (Dragon Scale, Protector, the Galarica pair, the apples,
 * pots, armors and teacups, Metal Alloy, ...), Alcremie's Sweets, and this
 * game's own stand-ins (Link Cable, Black Augurite, Peat Block). An item that
 * also does something in battle (King's Rock, Metal Coat, Razor Claw/Fang, the
 * Clamperl items) is not in here - the Dex describes an evolution-only item as
 * "Evolves ...", and those describe their battle effect instead. Found as wild
 * drops, and sold in the shop once they're unlocked (see isLateGameItem).
 */
function getEvolutionOnlyItemIds(): Set<string> {
  if (!cachedEvolutionOnlyItemIds) {
    const ids = new Set<string>([
      ...getEvolutionStoneIds(),
      ...EVOLUTION_SWEET_IDS,
      LINK_CABLE_ITEM_ID,
      BLACK_AUGURITE_ITEM_ID,
      PEAT_BLOCK_ITEM_ID
    ])
    for (const species of Dex.species.all()) {
      if (!species.evoItem) continue
      const item = Dex.items.get(species.evoItem)
      if (item.exists && (item.shortDesc || '').startsWith('Evolves')) ids.add(item.id)
    }
    cachedEvolutionOnlyItemIds = ids
  }
  return cachedEvolutionOnlyItemIds
}

/**
 * Items kept out of the shop until the boss flagged `unlocksLateItems` is
 * beaten (see lateItemsUnlocked in progression-store.ts): the Exp. Candies
 * and the evolution items. Drops are never affected.
 */
export function isLateGameItem(itemId: string): boolean {
  return itemId in EXP_CANDY_EXP || getEvolutionOnlyItemIds().has(itemId)
}

let cachedWildDropPool: ItemOptionEntry[] | null = null

/**
 * Every item a wild Pokemon can randomly drop: everything the shop sells
 * (evolution items and Exp. Candies included, whether or not the shop is
 * showing them yet). Mega stones are left out, and so are items the game has no use
 * for (TMs/TRs, EV training gear, extra Poke Ball types, novelty items), and the
 * two openable Random Pokemon items, which stay shop-only.
 */
export function getWildDropPool(): ItemOptionEntry[] {
  if (!cachedWildDropPool) {
    const shopIds = new Set(getShopCatalog().map((i) => i.id))
    const evolutionIds = getEvolutionOnlyItemIds()
    cachedWildDropPool = getEditorOptions().items.filter(
      (item) =>
        !OPENABLE_ITEM_IDS.has(item.id) &&
        item.id !== SHINY_PATCH_ITEM_ID && // shop-only
        (shopIds.has(item.id) || evolutionIds.has(item.id))
    )
  }
  return cachedWildDropPool
}

/**
 * Everything sellable in the shop, minus mega stones, every Pokeball but the
 * default one, all TR items, all Power-x EV training items but Power Herb, the misc novelty
 * items in MISC_EXCLUDED_ITEM_IDS, and any berry that can't be eaten by its
 * holder. The synthetic Rare Candy is always included and priced/categorized
 * explicitly, since it has no real Dex entry to derive that from. The
 * evolution items (see getEvolutionOnlyItemIds) get their own category; the
 * shop hides them and the Exp. Candies until they're unlocked (see
 * isLateGameItem and shop-store's listShop).
 * Sorted by category (see SHOP_CATEGORY_ORDER), then name within it.
 */
export function getDefaultShopCatalog(): ShopItemEntry[] {
  if (cachedBaseShopCatalog) return cachedBaseShopCatalog
  const evolutionOnlyIds = getEvolutionOnlyItemIds()
  cachedBaseShopCatalog = getEditorOptions()
    .items.filter((item) => {
      if (
        item.id === RARE_CANDY_ITEM_ID ||
        item.id === SHINY_PATCH_ITEM_ID ||
        OPENABLE_ITEM_IDS.has(item.id) ||
        item.id in EXP_CANDY_PRICE ||
        evolutionOnlyIds.has(item.id)
      ) {
        return true
      }
      if (TR_ITEM_PATTERN.test(item.id)) return false
      if (POWER_TRAINING_ITEM_IDS.has(item.id)) return false
      if (MISC_EXCLUDED_ITEM_IDS.has(item.id)) return false
      const dexItem = Dex.items.get(item.id)
      if (dexItem.megaStone) return false
      if (dexItem.isPokeball && item.id !== DEFAULT_POKEBALL_ID) return false
      if (dexItem.isBerry && isUneatableByHolder(dexItem)) return false
      return true
    })
    .map((item) => {
      if (item.id === RARE_CANDY_ITEM_ID) return { ...item, price: RARE_CANDY_PRICE, category: 'Recommended' }
      if (item.id === RANDOM_POKEMON_ITEM_ID) return { ...item, price: RANDOM_POKEMON_PRICE, category: 'Recommended' }
      if (item.id === RANDOM_LEGENDARY_ITEM_ID) return { ...item, price: RANDOM_LEGENDARY_PRICE, category: 'Recommended' }
      if (item.id in EXP_CANDY_PRICE) return { ...item, price: EXP_CANDY_PRICE[item.id], category: 'Recommended' }
      if (item.id === SHINY_PATCH_ITEM_ID) return { ...item, price: SHINY_PATCH_PRICE, category: 'Recommended' }
      if (evolutionOnlyIds.has(item.id)) return { ...item, price: COMPETITIVE_ITEM_PRICE, category: 'Evolution Items' }
      const dexItem = Dex.items.get(item.id)
      const category = shopCategoryFor(dexItem)
      const price = dexItem.isPokeball
        ? POKEBALL_PRICE
        : dexItem.isBerry
          ? BERRY_PRICE
          : isFossilItemName(dexItem.name)
            ? FOSSIL_PRICE
            : COMPETITIVE_ITEM_PRICE
      return { ...item, price, category }
    })
    .sort((a, b) => SHOP_CATEGORY_ORDER.indexOf(a.category) - SHOP_CATEGORY_ORDER.indexOf(b.category) || a.name.localeCompare(b.name))
  return cachedBaseShopCatalog
}

/** The shop's stock at its current prices: the defaults, with any an admin has changed. */
export function getShopCatalog(): ShopItemEntry[] {
  if (!cachedShopCatalog) {
    const overrides = getShopPriceOverrides()
    cachedShopCatalog = getDefaultShopCatalog().map((item) =>
      item.id in overrides ? { ...item, price: overrides[item.id] } : item
    )
  }
  return cachedShopCatalog
}

/** Call after a price changes so the next read picks it up. */
export function resetShopCatalogCache(): void {
  cachedShopCatalog = null
}

/** What the default Poke Ball costs right now, wherever it's bought. */
export function pokeballPrice(): number {
  return getShopCatalog().find((i) => i.id === DEFAULT_POKEBALL_ID)?.price ?? POKEBALL_PRICE
}

/**
 * Half the price, or null for anything the shop won't buy. The shop buys back
 * everything it sells - including the items it isn't showing yet (see
 * isLateGameItem), so a dropped evolution item can always be sold.
 */
export function sellPriceFor(itemId: string): number | null {
  const item = getShopCatalog().find((i) => i.id === itemId)
  return item ? Math.floor(item.price / 2) : null
}

const speciesEditInfoCache = new Map<string, SpeciesEditInfo>()

// Showdown's random-battle set data: for each species, the handful of roles it
// plays and the moves each role picks from. It's the closest thing the
// installed package has to "what people actually run" - not real ladder usage,
// but a curated list of each Pokemon's sensible moves.
interface RandbatsEntry {
  sets?: { movepool: string[] }[]
}
let randbatsSets: Record<string, RandbatsEntry> | null = null

function getRandbatsSets(): Record<string, RandbatsEntry> {
  if (!randbatsSets) {
    try {
      randbatsSets = require('pokemon-showdown/data/random-battles/gen9/sets.json') as Record<string, RandbatsEntry>
    } catch (e) {
      console.error('[sim-access] could not load random-battle set data, moves stay alphabetical:', e)
      randbatsSets = {}
    }
  }
  return randbatsSets
}

// A move's score is how many of the species' roles can run it, so a staple
// that every role picks from outranks one only a single role uses.
function randbatsMoveCounts(speciesId: string): Map<string, number> | null {
  const sets = getRandbatsSets()[speciesId]?.sets
  if (!sets || sets.length === 0) return null
  const counts = new Map<string, number>()
  for (const set of sets) {
    for (const moveName of set.movepool) {
      const id = toID(moveName)
      counts.set(id, (counts.get(id) ?? 0) + 1)
    }
  }
  return counts
}

// Most random-battle sets belong to fully evolved Pokemon, so a Charmander or
// a Pichu has none of its own. Walking outward from it one evolution stage at
// a time (first later stages, then earlier ones) and taking the first stage
// that has data lets it borrow its relatives' - the learnable-moves filter
// upstream already drops anything it can't actually use.
function nearestRelativeMoveCounts(
  species: ReturnType<typeof Dex.species.get>,
  next: (s: ReturnType<typeof Dex.species.get>) => string[]
): Map<string, number> | null {
  let frontier = [species]
  while (frontier.length > 0) {
    const stage = frontier.flatMap((s) => next(s).map((name) => Dex.species.get(name)))
    const merged = new Map<string, number>()
    for (const relative of stage) {
      for (const [id, n] of randbatsMoveCounts(relative.id) ?? []) merged.set(id, (merged.get(id) ?? 0) + n)
    }
    if (merged.size > 0) return merged
    frontier = stage
  }
  return null
}

/** How commonly each move is used by this species (or its nearest relatives) - empty if nothing is known. */
export function moveUsageFor(speciesName: string): Map<string, number> {
  const species = Dex.species.get(speciesName)
  return (
    randbatsMoveCounts(species.id) ??
    randbatsMoveCounts(toID(species.baseSpecies)) ??
    nearestRelativeMoveCounts(species, (s) => s.evos) ??
    nearestRelativeMoveCounts(species, (s) => (s.prevo ? [s.prevo] : [])) ??
    new Map()
  )
}

// Most of a species' gen 9 movepool has no level-up source at all (former
// level-up moves were shifted to TM/tutor over the generations), so it has
// no natural level to gate on. Its raw power stands in instead - status
// moves (no basePower) are always available, and the strongest attackers stay
// locked until level 60, so a low-level Pokemon can't be handed something
// like Hyper Beam just because it's technically TM-taught. 60 rather than
// the level cap itself, since by then a Pokemon has room to actually use
// whatever a TM hands it for a while before the game's over.
function powerBasedRequiredLevel(moveId: string): number {
  const basePower = Dex.moves.get(moveId).basePower || 0
  if (basePower <= 0) return 1
  return clampInt(basePower / 1.5, 1, 60)
}

export function learnableMoveIds(speciesId: string, level: number): string[] {
  const merged = new Map<string, string[]>()
  // Species dropped from the current regional dex ("isNonstandard: Past",
  // e.g. Caterpie, Pidgey, Carvanha - about a third of the whole Dex) have no
  // gen9-tagged sources in their learnset at all, only historical gen1-8
  // ones. Hardcoding gen9 would leave every one of them with an empty
  // movepool forever, so the most recent generation actually present in the
  // learnset is used instead.
  let maxGen = 0
  for (const { learnset } of Dex.species.getFullLearnset(speciesId)) {
    for (const moveId in learnset) {
      const sources = merged.get(moveId) ?? []
      sources.push(...learnset[moveId])
      merged.set(moveId, sources)
      for (const s of learnset[moveId]) {
        const gen = parseInt(s[0], 10)
        if (gen > maxGen) maxGen = gen
      }
    }
  }
  const genPrefix = String(maxGen || 9)

  const ids: string[] = []
  for (const [moveId, sources] of merged) {
    const genSources = sources.filter((s) => s.startsWith(genPrefix))
    if (genSources.length === 0) continue
    const requiredLevels = genSources
      .filter((s) => s[1] === 'L')
      .map((s) => parseInt(s.slice(2), 10))
      .filter(Number.isFinite)
    const requiredLevel = requiredLevels.length > 0 ? Math.min(...requiredLevels) : powerBasedRequiredLevel(moveId)
    if (level >= requiredLevel) ids.push(moveId)
  }
  return ids
}

export function getSpeciesEditInfo(speciesName: string, level: number): SpeciesEditInfo {
  const species = Dex.species.get(speciesName)
  const cacheKey = `${species.id}@${level}`
  const cached = speciesEditInfoCache.get(cacheKey)
  if (cached) return cached

  const abilitySlots = [species.abilities[0], species.abilities[1], species.abilities.H, species.abilities.S]
  const seenAbilities = new Set<string>()
  const abilities: SpeciesEditInfo['abilities'] = []
  for (const name of abilitySlots) {
    if (!name) continue
    const id = toID(name)
    if (seenAbilities.has(id)) continue
    seenAbilities.add(id)
    const dexAbility = Dex.abilities.get(id)
    abilities.push({ id, name, description: dexAbility.shortDesc || dexAbility.desc || '' })
  }

  // Most-used moves first; everything without a usage score (and ties) falls
  // back to alphabetical.
  const usage = moveUsageFor(species.name)
  const moves: SpeciesEditInfo['moves'] = learnableMoveIds(species.id, level)
    .map((id) => Dex.moves.get(id))
    .filter((m) => m.exists && !m.isZ && !m.isMax)
    .map((m) => ({
      id: m.id,
      name: m.name,
      type: m.type,
      category: m.category,
      basePower: m.basePower,
      accuracy: m.accuracy,
      pp: m.pp,
      description: m.shortDesc || m.desc || '',
      target: m.target,
      contact: !!m.flags?.contact,
      multihit: !!m.multihit
    }))
    .sort((a, b) => (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0) || a.name.localeCompare(b.name))

  let genders: string[]
  if (species.gender === 'N') genders = ['N']
  else if (species.gender === 'M') genders = ['M']
  else if (species.gender === 'F') genders = ['F']
  else {
    genders = []
    if (species.genderRatio.M > 0) genders.push('M')
    if (species.genderRatio.F > 0) genders.push('F')
    if (genders.length === 0) genders.push('N')
  }

  const info: SpeciesEditInfo = { abilities, moves, genders }
  speciesEditInfoCache.set(cacheKey, info)
  return info
}

// Only level-up moves the species has actually learned by this level (not
// any TM/tutor move it could theoretically be taught) - the most recently
// learned ones, like a freshly-caught wild/starter Pokemon would know.
function naturalMoveset(speciesId: string, level: number): string[] {
  // The newest generation with level-up moves for this species: gen 9 for anything
  // in Scarlet/Violet, but a Pokemon cut from it (Steelix, Pidgey, Omanyte...) only
  // has its older games' level-ups - same idea as learnableMoveIds.
  const fullLearnset = Dex.species.getFullLearnset(speciesId)
  let levelUpGen = 0
  for (const { learnset } of fullLearnset) {
    for (const moveId in learnset) {
      for (const s of learnset[moveId]) {
        if (s[1] === 'L') levelUpGen = Math.max(levelUpGen, parseInt(s[0], 10) || 0)
      }
    }
  }
  const genPrefix = String(levelUpGen || 9)

  const learnedAtLevel = new Map<string, number>()
  for (const { learnset } of fullLearnset) {
    for (const moveId in learnset) {
      const levelSources = learnset[moveId].filter((s) => s.startsWith(genPrefix) && s[1] === 'L')
      if (levelSources.length === 0) continue
      const learnLevel = Math.min(...levelSources.map((s) => parseInt(s.slice(2), 10)))
      if (learnLevel > level) continue
      const existing = learnedAtLevel.get(moveId)
      if (existing === undefined || learnLevel > existing) learnedAtLevel.set(moveId, learnLevel)
    }
  }
  return [...learnedAtLevel.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([id]) => id)
}

export function buildBasicSet(speciesName: string, level: number): PokemonSet {
  const species = Dex.species.get(speciesName)
  const ability = species.abilities[0]
  const moves = naturalMoveset(species.id, level)
  const gender = species.gender || (species.genderRatio.M > 0 ? 'M' : species.genderRatio.F > 0 ? 'F' : 'N')
  return {
    name: species.name,
    species: species.name,
    item: '',
    ability,
    moves: moves.length > 0 ? moves : ['tackle'],
    nature: 'Hardy',
    gender,
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    level,
    shiny: false,
    happiness: 255,
    teraType: species.types[0]
  }
}

// One entry per species: alternate formes (Arceus's 18 types, Silvally's 17...) would
// swamp the odds, so only the base forme counts - plus regional variants, which
// are genuinely different Pokemon.
const REGIONAL_FORMES = ['Alola', 'Galar', 'Hisui', 'Paldea']

function isPlainSpecies(species: ReturnType<typeof Dex.species.get>): boolean {
  return !species.forme || REGIONAL_FORMES.some((region) => species.forme.startsWith(region))
}

function unevolvedSpecies(): ReturnType<typeof Dex.species.get>[] {
  return Dex.species.all().filter((s) => s.exists && s.num > 0 && !s.prevo && !isBattleOnlyForme(s) && isPlainSpecies(s))
}

const RANDOM_LEGENDARY_TAGS = new Set([...LEGENDARY_TAGS, 'Paradox'])

function isLegendaryClass(species: ReturnType<typeof Dex.species.get>): boolean {
  return species.tags.some((tag) => RANDOM_LEGENDARY_TAGS.has(tag))
}

function pickFrom(species: ReturnType<typeof Dex.species.get>[]): string {
  return species[Math.floor(Math.random() * species.length)].name
}

// About a fifth of all unevolved species are legendary-class, so left to a plain
// uniform draw a Random Pokemon would be one nearly a fifth of the time. The
// legendary chance is set on its own instead, and everything else shares the rest.
export const RANDOM_POKEMON_LEGENDARY_CHANCE = 0.05

/** Any unevolved Pokemon - a legendary/mythical/ultra beast/paradox one only RANDOM_POKEMON_LEGENDARY_CHANCE of the time. */
export function pickRandomUnevolvedAnySpecies(): string {
  const all = unevolvedSpecies()
  const wantLegendary = Math.random() < RANDOM_POKEMON_LEGENDARY_CHANCE
  return pickFrom(all.filter((s) => isLegendaryClass(s) === wantLegendary))
}

/** An unevolved legendary, mythical, ultra beast or paradox Pokemon. */
export function pickRandomLegendarySpecies(): string {
  return pickFrom(unevolvedSpecies().filter(isLegendaryClass))
}

export function pickRandomUnevolvedSpecies(): string {
  const candidates = Dex.species
    .all()
    .filter(
      (s) =>
        s.exists &&
        s.num > 0 &&
        !s.prevo &&
        !isBattleOnlyForme(s) &&
        !s.tags.some((tag) => LEGENDARY_TAGS.has(tag))
    )
  return candidates[Math.floor(Math.random() * candidates.length)].name
}

export interface EvolutionOption {
  species: string
  // Bag item ids that can trigger this evolution (any one of them - one is
  // spent), or null if it needs none.
  requiredItems: string[] | null
}

// The three evolutions that need a specific item rather than friendship. Milcery
// takes any of the seven Sweets (Sweet Apple / Tart Apple are Applin's, not
// these).
const EVOLUTION_ITEM_OVERRIDES: Record<string, string[]> = {
  Kleavor: [BLACK_AUGURITE_ITEM_ID],
  Ursaluna: [PEAT_BLOCK_ITEM_ID],
  Alcremie: [
    'strawberrysweet',
    'lovesweet',
    'berrysweet',
    'cloversweet',
    'flowersweet',
    'starsweet',
    'ribbonsweet'
  ]
}

/**
 * Every evolution this set could reach, and what it takes: a plain level-up
 * evolution needs its usual evoLevel. A stone/hold-item evolution needs that
 * specific item. A trade evolution needs whatever item it also requires while
 * trading (e.g. Magmar needs a Magmarizer - the trade part is ignored, this
 * project has no trading), or, if it needs no item at all (Kadabra, Machoke,
 * Haunter, Graveler, Gigalith, Conkeldurr, the Karrablast/Shelmet pair...), the
 * Link Cable stand-in.
 * Every other kind - friendship, knowing a move, and all the one-off special
 * conditions (Sylveon, Mr. Mime, Wyrdeer, Pawmot, ...) - is collapsed into one
 * rule: the Pokemon must have max friendship (MAX_HAPPINESS). The exceptions
 * are the three in EVOLUTION_ITEM_OVERRIDES, which need their item instead.
 * Level and friendship gating are the only checks done here - bag/item
 * availability is the caller's job, since this module has no store access.
 */
/**
 * The items evolving into this species takes in this game (any one of them will
 * do), or null when it takes none - a level-up, friendship or other evolution.
 * See evolutionOptionsFor for the rules.
 */
function evolutionItemsFor(evoSpecies: ReturnType<typeof Dex.species.get>): string[] | null {
  const itemOverride = EVOLUTION_ITEM_OVERRIDES[evoSpecies.name]
  if (itemOverride) return itemOverride
  if (evoSpecies.evoType === 'useItem' || evoSpecies.evoType === 'levelHold') {
    return evoSpecies.evoItem ? [toID(evoSpecies.evoItem)] : null
  }
  if (evoSpecies.evoType === 'trade') return [evoSpecies.evoItem ? toID(evoSpecies.evoItem) : LINK_CABLE_ITEM_ID]
  return null
}

let cachedNationalDex: { num: number; species: string }[] | null = null

/** Every species in National Dex order, one per number (base forms only). */
export function nationalDexSpecies(): { num: number; species: string }[] {
  if (!cachedNationalDex) {
    const byNum = new Map<number, string>()
    for (const s of Dex.species.all()) {
      if (s.num > 0 && s.name === s.baseSpecies && !byNum.has(s.num)) byNum.set(s.num, s.name)
    }
    cachedNationalDex = [...byNum].sort((a, b) => a[0] - b[0]).map(([num, species]) => ({ num, species }))
  }
  return cachedNationalDex
}

/** The species a form belongs to, as the Pokedex counts it ("Vulpix-Alola" -> "Vulpix"). */
export function dexBaseSpecies(speciesName: string): string {
  const species = Dex.species.get(speciesName)
  return species.exists ? species.baseSpecies : speciesName
}

export function evolutionOptionsFor(set: PokemonSet): EvolutionOption[] {
  const species = Dex.species.get(set.species)
  const options: EvolutionOption[] = []
  for (const evoName of species.evos) {
    const evoSpecies = Dex.species.get(evoName)
    if (!evoSpecies.exists || isBattleOnlyForme(evoSpecies)) continue
    const requiredItems = evolutionItemsFor(evoSpecies)
    if (requiredItems) {
      options.push({ species: evoSpecies.name, requiredItems })
    } else if (evoSpecies.evoType === undefined) {
      if ((evoSpecies.evoLevel ?? 1) > set.level) continue
      options.push({ species: evoSpecies.name, requiredItems: null })
    } else if (evoSpecies.evoType === 'useItem' || evoSpecies.evoType === 'levelHold') {
      // An item evolution the Dex names no item for - nothing to spend.
      options.push({ species: evoSpecies.name, requiredItems: null })
    } else {
      // A set with no happiness recorded predates friendship being tracked,
      // and counts as already maxed.
      if ((set.happiness ?? MAX_HAPPINESS) < MAX_HAPPINESS) continue
      options.push({ species: evoSpecies.name, requiredItems: null })
    }
  }
  return options
}

export function evolveSet(set: PokemonSet, targetSpecies: string): PokemonSet {
  const species = Dex.species.get(targetSpecies)
  const abilityPool = [species.abilities[0], species.abilities[1], species.abilities.H, species.abilities.S].filter(
    (a): a is string => !!a
  )
  const ability = abilityPool.includes(set.ability) ? set.ability : species.abilities[0]
  const wasDefaultName = set.name === set.species || set.species.startsWith(`${set.name}-`)
  return {
    ...set,
    species: species.name,
    name: wasDefaultName ? species.name : set.name,
    ability
  }
}

/** What is visible about a Pokemon in battle: enough to tell whether a move can work on it. */
export interface MoveParty {
  types: string[]
  hpPercent: number
  status: string | null
  // Attack types it's known to be immune to on top of its typing - a Levitate
  // or Flash Fire it's certain to have, an Air Balloon, Magnet Rise.
  immuneTypes?: string[]
  // Move flags it's known to block (Soundproof: 'sound', Bulletproof: 'bullet',
  // Dazzling and co: 'priority').
  immuneFlags?: string[]
  // Wonder Guard: only super-effective attacks land.
  onlySuperEffective?: boolean
  // Statuses it can't be given right now - Electric Terrain keeps a grounded
  // Pokemon awake ('slp'), Misty Terrain stops every status and confusion.
  statusBlocked?: string[]
}

// Abilities that make their holder immune to a whole attacking type.
export const ABILITY_TYPE_IMMUNITIES: Record<string, string> = {
  levitate: 'Ground',
  eartheater: 'Ground',
  flashfire: 'Fire',
  wellbakedbody: 'Fire',
  waterabsorb: 'Water',
  stormdrain: 'Water',
  dryskin: 'Water',
  voltabsorb: 'Electric',
  lightningrod: 'Electric',
  motordrive: 'Electric',
  sapsipper: 'Grass'
}

// Abilities that block every move carrying a flag - Soundproof sound moves,
// Bulletproof ball and bomb moves - plus the ones that block priority moves
// aimed at their side (keyed 'priority', which isn't a real move flag).
export const ABILITY_FLAG_IMMUNITIES: Record<string, string> = {
  soundproof: 'sound',
  bulletproof: 'bullet',
  dazzling: 'priority',
  queenlymajesty: 'priority',
  armortail: 'priority'
}

/** Every ability a species can have, as ids. */
export function speciesAbilityIds(species: string): string[] {
  return Object.values(Dex.species.get(species).abilities).map((a) => toID(a))
}

/** What the AI needs to know about a move beyond MoveInfo. */
export interface MoveCombatData {
  priority: number
  // A fixed hit count, a [min, max] range, or null for a single hit.
  multihit: number | number[] | null
  // Each hit rolls its own accuracy (Triple Axel, Population Bomb) and a miss ends it.
  multiaccuracy: boolean
  flags: string[]
  // Aimed at itself or its own side - a foe's ability can't block it.
  selfTargeted: boolean
  // The move's target type as the Dex has it ('normal', 'adjacentAlly', 'allies'...).
  target: string
  // The status a status move puts on its target ('slp' for Yawn, 'confusion' for
  // the confusing ones), or null.
  inflicts: string | null
}

export function getMoveCombatData(id: string): MoveCombatData | null {
  const move = Dex.moves.get(id)
  if (!move.exists) return null
  return {
    priority: move.priority,
    multihit: move.multihit ?? null,
    multiaccuracy: !!move.multiaccuracy,
    flags: Object.keys(move.flags).filter((f) => move.flags[f as keyof typeof move.flags]),
    selfTargeted: ['self', 'allySide', 'allies', 'adjacentAlly', 'adjacentAllyOrSelf'].includes(move.target),
    target: move.target,
    inflicts:
      move.category !== 'Status'
        ? null
        : move.status ||
          (move.volatileStatus === 'yawn' ? 'slp' : move.volatileStatus === 'confusion' ? 'confusion' : null)
  }
}

/** A species' Speed stat at a level, for the given IVs, EVs and nature. */
export function speedStatFor(species: string, level: number, iv = 31, ev = 0, nature = 'Serious'): number {
  const base = Dex.species.get(species).baseStats
  const zero = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }
  return computeStats(base, level, { ...zero, spe: iv }, { ...zero, spe: ev }, nature).spe
}

// Which types can't be given each major status (the ones that are certain: a type-based immunity).
const STATUS_IMMUNE_TYPES: Record<string, string[]> = {
  par: ['Electric'],
  brn: ['Fire'],
  psn: ['Poison', 'Steel'],
  tox: ['Poison', 'Steel'],
  frz: ['Ice']
}

/**
 * Whether a move is certain to do nothing here, going only by what both sides can
 * see - types, status, HP, and any immunity the caller knows for certain (see
 * MoveParty.immuneTypes) - never hidden information like an unrevealed ability.
 * So a fighter can avoid wasting a turn: Synchronoise on something that shares no
 * type with the user, Dream Eater on a Pokemon that is awake, an attack the target's
 * type is immune to, Thunder Wave on a Ground type, a powder on a Grass type, a
 * status on something that already has one, or a heal at full health.
 */
export function moveDoesNothing(moveId: string, user: MoveParty, target: MoveParty): boolean {
  const move = Dex.moves.get(moveId)
  if (!move.exists) return false

  const aimedAtFoe = !['self', 'allySide', 'allies', 'adjacentAlly', 'adjacentAllyOrSelf'].includes(move.target)
  if (aimedAtFoe && target.immuneFlags?.length) {
    if (target.immuneFlags.some((f) => move.flags[f as keyof typeof move.flags])) return true
    if (move.priority > 0 && target.immuneFlags.includes('priority')) return true
  }

  if (move.category !== 'Status') {
    if (move.id === 'synchronoise') return !user.types.some((t) => target.types.includes(t))
    if (move.id === 'dreameater') return target.status !== 'slp'
    const ignores = move.ignoreImmunity
    const ignoresThisType = ignores === true || (!!ignores && typeof ignores === 'object' && !!ignores[move.type])
    if (ignoresThisType) return false
    if (!Dex.getImmunity(move.type, target.types) || target.immuneTypes?.includes(move.type)) return true
    // Wonder Guard lets only super-effective hits through (typeless Struggle aside).
    return !!target.onlySuperEffective && move.type !== '???' && Dex.getEffectiveness(move.type, target.types) <= 0
  }

  if (target.statusBlocked?.length && aimedAtFoe) {
    if (move.status && target.statusBlocked.includes(move.status)) return true
    if (move.volatileStatus === 'yawn' && target.statusBlocked.includes('slp')) return true
    if (move.volatileStatus === 'confusion' && target.statusBlocked.includes('confusion')) return true
  }
  if (move.flags.powder && target.types.includes('Grass')) return true
  if (move.volatileStatus === 'leechseed' && target.types.includes('Grass')) return true
  if (move.status) {
    if (target.status) return true
    if ((STATUS_IMMUNE_TYPES[move.status] ?? []).some((t) => target.types.includes(t))) return true
    // Thunder Wave doesn't ignore type immunities the way most status moves do.
    if (move.ignoreImmunity === false && !Dex.getImmunity(move.type, target.types)) return true
  }
  if (move.heal && move.target === 'self' && user.hpPercent >= 100) return true
  return false
}

const NO_POWER: LiveMovePower = { basePower: null, basePowerMax: null, fixedDamage: null, dynamic: false, varies: false }

// Moves that roll their power or damage at random (Magnitude, Present, Psywave, Fickle Beam). Working that out draws from the
// battle's own random number generator, which would change what actually happens
// in the fight - so they're reported as varying rather than asked.
const RANDOM_POWER_MOVES = new Set(['magnitude', 'present', 'psywave', 'ficklebeam'])

/**
 * What a move would hit for right now, from the sim's own rules: the move's
 * power callback (Reversal, Heavy Slam, Gyro Ball, Return, Facade, ...) is asked
 * with the live Pokemon, once per foe currently out. Only the move's own power -
 * item, ability, weather and type effects come after that and aren't included.
 */
export function liveMovePower(battle: Battle, source: Pokemon, foes: Pokemon[], moveId: string): LiveMovePower {
  const base = battle.dex.moves.get(moveId)
  if (!base.exists || base.category === 'Status') return NO_POWER
  if (RANDOM_POWER_MOVES.has(base.id)) return { ...NO_POWER, dynamic: true, varies: true }

  const move = battle.dex.getActiveMove(base.id)
  if (typeof move.damage === 'number') return { ...NO_POWER, fixedDamage: move.damage }
  if (move.damage === 'level') return { ...NO_POWER, fixedDamage: source.level }

  if (move.damageCallback) {
    // Super Fang, Nature's Madness, Counter and friends - a number only once there is one.
    let damage: number | null = null
    try {
      const value = move.damageCallback.call(battle, source, foes[0])
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) damage = Math.floor(value)
    } catch {
      // depends on something that hasn't happened yet
    }
    return { ...NO_POWER, fixedDamage: damage, dynamic: true }
  }

  move.hit = 1 // a multi-hit move's first hit (Triple Axel and Triple Kick scale with the hit number)
  const values = (foes.length > 0 ? foes : [null]).map((target) => {
    let power = move.basePower
    if (move.basePowerCallback) {
      try {
        const value = move.basePowerCallback.call(battle, source, target as Pokemon, move)
        if (typeof value === 'number' && Number.isFinite(value) && value > 0) power = Math.round(value)
      } catch {
        // the rule needs something the preview can't supply - fall back to the printed power
      }
    }
    return power > 0 ? applyOwnPowerModifier(battle, move, source, target, power) : power
  })
  const lowest = Math.min(...values)
  const highest = Math.max(...values)
  return {
    ...NO_POWER,
    basePower: lowest > 0 ? lowest : null,
    basePowerMax: highest > lowest ? highest : null,
    // Dynamic when the move's own rule decided it, i.e. it isn't simply the printed number.
    dynamic: !!move.basePowerCallback || values.some((v) => v !== move.basePower)
  }
}

/**
 * How effective a move is against a target right now, by type alone - the same
 * public information the battle screen shows (the target's current types, Tera
 * included; never a hidden ability like Levitate): 0 for an immunity, else
 * 0.25 / 0.5 / 1 / 2 / 4. The move's own type rules count (Weather Ball, Tera
 * Blast, Ivy Cudgel...), and so do moves that treat a type specially (Freeze-Dry
 * on Water, Flying Press adding Flying). Null when type doesn't matter: status
 * moves, and fixed damage (Seismic Toss) unless the target is immune to it.
 */
export function moveTypeEffectiveness(battle: Battle, source: Pokemon, target: Pokemon, moveId: string): number | null {
  const base = battle.dex.moves.get(moveId)
  if (!base.exists || base.category === 'Status') return null
  const move = battle.dex.getActiveMove(base.id)
  try {
    move.onModifyType?.call(battle, move, source, target)
  } catch {
    // needs battle context the preview can't give - its printed type stands
  }
  const targetTypes = target.getTypes()
  const ignores = move.ignoreImmunity
  const ignoresType = ignores === true || (!!ignores && typeof ignores === 'object' && !!ignores[move.type])
  if (!ignoresType && !battle.dex.getImmunity(move.type, targetTypes)) return 0
  if (move.damage !== undefined || move.damageCallback) return null
  let typeMod = 0
  for (const type of targetTypes) {
    let mod = battle.dex.getEffectiveness(move.type, type)
    if (move.onEffectiveness) {
      try {
        const changed = move.onEffectiveness.call(battle, mod, target, type, move)
        if (typeof changed === 'number') mod = changed
      } catch {
        // leave the plain chart value
      }
    }
    typeMod += mod
  }
  return Math.pow(2, typeMod)
}

// A few moves boost their own power in a separate handler rather than a power
// callback - Facade doubling when statused, Venoshock and Brine, Knock Off against
// a held item, Solar Beam in rain, and so on. It's applied the way the sim does it:
// inside a temporary event, so its modifier can be read back afterwards.
function applyOwnPowerModifier(
  battle: Battle,
  move: ReturnType<Battle['dex']['getActiveMove']>,
  source: Pokemon,
  target: Pokemon | null,
  power: number
): number {
  if (!move.onBasePower) return power
  const saved = battle.event
  try {
    battle.event = { id: 'BasePower', target: target ?? undefined, source, effect: move, modifier: 1 } as typeof battle.event
    const returned = move.onBasePower.call(battle, power, source, target as Pokemon, move)
    const modifier = battle.event.modifier ?? 1
    if (modifier !== 1) return battle.modify(power, modifier)
    if (typeof returned === 'number' && Number.isFinite(returned) && returned > 0) return Math.floor(returned)
  } catch {
    // depends on something the preview can't supply - the printed power stands
  } finally {
    battle.event = saved
  }
  return power
}

export function getMoveInfo(id: string): MoveInfo | null {
  const move = Dex.moves.get(id)
  if (!move.exists) return null
  return {
    id: move.id,
    name: move.name,
    type: move.type,
    category: move.category,
    basePower: move.basePower,
    accuracy: move.accuracy,
    pp: move.pp,
    description: move.shortDesc || move.desc || '',
    target: move.target,
    contact: !!move.flags?.contact,
    multihit: !!move.multihit
  }
}
