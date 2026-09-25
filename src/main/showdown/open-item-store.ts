import type { OpenItemResult, RarityTier, ReelEntry, ShopItemEntry } from '../../shared/battle-types'
import { LOCK_CAPSULE_ITEM_ID, RANDOM_LEGENDARY_ITEM_ID, RANDOM_POKEMON_ITEM_ID } from '../../shared/battle-types'
import {
  buildBasicSet,
  pickRandomLegendarySpecies,
  pickRandomUnevolvedAnySpecies,
  randomNatureName,
  rollGiftShiny,
  sellPriceFor,
  speciesRarityTier
} from './sim-access'
import { addItem, getItemQuantity, removeItem } from './bag-store'
import { addCaughtMon } from './box-store'
import { restoredLevel } from './fossil-store'
import { listShop } from './shop-store'

// The case-opening reel: this many cards, with the one actually won near the end so
// the strip has a long way to spin first.
const REEL_LENGTH = 60
const REEL_WINNER_INDEX = 50

function buildReel(winner: ReelEntry, filler: () => ReelEntry): ReelEntry[] {
  const reel = Array.from({ length: REEL_LENGTH }, filler)
  reel[REEL_WINNER_INDEX] = winner
  return reel
}

/**
 * Opens an openable bag item. The item is used up and:
 * - Random Pokemon / Random Legendary: a random Pokemon goes straight to the box - an
 *   unevolved one (a legendary is possible) for the first, an unevolved legendary /
 *   mythical / ultra beast / paradox one for the second. It arrives the way a restored
 *   fossil does, a little under the level cap, with a random nature and no friendship.
 * - Lock Capsule: a random item from the shop goes into the bag (see pickCapsuleItem).
 * The choice is made before anything is spent, so a failure leaves the bag untouched.
 */
export function openBagItem(itemId: string): OpenItemResult {
  if (itemId === LOCK_CAPSULE_ITEM_ID) return openLockCapsule()

  let pickSpecies: () => string
  if (itemId === RANDOM_POKEMON_ITEM_ID) pickSpecies = pickRandomUnevolvedAnySpecies
  else if (itemId === RANDOM_LEGENDARY_ITEM_ID) pickSpecies = pickRandomLegendarySpecies
  else throw new Error("That item can't be opened")

  if (getItemQuantity(itemId) < 1) throw new Error("You don't have that item")
  const species = pickSpecies()
  const level = restoredLevel()
  const shiny = rollGiftShiny()
  removeItem(itemId, 1)
  addCaughtMon({ ...buildBasicSet(species, level), nature: randomNatureName(), shiny })
  const asEntry = (name: string): ReelEntry => ({ name, species: name, tier: speciesRarityTier(name) })
  const winner = asEntry(species)
  return {
    kind: 'pokemon',
    name: species,
    level,
    shiny,
    tier: winner.tier,
    reel: buildReel(winner, () => asEntry(pickSpecies())),
    winnerIndex: REEL_WINNER_INDEX,
    remaining: getItemQuantity(itemId)
  }
}

// An item's colour on the reel, by what it costs in the shop.
function priceTier(price: number): RarityTier {
  if (price >= 20000) return 'legendary'
  if (price >= 10000) return 'epic'
  if (price >= 5000) return 'rare'
  if (price >= 1000) return 'uncommon'
  return 'common'
}

// The capsule's jackpots have fixed odds of their own, whatever their shop price.
const CAPSULE_JACKPOTS: [itemId: string, chance: number][] = [
  [RANDOM_LEGENDARY_ITEM_ID, 1 / 1000],
  [RANDOM_POKEMON_ITEM_ID, 1 / 100]
]

/**
 * A random item from the shop as it is for this player right now (so nothing still
 * locked away), except Lock Capsules themselves: a Random Legendary 1 time in 1000, a
 * Random Pokemon 1 in 100, and otherwise any other item, each weighted by 1 / its price,
 * so an item twice as expensive comes up half as often.
 */
function pickCapsuleItem(pool: ShopItemEntry[]): ShopItemEntry {
  let roll = Math.random()
  for (const [itemId, chance] of CAPSULE_JACKPOTS) {
    const jackpot = pool.find((item) => item.id === itemId)
    if (jackpot && roll < chance) return jackpot
    roll -= chance
  }
  const rest = pool.filter((item) => !CAPSULE_JACKPOTS.some(([id]) => id === item.id))
  const total = rest.reduce((sum, item) => sum + 1 / item.price, 0)
  let weighted = Math.random() * total
  for (const item of rest) {
    weighted -= 1 / item.price
    if (weighted < 0) return item
  }
  return rest[rest.length - 1]
}

function openLockCapsule(): OpenItemResult {
  if (getItemQuantity(LOCK_CAPSULE_ITEM_ID) < 1) throw new Error("You don't have that item")
  const pool = listShop().filter((item) => item.id !== LOCK_CAPSULE_ITEM_ID && item.price > 0)
  if (pool.length === 0) throw new Error('The shop has nothing to give')
  const item = pickCapsuleItem(pool)
  removeItem(LOCK_CAPSULE_ITEM_ID, 1)
  addItem(item.id, 1)
  const asEntry = (entry: ShopItemEntry): ReelEntry => ({
    name: entry.name,
    spritenum: entry.spritenum,
    tier: priceTier(entry.price)
  })
  const winner = asEntry(item)
  return {
    kind: 'item',
    name: item.name,
    itemId: item.id,
    sellPrice: sellPriceFor(item.id),
    level: 0,
    shiny: false,
    tier: winner.tier,
    reel: buildReel(winner, () => asEntry(pickCapsuleItem(pool))),
    winnerIndex: REEL_WINNER_INDEX,
    remaining: getItemQuantity(LOCK_CAPSULE_ITEM_ID)
  }
}
