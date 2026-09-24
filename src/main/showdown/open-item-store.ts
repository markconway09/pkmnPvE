import type { OpenItemResult } from '../../shared/battle-types'
import { RANDOM_LEGENDARY_ITEM_ID, RANDOM_POKEMON_ITEM_ID } from '../../shared/battle-types'
import {
  buildBasicSet,
  pickRandomLegendarySpecies,
  pickRandomUnevolvedAnySpecies,
  randomNatureName,
  rollGiftShiny
} from './sim-access'
import { getItemQuantity, removeItem } from './bag-store'
import { addCaughtMon } from './box-store'
import { restoredLevel } from './fossil-store'

/**
 * Opens a Random Pokemon / Random Legendary from the bag: the item is used up and
 * a random Pokemon goes straight to the box - an unevolved one (a legendary is
 * possible) for the first, an unevolved legendary/mythical/ultra beast/paradox
 * one for the second. It arrives the way a restored fossil does, a little under
 * the level cap, with a random nature and no friendship. The choice is made
 * before anything is spent, so a failure leaves the bag untouched.
 */
export function openBagItem(itemId: string): OpenItemResult {
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
  return { species, level, shiny }
}
