import type { StatBlock } from './battle-types'

const HIDDEN_POWER_TYPES = [
  'Fighting',
  'Flying',
  'Poison',
  'Ground',
  'Rock',
  'Bug',
  'Ghost',
  'Steel',
  'Fire',
  'Water',
  'Grass',
  'Electric',
  'Psychic',
  'Ice',
  'Dragon',
  'Dark'
]

/** Hidden Power's type for these IVs - the same rule the battle uses (all 31s make it Dark). */
export function hiddenPowerType(ivs: StatBlock): string {
  const order: (keyof StatBlock)[] = ['hp', 'atk', 'def', 'spe', 'spa', 'spd']
  const bits = order.reduce((sum, stat, i) => sum + ((ivs[stat] & 1) << i), 0)
  return HIDDEN_POWER_TYPES[Math.floor((bits * 15) / 63)]
}
