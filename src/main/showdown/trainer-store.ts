import { randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import type { ItemDropConfig, Trainer } from '../../shared/battle-types'
import { MAX_TRAINER_DROPS } from '../../shared/battle-types'
import { savePathFor } from './save-paths'

// Keeps only real rewards (an item and a chance above 0), at most
// MAX_TRAINER_DROPS of them, with the chance held to 0-100.
function cleanDrops(drops: ItemDropConfig[] | undefined): ItemDropConfig[] {
  return (drops ?? [])
    .filter((d) => d && d.itemId && d.chance > 0)
    .slice(0, MAX_TRAINER_DROPS)
    .map((d) => ({ itemId: d.itemId, chance: Math.max(0, Math.min(100, Math.round(d.chance))) }))
}

function load(): Trainer[] {
  try {
    const raw = readFileSync(savePathFor('trainers.json'), 'utf8')
    const parsed = JSON.parse(raw) as Trainer[]
    if (!Array.isArray(parsed)) return []
    for (const trainer of parsed) {
      // A trainer used to have one `drop`; it now has a list of `drops`.
      const legacy = (trainer as { drop?: ItemDropConfig }).drop
      if (!Array.isArray(trainer.drops)) trainer.drops = cleanDrops(legacy ? [legacy] : [])
      delete (trainer as { drop?: ItemDropConfig }).drop
      // Team Rocket: the grunts are members, and Giovanni's fights are the events that
      // bring them out. Only filled in where nothing has been chosen, so a flag turned
      // off in the trainer editor stays off.
      if (trainer.teamRocket === undefined) trainer.teamRocket = /^rocketgruntf?$/.test(trainer.spriteId)
      if (trainer.rocketEvent === undefined) trainer.rocketEvent = trainer.isBoss && /giovanni|^Rocket Admin (Archer|Ariana)/i.test(trainer.name)
      // Prize money is a rule now (see prizeMoneyFor), not a per-trainer value.
      delete (trainer as { rewardMoney?: number }).rewardMoney
    }
    return parsed
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code
    if (code !== 'ENOENT') console.error('[trainer-store] failed to load trainers.json:', e)
    return []
  }
}

let state: Trainer[] | null = null

// The Radical Red data calls the rival "Terry" (the dump's placeholder); he's
// Blue. Trainers imported under the old name are renamed to match. Only the
// imported rival entries are touched, so a trainer someone called Terry by hand
// is left alone.
function renameImportedRival(trainers: Trainer[]): boolean {
  let changed = false
  for (const trainer of trainers) {
    if (!trainer.importKey?.startsWith('rr41:')) continue
    const renamed = trainer.name.replace(/^(Rival|Champion) Terry\b/, '$1 Blue')
    if (renamed !== trainer.name) {
      trainer.name = renamed
      changed = true
    }
  }
  return changed
}

function getState(): Trainer[] {
  if (!state) {
    state = load()
    if (renameImportedRival(state)) persist()
  }
  return state
}

function persist(): void {
  writeFileSync(savePathFor('trainers.json'), JSON.stringify(getState()), 'utf8')
}

export function listTrainers(): Trainer[] {
  return [...getState()]
}

export function addTrainer(input: Omit<Trainer, 'id'>): Trainer {
  const trainer: Trainer = { id: randomUUID(), ...input, drops: cleanDrops(input.drops) }
  getState().push(trainer)
  persist()
  return trainer
}

export function updateTrainer(id: string, input: Omit<Trainer, 'id'>): Trainer[] {
  const trainer = getState().find((t) => t.id === id)
  if (!trainer) throw new Error(`Unknown trainer id: ${id}`)
  Object.assign(trainer, input, { drops: cleanDrops(input.drops) })
  persist()
  return listTrainers()
}

export function deleteTrainer(id: string): Trainer[] {
  state = getState().filter((t) => t.id !== id)
  persist()
  return listTrainers()
}

