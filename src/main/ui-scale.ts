import { BrowserWindow, ipcMain, screen } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { savePathFor } from './showdown/save-paths'
import { UI_SCALE_CHOICES, type UiScaleChoice, type UiScaleState } from '../shared/ui-scale'

// Options → Screen size. The layout is built for a 1280x960 window; on a smaller screen
// (a laptop, or Windows display scaling at 125-150%) that doesn't fit, and on a big one
// it looks tiny. So the whole page is zoomed and the window sized to match - the layout
// still sees 1280x960, it's just drawn bigger or smaller. Auto picks the zoom that fits
// the screen the window is on. Kept per computer in save/display.json (not per player:
// the window is sized before anyone logs in).

export const BASE_WIDTH = 1280
export const BASE_HEIGHT = 960

// Auto never shrinks below this (text gets hard to read) or grows past this.
const AUTO_MIN = 0.6
const AUTO_MAX = 1.5

function settingsPath(): string {
  return savePathFor('display.json')
}

function loadChoice(): UiScaleChoice {
  try {
    const parsed = JSON.parse(readFileSync(settingsPath(), 'utf8')) as { uiScale?: string }
    if ((UI_SCALE_CHOICES as string[]).includes(parsed.uiScale ?? '')) return parsed.uiScale as UiScaleChoice
  } catch {
    // no file yet, or unreadable - Auto
  }
  return 'auto'
}

let choice: UiScaleChoice = 'auto'
let loaded = false

function currentChoice(): UiScaleChoice {
  if (!loaded) {
    choice = loadChoice()
    loaded = true
  }
  return choice
}

/** The usable part of the screen the window is on (the screen minus the taskbar). */
function workAreaFor(win?: BrowserWindow): Electron.Rectangle {
  const display = win ? screen.getDisplayMatching(win.getBounds()) : screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  return display.workArea
}

/** The zoom for a choice on a screen: a fixed size, or for Auto whatever fits, in 5% steps. */
function zoomFor(pick: UiScaleChoice, area: Electron.Rectangle): number {
  if (pick !== 'auto') return Number(pick) / 100
  const fit = Math.min(area.width / BASE_WIDTH, area.height / BASE_HEIGHT)
  const stepped = Math.floor(fit * 20) / 20
  return Math.min(AUTO_MAX, Math.max(AUTO_MIN, stepped))
}

/** The window's size at a zoom - never bigger than the screen, even at a fixed 150%. */
function sizeFor(zoom: number, area: Electron.Rectangle): { width: number; height: number } {
  return {
    width: Math.min(area.width, Math.round(BASE_WIDTH * zoom)),
    height: Math.min(area.height, Math.round(BASE_HEIGHT * zoom))
  }
}

/** The size the main window opens at, for the screen it's about to open on. */
export function initialWindowSize(): { width: number; height: number } {
  const area = workAreaFor()
  return sizeFor(zoomFor(currentChoice(), area), area)
}

// The zoom each window is drawn at, and the screen it was worked out for (so moving
// the window to another screen re-fits it under Auto).
const applied = new WeakMap<BrowserWindow, { zoom: number; displayId: number }>()

/**
 * Zooms the page and sizes the window to match. resize: also set the window to the new
 * size and centre it (when the setting changes, or Auto moves it to another screen) -
 * otherwise only the smallest allowed size changes.
 */
function apply(win: BrowserWindow, resize: boolean): void {
  if (win.isDestroyed()) return
  const area = workAreaFor(win)
  const zoom = zoomFor(currentChoice(), area)
  const size = sizeFor(zoom, area)
  applied.set(win, { zoom, displayId: screen.getDisplayMatching(win.getBounds()).id })
  win.webContents.setZoomFactor(zoom)
  win.setMinimumSize(size.width, size.height)
  if (win.isMaximized() || win.isFullScreen()) return
  const [width, height] = win.getSize()
  if (resize || width < size.width || height < size.height) {
    win.setSize(size.width, size.height)
    if (resize) win.center()
  }
}

/** Hooks the main window up: zoom on every page load, re-fit when it changes screen. */
export function installUiScale(win: BrowserWindow): void {
  win.webContents.on('did-finish-load', () => apply(win, false))
  win.on('moved', () => {
    if (currentChoice() !== 'auto') return
    const now = screen.getDisplayMatching(win.getBounds()).id
    if (applied.get(win)?.displayId !== now) apply(win, true)
  })
  apply(win, false)
}

// A screen's resolution or Windows scaling changed - Auto re-fits every window.
let watchingScreens = false
function watchScreens(): void {
  if (watchingScreens) return
  watchingScreens = true
  screen.on('display-metrics-changed', () => {
    if (currentChoice() !== 'auto') return
    for (const win of BrowserWindow.getAllWindows()) apply(win, true)
  })
}

export function installUiScaleIpc(): void {
  watchScreens()
  ipcMain.handle('uiScale:get', (event): UiScaleState => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return { choice: currentChoice(), zoom: win ? (applied.get(win)?.zoom ?? 1) : 1 }
  })
  ipcMain.handle('uiScale:set', (event, next: UiScaleChoice): UiScaleState => {
    if ((UI_SCALE_CHOICES as string[]).includes(next)) {
      choice = next
      loaded = true
      try {
        writeFileSync(settingsPath(), JSON.stringify({ uiScale: next }), 'utf8')
      } catch (e) {
        console.error('[ui-scale] failed to save:', e)
      }
      for (const win of BrowserWindow.getAllWindows()) apply(win, true)
    }
    const win = BrowserWindow.fromWebContents(event.sender)
    return { choice: currentChoice(), zoom: win ? (applied.get(win)?.zoom ?? 1) : 1 }
  })
}
