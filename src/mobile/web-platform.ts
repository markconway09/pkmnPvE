import type { Platform } from '../main/platform'

/**
 * The mobile platform: the game runs inside the app's WebView, where storage is
 * only async. So the whole save folder is held in memory - loaded once before
 * the game starts - and every write goes to memory at once (the stores read it
 * straight back) and to the device's storage in the background.
 */

/** Where the save files really live on the device. */
export interface SaveBackend {
  /** Every saved file, path -> contents. */
  loadAll(): Promise<Record<string, string>>
  write(path: string, text: string): Promise<void>
  remove(path: string): Promise<void>
}

export interface WebPlatformOptions {
  backend: SaveBackend
  /** The shared game data shipped with the game (trainers.json...), by file name. */
  seed: Record<string, string>
  version: string
  /** Delivers a push message to the page (see direct-transport.ts). */
  emit: (channel: string, payload: unknown) => void
  devBuild: boolean
}

const ROOT = '/save'

function missing(path: string): Error {
  // Shaped like Node's fs error, which the stores check for.
  return Object.assign(new Error(`ENOENT: no such file, '${path}'`), { code: 'ENOENT' })
}

/** The platform, plus a wait for the background writes (before the page reloads). */
export type WebPlatform = Platform & { flushed: () => Promise<void> }

export async function createWebPlatform(options: WebPlatformOptions): Promise<WebPlatform> {
  const files = new Map(Object.entries(await options.backend.loadAll()))
  // Folders only exist through the files in them, plus any made this session.
  const dirs = new Set<string>([ROOT])

  // The shipped game data, the first time (a player's own edits are kept after that).
  for (const [name, text] of Object.entries(options.seed)) {
    const path = `${ROOT}/${name}`
    if (!files.has(path)) files.set(path, text)
  }

  // Writes queue up and go out together, the latest text per file (null: deleted).
  const pending = new Map<string, string | null>()
  let flushing: Promise<void> | null = null
  function flush(): Promise<void> {
    flushing ??= (async () => {
      while (pending.size > 0) {
        const batch = [...pending]
        pending.clear()
        for (const [path, text] of batch) {
          try {
            if (text === null) await options.backend.remove(path)
            else await options.backend.write(path, text)
          } catch (e) {
            console.error(`[web-platform] failed to save ${path}:`, e)
          }
        }
      }
      flushing = null
    })()
    return flushing
  }

  function isDir(path: string): boolean {
    if (dirs.has(path)) return true
    const prefix = path + '/'
    for (const key of files.keys()) if (key.startsWith(prefix)) return true
    return false
  }

  const platform: WebPlatform = {
    flushed: async () => {
      while (flushing || pending.size > 0) await (flushing ?? flush())
    },
    saveRoot: () => ROOT,
    readText(path) {
      const text = files.get(path)
      if (text === undefined) throw missing(path)
      return text
    },
    writeText(path, text) {
      files.set(path, text)
      pending.set(path, text)
      void flush()
    },
    pathExists: (path) => files.has(path) || isDir(path),
    ensureDir(dir) {
      dirs.add(dir)
    },
    listDirs(dir) {
      const prefix = dir + '/'
      const found = new Set<string>()
      for (const path of [...files.keys(), ...dirs]) {
        if (!path.startsWith(prefix)) continue
        const rest = path.slice(prefix.length)
        const slash = rest.indexOf('/')
        // A file's parent folder, or a folder made this session.
        if (slash > 0) found.add(rest.slice(0, slash))
        else if (dirs.has(path)) found.add(rest)
      }
      return [...found]
    },
    listFiles(dir) {
      const prefix = dir + '/'
      return [...files.keys()].filter((path) => path.startsWith(prefix) && !path.slice(prefix.length).includes('/')).map((path) => path.slice(prefix.length))
    },
    removeFile(path) {
      if (!files.delete(path)) return
      pending.set(path, null)
      void flush()
    },
    copyFile(from, to) {
      const text = files.get(from)
      if (text === undefined) throw missing(from)
      platform.writeText(to, text)
    },
    joinPath: (...parts) => parts.join('/').replace(/\/{2,}/g, '/'),
    emitToUi: (channel, payload) => options.emit(channel, payload),
    appVersion: () => options.version,
    isDevBuild: () => options.devBuild
  }
  return platform
}
