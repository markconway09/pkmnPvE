// First, so the desktop platform is in place before any store reads a save.
import './platform/electron'
import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'node:path'
import { installMusicFolder } from './music-folder'
import { initialWindowSize, installUiScale, installUiScaleIpc } from './ui-scale'
import { checkForUpdate, installUpdate } from './updater'
import {
  connectCloud,
  disconnectCloud,
  exportToCloud,
  getCloudStatus,
  importFromCloud,
  listCloudSaves
} from './cloud/google-drive'
import { chooseBackground, clearBackground, getBackground } from './showdown/background-store'
import { restoreRememberedSession } from './showdown/player-session'
import { gameHandlers, scheduleAchievementCheck } from './game-api'

// Every call from the window is followed by a (batched) achievement check - see
// scheduleAchievementCheck in game-api.ts.
const handleIpc = ipcMain.handle.bind(ipcMain)
ipcMain.handle = (channel, listener) =>
  handleIpc(channel, async (event, ...args) => {
    try {
      return await listener(event, ...args)
    } finally {
      scheduleAchievementCheck()
    }
  })

function createWindow(): void {
  // The layout is built for 1280x960 - wide enough for the battle screen's 3-column
  // layout (switch list, the stage, the log), tall enough for a full battle screen
  // without the page scrolling. The window opens at that size zoomed to fit the
  // screen (Options → Screen size, see ui-scale.ts), and can grow but not shrink
  // below it.
  const { width, height } = initialWindowSize()
  const mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: width,
    minHeight: height,
    // No File/Edit/View menu bar - it's Electron's default, not the game's. A dev
    // copy still shows it on Alt, for reload and the DevTools.
    autoHideMenuBar: true,
    // The game's own icon in the title bar and taskbar (the packaged exe also
    // gets it from electron-builder's win.icon).
    icon: join(__dirname, '../../resources/icon.ico'),
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false
    }
  })

  installUiScale(mainWindow)

  // The packaged game has no menu at all (so Alt doesn't bring one up mid-battle).
  if (app.isPackaged) mainWindow.removeMenu()

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`)
  })

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.log('[renderer] process gone:', details)
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// The game itself (game-api.ts) - the same calls the mobile build makes directly.
for (const [channel, handler] of gameHandlers) ipcMain.handle(channel, handler)

// Desktop only: Google Drive saves, self-updating and the custom background.
ipcMain.handle('cloud:status', () => getCloudStatus())
ipcMain.handle('cloud:connect', () => connectCloud())
ipcMain.handle('cloud:disconnect', () => disconnectCloud())
ipcMain.handle('cloud:list', () => listCloudSaves())
ipcMain.handle('cloud:export', () => exportToCloud())
ipcMain.handle('cloud:import', (_event, fileId: string) => importFromCloud(fileId))
ipcMain.handle('update:check', () => checkForUpdate())
ipcMain.handle('background:get', () => getBackground())
ipcMain.handle('background:choose', (event) => chooseBackground(BrowserWindow.fromWebContents(event.sender)))
ipcMain.handle('background:clear', () => clearBackground())
ipcMain.handle('update:install', (event) => installUpdate(event.sender))

void app.whenReady().then(() => {
  restoreRememberedSession()
  installMusicFolder()
  installUiScaleIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
