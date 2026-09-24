// Builds src/renderer/src/showdownSpriteNames.json: for every Pokemon form, the file
// name Showdown's website uses for its sprite when it differs from the name of the
// local sprite files.
//
// The local files are named after the species id with no hyphens ("zamazentacrowned",
// "alcremiesaltedcream"), but Showdown puts a hyphen between the base species and
// the form ("zamazenta-crowned", "alcremie-saltedcream"). Shiny sprites aren't kept
// locally - they're fetched from Showdown by name - so they need this mapping.
//
// Run:  node scripts/build-sprite-names.mjs
import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'

const require = createRequire(import.meta.url)
const { Dex, toID } = require('pokemon-showdown')

const species = new Map()
const add = (s) => {
  if (s && s.exists && !species.has(s.id)) species.set(s.id, s)
}
for (const s of Dex.species.all()) {
  add(s)
  for (const f of s.cosmeticFormes ?? []) add(Dex.species.get(f))
  for (const f of s.otherFormes ?? []) add(Dex.species.get(f))
}

const names = {}
for (const s of [...species.values()].sort((a, b) => a.id.localeCompare(b.id))) {
  if (!s.forme || s.num <= 0) continue
  const showdown = `${toID(s.baseSpecies)}-${toID(s.forme)}`
  if (showdown !== s.id) names[s.id] = showdown
}

const out = new URL('../src/renderer/src/showdownSpriteNames.json', import.meta.url)
writeFileSync(out, JSON.stringify(names) + '\n')
console.log(`wrote ${Object.keys(names).length} forms to ${out.pathname}`)
