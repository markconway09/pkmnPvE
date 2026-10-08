import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { app, BrowserWindow } from 'electron'
import { installPlatform } from '.'

// The desktop platform. Imported first thing in index.ts, so it is in place
// before any store reads a save.
installPlatform({
  saveRoot() {
    // Saves always sit in a plain 'save' folder the player can see: next to the
    // project in dev, and next to pkmnPvE.exe in the packaged (portable) build -
    // which ships with the game data in it - so moving the game to another
    // computer, saves and all, is just copying its folder. (The OS userData folder
    // has also been seen to be silently inaccessible to an unsigned electron.exe.)
    return app.isPackaged ? join(dirname(app.getPath('exe')), 'save') : join(app.getAppPath(), 'save')
  },
  readText: (path) => readFileSync(path, 'utf8'),
  writeText: (path, text) => writeFileSync(path, text, 'utf8'),
  pathExists: (path) => existsSync(path),
  ensureDir(dir) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  },
  listDirs: (dir) =>
    readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name),
  listFiles: (dir) =>
    existsSync(dir)
      ? readdirSync(dir, { withFileTypes: true })
          .filter((entry) => entry.isFile())
          .map((entry) => entry.name)
      : [],
  removeFile: (path) => rmSync(path, { force: true }),
  copyFile: (from, to) => copyFileSync(from, to),
  joinPath: (...parts) => join(...parts),
  emitToUi(channel, payload) {
    for (const window of BrowserWindow.getAllWindows()) window.webContents.send(channel, payload)
  },
  appVersion: () => app.getVersion(),
  isDevBuild: () => !app.isPackaged
})
