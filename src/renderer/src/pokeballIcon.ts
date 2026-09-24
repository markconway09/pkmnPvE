import type { CSSProperties } from 'react'

// Vendored from https://play.pokemonshowdown.com/sprites/pokemonicons-pokeball-sheet.png -
// three 40x30 slots (healthy ball, statused ball, a small dot), same offsets
// Showdown's own client uses. Fainted reuses the healthy ball's shape rather
// than the dot, greyed out via filter, so it still reads as "a Pokemon was
// here" - the dot is left for "no Pokemon in this slot at all".
const SHEET_URL = './sprites/misc/pokeball-status.png'

export type BallState = 'healthy' | 'statused' | 'fainted' | 'empty'

// The sheet's three frames, at their native size (40x30 each, 120x30 total).
const FRAME_WIDTH = 40
const FRAME_HEIGHT = 30
const FRAME_Y_OFFSET = 4

/** `scale` blows the icon up while keeping it correctly cropped from the sheet - not just a
 * bigger box, since the background wouldn't stretch to fill it without also being told to. */
export function pokeballStyle(state: BallState, scale = 1): CSSProperties {
  const base: CSSProperties = {
    display: 'inline-block',
    width: FRAME_WIDTH * scale,
    height: FRAME_HEIGHT * scale,
    backgroundImage: `url(${SHEET_URL})`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: `${FRAME_WIDTH * 3 * scale}px ${FRAME_HEIGHT * scale}px`,
    imageRendering: 'pixelated'
  }
  const atFrame = (frameX: number): CSSProperties => ({
    ...base,
    backgroundPosition: `${frameX * scale}px ${FRAME_Y_OFFSET * scale}px`
  })
  switch (state) {
    case 'healthy':
      return atFrame(0)
    case 'statused':
      return atFrame(-FRAME_WIDTH)
    // A fainted Pokemon still gets the full ball shape (frame 0) - just greyed
    // out - so it reads as "sent out and down" rather than "never had one".
    case 'fainted':
      return { ...atFrame(0), filter: 'grayscale(1) brightness(0.55)' }
    case 'empty':
      return atFrame(-FRAME_WIDTH * 2)
  }
}

export function ballStateFor(slot: { fainted: boolean; status: string | null } | undefined): BallState {
  if (!slot) return 'empty'
  if (slot.fainted) return 'fainted'
  if (slot.status) return 'statused'
  return 'healthy'
}
