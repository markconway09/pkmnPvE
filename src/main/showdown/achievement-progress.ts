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

/** Adds to one of the achievement-only tallies. */
export function countAchievement(stat: AchievementStat, amount = 1): void {
  if (amount <= 0) return
  const counters = getAchievementProgress().counters
  counters[stat] = (counters[stat] ?? 0) + amount
  persistAchievementProgress()
}
