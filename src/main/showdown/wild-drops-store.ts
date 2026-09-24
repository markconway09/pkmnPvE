import { readFileSync, writeFileSync } from 'node:fs'
import type { ItemDropConfig, WildDropEntry } from '../../shared/battle-types'
import { toID } from './sim-access'
import { savePathFor } from './save-paths'

// Keyed by species id, so "Pikachu" and "pikachu" are the same entry.
type StoredWildDrops = Record<string, WildDropEntry>

function load(): StoredWildDrops {
  try {
    const raw = readFileSync(savePathFor('wildDrops.json'), 'utf8')
    const parsed = JSON.parse(raw) as StoredWildDrops
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code
    if (code !== 'ENOENT') console.error('[wild-drops-store] failed to load wildDrops.json:', e)
    return {}
  }
}

let state: StoredWildDrops | null = null

function getState(): StoredWildDrops {
  if (!state) state = load()
  return state
}

function persist(): void {
  writeFileSync(savePathFor('wildDrops.json'), JSON.stringify(getState()), 'utf8')
}

export function listWildDrops(): WildDropEntry[] {
  return Object.values(getState()).sort((a, b) => a.species.localeCompare(b.species))
}

// No item, or a 0% chance, means there's nothing to store - it clears any
// existing entry for that species instead.
export function setWildDrop(species: string, drop: ItemDropConfig): WildDropEntry[] {
  const key = toID(species)
  if (!key) throw new Error('Pick a species first')
  if (!drop.itemId || drop.chance <= 0) {
    delete getState()[key]
  } else {
    getState()[key] = {
      species,
      drop: { itemId: drop.itemId, chance: Math.max(0, Math.min(100, drop.chance)) }
    }
  }
  persist()
  return listWildDrops()
}

export function getWildDropFor(species: string): ItemDropConfig | null {
  return getState()[toID(species)]?.drop ?? null
}
