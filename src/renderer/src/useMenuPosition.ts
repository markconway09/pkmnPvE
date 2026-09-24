import { useLayoutEffect, useRef } from 'react'

// Constant on purpose: the hook positions the element directly (below), and an
// unchanging style prop means React never overwrites that. Starting hidden at
// the corner gives the menu its natural, unsqueezed size to be measured at.
const INITIAL_STYLE: React.CSSProperties = { left: 0, top: 0, visibility: 'hidden' }

/**
 * Places a fixed-position menu at the cursor, flipping it above the cursor when
 * it would run off the bottom of the window and to the left when it would run
 * off the right. Measured before paint, so the menu never flashes in the wrong
 * place. The menu is kept fully on screen even if it is taller/wider than the
 * space on either side.
 */
export function useMenuPosition(
  x: number,
  y: number
): { ref: React.RefObject<HTMLDivElement>; style: React.CSSProperties } {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    // Measure away from the window edge: a fixed box pinned against it gets
    // squeezed and wraps its text, which would understate its width.
    el.style.left = '0px'
    el.style.top = '0px'
    const { width, height } = el.getBoundingClientRect()
    let left = x
    let top = y
    if (left + width > window.innerWidth) left = x - width
    if (top + height > window.innerHeight) top = y - height
    left = Math.max(0, Math.min(left, window.innerWidth - width))
    top = Math.max(0, Math.min(top, window.innerHeight - height))
    el.style.left = `${left}px`
    el.style.top = `${top}px`
    el.style.visibility = 'visible'
  }, [x, y])

  return { ref, style: INITIAL_STYLE }
}
