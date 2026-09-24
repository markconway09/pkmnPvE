// The 27 regional starters, one per type per generation. Shared so the starter
// picker and the wild encounter odds (starters are rare in the wild - see
// generateRandomWildMon) always agree on who counts.
export const REGIONAL_STARTER_SPECIES: string[] = [
  'Bulbasaur', 'Charmander', 'Squirtle',
  'Chikorita', 'Cyndaquil', 'Totodile',
  'Treecko', 'Torchic', 'Mudkip',
  'Turtwig', 'Chimchar', 'Piplup',
  'Snivy', 'Tepig', 'Oshawott',
  'Chespin', 'Fennekin', 'Froakie',
  'Rowlet', 'Litten', 'Popplio',
  'Grookey', 'Scorbunny', 'Sobble',
  'Sprigatito', 'Fuecoco', 'Quaxly'
]

// What the starter picker offers: the regional starters plus the two mascots.
export const STARTER_SPECIES: string[] = [...REGIONAL_STARTER_SPECIES, 'Pikachu', 'Eevee']
