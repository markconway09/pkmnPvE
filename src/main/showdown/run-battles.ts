import type { RunChoice } from '../../shared/battle-types'
import { ROGUELITE_MAX_TEAM, WILD_LOCATIONS, rogueliteBossClassAt, runDifficultyInfo } from '../../shared/battle-types'
import { WildBattle, type OpponentConfig } from './battle-runtime'
import { generateLabWildMon, generateRandomTrainerTeam, generateRandomWildMon } from './sim-access'
import { listTrainers } from './trainer-store'
import { pickRandomPremadeTeam } from './premade-teams-store'
import { scaleTeamToLevel } from './box-store'
import {
  markRunBossUsed,
  runBattleTeam,
  runBossTeamSize,
  runFloorInfo,
  runTrainerTeamSize
} from './run-store'

// Bosses a couple of levels above the floor's regular opponents.
const BOSS_EXTRA_LEVELS = 2
// Wild Pokemon come in anywhere from this many levels under the floor's level up to it.
const WILD_LEVEL_SPREAD = 10

// Normal-mode trainer names carry tags that mean nothing in a run - "(Lv 66)" for the
// level their team is at, "#2" for a second copy - so a run shows the name alone.
function runName(name: string): string {
  return name.replace(/\s*\(Lv [^)]*\)/g, '').replace(/\s*#\d+$/, '').trim() || name
}

function pickOne<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)]
}

/**
 * The battle behind a run floor's wild, trainer or boss choice - the run's own team
 * against an opponent sized to the floor. Always a single battle.
 */
export function createRunBattle(choice: RunChoice): WildBattle {
  const { kind } = choice
  const { sets, conditions } = runBattleTeam()
  const { floor, opponentLevel, bossesBeaten, usedBossIds, difficulty, generation } = runFloorInfo()
  const rules = runDifficultyInfo(difficulty)
  // A trainer's or boss's team size on this difficulty (one more on Hard and up).
  const sized = (count: number): number => Math.min(ROGUELITE_MAX_TEAM, count + rules.extraOpponentMons)
  const run = { conditions, kind }
  let opponent: OpponentConfig

  if (kind === 'wild') {
    // The generator rolls from 14 under the level it's given to 4 under - lifted so the
    // top of that is this floor's level.
    // The location's own pool (the Lab has its own table) - and anywhere at all if the
    // location has nothing that fits this low a level yet.
    const location = WILD_LOCATIONS.find((l) => l.id === choice.location) ?? null
    const wild =
      location?.id === 'lab'
        ? generateLabWildMon(opponentLevel + 4)
        : (generateRandomWildMon(opponentLevel + 4, location) ?? generateRandomWildMon(opponentLevel + 4, null))
    if (!wild) throw new Error('Could not find a wild Pokemon for this floor')
    wild.level = Math.max(opponentLevel - WILD_LEVEL_SPREAD, Math.min(opponentLevel, wild.level))
    opponent = { team: [wild], name: 'Wild', difficulty: rules.aiOverride ?? 'easy', run }
  } else if (kind === 'trainer') {
    // Any regular trainer lends a name, a sprite and a difficulty; the team is a
    // random one sized and levelled for the floor.
    const trainer = pickOne(listTrainers().filter((t) => !t.isBoss && !t.rogueliteBoss))
    if (!trainer) throw new Error('There are no trainers to fight')
    const team = generateRandomTrainerTeam({ count: sized(runTrainerTeamSize(floor)), levelCap: opponentLevel })
    opponent = {
      team,
      name: runName(trainer.name),
      difficulty: rules.aiOverride ?? trainer.difficulty,
      trainerId: trainer.id,
      spriteId: trainer.spriteId,
      run
    }
  } else if (kind === 'boss') {
    // A Roguelite boss this run hasn't fought yet, with one of their own teams set a
    // couple of levels above the floor and trimmed to this boss's size.
    // One of this boss's class (the run goes Gym Leaders, Elite Four, Champion) it hasn't
    // fought yet - a repeat once the class has run out, and any Roguelite boss at all if
    // no boss has that class yet.
    // The best match there is, in order: this class from the run's generation, this class
    // from any generation, anyone from the run's generation, then any Roguelite boss.
    const allBosses = listTrainers().filter((t) => t.rogueliteBoss)
    if (allBosses.length === 0) throw new Error('There are no Roguelite bosses - add some in Debug → Edit Roguelite Bosses')
    const bossClass = rogueliteBossClassAt(bossesBeaten)
    const inGeneration = (t: (typeof allBosses)[number]): boolean => generation === null || t.rogueliteGeneration === generation
    const candidates = [
      allBosses.filter((t) => t.rogueliteClass === bossClass && inGeneration(t)),
      allBosses.filter((t) => t.rogueliteClass === bossClass),
      allBosses.filter(inGeneration),
      allBosses
    ]
    const pool = candidates.find((list) => list.length > 0)!
    const fresh = pool.filter((t) => !usedBossIds.includes(t.id))
    const boss = pickOne(fresh.length > 0 ? fresh : pool)
    markRunBossUsed(boss.id)
    const selection = pickRandomPremadeTeam(boss.id, 100, 6, { anyLevel: true })
    const level = opponentLevel + BOSS_EXTRA_LEVELS
    const full = selection ? scaleTeamToLevel(selection.sets, level) : generateRandomTrainerTeam({ count: 6, levelCap: level })
    opponent = {
      team: full.slice(0, rules.fullBossTeams ? ROGUELITE_MAX_TEAM : sized(runBossTeamSize(bossesBeaten))),
      name: runName(boss.name),
      difficulty: rules.aiOverride ?? boss.difficulty,
      trainerId: boss.id,
      spriteId: boss.spriteId,
      isBoss: true,
      run
    }
  } else {
    throw new Error(`A ${kind} floor isn't a battle`)
  }

  return new WildBattle(sets, 'gen9customgame', 'gen9randombattle', opponent)
}
