import { RAID_GIGANTAMAX_CHANCE, RAID_RESTRICTED_CHANCE, RAID_STARS } from '../../shared/battle-types'
import { FIVE_STAR_RESTRICTED_CHANCE, GIGANTAMAX_HUNTER_CHANCE } from '../../shared/titles'
import { fillMoveset, recommendedLearnableMoves } from './auto-sets'
import {
  buildBasicSet,
  getMoveInfo,
  learnableMoveIds,
  levelUpMoveset,
  pickRaidSpecies,
  raidRarityOdds,
  randomNatureName,
  rollWildShiny,
  toID,
  type PokemonSet
} from './sim-access'
import { hasTitle } from './title-perks'
import type { RarityOdds } from '../../shared/rarity'

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

/** The next raid boss's odds of each rarity colour, for the Start button's tooltip. */
export function raidBossRarityOdds(): RarityOdds {
  return raidRarityOdds(raidChances())
}

/**
 * A Max Raid's boss, at this level, with a good moveset for it (Smogon first). Titles
 * can tilt it: Gigantamax Hunter a Gigantamax one, Five-Star a gold one, Starlight
 * a shiny (see rollWildShiny).
 */
export function generateRaidBoss(level: number): { set: PokemonSet; gigantamax: boolean; stars: number } {
  const { species, gigantamax } = pickRaidSpecies(raidChances())
  const set: PokemonSet = {
    ...buildBasicSet(species, level),
    nature: randomNatureName(),
    shiny: rollWildShiny(true)
  }
  set.moves = raidMoveset(species, level)
  return { set, gigantamax, stars: RAID_STARS }
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
