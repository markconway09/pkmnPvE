import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  TOUCH_HOLD_MS,
  TOUCH_MOVE_TOLERANCE,
  forgetTouchTip,
  openTouchTip,
  swallowNextClick,
  tapDoesSomething
} from './touchTip'

interface Props {
  content: ReactNode
  placement?: 'above' | 'below' | 'right'
  className?: string
  children: ReactNode
}

const MARGIN = 6

function Tooltip({ content, placement = 'above', className, children }: Props): React.JSX.Element {
  const triggerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [hovering, setHovering] = useState(false)
  // On a touch screen (see touchTip.ts): shown by a tap or a hold, and up until it's tapped.
  const [pinned, setPinned] = useState(false)
  const press = useRef<{ timer: number; x: number; y: number; target: Element | null; held: boolean; moved: boolean } | null>(null)
  const shown = hovering || pinned

  const unpin = useRef(() => setPinned(false)).current
  const pin = (): void => {
    openTouchTip(unpin)
    setPinned(true)
  }
  const close = (): void => {
    forgetTouchTip(unpin)
    setPinned(false)
  }

  const endPress = (): typeof press.current => {
    const pressed = press.current
    if (pressed) clearTimeout(pressed.timer)
    press.current = null
    return pressed
  }

  // While it's up, a tap anywhere else puts it away (that tap still does its own thing).
  useEffect(() => {
    if (!pinned) return
    const outside = (e: PointerEvent): void => {
      const target = e.target as Node | null
      if (target && (triggerRef.current?.contains(target) || tooltipRef.current?.contains(target))) return
      close()
    }
    window.addEventListener('pointerdown', outside, true)
    return () => window.removeEventListener('pointerdown', outside, true)
  }, [pinned])
  useEffect(() => () => forgetTouchTip(unpin), [])

  const [pos, setPos] = useState<{ top: number; left: number }>({ top: -9999, left: -9999 })

  useLayoutEffect(() => {
    if (!shown) return
    const trigger = triggerRef.current
    const tooltip = tooltipRef.current
    if (!trigger || !tooltip) return

    const reposition = (): void => {
      const triggerRect = trigger.getBoundingClientRect()
      const width = tooltip.offsetWidth
      const height = tooltip.offsetHeight

      // Above or below as asked - flipped to the other side when it won't fit there but
      // will on the other (a team card near the top of the screen shows it below instead
      // of squashed down over the card), or to whichever side has more room when neither fits.
      const aboveTop = triggerRect.top - height - MARGIN
      const belowTop = triggerRect.bottom + MARGIN
      const fitsAbove = aboveTop >= MARGIN
      const fitsBelow = belowTop + height <= window.innerHeight - MARGIN
      let goAbove = placement === 'above'
      if (goAbove && !fitsAbove) goAbove = fitsBelow ? false : triggerRect.top > window.innerHeight - triggerRect.bottom
      else if (!goAbove && !fitsBelow) goAbove = fitsAbove ? true : triggerRect.top > window.innerHeight - triggerRect.bottom
      let top = goAbove ? aboveTop : belowTop
      let left = triggerRect.left
      if (placement === 'right') {
        top = triggerRect.top
        left = triggerRect.right + MARGIN
        // No room on the right - flip to the trigger's left side instead.
        if (left + width > window.innerWidth - MARGIN) left = triggerRect.left - width - MARGIN
      }

      if (left < MARGIN) left = MARGIN
      else if (left + width > window.innerWidth - MARGIN) left = Math.max(MARGIN, window.innerWidth - MARGIN - width)

      if (top < MARGIN) top = MARGIN
      else if (top + height > window.innerHeight - MARGIN) top = Math.max(MARGIN, window.innerHeight - MARGIN - height)

      setPos({ top, left })
    }

    reposition()
    const observer = new ResizeObserver(reposition)
    observer.observe(tooltip)
    window.addEventListener('resize', reposition)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', reposition)
    }
  }, [shown, placement])

  return (
    <div
      ref={triggerRef}
      className={className}
      data-tooltip-trigger=""
      onPointerEnter={(e) => {
        if (e.pointerType === 'mouse') setHovering(true)
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse') setHovering(false)
      }}
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse' || !e.isPrimary) return
        endPress()
        const pressed = { timer: 0, x: e.clientX, y: e.clientY, target: e.target as Element, held: false, moved: false }
        // A hold shows it - on anything, but it's the only way on something a tap uses.
        pressed.timer = window.setTimeout(() => {
          pressed.held = true
          pin()
        }, TOUCH_HOLD_MS)
        press.current = pressed
      }}
      onPointerMove={(e) => {
        const pressed = press.current
        if (pressed && !pressed.held && Math.hypot(e.clientX - pressed.x, e.clientY - pressed.y) > TOUCH_MOVE_TOLERANCE) {
          clearTimeout(pressed.timer)
          pressed.moved = true
        }
      }}
      onPointerUp={() => {
        const pressed = endPress()
        if (!pressed || pressed.moved) return
        if (pressed.held) {
          swallowNextClick()
          return
        }
        const trigger = triggerRef.current
        if (!trigger) return
        if (tapDoesSomething(pressed.target, trigger)) {
          // The tap does its job; a tooltip that was up goes away.
          if (pinned) close()
          return
        }
        // A tap on something that does nothing else shows its tooltip, or puts it away.
        if (pinned) close()
        else pin()
      }}
      onPointerCancel={() => endPress()}
      // A long press's menu opened (every menu calls preventDefault) - it replaces the tooltip.
      onContextMenuCapture={(e) => {
        const menu = e.nativeEvent
        setTimeout(() => {
          if (!menu.defaultPrevented) return
          endPress()
          close()
        }, 0)
      }}
    >
      {children}
      {shown &&
        createPortal(
          <div
            ref={tooltipRef}
            className={`tooltip-portal${pinned ? ' tooltip-portal-pinned' : ''}`}
            style={{ top: pos.top, left: pos.left }}
            // A tap on it puts it away. (It's in a portal, but React still bubbles its
            // events up to whatever holds the trigger - they stop here.)
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              close()
            }}
            onContextMenu={(e) => e.stopPropagation()}
          >
            {content}
          </div>,
          document.body
        )}
    </div>
  )
}

export default Tooltip
