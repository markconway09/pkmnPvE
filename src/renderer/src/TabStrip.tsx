import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

export interface TabStripTab<T extends string> {
  id: T
  label: ReactNode
  title?: string
  className?: string
}

interface Props<T extends string> {
  tabs: TabStripTab<T>[]
  current: T
  // Locks every tab but the open one (mid-spin, mid-hand...).
  disabled?: boolean
  onSwitch: (id: T) => void
  className?: string
  // A close button (an X) beside the tabs, for a window whose tabs run along its top.
  onClose?: () => void
  closeDisabled?: boolean
}

/**
 * The game's tab bar - the default for any window or page with tabs: the tabs stretched
 * evenly across a dark trough, and a gold highlight behind the open one that slides over
 * to a newly picked tab. Hovering a tab lightens it (no border). With onClose, an X
 * beside the tabs closes the window.
 */
function TabStrip<T extends string>({
  tabs,
  current,
  disabled,
  onSwitch,
  className,
  onClose,
  closeDisabled
}: Props<T>): React.JSX.Element {
  const stripRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<Partial<Record<T, HTMLButtonElement | null>>>({})
  // Where the highlight sits (over the open tab), and whether it slides there - not on
  // the first placement, or it would sweep in from the left edge as the window opens.
  const [highlight, setHighlight] = useState<{ left: number; width: number } | null>(null)
  const [sliding, setSliding] = useState(false)

  useLayoutEffect(() => {
    const place = (): void => {
      const button = tabRefs.current[current]
      if (button) setHighlight({ left: button.offsetLeft, width: button.offsetWidth })
    }
    place()
    // The tabs stretch with the window - keep it over the open one when they resize.
    const observer = new ResizeObserver(place)
    if (stripRef.current) observer.observe(stripRef.current)
    return () => observer.disconnect()
  }, [current])

  useLayoutEffect(() => {
    if (highlight && !sliding) requestAnimationFrame(() => setSliding(true))
  }, [highlight, sliding])

  return (
    <div className={`tab-strip-bar${className ? ` ${className}` : ''}`}>
      <div className="tab-strip" role="tablist" ref={stripRef}>
        {highlight && (
          <span
            className={`tab-strip-highlight${sliding ? ' tab-strip-highlight-sliding' : ''}`}
            style={{ transform: `translateX(${highlight.left}px)`, width: highlight.width }}
            aria-hidden
          />
        )}
        {tabs.map(({ id, label, title, className: tabClass }) => (
          <button
            key={id}
            ref={(el) => {
              tabRefs.current[id] = el
            }}
            role="tab"
            aria-selected={current === id}
            title={title}
            className={`tab-strip-tab${tabClass ? ` ${tabClass}` : ''}${current === id ? ' tab-strip-tab-active' : ''}`}
            disabled={disabled && current !== id}
            onClick={() => current !== id && onSwitch(id)}
          >
            {label}
          </button>
        ))}
    </div>
    {onClose && (
      <button className="tab-strip-close" title="Close" aria-label="Close" disabled={closeDisabled} onClick={onClose}>
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </button>
    )}
    </div>
  )
}

export default TabStrip
