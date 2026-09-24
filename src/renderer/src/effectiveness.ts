// Type effectiveness as the battle screen shows it (on move buttons and in the
// doubles target picker) - see moveTypeEffectiveness in sim-access.ts for where
// the numbers come from.

export interface EffectivenessChip {
  // Who it's against, for the chip's tooltip.
  foeName: string
  multiplier: number
}

const MULTIPLIER_TEXT: Record<string, string> = {
  '0': '0×',
  '0.25': '¼×',
  '0.5': '½×',
  '1': '1×',
  '2': '2×',
  '4': '4×'
}

export function effectivenessText(multiplier: number): string {
  return MULTIPLIER_TEXT[String(multiplier)] ?? `${multiplier}×`
}

export function effectivenessWords(multiplier: number): string {
  if (multiplier === 0) return 'No effect'
  if (multiplier > 1) return 'Super effective'
  if (multiplier < 1) return 'Not very effective'
  return 'Neutral'
}

export function effectivenessClass(multiplier: number): string {
  if (multiplier === 0) return 'eff-immune'
  if (multiplier > 1) return 'eff-super'
  if (multiplier < 1) return 'eff-resisted'
  return 'eff-neutral'
}

// The same multipliers from the receiving end (how hard a foe hits you): high is bad,
// low is good, and an immunity is best of all.
export function defensiveClass(multiplier: number): string {
  if (multiplier === 0) return 'eff-def-immune'
  if (multiplier > 1) return 'eff-resisted'
  if (multiplier < 1) return 'eff-super'
  return 'eff-neutral'
}

// The opponent's active slots in the order they appear on screen, left to right:
// in doubles its second Pokemon (p2b) is drawn further left than its first (p2a).
export function foeSlotsLeftToRight(isDoubles: boolean): number[] {
  return isDoubles ? [1, 0] : [0]
}
