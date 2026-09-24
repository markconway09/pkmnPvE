import { createRequire } from 'node:module'
import { EXP_DATA } from './exp-data'

const require = createRequire(import.meta.url)
const { Dex, toID } = require('pokemon-showdown') as typeof import('pokemon-showdown')

// S=slow, M=medium (Medium Fast), F=fast, MS=medium-slow (Medium Slow),
// E=erratic, L=fluctuating - the six standard growth rate curves.
export type GrowthRateCode = 'S' | 'M' | 'F' | 'MS' | 'E' | 'L'

interface ExpInfo {
  baseExp: number
  growthRate: GrowthRateCode
}

let byNormalizedId: Map<string, ExpInfo> | null = null

function table(): Map<string, ExpInfo> {
  if (!byNormalizedId) {
    byNormalizedId = new Map()
    for (const [identifier, [baseExp, growthRate]] of Object.entries(EXP_DATA)) {
      byNormalizedId.set(toID(identifier), { baseExp, growthRate: growthRate as GrowthRateCode })
    }
  }
  return byNormalizedId
}

// PokeAPI's species identifiers don't always line up with Showdown's species
// names 1:1 (regional forms, alt formes, punctuation) - falling back through
// the species' own id, its baseSpecies, and the part of its name before the
// first hyphen (the "Raichu-Alola" -> "Raichu" pattern) covers every species
// in the current Dex (verified against all of them when this table was
// vendored).
export function getExpInfo(speciesName: string): ExpInfo {
  const species = Dex.species.get(speciesName)
  const candidates = [toID(species.name)]
  if (species.baseSpecies && species.baseSpecies !== species.name) candidates.push(toID(species.baseSpecies))
  const dashIndex = species.name.indexOf('-')
  if (dashIndex > 0) candidates.push(toID(species.name.slice(0, dashIndex)))
  const t = table()
  for (const c of candidates) {
    const hit = t.get(c)
    if (hit) return hit
  }
  // Unreachable for any real Dex species (see above), but a sane fallback
  // beats throwing if the Dex ever adds something this table hasn't seen.
  return { baseExp: 100, growthRate: 'M' }
}

// The six standard Pokemon growth-rate curves - total experience needed to
// reach a given level. Formulas straight from PokeAPI's growth_rates data
// (https://github.com/PokeAPI/pokeapi), which isn't itself part of
// pokemon-showdown.
export function totalExpForLevel(rate: GrowthRateCode, level: number): number {
  const x = Math.max(1, Math.min(100, Math.round(level)))
  if (x <= 1) return 0
  switch (rate) {
    case 'S':
      return Math.floor((5 * x ** 3) / 4)
    case 'M':
      return x ** 3
    case 'F':
      return Math.floor((4 * x ** 3) / 5)
    case 'MS':
      return Math.floor((6 * x ** 3) / 5 - 15 * x ** 2 + 100 * x - 140)
    case 'E':
      if (x <= 50) return Math.floor((x ** 3 * (100 - x)) / 50)
      if (x <= 68) return Math.floor((x ** 3 * (150 - x)) / 100)
      if (x <= 98) {
        const m = x % 3
        return Math.floor((x ** 3 * (1274 + m * m - 9 * m - 20 * Math.floor(x / 3))) / 1000)
      }
      return Math.floor((x ** 3 * (160 - x)) / 100)
    case 'L':
      if (x <= 15) return Math.floor((x ** 3 * (24 + Math.floor((x + 1) / 3))) / 50)
      if (x <= 35) return Math.floor((x ** 3 * (14 + x)) / 50)
      return Math.floor((x ** 3 * (32 + Math.floor(x / 2))) / 50)
  }
}

export function levelForExp(rate: GrowthRateCode, exp: number): number {
  let level = 1
  for (let l = 2; l <= 100; l++) {
    if (totalExpForLevel(rate, l) <= exp) level = l
    else break
  }
  return level
}

export function totalExpForSpeciesLevel(speciesName: string, level: number): number {
  return totalExpForLevel(getExpInfo(speciesName).growthRate, level)
}

// The classic mainline "how much exp does defeating this Pokemon give"
// formula (base experience * level / 7), summed across a whole team to
// award as a flat bonus to every Pokemon on the player's team after a win.
export function expYieldFor(speciesName: string, level: number): number {
  const { baseExp } = getExpInfo(speciesName)
  return Math.floor((baseExp * level) / 7)
}

export interface ExpProgress {
  intoLevel: number
  forNextLevel: number
  percent: number
}

// Progress toward the NEXT level, given the Pokemon's current (already
// level-cap-clamped) level and its raw accumulated exp - not re-derived from
// exp alone, so a Pokemon sitting at the level cap with banked exp shows a
// capped bar instead of implying a level past what it's actually usable at.
export function expProgressForLevel(speciesName: string, level: number, exp: number): ExpProgress {
  const { growthRate } = getExpInfo(speciesName)
  const levelFloor = totalExpForLevel(growthRate, level)
  const nextFloor = level >= 100 ? levelFloor : totalExpForLevel(growthRate, level + 1)
  const span = nextFloor - levelFloor
  const intoLevel = Math.max(0, exp - levelFloor)
  const percent = level >= 100 || span <= 0 ? 100 : Math.min(100, Math.floor((intoLevel / span) * 100))
  return { intoLevel, forNextLevel: span, percent }
}
