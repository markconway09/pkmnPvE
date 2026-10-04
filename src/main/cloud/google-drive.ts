import { createHash, randomBytes } from 'node:crypto'
import { createServer } from 'node:http'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync, gzipSync } from 'node:zlib'
import { app, safeStorage, shell } from 'electron'
import type { CloudSave, CloudStatus } from '../../shared/cloud'
import { getCurrentPlayerSlug, playerDirFor } from '../showdown/save-paths'
import { reloadPlayerSave } from '../showdown/player-session'

/**
 * Cloud saves on Google Drive. Each player connects their own Google account (OAuth for
 * desktop apps: Google's sign-in page in the browser, which hands back to a one-off
 * listener on this computer), and their save folder is exported as a single file into
 * Drive's hidden app-data folder - a folder only this game can see, so it never touches
 * anything else in their Drive. Importing brings one back over the current save, which
 * is backed up first.
 */

const CLIENT_ID = import.meta.env.MAIN_VITE_GOOGLE_CLIENT_ID
// A desktop app's "secret" isn't one - anyone could read it out of the game - and Google
// treats it that way; each player's own sign-in is what grants access.
const CLIENT_SECRET = import.meta.env.MAIN_VITE_GOOGLE_CLIENT_SECRET
const SCOPES = 'https://www.googleapis.com/auth/drive.appdata openid email'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const DRIVE = 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3'
// How long the browser sign-in may take before it's given up on.
const SIGN_IN_TIMEOUT_MS = 5 * 60 * 1000
// Exports kept in the cloud for each player (older ones are deleted), and local backups
// of the save an import replaced.
const CLOUD_SAVES_KEPT = 5
const LOCAL_BACKUPS_KEPT = 5

// Never part of an export: the connection itself, and the local backups.
const CLOUD_FILE = 'cloud.json'
const BACKUPS_DIR = 'backups'
const SAVE_FORMAT = 'pkmnpve-save'

interface StoredConnection {
  email: string | null
  // The refresh token, encrypted with Electron's safeStorage (this computer's user
  // account) when that's available.
  refreshToken: string
  encrypted: boolean
}

interface SaveBundle {
  format: typeof SAVE_FORMAT
  version: 1
  exportedAt: string
  appVersion: string
  // Each file in the save folder, base64.
  files: Record<string, string>
}

function isAvailable(): boolean {
  return !!CLIENT_ID && !!CLIENT_SECRET
}

function currentSlug(): string {
  const slug = getCurrentPlayerSlug()
  if (!slug) throw new Error('Not logged in')
  return slug
}

function connectionPath(slug: string): string {
  return join(playerDirFor(slug), CLOUD_FILE)
}

function readConnection(slug: string): StoredConnection | null {
  try {
    const parsed = JSON.parse(readFileSync(connectionPath(slug), 'utf8')) as StoredConnection
    return typeof parsed.refreshToken === 'string' ? parsed : null
  } catch {
    return null
  }
}

function refreshTokenOf(connection: StoredConnection): string | null {
  if (!connection.encrypted) return connection.refreshToken
  try {
    return safeStorage.decryptString(Buffer.from(connection.refreshToken, 'base64'))
  } catch {
    // Encrypted on another computer (the game folder was copied): connect again.
    return null
  }
}

function saveConnection(slug: string, refreshToken: string, email: string | null): void {
  const encrypted = safeStorage.isEncryptionAvailable()
  const stored: StoredConnection = {
    email,
    refreshToken: encrypted ? safeStorage.encryptString(refreshToken).toString('base64') : refreshToken,
    encrypted
  }
  writeFileSync(connectionPath(slug), JSON.stringify(stored), 'utf8')
}

function forgetConnection(slug: string): void {
  rmSync(connectionPath(slug), { force: true })
  accessTokens.delete(slug)
}

export function getCloudStatus(): CloudStatus {
  if (!isAvailable()) return { available: false, connected: false, email: null }
  const connection = readConnection(currentSlug())
  const connected = !!connection && refreshTokenOf(connection) !== null
  return { available: true, connected, email: connected ? connection!.email : null }
}

// ---- Signing in

function base64url(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// The email in a Google ID token (its payload is plain base64url JSON).
function emailFromIdToken(idToken: string | undefined): string | null {
  try {
    const payload = JSON.parse(Buffer.from(idToken!.split('.')[1], 'base64url').toString('utf8')) as { email?: string }
    return payload.email ?? null
  } catch {
    return null
  }
}

const SIGNED_IN_PAGE = `<!doctype html><meta charset="utf-8"><title>pkmnPvE</title>
<body style="font-family:sans-serif;background:#10141a;color:#e6e6e6;display:grid;place-items:center;height:100vh;margin:0">
<div style="text-align:center"><h2>Google Drive connected</h2><p>You can close this tab and go back to pkmnPvE.</p></div>`

const FAILED_PAGE = `<!doctype html><meta charset="utf-8"><title>pkmnPvE</title>
<body style="font-family:sans-serif;background:#10141a;color:#e6e6e6;display:grid;place-items:center;height:100vh;margin:0">
<div style="text-align:center"><h2>Google Drive wasn't connected</h2><p>You can close this tab and try again from pkmnPvE.</p></div>`

// Opens Google's sign-in page in the browser and waits for it to hand back a code on a
// one-off listener at 127.0.0.1 (PKCE-protected), which is then traded for tokens.
function signInInBrowser(): Promise<{ code: string; redirectUri: string; verifier: string }> {
  const verifier = base64url(randomBytes(32))
  const challenge = base64url(createHash('sha256').update(verifier).digest())
  const state = base64url(randomBytes(16))
  return new Promise((resolve, reject) => {
    let settled = false
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1')
      const code = url.searchParams.get('code')
      const error = url.searchParams.get('error')
      if (!code && !error) {
        // A stray request (a favicon, say) - not the sign-in coming back.
        res.writeHead(404).end()
        return
      }
      const ok = !!code && url.searchParams.get('state') === state
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(ok ? SIGNED_IN_PAGE : FAILED_PAGE)
      finish(() =>
        ok
          ? resolve({ code: code!, redirectUri, verifier })
          : reject(new Error(error === 'access_denied' ? 'Google Drive access was declined' : 'Signing in to Google failed'))
      )
    })
    let redirectUri = ''
    const timer = setTimeout(() => finish(() => reject(new Error('Signing in to Google took too long'))), SIGN_IN_TIMEOUT_MS)
    function finish(settle: () => void): void {
      if (settled) return
      settled = true
      clearTimeout(timer)
      server.close()
      settle()
    }
    server.on('error', (e) => finish(() => reject(e)))
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        finish(() => reject(new Error('Could not start the sign-in listener')))
        return
      }
      redirectUri = `http://127.0.0.1:${address.port}`
      const params = new URLSearchParams({
        client_id: CLIENT_ID!,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: SCOPES,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        state,
        // A refresh token, so the player only signs in once.
        access_type: 'offline',
        prompt: 'consent'
      })
      void shell.openExternal(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
    })
  })
}

interface TokenResponse {
  access_token?: string
  expires_in?: number
  refresh_token?: string
  id_token?: string
  // The permissions actually granted, space-separated.
  scope?: string
  error?: string
  error_description?: string
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID!, client_secret: CLIENT_SECRET!, ...body })
  })
  return (await res.json()) as TokenResponse
}

/** Connects the logged-in player's Google Drive: Google's sign-in opens in the browser. */
export async function connectCloud(): Promise<CloudStatus> {
  if (!isAvailable()) throw new Error("Cloud saves aren't set up in this copy of the game")
  const slug = currentSlug()
  const { code, redirectUri, verifier } = await signInInBrowser()
  const tokens = await tokenRequest({
    code,
    code_verifier: verifier,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code'
  })
  if (!tokens.refresh_token || !tokens.access_token) {
    throw new Error(`Google didn't grant access${tokens.error_description ? `: ${tokens.error_description}` : ''}`)
  }
  // Google's sign-in lets each permission be unticked; without the Drive one every
  // request is refused, so it's caught here rather than on the first export.
  if (tokens.scope && !tokens.scope.split(' ').includes('https://www.googleapis.com/auth/drive.appdata')) {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(tokens.refresh_token)}`, {
      method: 'POST'
    }).catch(() => {})
    throw new Error("Google Drive access wasn't granted - tick the box that lets pkmnPvE use its own Drive folder")
  }
  saveConnection(slug, tokens.refresh_token, emailFromIdToken(tokens.id_token))
  accessTokens.set(slug, { token: tokens.access_token, expiresAt: Date.now() + (tokens.expires_in ?? 3600) * 1000 })
  return getCloudStatus()
}

/** Disconnects: Google is told to revoke the access, and this computer forgets it. */
export async function disconnectCloud(): Promise<CloudStatus> {
  const slug = currentSlug()
  const connection = readConnection(slug)
  const refreshToken = connection ? refreshTokenOf(connection) : null
  forgetConnection(slug)
  if (refreshToken) {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`, {
      method: 'POST'
    }).catch(() => {})
  }
  return getCloudStatus()
}

// ---- Talking to Drive

const accessTokens = new Map<string, { token: string; expiresAt: number }>()

async function accessToken(slug: string): Promise<string> {
  const cached = accessTokens.get(slug)
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token
  const connection = readConnection(slug)
  const refreshToken = connection ? refreshTokenOf(connection) : null
  if (!refreshToken) throw new Error('Connect Google Drive first')
  const tokens = await tokenRequest({ refresh_token: refreshToken, grant_type: 'refresh_token' })
  if (!tokens.access_token) {
    // Revoked, expired (a test app's tokens last a week) or the password changed.
    if (tokens.error === 'invalid_grant') forgetConnection(slug)
    throw new Error('Google Drive needs connecting again')
  }
  accessTokens.set(slug, { token: tokens.access_token, expiresAt: Date.now() + (tokens.expires_in ?? 3600) * 1000 })
  return tokens.access_token
}

async function drive(slug: string, url: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${await accessToken(slug)}` }
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    console.error('[cloud] Drive request failed:', res.status, detail)
    throw new Error(driveRefusal(slug, res.status, detail))
  }
  return res
}

// What a refused Drive request means for the player. The two usual 403s: the Drive API
// isn't switched on in the game's Google Cloud project, or the player left the "see its
// own Drive folder" box unticked when signing in (that connection is then forgotten, so
// connecting again asks for it).
function driveRefusal(slug: string, status: number, detail: string): string {
  let reason = ''
  let message = ''
  try {
    const error = (JSON.parse(detail) as { error?: { message?: string; errors?: { reason?: string }[]; details?: { reason?: string }[] } }).error
    reason = [...(error?.errors ?? []), ...(error?.details ?? [])].map((e) => e.reason ?? '').join(' ')
    message = error?.message ?? ''
  } catch {
    // Not JSON - fall back to the bare status.
  }
  if (/accessNotConfigured|SERVICE_DISABLED/.test(reason)) {
    return "The Google Drive API isn't turned on for this game's Google Cloud project"
  }
  if (/insufficientPermissions|ACCESS_TOKEN_SCOPE_INSUFFICIENT/.test(reason)) {
    forgetConnection(slug)
    return 'Google Drive access wasn\'t granted - connect again and tick the box that lets pkmnPvE use its own Drive folder'
  }
  return `Google Drive refused that (${status}${message ? `: ${message}` : ''})`
}

interface DriveFile {
  id: string
  createdTime: string
  appProperties?: Record<string, string>
}

async function listDriveSaves(slug: string): Promise<DriveFile[]> {
  const q = `appProperties has { key='player' and value='${slug}' } and trashed = false`
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    q,
    fields: 'files(id,createdTime,appProperties)',
    orderBy: 'createdTime desc',
    pageSize: '50'
  })
  const res = await drive(slug, `${DRIVE}/files?${params}`)
  return ((await res.json()) as { files: DriveFile[] }).files
}

/** The logged-in player's saves on Drive, newest first. */
export async function listCloudSaves(): Promise<CloudSave[]> {
  const files = await listDriveSaves(currentSlug())
  const num = (value: string | undefined): number | null => (value && Number.isFinite(Number(value)) ? Number(value) : null)
  return files.map((f) => ({
    id: f.id,
    createdAt: f.createdTime,
    pokemon: num(f.appProperties?.pokemon),
    money: num(f.appProperties?.money),
    appVersion: f.appProperties?.appVersion ?? null
  }))
}

// ---- Packing a save

// The files an export carries: everything directly in the save folder, but not the
// connection or the backups.
function saveFileNames(dir: string): string[] {
  return readdirSync(dir).filter((name) => name !== CLOUD_FILE && statSync(join(dir, name)).isFile())
}

function readJsonIn(dir: string, name: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(join(dir, name), 'utf8')) as Record<string, unknown>
  } catch {
    return null
  }
}

/** Uploads the logged-in player's save to Drive (keeping the last few exports). */
export async function exportToCloud(): Promise<CloudSave[]> {
  const slug = currentSlug()
  const dir = playerDirFor(slug)
  const bundle: SaveBundle = {
    format: SAVE_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    appVersion: app.getVersion(),
    files: Object.fromEntries(saveFileNames(dir).map((name) => [name, readFileSync(join(dir, name)).toString('base64')]))
  }
  const box = readJsonIn(dir, 'box.json')
  const money = readJsonIn(dir, 'money.json')
  const metadata = {
    name: `pkmnpve-${slug}-${bundle.exportedAt.replace(/[:.]/g, '-')}.pkmnsave`,
    parents: ['appDataFolder'],
    appProperties: {
      player: slug,
      appVersion: bundle.appVersion,
      pokemon: String(Array.isArray(box?.mons) ? box.mons.length : ''),
      money: String(typeof money?.amount === 'number' ? money.amount : '')
    }
  }
  const boundary = `pkmnpve${randomBytes(12).toString('hex')}`
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
        `--${boundary}\r\nContent-Type: application/gzip\r\n\r\n`
    ),
    gzipSync(Buffer.from(JSON.stringify(bundle), 'utf8')),
    Buffer.from(`\r\n--${boundary}--`)
  ])
  await drive(slug, `${DRIVE_UPLOAD}/files?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body
  })
  // Only the newest few are kept.
  const saves = await listDriveSaves(slug)
  for (const old of saves.slice(CLOUD_SAVES_KEPT)) {
    await drive(slug, `${DRIVE}/files/${old.id}`, { method: 'DELETE' }).catch(() => {})
  }
  return listCloudSaves()
}

// A file name from a download is only ever a plain name in the save folder - never a
// path somewhere else, and never the connection.
function isSafeFileName(name: string): boolean {
  return /^[A-Za-z0-9_.-]+$/.test(name) && name !== CLOUD_FILE && name !== '.' && name !== '..'
}

// Copies the current save into backups/<time>/, keeping only the newest few.
function backUpSave(dir: string): void {
  const backups = join(dir, BACKUPS_DIR)
  const target = join(backups, new Date().toISOString().replace(/[:.]/g, '-'))
  mkdirSync(target, { recursive: true })
  for (const name of saveFileNames(dir)) writeFileSync(join(target, name), readFileSync(join(dir, name)))
  const all = readdirSync(backups).sort()
  for (const old of all.slice(0, Math.max(0, all.length - LOCAL_BACKUPS_KEPT))) {
    rmSync(join(backups, old), { recursive: true, force: true })
  }
}

/**
 * Replaces the logged-in player's save with one from Drive. The current save is backed
 * up to backups/ first, and the player's own name and admin status stay as they are.
 */
export async function importFromCloud(fileId: string): Promise<void> {
  const slug = currentSlug()
  if (!(await listDriveSaves(slug)).some((f) => f.id === fileId)) throw new Error("That save isn't one of yours")
  const res = await drive(slug, `${DRIVE}/files/${encodeURIComponent(fileId)}?alt=media`)
  let bundle: SaveBundle
  try {
    bundle = JSON.parse(gunzipSync(Buffer.from(await res.arrayBuffer())).toString('utf8')) as SaveBundle
  } catch {
    throw new Error("That cloud save couldn't be read")
  }
  if (bundle.format !== SAVE_FORMAT || typeof bundle.files !== 'object' || !bundle.files['box.json']) {
    throw new Error("That cloud save isn't a pkmnPvE save")
  }
  const names = Object.keys(bundle.files)
  if (!names.every(isSafeFileName)) throw new Error('That cloud save has files it shouldn\'t')

  const dir = playerDirFor(slug)
  const localProfile = readJsonIn(dir, 'profile.json')
  backUpSave(dir)
  for (const name of saveFileNames(dir)) rmSync(join(dir, name), { force: true })
  for (const name of names) writeFileSync(join(dir, name), Buffer.from(bundle.files[name], 'base64'))
  // This computer's name for the player, and whether they're an admin, are kept.
  if (localProfile) {
    const imported = readJsonIn(dir, 'profile.json') ?? {}
    writeFileSync(
      join(dir, 'profile.json'),
      JSON.stringify({ ...imported, displayName: localProfile.displayName, admin: localProfile.admin === true }),
      'utf8'
    )
  }
  if (!existsSync(join(dir, 'box.json'))) throw new Error('The imported save has no box')
  // Every store re-reads the save.
  reloadPlayerSave()
}
