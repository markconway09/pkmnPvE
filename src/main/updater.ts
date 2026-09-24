import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { open } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
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
  // "sha256:<hex>" - GitHub publishes one for every release file.
  digest?: string | null
}

let pendingAsset: ReleaseAsset | null = null
let latestVersion: string | null = null

/**
 * The swap, run once the game (process `pid`) has exited - a running exe can't be
 * replaced: mirror the new build over the game folder leaving save\ out of it
 * entirely, then copy in just the shared game data (the .json files directly in
 * save\) - never save\players or the remembered login - and start the game again.
 */
// Windows' own tools folder, spelled out so a script never picks up another tasklist/find.
const SYS = '%SystemRoot%\\System32\\'

export function applyScript(pid: number, newDir: string, appDir: string, version = ''): string {
  const newSave = join(newDir, 'save')
  const appSave = join(appDir, 'save')
  return [
    '@echo off',
    // Shown in a small window of its own, so the game doesn't just vanish for the few
    // seconds the swap takes - easy to think it failed and reopen the old one mid-copy.
    `title Updating pkmnPvE${version ? ` to ${version}` : ''}`,
    'echo Updating pkmnPvE - please wait, the game will reopen by itself.',
    'echo.',
    'echo Waiting for the game to close...',
    // Wait for every one of the game's processes to exit (not just the main one - its
    // helpers can hold files open a moment longer). PowerShell's Wait-Process just
    // blocks until they're gone; a tasklist | find polling loop hung when run from a
    // detached process. The exe's path comes in through an environment variable so
    // nothing in it can break the quoting.
    `set "PKMN_EXE=${join(appDir, 'pkmnPvE.exe')}"`,
    `"${SYS}WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -NonInteractive -Command "Wait-Process -Id ${pid} -ErrorAction SilentlyContinue; Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $env:PKMN_EXE } | Wait-Process -ErrorAction SilentlyContinue"`,
    'echo Installing the new version (your saves are kept)...',
    `"${SYS}robocopy.exe" "${newDir}" "${appDir}" /MIR /XD "${appSave}" "${newSave}" /R:5 /W:1 /NFL /NDL /NJH /NJS >nul`,
    `if not exist "${appSave}" mkdir "${appSave}"`,
    `for %%F in ("${join(newSave, '*.json')}") do if /I not "%%~nxF"=="session.json" copy /Y "%%F" "${appSave}" >nul`,
    'echo Done - starting the game.',
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
  latestVersion = available ? latest : null
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

  // Download, reporting how far along it is. Each chunk is copied before it's
  // written: the buffers fetch hands out can be reused for the next chunk, which
  // silently corrupted the file when they were written straight from the stream.
  const zipPath = join(work, asset.name)
  const res = await fetch(asset.browser_download_url, { headers: { 'User-Agent': 'pkmnPvE-updater' } })
  if (!res.ok || !res.body) throw new Error(`Download failed (${res.status})`)
  const file = await open(zipPath, 'w')
  const hash = createHash('sha256')
  let received = 0
  let lastReported = 0
  try {
    const reader = res.body.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = Buffer.from(value)
      hash.update(chunk)
      await file.write(chunk)
      received += chunk.length
      if (received - lastReported > 2_000_000) {
        lastReported = received
        sender.send('update:progress', { phase: 'downloading', received, total: asset.size })
      }
    }
  } finally {
    await file.close()
  }
  sender.send('update:progress', { phase: 'downloading', received, total: asset.size })

  // Nothing gets installed unless it's exactly the file GitHub has: same size, and
  // the same SHA-256 as the one GitHub publishes for it.
  if (received !== asset.size) throw new Error('The download was cut short - try again')
  const digest = hash.digest('hex')
  if (asset.digest && asset.digest.toLowerCase() !== `sha256:${digest}`) {
    throw new Error('The download came through damaged (checksum mismatch) - try again')
  }

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
  writeFileSync(script, applyScript(process.pid, join(work, 'new'), appDir, latestVersion ?? ''), 'utf8')
  sender.send('update:progress', { phase: 'restarting', received, total: asset.size })
  // Its own visible console window (see applyScript) - detached so it outlives the game.
  spawn('cmd.exe', ['/c', script], { detached: true, stdio: 'ignore', windowsHide: false }).unref()
  setTimeout(() => app.quit(), 500)
}
