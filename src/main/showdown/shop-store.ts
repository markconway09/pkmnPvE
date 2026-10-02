import type { ItemQuantity, KeyItemView, SellResult, ShopItemEntry, ShopPriceEntry } from '../../shared/battle-types'
import { KEY_ITEM_IDS } from '../../shared/battle-types'
import { ACHIEVEMENTS } from '../../shared/achievements'
import { addItem, getBagState, getItemQuantity, hasItem, removeItem } from './bag-store'
import { ownsSpecies } from './box-store'
import { addMoney, getMoney, spendMoney } from './money-store'
import { setShopPriceOverride } from './shop-price-store'
import {
  getDefaultShopCatalog,
  getEditorOptions,
  getShopCatalog,
  isLateGameItem,
  quickSellKind,
  resetShopCatalogCache,
  sellPriceFor
} from './sim-access'
import { lateItemsUnlocked } from './progression-store'
import { bulkShopPrice, shopPrice } from './title-perks'
import { shopTotal } from '../../shared/battle-types'
import { TYCOON_BULK_MIN } from '../../shared/titles'

// What this player can actually buy right now - the late-game items stay out
// until they're unlocked. The admin price editor still sees everything. Prices are what
// this player pays (the Tycoon title's discount), unless asked for the Shop's own.
function buyableCatalog(discounted = true): ShopItemEntry[] {
  const catalog = lateItemsUnlocked() ? getShopCatalog() : getShopCatalog().filter((i) => !isLateGameItem(i.id))
  return discounted ? catalog.map((item) => ({ ...item, price: shopPrice(item.price), bulkPrice: bulkShopPrice(item.price) })) : catalog
}

/**
 * The shop's shelves: what can be bought. `discounted` false gives the Shop's own prices
 * (for the Lock Capsule's odds).
 */
export function listShop(discounted = true): ShopItemEntry[] {
  return buyableCatalog(discounted)
}

/**
 * Every key item, for the Bag | Shop window's Key Items tab: never sold, just whether the
 * player has each and the achievement that unlocks it.
 */
export function listKeyItems(): KeyItemView[] {
  return getEditorOptions()
    .items.filter((item) => KEY_ITEM_IDS.has(item.id))
    .map((item) => ({
      ...item,
      owned: hasItem(item.id),
      unlockedBy: ACHIEVEMENTS.find((a) => a.reward.keyItems?.includes(item.id))?.name ?? 'an achievement'
    }))
}

/** The whole shop with each item's default price beside its current one, for the admin price editor. */
export function listShopPrices(): ShopPriceEntry[] {
  const defaults = new Map(getDefaultShopCatalog().map((i) => [i.id, i.price]))
  return getShopCatalog().map((item) => ({ ...item, defaultPrice: defaults.get(item.id) ?? item.price }))
}

/** Changes one item's shop price (null puts it back to the default). Returns the updated list. */
export function setShopPrice(itemId: string, price: number | null): ShopPriceEntry[] {
  if (!getDefaultShopCatalog().some((i) => i.id === itemId)) throw new Error("That item isn't sold in the shop")
  setShopPriceOverride(itemId, price)
  resetShopCatalogCache()
  return listShopPrices()
}

export interface PurchaseResult {
  success: boolean
  money: number
}

/** Sells one of an item from the bag for half its shop price. */
export function sellItem(itemId: string): SellResult {
  const price = sellPriceFor(itemId)
  if (price === null) throw new Error("That item can't be sold")
  if (!removeItem(itemId, 1)) throw new Error("You don't have that item")
  addMoney(price)
  return { sold: price, money: getMoney() }
}

/**
 * Sells several items in one go - all or nothing: every entry is checked (sellable, and
 * that many in the bag) before anything is taken.
 */
export function sellItems(entries: ItemQuantity[]): SellResult {
  const priced = entries
    .map((e) => ({ itemId: e.itemId, quantity: Math.floor(e.quantity), price: sellPriceFor(e.itemId) }))
    .filter((e) => e.quantity > 0)
  if (priced.length === 0) throw new Error('Nothing to sell')
  for (const e of priced) {
    if (e.price === null) throw new Error("One of those items can't be sold")
    if (getItemQuantity(e.itemId) < e.quantity) throw new Error("You don't have that many of one of those items")
  }
  let sold = 0
  for (const e of priced) {
    removeItem(e.itemId, e.quantity)
    sold += e.price! * e.quantity
  }
  addMoney(sold)
  return { sold, money: getMoney() }
}

/**
 * The bag's Quick sell: every sell-only item (Bottle Caps...), every berry but the ones
 * worth holding, and every Memory, Plate and Drive while there's no Silvally, Arceus or
 * Genesect (respectively) in the box to hold one - all of each.
 */
export function quickSellSelection(): ItemQuantity[] {
  const owned = new Map<string, boolean>()
  const ownsCached = (species: string): boolean => {
    if (!owned.has(species)) owned.set(species, ownsSpecies(species))
    return owned.get(species)!
  }
  return getBagState()
    .filter((item) => item.sellPrice !== null)
    .filter((item) => {
      const kind = quickSellKind(item.id)
      if (!kind) return false
      return kind.kind !== 'forPokemon' || !ownsCached(kind.species)
    })
    .map((item) => ({ itemId: item.id, quantity: item.quantity }))
}

export function buyItem(itemId: string, quantity: number): PurchaseResult {
  const qty = Math.floor(quantity)
  if (qty <= 0) return { success: false, money: getMoney() }
  const item = buyableCatalog().find((i) => i.id === itemId)
  if (!item) return { success: false, money: getMoney() }
  // Tycoon: from TYCOON_BULK_MIN at once, each one at its bulk price.
  if (!spendMoney(shopTotal(item, qty, TYCOON_BULK_MIN))) return { success: false, money: getMoney() }
  addItem(itemId, qty)
  return { success: true, money: getMoney() }
}
