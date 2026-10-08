import { appVersion, copyFile, ensureDir, joinPath, listDirs, listFiles, pathExists, readText, removeFile, writeText } from '../platform'
import { getCurrentPlayerSlug, playerDirFor } from './save-paths'
import { reloadPlayerSave } from './player-session'

/**
 * A save as one file (.pkmnsave), to move it between the PC and the phone by hand -
 * through the Google Drive app, a cable, a chat... It's the same file the cloud saves
 * upload (a gzipped bundle of every file in the player's save folder), so a cloud save
 * downloaded from Drive imports too. Importing replaces the current save, which is
 * backed up first; the player's own name and admin status stay as they are.
 */

const SAVE_FORMAT = 'pkmnpve-save'
// Never part of a save file: the Google Drive connection, and the local backups.
const CLOUD_FILE = 'cloud.json'
const BACKUPS_DIR = 'backups'
const LOCAL_BACKUPS_KEPT = 5

interface SaveBundle {
  format: typeof SAVE_FORMAT
  version: 1
  exportedAt: string
  appVersion: string
  // Each file in the save folder, base64.
  files: Record<string, string>
}

function currentSlug(): string {
  const slug = getCurrentPlayerSlug()
  if (!slug) throw new Error('Not logged in')
  return slug
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}

function fromBase64(text: string): Uint8Array {
  const binary = atob(text)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream)
  return new Uint8Array(await new Response(out).arrayBuffer())
}

// The background picture stays with each device (on the PC it's a picture file, not text).
const saveFileNames = (dir: string): string[] => listFiles(dir).filter((name) => name !== CLOUD_FILE && !/^background\./i.test(name))

function readJsonIn(dir: string, name: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readText(joinPath(dir, name))) as Record<string, unknown>
  } catch {
    return null
  }
}

/** The logged-in player's save as a file: its suggested name and its contents. */
export async function exportSaveFile(): Promise<{ name: string; data: Uint8Array }> {
  const slug = currentSlug()
  const dir = playerDirFor(slug)
  const encoder = new TextEncoder()
  const bundle: SaveBundle = {
    format: SAVE_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    appVersion: appVersion(),
    files: Object.fromEntries(saveFileNames(dir).map((name) => [name, toBase64(encoder.encode(readText(joinPath(dir, name))))]))
  }
  const data = await pipe(encoder.encode(JSON.stringify(bundle)), new CompressionStream('gzip'))
  return { name: `pkmnpve-${slug}-${bundle.exportedAt.slice(0, 10)}.pkmnsave`, data }
}

// A file name from a save file is only ever a plain name in the save folder - never a
// path somewhere else, and never the Drive connection.
function isSafeFileName(name: string): boolean {
  return /^[A-Za-z0-9_.-]+$/.test(name) && name !== CLOUD_FILE && !/^background\./i.test(name) && name !== '.' && name !== '..'
}

// Copies the current save into backups/<time>/, keeping only the newest few.
function backUpSave(dir: string): void {
  const backups = joinPath(dir, BACKUPS_DIR)
  const target = joinPath(backups, new Date().toISOString().replace(/[:.]/g, '-'))
  ensureDir(target)
  for (const name of saveFileNames(dir)) copyFile(joinPath(dir, name), joinPath(target, name))
  const all = listDirs(backups).sort()
  for (const old of all.slice(0, Math.max(0, all.length - LOCAL_BACKUPS_KEPT))) {
    for (const name of listFiles(joinPath(backups, old))) removeFile(joinPath(backups, old, name))
  }
}

/** Replaces the logged-in player's save with the one in a save file. */
export async function importSaveFile(data: Uint8Array): Promise<void> {
  const slug = currentSlug()
  let bundle: SaveBundle
  try {
    bundle = JSON.parse(new TextDecoder().decode(await pipe(data, new DecompressionStream('gzip')))) as SaveBundle
  } catch {
    throw new Error("That file couldn't be read - is it a .pkmnsave file?")
  }
  if (bundle.format !== SAVE_FORMAT || typeof bundle.files !== 'object' || !bundle.files['box.json']) {
    throw new Error("That file isn't a pkmnPvE save")
  }
  const names = Object.keys(bundle.files)
  if (!names.every(isSafeFileName)) throw new Error("That save file has files it shouldn't")
  const decoder = new TextDecoder()
  const texts = names.map((name) => [name, decoder.decode(fromBase64(bundle.files[name]))] as const)

  const dir = playerDirFor(slug)
  const localProfile = readJsonIn(dir, 'profile.json')
  backUpSave(dir)
  for (const name of saveFileNames(dir)) removeFile(joinPath(dir, name))
  for (const [name, text] of texts) writeText(joinPath(dir, name), text)
  // This device's name for the player, and whether they're an admin, are kept.
  if (localProfile) {
    const imported = readJsonIn(dir, 'profile.json') ?? {}
    writeText(
      joinPath(dir, 'profile.json'),
      JSON.stringify({ ...imported, displayName: localProfile.displayName, admin: localProfile.admin === true })
    )
  }
  if (!pathExists(joinPath(dir, 'box.json'))) throw new Error('The imported save has no box')
  // Every store re-reads the save.
  reloadPlayerSave()
}
