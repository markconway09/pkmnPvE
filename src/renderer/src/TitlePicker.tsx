import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { titlePerk } from '../../shared/titles'

export interface TitleOption {
  title: string
  // A note beside it - e.g. High Roller "in Slots" when it sits in another slot.
  note?: string
}

interface Props {
  value: string | null
  options: TitleOption[]
  // What the empty choice is called ("No title", "Empty").
  emptyLabel: string
  // Shown when there's nothing to pick yet.
  noneLabel?: string
  // Show each title's perk in the list (the perk slots), or just its name (the shown title).
  showPerks?: boolean
  onChange: (title: string | null) => void
}

const LIST_GAP = 6
const LIST_MAX_HEIGHT = 300

/**
 * A title dropdown: a gold button with the picked title, opening a list of the titles
 * that fit (each with its perk, when showPerks). The list sits below the button, or above
 * it when there isn't room, and closes on a pick, a click elsewhere or Escape.
 */
function TitlePicker({ value, options, emptyLabel, noneLabel, showPerks, onChange }: Props): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [place, setPlace] = useState<React.CSSProperties>({ visibility: 'hidden' })
  const disabled = options.length === 0

  useLayoutEffect(() => {
    if (!open || !buttonRef.current || !listRef.current) return
    const b = buttonRef.current.getBoundingClientRect()
    const height = Math.min(listRef.current.scrollHeight, LIST_MAX_HEIGHT)
    const below = window.innerHeight - b.bottom - LIST_GAP
    const top = below >= height || below >= b.top ? b.bottom + LIST_GAP : b.top - LIST_GAP - height
    setPlace({ left: b.left, top: Math.max(4, top), width: Math.max(b.width, 240) })
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent): void => {
      const target = e.target as Node
      if (!buttonRef.current?.contains(target) && !listRef.current?.contains(target)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    // The list is fixed in place, so a scroll or resize under it closes it.
    const close = (): void => setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  function pick(title: string | null): void {
    setOpen(false)
    if (title !== value) onChange(title)
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`title-picker${open ? ' title-picker-open' : ''}${value ? '' : ' title-picker-empty'}`}
        disabled={disabled}
        onClick={() => {
          setPlace({ visibility: 'hidden' })
          setOpen((o) => !o)
        }}
      >
        <span className="title-picker-value">{disabled ? (noneLabel ?? emptyLabel) : (value ?? emptyLabel)}</span>
        <span className="title-picker-caret" aria-hidden>
          ▾
        </span>
      </button>
      {open &&
        createPortal(
          <div
            ref={listRef}
            className="title-picker-list"
            style={{ ...place, maxHeight: LIST_MAX_HEIGHT }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className={`title-picker-option title-picker-option-empty${value ? '' : ' title-picker-option-picked'}`}
              onClick={() => pick(null)}
            >
              <span className="title-picker-option-name">{emptyLabel}</span>
            </button>
            {options.map((o) => (
              <button
                key={o.title}
                type="button"
                className={`title-picker-option${o.title === value ? ' title-picker-option-picked' : ''}`}
                onClick={() => pick(o.title)}
              >
                <span className="title-picker-option-head">
                  <span className="title-picker-option-name">{o.title}</span>
                  {o.note && <span className="title-picker-option-note">{o.note}</span>}
                </span>
                {showPerks && <span className="title-picker-option-perk">{titlePerk(o.title)}</span>}
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  )
}

export default TitlePicker
