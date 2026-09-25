import { copyFileSync, existsSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { extname, join } from 'node:path'
import { BrowserWindow, dialog } from 'electron'
import { getCurrentPlayerSlug, playerDirFor } from './save-paths'

/**
 * Options → Background: a picture of the player's own choosing behind every
 * screen. The file is copied into that player's save folder (save/players/<name>/)
 * as background.<ext>, so it follows the player, and updates - which never touch
 * save/players - leave it alone.
 */

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp'
}

function playerDir(): string {
  const slug = getCurrentPlayerSlug()
  if (!slug) throw new Error('Not logged in')
  return playerDirFor(slug)
}

function savedBackgroundFile(dir: string): string | null {
  const name = readdirSync(dir).find((f) => /^background\./i.test(f) && MIME[extname(f).toLowerCase()])
  return name ? join(dir, name) : null
}

function removeSavedBackgrounds(dir: string): void {
  for (const f of readdirSync(dir)) if (/^background\./i.test(f)) rmSync(join(dir, f), { force: true })
}

// Handed to the window as a data: URL - it can't load file paths from the save folder itself.
function toDataUrl(file: string): string {
  return `data:${MIME[extname(file).toLowerCase()]};base64,${readFileSync(file).toString('base64')}`
}

/** The logged-in player's background, or null for the plain one. */
export function getBackground(): string | null {
  const file = savedBackgroundFile(playerDir())
  return file && existsSync(file) ? toDataUrl(file) : null
}

/** Asks for a picture and makes it this player's background; null if they cancelled. */
export async function chooseBackground(win: BrowserWindow | null): Promise<string | null> {
  const options: Electron.OpenDialogOptions = {
    title: 'Choose a background picture',
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: Object.keys(MIME).map((e) => e.slice(1)) }]
  }
  const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
  const source = result.filePaths[0]
  if (result.canceled || !source) return null
  const ext = extname(source).toLowerCase()
  if (!MIME[ext]) throw new Error('That file type is not supported - use PNG, JPG, WebP, GIF or BMP')
  const dir = playerDir()
  removeSavedBackgrounds(dir)
  const target = join(dir, `background${ext}`)
  copyFileSync(source, target)
  return toDataUrl(target)
}

/** Back to the plain background. */
export function clearBackground(): void {
  removeSavedBackgrounds(playerDir())
}
