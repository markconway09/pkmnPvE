import type { CSSProperties } from 'react'

// Vendored from https://play.pokemonshowdown.com/sprites/itemicons-sheet.png -
// a 16-column grid of 24x24 icons, indexed by each item's `spritenum` (from
// the same pokemon-showdown data used server-side), same math Showdown's own
// client uses to slice the sheet.
const SHEET_URL = './sprites/misc/itemicons-sheet.png'

export function itemIconStyle(spritenum: number): CSSProperties {
  const top = Math.floor(spritenum / 16) * 24
  const left = (spritenum % 16) * 24
  return {
    display: 'inline-block',
    width: 24,
    height: 24,
    backgroundImage: `url(${SHEET_URL})`,
    backgroundPosition: `-${left}px -${top}px`,
    backgroundRepeat: 'no-repeat',
    imageRendering: 'pixelated',
    flexShrink: 0
  }
}
