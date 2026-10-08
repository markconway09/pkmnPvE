import { createRequire } from 'node:module'

// The one place the game loads pokemon-showdown. It is CommonJS; Node's static
// named-export detection misses some of it under ESM, so it is loaded via
// require(). The mobile build swaps this file for src/mobile/ps.ts, which
// loads the browser copy of the sim instead (scripts/build-sim-browser.mjs).
const require = createRequire(import.meta.url)

export const sim = require('pokemon-showdown') as typeof import('pokemon-showdown')
export const battleStream = require('pokemon-showdown/dist/sim/battle-stream.js') as typeof import(
  'pokemon-showdown/dist/sim/battle-stream.js'
)

/** The gen 9 Random Battle sets, by species id. */
export function gen9RandomSets(): Record<string, unknown> {
  return require('pokemon-showdown/dist/data/random-battles/gen9/sets.json') as Record<string, unknown>
}
