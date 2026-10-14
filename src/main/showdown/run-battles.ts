import type { RunChoice } from '../../shared/battle-types'
import {
  ROGUELITE_BOSS_CLASSES,
  ROGUELITE_MAX_TEAM,
  WILD_LOCATIONS,
  rogueliteBossClassAt,
  rollWildWeather,
  runDifficultyInfo
} from '../../shared/battle-types'
import { WildBattle, type CoopFighters, type OpponentConfig } from './battle-runtime'
import { generateLabWildMon, generateRandomTrainerTeam, generateRandomWildMon, type PokemonSet } from './sim-access'
import { listTrainers } from './trainer-store'
import { pickRandomPremadeTeam } from './premade-teams-store'
import { scaleTeamToLevel } from './box-store'
import {
  currentRunSlot,
  markRunBossUsed,
  runBattleTeam,
  runBossTeamSize,
  runFloorInfo,
  runName,
  runTrainerTeamSize,
  runVillainId
} from './run-store'

// Wild Pokemon come in anywhere from this many levels under the floor's level up to it.
const WILD_LEVEL_SPREAD = 10

// A boss or villain fought together in a co-op run brings at least this many - one for
// each of the two Pokemon it faces at a time.
const COOP_MIN_OPPONENTS = 2

function pickOne<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)]
}

/**
 * The battle behind a run floor's wild, trainer or boss choice - the run's own team
 * against an opponent sized to the floor. Always a single battle.
 */
export function createRunBattle(choice: RunChoice): WildBattle {
  const { sets, conditions } = runBattleTeam()
  return new WildBattle(sets, 'gen9customgame', 'gen9randombattle', runOpponent(choice, conditions, false))
}

/**
 * A co-op run's boss or villain, fought together: the host's run team and the friend's on
 * one doubles side - each leading with their first, the rest behind - against the floor's
 * boss or villain (the host's copy picks who, from its own run). Called in the co-op slot.
 */
export function createCoopRunBattle(
  kind: 'boss' | 'villain',
  guest: { sets: PokemonSet[]; conditions: { hp: number; status: string | null }[] },
  fighters: Omit<CoopFighters, 'owners' | 'hostIndices' | 'guestIndices' | 'kind' | 'trainerId' | 'floor'>
): WildBattle {
  const host = runBattleTeam()
  const { floor } = runFloorInfo()
  // The doubles side's order: both leads first (so each player starts with theirs out),
  // then the host's others, then the friend's.
  const order: { owner: 'host' | 'guest'; index: number }[] = [
    { owner: 'host', index: 0 },
    ...(guest.sets.length > 0 ? [{ owner: 'guest' as const, index: 0 }] : []),
    ...host.sets.slice(1).map((_, i) => ({ owner: 'host' as const, index: i + 1 })),
    ...guest.sets.slice(1).map((_, i) => ({ owner: 'guest' as const, index: i + 1 }))
  ]
  const from = (owner: 'host' | 'guest'): typeof host => (owner === 'host' ? host : guest)
  const sets = order.map(({ owner, index }) => from(owner).sets[index])
  const conditions = order.map(({ owner, index }) => from(owner).conditions[index])
  const opponent = runOpponent({ kind }, conditions, true)
  opponent.coop = {
    ...fighters,
    owners: order.map((o) => o.owner),
    hostIndices: order.flatMap((o, i) => (o.owner === 'host' ? [i] : [])),
    guestIndices: order.flatMap((o, i) => (o.owner === 'guest' ? [i] : [])),
    kind,
    trainerId: opponent.trainerId ?? '',
    floor
  }
  return new WildBattle(sets, 'gen9doublescustomgame', 'gen9randombattle', opponent)
}

// The opponent behind a floor's choice, sized and levelled for the floor. `coop`: a fight
// taken on together (a boss or villain), never smaller than COOP_MIN_OPPONENTS.
function runOpponent(choice: RunChoice, conditions: { hp: number; status: string | null }[], coop: boolean): OpponentConfig {
  const { kind } = choice
  const { floor, opponentLevel, bossesBeaten, usedBossIds, difficulty, generation } = runFloorInfo()
  const rules = runDifficultyInfo(difficulty)
  // A trainer's or boss's team size on this difficulty (one more on Hard and up).
  const sized = (count: number): number =>
    Math.max(coop ? COOP_MIN_OPPONENTS : 1, Math.min(ROGUELITE_MAX_TEAM, count + rules.extraOpponentMons))
  // Which run the battle's end goes back to.
  const run = { conditions, kind, slot: currentRunSlot() }

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
    return { team: [wild], name: 'Wild', difficulty: rules.wildAi, run, startField: { weather: rollWildWeather(location?.id) } }
  }
  if (kind === 'trainer') {
    // Any regular trainer lends a name, a sprite and a difficulty; the team is a
    // random one sized and levelled for the floor.
    const trainer = pickOne(listTrainers().filter((t) => !t.isBoss && !t.rogueliteBoss))
    if (!trainer) throw new Error('There are no trainers to fight')
    const team = generateRandomTrainerTeam({ count: sized(runTrainerTeamSize(floor)), levelCap: opponentLevel })
    return {
      team,
      name: runName(trainer.name),
      difficulty: rules.aiOverride ?? trainer.difficulty,
      trainerId: trainer.id,
      spriteId: trainer.spriteId,
      run
    }
  }
  if (kind === 'boss') {
    // A Battle Tower boss this run hasn't fought yet, with one of their own teams set a
    // couple of levels above the floor and trimmed to this boss's size.
    // One of this boss's class (the run goes Gym Leaders, Elite Four, Champion) it hasn't
    // fought yet - a repeat once the class has run out, and any Battle Tower boss at all if
    // no boss has that class yet.
    // The best match there is, in order: this class from the run's generation, this class
    // from any generation, anyone from the run's generation, then any Battle Tower boss.
    // Villains are only ever met in a Villain Takeover, never on a boss floor.
    const isVillain = (t: { rogueliteClass?: string }): boolean =>
      !!ROGUELITE_BOSS_CLASSES.find((c) => c.id === t.rogueliteClass)?.villain
    const allBosses = listTrainers().filter((t) => t.rogueliteBoss && !isVillain(t))
    if (allBosses.length === 0) throw new Error('There are no Battle Tower bosses - add some in Debug → Edit Battle Tower Bosses')
    const bossClass = rogueliteBossClassAt(bossesBeaten, difficulty)
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
    // A boss floor's opponent level is the boss's own (see runOpponentLevel).
    const level = opponentLevel
    const full = selection ? scaleTeamToLevel(selection.sets, level) : generateRandomTrainerTeam({ count: 6, levelCap: level })
    return {
      team: full.slice(0, rules.fullBossTeams ? ROGUELITE_MAX_TEAM : sized(runBossTeamSize(bossesBeaten))),
      name: runName(boss.name),
      difficulty: rules.aiOverride ?? boss.difficulty,
      trainerId: boss.id,
      spriteId: boss.spriteId,
      isBoss: true,
      run,
      startField: { weather: boss.fieldWeather, terrain: boss.fieldTerrain, trickRoom: boss.fieldTrickRoom }
    }
  }
  if (kind === 'villain') {
    // A Villain Takeover's villain: one of their own teams at this floor's level, as big
    // as the next boss's - or a random one if they have none.
    const villain = listTrainers().find((t) => t.id === runVillainId())
    if (!villain) throw new Error('The villain that took this floor over is gone')
    const selection = pickRandomPremadeTeam(villain.id, 100, 6, { anyLevel: true })
    const full = selection
      ? scaleTeamToLevel(selection.sets, opponentLevel)
      : generateRandomTrainerTeam({ count: 6, levelCap: opponentLevel })
    return {
      team: full.slice(0, sized(runBossTeamSize(bossesBeaten))),
      name: runName(villain.name),
      difficulty: rules.aiOverride ?? villain.difficulty,
      trainerId: villain.id,
      spriteId: villain.spriteId,
      run,
      startField: { weather: villain.fieldWeather, terrain: villain.fieldTerrain, trickRoom: villain.fieldTrickRoom }
    }
  }
  throw new Error(`A ${kind} floor isn't a battle`)
}
