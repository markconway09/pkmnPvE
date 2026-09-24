import showdownSpriteNames from './showdownSpriteNames.json'

export type SpriteStyle = '2d-static' | '2d-animated' | '3d-static' | '3d-animated'

const STORAGE_KEY = 'pkmnpve.spriteStyle'
const DEFAULT_STYLE: SpriteStyle = '3d-animated'

export const SPRITE_STYLES: SpriteStyle[] = ['2d-static', '2d-animated', '3d-static', '3d-animated']

export const SPRITE_STYLE_LABELS: Record<SpriteStyle, string> = {
  '2d-static': '2D',
  '2d-animated': '2D Animated',
  '3d-static': '3D',
  '3d-animated': '3D Animated'
}

export function loadSpriteStyle(): SpriteStyle {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (SPRITE_STYLES.includes(stored as SpriteStyle)) return stored as SpriteStyle
  } catch {
    // localStorage unavailable - fall through to default
  }
  return DEFAULT_STYLE
}

export function saveSpriteStyle(style: SpriteStyle): void {
  try {
    localStorage.setItem(STORAGE_KEY, style)
  } catch {
    // ignore - per-viewer convenience only
  }
}

// Shiny sprites aren't vendored locally (it would mean mirroring thousands of
// rarely-used images) - they're fetched from Showdown's own CDN on demand,
// the same source the local sprites were vendored from. Showdown names a form's
// sprite with a hyphen after the species ("zamazenta-crowned") where the local
// files don't ("zamazentacrowned"), so the name is translated first - see
// scripts/build-sprite-names.mjs, which builds the lookup.
const SHOWDOWN_NAMES = showdownSpriteNames as Record<string, string>
const SHINY_CDN_DIR: Record<SpriteStyle, { front: string; back: string }> = {
  '2d-static': { front: 'gen5-shiny', back: 'gen5-back-shiny' },
  '2d-animated': { front: 'gen5ani-shiny', back: 'gen5ani-back-shiny' },
  '3d-static': { front: 'home-shiny', back: 'home-shiny' },
  '3d-animated': { front: 'ani-shiny', back: 'ani-back-shiny' }
}

export function spriteUrl(
  style: SpriteStyle,
  facing: 'front' | 'back',
  spriteId: string,
  shiny = false
): string {
  const ext = style === '2d-static' || style === '3d-static' ? 'png' : 'gif'
  // Pokemon HOME art (3D static) has no official back view, so the front
  // render is used for both slots.
  const effectiveFacing = style === '3d-static' ? 'front' : facing
  if (shiny) {
    const dir = SHINY_CDN_DIR[style][effectiveFacing]
    return `https://play.pokemonshowdown.com/sprites/${dir}/${SHOWDOWN_NAMES[spriteId] ?? spriteId}.${ext}`
  }
  return `./sprites/${style}/${effectiveFacing}/${spriteId}.${ext}`
}

export function fallbackSpriteUrl(facing: 'front' | 'back', spriteId: string): string {
  return spriteUrl('2d-static', facing, spriteId)
}

/** The normal form of a form's sprite id ("clefable" for "clefablemega"), or null if it isn't a form. */
export function baseSpriteId(spriteId: string): string | null {
  const base = SHOWDOWN_NAMES[spriteId]?.split('-')[0]
  return base && base !== spriteId ? base : null
}

/**
 * Every picture worth trying for a Pokemon, best first, so a missing sprite never
 * makes it vanish: the sprite in the chosen style, the still 2D version (shiny, then
 * ordinary), the 3D still, and then the same for its normal form - a Mega with no art
 * of its own shows the Pokemon it evolved from.
 */
export function spriteCandidates(style: SpriteStyle, facing: 'front' | 'back', spriteId: string, shiny: boolean): string[] {
  const urls: string[] = []
  const add = (url: string): void => {
    if (!urls.includes(url)) urls.push(url)
  }
  const base = baseSpriteId(spriteId)
  for (const id of base ? [spriteId, base] : [spriteId]) {
    add(spriteUrl(style, facing, id, shiny))
    if (shiny && style !== '2d-static') add(spriteUrl('2d-static', facing, id, true))
    add(spriteUrl('2d-static', facing, id, false))
    // A form with no 2D art at all (a Z-A Mega) may still have a 3D still - better than
    // showing the wrong Pokemon.
    add(spriteUrl('3d-static', 'front', id, false))
  }
  return urls
}
