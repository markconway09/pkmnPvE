import { useCallback, useEffect, useRef, useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import type { BoxPokemonView } from '../../shared/battle-types'
import PokemonIcon from './PokemonIcon'

interface Props {
  mons: BoxPokemonView[]
  onEdit?: (monId: string) => void
  onContextMenu?: (e: React.MouseEvent, mon: BoxPokemonView) => void
  // Shown instead of the usual hint when the box is empty (a search with no matches).
  emptyHint?: string
  // Picking Pokemon to sell: clicking one toggles it (no dragging or menu meanwhile).
  selection?: Set<string> | null
  onToggleSelect?: (mon: BoxPokemonView) => void
  canSelect?: (mon: BoxPokemonView) => boolean
}

/** Rows the "down" button moves the box by. */
const ROWS_PER_STEP = 6

function BoxGrid({ mons, onEdit, onContextMenu, emptyHint, selection, onToggleSelect, canSelect }: Props): React.JSX.Element {
  const { setNodeRef, isOver } = useDroppable({ id: 'box-drop-zone' })
  const classes = ['box-grid', isOver && 'box-grid-over'].filter(Boolean).join(' ')
  const gridRef = useRef<HTMLDivElement | null>(null)
  const setGridRef = useCallback(
    (el: HTMLDivElement | null) => {
      gridRef.current = el
      setNodeRef(el)
    },
    [setNodeRef]
  )
  // Whether the box can still scroll up / down, so each button only shows when it does something.
  const [canUp, setCanUp] = useState(false)
  const [canDown, setCanDown] = useState(false)

  useEffect(() => {
    const el = gridRef.current
    if (!el) return
    const update = (): void => {
      setCanUp(el.scrollTop > 2)
      setCanDown(el.scrollTop + el.clientHeight < el.scrollHeight - 2)
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    const resize = new ResizeObserver(update)
    resize.observe(el)
    return () => {
      el.removeEventListener('scroll', update)
      resize.disconnect()
    }
  }, [mons])

  const scrollToTop = (): void => {
    gridRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Down a few rows: one row is a Pokemon card's height plus the gap between rows.
  const scrollDown = (): void => {
    const el = gridRef.current
    if (!el) return
    const card = el.querySelector<HTMLElement>('.box-icon')
    const gap = parseFloat(getComputedStyle(el).rowGap) || 0
    const row = card ? card.offsetHeight + gap : el.clientHeight / 3
    el.scrollBy({ top: row * ROWS_PER_STEP, behavior: 'smooth' })
  }

  return (
    <div className="box-grid-frame">
      <div ref={setGridRef} className={classes}>
        {mons.length === 0 && <p className="box-empty-hint">{emptyHint ?? 'No Pokemon in the box yet.'}</p>}
        {mons.map((mon) => (
          <PokemonIcon
            key={mon.id}
            mon={mon}
            draggable={!selection}
            onEdit={selection ? undefined : onEdit}
            // While picking, a left click picks it too.
            onClick={selection ? () => onToggleSelect?.(mon) : undefined}
            onContextMenu={
              selection
                ? (e) => {
                    e.preventDefault()
                    onToggleSelect?.(mon)
                  }
                : onContextMenu
            }
            selected={!!selection?.has(mon.id)}
            unselectable={!!selection && canSelect !== undefined && !canSelect(mon)}
          />
        ))}
      </div>
      {/* In the empty strip down the right side: back to the top, and down a few rows. */}
      <button
        className={`box-scroll-button box-scroll-top${canUp ? '' : ' box-scroll-button-hidden'}`}
        onClick={scrollToTop}
        title="Back to the top"
        tabIndex={canUp ? 0 : -1}
      >
        {/* A bar with an arrow up to it: "to the top". */}
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 5h12" />
          <path d="M7 15l5-5 5 5" />
        </svg>
      </button>
      <button
        className={`box-scroll-button box-scroll-down${canDown ? '' : ' box-scroll-button-hidden'}`}
        onClick={scrollDown}
        title={`Down ${ROWS_PER_STEP} rows`}
        tabIndex={canDown ? 0 : -1}
      >
        {/* Two stacked arrows down: "a page down". */}
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 7l5 5 5-5" />
          <path d="M7 13l5 5 5-5" />
        </svg>
      </button>
    </div>
  )
}

export default BoxGrid
