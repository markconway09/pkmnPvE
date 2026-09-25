import type { Trainer } from '../../shared/battle-types'
import { hasAnyEligibleTeam } from './premade-teams-store'
import { getNextBoss } from './progression-store'
import { listTrainers } from './trainer-store'

/** Whether a trainer has a team it could field right now (random teams always can). */
export function isTrainerEligible(trainer: Trainer, levelCap: number, playerTeamSize: number): boolean {
  return trainer.teamMode !== 'custom' || hasAnyEligibleTeam(trainer.id, levelCap, playerTeamSize)
}

/**
 * Whether the boss queued next is a Team Rocket event (Giovanni's fights, by default):
 * while it is, the Trainer Battle button only fights Team Rocket members, the way the
 * game leads up to him. Set per boss with its `rocketEvent` flag.
 */
export function isRocketEventActive(): boolean {
  const next = getNextBoss()
  const boss = next ? listTrainers().find((t) => t.id === next.trainerId) : undefined
  return !!boss?.rocketEvent
}

/** Every trainer the Trainer Battle button may pick from right now. */
export function eligibleRandomTrainers(levelCap: number, playerTeamSize: number): Trainer[] {
  const rocketOnly = isRocketEventActive()
  return listTrainers().filter(
    (t) => !t.isBoss && !t.rogueliteBoss && (!rocketOnly || t.teamRocket) && isTrainerEligible(t, levelCap, playerTeamSize)
  )
}
