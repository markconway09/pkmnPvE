import type { MissionStat } from '../../shared/missions'
import { recordMission } from './mission-store'
import { readFileSync, writeFileSync } from 'node:fs'
import type { PlayerStats } from '../../shared/battle-types'
import { playerPathFor } from './save-paths'
import { onPlayerChange } from './player-session'

// A player's lifetime tallies, shown on their trainer profile. Bosses aren't
// counted here - the progression's own list of beaten bosses already says that.
// Nor are raids - the achievements already keep that count.
type StoredStats = Omit<PlayerStats, 'bossesDefeated' | 'raidsWon'>

const COUNTERS: (keyof StoredStats)[] = ['trainersDefeated', 'wildDefeated', 'wildCaught', 'bestFloor']

function emptyStats(): StoredStats {
  return { trainersDefeated: 0, wildDefeated: 0, wildCaught: 0, bestFloor: 0 }
}

function load(): StoredStats {
  // Outside the try: not being logged in is a bug to surface, not an empty save.
  const path = playerPathFor('stats.json')
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<StoredStats>
    const stats = emptyStats()
    for (const key of COUNTERS) if (typeof parsed[key] === 'number') stats[key] = parsed[key]
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
  writeFileSync(playerPathFor('stats.json'), JSON.stringify(getState()), 'utf8')
}

export function getStats(): StoredStats {
  return { ...getState() }
}

/** Roguelite: keeps the furthest floor a run has reached. */
export function recordBestFloor(floor: number): void {
  if (floor <= getState().bestFloor) return
  getState().bestFloor = floor
  persist()
}

// The daily missions counting the same things as these stats.
const MISSION_STATS: Partial<Record<keyof StoredStats, MissionStat>> = {
  wildDefeated: 'wildWins',
  trainersDefeated: 'trainerWins',
  wildCaught: 'catches'
}

export function countStat(key: Exclude<keyof StoredStats, 'bestFloor'>): void {
  getState()[key] += 1
  persist()
  const mission = MISSION_STATS[key]
  if (mission) recordMission(mission)
}

export function resetStatsCounters(): void {
  state = emptyStats()
  persist()
}
