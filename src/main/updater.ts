import { createWriteStream, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { spawn, spawnSync } from 'node:child_process'
import { app, type WebContents } from 'electron'
import type { UpdateCheckResult } from '../shared/battle-types'
import packageJson from '../../package.json'

/**
 * Options → Check for updates. The portable build updates itself from the GitHub
 * repo's latest Release (made with `npm run release`): download its zip, unpack it
 * beside the game, then - once the game has closed - a small helper script swaps
 * the new files in and starts it again. Player saves (save/players/ and the
 * remembered login) are never touched; the shared game data - trainers, boss order,
 * premade teams, drops, shop prices - comes from the new build.
 */

// "owner/name" of the public GitHub repo whose Releases hold the builds.
const REPO: string = (packageJson as { updateRepo?: string }).updateRepo ?? ''
const ZIP_ASSET = /-win\.zip$/i

// "0.2.10" > "0.2.9": compares dotted version numbers part by part.
function isNewer(latest: string, current: string): boolean {
  const a = latest.split('.').map((n) => parseInt(n, 10) || 0)
  const b = current.split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0)
  }
  return false
}

interface ReleaseAsset {
  name: string
  size: number
  browser_download_url: string
}

let pendingAsset: ReleaseAsset | null = null

/**
 * The swap, run once the game (process `pid`) has exited - a running exe can't be
 * replaced: mirror the new build over the game folder leaving save\ out of it
 * entirely, then copy in just the shared game data (the .json files directly in
 * save\) - never save\players or the remembered login - and start the game again.
 */
// Windows' own tools folder, spelled out so a script never picks up another tasklist/find.
const SYS = '%SystemRoot%\\System32\\'

export function applyScript(pid: number, newDir: string, appDir: string): string {
  const newSave = join(newDir, 'save')
  const appSave = join(appDir, 'save')
  return [
    '@echo off',
    ':wait',
    // Full paths: whatever PATH this starts with, it must be Windows' own tools. The
    // one-second pause is a ping - timeout.exe refuses to run without a console.
    `"${SYS}tasklist.exe" /FI "PID eq ${pid}" /NH | "${SYS}find.exe" "${pid}" >nul && ("${SYS}PING.EXE" -n 2 127.0.0.1 >nul & goto wait)`,
    `"${SYS}robocopy.exe" "${newDir}" "${appDir}" /MIR /XD "${appSave}" "${newSave}" /R:5 /W:1 /NFL /NDL /NJH /NJS >nul`,
    `if not exist "${appSave}" mkdir "${appSave}"`,
    `for %%F in ("${join(newSave, '*.json')}") do if /I not "%%~nxF"=="session.json" copy /Y "%%F" "${appSave}" >nul`,
    `start "" "${join(appDir, 'pkmnPvE.exe')}"`,
    ''
  ].join('\r\n')
}

export async function checkForUpdate(): Promise<UpdateCheckResult> {
  const current = app.getVersion()
  if (!REPO) throw new Error('No update repo is set (updateRepo in package.json)')
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { 'User-Agent': 'pkmnPvE-updater', Accept: 'application/vnd.github+json' }
  })
  if (res.status === 404) return { current, latest: null, available: false, notes: '', sizeBytes: 0, canInstall: app.isPackaged }
  if (!res.ok) throw new Error(`GitHub answered ${res.status} - try again later`)
  const release = (await res.json()) as { tag_name: string; body?: string; assets: ReleaseAsset[] }
  const latest = release.tag_name.replace(/^v/i, '')
  const asset = release.assets.find((a) => ZIP_ASSET.test(a.name)) ?? null
  const available = !!asset && isNewer(latest, current)
  pendingAsset = available ? asset : null
  return {
    current,
    latest,
    available,
    notes: release.body ?? '',
    sizeBytes: asset?.size ?? 0,
    // Only the packaged game replaces itself - a dev copy updates with git.
    canInstall: app.isPackaged
  }
}

/**
 * Downloads and unpacks the release found by checkForUpdate, reporting progress to
 * the window, then hands over to the swap script and quits the game.
 */
export async function installUpdate(sender: WebContents): Promise<void> {
  if (!app.isPackaged) throw new Error('Only the packaged game updates itself - in the project, pull with git instead')
  const asset = pendingAsset
  if (!asset) throw new Error('Check for updates first')

  const appDir = dirname(app.getPath('exe'))
  const work = join(app.getPath('temp'), 'pkmnPvE-update')
  rmSync(work, { recursive: true, force: true })
  mkdirSync(join(work, 'new'), { recursive: true })

  // Download, reporting how far along it is.
  const zipPath = join(work, asset.name)
  const res = await fetch(asset.browser_download_url, { headers: { 'User-Agent': 'pkmnPvE-updater' } })
  if (!res.ok || !res.body) throw new Error(`Download failed (${res.status})`)
  let received = 0
  let lastReported = 0
  const counted = Readable.fromWeb(res.body as import('node:stream/web').ReadableStream).on('data', (chunk: Buffer) => {
    received += chunk.length
    if (received - lastReported > 2_000_000 || received === asset.size) {
      lastReported = received
      sender.send('update:progress', { phase: 'downloading', received, total: asset.size })
    }
  })
  await pipeline(counted, createWriteStream(zipPath))

  // Unpack with .NET's zip reader, which every Windows has (through PowerShell).
  // Not Windows' tar.exe: it fails partway through electron-builder's zips. The
  // paths go in as environment variables so nothing in them can break the quoting.
  sender.send('update:progress', { phase: 'unpacking', received, total: asset.size })
  const unzip = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      'Add-Type -AssemblyName System.IO.Compression.FileSystem; ' +
        '[System.IO.Compression.ZipFile]::ExtractToDirectory($env:PKMN_UPDATE_ZIP, $env:PKMN_UPDATE_DEST)'
    ],
    {
      windowsHide: true,
      env: { ...process.env, PKMN_UPDATE_ZIP: zipPath, PKMN_UPDATE_DEST: join(work, 'new') }
    }
  )
  if (unzip.status !== 0 || !existsSync(join(work, 'new', 'pkmnPvE.exe'))) {
    throw new Error('Could not unpack the update: ' + (unzip.stderr?.toString().trim() || 'the download looks incomplete'))
  }

  // The swap, run once this process has exited (a running exe can't be replaced):
  // mirror the new build over the game folder leaving save\ alone entirely, then
  // copy in just the shared game data - never save\players or the remembered login.
  const script = join(work, 'apply-update.cmd')
  writeFileSync(script, applyScript(process.pid, join(work, 'new'), appDir), 'utf8')
  sender.send('update:progress', { phase: 'restarting', received, total: asset.size })
  spawn('cmd.exe', ['/c', script], { detached: true, stdio: 'ignore', windowsHide: true }).unref()
  setTimeout(() => app.quit(), 500)
}
