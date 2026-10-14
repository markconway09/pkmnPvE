import { appendFileSync, existsSync, mkdirSync, renameSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { app, shell, type WebContents } from 'electron'
import { saveRoot } from './platform'

/**
 * The error log: anything that goes wrong - in the game itself or in its window -
 * is written to save/logs/errors.log, so a player reporting a bug can send it along
 * (Options → About → Open log folder). Past 1 MB it moves to errors.old.log and
 * starts afresh, so it never grows without end. Updates leave save/ alone, so the
 * log survives them.
 */
const MAX_BYTES = 1_000_000

function logDir(): string {
  return join(saveRoot(), 'logs')
}

export function logError(source: string, error: unknown): void {
  console.error(`[${source}]`, error)
  try {
    const dir = logDir()
    mkdirSync(dir, { recursive: true })
    const file = join(dir, 'errors.log')
    if (existsSync(file) && statSync(file).size > MAX_BYTES) renameSync(file, join(dir, 'errors.old.log'))
    const text = error instanceof Error ? (error.stack ?? error.message) : String(error)
    appendFileSync(file, `[${new Date().toISOString()}] v${app.getVersion()} ${source}: ${text}\n`)
  } catch {
    // Writing the log must never become a crash of its own.
  }
}

/** Catches what would otherwise crash the game or vanish silently. */
export function installCrashLog(): void {
  process.on('uncaughtException', (error) => logError('game', error))
  process.on('unhandledRejection', (reason) => logError('game', reason))
  app.on('render-process-gone', (_event, _contents, details) =>
    logError('window', `the window crashed: ${details.reason} (exit code ${details.exitCode})`)
  )
  app.on('child-process-gone', (_event, details) => {
    if (details.reason !== 'clean-exit') logError(details.type, `${details.reason} (exit code ${details.exitCode})`)
  })
}

/** Errors in the window (its scripts, failed calls) go to the log too. */
export function watchWindowErrors(contents: WebContents): void {
  contents.on('console-message', (event) => {
    if (event.level === 'error') logError('window', `${event.message} (${event.sourceId}:${event.lineNumber})`)
  })
}

/** Options → About → Open log folder. */
export async function openLogFolder(): Promise<void> {
  const dir = logDir()
  mkdirSync(dir, { recursive: true })
  const problem = await shell.openPath(dir)
  if (problem) throw new Error(problem)
}
