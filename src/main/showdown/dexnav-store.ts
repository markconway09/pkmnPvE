import { readFileSync, writeFileSync } from 'node:fs'
import type { PokemonSet } from 'pokemon-showdown/dist/sim/teams.js'
import { DEXNAV_ITEM_ID, type WildLocationConfig } from '../../shared/battle-types'
import {
  DEXNAV_MAX_CHAIN,
  PROFESSOR_DEXNAV_MAX_CHAIN,
  dexNavChance,
  dexNavShinyMultiplier,
  type DexNavCandidate,
  type DexNavState
} from '../../shared/dexnav'
import { playerPathFor } from './save-paths'
import { hasTitle } from './title-perks'
import { onPlayerChange } from './player-session'
import { hasItem } from './bag-store'
import { getPokedex, hasRegisteredSpecies } from './box-store'
import { dexNavHuntInfo, generateHuntedMon, speciesRarityTier } from './sim-access'

// The DexNav's hunt: the species being hunted, and how long the chain of them has run.
interface StoredDexNav {
  target: string | null
  chain: number
}

function defaultDexNav(): StoredDexNav {
  return { target: null, chain: 0 }
}

function load(): StoredDexNav {
  const path = playerPathFor('dexnav.json')
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<StoredDexNav>
    return {
      target: typeof parsed.target === 'string' ? parsed.target : null,
      chain: typeof parsed.chain === 'number' ? Math.max(0, Math.floor(parsed.chain)) : 0
    }
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code
    if (code !== 'ENOENT') console.error('[dexnav-store] failed to load dexnav.json:', e)
    return defaultDexNav()
  }
}

let state: StoredDexNav | null = null

// Each player hunts on their own: forget the cached hunt when the player changes.
onPlayerChange(() => {
  state = null
})

function getState(): StoredDexNav {
  if (!state) state = load()
  return state
}

function persist(): void {
  writeFileSync(playerPathFor('dexnav.json'), JSON.stringify(getState()), 'utf8')
}

function candidateFor(species: string, num: number): DexNavCandidate | null {
  const info = dexNavHuntInfo(species)
  return info ? { species, num, ...info, rarityTier: speciesRarityTier(species) } : null
}

// Where the chain stops counting: sooner with the Professor title.
function maxChain(): number {
  return hasTitle('Professor') ? PROFESSOR_DEXNAV_MAX_CHAIN : DEXNAV_MAX_CHAIN
}

// The chain as it counts right now - a longer one kept from before Professor was turned on
// counts as the max.
function effectiveChain(): number {
  return Math.min(getState().chain, maxChain())
}

export function getDexNavState(): DexNavState {
  const s = getState()
  return {
    owned: hasItem(DEXNAV_ITEM_ID),
    target: s.target ? candidateFor(s.target, getPokedex().find((e) => e.species === s.target)?.num ?? 0) : null,
    chain: effectiveChain(),
    maxChain: maxChain()
  }
}

/** Every species the DexNav can hunt right now: registered in the Pokedex, and found in the wild. */
export function listDexNavCandidates(): DexNavCandidate[] {
  return getPokedex()
    .filter((e) => e.registered)
    .flatMap((e) => {
      const candidate = candidateFor(e.species, e.num)
      return candidate ? [candidate] : []
    })
}

/** Picks the species to hunt (or none) - a new target starts a new chain. */
export function setDexNavTarget(species: string | null): DexNavState {
  if (!hasItem(DEXNAV_ITEM_ID)) throw new Error('You need the DexNav for that')
  const s = getState()
  if (species === null) {
    s.target = null
    s.chain = 0
  } else {
    if (!hasRegisteredSpecies(species)) throw new Error(`${species} isn't registered in your Pokédex yet`)
    if (!dexNavHuntInfo(species)) throw new Error(`${species} can't be found in the wild`)
    if (s.target !== species) s.chain = 0
    s.target = species
  }
  persist()
  return getDexNavState()
}

/**
 * A wild battle's roll for the hunted Pokemon: with the DexNav and a target that can live
 * in this area (Anywhere always counts, never the Lab) at this level, it's met at the
 * chain's chance. Null leaves the battle to the usual wild roll.
 */
export function rollDexNavEncounter(location: WildLocationConfig | null, levelCap: number): PokemonSet | null {
  const s = getState()
  if (!s.target || !hasItem(DEXNAV_ITEM_ID)) return null
  if (location?.requiresAllBosses) return null
  const info = dexNavHuntInfo(s.target)
  if (!info || info.minLevel > levelCap) return null
  if (location && location.id !== 'all' && !info.locations.includes(location.id)) return null
  if (Math.random() >= dexNavChance(s.chain, maxChain())) return null
  return generateHuntedMon(s.target, levelCap, dexNavShinyMultiplier(s.chain, maxChain()))
}

/** A hunted Pokemon beaten (or caught): the chain grows, up to its max. */
export function extendDexNavChain(): void {
  const s = getState()
  if (s.chain >= maxChain()) return
  s.chain++
  persist()
}

/** Run from, or lost to, a hunted Pokemon: the chain starts over. */
export function breakDexNavChain(): void {
  const s = getState()
  if (s.chain === 0) return
  s.chain = 0
  persist()
}
