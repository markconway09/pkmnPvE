import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { app } from 'electron'

function saveDir(): string {
  // Saves always sit in a plain 'save' folder the player can see: next to the
  // project in dev, and next to pkmnPvE.exe in the packaged (portable) build -
  // which ships with the game data in it - so moving the game to another
  // computer, saves and all, is just copying its folder. (The OS userData folder
  // has also been seen to be silently inaccessible to an unsigned electron.exe.)
  return app.isPackaged ? join(dirname(app.getPath('exe')), 'save') : join(app.getAppPath(), 'save')
}

function ensureDir(dir: string): string {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

/** A file shared by every player: the trainers, premade teams, wild drops, boss order. */
export function savePathFor(filename: string): string {
  return join(ensureDir(saveDir()), filename)
}

/** The folder each player's own save lives under, one sub-folder per player. */
export function playersDir(): string {
  return ensureDir(join(saveDir(), 'players'))
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
  return ensureDir(join(playersDir(), slug))
}

/** A file in the logged-in player's own save. Throws if nobody is logged in. */
export function playerPathFor(filename: string): string {
  if (!currentPlayerSlug) throw new Error('Not logged in')
  return join(playerDirFor(currentPlayerSlug), filename)
}
