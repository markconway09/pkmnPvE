import { readText, writeText } from '../platform'
import type { MissionStat } from '../../shared/missions'
import { recordMission } from './mission-store'
import type { AchievementStat } from '../../shared/achievements'
import { ACHIEVEMENTS } from '../../shared/achievements'
import { startingDisabledTitles } from '../../shared/titles'
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
  // The claimed titles turned off - every other claimed title's perk works.
  disabledTitles: string[]
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
      const parsed = JSON.parse(readText(playerPathFor('achievements.json'))) as Partial<StoredAchievements>
      state = {
        counters: parsed.counters ?? {},
        unlocked: parsed.unlocked ?? [],
        claimed: parsed.claimed ?? [],
        title: parsed.title ?? null,
        disabledTitles:
          parsed.disabledTitles ?? startingDisabledTitles(claimedTitlesOf(parsed.claimed ?? []), parsed.title ?? null),
        seeded: parsed.seeded ?? false
      }
    } catch {
      state = { counters: {}, unlocked: [], claimed: [], title: null, disabledTitles: [], seeded: false }
    }
  }
  return state
}

/** The titles from these claimed achievements. */
export function claimedTitlesOf(claimed: string[]): string[] {
  const ids = new Set(claimed)
  return ACHIEVEMENTS.filter((a) => ids.has(a.id) && a.reward.title).map((a) => a.reward.title!)
}

export function persistAchievementProgress(): void {
  writeText(playerPathFor('achievements.json'), JSON.stringify(getAchievementProgress()))
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
  raidsWon: 'raidsWon',
  draftBattlesWon: 'draftWins'
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
