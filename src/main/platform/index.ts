import type { Platform } from './types'

export type { Platform } from './types'
export { randomInt, randomUUID } from './random'

// Installed once at startup, before any store runs: electron.ts on desktop.
let current: Platform | null = null

export function installPlatform(platform: Platform): void {
  current = platform
}

function platform(): Platform {
  if (!current) throw new Error('No platform installed')
  return current
}

export const saveRoot = (): string => platform().saveRoot()
export const readText = (path: string): string => platform().readText(path)
export const writeText = (path: string, text: string): void => platform().writeText(path, text)
export const pathExists = (path: string): boolean => platform().pathExists(path)
export const ensureDir = (dir: string): void => platform().ensureDir(dir)
export const listDirs = (dir: string): string[] => platform().listDirs(dir)
export const listFiles = (dir: string): string[] => platform().listFiles(dir)
export const removeFile = (path: string): void => platform().removeFile(path)
export const copyFile = (from: string, to: string): void => platform().copyFile(from, to)
export const joinPath = (...parts: string[]): string => platform().joinPath(...parts)
export const emitToUi = (channel: string, payload: unknown): void => platform().emitToUi(channel, payload)
export const appVersion = (): string => platform().appVersion()
export const isDevBuild = (): boolean => platform().isDevBuild()
