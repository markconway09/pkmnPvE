import { ensureDir as makeDir, joinPath, saveRoot } from '../platform'

// Where the save folder sits is up to the platform (see platform/electron.ts).
function saveDir(): string {
  return saveRoot()
}

function ensureDir(dir: string): string {
  makeDir(dir)
  return dir
}

/** A file shared by every player: the trainers, premade teams, wild drops, boss order. */
export function savePathFor(filename: string): string {
  return joinPath(ensureDir(saveDir()), filename)
}

/** The folder each player's own save lives under, one sub-folder per player. */
export function playersDir(): string {
  return ensureDir(joinPath(saveDir(), 'players'))
}

// The player whose save the per-player stores read and write, as a folder name
// (see player-session.ts). Held here rather than in the session module so the
// path helpers below don't have to import it.
let currentPlayerSlug: string | null = null

export function getCurrentPlayerSlug(): string | null {
  return currentPlayerSlug
}

export function setCurrentPlayerSlug(slug: string | null): void {
  currentPlayerSlug = slug
}

/** The folder holding one player's save, created on first use. */
export function playerDirFor(slug: string): string {
  return ensureDir(joinPath(playersDir(), slug))
}

/** A file in the logged-in player's own save. Throws if nobody is logged in. */
export function playerPathFor(filename: string): string {
  if (!currentPlayerSlug) throw new Error('Not logged in')
  return joinPath(playerDirFor(currentPlayerSlug), filename)
}
