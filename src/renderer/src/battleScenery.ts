import type { BattleView, WildLocationId } from '../../shared/battle-types'

// Battle backdrops and weather/terrain overlays, taken from Pokemon Showdown's client
// (its gen 6+ battle backgrounds and `fx/weather-*` images) - plus a few taken from X and Y
// themselves (shared by phoenixoflight92 on DeviantArt): gym, terrace, frostcavern, lab,
// battlemaison and indoor.

const BACKDROP_IDS = [
  'aquacordetown',
  'battlemaison',
  'beach',
  'city',
  'dampcave',
  'darkbeach',
  'darkcity',
  'darkmeadow',
  'deepsea',
  'desert',
  'earthycave',
  'elite4drake',
  'forest',
  'frostcavern',
  'gym',
  'icecave',
  'indoor',
  'lab',
  'leaderwallace',
  'library',
  'meadow',
  'orasdesert',
  'orassea',
  'skypillar',
  'terrace'
]

// Every boss fights in the gym (Classic and Roguelite alike), and every Max Raid in the
// frost cavern.
const BOSS_BACKDROP = 'gym'
const RAID_BACKDROP = 'frostcavern'

// Which of the backdrops above look right for a wild encounter in each menu
// location - picked by hand for vibe (a cave id is a dark rocky interior, an
// "ocean" id is open/beach water, ...). Nothing here is a dedicated
// industrial or graveyard scene, so those two borrow the closest fits: the
// grittier city shots for Industry, the dim indoor/arena ones for Graveyard.
const LOCATION_BACKDROP_IDS: Record<WildLocationId, string[]> = {
  cave: ['dampcave', 'earthycave', 'icecave', 'frostcavern'],
  mountain: ['skypillar', 'orasdesert', 'desert'],
  forest: ['forest', 'darkmeadow', 'meadow', 'terrace'],
  city: ['city', 'darkcity', 'terrace', 'battlemaison'],
  industry: ['aquacordetown', 'darkcity'],
  cemetery: ['library', 'elite4drake'],
  ocean: ['beach', 'darkbeach', 'deepsea', 'orassea', 'leaderwallace'],
  all: BACKDROP_IDS,
  lab: ['lab', 'indoor']
}

// The one backdrop each location's button in the main menu shows behind its name.
export const LOCATION_BUTTON_BACKDROP: Record<WildLocationId, string> = {
  cave: 'earthycave',
  mountain: 'skypillar',
  forest: 'forest',
  city: 'city',
  industry: 'darkcity',
  cemetery: 'elite4drake',
  ocean: 'beach',
  all: 'meadow',
  lab: 'lab'
}

// Each wild location's icon (overworld sprites from Bulbapedia's archives, in
// public/icons/locations) - "All" and anything without one of its own get wild grass.
export function locationIconUrl(location: WildLocationId | undefined): string {
  return location && location !== 'all' ? `./icons/locations/${location}.png` : './icons/tall-grass.png'
}

// `location` is only known for a wild battle - everything else (trainer,
// boss, player challenge) still picks from every backdrop, same as before.
export function randomBackdropId(location?: WildLocationId): string {
  const pool = location ? LOCATION_BACKDROP_IDS[location] : BACKDROP_IDS
  return pool[Math.floor(Math.random() * pool.length)]
}

/** A battle's backdrop: a boss's gym, a raid's frost cavern, or one for where it is. */
export function battleBackdropId(view: BattleView, location?: WildLocationId): string {
  if (view.raid) return RAID_BACKDROP
  if (view.bossBattle) return BOSS_BACKDROP
  return randomBackdropId(location)
}

export function backdropUrl(id: string): string {
  return `./battle/bg/bg-${id}.jpg`
}

interface OverlayStyle {
  image: string
  // Showdown paints a flat colour under each image, and text drawn over it
  // (the turns-left badge) is tinted to match.
  backgroundColor: string
  textColor: string
}

const SUN: OverlayStyle = { image: 'weather-sunnyday.jpg', backgroundColor: '#FFEEBB', textColor: '#664411' }
const RAIN: OverlayStyle = { image: 'weather-raindance.jpg', backgroundColor: '#99BBFF', textColor: '#0044BB' }
const HAIL: OverlayStyle = { image: 'weather-hail.png', backgroundColor: '#AADDEE', textColor: '#114455' }
const ROOM = { backgroundColor: '#DDAAEE', textColor: '#661155' }

// Keyed by the sim's effect id.
export const OVERLAY_STYLES: Record<string, OverlayStyle> = {
  sunnyday: SUN,
  desolateland: SUN,
  raindance: RAIN,
  primordialsea: RAIN,
  sandstorm: { image: 'weather-sandstorm.png', backgroundColor: '#E6E0AC', textColor: '#554433' },
  hail: HAIL,
  snowscape: HAIL,
  deltastream: { image: 'weather-strongwind.png', backgroundColor: '#AAAAAA', textColor: '#666666' },
  mistyterrain: { image: 'weather-mistyterrain.png', backgroundColor: '#EEAACC', textColor: '#551144' },
  electricterrain: { image: 'weather-electricterrain.png', backgroundColor: '#EEEEAA', textColor: '#444411' },
  grassyterrain: { image: 'weather-grassyterrain.png', backgroundColor: '#CCEEAA', textColor: '#335511' },
  psychicterrain: { image: 'weather-psychicterrain.png', backgroundColor: '#CCAAEE', textColor: '#441155' },
  gravity: { image: 'weather-gravity.png', ...ROOM },
  magicroom: { image: 'weather-magicroom.png', ...ROOM },
  trickroom: { image: 'weather-trickroom.png', ...ROOM },
  wonderroom: { image: 'weather-wonderroom.png', ...ROOM }
}

// These three are always on until something replaces them, so Showdown draws
// them much more solidly than an ordinary timed weather.
export const INTENSE_WEATHER = new Set(['desolateland', 'primordialsea', 'deltastream'])

export function overlayImageUrl(style: OverlayStyle): string {
  return `./battle/fx/${style.image}`
}
