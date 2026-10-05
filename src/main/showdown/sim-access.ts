import { createRequire } from 'node:module'
import type { PokemonSet as ShowdownPokemonSet } from 'pokemon-showdown/dist/sim/teams.js'
import type { Battle } from 'pokemon-showdown/dist/sim/battle.js'
import type { Pokemon } from 'pokemon-showdown/dist/sim/pokemon.js'
import { certainRarity, mixRarityOdds, type RarityOdds } from '../../shared/rarity'
import {
  BLACK_AUGURITE_ITEM_ID,
  DEFAULT_POKEBALL_ID,
  EXP_CANDY_EXP,
  LINK_CABLE_ITEM_ID,
  MAX_HAPPINESS,
  MERGE_GROWTH_STARS,
  mergeBonusPerStar,
  mergeGrowthHolding,
  OPENABLE_ITEM_IDS,
  PEAT_BLOCK_ITEM_ID,
  POKEBALL_PRICE,
  RANDOM_LEGENDARY_ITEM_ID,
  RANDOM_POKEMON_ITEM_ID,
  LOCK_CAPSULE_ITEM_ID,
  RARE_CANDY_ITEM_ID,
  SHINY_PATCH_ITEM_ID,
  FRIENDSHIP_PETAL_ITEM_ID,
  WISHING_PIECE_ITEM_ID,
  RAID_GIGANTAMAX_CHANCE,
  RAID_RESTRICTED_CHANCE,
  KEY_ITEM_IDS,
  ROTOM_CATALOG_ITEM_ID,
  EXP_CHARM_ITEM_ID,
  SHINY_CHARM_ITEM_ID,
  SHINY_CHARM_MULTIPLIER,
  N_SOLARIZER_ITEM_ID,
  N_LUNARIZER_ITEM_ID,
  DNA_SPLICERS_ITEM_ID,
  REINS_OF_UNITY_ITEM_ID,
  FRIENDSHIP_CHARM_ITEM_ID,
  CATCHING_CHARM_ITEM_ID,
  ITEM_CHARM_ITEM_ID,
  FORM_CHANGES,
  ZYGARDE_CUBE_ITEM_ID,
  DECORATION_BOX_ITEM_ID,
  FASHION_CASE_ITEM_ID,
  SCANNER_ITEM_ID,
  DEXNAV_ITEM_ID,
  PRISON_BOTTLE_ITEM_ID,
  REVEAL_GLASS_ITEM_ID,
  GRACIDEA_ITEM_ID,
  METEORITE_ITEM_ID,
  QUICK_SELL_KEPT_BERRY_IDS,
  SELL_ONLY_ITEM_IDS,
  WILD_LOCATIONS,
  PIKACHU_FORMS
} from '../../shared/battle-types'
import type {
  AutoSetResult,
  PokedexHint,
  RarityTier,
  EditablePokemonSet,
  EditorOptions,
  ItemOptionEntry,
  LiveMovePower,
  MoveInfo,
  PokemonSummary,
  ShopItemEntry,
  SpeciesEditInfo,
  StatBlock,
  WildLocationConfig,
  WildLocationId
} from '../../shared/battle-types'

import { getShopPriceOverrides } from './shop-price-store'
import { FOSSIL_SPECIES } from './fossils'
import { REGIONAL_STARTER_SPECIES } from '../../shared/starters'
// Only called inside functions (never while modules load), so these import cycles
// (bag-store, box-store and title-perks all use this module) are harmless.
import { hasItem } from './bag-store'
import { hasRegisteredSpecies } from './box-store'
import { hasTitle } from './title-perks'
import {
  PROFESSOR_UNREGISTERED_WEIGHT,
  SHINY_HUNTER_ODDS,
  STARLIGHT_RAID_CHARM_MULTIPLIER,
  STARLIGHT_RAID_MULTIPLIER
} from '../../shared/titles'

// pokemon-showdown is CommonJS; Node's static named-export detection misses
// some of these under ESM, so the package is loaded via require() instead.
const require = createRequire(import.meta.url)
const { BattleStream, getPlayerStreams, Teams, Dex, toID } =
  require('pokemon-showdown') as typeof import('pokemon-showdown')
const { BattlePlayer } = require('pokemon-showdown/dist/sim/battle-stream.js') as typeof import(
  'pokemon-showdown/dist/sim/battle-stream.js'
)

// Meltan becomes Melmetal with candies in the real games, so the Dex lists no
// evolution for it. Here it evolves at max friendship instead. Patched into the raw
// data before any species is looked up (looked-up species are frozen and cached).
{
  const pokedex = Dex.data.Pokedex as unknown as Record<string, Record<string, unknown>>
  pokedex.meltan = { ...pokedex.meltan, evos: ['Melmetal'] }
  pokedex.melmetal = { ...pokedex.melmetal, prevo: 'Meltan', evoType: 'levelFriendship' }
  // AZ's Eternal Floette counts as a mythical here (see MYTHICAL_FORMES): never met in the
  // wild, found where the other mythicals are.
  pokedex.floetteeternal = { ...pokedex.floetteeternal, tags: ['Mythical'] }
  ;(Dex.species as unknown as { speciesCache: Map<string, unknown> }).speciesCache.clear()
}

// Battle Bond works the Gen 7 way here: after Greninja knocks out a foe with a move it
// becomes Ash-Greninja for the rest of the battle (Gen 9 only gives it +1 Atk/SpA/Spe).
{
  type BondPokemon = Pokemon & { bondTriggered?: boolean }
  const abilities = Dex.data.Abilities as unknown as Record<string, Record<string, unknown>>
  abilities.battlebond = {
    ...abilities.battlebond,
    onSourceAfterFaint(this: Battle, _length: number, _target: Pokemon, source: BondPokemon, effect: { effectType?: string } | null) {
      if (source.bondTriggered || effect?.effectType !== 'Move') return
      if (source.species.id === 'greninjabond' && source.hp && !source.transformed && source.side.foePokemonLeft()) {
        this.add('-activate', source, 'ability: Battle Bond')
        source.formeChange('Greninja-Ash', this.effect, true)
        source.formeRegression = true
        source.bondTriggered = true
      }
    }
  }
}

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
  // Anything still standing shows at least 1%, never a misleading 0%.
  const hpPercent = max && current > 0 ? Math.max(1, Math.round((current / max) * 100)) : 0
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

/** Whether two species names are the same Pokemon, forme aside (see findRosterIndex). */
export function sameBaseSpecies(a: string, b: string): boolean {
  return toID(Dex.species.get(a).baseSpecies) === toID(Dex.species.get(b).baseSpecies)
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

/**
 * The ability a Pokemon has after a lasting forme change in battle (Mega Evolution,
 * Primal Reversion, Ultra Burst, Zygarde's Power Construct...): the new forme's own
 * ability, which replaces the one it came in with. Falls back when the name is unknown.
 */
export function formeAbility(species: string, fallback: string): string {
  const dexSpecies = Dex.species.get(species)
  return dexSpecies.exists ? dexSpecies.abilities[0] || fallback : fallback
}

/** An ability's display name from its id (as a request reports it), e.g. "toughclaws" -> "Tough Claws". */
export function abilityName(id: string): string {
  const ability = Dex.abilities.get(id)
  return ability.exists ? ability.name : id
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
    gender: set?.gender ?? '',
    shiny: !!set?.shiny
  }
}

/** Whether a species has a Gigantamax form (Charizard, Urshifu-Rapid-Strike...). */
export function hasGmaxForm(speciesName: string): boolean {
  const species = Dex.species.get(speciesName)
  return species.exists && (!!species.canGigantamax || Dex.species.get(`${species.name}-Gmax`).exists)
}

/**
 * Whether the editor offers the cosmetic Gigantamax look: only a Pokemon caught Gigantamax
 * in a Max Raid, while it's a species with that form.
 */
export function canUseGmaxLook(set: PokemonSet | null | undefined, species = set?.species ?? ''): boolean {
  return !!set?.gigantamax && hasGmaxForm(species)
}

/**
 * The cosmetic Gigantamax look (the editor's toggle): only a sprite swap, kept on the set
 * itself so it follows the Pokemon into battle.
 */
export function gmaxLookOf(set: PokemonSet | null | undefined, species = set?.species ?? ''): boolean {
  return !!(set as { gmaxLook?: boolean } | null | undefined)?.gmaxLook && canUseGmaxLook(set, species)
}

export function toEditableSet(set: PokemonSet): EditablePokemonSet {
  const { types } = speciesStatsAndTypes(set.species, null)
  return {
    gmaxLook: gmaxLookOf(set),
    canGmax: canUseGmaxLook(set),
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
    ...{ gmaxLook: !!input.gmaxLook && canUseGmaxLook(existing, species) },
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

/** A species' National Dex number (0 if there's no such species). */
export function speciesDexNum(speciesName: string): number {
  return Dex.species.get(speciesName).num || 0
}

/** A species' height in metres (the Pokedex's own). */
export function speciesHeightM(speciesName: string): number {
  return Dex.species.get(speciesName).heightm ?? 1
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

/**
 * A wild Pokemon's or a raid boss's shiny roll: 1 in WILD_SHINY_ODDS, 3x as likely with the
 * Shiny Charm. Shiny Hunter shortens the odds for wild Pokemon only; Starlight raises a
 * raid boss's chances instead (3x, or 5x with the charm).
 */
export function rollWildShiny(raid = false, extraMultiplier = 1): boolean {
  const charm = hasItem(SHINY_CHARM_ITEM_ID)
  let boost = charm ? SHINY_CHARM_MULTIPLIER : 1
  let odds = WILD_SHINY_ODDS
  if (raid) {
    if (hasTitle('Starlight')) boost = charm ? STARLIGHT_RAID_CHARM_MULTIPLIER : STARLIGHT_RAID_MULTIPLIER
  } else if (hasTitle('Shiny Hunter')) {
    odds = SHINY_HUNTER_ODDS
  }
  // On top of the rest: a DexNav chain's bonus for the Pokemon it hunted.
  return Math.random() < (boost * extraMultiplier) / odds
}

// The Professor title: species not in the Pokedex yet are likelier in the wild.
function professorWeight(speciesName: string): number {
  return hasTitle('Professor') && !hasRegisteredSpecies(speciesName) ? PROFESSOR_UNREGISTERED_WEIGHT : 1
}

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

// A cosmetic form (Gastrodon-East, Sawsbuck-Winter, Florges-Blue) kept through
// de-evolution when the earlier stage has the same one (Shellos-East, Deerling-Winter,
// Floette-Blue) - the Dex points every form back to the plain earlier stage.
function keepCosmeticForm(from: string, to: string): string {
  if (from === to) return to
  const original = Dex.species.get(from)
  if (!original.isCosmeticForme || !original.forme) return to
  const same = Dex.species.get(`${to}-${original.forme}`)
  return same.exists ? same.name : to
}

// Lines whose forms random battle sets never roll (or only on a later stage): a wild one
// gets a random form of its own - an Unown letter, a Burmy cloak, a Furfrou trim, a
// Shellos sea, a Deerling season, a Flabébé flower.
const RANDOM_COSMETIC_FORM_BASES = new Set(['Unown', 'Burmy', 'Furfrou', 'Shellos', 'Deerling', 'Flabébé', 'Floette'])

function withRandomCosmeticForm(speciesName: string): string {
  const species = Dex.species.get(speciesName)
  if (species.forme || !RANDOM_COSMETIC_FORM_BASES.has(species.name) || !species.cosmeticFormes?.length) return speciesName
  const forms = [species.name, ...species.cosmeticFormes]
  return forms[Math.floor(Math.random() * forms.length)]
}

// Lines with alternate forms that the random sets and the extras bring up only some of: a
// wild one rolls among all of them evenly - a Wormadam cloak, a Pumpkaboo/Gourgeist size,
// a Toxtricity, a Tatsugiri, any Pikachu outfit (the set generator alone only does caps),
// a Spiky-eared Pichu, a Dusk Rockruff, a Roaming Gimmighoul, any Vivillon pattern. (It
// already rolls Maushold, Dudunsparce, Polteageist, Sinistcha and Basculin itself.) Only
// Totems (boss-only) and Eternal Floette are never met in the wild.
const WILD_FORM_CHOICES: Record<string, string[]> = {
  Wormadam: ['Wormadam', 'Wormadam-Sandy', 'Wormadam-Trash'],
  Pumpkaboo: ['Pumpkaboo', 'Pumpkaboo-Small', 'Pumpkaboo-Large', 'Pumpkaboo-Super'],
  Gourgeist: ['Gourgeist', 'Gourgeist-Small', 'Gourgeist-Large', 'Gourgeist-Super'],
  Toxtricity: ['Toxtricity', 'Toxtricity-Low-Key'],
  Tatsugiri: ['Tatsugiri', 'Tatsugiri-Droopy', 'Tatsugiri-Stretchy'],
  Pikachu: [...PIKACHU_FORMS],
  Pichu: ['Pichu', 'Pichu-Spiky-eared'],
  Rockruff: ['Rockruff', 'Rockruff-Dusk'],
  Gimmighoul: ['Gimmighoul', 'Gimmighoul-Roaming'],
  Vivillon: ['Vivillon', ...(Dex.species.get('Vivillon').cosmeticFormes ?? []), 'Vivillon-Fancy', 'Vivillon-Pokeball']
}

function withRandomWildForm(speciesName: string): string {
  const choices = WILD_FORM_CHOICES[Dex.species.get(speciesName).baseSpecies]
  return choices ? choices[Math.floor(Math.random() * choices.length)] : speciesName
}

// A generated set moved to another form of its Pokemon: kept, with the ability in the
// same slot, as long as the new form can learn every move - otherwise a fresh basic set.
function setInForm(set: PokemonSet, form: string, level: number): PokemonSet {
  const from = Dex.species.get(set.species)
  const to = Dex.species.get(form)
  if (from.baseSpecies !== to.baseSpecies) return buildBasicSet(form, level)
  const learnable = new Set(learnableMoveIds(to.id, 100))
  if (!set.moves.every((m) => learnable.has(toID(m)))) return buildBasicSet(form, level)
  const slot = (Object.keys(from.abilities) as (keyof typeof from.abilities)[]).find((k) => from.abilities[k] === set.ability)
  const ability = (slot && to.abilities[slot]) || to.abilities[0]
  // A one-gender form (Pikachu's caps are male, its Cosplay outfits female) sets the gender.
  return { ...set, name: to.name, species: to.name, ability, level, gender: to.gender || set.gender }
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
      // Paradox Pokemon only turn up in the Lab (see generateLabWildMon).
      if (isParadoxSpecies(dexSpecies)) continue
      if (isBattleOnlyForme(dexSpecies)) continue
      // De-evolve first, then check whether what's left still makes sense at
      // this level cap - checking the raw generated species (always its most
      // evolved form) here would reject the whole line before de-evolution
      // ever got a chance to hand back an earlier, level-appropriate stage.
      if (isFossilLine(dexSpecies.id)) continue
      // Dropped outright rather than down-weighted: at a low cap a roll often has
      // only one or two candidates left, where a lower weight would change nothing.
      if (isStarterLine(dexSpecies.id) && Math.random() >= WILD_STARTER_CHANCE) continue
      const finalSpecies = withRandomWildForm(keepCosmeticForm(mon.species, deevolveWild(mon.species, level)))
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
        finalSpecies === mon.species ? { ...mon, level } : setInForm(mon, finalSpecies, level)
      )
    }
    if (candidates.length > 0) {
      const wild = weightedPick(candidates, (c) => wildRarityWeight(c.species) * professorWeight(c.species))
      // Overrides whatever the random set generator rolled, so the odds are
      // exactly WILD_SHINY_ODDS regardless of format. The generator leaves the
      // nature blank (and a de-evolved set is Hardy) - a wild Pokemon gets a
      // real random one instead, which a caught copy then keeps.
      return { ...wild, species: withRandomCosmeticForm(wild.species), shiny: rollWildShiny(), nature: randomNatureName() }
    }
  }
  return null
}

// The Lab (a wild location once every boss is beaten) has its own table: an unevolved
// regional starter 55% of the time, a Paradox Pokemon 20%, an Ultra Beast 20% and a
// Mythical the last 5%. Never a restricted legendary.
const LAB_TABLE: { chance: number; pool: keyof LabPools | 'starters' }[] = [
  { chance: 0.55, pool: 'starters' },
  { chance: 0.2, pool: 'paradox' },
  { chance: 0.2, pool: 'ultraBeasts' },
  { chance: 0.05, pool: 'mythicals' }
]
// Paradox Pokemon from the DLC that this Showdown version doesn't tag as Paradox.
const UNTAGGED_PARADOX_IDS = new Set(['gougingfire', 'ragingbolt', 'ironboulder', 'ironcrown'])

function isParadoxSpecies(species: ReturnType<typeof Dex.species.get>): boolean {
  return species.tags.includes('Paradox') || UNTAGGED_PARADOX_IDS.has(species.id)
}

interface LabPools {
  paradox: string[]
  ultraBeasts: string[]
  mythicals: string[]
}

let cachedLabPools: LabPools | null = null

function labPools(): LabPools {
  if (!cachedLabPools) {
    const usable = Dex.species
      .all()
      .filter(
        (s) =>
          s.exists &&
          s.num > 0 &&
          (!s.isNonstandard || s.isNonstandard === 'Past') &&
          !isBattleOnlyForme(s) &&
          isPlainSpecies(s) &&
          !s.tags.includes('Restricted Legendary')
      )
    const tagged = (tag: string): string[] => usable.filter((s) => s.tags.some((t) => t === tag)).map((s) => s.name)
    cachedLabPools = {
      paradox: [...tagged('Paradox'), ...usable.filter((s) => UNTAGGED_PARADOX_IDS.has(s.id)).map((s) => s.name)],
      ultraBeasts: tagged('Ultra Beast'),
      // Arceus is tagged Mythical but is too strong for the Lab.
      mythicals: tagged('Mythical').filter((name) => name !== 'Arceus')
    }
  }
  return cachedLabPools
}

export function generateLabWildMon(levelCap: number): PokemonSet {
  const min = Math.max(1, levelCap - 14)
  const max = Math.max(min, levelCap - 4)
  const level = min + Math.floor(Math.random() * (max - min + 1))
  const pools = labPools()
  let roll = Math.random()
  const entry = LAB_TABLE.find((e) => (roll -= e.chance) < 0) ?? LAB_TABLE[0]
  const pool = entry.pool === 'starters' ? REGIONAL_STARTER_SPECIES : pools[entry.pool]
  const species = pool[Math.floor(Math.random() * pool.length)]
  return { ...buildBasicSet(species, level), shiny: rollWildShiny(), nature: randomNatureName() }
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
// Link Cable - they're made up here. Random Legendary borrows the Master
// Ball's icon from the item sheet.
// -10 is the GS Ball (Serebii's icon - see ItemSprite).
const RANDOM_POKEMON_ITEM: ItemOptionEntry = {
  id: RANDOM_POKEMON_ITEM_ID,
  name: 'Random Pokemon',
  description: 'Open it from the bag for a random unevolved Pokemon in your box - a legendary is possible.',
  spritenum: -10
}

// -26 is Serebii's Crystal Cluster icon (see ItemSprite).
const WISHING_PIECE_ITEM: ItemOptionEntry = {
  id: WISHING_PIECE_ITEM_ID,
  name: 'Raid Crystal',
  description: 'Starts a Max Raid Battle from the Classic menu - it is used up when the raid begins.',
  spritenum: -26
}
const WISHING_PIECE_PRICE = 25000

// -9 is Serebii's Lock Capsule icon (see ItemSprite).
const LOCK_CAPSULE_ITEM: ItemOptionEntry = {
  id: LOCK_CAPSULE_ITEM_ID,
  name: 'Lock Capsule',
  description: 'Open it from the bag for a random item from the shop - the pricier the item, the rarer it is.',
  spritenum: -9
}
const LOCK_CAPSULE_PRICE = 1000

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
const SHINY_PATCH_PRICE = 25000

// -31 maps to its own image (see ItemSprite).
const FRIENDSHIP_PETAL_ITEM: ItemOptionEntry = {
  id: FRIENDSHIP_PETAL_ITEM_ID,
  name: 'Friendship Petal',
  description:
    "Right-click a Pokemon in your box or team and use it to max out that Pokemon's friendship. The box's merge can spend them on friendship evolutions too.",
  spritenum: -31
}

// A key item (see KEY_ITEM_IDS) - never sold. -11 maps to its own image (see ItemSprite).
// More key items. -12 and -13 map to their own images (see ItemSprite).
const EXP_CHARM_ITEM: ItemOptionEntry = {
  id: EXP_CHARM_ITEM_ID,
  name: 'Exp. Charm',
  description: 'Your team gains 1.5× exp from every battle won.',
  spritenum: -12
}

const SHINY_CHARM_ITEM: ItemOptionEntry = {
  id: SHINY_CHARM_ITEM_ID,
  name: 'Shiny Charm',
  description: 'Wild Pokemon are three times as likely to be shiny.',
  spritenum: -13
}

// Three more charms - -18 to -20 are Serebii's Oval, Catching and Mark Charm icons (see ItemSprite).
const MORE_CHARMS: ItemOptionEntry[] = [
  {
    id: FRIENDSHIP_CHARM_ITEM_ID,
    name: 'Friendship Charm',
    description: 'Your team grows twice as close to you with every battle won.',
    spritenum: -18
  },
  {
    id: CATCHING_CHARM_ITEM_ID,
    name: 'Catching Charm',
    description: 'Half of all catches are free - no Poke Ball used and nothing paid.',
    spritenum: -19
  },
  {
    id: ITEM_CHARM_ITEM_ID,
    name: 'Item Charm',
    description: 'Wild Pokemon are 1.5× as likely to drop items.',
    spritenum: -20
  }
]

// The form-change key items (see FORM_CHANGES). -21 to -25 are Serebii's icons (see ItemSprite).
const FORM_CHANGE_ITEMS: ItemOptionEntry[] = [
  {
    id: PRISON_BOTTLE_ITEM_ID,
    name: 'Prison Bottle',
    description: 'Right-click a Hoopa to change it between its Confined and Unbound forms.',
    spritenum: -21
  },
  {
    id: REVEAL_GLASS_ITEM_ID,
    name: 'Reveal Glass',
    description: 'Right-click Tornadus, Thundurus, Landorus or Enamorus to change it between its Incarnate and Therian Formes.',
    spritenum: -22
  },
  {
    id: GRACIDEA_ITEM_ID,
    name: 'Gracidea',
    description: 'Right-click a Shaymin to change it between its Land and Sky Formes.',
    spritenum: -23
  },
  {
    id: METEORITE_ITEM_ID,
    name: 'Meteorite',
    description: 'Right-click a Deoxys to change it between its Normal, Attack, Defense and Speed Formes.',
    spritenum: -24
  },
  {
    id: ZYGARDE_CUBE_ITEM_ID,
    name: 'Zygarde Cube',
    description: 'Right-click a Zygarde to change it between its 50% and 10% Formes.',
    spritenum: -25
  },
  {
    id: DECORATION_BOX_ITEM_ID,
    name: 'Decoration Box',
    description: 'Right-click an Alcremie to change its cream to any of its nine forms.',
    spritenum: -27
  },
  {
    id: FASHION_CASE_ITEM_ID,
    name: 'Fashion Case',
    description: "Right-click a Pikachu to change its outfit - a cap, a Cosplay costume, Partner or World.",
    spritenum: -28
  }
]

// The fusion key items (see FUSIONS). -14 to -17 map to Serebii's icons (see ItemSprite).
const FUSION_ITEMS: ItemOptionEntry[] = [
  {
    id: N_SOLARIZER_ITEM_ID,
    name: 'N-Solarizer',
    description: 'Right-click a Necrozma to fuse it with a Solgaleo from your box - or to unfuse them.',
    spritenum: -14
  },
  {
    id: N_LUNARIZER_ITEM_ID,
    name: 'N-Lunarizer',
    description: 'Right-click a Necrozma to fuse it with a Lunala from your box - or to unfuse them.',
    spritenum: -15
  },
  {
    id: DNA_SPLICERS_ITEM_ID,
    name: 'DNA Splicers',
    description: 'Right-click a Kyurem to fuse it with a Zekrom or Reshiram from your box - or to unfuse them.',
    spritenum: -16
  },
  {
    id: REINS_OF_UNITY_ITEM_ID,
    name: 'Reins of Unity',
    description: 'Right-click a Calyrex to fuse it with a Glastrier or Spectrier from your box - or to unfuse them.',
    spritenum: -17
  }
]

// The Scanner: a key item bought in the Coin Shop (see tm-store). -29 maps to its own image (see ItemSprite).
const SCANNER_ITEM: ItemOptionEntry = {
  id: SCANNER_ITEM_ID,
  name: 'Scanner',
  description: 'After a wild win, one quick skill check can turn up a TM from the area - 5% on a Good, 15% on a Great.',
  spritenum: -29
}

// The DexNav: a key item from the Pokedex Scholar achievement (see dexnav.ts). -30 maps to its own image (see ItemSprite).
const DEXNAV_ITEM: ItemOptionEntry = {
  id: DEXNAV_ITEM_ID,
  name: 'DexNav',
  description:
    'Hunt a Pokémon you have registered: it turns up more often the longer your chain of them runs (up to 75%), and at a full chain is twice as likely to be shiny.',
  spritenum: -30
}

const ROTOM_CATALOG_ITEM: ItemOptionEntry = {
  id: ROTOM_CATALOG_ITEM_ID,
  name: 'Rotom Catalog',
  description: 'Right-click a Rotom to change its form - it takes a Smogon set for the new one.',
  spritenum: -11
}

const EXP_CANDY_PRICE: Record<string, number> = {
  expcandys: 1000,
  expcandym: 5000,
  expcandyl: 10000
}

/**
 * Items taken out of the game entirely - out of the shop, drops, capsules and every item
 * picker. The Gen 2 berries are duplicates of the modern ones, so any a player still has
 * (in the bag or held) turn into their modern twin; the rest (the incenses and the other
 * Gen 2 items) are refunded at what they sold for.
 */
export const RETIRED_ITEMS: Record<string, { replacement?: string; refund?: number }> = {
  berry: { replacement: 'oranberry' },
  goldberry: { replacement: 'sitrusberry' },
  bitterberry: { replacement: 'persimberry' },
  burntberry: { replacement: 'aspearberry' },
  iceberry: { replacement: 'rawstberry' },
  mintberry: { replacement: 'chestoberry' },
  miracleberry: { replacement: 'lumberry' },
  mysteryberry: { replacement: 'leppaberry' },
  przcureberry: { replacement: 'cheriberry' },
  psncureberry: { replacement: 'pechaberry' },
  fullincense: { refund: 2500 },
  laxincense: { refund: 1500 },
  oddincense: { refund: 2500 },
  rockincense: { refund: 2500 },
  roseincense: { refund: 2500 },
  seaincense: { refund: 2500 },
  waveincense: { refund: 2500 },
  berserkgene: { refund: 1500 },
  pinkbow: {},
  polkadotbow: {}
}

/** A held item after the retirement: its modern twin's name, '' if it's gone, or itself. */
export function unretiredHeldItem(itemName: string): string {
  const retired = RETIRED_ITEMS[toID(itemName)]
  if (!retired) return itemName
  return retired.replacement ? Dex.items.get(retired.replacement).name : ''
}

let cachedEditorOptions: EditorOptions | null = null

export function getEditorOptions(): EditorOptions {
  if (cachedEditorOptions) return cachedEditorOptions
  const byName = <T extends { name: string }>(a: T, b: T): number => a.name.localeCompare(b.name)
  const items = Dex.items
    .all()
    .filter((i) => i.exists && !(i.id in RETIRED_ITEMS))
    .map((i) => ({ id: i.id, name: i.name, description: i.shortDesc || i.desc || '', spritenum: i.spritenum ?? 0 }))
    .concat([
      LINK_CABLE_ITEM,
      RARE_CANDY_ITEM,
      BLACK_AUGURITE_ITEM,
      PEAT_BLOCK_ITEM,
      RANDOM_POKEMON_ITEM,
      RANDOM_LEGENDARY_ITEM,
      LOCK_CAPSULE_ITEM,
      SHINY_PATCH_ITEM,
      FRIENDSHIP_PETAL_ITEM,
      WISHING_PIECE_ITEM,
      ROTOM_CATALOG_ITEM,
      EXP_CHARM_ITEM,
      SHINY_CHARM_ITEM,
      ...MORE_CHARMS,
      ...FORM_CHANGE_ITEMS,
      ...FUSION_ITEMS,
      SCANNER_ITEM,
      DEXNAV_ITEM,
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

/** An item's icon by its id (0, the blank icon, for an unknown one). */
export function getItemSpritenumById(itemId: string): number {
  return getEditorOptions().items.find((i) => i.id === itemId)?.spritenum ?? 0
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
  'Key Items',
  'Items',
  'Evolution Items',
  'Berries',
  'Fossils',
  'Z-Crystals',
  'Plates',
  'Memories',
  'Drives'
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

// The bag groups items in the shop's order, plus a group for mega stones (which the
// shop doesn't sell) right after the evolution items.
export const BAG_CATEGORY_ORDER = SHOP_CATEGORY_ORDER.flatMap((category) =>
  category === 'Evolution Items' ? [category, 'Mega Stones'] : [category]
)

let cachedShopCategoryById: Map<string, string> | null = null

/** Which bag group an item belongs to: its shop category, or one of the two extra groups. */
export function bagCategoryFor(itemId: string): string {
  if (!cachedShopCategoryById) cachedShopCategoryById = new Map(getShopCatalog().map((i) => [i.id, i.category]))
  if (KEY_ITEM_IDS.has(itemId)) return 'Key Items'
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
 * beaten (see lateItemsUnlocked in progression-store.ts): the Exp. Candies, the
 * evolution items, the Shiny Patch, and the Raid Crystal (Max Raids open up at the same time). Drops are
 * never affected.
 */
export function isLateGameItem(itemId: string): boolean {
  return itemId in EXP_CANDY_EXP || itemId === WISHING_PIECE_ITEM_ID || itemId === SHINY_PATCH_ITEM_ID || getEvolutionOnlyItemIds().has(itemId)
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
        item.id !== WISHING_PIECE_ITEM_ID && // the Shop and the Game Corner only
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
      // Key items are never sold, nor bought back (see shop-store's listShop).
      if (KEY_ITEM_IDS.has(item.id)) return false
      // Friendship Petals come from wild drops and the Coin Shop's daily petals, never the Shop.
      if (item.id === FRIENDSHIP_PETAL_ITEM_ID) return false
      if (
        item.id === RARE_CANDY_ITEM_ID ||
        item.id === SHINY_PATCH_ITEM_ID ||
        item.id === WISHING_PIECE_ITEM_ID ||
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
      if (item.id === LOCK_CAPSULE_ITEM_ID) return { ...item, price: LOCK_CAPSULE_PRICE, category: 'Recommended' }
      if (item.id in EXP_CANDY_PRICE) return { ...item, price: EXP_CANDY_PRICE[item.id], category: 'Recommended' }
      if (item.id === SHINY_PATCH_ITEM_ID) return { ...item, price: SHINY_PATCH_PRICE, category: 'Recommended' }
      if (item.id === WISHING_PIECE_ITEM_ID) return { ...item, price: WISHING_PIECE_PRICE, category: 'Recommended' }
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
/** What the Shop charges for an item, or null if the Shop doesn't sell it. */
export function shopPriceFor(itemId: string): number | null {
  return getShopCatalog().find((i) => i.id === itemId)?.price ?? null
}

export function sellPriceFor(itemId: string): number | null {
  // Random Pokemon / Random Legendary can't be sold back - too easy to lose one by accident.
  if (OPENABLE_ITEM_IDS.has(itemId)) return null
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
      randbatsSets = require('pokemon-showdown/dist/data/random-battles/gen9/sets.json') as Record<string, RandbatsEntry>
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

// Only level-up moves wait for their level; anything taught (TM, tutor, egg, event)
// is open from level 1. From this level a Pokemon can learn every move its species has
// ever learned - even one it only learns by level-up later (Pidgeot's Hurricane at 62,
// Nidorino's Earth Power at 71).
const ALL_MOVES_LEVEL = 60

// Every move it has ever been able to learn, in any generation - Emolga's Knock Off and
// Beedrill's Fell Stinger are Gen 5-7 / 6-7 only (from Gen 8 they're gone), yet Smogon's
// sets use them. anyGeneration false narrows it to the latest generation's list alone.
// Moves a species can learn here that its Showdown learnset doesn't list: Zacian and
// Zamazenta's signature moves, which in the games only their Crowned formes have.
const EXTRA_LEARNABLE: Record<string, string[]> = {
  zacian: ['behemothblade'],
  zamazenta: ['behemothbash']
}

// Smeargle Sketches anything, so here it simply learns every move in the game, from
// level 1 and with no TM needed.
let smeargleMoves: string[] | null = null
function everyMoveId(): string[] {
  smeargleMoves ??= Dex.moves
    .all()
    .filter((m) => m.exists && !m.isZ && !m.isMax && m.id !== 'struggle' && m.isNonstandard !== 'CAP' && m.isNonstandard !== 'Custom')
    .map((m) => m.id)
  return smeargleMoves
}

export function learnableMoveIds(speciesId: string, level: number, anyGeneration = true): string[] {
  if (speciesId === 'smeargle') return everyMoveId()
  const merged = new Map<string, string[]>()
  for (const moveId of EXTRA_LEARNABLE[speciesId] ?? []) merged.set(moveId, ['9L1'])
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
  // Tera Blast is a TM nearly everything learns in Scarlet/Violet, but Pokemon cut from
  // those games (Alakazam, Machamp, Pidgeot...) never got it. Here anything that can be
  // taught a TM at all learns it too; Caterpie, which can't, still doesn't. Species that
  // are in those games keep their real list (Magikarp, Ditto and Terapagos go without).
  if (
    Dex.species.get(speciesId).isNonstandard === 'Past' &&
    !merged.has('terablast') &&
    [...merged.values()].some((sources) => sources.some((s) => s[1] === 'M'))
  ) {
    merged.set('terablast', ['9M'])
  }

  const ids: string[] = []
  for (const [moveId, sources] of merged) {
    const genSources = anyGeneration ? sources : sources.filter((s) => s.startsWith(genPrefix))
    if (genSources.length === 0) continue
    // The earliest it can come: a level-up source at its level, any other source (TM,
    // tutor, egg...) at level 1 - and from ALL_MOVES_LEVEL on, everything.
    const levels = genSources.map((s) => (s[1] === 'L' ? parseInt(s.slice(2), 10) : 1))
    const requiredLevel = Math.min(ALL_MOVES_LEVEL, ...levels.filter(Number.isFinite))
    if (level >= requiredLevel) ids.push(moveId)
  }
  return ids
}

// knownMoves: the moves the Pokemon already knows. They stay on its list even when its
// level wouldn't let it pick them now, so it keeps them (and they show their details).
export function getSpeciesEditInfo(speciesName: string, level: number, knownMoves: string[] = []): SpeciesEditInfo {
  const info = speciesEditInfoAt(speciesName, level)
  const listed = new Set(info.moves.map((m) => m.id))
  const extra = [...new Set(knownMoves.map((m) => toID(m)))]
    .filter((id) => id && !listed.has(id))
    // Keep the id it's saved under: Showdown files every Hidden Power type under
    // "hiddenpower", which would clash with the plain Hidden Power row.
    .map((id) => {
      const info = getMoveInfo(id)
      return info && { ...info, id }
    })
    .filter((m): m is MoveInfo => !!m)
  return extra.length > 0 ? { ...info, moves: [...info.moves, ...extra] } : info
}

function speciesEditInfoAt(speciesName: string, level: number): SpeciesEditInfo {
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
      description: moveDescription(m),
      target: m.target,
      contact: !!m.flags?.contact,
      multihit: !!m.multihit,
      priority: m.priority,
      ...moveAnimExtras(m)
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

/** The moves a Pokemon of this species knows from levelling up alone, at this level. */
export function levelUpMoveset(speciesName: string, level: number): string[] {
  return naturalMoveset(Dex.species.get(speciesName).id, level)
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
// Formes that are a mythical in their own right, so they get their own entry too.
const MYTHICAL_FORMES = new Set(['Floette-Eternal'])

function isPlainSpecies(species: ReturnType<typeof Dex.species.get>): boolean {
  // Not a Totem (Alolan Totem Raticate): a boss-only size, and there's no sprite for it.
  if (species.forme.includes('Totem')) return false
  if (MYTHICAL_FORMES.has(species.name)) return true
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
/**
 * How rare a species reads on the case-opening reel: restricted legendaries are gold,
 * the other special Pokemon (mythicals, sub-legendaries, Ultra Beasts, paradoxes)
 * pink, and everything else by its base stat total.
 */
// Gold: the restricted legendaries, plus Arceus (every form) - tagged Mythical, but a
// box legendary in all but name.
const GOLD_EXTRA_SPECIES = new Set(['Arceus'])

function isGoldSpecies(species: ReturnType<typeof Dex.species.get>): boolean {
  return species.tags.includes('Restricted Legendary') || GOLD_EXTRA_SPECIES.has(species.baseSpecies)
}

export function speciesRarityTier(speciesName: string): RarityTier {
  const species = Dex.species.get(speciesName)
  if (isGoldSpecies(species)) return 'legendary'
  if (isLegendaryClass(species)) return 'epic'
  const bst = bstOf(species.name)
  if (bst >= 500) return 'rare'
  if (bst >= 400) return 'uncommon'
  return 'common'
}

export function pickRandomUnevolvedAnySpecies(): string {
  const all = unevolvedSpecies()
  const wantLegendary = Math.random() < RANDOM_POKEMON_LEGENDARY_CHANCE
  return pickFrom(all.filter((s) => isLegendaryClass(s) === wantLegendary))
}

/**
 * A roguelite Random Swap's Pokemon, from any stage of any line: an ordinary one, a
 * legendary-class one (legendary, mythical, ultra beast or paradox - short of the
 * restricted ones), or a restricted legendary (Mewtwo, Kyogre, Koraidon...).
 */
/**
 * A Max Raid's boss: a Pokemon with a Gigantamax form (RAID_GIGANTAMAX_CHANCE), or else
 * a red one (legendary-class) - now and then a gold one (a restricted legendary). Fully
 * evolved only.
 */
// Fully evolved, ordinary-form species from current games (or Past) - what a raid
// boss is drawn from.
function raidSpeciesPool(): ReturnType<typeof Dex.species.get>[] {
  return Dex.species
    .all()
    .filter(
      (s) =>
        s.exists &&
        s.num > 0 &&
        (!s.isNonstandard || s.isNonstandard === 'Past') &&
        !isBattleOnlyForme(s) &&
        isPlainSpecies(s) &&
        s.evos.length === 0
    )
}

/**
 * Every Pokemon a Max Raid can bring (see pickRaidSpecies), in Pokedex order: the ones
 * that can Gigantamax (and raid as such), the other legendaries, the restricted ones.
 */
export function raidBossCandidates(): { species: string; num: number; gigantamax: boolean }[] {
  return raidSpeciesPool()
    .filter((s) => !!s.canGigantamax || isLegendaryClass(s) || isGoldSpecies(s))
    .map((s) => ({ species: s.name, num: s.num, gigantamax: !!s.canGigantamax }))
    .sort((a, b) => a.num - b.num || a.species.localeCompare(b.species))
}

export function pickRaidSpecies(
  chances: { gigantamax: number; restricted: number } = { gigantamax: RAID_GIGANTAMAX_CHANCE, restricted: RAID_RESTRICTED_CHANCE }
): { species: string; gigantamax: boolean } {
  const pool = raidSpeciesPool()
  const restricted = isGoldSpecies
  if (Math.random() < chances.gigantamax) {
    const gmax = pool.filter((s) => !!s.canGigantamax)
    if (gmax.length > 0) return { species: pickFrom(gmax), gigantamax: true }
  }
  const gold = Math.random() < chances.restricted
  return { species: pickFrom(pool.filter((s) => (gold ? restricted(s) : isLegendaryClass(s) && !restricted(s)))), gigantamax: false }
}

export function pickRandomSwapSpecies(kind: 'normal' | 'legendary' | 'restricted'): string {
  const pool = Dex.species
    .all()
    .filter(
      (s) =>
        s.exists &&
        s.num > 0 &&
        (!s.isNonstandard || s.isNonstandard === 'Past') &&
        !isBattleOnlyForme(s) &&
        isPlainSpecies(s)
    )
  const restricted = isGoldSpecies
  // Not Cosmog or Cosmoem - tagged restricted, but hardly a jackpot.
  if (kind === 'restricted') return pickFrom(pool.filter((s) => restricted(s) && s.evos.length === 0))
  if (kind === 'legendary') return pickFrom(pool.filter((s) => isLegendaryClass(s) && !restricted(s)))
  return pickFrom(pool.filter((s) => !isLegendaryClass(s)))
}

/**
 * The slot machine's three Pokemon, each picked on its own: a final-stage evolution of a
 * three-stage line for the big prize, a second stage for the medium one, and a first
 * stage (one that evolves) for the small one - say Skeledirge, Raichu and Hoppip. Only
 * ordinary species in current games.
 */
export function randomSlotPokemon(): [string, string, string] {
  const usable = (s: ReturnType<typeof Dex.species.get>): boolean =>
    s.exists && s.num > 0 && !s.isNonstandard && s.tags.length === 0 && isPlainSpecies(s) && !isBattleOnlyForme(s)
  const stage = (s: ReturnType<typeof Dex.species.get>): number => {
    let depth = 1
    let prevo = s.prevo
    while (prevo) {
      depth++
      prevo = Dex.species.get(prevo).prevo
    }
    return depth
  }
  const species = Dex.species.all().filter(usable)
  const first = species.filter((s) => stage(s) === 1 && s.evos.length > 0)
  // Never Gholdengo as the second stage: it's already the machine's jackpot symbol.
  const second = species.filter((s) => stage(s) === 2 && s.id !== 'gholdengo')
  const third = species.filter((s) => stage(s) === 3)
  return [pickFrom(third), pickFrom(second), pickFrom(first)]
}

/**
 * The Coin Shop's Pokemon of the day: an ultra beast, a paradox Pokemon, a mythical or a
 * gold legendary (Mewtwo, Kyogre, Koraidon...) - fully evolved only, so never Cosmog or
 * Poipole. Not the ordinary (red) sub-legendaries.
 */
export function pickDailyShopSpecies(): string {
  const pool = Dex.species
    .all()
    .filter(
      (s) =>
        s.exists &&
        s.num > 0 &&
        (!s.isNonstandard || s.isNonstandard === 'Past') &&
        !isBattleOnlyForme(s) &&
        isPlainSpecies(s) &&
        s.evos.length === 0 &&
        (isGoldSpecies(s) || isParadoxSpecies(s) || s.tags.includes('Mythical') || s.tags.includes('Ultra Beast'))
    )
  return pickFrom(pool)
}

/** An unevolved legendary, mythical, ultra beast or paradox Pokemon. */
export function pickRandomLegendarySpecies(): string {
  return pickFrom(unevolvedSpecies().filter(isLegendaryClass))
}

// The share of each rarity colour among these species, any one as likely as the next.
function speciesRarityShares(species: ReturnType<typeof Dex.species.get>[]): RarityOdds {
  const odds: RarityOdds = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 }
  for (const s of species) odds[speciesRarityTier(s.name)] += 1 / species.length
  return odds
}

/** A Random Pokemon's odds of each rarity colour (see pickRandomUnevolvedAnySpecies). */
export function randomPokemonRarityOdds(): RarityOdds {
  const all = unevolvedSpecies()
  return mixRarityOdds([
    [RANDOM_POKEMON_LEGENDARY_CHANCE, speciesRarityShares(all.filter(isLegendaryClass))],
    [1 - RANDOM_POKEMON_LEGENDARY_CHANCE, speciesRarityShares(all.filter((s) => !isLegendaryClass(s)))]
  ])
}

/**
 * A Random Legendary's odds of each rarity colour (see pickRandomLegendarySpecies) - with
 * restrictedChance of it being drawn from the gold box legendaries alone instead.
 */
export function randomLegendaryRarityOdds(restrictedChance: number): RarityOdds {
  return mixRarityOdds([
    [restrictedChance, certainRarity('legendary')],
    [1 - restrictedChance, speciesRarityShares(unevolvedSpecies().filter(isLegendaryClass))]
  ])
}

/** A Max Raid boss's odds of each rarity colour, at these chances (see pickRaidSpecies). */
export function raidRarityOdds(chances: { gigantamax: number; restricted: number }): RarityOdds {
  const gmax = raidSpeciesPool().filter((s) => !!s.canGigantamax)
  const gmaxChance = gmax.length > 0 ? chances.gigantamax : 0
  return mixRarityOdds([
    [gmaxChance, speciesRarityShares(gmax)],
    [(1 - gmaxChance) * chances.restricted, certainRarity('legendary')],
    [(1 - gmaxChance) * (1 - chances.restricted), certainRarity('epic')]
  ])
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

// Milcery: each Sweet gives its own cream - and now and then (MILCERY_RARE_CREAM_CHANCE)
// one of the two creams no Sweet gives instead.
export const MILCERY_SWEET_FORMS: Record<string, string> = {
  strawberrysweet: 'Alcremie-Ruby-Cream',
  lovesweet: 'Alcremie-Ruby-Swirl',
  berrysweet: 'Alcremie-Mint-Cream',
  cloversweet: 'Alcremie-Matcha-Cream',
  starsweet: 'Alcremie-Lemon-Cream',
  flowersweet: 'Alcremie-Caramel-Swirl',
  ribbonsweet: 'Alcremie'
}
const MILCERY_RARE_CREAMS = ['Alcremie-Salted-Cream', 'Alcremie-Rainbow-Swirl']
const MILCERY_RARE_CREAM_CHANCE = 0.1

/** The cream a Sweet evolution actually ends up with: its own, or (rarely) a rare one. */
export function rollMilceryCream(target: string): string {
  if (!Object.values(MILCERY_SWEET_FORMS).includes(target)) return target
  return Math.random() < MILCERY_RARE_CREAM_CHANCE
    ? MILCERY_RARE_CREAMS[Math.floor(Math.random() * MILCERY_RARE_CREAMS.length)]
    : target
}

// Evolving into plain Alcremie: one option per Sweet, each into that Sweet's cream.
function expandAlcremie(evoName: string): { species: string; items: string[] | null }[] | null {
  if (evoName !== 'Alcremie') return null
  return Object.entries(MILCERY_SWEET_FORMS).map(([sweet, form]) => ({ species: form, items: [sweet] }))
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

// A form with a Pokedex entry of its own: regional forms (Alolan Ninetales), Rotom's
// appliances, Therian formes, gendered forms (Meowstic-F)... - but not a battle-only
// forme (a Mega counts as its base), a cosmetic one, or one set by a held item (Arceus's
// types, Silvally's, Genesect's drives).
function isDexForm(s: ReturnType<typeof Dex.species.get>): boolean {
  return (
    s.exists &&
    s.num > 0 &&
    !!s.forme &&
    !s.battleOnly &&
    !s.requiredItem &&
    !(s.requiredItems && s.requiredItems.length > 0) &&
    // Alcremie's creams are cosmetic in the games' data, but each is collected here.
    (!s.isCosmeticForme || s.baseSpecies === 'Alcremie') &&
    s.forme !== 'Gmax' &&
    !s.forme.includes('Totem') &&
    (!s.isNonstandard || s.isNonstandard === 'Past')
  )
}

/** The Pokedex entry a Pokemon counts as: its own form if that has an entry, otherwise its species. */
export function dexFormOf(speciesName: string): string {
  const s = Dex.species.get(speciesName)
  if (!s.exists) return speciesName
  if (isDexForm(s)) return s.name
  // A battle-only forme of a form (Galarian Zen Darmanitan) counts as that form.
  const from = typeof s.battleOnly === 'string' ? Dex.species.get(s.battleOnly) : null
  if (from && isDexForm(from)) return from.name
  return s.baseSpecies
}

/**
 * A Pokemon's evolution line for merging, by Pokedex form: its own form, everything it
 * evolved from (nearest first - Charizard: Charmeleon, Charmander), and the line's first
 * stage. A regional line is its own (Alolan Ninetales from Alolan Vulpix), and a Mega counts
 * as its base form.
 */
export function mergeLineOf(speciesName: string): { form: string; ancestors: string[]; root: string } {
  const form = dexFormOf(speciesName)
  const ancestors: string[] = []
  let species = Dex.species.get(form)
  while (species.exists && species.prevo && ancestors.length < 5) {
    const prevo = dexFormOf(species.prevo)
    ancestors.push(prevo)
    species = Dex.species.get(prevo)
  }
  return { form, ancestors, root: ancestors[ancestors.length - 1] ?? form }
}

let cachedEvolutionItemIds: string[] | null = null

/** A random evolution item the Shop sells (stones, trade items, Sweets...) - for Alchemist. */
export function randomEvolutionItemId(): string | null {
  if (!cachedEvolutionItemIds) {
    const ids = new Set<string>()
    for (const s of Dex.species.all()) {
      if (!s.exists || s.num <= 0) continue
      for (const id of evolutionItemsFor(s) ?? []) ids.add(id)
    }
    const sold = new Set(getShopCatalog().map((i) => i.id))
    cachedEvolutionItemIds = [...ids].filter((id) => sold.has(id)).sort()
  }
  const pool = cachedEvolutionItemIds
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null
}

/** Fully evolved: nothing left to evolve into (a Mega counts as its base form). */
export function isFullyEvolved(speciesName: string): boolean {
  const species = Dex.species.get(dexFormOf(speciesName))
  return !species.exists || species.evos.every((e) => {
    const evo = Dex.species.get(e)
    return !evo.exists || isBattleOnlyForme(evo)
  })
}

/**
 * How much more a merge star is worth to a Pokemon that isn't fully evolved: its strongest
 * final evolution's base stat total against its own, or - when that's more - enough that at
 * 5 stars it matches that evolution's at 2 stars. Same stats (Scyther, Scizor) is a plain star.
 * 1 when fully evolved, or while it holds a working Eviolite (left out for an Everstone-locked
 * one, which the Eviolite does nothing for).
 */
export function mergeGrowthFor(speciesName: string, item?: string): number {
  if (mergeGrowthHolding(2, item) === 1) return 1
  const own = Dex.species.get(dexFormOf(speciesName))
  if (!own.exists) return 1
  const finalOf = (species: typeof own): typeof own => {
    const evos = species.evos.map((e) => Dex.species.get(e)).filter((e) => e.exists && !isBattleOnlyForme(e))
    if (evos.length === 0) return species
    return evos.map(finalOf).reduce((best, e) => (bstOf(e.name) > bstOf(best.name) ? e : best))
  }
  const final = finalOf(own)
  if (final.name === own.name) return 1
  // At least its stat gap to the evolution (Murkrow's 405 against Honchkrow's 505: x1.25)...
  const ratio = bstOf(final.name) / Math.max(1, bstOf(own.name))
  // ...or, if that's more, enough that its 5-star multiplier (1 + 5 x bonus x growth)
  // reaches the evolution's 2-star stats - the big boost for the weakest ones.
  const target = ratio * (1 + 2 * mergeBonusPerStar(speciesRarityTier(final.name)))
  const growth = (target - 1) / (MERGE_GROWTH_STARS * mergeBonusPerStar(speciesRarityTier(own.name)))
  return Math.round(Math.max(1, ratio, growth) * 100) / 100
}

/**
 * The look a Pokemon has, when it's one of a species' cosmetic forms (Minior-Blue,
 * Vivillon-Marine) or the plain look of a species that has them (Minior) - those aren't
 * Pokedex forms, so they're collected on their own. Null for any other species.
 */
export function cosmeticLookOf(speciesName: string): string | null {
  const species = Dex.species.get(speciesName)
  if (!species.exists) return null
  if (species.isCosmeticForme) return species.name
  return species.cosmeticFormes?.length ? species.name : null
}

/**
 * Whether this Pokemon can take that one in: the same form, or one it evolved from
 * (Charizard takes a Charmander, Vaporeon an Eevee) - never its evolution, so a branching
 * line's first stage can't take in its different evolutions (Eevee doesn't eat Jolteon).
 */
export function canMergeInto(keeper: string, fodder: string): boolean {
  const lk = mergeLineOf(keeper)
  const form = mergeLineOf(fodder).form
  return lk.form === form || lk.ancestors.includes(form)
}

let cachedDexForms: Map<number, string[]> | null = null

/** Each Dex number's forms with entries of their own (see isDexForm), in the Dex's order. */
export function nationalDexForms(): Map<number, string[]> {
  if (!cachedDexForms) {
    cachedDexForms = new Map()
    for (const s of Dex.species.all()) {
      if (!isDexForm(s)) continue
      cachedDexForms.set(s.num, [...(cachedDexForms.get(s.num) ?? []), s.name])
    }
  }
  return cachedDexForms
}

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

// Every species a wild roll can bring up: each stage of every line the random sets
// cover, and of every extra line (see wildExtraSpecies), as ids.
let cachedWildLineIds: Set<string> | null = null

function wildLineIds(): Set<string> {
  if (!cachedWildLineIds) {
    const randomSets = require('pokemon-showdown/dist/data/random-battles/gen9/sets.json') as Record<string, unknown>
    const ids = new Set<string>()
    for (const id of [...Object.keys(randomSets), ...wildExtraSpecies().map(toID)]) {
      let species = Dex.species.get(id)
      while (species.exists && !ids.has(species.id)) {
        ids.add(species.id)
        if (!species.prevo) break
        species = Dex.species.get(species.prevo)
      }
    }
    cachedWildLineIds = ids
  }
  return cachedWildLineIds
}

// The wild areas (not Anywhere, nor the Lab) whose type or egg-group filters - or
// exceptions - let a species through, the same ones generateRandomWildMon checks.
function wildAreasFor(species: ReturnType<typeof Dex.species.get>): WildLocationConfig[] {
  const root = evolutionRootId(species.id)
  return WILD_LOCATIONS.filter((location) => {
    if (!location.types) return false
    const isException = location.exceptionBaseSpecies.some((s) => toID(s) === root)
    const typeMatch = species.types.some((t) => location.types!.includes(t))
    const eggGroupMatch = species.eggGroups.some((g) => location.eggGroups?.includes(g))
    return isException || typeMatch || eggGroupMatch
  })
}

/**
 * Whether the DexNav can hunt a species, and if so where and from what wild level: only
 * Pokemon a wild roll could bring up (no legendaries, Paradox, fossils or battle-only
 * forms). Its lowest level is where its evolution stage is reached, raised until the wild
 * level's BST limit (see generateRandomWildMon) lets it through.
 */
export function dexNavHuntInfo(speciesName: string): { locations: WildLocationId[]; minLevel: number } | null {
  const species = Dex.species.get(speciesName)
  if (!species.exists || isLegendaryClass(species) || species.tags.some((tag) => LEGENDARY_TAGS.has(tag))) return null
  if (isBattleOnlyForme(species) || isParadoxSpecies(species) || isFossilLine(species.id)) return null
  if (!wildLineIds().has(species.id)) return null
  const bstLevel = Math.ceil((bstOf(species.name) - 300) / 4)
  const minLevel = Math.max(1, minLevelForSpecies(species.name), stageReachLevel(species), bstLevel)
  return { locations: wildAreasFor(species).map((l) => l.id), minLevel }
}

/**
 * The DexNav's hunted Pokemon, met at a usual wild level for this cap - or, when its
 * evolution stage needs more, the lowest level it could be reached at (never past the
 * cap). Null when it can't turn up at this cap at all. Its shiny roll gets the chain's
 * multiplier on top of everything else.
 */
export function generateHuntedMon(speciesName: string, levelCap: number, shinyMultiplier: number): PokemonSet | null {
  const info = dexNavHuntInfo(speciesName)
  if (!info || info.minLevel > levelCap) return null
  const min = Math.max(1, levelCap - 14)
  const max = Math.max(min, levelCap - 4)
  const rolled = min + Math.floor(Math.random() * (max - min + 1))
  const level = Math.min(levelCap, Math.max(rolled, info.minLevel))
  // Hunting a Pokemon by name meets any of its wild forms (a Wormadam cloak, a Burmy
  // cloak...) - a form hunted by name stays that form.
  const named = Dex.species.get(speciesName)
  const species = named.forme ? named.name : withRandomCosmeticForm(withRandomWildForm(named.name))
  return {
    ...buildBasicSet(species, level),
    shiny: rollWildShiny(false, shinyMultiplier),
    nature: randomNatureName()
  }
}

/**
 * Where to look for a Pokedex entry, as short hints: the wild locations whose type or
 * egg-group filters let it through (the same ones generateRandomWildMon uses), the Lab,
 * Max Raids, fossil restoring - or, when none of those has it, evolving or a form change.
 */
export function pokedexLocationHints(speciesName: string): PokedexHint[] {
  const species = Dex.species.get(speciesName)
  if (!species.exists) return []
  if (isFossilLine(species.id)) return [{ icon: '🦴', label: 'Restore a fossil' }]
  const hints: PokedexHint[] = []
  const legendary = isLegendaryClass(species)
  const starter = isStarterLine(species.id)
  const pools = labPools()
  const inLab =
    REGIONAL_STARTER_SPECIES.includes(species.name) ||
    [...pools.paradox, ...pools.ultraBeasts, ...pools.mythicals].includes(species.name)
  if (inLab) hints.push({ icon: '🧪', label: 'Lab' })
  if (!legendary && !isBattleOnlyForme(species) && wildLineIds().has(species.id)) {
    for (const location of wildAreasFor(species)) {
      hints.push({ icon: location.icon, label: starter ? `${location.label} (rare)` : location.label })
    }
  }
  if (legendary && species.evos.length === 0 && isPlainSpecies(species)) {
    hints.push({ icon: '⭐', label: 'Max Raids' })
  }
  const formChange = formChangeFor(species.name)
  if (formChange && species.forme) hints.push({ icon: '🔄', label: `Form change from ${species.baseSpecies}` })
  if (hints.length === 0 && species.prevo) hints.push({ icon: '⤴️', label: `Evolve ${Dex.species.get(species.prevo).name}` })
  if (hints.length === 0 && !species.prevo && isPlainSpecies(species)) {
    hints.push(legendary ? { icon: '🎁', label: 'Random Legendary' } : { icon: '🎁', label: 'Random Pokémon' })
  }
  return hints
}

/**
 * What the bag's Quick sell picks an item up as: a sell-only item (Bottle Caps...), a
 * berry (but not the ones worth holding - see QUICK_SELL_KEPT_BERRY_IDS), or one of the
 * type-changing items only one Pokemon can use (a Memory for Silvally, a Plate for Arceus,
 * a Drive for Genesect) - with that Pokemon, since those are kept while one is owned.
 */
export function quickSellKind(
  itemId: string
): { kind: 'sellOnly' } | { kind: 'berry' } | { kind: 'forPokemon'; species: string } | null {
  if (SELL_ONLY_ITEM_IDS.has(itemId)) return { kind: 'sellOnly' }
  const item = Dex.items.get(itemId)
  if (!item.exists) return null
  if (item.isBerry) return QUICK_SELL_KEPT_BERRY_IDS.has(item.id) ? null : { kind: 'berry' }
  if (item.onMemory) return { kind: 'forPokemon', species: 'Silvally' }
  // The type Z-Crystals carry onPlate too - only the real Plates count.
  if (item.onPlate && !item.zMove) return { kind: 'forPokemon', species: 'Arceus' }
  if (item.onDrive) return { kind: 'forPokemon', species: 'Genesect' }
  return null
}

/** The species a forme belongs to ("Arceus-Fire" -> "Arceus"). */
export function baseSpeciesOf(name: string): string {
  return Dex.species.get(name).baseSpecies
}

/** A species' proper name ("garchomp" -> "Garchomp"), or null if there's no such Pokemon. */
export function canonicalSpeciesName(name: string): string | null {
  const species = Dex.species.get(name)
  return species.exists && species.num > 0 ? species.name : null
}

/** The Mega Stones that Mega Evolve this exact species (Charizard: X and Y), by item id. */
export function megaStonesFor(speciesName: string): string[] {
  const name = Dex.species.get(speciesName).name
  return Dex.items
    .all()
    .filter((item) => {
      const stone = item.megaStone as Record<string, string> | string | undefined
      if (!stone || item.isNonstandard === 'CAP') return false
      return typeof stone === 'string' ? !!item.itemUser?.includes(name) : Object.keys(stone).includes(name)
    })
    .map((item) => item.id)
}

/**
 * The items made for this species specifically: its Mega Stones, plus anything else
 * the Dex names it (or another form of it) as the user of - Rusted Sword/Shield, Light
 * Ball, Thick Club, Leek, Soul Dew, the Adamant/Lustrous/Griseous orbs, Red/Blue Orb,
 * Ogerpon's masks, Genesect's drives, Silvally's memories, species Z-Crystals...
 * Dialga, Palkia and Giratina get both of their items - the orb, and the one that turns
 * them into their Origin Forme (Adamant Crystal, Lustrous Globe, Griseous Core; see
 * heldItemForme) - though a run only offers one of each pair (see ALTERNATIVE_ITEMS).
 */
export function signatureItemsFor(speciesName: string): string[] {
  const self = Dex.species.get(speciesName)
  const base = self.baseSpecies
  const forThisLine = Dex.items
    .all()
    .filter(
      (item) =>
        !item.megaStone &&
        item.isNonstandard !== 'CAP' &&
        !!item.itemUser?.some((user) => {
          const userSpecies = Dex.species.get(user)
          return userSpecies.name === self.name || userSpecies.baseSpecies === base
        })
    )
    .map((item) => item.id)
  return [...new Set([...megaStonesFor(speciesName), ...forThisLine])]
}

/** Every ability there is (not the made-up CAP ones), by name - for the boss editor. */
export function listAllAbilities(): { id: string; name: string }[] {
  return Dex.abilities
    .all()
    .filter((a) => a.exists && a.num > 0 && a.isNonstandard !== 'CAP')
    .map((a) => ({ id: a.id, name: a.name }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** A species' normal and hidden abilities (not a special one like Battle Bond), for an Ability Capsule. */
export function speciesAbilityChoices(speciesName: string): { id: string; name: string; description: string }[] {
  const species = Dex.species.get(speciesName)
  const seen = new Set<string>()
  return [species.abilities[0], species.abilities[1], species.abilities.H].flatMap((name) => {
    if (!name || seen.has(toID(name))) return []
    seen.add(toID(name))
    const info = abilityInfo(name)
    return info ? [info] : []
  })
}

/** An ability's name and short description, for the New Ability choices. */
export function abilityInfo(id: string): { id: string; name: string; description: string } | null {
  const ability = Dex.abilities.get(id)
  if (!ability.exists) return null
  return { id: ability.id, name: ability.name, description: ability.shortDesc || ability.desc || '' }
}

/** An item made for particular species: a Mega Stone, or one the Dex names users for. */
export function isSignatureItem(itemId: string): boolean {
  const item = Dex.items.get(itemId)
  return !!item.megaStone || (item.itemUser?.length ?? 0) > 0
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
    const sweets = expandAlcremie(evoSpecies.name)
    if (sweets) {
      for (const sweet of sweets) options.push({ species: sweet.species, requiredItems: sweet.items })
      continue
    }
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

/**
 * Whether this Pokemon has an evolution that takes max friendship here (see
 * evolutionOptionsFor) - wild ones drop Friendship Petals.
 */
export function hasFriendshipEvolution(speciesName: string): boolean {
  return Dex.species
    .get(speciesName)
    .evos.map((name) => Dex.species.get(name))
    .some(
      (evo) =>
        evo.exists &&
        !isBattleOnlyForme(evo) &&
        !expandAlcremie(evo.name) &&
        !evolutionItemsFor(evo) &&
        evo.evoType !== undefined &&
        evo.evoType !== 'useItem' &&
        evo.evoType !== 'levelHold'
    )
}

/** The level a level-up evolution happens at (null for any other kind). */
export function evolutionLevelOf(speciesName: string): number | null {
  const species = Dex.species.get(speciesName)
  return species.exists && species.evoType === undefined && !evolutionItemsFor(species) ? (species.evoLevel ?? 1) : null
}

/**
 * Every Pokemon this one can evolve into, ready or not, with what it takes - "Level 36",
 * "Use a Thunder Stone", "Max friendship (120/255)" - by the same rules as
 * evolutionOptionsFor (which says which of these it can do right now).
 */
export function evolutionPathsFor(set: PokemonSet): { species: string; method: string }[] {
  const itemNames = new Map(getEditorOptions().items.map((i) => [i.id, i.name]))
  return Dex.species
    .get(set.species)
    .evos.map((name) => Dex.species.get(name))
    .filter((evo) => evo.exists && !isBattleOnlyForme(evo))
    // Alcremie: one path per Sweet, each to its own cream.
    .flatMap((evo) => (expandAlcremie(evo.name) ?? [null]).map((sweet) => ({ evo, sweet })))
    .map(({ evo, sweet }) => {
      if (sweet) return { species: sweet.species, method: `Use a ${itemNames.get(sweet.items![0]) ?? sweet.items![0]}` }
      const requiredItems = evolutionItemsFor(evo)
      let method: string
      if (requiredItems) method = `Use a ${requiredItems.map((id) => itemNames.get(id) ?? id).join(' or ')}`
      else if (evo.evoType === undefined) method = `Level ${evo.evoLevel ?? 1}`
      else if (evo.evoType === 'useItem' || evo.evoType === 'levelHold') method = 'Any time'
      else method = `Max friendship (${set.happiness ?? MAX_HAPPINESS}/${MAX_HAPPINESS})`
      return { species: evo.name, method }
    })
}

/**
 * Roguelite: what a run Pokemon can evolve into. There's no bag in a run, so an
 * evolution needs no item, trade or friendship - only the level the wild generator
 * would plausibly meet that stage at (its own level for a level-up evolution; 30, or
 * 10 after the previous stage, for anything else - see stageReachLevel).
 */
export function runEvolutionOptions(set: PokemonSet): string[] {
  return Dex.species
    .get(set.species)
    .evos.map((name) => Dex.species.get(name))
    .filter(
      (evo) =>
        evo.exists &&
        !isBattleOnlyForme(evo) &&
        stageReachLevel(evo) <= set.level &&
        // A one-gender evolution (Gallade, Froslass...) needs a Pokemon of that gender.
        (!evo.gender || !set.gender || evo.gender === set.gender)
    )
    .map((evo) => evo.name)
}

/**
 * The other forms a Pokemon can change into with a form-change key item (see FORM_CHANGES)
 * and that item - null if it has none.
 */
export function formChangeFor(speciesName: string): { forms: string[]; itemId: string } | null {
  const name = Dex.species.get(speciesName).name
  const group = FORM_CHANGES.find((g) => g.forms.includes(name))
  return group ? { forms: group.forms.filter((form) => form !== name), itemId: group.itemId } : null
}

/**
 * A Pokemon in the form its held item gives it: Arceus holding a Flame Plate is
 * Arceus-Fire, Giratina with the Griseous Core its Origin Forme, Ogerpon in a mask... and
 * back to the plain form when it no longer holds one. The battle engine doesn't do this
 * itself - an Arceus sent in as "Arceus" with a plate would stay Normal-type.
 */
export function heldItemForme<T extends PokemonSet>(set: T): T {
  const species = Dex.species.get(set.species)
  if (!species.exists) return set
  // A Greninja with Battle Bond goes in as Greninja-Bond, the form the ability needs to
  // turn into Ash-Greninja (one stored as Ash-Greninja starts back at Greninja-Bond too).
  if ((species.name === 'Greninja' || species.name === 'Greninja-Ash') && toID(set.ability ?? '') === 'battlebond') {
    const wasDefaultName = !set.name || set.name === set.species
    return { ...set, species: 'Greninja-Bond', name: wasDefaultName ? 'Greninja' : set.name }
  }
  const base = Dex.species.get(species.baseSpecies)
  const itemFormes = [base.name, ...(base.otherFormes ?? [])]
    .map((name) => Dex.species.get(name))
    .filter((f) => f.exists && !f.battleOnly && (f.requiredItem || (f.requiredItems?.length ?? 0) > 0))
  if (itemFormes.length === 0) return set
  const item = toID(set.item ?? '')
  const matched = item
    ? itemFormes.find((f) => [f.requiredItem, ...(f.requiredItems ?? [])].some((r) => r && toID(r) === item))
    : undefined
  let target = species.name
  if (matched) target = matched.name
  else if (itemFormes.some((f) => f.name === species.name)) target = base.name
  if (target === species.name) return set
  const wasDefaultName = !set.name || set.name === set.species
  return { ...set, species: target, name: wasDefaultName ? target : set.name }
}

/** A Pokemon changed into another form, taking a whole set (moves, ability, nature, EVs...) for it. */
export function formChangedSet(set: PokemonSet, form: string, auto: AutoSetResult): PokemonSet {
  const species = Dex.species.get(form)
  const wasDefaultName = set.name === set.species || set.species.startsWith(`${set.name}-`)
  return {
    ...set,
    species: species.name,
    name: wasDefaultName ? species.name : set.name,
    moves: auto.moves,
    ability: auto.ability ?? species.abilities[0],
    nature: auto.nature,
    evs: auto.evs,
    ivs: auto.ivs,
    teraType: auto.teraType ?? set.teraType
  }
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

export type ScreenId = 'reflect' | 'lightscreen' | 'auroraveil'

// What a setup move does for its user: the stat stages it gives itself (Swords Dance
// +2 Attack; Shell Smash's defence drops come through as negatives), or the screen it
// puts up over its side.
export interface MoveSetupData {
  boosts: Partial<Record<string, number>> | null
  screen: ScreenId | null
}

const SCREEN_IDS = new Set<string>(['reflect', 'lightscreen', 'auroraveil'])

export function getMoveSetupData(id: string): MoveSetupData | null {
  const move = Dex.moves.get(id)
  if (!move.exists || move.category !== 'Status') return null
  if (SCREEN_IDS.has(move.id)) return { boosts: null, screen: move.id as ScreenId }
  // Belly Drum maxes Attack in its own code rather than through a boosts entry.
  if (move.id === 'bellydrum') return { boosts: { atk: 6 }, screen: null }
  if (move.target === 'self' && move.boosts) return { boosts: { ...move.boosts }, screen: null }
  return null
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
    // Future Sight / Doom Desire skip immunity only when used - the hit itself still respects it.
    const ignores = move.flags.futuremove ? false : move.ignoreImmunity
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

// The power the sim's rule would give these moves next use, without running the rule
// (which changes the Pokemon's volatiles as it goes). null for any other move.
function sideEffectFreePower(moveId: string, basePower: number, source: Pokemon): number | null {
  if (moveId === 'furycutter') {
    // Each use in a row doubles it (up to 4x): the next one is double the last.
    const last = (source.volatiles['furycutter'] as { multiplier?: number } | undefined)?.multiplier
    const multiplier = last ? Math.min(last * 2, 4) : 1
    return Math.min(basePower * multiplier, 160)
  }
  if (moveId === 'rollout' || moveId === 'iceball') {
    const rolling = source.volatiles[moveId] as { hitCount?: number; contactHitCount?: number } | undefined
    let power = basePower
    if (rolling?.hitCount) power *= 2 ** (rolling.contactHitCount ?? 0)
    if (source.volatiles['defensecurl']) power *= 2
    return power
  }
  return null
}

// Moves that hit a Dynamaxed Pokemon twice as hard. Showdown applies this (in the Dynamax
// condition) but its descriptions don't say so - MOVE_DESCRIPTIONS below does.
const DYNAMAX_BANE_MOVES = new Set(['behemothblade', 'behemothbash', 'dynamaxcannon'])

// Descriptions to show in place of Showdown's (which leave something out).
const MOVE_DESCRIPTIONS: Record<string, string> = {
  behemothblade: 'Deals double damage to a Dynamaxed Pokémon.',
  behemothbash: 'Deals double damage to a Dynamaxed Pokémon.',
  dynamaxcannon: 'Deals double damage to a Dynamaxed Pokémon.'
}

/** A move's short description, with this game's corrections. */
export function moveDescription(move: { id: string; shortDesc?: string; desc?: string }): string {
  return MOVE_DESCRIPTIONS[move.id] ?? (move.shortDesc || move.desc || '')
}

// The flags that change a move's animation (see moveAnimations.ts in the renderer).
const ANIM_FLAGS = ['punch', 'bite', 'slicing', 'sound', 'wind', 'pulse', 'bullet'] as const

/** What a move's animation needs beyond its basic data: its stat change direction and its flags. */
function moveAnimExtras(move: ReturnType<typeof Dex.moves.get>): Pick<MoveInfo, 'boostDir' | 'animFlags'> {
  const flags = move.flags as Record<string, number | undefined>
  const animFlags = ANIM_FLAGS.filter((f) => flags[f])
  let boostDir: MoveInfo['boostDir']
  if (move.category === 'Status') {
    // A move's own boosts land on whoever it's aimed at (itself for Swords Dance, the
    // foe for Growl); self.boosts always land on the user. Added up, the sign says
    // which way the arrows go.
    const total = [move.boosts, move.self?.boosts]
      .flatMap((b) => Object.values(b ?? {}) as number[])
      .reduce((sum, v) => sum + v, 0)
    if (total > 0) boostDir = 'up'
    else if (total < 0) boostDir = 'down'
  }
  return { boostDir, animFlags }
}

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

  // Final Gambit's damage rule faints its user as it works the number out - asking it
  // here would knock out the real Pokemon on the field. It hits for the user's HP.
  if (base.id === 'finalgambit') return { ...NO_POWER, fixedDamage: source.hp > 0 ? source.hp : null, dynamic: true }
  // These power rules move the real Pokemon's counters along as they work the power out
  // (Fury Cutter's multiplier, Rollout's hit count) - so they're worked out here instead.
  const ownPower = sideEffectFreePower(base.id, base.basePower, source)
  if (ownPower !== null) {
    return { ...NO_POWER, basePower: ownPower, dynamic: ownPower !== base.basePower }
  }

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
  let dynamaxBonus = false
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
    if (power > 0 && target && DYNAMAX_BANE_MOVES.has(move.id) && target.volatiles['dynamax']) {
      power *= 2
      dynamaxBonus = true
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
    dynamic: !!move.basePowerCallback || values.some((v) => v !== move.basePower),
    dynamaxBonus
  }
}

// What a defender's ability does to a move of a type, as a multiplier on its
// effectiveness (0 = immune) - the abilities that change how well a move lands, not
// the ones that merely react to it.
const DEFENDER_TYPE_ABILITIES: Record<string, Record<string, number>> = {
  levitate: { Ground: 0 },
  eartheater: { Ground: 0 },
  flashfire: { Fire: 0 },
  wellbakedbody: { Fire: 0 },
  waterabsorb: { Water: 0 },
  stormdrain: { Water: 0 },
  dryskin: { Water: 0, Fire: 1.25 },
  voltabsorb: { Electric: 0 },
  lightningrod: { Electric: 0 },
  motordrive: { Electric: 0 },
  sapsipper: { Grass: 0 },
  thickfat: { Fire: 0.5, Ice: 0.5 },
  heatproof: { Fire: 0.5 },
  waterbubble: { Fire: 0.5 },
  purifyingsalt: { Ghost: 0.5 },
  fluffy: { Fire: 2 }
}
// Attackers whose ability gets past the defender's (Mold Breaker and its kin).
const ABILITY_IGNORING_ABILITIES = new Set(['moldbreaker', 'teravolt', 'turboblaze', 'myceliummight'])

/**
 * How well a move would land on a target right now, as the battle screen shows it (a
 * multiplier; 0 = no effect), or null where that doesn't apply (status moves, fixed
 * damage). The move's type after any change it makes to itself (Weather Ball, Ivy
 * Cudgel...), the target's current types, and both Pokemon's abilities: the target's
 * immunities and damage-changing abilities (Levitate, Flash Fire, Thick Fat, Filter,
 * Wonder Guard...) - unless Mold Breaker or the move gets past them - and the
 * attacker's Scrappy / Mind's Eye and Tinted Lens.
 */
/**
 * A move as it would be used right now, with its type worked out the way the sim does it:
 * the move's own rule (Judgment's plate, Tera Blast's Tera type, Weather Ball's weather,
 * Revelation Dance, Ivy Cudgel's mask...) and then its user's ability (Pixilate,
 * Aerilate, Refrigerate, Galvanize, Normalize, Liquid Voice).
 */
function typedActiveMove(battle: Battle, source: Pokemon, target: Pokemon | null, moveId: string): ReturnType<Battle['dex']['getActiveMove']> {
  const move = battle.dex.getActiveMove(moveId)
  try {
    move.onModifyType?.call(battle, move, source, target as Pokemon)
  } catch {
    // needs battle context the preview can't give - its printed type stands
  }
  // (Typed loosely: the ability's handler isn't in its declared type.)
  const ability = source.getAbility() as unknown as { onModifyType?: unknown }
  if (!source.ignoringAbility() && ability.onModifyType) {
    try {
      ;(ability.onModifyType as (this: Battle, m: typeof move, s: Pokemon, t: Pokemon) => void).call(
        battle,
        move,
        source,
        target as Pokemon
      )
    } catch {
      // the same
    }
  }
  return move
}

/** A move's type right now (see typedActiveMove). */
export function liveMoveType(battle: Battle, source: Pokemon, target: Pokemon | null, moveId: string): string {
  return typedActiveMove(battle, source, target, moveId).type
}

export function moveTypeEffectiveness(battle: Battle, source: Pokemon, target: Pokemon, moveId: string): number | null {
  const base = battle.dex.moves.get(moveId)
  if (!base.exists || base.category === 'Status') return null
  const move = typedActiveMove(battle, source, target, base.id)
  const sourceAbility = source.ignoringAbility() ? '' : toID(source.ability)
  const targetAbility =
    target.ignoringAbility() || move.ignoreAbility || ABILITY_IGNORING_ABILITIES.has(sourceAbility)
      ? ''
      : toID(target.ability)

  const targetTypes = target.getTypes()
  // Future Sight / Doom Desire skip immunity only when used - the hit two turns later
  // still respects it (Future Sight does nothing to a Dark type).
  const ignores = move.flags.futuremove ? false : move.ignoreImmunity
  const ignoresType = ignores === true || (!!ignores && typeof ignores === 'object' && !!ignores[move.type])
  // Scrappy / Mind's Eye: Normal and Fighting moves hit Ghost types.
  const hitsGhosts = ['scrappy', 'mindseye'].includes(sourceAbility) && ['Normal', 'Fighting'].includes(move.type)
  const immunityTypes = hitsGhosts ? targetTypes.filter((t) => t !== 'Ghost') : targetTypes
  if (!ignoresType && !battle.dex.getImmunity(move.type, immunityTypes)) return 0
  // Off the ground some other way - an Air Balloon, Magnet Rise, Telekinesis (Levitate
  // is the ability table's, so Mold Breaker can get past it).
  if (move.type === 'Ground' && !ignoresType && target.isGrounded() === false) return 0
  // Moves an ability shuts out completely by what they are, not their type.
  if (targetAbility === 'bulletproof' && move.flags.bullet) return 0
  if (targetAbility === 'soundproof' && move.flags.sound) return 0
  if (targetAbility === 'windrider' && move.flags.wind) return 0
  const typeAbility = DEFENDER_TYPE_ABILITIES[targetAbility]?.[move.type]
  if (typeAbility === 0 && !(move.type === 'Ground' && ignoresType)) return 0
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
  let multiplier = Math.pow(2, typeMod)

  // Wonder Guard: only super effective moves get through.
  if (targetAbility === 'wonderguard' && multiplier <= 1) return 0
  // Tera Shell: anything at all is not very effective while it's at full HP.
  if (targetAbility === 'terashell' && target.hp >= target.maxhp && multiplier > 0) multiplier = 0.5
  if (typeAbility !== undefined && typeAbility > 0) multiplier *= typeAbility
  if (['filter', 'solidrock', 'prismarmor'].includes(targetAbility) && multiplier > 1) multiplier *= 0.75
  if (sourceAbility === 'tintedlens' && multiplier > 0 && multiplier < 1) multiplier *= 2
  return multiplier
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
    description: moveDescription(move),
    target: move.target,
    contact: !!move.flags?.contact,
    multihit: !!move.multihit,
    priority: move.priority,
    ...moveAnimExtras(move)
  }
}

/**
 * Every move any Pokemon learns by TM, in any generation (each gets a TM - see tm-store),
 * with how widely the random battle sets run it: the more Pokemon's sets use it, the
 * rarer its TM.
 */
export function tmMoveList(): { id: string; name: string; type: string; category: 'Physical' | 'Special' | 'Status'; usage: number }[] {
  const ids = new Set<string>(['terablast'])
  const learnsets = Dex.data.Learnsets as Record<string, { learnset?: Record<string, string[]> }>
  for (const speciesId in learnsets) {
    const learnset = learnsets[speciesId].learnset
    if (!learnset) continue
    for (const moveId in learnset) if (learnset[moveId].some((s) => s[1] === 'M')) ids.add(moveId)
  }
  const usage = new Map<string, number>()
  for (const entry of Object.values(getRandbatsSets())) {
    for (const set of entry.sets ?? []) {
      for (const moveName of set.movepool) usage.set(toID(moveName), (usage.get(toID(moveName)) ?? 0) + 1)
    }
  }
  return [...ids]
    .map((id) => Dex.moves.get(id))
    .filter((m) => m.exists && !m.isZ && !m.isMax)
    .map((m) => ({ id: m.id, name: m.name, type: m.type, category: m.category, usage: usage.get(m.id) ?? 0 }))
}

/**
 * The moves this species learns only by TM - no level-up, egg, tutor or event source in
 * any generation (see learnableMoveIds). These need the player to own the TM (tm-store);
 * a move it also learns some other way never does.
 */
export function tmOnlyMoveIds(speciesName: string): Set<string> {
  const species = Dex.species.get(speciesName)
  const merged = new Map<string, string[]>()
  for (const moveId of EXTRA_LEARNABLE[species.id] ?? []) merged.set(moveId, ['9L1'])
  for (const { learnset } of Dex.species.getFullLearnset(species.id)) {
    for (const moveId in learnset) merged.set(moveId, [...(merged.get(moveId) ?? []), ...learnset[moveId]])
  }
  // The Tera Blast learnableMoveIds hands to anything cut from Scarlet/Violet that takes TMs.
  if (species.isNonstandard === 'Past' && !merged.has('terablast') && [...merged.values()].some((s) => s.some((x) => x[1] === 'M'))) {
    merged.set('terablast', ['9M'])
  }
  const ids = new Set<string>()
  for (const [moveId, sources] of merged) if (sources.length > 0 && sources.every((s) => s[1] === 'M')) ids.add(moveId)
  return ids
}
