import type { LiveMovePower } from '../../shared/battle-types'
import { t } from './i18n'

/** The short label for a move button: "BP 120", "BP 40–120", "Dmg 60", "BP varies" - or null for a move with no damage. */
export function movePowerLabel(power: LiveMovePower | undefined | null): string | null {
  if (!power) return null
  if (power.varies) return t('move.bpVaries')
  if (power.fixedDamage !== null) return t('move.dmg', { n: power.fixedDamage })
  if (power.basePower === null) return null
  const label = t('move.bp', { n: power.basePowerMax !== null ? `${power.basePower}–${power.basePowerMax}` : power.basePower })
  // Doubled against a Dynamaxed foe (Behemoth Blade and co.).
  return power.dynamaxBonus ? `${label} (2×)` : label
}

/** The wording for a move's tooltip, where the printed power is replaced by what it is right now. */
export function movePowerText(power: LiveMovePower | undefined | null, printed: number): string {
  if (!power) return String(printed || '—')
  if (power.varies) return t('move.variesEachUse')
  if (power.fixedDamage !== null) return t('move.fixedDamage', { n: power.fixedDamage })
  if (power.basePower === null) return '—'
  const value = power.basePowerMax !== null ? `${power.basePower}–${power.basePowerMax}` : String(power.basePower)
  if (power.dynamaxBonus) return t('move.doubledDynamax', { n: value })
  return power.dynamic ? t('move.rightNow', { n: value }) : value
}

/** A move category's name (Physical, Special, Status) in the player's language. */
export function categoryName(category: string): string {
  return category === 'Physical' || category === 'Special' || category === 'Status' ? t(`category.${category}`) : category
}
