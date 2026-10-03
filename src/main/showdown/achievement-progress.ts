import type { MissionStat } from '../../shared/missions'
import { recordMission } from './mission-store'
import { readFileSync, writeFileSync } from 'node:fs'
import type { AchievementStat } from '../../shared/achievements'
import { playerPathFor } from './save-paths'
import { onPlayerChange } from './player-session'

/**
 * A player's saved achievement progress: the tallies only achievements need (the rest
 * are read from the box, stats, money and progression - see achievement-store.ts), which
 * achievements have unlocked and been claimed, and the title they show. Kept apart from
 * achievement-store so the stores that count things can import it without a cycle.
 */
export interface StoredAchievements {
  counters: Partial<Record<AchievementStat, number>>
  unlocked: string[]
  claimed: string[]
  title: string | null
  // False until the first check: what an older save already had then unlocks quietly.
  seeded: boolean
}

let state: StoredAchievements | null = null

onPlayerChange(() => {
  state = null
})

export function getAchievementProgress(): StoredAchievements {
  if (!state) {
    try {
      const parsed = JSON.parse(readFileSync(playerPathFor('achievements.json'), 'utf8')) as Partial<StoredAchievements>
      state = {
        counters: parsed.counters ?? {},
        unlocked: parsed.unlocked ?? [],
        claimed: parsed.claimed ?? [],
        title: parsed.title ?? null,
        seeded: parsed.seeded ?? false
      }
    } catch {
      state = { counters: {}, unlocked: [], claimed: [], title: null, seeded: false }
    }
  }
  return state
}

export function persistAchievementProgress(): void {
  writeFileSync(playerPathFor('achievements.json'), JSON.stringify(getAchievementProgress()), 'utf8')
}

/** Raises one of the achievement-only tallies to this value, if it's a new best. */
export function recordAchievementBest(stat: AchievementStat, value: number): void {
  const counters = getAchievementProgress().counters
  if (value <= (counters[stat] ?? 0)) return
  counters[stat] = value
  persistAchievementProgress()
}

// The daily missions that count the same things as these tallies.
const MISSION_STATS: Partial<Record<AchievementStat, MissionStat>> = {
  slotSpins: 'slotSpins',
  blackjackWins: 'blackjackWins',
  rouletteSpins: 'rouletteSpins',
  plinkoDrops: 'plinkoDrops',
  evolutions: 'evolutions',
  skillGreats: 'skillGreats',
  pokemonMerged: 'merges',
  raidsWon: 'raidsWon'
}

/** Adds to one of the achievement-only tallies (and any daily mission counting the same). */
export function countAchievement(stat: AchievementStat, amount = 1): void {
  if (amount <= 0) return
  const mission = MISSION_STATS[stat]
  if (mission) recordMission(mission, amount)
  const counters = getAchievementProgress().counters
  counters[stat] = (counters[stat] ?? 0) + amount
  persistAchievementProgress()
}
