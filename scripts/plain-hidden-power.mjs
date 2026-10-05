// Hidden Power is one move whose type comes from the Pokemon's IVs. Sets that name a
// typed copy ("Hidden Power Fire", "hiddenpowerfire") become plain Hidden Power, with
// the fewest IVs nudged by one so its IVs still give that type.
//
// Used by build-smogon-sets.mjs; run on its own to convert the shipped data:
//   node scripts/plain-hidden-power.mjs

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const TYPES = ['Fighting', 'Flying', 'Poison', 'Ground', 'Rock', 'Bug', 'Ghost', 'Steel', 'Fire', 'Water', 'Grass', 'Electric', 'Psychic', 'Ice', 'Dragon', 'Dark']
// The order the IVs' odd/even bits count in (the same as src/shared/hidden-power.ts).
const ORDER = ['hp', 'atk', 'def', 'spe', 'spa', 'spd']

// The typed copy's type, or null for anything else (plain Hidden Power included).
function typedHiddenPower(move) {
  const id = String(move).toLowerCase().replace(/[^a-z]/g, '')
  if (!id.startsWith('hiddenpower')) return null
  const type = TYPES.find((t) => t.toLowerCase() === id.slice('hiddenpower'.length))
  return type ?? null
}

// These IVs (missing ones count as 31) with the fewest changed so Hidden Power is this type.
function ivsFor(type, ivs = {}) {
  const full = Object.fromEntries(ORDER.map((s) => [s, ivs[s] ?? 31]))
  let best = null
  for (let bits = 0; bits < 64; bits++) {
    if (TYPES[Math.floor((bits * 15) / 63)] !== type) continue
    const changes = ORDER.filter((s, i) => (full[s] & 1) !== ((bits >> i) & 1)).length
    if (!best || changes < best.changes) best = { bits, changes }
  }
  const out = { ...ivs }
  ORDER.forEach((s, i) => {
    if ((full[s] & 1) !== ((best.bits >> i) & 1)) out[s] = full[s] === 0 ? 1 : full[s] - 1
  })
  return out
}

/** Converts one set in place; true if it changed. */
export function plainHiddenPower(set) {
  if (!Array.isArray(set?.moves)) return false
  let type = null
  const plain = (move) => {
    const t = typedHiddenPower(move)
    if (!t) return move
    type ??= t
    return /\s/.test(move) ? 'Hidden Power' : 'hiddenpower'
  }
  set.moves = set.moves.map((slot) => (Array.isArray(slot) ? [...new Set(slot.map(plain))] : plain(slot)))
  if (!type) return false
  set.ivs = Array.isArray(set.ivs) ? set.ivs.map((ivs) => ivsFor(type, ivs)) : ivsFor(type, set.ivs)
  return true
}

// Run directly: convert the shipped data files.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..')
  const convert = (file, sets) => {
    const path = join(root, file)
    const data = JSON.parse(readFileSync(path, 'utf8'))
    const changed = sets(data).filter(plainHiddenPower).length
    writeFileSync(path, JSON.stringify(data))
    console.log(`${file}: ${changed} sets`)
  }
  convert('src/main/showdown/data/smogon-sets.json', (data) => Object.values(data).flat())
  convert('save/premadeTeams.json', (data) => data.flatMap((team) => team.mons.map((mon) => mon.set)))
}
