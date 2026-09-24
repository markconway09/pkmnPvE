import type { WildLocationId } from '../../shared/battle-types'

// Battle backdrops and weather/terrain overlays, all taken from Pokemon
// Showdown's client (its gen 6+ battle backgrounds and `fx/weather-*` images).

const BACKDROP_IDS = [
  'aquacordetown',
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
  'icecave',
  'leaderwallace',
  'library',
  'meadow',
  'orasdesert',
  'orassea',
  'skypillar'
]

// Which of the backdrops above look right for a wild encounter in each menu
// location - picked by hand for vibe (a cave id is a dark rocky interior, an
// "ocean" id is open/beach water, ...). Nothing here is a dedicated
// industrial or graveyard scene, so those two borrow the closest fits: the
// grittier city shots for Industry, the dim indoor/arena ones for Graveyard.
const LOCATION_BACKDROP_IDS: Record<WildLocationId, string[]> = {
  cave: ['dampcave', 'earthycave', 'icecave'],
  mountain: ['skypillar', 'orasdesert', 'desert'],
  forest: ['forest', 'darkmeadow', 'meadow'],
  city: ['city', 'darkcity'],
  industry: ['aquacordetown', 'darkcity'],
  cemetery: ['library', 'elite4drake'],
  ocean: ['beach', 'darkbeach', 'deepsea', 'orassea', 'leaderwallace'],
  all: BACKDROP_IDS
}

// `location` is only known for a wild battle - everything else (trainer,
// boss, player challenge) still picks from every backdrop, same as before.
export function randomBackdropId(location?: WildLocationId): string {
  const pool = location ? LOCATION_BACKDROP_IDS[location] : BACKDROP_IDS
  return pool[Math.floor(Math.random() * pool.length)]
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
