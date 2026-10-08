/**
 * What the game logic needs from the device it runs on. The desktop build fills
 * it in with Node and Electron (electron.ts); the mobile build will fill it in
 * with the WebView and Capacitor, so the stores never touch either directly.
 *
 * Everything is synchronous on purpose: the stores read and write their save
 * files in the middle of game logic. A platform with only async storage keeps
 * the files in memory, loads them all before the game starts, and writes
 * through in the background.
 */
export interface Platform {
  /** The folder holding the shared game data and the players/ folder. */
  saveRoot(): string
  /** A text file's contents. A missing file throws an error whose `code` is 'ENOENT', like Node's fs. */
  readText(path: string): string
  writeText(path: string, text: string): void
  pathExists(path: string): boolean
  /** Creates the folder (and its parents) if it isn't there yet. */
  ensureDir(dir: string): void
  /** The names of the folders directly inside a folder. */
  listDirs(dir: string): string[]
  /** The names of the files directly inside a folder (none if it isn't there). */
  listFiles(dir: string): string[]
  /** Deletes a file, if it's there. */
  removeFile(path: string): void
  copyFile(from: string, to: string): void
  joinPath(...parts: string[]): string
  /** Sends a push message to the game's window(s). */
  emitToUi(channel: string, payload: unknown): void
  /** The game's version number, as in package.json. */
  appVersion(): string
  /** True when running from the project rather than a shipped build. */
  isDevBuild(): boolean
}
