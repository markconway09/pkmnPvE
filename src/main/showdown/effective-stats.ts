import type { ActivePokemonView, FieldEffectView, StatBlock } from '../../shared/battle-types'
import { isNotFullyEvolved, toID } from './sim-access'

type BattleStat = 'atk' | 'def' | 'spa' | 'spd' | 'spe'
const BATTLE_STATS: BattleStat[] = ['atk', 'def', 'spa', 'spd', 'spe']

// Showdown's own rounding: a stack of modifiers is combined in 4096ths, then
// applied once, rounding halves down. Matches Pokemon.getStat in the sim, so
// what the tooltip shows is what the battle uses.
function applyModifiers(value: number, modifiers: number[]): number {
  if (modifiers.length === 0) return value
  let chain = 4096
  for (const m of modifiers) chain = (chain * Math.trunc(m * 4096) + 2048) >> 12
  return Math.trunc((Math.trunc(value * chain) + 2048 - 1) / 4096)
}

// +1 is x1.5, +2 is x2 ... +6 is x4, and the same steps as fractions downwards.
function applyStage(stat: number, stage: number): number {
  const s = Math.max(-6, Math.min(6, stage))
  return s >= 0 ? Math.floor((stat * (2 + s)) / 2) : Math.floor((stat * 2) / (2 - s))
}

const SUN = new Set(['sunnyday', 'desolateland'])
const RAIN = new Set(['raindance', 'primordialsea'])
const SNOW = new Set(['snowscape', 'hail'])

interface Context {
  itemId: string
  abilityId: string
  status: string | null
  types: string[]
  species: string
  hpPercent: number
  weather: string | null
  terrain: string | null
  tailwind: boolean
  notFullyEvolved: boolean
}

const isPikachu = (species: string): boolean => species.startsWith('Pikachu')
const isCuboneLine = (species: string): boolean => species.startsWith('Cubone') || species.startsWith('Marowak')

// What raises or lowers each stat besides the stat stages: the held item, the
// ability, a status, and the weather, terrain and Tailwind. Only the effects that
// simply scale a stat are here - the ones that depend on things the battle log
// doesn't say (Unburden, Slow Start, Protosynthesis, Plus/Minus) are left out.
function modifiersFor(stat: BattleStat, c: Context): number[] {
  const mods: number[] = []
  const { itemId, abilityId, weather, terrain } = c
  switch (stat) {
    case 'atk':
      if (itemId === 'choiceband') mods.push(1.5)
      if (itemId === 'lightball' && isPikachu(c.species)) mods.push(2)
      if (itemId === 'thickclub' && isCuboneLine(c.species)) mods.push(2)
      if (abilityId === 'hugepower' || abilityId === 'purepower') mods.push(2)
      if (abilityId === 'hustle' || abilityId === 'gorillatactics') mods.push(1.5)
      if (abilityId === 'guts' && c.status) mods.push(1.5)
      if (abilityId === 'defeatist' && c.hpPercent <= 50) mods.push(0.5)
      break
    case 'spa':
      if (itemId === 'choicespecs') mods.push(1.5)
      if (itemId === 'lightball' && isPikachu(c.species)) mods.push(2)
      if (itemId === 'deepseatooth' && c.species === 'Clamperl') mods.push(2)
      if (abilityId === 'solarpower' && weather && SUN.has(weather)) mods.push(1.5)
      if (abilityId === 'defeatist' && c.hpPercent <= 50) mods.push(0.5)
      break
    case 'def':
      if (itemId === 'eviolite' && c.notFullyEvolved) mods.push(1.5)
      if (itemId === 'metalpowder' && c.species === 'Ditto') mods.push(1.5)
      if (abilityId === 'furcoat') mods.push(2)
      if (abilityId === 'marvelscale' && c.status) mods.push(1.5)
      if (abilityId === 'grasspelt' && terrain === 'grassyterrain') mods.push(1.5)
      if (weather && SNOW.has(weather) && c.types.includes('Ice')) mods.push(1.5)
      break
    case 'spd':
      if (itemId === 'assaultvest') mods.push(1.5)
      if (itemId === 'eviolite' && c.notFullyEvolved) mods.push(1.5)
      if (itemId === 'deepseascale' && c.species === 'Clamperl') mods.push(2)
      if (weather === 'sandstorm' && c.types.includes('Rock')) mods.push(1.5)
      break
    case 'spe':
      if (itemId === 'choicescarf') mods.push(1.5)
      if (itemId === 'ironball' || itemId === 'machobrace') mods.push(0.5)
      if (itemId === 'quickpowder' && c.species === 'Ditto') mods.push(2)
      if (c.tailwind) mods.push(2)
      if (c.status === 'par' && abilityId !== 'quickfeet') mods.push(0.5)
      if (abilityId === 'quickfeet' && c.status) mods.push(1.5)
      if (abilityId === 'swiftswim' && weather && RAIN.has(weather)) mods.push(2)
      if (abilityId === 'chlorophyll' && weather && SUN.has(weather)) mods.push(2)
      if (abilityId === 'sandrush' && weather === 'sandstorm') mods.push(2)
      if (abilityId === 'slushrush' && weather && SNOW.has(weather)) mods.push(2)
      if (abilityId === 'surgesurfer' && terrain === 'electricterrain') mods.push(2)
      break
  }
  return mods
}

/**
 * The stats a Pokemon actually has right now: its stat stages (from moves like
 * Swords Dance or Intimidate) and every item, ability, status, weather, terrain
 * and Tailwind effect that scales them. HP is never changed.
 */
export function effectiveStatsFor(
  view: ActivePokemonView,
  side: 'p1' | 'p2',
  effects: FieldEffectView[]
): StatBlock {
  const context: Context = {
    itemId: toID(view.item),
    abilityId: toID(view.ability),
    status: view.status,
    types: view.types,
    species: view.species,
    hpPercent: view.hpPercent,
    weather: effects.find((e) => e.kind === 'weather')?.id ?? null,
    terrain: effects.find((e) => e.kind === 'terrain')?.id ?? null,
    tailwind: effects.some((e) => e.kind === 'side' && e.side === side && e.id === 'tailwind'),
    notFullyEvolved: isNotFullyEvolved(view.species)
  }
  const result: StatBlock = { ...view.stats }
  for (const stat of BATTLE_STATS) {
    const staged = applyStage(view.stats[stat], view.boosts[stat] ?? 0)
    const final = applyModifiers(staged, modifiersFor(stat, context))
    result[stat] = stat === 'spe' ? Math.min(final, 10000) : final
  }
  return result
}
