import { useRef } from 'react'

// Moving further than this at any point while pressed makes it a drag, not a click.
const TAP_SLOP = 6

/**
 * Tells a click apart from the end of a drag on something that's both clickable and
 * draggable: a drag dropped back where it started still fires a click, which shouldn't
 * open a menu. Spread `onPointerDownCapture` on the element and check `isTap()` in its
 * click handler. It watches how far the pointer strays during the whole press (on the
 * window, since a drag leaves the element), in the capture phase, so it never gets in
 * the way of the drag library's own pointer handling.
 */
export function useTapGuard(): {
  onPointerDownCapture: (e: React.PointerEvent) => void
  isTap: () => boolean
} {
  const dragged = useRef(false)
  return {
    onPointerDownCapture: (e) => {
      dragged.current = false
      const startX = e.clientX
      const startY = e.clientY
      const onMove = (move: PointerEvent): void => {
        if (Math.hypot(move.clientX - startX, move.clientY - startY) > TAP_SLOP) dragged.current = true
      }
      const onUp = (): void => {
        window.removeEventListener('pointermove', onMove, true)
        window.removeEventListener('pointerup', onUp, true)
      }
      window.addEventListener('pointermove', onMove, true)
      window.addEventListener('pointerup', onUp, true)
    },
    isTap: () => !dragged.current
  }
}
