// Drag-to-scroll: hold the left mouse button on any scrollable list and drag to move it,
// like a touch screen, with a little glide after letting go. A short press is still a click;
// once the mouse has moved past a few pixels it becomes a scroll and the click is swallowed.

/** Pixels the mouse must travel before a press turns into a drag. */
const DRAG_THRESHOLD = 6
/** How much of the glide speed is kept each frame after letting go. */
const FRICTION = 0.92
/** Glide stops once it is slower than this (px per frame). */
const MIN_SPEED = 0.4

/** Places a drag must not start from: text fields, sliders, the box's drag-and-drop icons, or anything opted out. */
const IGNORE =
  'input, textarea, select, [contenteditable=""], [contenteditable="true"], ' +
  '[draggable="true"], [aria-roledescription="draggable"]:not([aria-disabled="true"]), [data-no-drag-scroll]'

function canScroll(el: HTMLElement): { x: boolean; y: boolean } {
  const style = getComputedStyle(el)
  const scrollable = (v: string): boolean => v === 'auto' || v === 'scroll' || v === 'overlay'
  return {
    x: scrollable(style.overflowX) && el.scrollWidth > el.clientWidth + 1,
    y: scrollable(style.overflowY) && el.scrollHeight > el.clientHeight + 1
  }
}

/** The nearest element above `start` that can actually scroll. */
function scrollParent(start: Element | null): HTMLElement | null {
  for (let el = start; el && el !== document.documentElement; el = el.parentElement) {
    if (!(el instanceof HTMLElement)) continue
    const { x, y } = canScroll(el)
    if (x || y) return el
  }
  // The window itself never scrolls - the game always fills it exactly.
  return null
}

/**
 * Keeps the window and every "no scrollbar" box pinned at the top. Content that pokes past
 * the edge (a tooltip, a flying card, a scroll-into-view jump) can otherwise nudge them down,
 * leaving the screen shifted past its end with no way to scroll back.
 */
function pinUnscrollable(): void {
  document.addEventListener('scroll', (e) => {
    const el = e.target === document ? document.scrollingElement : e.target
    if (!(el instanceof HTMLElement)) return
    if (el !== document.scrollingElement) {
      const style = getComputedStyle(el)
      const scrollable = (v: string): boolean => v === 'auto' || v === 'scroll' || v === 'overlay'
      if (scrollable(style.overflowX) || scrollable(style.overflowY)) return
    }
    if (el.scrollTop !== 0) el.scrollTop = 0
    if (el.scrollLeft !== 0) el.scrollLeft = 0
  }, true)
}

export function installDragScroll(): void {
  pinUnscrollable()
  let target: HTMLElement | null = null
  let startX = 0
  let startY = 0
  let lastX = 0
  let lastY = 0
  let lastT = 0
  let vx = 0
  let vy = 0
  let dragging = false
  let glide = 0

  const stopGlide = (): void => {
    if (glide) cancelAnimationFrame(glide)
    glide = 0
  }

  const onDown = (e: PointerEvent): void => {
    stopGlide()
    if (e.pointerType !== 'mouse' || e.button !== 0) return
    const el = e.target as Element | null
    if (!el || el.closest(IGNORE)) return
    target = scrollParent(el)
    if (!target) return
    startX = lastX = e.clientX
    startY = lastY = e.clientY
    lastT = e.timeStamp
    vx = vy = 0
    dragging = false
  }

  const onMove = (e: PointerEvent): void => {
    if (!target) return
    if (!(e.buttons & 1)) {
      target = null
      return
    }
    if (!dragging) {
      if (Math.hypot(e.clientX - startX, e.clientY - startY) < DRAG_THRESHOLD) return
      dragging = true
      document.body.classList.add('drag-scrolling')
      window.getSelection()?.removeAllRanges()
    }
    const dx = e.clientX - lastX
    const dy = e.clientY - lastY
    target.scrollLeft -= dx
    target.scrollTop -= dy
    // Speed in px per 16ms frame, smoothed so one jittery move doesn't fling the list.
    const dt = Math.max(1, e.timeStamp - lastT)
    vx = vx * 0.6 + ((-dx / dt) * 16) * 0.4
    vy = vy * 0.6 + ((-dy / dt) * 16) * 0.4
    lastX = e.clientX
    lastY = e.clientY
    lastT = e.timeStamp
    e.preventDefault()
  }

  const onUp = (e: PointerEvent): void => {
    if (!target) return
    const el = target
    target = null
    if (!dragging) return
    dragging = false
    document.body.classList.remove('drag-scrolling')
    // The press became a scroll, so the click it would fire doesn't count.
    const swallow = (ev: MouseEvent): void => {
      ev.stopPropagation()
      ev.preventDefault()
    }
    window.addEventListener('click', swallow, { capture: true, once: true })
    setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0)
    // Holding still before letting go means no glide.
    if (e.timeStamp - lastT > 80) return
    const step = (): void => {
      vx *= FRICTION
      vy *= FRICTION
      if (Math.abs(vx) < MIN_SPEED && Math.abs(vy) < MIN_SPEED) {
        glide = 0
        return
      }
      el.scrollLeft += vx
      el.scrollTop += vy
      glide = requestAnimationFrame(step)
    }
    glide = requestAnimationFrame(step)
  }

  window.addEventListener('pointerdown', onDown, true)
  window.addEventListener('pointermove', onMove, true)
  window.addEventListener('pointerup', onUp, true)
  window.addEventListener('pointercancel', onUp, true)
  // Pictures and links would otherwise start the browser's own drag and steal the mouse.
  window.addEventListener('dragstart', (e) => {
    if (target) e.preventDefault()
  }, true)
  // A mouse wheel turn takes over from any glide still running.
  window.addEventListener('wheel', stopGlide, { capture: true, passive: true })
}
