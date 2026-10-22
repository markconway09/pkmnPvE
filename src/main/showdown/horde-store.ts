import { randomUUID, readText, writeText } from '../platform'
import { playerPathFor } from './save-paths'
import { onPlayerChange } from './player-session'
import { sim } from './ps'
import { addMoney, getMoney, spendMoney } from './money-store'
import { countAchievement, recordAchievementBest } from './achievement-progress'
import { hasTitle } from './title-perks'
import { recordMission } from './mission-store'
import { addMonOfSpecies, hasRegisteredSpecies } from './box-store'
import {
  CENTURION_MONEY_MULTIPLIER,
  MASTER_OF_ELEMENTS_OTHER_TYPE_SHARE,
  SCHOOLING_EXTRA_REROLLS,
  SHAPESHIFTER_MOVE_DELETES
} from '../../shared/titles'
import {
  bstOf,
  generateRandomWildMon,
  getTypeEffectivenessMultiplier,
  megaStonesFor,
  pickRandomUnevolvedAnySpecies,
  rollWildShiny,
  speciesHeightM,
  speciesRarityTier
} from './sim-access'
import { WILD_LOCATIONS, autoCompanionSize, toSpriteId, type WildLocationConfig, type WildLocationId } from '../../shared/battle-types'
import {
  HORDE_EVO_LEVELS,
  HORDE_EXPLODER_LINES,
  HORDE_DURATION_MS,
  HORDE_HELD_IDS,
  HORDE_HISTORY_RUNS,
  HORDE_MAX_TOMES,
  HORDE_LINEUP_KEEP_MS,
  HORDE_LINEUP_LEGENDARY_CHANCE,
  HORDE_LINEUP_REROLL_COST,
  HORDE_STARTER_CHOICES,
  HORDE_STATS,
  HORDE_TOP_RUNS,
  HORDE_UPGRADES,
  hordeBaseStats,
  hordeFoeLevel,
  hordeMoney,
  HORDE_MOVE_DEFS,
  HORDE_DUOS,
  hordeMoveCatalog,
  hordeMoveOf,
  hordeNoUpgrades,
  hordeUpgradeCost,
  type HordeDuoId,
  type HordeEvolution,
  type HordeHeld,
  type HordeHistoryEntry,
  type HordeLearnSource,
  type HordeMove,
  type HordeOffer,
  type HordeRecord,
  type HordeResult,
  type HordeReward,
  type HordeRunMove,
  type HordeSave,
  type HordeSavedRun,
  type HordeSetup,
  type HordeSpecies,
  type HordeStarter,
  type HordeStat,
  type HordeTome,
  type HordeUpgradeId,
  type HordeUpgrades
} from '../../shared/horde'
import { t } from '../i18n'

/**
 * Horde mode (see shared/horde.ts): the run is played out in the window, in real time -
 * this offers the Pokemon to pick from, builds what the run needs (the moves, the wild
 * Pokemon the waves bring) and pays for how it went, within what the clock allows. The
 * best runs are kept per player.
 */

const { Dex } = sim

interface StoredHorde {
  // The best runs, best first.
  top: HordeRecord[]
  runs: number
  // The ranks of each upgrade bought on the Horde page.
  upgrades: HordeUpgrades
  // A run saved to carry on later: the arena's save, how it stood when saved (already held
  // to what the clock allowed), and its lead's forms and shininess.
  saved: StoredSave | null
  // Every finished run (up to HORDE_HISTORY_RUNS), newest first.
  history: HordeHistoryEntry[]
  // The Pokemon offered to pick from, kept until a run counts (see payOut) - closing the
  // picker or the game doesn't deal a new lot.
  lineup: StoredLineup | null
  // Every duo synergy that's been on in a finished run (the Master of Elements achievement wants them all).
  duosUsed: HordeDuoId[]
}

// The area and the Pokemon offered, and each one's evolutions and Mega forms, rolled with
// the offer so the picker can show what it becomes and the run then follows that same line.
interface StoredLineup {
  offer: HordeOffer
  lines: Record<string, { evolutions: HordeEvolution[]; megas: Record<string, HordeSpecies> }>
}

interface StoredSave {
  save: HordeSave
  result: HordeResult
  species: string
  forms: string[]
  shiny: boolean
}

// A record from before sprites were kept gets its species' sprite (not shiny).
function withSprite(record: HordeRecord): HordeRecord {
  return { ...record, spriteId: record.spriteId || toSpriteId(record.species), shiny: !!record.shiny }
}

// What the old 4th-choice upgrade cost.
const HORDE_CHOICES_REFUND = 300000

function load(): StoredHorde {
  const path = playerPathFor('horde.json')
  try {
    // Saves from before the best 3 were kept hold just the one best run.
    const parsed = JSON.parse(readText(path)) as Partial<StoredHorde> & { best?: HordeRecord | null }
    const top = parsed.top ?? (parsed.best ? [parsed.best] : [])
    // Walk speed ranks bought before it was folded into Speed carry over as Speed ranks.
    // The old 4th-choice upgrade is gone: whoever bought it gets its price back, once.
    const { walk, choices, ...upgrades } = (parsed.upgrades ?? {}) as Partial<HordeUpgrades> & { walk?: number; choices?: number }
    const loaded: StoredHorde = {
      top: top.map(withSprite),
      runs: parsed.runs ?? 0,
      upgrades: { ...hordeNoUpgrades(), ...upgrades, spe: upgrades.spe ?? walk ?? 0 },
      saved: parsed.saved ?? null,
      history: parsed.history ?? [],
      lineup: parsed.lineup ?? null,
      duosUsed: parsed.duosUsed ?? []
    }
    if (choices) {
      addMoney(HORDE_CHOICES_REFUND)
      writeText(path, JSON.stringify(loaded))
    }
    return loaded
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code
    if (code !== 'ENOENT') console.error('[horde-store] failed to load horde.json:', e)
    return { top: [], runs: 0, upgrades: hordeNoUpgrades(), saved: null, history: [], lineup: null, duosUsed: [] }
  }
}

let state: StoredHorde | null = null
// The run being played: only its own token can be paid for, once.
// Its lead, every form it can evolve into on the way, whether it's shiny, whether any of
// those forms can Mega Evolve, and the area it's in.
type ActiveRun = {
  token: string
  startedAt: number
  species: string
  forms: string[]
  shiny: boolean
  canMega: boolean
  location: WildLocationId
}
let active: ActiveRun | null = null

onPlayerChange(() => {
  state = null
  active = null
})

function getState(): StoredHorde {
  if (!state) state = load()
  return state
}

function persist(): void {
  writeText(playerPathFor('horde.json'), JSON.stringify(getState()))
}

function speciesInfo(name: string): HordeSpecies {
  const dex = Dex.species.get(name)
  return {
    species: dex.name,
    spriteId: toSpriteId(dex.name),
    size: autoCompanionSize(speciesHeightM(dex.name)),
    types: [...dex.types],
    baseStats: hordeBaseStats(dex.baseStats),
    ...(dex.canGigantamax ? { canGmax: true } : {}),
    ...(canExplode(dex.name) ? { explodes: true } : {}),
    ...(dex.baseStats.spa > dex.baseStats.atk ? { special: true } : {})
  }
}

// The areas' exploders, whether or not they can learn Explosion (Pyukumuku can't).
const EXPLODER_SPECIES = new Set(Object.values(HORDE_EXPLODER_LINES).flatMap((lines) => lines.flat()))

/** Whether a Pokemon can learn Explosion or Self-Destruct (in any game, its earlier stages' moves too), or is an area's exploder. */
function canExplode(name: string): boolean {
  if (EXPLODER_SPECIES.has(name)) return true
  const learnsets = Dex.data.Learnsets as Record<string, { learnset?: Record<string, unknown> } | undefined>
  const seen = new Set<string>()
  let sp = Dex.species.get(name)
  while (sp.exists && !seen.has(sp.id)) {
    seen.add(sp.id)
    for (const id of [sp.id, Dex.species.get(sp.changesFrom || sp.baseSpecies).id]) {
      const moves = learnsets[id]?.learnset
      if (moves?.explosion || moves?.selfdestruct) return true
    }
    if (!sp.prevo) break
    sp = Dex.species.get(sp.prevo)
  }
  return false
}

/** Every move in the list. */
function moveCatalog(): HordeMove[] {
  return hordeMoveCatalog()
}

// Forms that only change in battle but count as a stage here: Wishiwashi schools up as if
// evolving (at 20, like any two-stage line), and Palafin's Hero form is its line's third stage.
const FORM_STAGES: Record<string, string> = { Wishiwashi: 'Wishiwashi-School', Palafin: 'Palafin-Hero' }

/**
 * The stages a Pokemon evolves through in a run, a random branch where there's a choice
 * (Eevee...). However it evolves in the games, it does so at the same levels as every line
 * as long as its own (see HORDE_EVO_LEVELS).
 */
function evolutionLine(species: string): HordeEvolution[] {
  const line: HordeEvolution[] = []
  let current = Dex.species.get(species)
  while (line.length < 2) {
    const options = (current.evos.length ? current.evos : FORM_STAGES[current.name] ? [FORM_STAGES[current.name]] : [])
      .map((name) => Dex.species.get(name))
      .filter((s) => s.exists && (!s.isNonstandard || s.isNonstandard === 'Past') && (!s.battleOnly || FORM_STAGES[current.name] === s.name))
    if (!options.length) break
    const next = options[Math.floor(Math.random() * options.length)]
    line.push({ level: 0, into: speciesInfo(next.name) })
    current = next
  }
  const levels = HORDE_EVO_LEVELS[line.length] ?? []
  line.forEach((stage, i) => (stage.level = levels[i]))
  return line
}

// Where a run can be: every wild area but Anywhere and the Lab.
const HORDE_LOCATIONS = WILD_LOCATIONS.filter((l) => l.id !== 'all' && !l.requiresAllBosses)

/** The Mega form a species Mega Evolves into (one at random where it has two), if it has one. */
function megaFormOf(species: string): HordeSpecies | null {
  // Rayquaza needs no stone (it Mega Evolves knowing Dragon Ascent).
  const dex = Dex.species.get(species)
  const moveMega = dex.otherFormes && Dex.species.get(dex.otherFormes[0])
  if (moveMega?.isMega && moveMega.requiredMove) return speciesInfo(moveMega.name)
  const stones = megaStonesFor(species)
  if (!stones.length) return null
  const stone = Dex.items.get(stones[Math.floor(Math.random() * stones.length)]).megaStone as Record<string, string> | string | undefined
  const name = typeof stone === 'string' ? stone : stone?.[Dex.species.get(species).name]
  return name && Dex.species.get(name).exists ? speciesInfo(name) : null
}

/** Up to 6 Pokemon with a Gigantamax form (unevolved ones like Pikachu too), of the area's types where it has some. */
function gmaxPool(location: WildLocationConfig | null): HordeSpecies[] {
  const all = Dex.species
    .all()
    .filter((s) => s.forme === 'Gmax' && Dex.species.get(s.baseSpecies).exists)
    .map((s) => Dex.species.get(s.baseSpecies))
  const types = location?.types
  const local = types ? all.filter((s) => s.types.some((type) => types.includes(type))) : []
  const from = (local.length ? local : all).slice().sort(() => Math.random() - 0.5)
  return from.slice(0, 6).map((s) => speciesInfo(s.name))
}

/** The area's exploders for each third of the run: a line picked at random for each, that third's stage of it. */
function exploderPicks(location: WildLocationId): HordeSpecies[] | undefined {
  const lines = HORDE_EXPLODER_LINES[location]
  if (!lines?.length) return undefined
  return [0, 1, 2].map((third) => speciesInfo(pickOne(lines)[third]))
}

/** Up to `count` different wild Pokemon of about this level, from the area's types. */
function wildPool(level: number, count: number, location: WildLocationConfig | null, minBst = 0): HordeSpecies[] {
  const seen = new Set<string>()
  const pool: HordeSpecies[] = []
  for (let tries = 0; tries < count * 2 && pool.length < count; tries++) {
    const set = generateRandomWildMon(Math.min(100, level + 4), location)
    if (!set || seen.has(set.species) || bstOf(set.species) < minBst) continue
    seen.add(set.species)
    pool.push(speciesInfo(set.species))
  }
  return pool
}

function typeChart(): Record<string, Record<string, number>> {
  const names = Dex.types.names()
  const chart: Record<string, Record<string, number>> = {}
  for (const attack of names) {
    chart[attack] = {}
    for (const defend of names) chart[attack][defend] = getTypeEffectivenessMultiplier(attack, [defend])
  }
  return chart
}

function pickOne<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)]
}

/**
 * The types of attacking move a Pokemon's forms learn in any game: 'level' where one of them
 * learns some by level-up, else 'taught' where it can only be taught some (TM, egg, tutor...).
 */
function learnTypesOf(forms: string[]): Record<string, HordeLearnSource> {
  const out: Record<string, HordeLearnSource> = {}
  for (const form of forms) {
    for (const { learnset } of Dex.species.getFullLearnset(Dex.species.get(form).id)) {
      for (const moveId in learnset) {
        const move = Dex.moves.get(moveId)
        if (!move.exists || move.category === 'Status') continue
        if (learnset[moveId].some((source) => source[1] === 'L')) out[move.type] = 'level'
        else out[move.type] ??= 'taught'
      }
    }
  }
  return out
}

/** Which of a Pokemon's forms (itself and its evolutions) can Mega Evolve, and into what. */
function megasOf(species: string, evolutions: HordeEvolution[]): Record<string, HordeSpecies> {
  const megas: Record<string, HordeSpecies> = {}
  for (const form of [species, ...evolutions.map((e) => e.into.species)]) {
    const mega = megaFormOf(form)
    if (mega) megas[form] = mega
  }
  return megas
}

/**
 * A random area for the run, and 10 random unevolved Pokemon to pick its lead from. The
 * same lot stays on offer until a run counts (see payOut), so it can't be dealt again for
 * a shiny or a legendary.
 */
export function offerHorde(): HordeOffer {
  const s = getState()
  if (s.lineup) return withRegistered(s.lineup.offer)
  const seen = new Set<string>()
  const starters: HordeStarter[] = []
  const lines: StoredLineup['lines'] = {}
  // One roll for the whole lot: now and then one of them (a random one) is legendary-class.
  const legendarySlot = Math.random() < HORDE_LINEUP_LEGENDARY_CHANCE ? Math.floor(Math.random() * HORDE_STARTER_CHOICES) : -1
  for (let tries = 0; tries < HORDE_STARTER_CHOICES * 5 && starters.length < HORDE_STARTER_CHOICES; tries++) {
    // Minior is offered as a Meteor, and breaks into its Core form in the run.
    const picked = pickRandomUnevolvedAnySpecies(starters.length === legendarySlot ? 1 : 0)
    const name = Dex.species.get(picked).baseSpecies === 'Minior' ? 'Minior-Meteor' : picked
    if (seen.has(name)) continue
    seen.add(name)
    const evolutions = evolutionLine(name)
    const megas = megasOf(name, evolutions)
    lines[name] = { evolutions, megas }
    // What it ends up as, and the Mega form of its last form that has one.
    const final = evolutions[evolutions.length - 1]?.into
    const forms = [name, ...evolutions.map((e) => e.into.species)]
    const megaForm = forms.reverse().find((f) => megas[f])
    starters.push({
      ...speciesInfo(name),
      shiny: rollWildShiny(),
      // Coloured by what it ends up as, like the card's sprite.
      rarityTier: speciesRarityTier(final?.species ?? name),
      finalForm: final ? { species: final.species, spriteId: final.spriteId, types: final.types } : undefined,
      mega: megaForm ? { species: megas[megaForm].species, spriteId: megas[megaForm].spriteId } : undefined
    })
  }
  const location: WildLocationId = HORDE_LOCATIONS[Math.floor(Math.random() * HORDE_LOCATIONS.length)].id
  s.lineup = { offer: { location, starters }, lines }
  persist()
  return withRegistered(s.lineup.offer)
}

// Each card marked if what it shows is in the Pokedex - checked fresh every time, as a kept lot
// can have been dealt before the player caught one.
function withRegistered(offer: HordeOffer): HordeOffer {
  return {
    ...offer,
    starters: offer.starters.map((p) => ({
      ...p,
      registered: hasRegisteredSpecies((p.mega ?? p.finalForm ?? p).species)
    }))
  }
}

/** A new lot to pick from, for Poke Dollars (the same price every time). */
export function rerollHordeOffer(): { offer: HordeOffer; moneyTotal: number } {
  if (!spendMoney(HORDE_LINEUP_REROLL_COST)) throw new Error(t('err.hordeRerollMoney'))
  getState().lineup = null
  return { offer: offerHorde(), moneyTotal: getMoney() }
}

/** Starts a run with one of the offered Pokemon: everything the window needs to play it. */
export function startHorde(species: string): HordeSetup {
  // The lot stays on offer: only a run that counts deals a new one (see payOut).
  const lineup = getState().lineup
  const fighter = lineup?.offer.starters.find((s) => s.species === species)
  if (!lineup || !fighter) throw new Error(t('err.hordePickOffered'))
  const location = lineup.offer.location
  const area = WILD_LOCATIONS.find((l) => l.id === location) ?? null
  const line = lineup.lines[fighter.species]

  // Ditto's moves come from the area's types instead of its own.
  const transforms = fighter.species === 'Ditto'
  const moveTypes = transforms && area?.types?.length ? [...area.types] : fighter.types
  // Its first move is its (first) type's starter.
  const catalog = moveCatalog()
  const starter = HORDE_MOVE_DEFS.find((d) => d.type === moveTypes[0] && d.starter)
  const first = (starter && catalog.find((m) => m.id === hordeMoveOf(starter).id)) ?? catalog[0]
  const moves = [first, ...catalog.filter((m) => m !== first)]

  // The waves' Pokemon at the levels each stretch of the run brings them in at.
  const stage = (minute: number): number => hordeFoeLevel(minute * 60000)
  const pools = [wildPool(stage(1.5), 8, area), wildPool(stage(5), 8, area), wildPool(stage(8.5), 8, area)].filter((p) => p.length)
  if (!pools.length) pools.push([speciesInfo(fighter.species)])
  // Bosses from the area too, or from anywhere if it has none strong enough.
  let bossPool = wildPool(100, 6, area, 450)
  if (!bossPool.length) bossPool = wildPool(100, 6, null, 450)

  // What the wild Pokemon evolve into, for the elites.
  const evolved: Record<string, HordeSpecies[]> = {}
  for (const sp of pools.flat()) evolved[sp.species] ??= evolutionLine(sp.species).map((e) => e.into)

  // The line and Mega forms the picker showed.
  const evolutions = line?.evolutions ?? evolutionLine(fighter.species)
  const megas = line?.megas ?? megasOf(fighter.species, evolutions)
  const token = randomUUID()
  active = {
    token,
    startedAt: Date.now(),
    species: fighter.species,
    forms: [fighter.species, ...evolutions.map((e) => e.into.species)],
    shiny: fighter.shiny,
    canMega: Object.keys(megas).length > 0,
    location
  }
  return {
    token,
    location,
    fighter,
    evolutions,
    // A Core of one of its colours, at random.
    coreForm: fighter.species === 'Minior-Meteor' ? speciesInfo(pickOne(['Minior', ...Dex.species.get('Minior').cosmeticFormes ?? []])) : undefined,
    transforms: transforms || undefined,
    moveTypes: transforms ? moveTypes : undefined,
    learnTypes: transforms ? undefined : learnTypesOf(active.forms),
    moves,
    pools,
    bossPool: bossPool.length ? bossPool : pools[pools.length - 1],
    exploders: exploderPicks(location),
    evolved,
    megas,
    gmaxPool: gmaxPool(area),
    typeChart: typeChart(),
    // The Shapeshifter title lets the Move Deleter be used a second time.
    moveDeletes: hasTitle('Shapeshifter') ? SHAPESHIFTER_MOVE_DELETES : 1,
    // The Schooling title starts the run with extra rerolls.
    extraRerolls: hasTitle('Schooling') ? SCHOOLING_EXTRA_REROLLS : undefined,
    ...duoSetup(),
    best: getState().top[0] ?? null,
    upgrades: { ...getState().upgrades }
  }
}

// What a run needs to know about duo synergies: the share of a type effect's chance moves of other
// types get (more with the Master of Elements title), and the duos already had on (for their ticks).
function duoSetup(): Pick<HordeSetup, 'otherTypeShare' | 'duosUsed'> {
  return {
    otherTypeShare: hasTitle('Master of Elements') ? MASTER_OF_ELEMENTS_OTHER_TYPE_SHARE : undefined,
    duosUsed: [...getState().duosUsed]
  }
}

// How long a run must last, Mega Evolved, to count for Mega Rush: the full 10 minutes and 10 more in endless mode.
const HORDE_MEGA_RUSH_MS = HORDE_DURATION_MS + 10 * 60 * 1000

// Better: a win first, then the longer run, then more KOs.
function beats(a: HordeRecord, b: HordeRecord | null): boolean {
  if (!b) return true
  if (a.won !== b.won) return a.won
  if (a.survivedMs !== b.survivedMs) return a.survivedMs > b.survivedMs
  return a.kos > b.kos
}

/**
 * Ends the run and pays for it. The window reports how it went; this holds it to what the
 * clock allows - no longer than the run has really been going (endless mode included), no
 * more KOs than it could have managed, and cleared only once the full 10 minutes are up.
 */
export function finishHorde(token: string, result: HordeResult): HordeReward {
  if (!active || active.token !== token) throw new Error(t('err.hordeNoRun'))
  const run = active
  active = null
  return payOut(run, checkResult(run, result))
}

/** How a run went, held to what the clock allows (see finishHorde). */
function checkResult(run: ActiveRun, result: HordeResult): HordeResult {
  const realMs = Date.now() - run.startedAt + 3000
  const survivedMs = Math.max(0, Math.min(Math.floor(Number(result.survivedMs) || 0), realMs))
  const kos = Math.max(0, Math.min(Math.floor(Number(result.kos) || 0), Math.floor(survivedMs / 150)))
  const won = !!result.won && survivedMs >= HORDE_DURATION_MS
  // Big Nuggets drop from KOs, so never more of them than KOs.
  const bigNuggets = Math.max(0, Math.min(Math.floor(Number(result.bigNuggets) || 0), kos))
  // The form it ended in - one of the forms this run's lead could reach.
  const species = run.forms.includes(String(result.species)) ? String(result.species) : run.species
  // A Mega Evolution only counts for a lead with a Mega form to reach.
  const megaEvolved = !!result.megaEvolved && run.canMega
  return {
    survivedMs,
    kos,
    level: Math.max(0, Math.min(100, Math.floor(Number(result.level) || 0))),
    won,
    bigNuggets,
    species,
    megaEvolved,
    moves: checkMoves(result.moves),
    damage: checkDamage(result.damage),
    tomes: checkTomes(result.tomes),
    held: checkHeld(result.held),
    chests: Math.max(0, Math.min(1000, Math.floor(Number(result.chests) || 0))),
    duos: checkDuos(result.duos)
  }
}

/** The duo synergies a run reports were on: real ones only, each once. */
function checkDuos(duos: unknown): HordeDuoId[] {
  if (!Array.isArray(duos)) return []
  return HORDE_DUOS.map((d) => d.id).filter((id) => duos.includes(id))
}

/** The tomes a run reports it held: real stats, each once, no more than the slots, sane ranks. */
function checkTomes(tomes: unknown): HordeTome[] {
  if (!Array.isArray(tomes)) return []
  const out: HordeTome[] = []
  for (const tm of tomes.slice(0, HORDE_MAX_TOMES)) {
    const stat = String((tm as HordeTome)?.stat) as HordeStat
    if (!HORDE_STATS.includes(stat) || out.some((o) => o.stat === stat)) continue
    out.push({ stat, ranks: Math.max(1, Math.min(100, Math.floor(Number((tm as HordeTome).ranks) || 1))) })
  }
  return out
}

/** The held items a run reports: real ones only, whole counts. */
function checkHeld(held: unknown): HordeHeld {
  if (!held || typeof held !== 'object') return {}
  const out: HordeHeld = {}
  for (const id of HORDE_HELD_IDS) {
    const n = Math.max(0, Math.min(1000, Math.floor(Number((held as Record<string, unknown>)[id]) || 0)))
    if (n > 0) out[id] = n
  }
  return out
}

/** The damage a run reports each move dealt: only real move names (or '' for effects), whole numbers. */
function checkDamage(damage: unknown): Record<string, number> {
  if (!damage || typeof damage !== 'object') return {}
  const names = new Set(['', ...moveCatalog().map((m) => m.name)])
  const out: Record<string, number> = {}
  for (const [name, dmg] of Object.entries(damage as Record<string, unknown>)) {
    const n = Math.max(0, Math.min(1e12, Math.round(Number(dmg) || 0)))
    if (names.has(name) && n > 0) out[name] = n
  }
  return out
}

/** The moves a run reports it knew, for the history: only real ones, each once, with sane numbers. */
function checkMoves(moves: unknown): HordeRunMove[] {
  if (!Array.isArray(moves)) return []
  const ids = new Set(moveCatalog().map((m) => m.id))
  const num = (n: unknown): number => Math.max(0, Math.min(100000, Math.round(Number(n) || 0)))
  const out: HordeRunMove[] = []
  for (const m of moves.slice(0, 8)) {
    const id = String((m as HordeRunMove)?.id)
    if (!ids.has(id) || out.some((o) => o.id === id)) continue
    const { power, cut, range, count, crit, upgrades } = m as HordeRunMove
    out.push({ id, power: num(power), cut: num(cut), range: num(range), count: num(count), crit: num(crit), upgrades: num(upgrades) })
  }
  return out
}

/** Pays for a run (already checked) and keeps it among the best runs where it beats one. */
function payOut(run: Pick<ActiveRun, 'shiny' | 'species' | 'location'>, checked: HordeResult): HordeReward {
  const { survivedMs, kos, species, won } = checked
  // The Centurion title adds 10% to what a run pays.
  const money = Math.round(hordeMoney(checked) * (hasTitle('Centurion') ? CENTURION_MONEY_MULTIPLIER : 1))
  if (money > 0) addMoney(money)
  if (won) countAchievement('hordeRunsWon')
  if (won) recordMission('hordeRunsWon')
  if (kos >= 100) recordMission('horde100KoRuns')
  if (won && run.shiny) countAchievement('hordeShinyWins')
  if (won && run.species === 'Ditto') countAchievement('hordeDittoWins')
  if (won && run.species === 'Wishiwashi') countAchievement('hordeWishiwashiWins')
  recordAchievementBest('hordeBestLevel', checked.level)
  recordAchievementBest('hordeBestMinutes', Math.floor(survivedMs / 60000))
  // Mega Rush: Mega Evolved and lasted 20 minutes (10 of them in endless mode).
  if (checked.megaEvolved && survivedMs >= HORDE_MEGA_RUSH_MS) countAchievement('hordeMegaRuns')
  const s = getState()
  s.runs += 1
  // The duo synergies it had on join those had before (Master of Elements counts them).
  s.duosUsed = HORDE_DUOS.map((d) => d.id).filter((id) => s.duosUsed.includes(id) || (checked.duos ?? []).includes(id))
  recordAchievementBest('hordeDuosUsed', s.duosUsed.length)
  // A cleared run keeps its lead: the Pokemon picked (not what it became), at level 1,
  // shiny if it was. Its battle-only form (Minior's Meteor) joins as its usual form.
  let caught: HordeReward['caught']
  if (won) {
    const dex = Dex.species.get(run.species)
    const kept = typeof dex.battleOnly === 'string' ? dex.battleOnly : dex.name
    addMonOfSpecies(kept, 1, run.shiny)
    caught = { species: kept, spriteId: toSpriteId(kept), shiny: run.shiny }
  }
  // A new lot to pick from only once a run counts - cleared, or lasting a few minutes - so
  // quitting straight away never deals a new one.
  if (won || survivedMs >= HORDE_LINEUP_KEEP_MS) s.lineup = null
  const record: HordeRecord = { survivedMs, kos, species, spriteId: toSpriteId(species), shiny: run.shiny, won }
  // Into the best runs where it beats one, the rest moving down (and the last off the end).
  let place: number | null = s.top.findIndex((r) => beats(record, r))
  if (place < 0) place = s.top.length < HORDE_TOP_RUNS ? s.top.length : null
  if (place !== null) s.top.splice(place, 0, record)
  s.top = s.top.slice(0, HORDE_TOP_RUNS)
  // And into the history, newest first.
  s.history.unshift({
    at: Date.now(),
    location: run.location,
    starter: run.species,
    species,
    spriteId: toSpriteId(species),
    shiny: run.shiny,
    survivedMs,
    kos,
    level: checked.level,
    won,
    money,
    bigNuggets: checked.bigNuggets,
    megaEvolved: !!checked.megaEvolved,
    moves: checked.moves ?? [],
    damage: checked.damage ?? {},
    tomes: checked.tomes ?? [],
    held: checked.held ?? {},
    chests: checked.chests ?? 0
  })
  s.history = s.history.slice(0, HORDE_HISTORY_RUNS)
  persist()
  return { money, moneyTotal: getMoney(), best: s.top[0] ?? null, top: s.top, place, newBest: place === 0, ...(caught ? { caught } : {}) }
}

/**
 * Saves the run being played to carry on later, and leaves it - it isn't paid for until it
 * ends. Only one run is kept saved.
 */
export function saveHorde(token: string, save: HordeSave, result: HordeResult): HordeSavedRun | null {
  if (!active || active.token !== token) throw new Error(t('err.hordeNoRun'))
  const run = active
  active = null
  getState().saved = { save, result: checkResult(run, result), species: run.species, forms: run.forms, shiny: run.shiny }
  persist()
  return getHordeSaved()
}

export function getHordeSaved(): HordeSavedRun | null {
  const saved = getState().saved
  if (!saved) return null
  const { result } = saved
  return {
    species: result.species,
    spriteId: toSpriteId(result.species),
    shiny: saved.shiny,
    location: saved.save.setup.location,
    survivedMs: result.survivedMs,
    kos: result.kos,
    level: result.level
  }
}

/**
 * Carries on the saved run: it's played again under a new token, its clock going on from
 * where it was saved. The save is used up (saving again keeps it going).
 */
export function resumeHorde(): HordeSave {
  const s = getState()
  const saved = s.saved
  if (!saved) throw new Error(t('err.hordeNoSave'))
  s.saved = null
  persist()
  const token = randomUUID()
  active = {
    token,
    startedAt: Date.now() - saved.result.survivedMs,
    species: saved.species,
    forms: saved.forms,
    shiny: saved.shiny,
    canMega: Object.keys(saved.save.setup.megas ?? {}).length > 0,
    location: saved.save.setup.location
  }
  return { ...saved.save, setup: { ...saved.save.setup, token, ...duoSetup(), best: s.top[0] ?? null, upgrades: { ...s.upgrades } } }
}

/** Ends the saved run without playing on - paid for as it stood, as if given up. */
export function endSavedHorde(): HordeReward {
  const s = getState()
  const saved = s.saved
  if (!saved) throw new Error(t('err.hordeNoSave'))
  s.saved = null
  return payOut({ shiny: saved.shiny, species: saved.species, location: saved.save.setup.location }, saved.result)
}

export function getHordeBest(): HordeRecord | null {
  return getState().top[0] ?? null
}

export function getHordeTop(): HordeRecord[] {
  return getState().top
}

export function getHordeHistory(): HordeHistoryEntry[] {
  return getState().history
}

export function getHordeUpgrades(): HordeUpgrades {
  return getState().upgrades
}

/** Every duo synergy that's been on in a finished run, for the Codex's ticks. */
export function getHordeDuos(): HordeDuoId[] {
  return getState().duosUsed
}

/** Buys the next rank of an upgrade, if it isn't maxed and there's the money for it. */
export function buyHordeUpgrade(id: HordeUpgradeId): { upgrades: HordeUpgrades; moneyTotal: number } {
  const def = HORDE_UPGRADES.find((d) => d.id === id)
  if (!def) throw new Error(t('err.hordeNoUpgrade'))
  const s = getState()
  const cost = hordeUpgradeCost(def, s.upgrades[id])
  if (cost === null) throw new Error(t('err.hordeUpgradeMaxed'))
  if (!spendMoney(cost)) throw new Error(t('err.hordeUpgradeMoney'))
  s.upgrades[id] += 1
  persist()
  return { upgrades: s.upgrades, moneyTotal: getMoney() }
}
