import { RAID_GIGANTAMAX_CHANCE, RAID_RESTRICTED_CHANCE, RAID_SECRET_SPECIES, RAID_STARS } from '../../shared/battle-types'
import { FIVE_STAR_RESTRICTED_CHANCE, GIGANTAMAX_HUNTER_CHANCE } from '../../shared/titles'
import { fillMoveset, recommendedLearnableMoves } from './auto-sets'
import {
  buildBasicSet,
  getMoveInfo,
  learnableMoveIds,
  levelUpMoveset,
  pickRaidSpecies,
  raidKindOdds,
  raidSpeciesInfo,
  randomNatureName,
  rollWildShiny,
  toID,
  type PokemonSet
} from './sim-access'
import { hasTitle } from './title-perks'
import type { OddsKind } from '../../shared/rarity'

// Showdown can't run a doubles side with only one Pokemon (an empty active slot crashes
// it), so a raid's side brings this one too: it faints the moment it's sent out (see
// WildBattle's raid setup) and every line about it is kept off the battle screen.
export const RAID_PLACEHOLDER_NAME = 'RaidPlaceholder'

export function raidPlaceholderSet(): PokemonSet {
  return { ...buildBasicSet('Magikarp', 1), name: RAID_PLACEHOLDER_NAME, moves: ['splash'] }
}

// A raid boss's Gigantamax and gold chances, with the titles' tilt.
function raidChances(): { gigantamax: number; restricted: number } {
  return {
    gigantamax: hasTitle('Gigantamax Hunter') ? GIGANTAMAX_HUNTER_CHANCE : RAID_GIGANTAMAX_CHANCE,
    restricted: hasTitle('Five-Star') ? FIVE_STAR_RESTRICTED_CHANCE : RAID_RESTRICTED_CHANCE
  }
}

/** The next raid boss's odds of each kind, for the Start button's tooltip. */
export function raidBossKindOdds(): { kinds: OddsKind[] } {
  return { kinds: raidKindOdds(raidChances()) }
}

/**
 * A Max Raid's boss, at this level, with a good moveset for it (Smogon first). Titles
 * can tilt it: Gigantamax Hunter a Gigantamax one, Five-Star a gold one, Starlight
 * a shiny (see rollWildShiny).
 */
export function generateRaidBoss(level: number): RaidBoss {
  const { species, gigantamax, secret } = pickRaidSpecies(raidChances())
  return raidBossOf(species, level, gigantamax, rollWildShiny(true), !!secret)
}

export interface RaidBoss {
  set: PokemonSet
  gigantamax: boolean
  stars: number
  // The secret boss (Eternamax Eternatus): no extra raid HP - its own is huge enough.
  secret: boolean
}

/** Debug: a raid against this species - Gigantamax if it can be. */
export function debugRaidBoss(species: string, level: number, shiny: boolean): RaidBoss {
  const s = raidSpeciesInfo(species)
  return raidBossOf(s.species, level, s.gigantamax, shiny, s.species === RAID_SECRET_SPECIES)
}

function raidBossOf(species: string, level: number, gigantamax: boolean, shiny: boolean, secret: boolean): RaidBoss {
  const set: PokemonSet = {
    ...buildBasicSet(species, level),
    nature: randomNatureName(),
    shiny
  }
  set.moves = raidMoveset(species, level)
  return { set, gigantamax, stars: RAID_STARS, secret }
}

// Attacking moves only: Dynamaxed, every status move is Max Guard, which a raid boss
// would otherwise keep using. Smogon's picks first, then its level-up moves, then the
// strongest of anything else it can learn.
function raidMoveset(species: string, level: number): string[] {
  const attacking = (ids: string[]): string[] =>
    ids.filter((id) => {
      const info = getMoveInfo(toID(id))
      return !!info && info.category !== 'Status'
    })
  const strongest = attacking(learnableMoveIds(toID(species), level)).sort(
    (a, b) => (getMoveInfo(b)?.basePower ?? 0) - (getMoveInfo(a)?.basePower ?? 0)
  )
  return fillMoveset(attacking(recommendedLearnableMoves(species, level)), [
    ...attacking(levelUpMoveset(species, level)),
    ...strongest
  ])
}
