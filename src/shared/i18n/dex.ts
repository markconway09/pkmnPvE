// Move, item, ability, type, nature and stat names in the player's language. The game keeps
// working with Showdown's English names and ids; these only change what's shown. Spanish
// comes from the games' own names (dex-es.json, built by scripts/build-dex-es.mjs); anything
// missing there - or any other language - shows the English name.

import type { Locale } from './index'
import dexEs from './dex-es.json'
import { CUSTOM_ITEM_NAMES_ES, CUSTOM_ITEM_TEXTS_ES } from './custom-items-es'

export type DexKind = 'moves' | 'items' | 'abilities' | 'types' | 'natures' | 'stats'
export type DexTextKind = 'moves' | 'items' | 'abilities'

interface DexTable {
  moves: Record<string, string>
  items: Record<string, string>
  abilities: Record<string, string>
  types: Record<string, string>
  natures: Record<string, string>
  stats: Record<string, string>
  moveTexts: Record<string, string>
  itemTexts: Record<string, string>
  abilityTexts: Record<string, string>
}

// The games' names, with the game's own items added.
const spanish = dexEs as DexTable
const TABLES: Partial<Record<Locale, DexTable>> = {
  es: {
    ...spanish,
    items: { ...spanish.items, ...CUSTOM_ITEM_NAMES_ES },
    itemTexts: { ...spanish.itemTexts, ...CUSTOM_ITEM_TEXTS_ES }
  }
}

const TEXT_TABLES: Record<DexTextKind, 'moveTexts' | 'itemTexts' | 'abilityTexts'> = {
  moves: 'moveTexts',
  items: 'itemTexts',
  abilities: 'abilityTexts'
}

// Showdown's short stat names, to the table's full ones.
const STAT_IDS: Record<string, string> = {
  atk: 'attack',
  def: 'defense',
  spa: 'specialattack',
  spd: 'specialdefense',
  spe: 'speed'
}

export function dexId(name: string): string {
  // Accents dropped first, so "Pokédex Diploma" is pokedexdiploma.
  return name
    .normalize('NFD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

/** A move's, item's... name in a language, from its English name or its id. */
export function dexName(locale: Locale, kind: DexKind, nameOrId: string): string {
  const table = TABLES[locale]
  if (!table || !nameOrId) return nameOrId
  let id = dexId(nameOrId)
  if (kind === 'stats') id = STAT_IDS[id] ?? id
  return table[kind][id] ?? nameOrId
}

/** A move's, item's or ability's description in a language, or the English one given. */
export function dexText(locale: Locale, kind: DexTextKind, nameOrId: string, english: string): string {
  const table = TABLES[locale]
  if (!table) return english
  return table[TEXT_TABLES[kind]][dexId(nameOrId)] ?? english
}
