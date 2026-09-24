import { readFileSync, writeFileSync } from 'node:fs'
import { savePathFor } from './save-paths'

// Shop prices an admin has changed, by item id. Shared by every player, like the trainers;
// anything not listed keeps its default price (see getShopCatalog).
type StoredPrices = Record<string, number>

const MAX_PRICE = 10_000_000

function load(): StoredPrices {
  try {
    const parsed = JSON.parse(readFileSync(savePathFor('shopPrices.json'), 'utf8')) as StoredPrices
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const clean: StoredPrices = {}
    for (const [id, price] of Object.entries(parsed)) {
      if (Number.isInteger(price) && price >= 0 && price <= MAX_PRICE) clean[id] = price
    }
    return clean
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code
    if (code !== 'ENOENT') console.error('[shop-price-store] failed to load shopPrices.json:', e)
    return {}
  }
}

let state: StoredPrices | null = null

function getState(): StoredPrices {
  if (!state) state = load()
  return state
}

export function getShopPriceOverrides(): StoredPrices {
  return getState()
}

/** Sets an item's price, or - with null - puts it back to its default. */
export function setShopPriceOverride(itemId: string, price: number | null): void {
  if (price === null) {
    delete getState()[itemId]
  } else {
    if (!Number.isInteger(price) || price < 0 || price > MAX_PRICE) {
      throw new Error(`A price must be a whole number from 0 to ${MAX_PRICE}`)
    }
    getState()[itemId] = price
  }
  writeFileSync(savePathFor('shopPrices.json'), JSON.stringify(getState()), 'utf8')
}
