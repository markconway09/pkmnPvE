import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

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
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: -9999, left: -9999 })

  useLayoutEffect(() => {
    if (!hovering) return
    const trigger = triggerRef.current
    const tooltip = tooltipRef.current
    if (!trigger || !tooltip) return

    const reposition = (): void => {
      const triggerRect = trigger.getBoundingClientRect()
      const width = tooltip.offsetWidth
      const height = tooltip.offsetHeight

      let top = placement === 'above' ? triggerRect.top - height - MARGIN : triggerRect.bottom + MARGIN
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
  }, [hovering, placement])

  return (
    <div
      ref={triggerRef}
      className={className}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {children}
      {hovering &&
        createPortal(
          <div ref={tooltipRef} className="tooltip-portal" style={{ top: pos.top, left: pos.left }}>
            {content}
          </div>,
          document.body
        )}
    </div>
  )
}

export default Tooltip
