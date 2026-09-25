import { randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import type { EditablePokemonSet, ItemDropConfig, PremadeTeamSummary } from '../../shared/battle-types'
import {
  applyEditableSet,
  bstOf,
  buildBasicSet,
  buildPokemonSummary,
  canonicalSpeciesName,
  maxBstForLevelCap,
  toEditableSet,
  type PokemonSet
} from './sim-access'
import { getProgression } from './progression-store'
import { listTrainers } from './trainer-store'
import { savePathFor } from './save-paths'

const MAX_TEAM_SIZE = 6

// How far below the level cap a random trainer's strongest Pokemon may be before
// that trainer is considered too weak to fight and stops being picked.
export const MAX_LEVELS_BELOW_CAP = 10

// A set in a premade team. capOffset (Radical Red's "Max Level - n") means the
// level is the current level cap minus n, worked out whenever it's needed, and
// `level` is only a placeholder; without it `level` is exactly what's fought.
export type TeamSet = PokemonSet & { capOffset?: number }

interface StoredTeamMon {
  id: string
  set: TeamSet
}

function levelAtCap(set: TeamSet, levelCap: number): number {
  const level = set.capOffset !== undefined ? levelCap - set.capOffset : set.level
  return Math.max(1, Math.min(100, level))
}

// The set as it stands at a given cap, as a plain Pokemon set.
function withLevelAtCap(set: TeamSet, levelCap: number): PokemonSet {
  const { capOffset: _capOffset, ...rest } = set
  return { ...rest, level: levelAtCap(set, levelCap) }
}

interface StoredPremadeTeam {
  id: string
  trainerId: string
  name: string
  mons: StoredTeamMon[]
  drop: ItemDropConfig
  isDoubleBattle: boolean
}

function load(): StoredPremadeTeam[] {
  try {
    const raw = readFileSync(savePathFor('premadeTeams.json'), 'utf8')
    const parsed = JSON.parse(raw) as StoredPremadeTeam[]
    if (!Array.isArray(parsed)) return []
    // Saves from before item drops/double battles existed are missing those fields.
    for (const team of parsed) {
      if (!team.drop) team.drop = { itemId: null, chance: 0 }
      if (typeof team.isDoubleBattle !== 'boolean') team.isDoubleBattle = false
    }
    return parsed
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code
    if (code !== 'ENOENT') console.error('[premade-teams-store] failed to load premadeTeams.json:', e)
    return []
  }
}

let state: StoredPremadeTeam[] | null = null

// Teams imported before cap-relative levels existed stored Radical Red's
// "Max Level - n" as a plain level of 100 - n (97-100), which is far above any
// real fixed level in the data (85 at most). Those become cap-relative.
function migrateImportedRelativeLevels(teams: StoredPremadeTeam[]): boolean {
  const importedTrainerIds = new Set(
    listTrainers()
      .filter((t) => t.importKey?.startsWith('rr41:'))
      .map((t) => t.id)
  )
  let changed = false
  for (const team of teams) {
    if (!importedTrainerIds.has(team.trainerId)) continue
    for (const mon of team.mons) {
      if (mon.set.capOffset === undefined && mon.set.level >= 90 && mon.set.level <= 100) {
        mon.set.capOffset = 100 - mon.set.level
        changed = true
      }
    }
  }
  return changed
}

function getState(): StoredPremadeTeam[] {
  if (!state) {
    state = load()
    if (migrateImportedRelativeLevels(state)) persist()
  }
  return state
}

function persist(): void {
  writeFileSync(savePathFor('premadeTeams.json'), JSON.stringify(getState()), 'utf8')
}

function findTeam(teamId: string): StoredPremadeTeam {
  const team = getState().find((t) => t.id === teamId)
  if (!team) throw new Error(`Unknown premade team id: ${teamId}`)
  return team
}

// The level cap a team first becomes eligible at: its highest fixed level. A
// cap-relative member never adds a requirement, since it's always at or under
// whatever the cap is.
function requiredLevelCapOf(team: StoredPremadeTeam): number {
  return team.mons.reduce((max, m) => (m.set.capOffset === undefined ? Math.max(max, Math.min(100, m.set.level)) : max), 1)
}

function toSummary(team: StoredPremadeTeam): PremadeTeamSummary {
  const levelCap = getProgression().levelCap
  const requiredLevelCap = requiredLevelCapOf(team)
  return {
    id: team.id,
    trainerId: team.trainerId,
    name: team.name,
    // Shown at the level they'd fight at right now.
    mons: team.mons.map((m) => ({ id: m.id, ...buildPokemonSummary(m.set.species, withLevelAtCap(m.set, levelCap)) })),
    drop: team.drop,
    isDoubleBattle: team.isDoubleBattle,
    requiredLevelCap
  }
}

export function listPremadeTeams(): PremadeTeamSummary[] {
  return getState().map(toSummary)
}

export function listPremadeTeamsForTrainer(trainerId: string): PremadeTeamSummary[] {
  return getState()
    .filter((t) => t.trainerId === trainerId)
    .map(toSummary)
}

export function addPremadeTeam(trainerId: string, name: string): PremadeTeamSummary[] {
  getState().push({
    id: randomUUID(),
    trainerId,
    name: name.trim() || 'New Team',
    mons: [],
    drop: { itemId: null, chance: 0 },
    isDoubleBattle: false
  })
  persist()
  return listPremadeTeamsForTrainer(trainerId)
}

// Adds a team that arrives already filled in (an importer's output), rather
// than the empty one addPremadeTeam makes.
export function addImportedPremadeTeam(trainerId: string, name: string, sets: TeamSet[]): void {
  getState().push({
    id: randomUUID(),
    trainerId,
    name,
    mons: sets.slice(0, MAX_TEAM_SIZE).map((set) => ({ id: randomUUID(), set })),
    drop: { itemId: null, chance: 0 },
    isDoubleBattle: false
  })
  persist()
}

export function renamePremadeTeam(teamId: string, name: string): PremadeTeamSummary[] {
  const team = findTeam(teamId)
  team.name = name.trim() || team.name
  persist()
  return listPremadeTeamsForTrainer(team.trainerId)
}

export function setPremadeTeamDrop(teamId: string, drop: ItemDropConfig): PremadeTeamSummary[] {
  const team = findTeam(teamId)
  team.drop = { itemId: drop.itemId, chance: Math.max(0, Math.min(100, Math.round(drop.chance))) }
  persist()
  return listPremadeTeamsForTrainer(team.trainerId)
}

export function setPremadeTeamDoubleBattle(teamId: string, isDoubleBattle: boolean): PremadeTeamSummary[] {
  const team = findTeam(teamId)
  team.isDoubleBattle = isDoubleBattle
  persist()
  return listPremadeTeamsForTrainer(team.trainerId)
}

export function deletePremadeTeam(teamId: string): PremadeTeamSummary[] {
  const trainerId = findTeam(teamId).trainerId
  state = getState().filter((t) => t.id !== teamId)
  persist()
  return listPremadeTeamsForTrainer(trainerId)
}

export function deleteTeamsForTrainer(trainerId: string): void {
  state = getState().filter((t) => t.trainerId !== trainerId)
  persist()
}

// A Pokemon added to an empty team starts at this level (otherwise at the team's highest).
const NEW_TEAM_MON_LEVEL = 50

/**
 * Adds a chosen species to a team - at the level of its strongest member, with its
 * first ability and the moves it knows from levelling up - ready to be edited.
 */
export function addSpeciesToTeam(teamId: string, species: string): PremadeTeamSummary[] {
  const team = findTeam(teamId)
  if (team.mons.length >= MAX_TEAM_SIZE) throw new Error(`A team can have at most ${MAX_TEAM_SIZE} Pokemon`)
  const name = canonicalSpeciesName(species)
  if (!name) throw new Error(`There's no Pokemon called "${species}"`)
  const level = team.mons.length > 0 ? Math.max(...team.mons.map((m) => m.set.level)) : NEW_TEAM_MON_LEVEL
  team.mons.push({ id: randomUUID(), set: buildBasicSet(name, level) })
  persist()
  return listPremadeTeamsForTrainer(team.trainerId)
}

export function removeMonFromTeam(teamId: string, monId: string): PremadeTeamSummary[] {
  const team = findTeam(teamId)
  team.mons = team.mons.filter((m) => m.id !== monId)
  persist()
  return listPremadeTeamsForTrainer(team.trainerId)
}

// The order of a team's mons is the order it sends them out in, so reordering
// is just handing back the same ids in a new sequence - anything that isn't
// exactly the current set is rejected rather than silently adding or dropping
// a Pokemon.
export function reorderTeamMons(teamId: string, monIds: string[]): PremadeTeamSummary[] {
  const team = findTeam(teamId)
  const byId = new Map(team.mons.map((m) => [m.id, m]))
  if (monIds.length !== team.mons.length || new Set(monIds).size !== monIds.length || !monIds.every((id) => byId.has(id))) {
    throw new Error('That is not the same set of Pokemon as the team')
  }
  team.mons = monIds.map((id) => byId.get(id)!)
  persist()
  return listPremadeTeamsForTrainer(team.trainerId)
}

export function getTeamMonSet(teamId: string, monId: string): EditablePokemonSet {
  const team = findTeam(teamId)
  const mon = team.mons.find((m) => m.id === monId)
  if (!mon) throw new Error(`Unknown Pokemon id: ${monId}`)
  return { ...toEditableSet(withLevelAtCap(mon.set, getProgression().levelCap)), capOffset: mon.set.capOffset ?? null }
}

export function updateTeamMon(teamId: string, monId: string, input: EditablePokemonSet): PremadeTeamSummary[] {
  const team = findTeam(teamId)
  const mon = team.mons.find((m) => m.id === monId)
  if (!mon) throw new Error(`Unknown Pokemon id: ${monId}`)
  const updated: TeamSet = { ...applyEditableSet(mon.set, input) }
  if (typeof input.capOffset === 'number' && Number.isFinite(input.capOffset)) {
    // "Level follows the cap": always this many levels under whatever the cap is.
    updated.capOffset = Math.max(0, Math.min(99, Math.round(input.capOffset)))
    updated.level = levelAtCap(updated, getProgression().levelCap)
  } else {
    // Otherwise the level is fixed, exactly as given.
    delete updated.capOffset
  }
  mon.set = updated
  persist()
  return listPremadeTeamsForTrainer(team.trainerId)
}

function fitsPlayer(team: StoredPremadeTeam, playerTeamSize: number): boolean {
  if (team.mons.length === 0) return false
  // A double-battle team needs the player to have a second Pokemon to send out.
  return !(team.isDoubleBattle && playerTeamSize < 2)
}

function topLevelAtCap(team: StoredPremadeTeam, levelCap: number): number {
  return Math.max(...team.mons.map((m) => levelAtCap(m.set, levelCap)))
}

// A team a random trainer may field, level-wise: its strongest Pokemon is no higher
// than the level cap, but not more than MAX_LEVELS_BELOW_CAP under it either.
function isInLevelWindow(team: StoredPremadeTeam, levelCap: number): boolean {
  const top = topLevelAtCap(team, levelCap)
  return top <= levelCap && top >= levelCap - MAX_LEVELS_BELOW_CAP
}

// A team whose levels follow the level cap (Radical Red's "Max Level", i.e. a
// late-game team) would otherwise show up at any cap, however strong its members -
// a fully evolved legendary at level 15. So such a team may only be fielded in a
// random fight once every member is within the same base-stat ceiling random
// teams use for this cap. Teams with fixed levels are as authored and unaffected.
function isWithinBstCeiling(team: StoredPremadeTeam, levelCap: number): boolean {
  if (!team.mons.some((m) => m.set.capOffset !== undefined)) return true
  const ceiling = maxBstForLevelCap(levelCap)
  return team.mons.every((m) => bstOf(m.set.species) <= ceiling)
}

function isRandomFightTeam(team: StoredPremadeTeam, levelCap: number, exemptFromCeiling = false): boolean {
  return isInLevelWindow(team, levelCap) && (exemptFromCeiling || isWithinBstCeiling(team, levelCap))
}

// A trainer marked alwaysAvailable skips the stat ceiling (its teams still have to fit the level window).
function skipsStatCeiling(trainerId: string): boolean {
  return !!listTrainers().find((t) => t.id === trainerId)?.alwaysAvailable
}

export interface PremadeTeamSelection {
  sets: PokemonSet[]
  drop: ItemDropConfig
  isDoubleBattle: boolean
}

/**
 * Picks one of a trainer's teams to fight with, exactly as authored - levels are
 * never adjusted, except that a cap-relative member is worked out from the cap.
 * By default only a team inside the level window (see isInLevelWindow) can be
 * picked. A trainer picked on purpose rather than at random - a boss - can pass
 * `anyLevel`: the same window is still preferred, then any team at or under the
 * cap, then whatever the trainer has, so a boss is never left without a team
 * just because the cap hasn't caught up to it yet.
 */
export function pickRandomPremadeTeam(
  trainerId: string,
  levelCap: number,
  playerTeamSize: number,
  options: { anyLevel?: boolean } = {}
): PremadeTeamSelection | null {
  const candidates = getState().filter((t) => t.trainerId === trainerId && fitsPlayer(t, playerTeamSize))
  // A random fight has to pass every check; a boss, chosen on purpose, only prefers the level window.
  const exempt = skipsStatCeiling(trainerId)
  let pool = candidates.filter((t) =>
    options.anyLevel ? isInLevelWindow(t, levelCap) : isRandomFightTeam(t, levelCap, exempt)
  )
  if (pool.length === 0 && options.anyLevel) {
    pool = candidates.filter((t) => topLevelAtCap(t, levelCap) <= levelCap)
    if (pool.length === 0) pool = candidates
  }
  if (pool.length === 0) return null
  const team = pool[Math.floor(Math.random() * pool.length)]
  return {
    sets: team.mons.map((m) => withLevelAtCap(m.set, levelCap)),
    drop: team.drop,
    isDoubleBattle: team.isDoubleBattle
  }
}

/** Whether a random-fight trainer has any team it could field right now. */
export function hasAnyEligibleTeam(trainerId: string, levelCap: number, playerTeamSize: number): boolean {
  const exempt = skipsStatCeiling(trainerId)
  return getState().some(
    (t) => t.trainerId === trainerId && fitsPlayer(t, playerTeamSize) && isRandomFightTeam(t, levelCap, exempt)
  )
}
