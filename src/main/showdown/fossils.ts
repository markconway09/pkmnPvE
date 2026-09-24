// Which Pokemon each fossil restores into. Pure data plus the pairing rules -
// the actual spending/adding lives in fossil-store.ts.

// Fossils that restore into a Pokemon on their own.
const SINGLE_FOSSILS: Record<string, string> = {
  helixfossil: 'Omanyte',
  domefossil: 'Kabuto',
  oldamber: 'Aerodactyl',
  rootfossil: 'Lileep',
  clawfossil: 'Anorith',
  skullfossil: 'Cranidos',
  armorfossil: 'Shieldon',
  coverfossil: 'Tirtouga',
  plumefossil: 'Archen',
  jawfossil: 'Tyrunt',
  sailfossil: 'Amaura'
}

// The four Galar fossils are only ever half a Pokemon: one from each column
// below is needed, and which two decides the result.
const GALAR_TOP_HALVES = ['fossilizedbird', 'fossilizedfish']
const GALAR_BOTTOM_HALVES = ['fossilizeddrake', 'fossilizeddino']

const GALAR_RESULTS: Record<string, string> = {
  'fossilizedbird+fossilizeddrake': 'Dracozolt',
  'fossilizedbird+fossilizeddino': 'Arctozolt',
  'fossilizedfish+fossilizeddrake': 'Dracovish',
  'fossilizedfish+fossilizeddino': 'Arctovish'
}

/** Every Pokemon a fossil can restore into - kept out of the wild (see generateRandomWildMon). */
export const FOSSIL_SPECIES: string[] = [...Object.values(SINGLE_FOSSILS), ...Object.values(GALAR_RESULTS)]

export type FossilKind = 'single' | 'galar'

export function fossilKindOf(itemId: string): FossilKind | null {
  if (itemId in SINGLE_FOSSILS) return 'single'
  if (GALAR_TOP_HALVES.includes(itemId) || GALAR_BOTTOM_HALVES.includes(itemId)) return 'galar'
  return null
}

/** What a lone fossil restores into, or null for one that needs a partner. */
export function singleFossilSpecies(itemId: string): string | null {
  return SINGLE_FOSSILS[itemId] ?? null
}

/** The fossils a Galar fossil can be combined with (the other column). */
export function galarPartnerIds(itemId: string): string[] {
  if (GALAR_TOP_HALVES.includes(itemId)) return GALAR_BOTTOM_HALVES
  if (GALAR_BOTTOM_HALVES.includes(itemId)) return GALAR_TOP_HALVES
  return []
}

/** What two Galar fossils restore into (either order), or null if they don't fit together. */
export function galarPairSpecies(itemId: string, otherId: string): string | null {
  const [top, bottom] = GALAR_TOP_HALVES.includes(itemId) ? [itemId, otherId] : [otherId, itemId]
  return GALAR_RESULTS[`${top}+${bottom}`] ?? null
}
