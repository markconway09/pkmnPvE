import type { GalarFossilPartner, RestoreFossilResult } from '../../shared/battle-types'
import { FOSSIL_RESTORE_COST } from '../../shared/battle-types'
import { getEditorOptions, buildBasicSet, rollGiftShiny } from './sim-access'
import { galarPairSpecies, galarPartnerIds, singleFossilSpecies } from './fossils'
import { getItemQuantity, removeItem } from './bag-store'
import { getMoney, spendMoney } from './money-store'
import { getProgression } from './progression-store'
import { addCaughtMon } from './box-store'
import { itemName as localItemName, t } from '../i18n'

// A restored Pokemon arrives a little under the current level cap (never
// below level 5, never above the cap) - a level-5 Aerodactyl is no use
// forty levels into the game.
export function restoredLevel(): number {
  const levelCap = getProgression().levelCap
  return Math.min(levelCap, Math.max(5, levelCap - 10))
}

// In the game's language, for its lines.
function itemName(itemId: string): string {
  return localItemName(getEditorOptions().items.find((i) => i.id === itemId)?.name ?? itemId)
}

/** The fossils a Galar fossil pairs with, owned or not, and what each pairing restores. */
export function getGalarFossilPartners(itemId: string): GalarFossilPartner[] {
  const catalog = new Map(getEditorOptions().items.map((i) => [i.id, i]))
  return galarPartnerIds(itemId).flatMap((partnerId) => {
    const item = catalog.get(partnerId)
    const species = galarPairSpecies(itemId, partnerId)
    if (!item || !species) return []
    return [
      { itemId: partnerId, itemName: item.name, spritenum: item.spritenum, quantity: getItemQuantity(partnerId), species }
    ]
  })
}

/**
 * Turns a fossil (or, for the Galar ones, a pair) into a Pokemon in the box,
 * for a flat fee. Every check runs before anything is spent, so a refused
 * restore leaves the bag and wallet untouched.
 */
export function restoreFossil(itemId: string, secondItemId?: string): RestoreFossilResult {
  let species: string | null
  if (secondItemId) {
    species = galarPairSpecies(itemId, secondItemId)
    if (!species) throw new Error(t('err.thoseTwoFossilsDonTFit'))
  } else {
    species = singleFossilSpecies(itemId)
    if (!species) throw new Error(t('err.needsASecondFossilToBe', { a: itemName(itemId) }))
  }

  const used = secondItemId ? [itemId, secondItemId] : [itemId]
  for (const id of used) {
    if (getItemQuantity(id) < 1) throw new Error(t('err.youDonTHaveA', { a: itemName(id) }))
  }
  if (getMoney() < FOSSIL_RESTORE_COST) throw new Error(t('err.restoringAFossilCosts', { a: FOSSIL_RESTORE_COST }))

  spendMoney(FOSSIL_RESTORE_COST)
  for (const id of used) removeItem(id, 1)
  const level = restoredLevel()
  const shiny = rollGiftShiny()
  addCaughtMon({ ...buildBasicSet(species, level), shiny })
  return { species, level, shiny, money: getMoney() }
}
