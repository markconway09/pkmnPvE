import { readFileSync, writeFileSync } from 'node:fs'
import { playerPathFor } from './save-paths'
import { onPlayerChange } from './player-session'

const DEFAULT_MONEY = 1000

interface StoredMoney {
  amount: number
}

function defaultMoney(): StoredMoney {
  return { amount: DEFAULT_MONEY }
}

function load(): StoredMoney {
  // Outside the try: not being logged in is a bug to surface, not an empty save.
  const path = playerPathFor('money.json')
  try {
    const raw = readFileSync(path, 'utf8')
    const parsed = JSON.parse(raw) as StoredMoney
    if (typeof parsed.amount !== 'number') return defaultMoney()
    return parsed
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code
    if (code !== 'ENOENT') console.error('[money-store] failed to load money.json:', e)
    return defaultMoney()
  }
}

let state: StoredMoney | null = null

// Each player has their own wallet: forget the cached one when the player changes.
onPlayerChange(() => {
  state = null
})

function getState(): StoredMoney {
  if (!state) state = load()
  return state
}

function persist(): void {
  writeFileSync(playerPathFor('money.json'), JSON.stringify(getState()), 'utf8')
}

export function getMoney(): number {
  return getState().amount
}

export function addMoney(amount: number): number {
  if (amount <= 0) return getState().amount
  getState().amount += Math.floor(amount)
  persist()
  return getState().amount
}

/** Returns false (and leaves the balance untouched) if there isn't enough to spend. */
export function spendMoney(amount: number): boolean {
  if (amount <= 0) return true
  const s = getState()
  if (s.amount < amount) return false
  s.amount -= amount
  persist()
  return true
}

export function resetMoney(): void {
  state = defaultMoney()
  persist()
}
