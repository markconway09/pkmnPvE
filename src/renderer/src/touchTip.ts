// Tooltips on a touch screen, where there's no hovering. Something that does nothing on a
// tap (a Pokemon card, a battle sprite) shows its tooltip on a tap; something that does
// (a button, a move) shows it on a hold instead, so the tap still does its job. Either way
// the tooltip stays up after the finger lifts, until it's tapped (or something else is) -
// and only one is up at a time.

/** How long a hold must last to show a tooltip, in ms (a long press's menu, at 500ms, takes over). */
export const TOUCH_HOLD_MS = 350
/** Moving further than this (px) means a scroll or a drag, not a tap or a hold. */
export const TOUCH_MOVE_TOLERANCE = 8

/** What counts as doing something on a tap: a tap on these (or in them) is theirs. */
const TAP_ACTION = [
  'button:not(:disabled)',
  'a[href]',
  'input',
  'select',
  'textarea',
  'label',
  '[data-tap-action]',
  // A drag handle is only for dragging - a tap on it does nothing.
  '[role="button"]:not([aria-roledescription="draggable"])'
].join(', ')

/** Whether a tap on `target` does something of its own (looked for up to `within`). */
export function tapDoesSomething(target: Element | null, within: Element): boolean {
  const hit = target?.closest(TAP_ACTION)
  return !!hit && within.contains(hit)
}

// The one tooltip up right now: how to close it.
let closeOpen: (() => void) | null = null

/** Shows a tooltip, closing whichever one was up. `close` puts this one away. */
export function openTouchTip(close: () => void): void {
  if (closeOpen && closeOpen !== close) closeOpen()
  closeOpen = close
}

/** Forgets a tooltip that has been put away. */
export function forgetTouchTip(close: () => void): void {
  if (closeOpen === close) closeOpen = null
}

/** Closes the tooltip that's up, if any (the phone's back button). Says whether there was one. */
export function closeTouchTip(): boolean {
  if (!closeOpen) return false
  const close = closeOpen
  closeOpen = null
  close()
  return true
}

// After a hold or a tap that showed a tooltip, lifting the finger isn't also a tap on
// the thing (reading a move's details mustn't use the move).
export function swallowNextClick(): void {
  const swallow = (ev: MouseEvent): void => {
    ev.stopPropagation()
    ev.preventDefault()
  }
  window.addEventListener('click', swallow, { capture: true, once: true })
  setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0)
}
