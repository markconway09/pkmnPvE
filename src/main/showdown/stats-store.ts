import { readText, writeText } from '../platform'
import type { MissionStat } from '../../shared/missions'
import { recordMission } from './mission-store'
import type { PlayerStats, RunDifficulty } from '../../shared/battle-types'
import { RUN_DIFFICULTIES } from '../../shared/battle-types'
import { playerPathFor } from './save-paths'
import { onPlayerChange } from './player-session'

// A player's lifetime tallies, shown on their trainer profile. Bosses aren't
// counted here - the progression's own list of beaten bosses already says that.
// Nor are raids - the achievements already keep that count.
type StoredStats = Omit<PlayerStats, 'bossesDefeated' | 'raidsWon'>

const COUNTERS = ['trainersDefeated', 'wildDefeated', 'wildCaught', 'bestFloor'] as const

function emptyStats(): StoredStats {
  return { trainersDefeated: 0, wildDefeated: 0, wildCaught: 0, bestFloor: 0, bestFloorDifficulty: null }
}

function load(): StoredStats {
  // Outside the try: not being logged in is a bug to surface, not an empty save.
  const path = playerPathFor('stats.json')
  try {
    const parsed = JSON.parse(readText(path)) as Partial<StoredStats>
    const stats = emptyStats()
    for (const key of COUNTERS) if (typeof parsed[key] === 'number') stats[key] = parsed[key]
    if (RUN_DIFFICULTIES.some((d) => d.id === parsed.bestFloorDifficulty)) stats.bestFloorDifficulty = parsed.bestFloorDifficulty!
    return stats
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code
    if (code !== 'ENOENT') console.error('[stats-store] failed to load stats.json:', e)
    return emptyStats()
  }
}

let state: StoredStats | null = null

// Each player has their own tallies: forget the cached ones when the player changes.
onPlayerChange(() => {
  state = null
})

function getState(): StoredStats {
  if (!state) state = load()
  return state
}

function persist(): void {
  writeText(playerPathFor('stats.json'), JSON.stringify(getState()))
}

export function getStats(): StoredStats {
  return { ...getState() }
}

/** Roguelite: keeps the furthest floor a run has reached, and on which difficulty -
 *  reaching the same floor on a harder difficulty takes the record over. */
export function recordBestFloor(floor: number, difficulty: RunDifficulty): void {
  const stats = getState()
  const rank = (d: RunDifficulty | null): number => RUN_DIFFICULTIES.findIndex((info) => info.id === d)
  if (floor < stats.bestFloor) return
  if (floor === stats.bestFloor && rank(difficulty) <= rank(stats.bestFloorDifficulty)) return
  stats.bestFloor = floor
  stats.bestFloorDifficulty = difficulty
  persist()
}

// The daily missions counting the same things as these stats.
const MISSION_STATS: Partial<Record<keyof StoredStats, MissionStat>> = {
  wildDefeated: 'wildWins',
  trainersDefeated: 'trainerWins',
  wildCaught: 'catches'
}

export function countStat(key: Exclude<keyof StoredStats, 'bestFloor' | 'bestFloorDifficulty'>): void {
  getState()[key] += 1
  persist()
  const mission = MISSION_STATS[key]
  if (mission) recordMission(mission)
}

export function resetStatsCounters(): void {
  state = emptyStats()
  persist()
}
