import type { LiveMovePower } from '../../shared/battle-types'

/** The short label for a move button: "BP 120", "BP 40–120", "Dmg 60", "BP varies" - or null for a move with no damage. */
export function movePowerLabel(power: LiveMovePower | undefined | null): string | null {
  if (!power) return null
  if (power.varies) return 'BP varies'
  if (power.fixedDamage !== null) return `Dmg ${power.fixedDamage}`
  if (power.basePower === null) return null
  return power.basePowerMax !== null ? `BP ${power.basePower}–${power.basePowerMax}` : `BP ${power.basePower}`
}

/** The wording for a move's tooltip, where the printed power is replaced by what it is right now. */
export function movePowerText(power: LiveMovePower | undefined | null, printed: number): string {
  if (!power) return String(printed || '—')
  if (power.varies) return 'varies each use'
  if (power.fixedDamage !== null) return `${power.fixedDamage} (fixed damage)`
  if (power.basePower === null) return '—'
  const value = power.basePowerMax !== null ? `${power.basePower}–${power.basePowerMax}` : String(power.basePower)
  return power.dynamic ? `${value} (right now)` : value
}
