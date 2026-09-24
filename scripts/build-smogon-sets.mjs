// Builds src/main/showdown/data/smogon-sets.json - Smogon's published sets for
// every format that has them, merged into one file keyed by species, for the
// Pokemon editor's Auto-fill (see src/main/showdown/auto-sets.ts).
//
// Source: https://pkmn.github.io/smogon/data/sets/<format>.json (the pkmn
// project's export of Smogon's analyses - what Showdown's own teambuilder uses).
//
// Run:  node scripts/build-smogon-sets.mjs
//
// Each species gets its sets in preference order: Gen 9 singles first (OU, Ubers,
// UU, RU, NU, PU, ZU, LC, National Dex), then the same tiers in older generations,
// then the other styles of play (Doubles, Monotype, 1v1).

import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { Dex } = require('pokemon-showdown')
const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const SINGLES_TIERS = [
  ['ou', 'OU'],
  ['ubers', 'Ubers'],
  ['uu', 'UU'],
  ['ru', 'RU'],
  ['nu', 'NU'],
  ['pu', 'PU'],
  ['zu', 'ZU'],
  ['lc', 'LC'],
  ['nationaldex', 'National Dex'],
  ['nationaldexuu', 'National Dex UU']
]
const OTHER_STYLES = [
  ['doublesou', 'Doubles OU'],
  ['monotype', 'Monotype'],
  ['1v1', '1v1']
]
const GENS = [9, 8, 7, 6, 5, 4, 3, 2, 1]

const formats = [
  ...GENS.flatMap((gen) => SINGLES_TIERS.map(([id, name]) => [`gen${gen}${id}`, `Gen ${gen} ${name}`])),
  ...GENS.flatMap((gen) => OTHER_STYLES.map(([id, name]) => [`gen${gen}${id}`, `Gen ${gen} ${name}`]))
]

const bySpecies = {}
let formatsFound = 0
for (const [format, formatName] of formats) {
  const res = await fetch(`https://pkmn.github.io/smogon/data/sets/${format}.json`)
  if (!res.ok) continue
  formatsFound++
  const data = await res.json()
  for (const [speciesName, sets] of Object.entries(data)) {
    const species = Dex.species.get(speciesName)
    if (!species.exists) continue
    // A Mega (or other in-battle forme) is chosen by its item, so its sets belong
    // to the Pokemon you'd actually put on the team.
    const owner = species.battleOnly ? Dex.species.get(species.changesFrom ?? species.baseSpecies) : species
    const list = (bySpecies[owner.id] ??= [])
    for (const [setName, set] of Object.entries(sets)) {
      list.push({ format, formatName, name: setName, ...set })
    }
  }
}

writeFileSync(join(root, 'src/main/showdown/data/smogon-sets.json'), JSON.stringify(bySpecies))
const setCount = Object.values(bySpecies).reduce((n, l) => n + l.length, 0)
console.log(`${formatsFound} formats, ${Object.keys(bySpecies).length} species, ${setCount} sets`)
