import type { LeagueMilestone, TrainerProfile } from '../../shared/battle-types'
import { getProgression } from './progression-store'
import { getStats } from './stats-store'
import { listTrainers } from './trainer-store'

// The road to the Pokemon League, one notch each: Kanto's eight gyms in badge
// order (Radical Red's Viridian gym is Clair's), then the Elite Four and the
// Champion. Each points at the imported trainer for that fight - by import key,
// which survives renaming - and for a gym leader it's the first fight, not the rematch.
const LEAGUE: { importKey: string; label: string; group: LeagueMilestone['group'] }[] = [
  { importKey: 'rr41:0x19e', label: 'Brock', group: 'gym' },
  { importKey: 'rr41:0x19f', label: 'Misty', group: 'gym' },
  { importKey: 'rr41:0x1a0', label: 'Lt. Surge', group: 'gym' },
  { importKey: 'rr41:0x1a1', label: 'Erika', group: 'gym' },
  { importKey: 'rr41:0x1a4', label: 'Sabrina', group: 'gym' },
  { importKey: 'rr41:0x1a2', label: 'Koga', group: 'gym' },
  { importKey: 'rr41:0x1a3', label: 'Blaine', group: 'gym' },
  { importKey: 'rr41:0x4a', label: 'Clair', group: 'gym' },
  { importKey: 'rr41:0x4e', label: 'Lorelei', group: 'eliteFour' },
  { importKey: 'rr41:0x50,0x51', label: 'Bruno', group: 'eliteFour' },
  { importKey: 'rr41:0x53,0x54', label: 'Agatha', group: 'eliteFour' },
  { importKey: 'rr41:0x56,0x57', label: 'Lance', group: 'eliteFour' },
  { importKey: 'rr41:0x1b6,0x1b7,0x1b8', label: 'Champion Blue', group: 'champion' }
]

export function getTrainerProfile(): TrainerProfile {
  const { bossesDefeated } = getProgression()
  const beaten = new Set(bossesDefeated)
  const byKey = new Map(listTrainers().map((t) => [t.importKey, t]))
  return {
    stats: { ...getStats(), bossesDefeated: bossesDefeated.length },
    league: LEAGUE.map(({ importKey, label, group }) => {
      const trainer = byKey.get(importKey)
      return {
        label,
        group,
        spriteId: trainer?.spriteId ?? 'unknown',
        defeated: trainer ? beaten.has(trainer.id) : null
      }
    })
  }
}
