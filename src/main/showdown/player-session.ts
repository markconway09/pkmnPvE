import { copyFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import type { SessionInfo } from '../../shared/battle-types'
import { normalizeUsername, usernameProblem } from '../../shared/battle-types'
import {
  getCurrentPlayerSlug,
  playerDirFor,
  playersDir,
  savePathFor,
  setCurrentPlayerSlug
} from './save-paths'

/**
 * Who is playing, and where their save lives. Every player has a folder under
 * save/players/, named by their username in lower case (names aren't
 * case-sensitive); the stores that hold a player's own data (box, bag, money,
 * progress) read and write inside it, while trainers, premade teams, wild
 * drops and the boss order stay shared by everyone.
 */

interface Profile {
  displayName: string
  trainerSprite: string | null
  // Granted by adding "admin": true to the player's profile.json by hand - there
  // is deliberately no way to switch it on from inside the game.
  admin: boolean
}

interface SessionFile {
  // The player to log straight back in as at launch (set by "remember me").
  remembered: string | null
  // The last name used, to pre-fill the login box.
  last: string | null
}

// The stores cache what they read, so each registers here to drop that cache
// whenever the player changes.
const playerChangeListeners: (() => void)[] = []

export function onPlayerChange(listener: () => void): void {
  playerChangeListeners.push(listener)
}

function notifyPlayerChanged(): void {
  for (const listener of playerChangeListeners) listener()
}

function slugFor(name: string): string {
  return normalizeUsername(name).toLowerCase()
}

function readJson<T>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') console.error(`[player-session] failed to read ${path}:`, e)
    return null
  }
}

function readSession(): SessionFile {
  const parsed = readJson<SessionFile>(savePathFor('session.json'))
  return { remembered: parsed?.remembered ?? null, last: parsed?.last ?? null }
}

function writeSession(session: SessionFile): void {
  writeFileSync(savePathFor('session.json'), JSON.stringify(session), 'utf8')
}

function profilePath(slug: string): string {
  return join(playerDirFor(slug), 'profile.json')
}

function readProfile(slug: string): Profile | null {
  const parsed = readJson<Profile>(profilePath(slug))
  if (!parsed || typeof parsed.displayName !== 'string') return null
  return { displayName: parsed.displayName, trainerSprite: parsed.trainerSprite ?? null, admin: parsed.admin === true }
}

function writeProfile(slug: string, profile: Profile): void {
  writeFileSync(profilePath(slug), JSON.stringify(profile), 'utf8')
}

function playerSlugs(): string[] {
  return readdirSync(playersDir(), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
}

/** The folder name of an existing player, or null. Never creates anything. */
export function findPlayerSlug(username: string): string | null {
  if (usernameProblem(username)) return null
  const slug = slugFor(username)
  return existsSync(join(playersDir(), slug)) ? slug : null
}

// A save from before there were players lives loose in the shared folder. The
// first player ever created takes it over, so nothing already earned is lost:
// the files are copied (the originals stay put as a backup), and the progress
// half of progression.json is split out - the boss order half is shared and
// the progression store migrates it on its own.
function adoptLegacySave(slug: string): void {
  const dir = playerDirFor(slug)
  for (const file of ['box.json', 'bag.json', 'money.json']) {
    const source = savePathFor(file)
    if (existsSync(source)) copyFileSync(source, join(dir, file))
  }
  const legacy = readJson<{ levelCap?: number; bossesDefeated?: string[]; trainerWinsSinceLastBoss?: number }>(
    savePathFor('progression.json')
  )
  if (legacy && typeof legacy.levelCap === 'number') {
    writeFileSync(
      join(dir, 'progression.json'),
      JSON.stringify({
        levelCap: legacy.levelCap,
        bossesDefeated: legacy.bossesDefeated ?? [],
        trainerWinsSinceLastBoss: legacy.trainerWinsSinceLastBoss ?? 0
      }),
      'utf8'
    )
  }
}

function currentProfile(): Profile | null {
  const slug = getCurrentPlayerSlug()
  return slug ? readProfile(slug) : null
}

export function getSessionInfo(): SessionInfo {
  const profile = currentProfile()
  return {
    username: profile?.displayName ?? null,
    lastUsername: readSession().last,
    players: playerSlugs()
      .map((slug) => readProfile(slug)?.displayName ?? slug)
      .sort((a, b) => a.localeCompare(b)),
    trainerSprite: profile?.trainerSprite ?? null,
    isAdmin: profile?.admin === true,
    rememberByDefault: !app.isPackaged
  }
}

/** Whether the logged-in player is an admin. */
export function isAdmin(): boolean {
  return currentProfile()?.admin === true
}

/** For handlers only admins may use: throws for anyone else. */
export function requireAdmin(): void {
  if (!isAdmin()) throw new Error('This needs an admin account')
}

/** Logs in as a player, creating their save if the name is new. */
export function login(username: string, remember: boolean): SessionInfo {
  const problem = usernameProblem(username)
  if (problem) throw new Error(problem)
  const slug = slugFor(username)

  const isFirstPlayerEver = playerSlugs().length === 0
  const isNewPlayer = !existsSync(join(playersDir(), slug))
  playerDirFor(slug)
  if (isNewPlayer && isFirstPlayerEver) adoptLegacySave(slug)

  const profile = readProfile(slug) ?? { displayName: normalizeUsername(username), trainerSprite: null, admin: false }
  writeProfile(slug, profile)

  setCurrentPlayerSlug(slug)
  notifyPlayerChanged()
  writeSession({ remembered: remember ? profile.displayName : null, last: profile.displayName })
  return getSessionInfo()
}

/** Logs out, and stops remembering the login. */
export function logout(): SessionInfo {
  const session = readSession()
  setCurrentPlayerSlug(null)
  notifyPlayerChanged()
  writeSession({ remembered: null, last: session.last })
  return getSessionInfo()
}

/** Called once at launch: logs straight back in as the remembered player, if there is one. */
export function restoreRememberedSession(): void {
  const { remembered } = readSession()
  if (!remembered) return
  const slug = findPlayerSlug(remembered)
  if (!slug) return
  setCurrentPlayerSlug(slug)
  notifyPlayerChanged()
}

export function setTrainerSprite(spriteId: string): SessionInfo {
  const slug = getCurrentPlayerSlug()
  if (!slug) throw new Error('Not logged in')
  const profile = readProfile(slug) ?? { displayName: slug, trainerSprite: null, admin: false }
  writeProfile(slug, { ...profile, trainerSprite: spriteId })
  return getSessionInfo()
}

export interface PlayerSummary {
  slug: string
  displayName: string
  trainerSprite: string | null
}

/** Another player's public details, or null if there is no such player. */
export function getPlayerSummary(username: string): PlayerSummary | null {
  const slug = findPlayerSlug(username)
  if (!slug) return null
  const profile = readProfile(slug)
  return { slug, displayName: profile?.displayName ?? slug, trainerSprite: profile?.trainerSprite ?? null }
}
