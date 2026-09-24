import { randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import type { BoxState, LoadoutView } from '../../shared/battle-types'
import { getBoxState, setTeam } from './box-store'
import { playerPathFor } from './save-paths'
import { onPlayerChange } from './player-session'

function load(): LoadoutView[] {
  try {
    const raw = readFileSync(playerPathFor('loadouts.json'), 'utf8')
    const parsed = JSON.parse(raw) as LoadoutView[]
    return Array.isArray(parsed) ? parsed : []
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code
    if (code !== 'ENOENT') console.error('[loadout-store] failed to load loadouts.json:', e)
    return []
  }
}

// Same lazy-load-then-cache pattern as box-store - importing this module
// happens before the userData directory is reliably ready to read from.
let state: LoadoutView[] | null = null

onPlayerChange(() => {
  state = null
})

function getState(): LoadoutView[] {
  if (!state) state = load()
  return state
}

function persist(): void {
  writeFileSync(playerPathFor('loadouts.json'), JSON.stringify(getState()), 'utf8')
}

function requireName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Give this loadout a name')
  return trimmed
}

export function listLoadouts(): LoadoutView[] {
  return getState().map((l) => ({ ...l, team: [...l.team] }))
}

export function saveLoadout(name: string): LoadoutView[] {
  const team = getBoxState().team
  getState().push({ id: randomUUID(), name: requireName(name), team: [...team] })
  persist()
  return listLoadouts()
}

// Overwrites an existing loadout with the team as it stands right now.
export function updateLoadout(id: string): LoadoutView[] {
  const loadout = getState().find((l) => l.id === id)
  if (!loadout) throw new Error('Unknown loadout')
  loadout.team = [...getBoxState().team]
  persist()
  return listLoadouts()
}

export function renameLoadout(id: string, name: string): LoadoutView[] {
  const loadout = getState().find((l) => l.id === id)
  if (!loadout) throw new Error('Unknown loadout')
  loadout.name = requireName(name)
  persist()
  return listLoadouts()
}

export function deleteLoadout(id: string): LoadoutView[] {
  const list = getState()
  const index = list.findIndex((l) => l.id === id)
  if (index === -1) throw new Error('Unknown loadout')
  list.splice(index, 1)
  persist()
  return listLoadouts()
}

// Only ever assigns Pokemon still actually in the box - a loadout saved
// before a box reset simply leaves those slots empty instead of failing.
export function applyLoadout(id: string): BoxState {
  const loadout = getState().find((l) => l.id === id)
  if (!loadout) throw new Error('Unknown loadout')
  const knownIds = new Set(getBoxState().mons.map((m) => m.id))
  const team = loadout.team.map((slotId) => (slotId && knownIds.has(slotId) ? slotId : null))
  return setTeam(team)
}
