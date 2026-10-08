// On a touch screen the little hover hints (an element's title) never show - so here they
// show the same way the bigger tooltips do (touchTip.ts): a tap on something that does
// nothing on a tap, or a hold on something that does. It stays up until it's tapped, or
// something else is.
import {
  TOUCH_HOLD_MS,
  TOUCH_MOVE_TOLERANCE,
  closeTouchTip,
  forgetTouchTip,
  openTouchTip,
  swallowNextClick,
  tapDoesSomething
} from './touchTip'

const MARGIN = 6

let bubble: HTMLDivElement | null = null

function hide(): void {
  bubble?.remove()
  bubble = null
  forgetTouchTip(hide)
}

function show(text: string, near: Element): void {
  closeTouchTip()
  bubble = document.createElement('div')
  bubble.className = 'tooltip-portal tooltip-portal-pinned touch-title'
  const panel = document.createElement('div')
  panel.className = 'tooltip-panel'
  panel.textContent = text
  bubble.appendChild(panel)
  bubble.addEventListener('click', (e) => {
    e.stopPropagation()
    hide()
  })
  document.body.appendChild(bubble)
  openTouchTip(hide)
  // Above the thing, or below it when there's no room above; kept on the screen.
  const rect = near.getBoundingClientRect()
  const { offsetWidth: width, offsetHeight: height } = bubble
  let top = rect.top - height - MARGIN
  if (top < MARGIN) top = rect.bottom + MARGIN
  top = Math.min(top, window.innerHeight - MARGIN - height)
  const left = Math.min(Math.max(MARGIN, rect.left + rect.width / 2 - width / 2), window.innerWidth - MARGIN - width)
  bubble.style.top = `${Math.max(MARGIN, top)}px`
  bubble.style.left = `${Math.max(MARGIN, left)}px`
}

/** The nearest hint to show for a press on `target` - none inside a bigger tooltip's trigger. */
function titled(target: Element | null): HTMLElement | null {
  if (!target || target.closest('[data-tooltip-trigger]')) return null
  const el = target.closest<HTMLElement>('[title]')
  return el && el.title.trim() ? el : null
}

export function installTouchTitles(): void {
  let press: { timer: number; x: number; y: number; el: HTMLElement; target: Element; held: boolean; moved: boolean } | null = null

  const end = (): void => {
    if (press) clearTimeout(press.timer)
    press = null
  }

  window.addEventListener(
    'pointerdown',
    (e) => {
      end()
      const target = e.target as Element | null
      // A tap anywhere else puts the hint away (on it, the bubble's own click does).
      if (bubble && !(target && bubble.contains(target))) hide()
      if (e.pointerType === 'mouse' || !e.isPrimary) return
      const el = titled(target)
      if (!el || !target) return
      const pressed = { timer: 0, x: e.clientX, y: e.clientY, el, target, held: false, moved: false }
      pressed.timer = window.setTimeout(() => {
        pressed.held = true
        if (el.isConnected) show(el.title, el)
      }, TOUCH_HOLD_MS)
      press = pressed
    },
    true
  )
  window.addEventListener(
    'pointermove',
    (e) => {
      if (press && !press.held && Math.hypot(e.clientX - press.x, e.clientY - press.y) > TOUCH_MOVE_TOLERANCE) {
        clearTimeout(press.timer)
        press.moved = true
      }
    },
    true
  )
  window.addEventListener(
    'pointerup',
    () => {
      const pressed = press
      end()
      if (!pressed || pressed.moved) return
      if (pressed.held) {
        // Lifting the finger after reading it isn't also a tap on the thing.
        if (bubble) swallowNextClick()
        return
      }
      if (!tapDoesSomething(pressed.target, document.body)) show(pressed.el.title, pressed.el)
    },
    true
  )
  window.addEventListener('pointercancel', end, true)
  // A long press's menu replaces the hint.
  window.addEventListener('contextmenu', (e) => {
    if (e.defaultPrevented) {
      end()
      hide()
    }
  })
}
