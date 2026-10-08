// Long press: holding the mouse (or a finger) still on something for a moment does the same
// as a right click, so every right-click menu also opens from a long press. If a menu did
// open, letting go doesn't also count as a click on whatever was pressed.

/** How long the press must be held, in ms. */
const HOLD_MS = 500
/** Moving further than this (px) means a drag or scroll, not a long press. */
const MOVE_TOLERANCE = 6

/** Places a long press leaves alone: text fields keep their own press-and-hold behaviour. */
const IGNORE = 'input, textarea, select, [contenteditable=""], [contenteditable="true"], [data-no-long-press]'

export function installLongPress(): void {
  let timer = 0
  let startX = 0
  let startY = 0

  const cancel = (): void => {
    if (timer) clearTimeout(timer)
    timer = 0
  }

  const onDown = (e: PointerEvent): void => {
    cancel()
    if (e.button !== 0 || !e.isPrimary) return
    const el = e.target as Element | null
    if (!el || el.closest(IGNORE)) return
    startX = e.clientX
    startY = e.clientY
    timer = window.setTimeout(() => {
      timer = 0
      if (!el.isConnected) return
      const menu = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: startX,
        clientY: startY,
        screenX: e.screenX,
        screenY: e.screenY,
        button: 2,
        buttons: 2
      })
      el.dispatchEvent(menu)
      // Every right-click menu calls preventDefault, so that's how we know one opened.
      if (!menu.defaultPrevented) return
      const swallow = (ev: MouseEvent): void => {
        ev.stopPropagation()
        ev.preventDefault()
      }
      window.addEventListener('click', swallow, { capture: true, once: true })
      window.addEventListener('pointerup', () => {
        setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0)
      }, { capture: true, once: true })
    }, HOLD_MS)
  }

  const onMove = (e: PointerEvent): void => {
    if (timer && Math.hypot(e.clientX - startX, e.clientY - startY) > MOVE_TOLERANCE) cancel()
  }

  // A touch screen's browser makes its own right click from a long press, on top of the
  // one above - only ours counts (it's a plain MouseEvent; the browser's is a touch PointerEvent).
  window.addEventListener(
    'contextmenu',
    (e) => {
      if (e instanceof PointerEvent && e.pointerType === 'touch') {
        e.preventDefault()
        e.stopImmediatePropagation()
      }
    },
    true
  )
  window.addEventListener('pointerdown', onDown, true)
  window.addEventListener('pointermove', onMove, true)
  window.addEventListener('pointerup', cancel, true)
  window.addEventListener('pointercancel', cancel, true)
  window.addEventListener('dragstart', cancel, true)
  window.addEventListener('wheel', cancel, { capture: true, passive: true })
  window.addEventListener('blur', cancel)
}
