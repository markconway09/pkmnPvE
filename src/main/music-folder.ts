import { BrowserWindow, dialog, ipcMain, protocol } from 'electron'
import { createReadStream } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { basename, dirname, extname, join, relative, resolve, isAbsolute } from 'node:path'
import { Readable } from 'node:stream'
import type { LocalMusicFile } from '../shared/music'

// The "local folder" music source: the player picks a folder of their own music and the
// game plays the audio files in it (and its subfolders). The window can't open files off
// the disk itself, so they're served to it through a pkmn-music:// address - only files
// inside a folder the player picked, and only audio files.

const SCHEME = 'pkmn-music'
const AUDIO_EXTENSIONS = new Set(['.mp3', '.ogg', '.oga', '.opus', '.wav', '.m4a', '.aac', '.flac', '.webm'])
const AUDIO_TYPES: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.flac': 'audio/flac',
  '.webm': 'audio/webm'
}
// A huge folder (a whole drive) stops being searched at this many tracks.
const MAX_FILES = 5000

// The folders listed this session - the only places files are served from.
const allowedFolders = new Set<string>()

// Has to run before the app is ready: lets the audio player stream and seek these addresses.
protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true } }
])

function insideAllowedFolder(file: string): boolean {
  for (const folder of allowedFolders) {
    const rel = relative(folder, file)
    if (rel && !rel.startsWith('..') && !isAbsolute(rel)) return true
  }
  return false
}

async function listAudioFiles(folder: string): Promise<LocalMusicFile[]> {
  const files: LocalMusicFile[] = []
  const walk = async (dir: string): Promise<void> => {
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return // unreadable folder - skipped
    }
    for (const entry of entries) {
      if (files.length >= MAX_FILES) return
      const full = join(dir, entry.name)
      if (entry.isDirectory()) await walk(full)
      else if (entry.isFile() && AUDIO_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
        files.push({
          url: `${SCHEME}://track/${encodeURIComponent(full)}`,
          title: basename(entry.name, extname(entry.name)),
          // The folder it's in, as the "artist" line - usually the album or artist.
          artist: dir === folder ? basename(folder) : basename(dirname(full))
        })
      }
    }
  }
  await walk(folder)
  return files.sort((a, b) => a.url.localeCompare(b.url))
}

/** Serves one audio file, a byte range of it when the player seeks. */
async function serveFile(request: Request): Promise<Response> {
  const file = resolve(decodeURIComponent(new URL(request.url).pathname.replace(/^\//, '')))
  const type = AUDIO_TYPES[extname(file).toLowerCase()]
  if (!type || !insideAllowedFolder(file)) return new Response(null, { status: 403 })
  let size: number
  try {
    size = (await stat(file)).size
  } catch {
    return new Response(null, { status: 404 })
  }
  const range = /bytes=(\d*)-(\d*)/.exec(request.headers.get('range') ?? '')
  if (!range) {
    const body = Readable.toWeb(createReadStream(file)) as ReadableStream
    return new Response(body, {
      status: 200,
      headers: { 'Content-Type': type, 'Content-Length': String(size), 'Accept-Ranges': 'bytes' }
    })
  }
  const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]))
  const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1
  if (start >= size || start > end) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
  }
  const body = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream
  return new Response(body, {
    status: 206,
    headers: {
      'Content-Type': type,
      'Content-Length': String(end - start + 1),
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Accept-Ranges': 'bytes'
    }
  })
}

/** Called once the app is ready: the pkmn-music:// addresses and the folder picker. */
export function installMusicFolder(): void {
  protocol.handle(SCHEME, serveFile)

  ipcMain.handle('music:pickFolder', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const options = { title: 'Choose a music folder', properties: ['openDirectory' as const] }
    const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options)
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })

  ipcMain.handle('music:listFolder', async (_event, folder: string) => {
    if (typeof folder !== 'string' || !folder) return []
    const full = resolve(folder)
    try {
      if (!(await stat(full)).isDirectory()) return []
    } catch {
      return [] // the folder's gone (moved, or a drive unplugged)
    }
    allowedFolders.add(full)
    return listAudioFiles(full)
  })
}
