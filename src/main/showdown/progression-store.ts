import { readFileSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import type { BossStep, ProgressionState } from '../../shared/battle-types'
import { playerPathFor, savePathFor } from './save-paths'
import { onPlayerChange } from './player-session'

const DEFAULT_LEVEL_CAP = 15

// Progression is two files: the boss order is game content shared by every
// player (bossOrder.json), while how far a player has got through it -
// their level cap and the bosses beaten - is part of their own save.
interface PlayerProgress {
  levelCap: number
  bossesDefeated: string[]
  trainerWinsSinceLastBoss: number
}

function emptyProgress(): PlayerProgress {
  return { levelCap: DEFAULT_LEVEL_CAP, bossesDefeated: [], trainerWinsSinceLastBoss: 0 }
}

function loadProgress(): PlayerProgress {
  // Outside the try: not being logged in is a bug to surface, not an empty save.
  const path = playerPathFor('progression.json')
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as PlayerProgress
    if (typeof parsed.levelCap !== 'number' || !Array.isArray(parsed.bossesDefeated)) return emptyProgress()
    return {
      levelCap: parsed.levelCap,
      bossesDefeated: parsed.bossesDefeated,
      trainerWinsSinceLastBoss: parsed.trainerWinsSinceLastBoss ?? 0
    }
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code
    if (code !== 'ENOENT') console.error('[progression-store] failed to load progression.json:', e)
    return emptyProgress()
  }
}

function readBossOrderFile(filename: string): BossStep[] | null {
  try {
    const parsed = JSON.parse(readFileSync(savePathFor(filename), 'utf8')) as { bossOrder?: BossStep[] }
    return Array.isArray(parsed.bossOrder) ? parsed.bossOrder : null
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code
    if (code !== 'ENOENT') console.error(`[progression-store] failed to load ${filename}:`, e)
    return null
  }
}

function loadBossOrder(): BossStep[] {
  const shared = readBossOrderFile('bossOrder.json')
  if (shared) return shared
  // Before there were players the boss order lived in progression.json next to
  // the progress: take it from there the first time.
  const legacy = readBossOrderFile('progression.json') ?? []
  writeFileSync(savePathFor('bossOrder.json'), JSON.stringify({ bossOrder: legacy }), 'utf8')
  return legacy
}

let progress: PlayerProgress | null = null
let bossOrder: BossStep[] | null = null

// The boss order is shared and stays cached; a player's progress doesn't.
onPlayerChange(() => {
  progress = null
})

function getProgress(): PlayerProgress {
  if (!progress) progress = loadProgress()
  return progress
}

function getBossOrder(): BossStep[] {
  if (!bossOrder) bossOrder = loadBossOrder()
  return bossOrder
}

function persistProgress(): void {
  writeFileSync(playerPathFor('progression.json'), JSON.stringify(getProgress()), 'utf8')
}

function persistBossOrder(): void {
  writeFileSync(savePathFor('bossOrder.json'), JSON.stringify({ bossOrder: getBossOrder() }), 'utf8')
}

export function getProgression(): ProgressionState {
  const p = getProgress()
  return { ...p, bossOrder: [...getBossOrder()], bossesDefeated: [...p.bossesDefeated] }
}

export function setBossOrder(steps: Omit<BossStep, 'id'>[]): ProgressionState {
  const existing = getBossOrder()
  bossOrder = steps.map((step, i) => ({ id: existing[i]?.id ?? randomUUID(), ...step }))
  persistBossOrder()
  return getProgression()
}

export function setLevelCap(levelCap: number): ProgressionState {
  getProgress().levelCap = Math.max(1, Math.min(100, Math.round(levelCap)))
  persistProgress()
  return getProgression()
}

/** Whether a boss flagged `unlocksLateItems` has been beaten (see isLateGameItem in sim-access.ts). */
export function lateItemsUnlocked(): boolean {
  const { bossesDefeated } = getProgress()
  return getBossOrder().some((step) => step.unlocksLateItems && bossesDefeated.includes(step.trainerId))
}

export function getNextBoss(): BossStep | null {
  const { bossesDefeated } = getProgress()
  return getBossOrder().find((step) => !bossesDefeated.includes(step.trainerId)) ?? null
}

export function recordTrainerWin(trainerId: string, isBoss: boolean): void {
  const s = getProgress()
  if (!isBoss) {
    s.trainerWinsSinceLastBoss += 1
    persistProgress()
    return
  }
  const next = getNextBoss()
  if (!next || next.trainerId !== trainerId) return
  if (s.trainerWinsSinceLastBoss < next.requiredTrainerWins) return
  s.bossesDefeated.push(trainerId)
  s.levelCap = next.levelCapAfterWin
  s.trainerWinsSinceLastBoss = 0
  persistProgress()
}

export function resetProgression(): void {
  const s = getProgress()
  s.levelCap = DEFAULT_LEVEL_CAP
  s.bossesDefeated = []
  s.trainerWinsSinceLastBoss = 0
  persistProgress()
}
