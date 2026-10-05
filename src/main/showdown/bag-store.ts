import { readFileSync, writeFileSync } from 'node:fs'
import type { BagItemView, EvolutionItemUse, ItemOptionEntry, RarityTier } from '../../shared/battle-types'
import { COIN_PRIZES } from '../../shared/slots'
import { coinPrizeRarityTier, priceRarityTier } from '../../shared/rarity'
import { EXP_CANDY_EXP, OPENABLE_ITEM_IDS } from '../../shared/battle-types'
import { BAG_CATEGORY_ORDER, RETIRED_ITEMS, bagCategoryFor, getEditorOptions, sellPriceFor, shopPriceFor } from './sim-access'
import { addMoney } from './money-store'
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
    if (retireItems(parsed)) writeFileSync(path, JSON.stringify(parsed), 'utf8')
    return parsed
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code
    if (code !== 'ENOENT') console.error('[bag-store] failed to load bag.json:', e)
    return emptyBag()
  }
}

// Items taken out of the game (see RETIRED_ITEMS) leave the bag: a Gen 2 berry becomes
// its modern twin, anything else is refunded. True if anything changed.
function retireItems(bag: StoredBag): boolean {
  let refund = 0
  let changed = false
  for (const [id, quantity] of Object.entries(bag.items)) {
    const retired = RETIRED_ITEMS[id]
    if (!retired) continue
    delete bag.items[id]
    changed = true
    if (quantity <= 0) continue
    if (retired.replacement) bag.items[retired.replacement] = (bag.items[retired.replacement] ?? 0) + quantity
    else refund += (retired.refund ?? 0) * quantity
  }
  if (refund > 0) addMoney(refund)
  return changed
}

/**
 * A bag item's colour on its card: by its Shop price when the Shop sells it, else by its
 * Coin Shop price for a coin prize; key items are gold, Mega Stones red, evolution items
 * purple, and anything else grey.
 */
export function bagItemRarity(itemId: string): RarityTier {
  const price = shopPriceFor(itemId)
  if (price !== null) return priceRarityTier(price)
  const prize = COIN_PRIZES.find((p) => p.itemId === itemId)
  if (prize) return coinPrizeRarityTier(prize.coins)
  const category = bagCategoryFor(itemId)
  if (category === 'Key Items') return 'legendary'
  if (category === 'Mega Stones') return 'epic'
  if (category === 'Evolution Items') return 'rare'
  return 'common'
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

/**
 * One item as the bag shows it, with however many the bag holds - none included. For an
 * item the Items window always lists (a Friendship Petal), owned or not. Null for an
 * unknown item.
 */
export function getBagItemView(itemId: string): BagItemView | null {
  const item = getEditorOptions().items.find((i) => i.id === itemId)
  return item ? bagItemView(item, getItemQuantity(itemId)) : null
}

function bagItemView(item: ItemOptionEntry, quantity: number): BagItemView {
  return {
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
    teamExp: EXP_CANDY_EXP[item.id] ?? null,
    rarityTier: bagItemRarity(item.id)
  }
}

export function getBagState(): BagItemView[] {
  const catalog = new Map(getEditorOptions().items.map((i) => [i.id, i]))
  const views: BagItemView[] = []
  for (const [id, quantity] of Object.entries(getState().items)) {
    if (quantity <= 0) continue
    const item = catalog.get(id)
    if (!item) continue
    views.push(bagItemView(item, quantity))
  }
  // Grouped by category in the shop's order, then by name within each.
  return views.sort(
    (a, b) => BAG_CATEGORY_ORDER.indexOf(a.category) - BAG_CATEGORY_ORDER.indexOf(b.category) || a.name.localeCompare(b.name)
  )
}

/** An item's name and icon with how many the bag has - for showing what an action would use up. */
export function bagItemUse(itemId: string): EvolutionItemUse | null {
  const item = getEditorOptions().items.find((i) => i.id === itemId)
  return item ? { name: item.name, spritenum: item.spritenum, quantity: getItemQuantity(itemId) } : null
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
