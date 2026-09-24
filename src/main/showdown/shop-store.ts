import type { SellResult, ShopItemEntry, ShopPriceEntry } from '../../shared/battle-types'
import { addItem, removeItem } from './bag-store'
import { addMoney, getMoney, spendMoney } from './money-store'
import { setShopPriceOverride } from './shop-price-store'
import { getDefaultShopCatalog, getShopCatalog, isLateGameItem, resetShopCatalogCache, sellPriceFor } from './sim-access'
import { lateItemsUnlocked } from './progression-store'

// What this player can actually buy right now - the late-game items stay out
// until they're unlocked. The admin price editor still sees everything.
function buyableCatalog(): ShopItemEntry[] {
  if (lateItemsUnlocked()) return getShopCatalog()
  return getShopCatalog().filter((i) => !isLateGameItem(i.id))
}

export function listShop(): ShopItemEntry[] {
  return buyableCatalog()
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

export function buyItem(itemId: string, quantity: number): PurchaseResult {
  const qty = Math.floor(quantity)
  if (qty <= 0) return { success: false, money: getMoney() }
  const item = buyableCatalog().find((i) => i.id === itemId)
  if (!item) return { success: false, money: getMoney() }
  if (!spendMoney(item.price * qty)) return { success: false, money: getMoney() }
  addItem(itemId, qty)
  return { success: true, money: getMoney() }
}
