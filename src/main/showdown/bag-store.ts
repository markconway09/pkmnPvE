import { readFileSync, writeFileSync } from 'node:fs'
import type { BagItemView } from '../../shared/battle-types'
import { EXP_CANDY_EXP, OPENABLE_ITEM_IDS } from '../../shared/battle-types'
import { BAG_CATEGORY_ORDER, bagCategoryFor, getEditorOptions, sellPriceFor } from './sim-access'
import { fossilKindOf, singleFossilSpecies } from './fossils'
import { playerPathFor } from './save-paths'
import { onPlayerChange } from './player-session'

interface StoredBag {
  items: Record<string, number>
}

function emptyBag(): StoredBag {
  return { items: {} }
}

function load(): StoredBag {
  // Outside the try: not being logged in is a bug to surface, not an empty save.
  const path = playerPathFor('bag.json')
  try {
    const raw = readFileSync(path, 'utf8')
    const parsed = JSON.parse(raw) as StoredBag
    if (!parsed.items || typeof parsed.items !== 'object') return emptyBag()
    return parsed
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code
    if (code !== 'ENOENT') console.error('[bag-store] failed to load bag.json:', e)
    return emptyBag()
  }
}

let state: StoredBag | null = null

// Each player has their own bag: forget the cached one when the player changes.
onPlayerChange(() => {
  state = null
})

function getState(): StoredBag {
  if (!state) state = load()
  return state
}

function persist(): void {
  writeFileSync(playerPathFor('bag.json'), JSON.stringify(getState()), 'utf8')
}

export function getBagState(): BagItemView[] {
  const catalog = new Map(getEditorOptions().items.map((i) => [i.id, i]))
  const views: BagItemView[] = []
  for (const [id, quantity] of Object.entries(getState().items)) {
    if (quantity <= 0) continue
    const item = catalog.get(id)
    if (!item) continue
    views.push({
      id: item.id,
      name: item.name,
      category: bagCategoryFor(item.id),
      description: item.description,
      spritenum: item.spritenum,
      quantity,
      sellPrice: sellPriceFor(item.id),
      opens: OPENABLE_ITEM_IDS.has(item.id),
      fossil: fossilKindOf(item.id),
      restoresTo: singleFossilSpecies(item.id),
      teamExp: EXP_CANDY_EXP[item.id] ?? null
    })
  }
  // Grouped by category in the shop's order, then by name within each.
  return views.sort(
    (a, b) => BAG_CATEGORY_ORDER.indexOf(a.category) - BAG_CATEGORY_ORDER.indexOf(b.category) || a.name.localeCompare(b.name)
  )
}

export function hasItem(itemId: string): boolean {
  return (getState().items[itemId] ?? 0) > 0
}

export function getItemQuantity(itemId: string): number {
  return getState().items[itemId] ?? 0
}

export function addItem(itemId: string, quantity = 1): void {
  if (quantity <= 0) return
  const items = getState().items
  items[itemId] = (items[itemId] ?? 0) + quantity
  persist()
}

/** Returns false (and leaves the bag untouched) if there isn't enough to remove. */
export function removeItem(itemId: string, quantity = 1): boolean {
  const items = getState().items
  const current = items[itemId] ?? 0
  if (current < quantity) return false
  const remaining = current - quantity
  if (remaining <= 0) delete items[itemId]
  else items[itemId] = remaining
  persist()
  return true
}

export function resetBag(): void {
  state = emptyBag()
  persist()
}
