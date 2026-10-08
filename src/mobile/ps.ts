import bundle from './vendor/pokemon-showdown.js'

// The mobile build's stand-in for src/main/showdown/ps.ts: the same exports,
// from the browser copy of the sim (built by scripts/build-sim-browser.mjs).

export const sim = bundle.sim as typeof import('pokemon-showdown')
export const battleStream = bundle.battleStream as typeof import('pokemon-showdown/dist/sim/battle-stream.js')

/** The gen 9 Random Battle sets, by species id. */
export function gen9RandomSets(): Record<string, unknown> {
  return bundle.gen9RandomSets
}
