import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDroppable } from '@dnd-kit/core'
import type { BoxPokemonView, CompanionSize, CompanionSizeChoice } from '../../shared/battle-types'
import { COMPANION_SIZES, MAX_HAPPINESS, toSpriteId } from '../../shared/battle-types'
import SpriteImage from './SpriteImage'
import { loadSpriteStyle } from './spriteStyle'
import ContextMenuPanel from './ContextMenuPanel'

// The drop target's id (see MainMenu's handleDragEnd).
export const COMPANION_SLOT_ID = 'companion-slot'

interface Props {
  companion: BoxPokemonView | null
  // The Pokemon being dragged right now, if any - the slot shows whether it can be a companion.
  dragging: BoxPokemonView | null
  // The size it's drawn at, and what was picked ('auto': by its height).
  size: CompanionSize
  sizeChoice: CompanionSizeChoice
  onSetSize: (size: CompanionSizeChoice) => void
  onReturn: () => void
}

// How many hearts float up from one pat.
const HEARTS = 3

// Where a pat's hearts pop up: anywhere over the companion, each in its own third across
// (so they never sit on top of each other) at a random height, a moment apart.
function randomHearts(): { left: number; top: number; delay: number }[] {
  return Array.from({ length: HEARTS }, (_, i) => ({
    left: 12 + i * 26 + Math.random() * 20,
    top: 15 + Math.random() * 45,
    delay: Math.random() * 0.3
  })).sort(() => Math.random() - 0.5)
}

/**
 * The companion beside the team: any Pokemon, dragged here from the box or the team (it stays
 * there, still usable), gaining friendship from battles as if it were on the team. It
 * bobs about on its own; a click pats it (a hop and some hearts), and a right-click
 * opens its menu - its size, or no longer the companion. Purely for show.
 */
function CompanionSlot({ companion, dragging, size, sizeChoice, onSetSize, onReturn }: Props): React.JSX.Element {
  const { setNodeRef, isOver } = useDroppable({ id: COMPANION_SLOT_ID })
  // Each pat's own key, so a new one restarts the hop and hearts mid-way.
  const [pat, setPat] = useState(0)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  // New places for every pat.
  const hearts = useMemo(() => (pat > 0 ? randomHearts() : []), [pat])

  const classes = [
    'companion-slot',
    companion ? `companion-slot-filled companion-size-${size.toLowerCase()}` : 'companion-slot-empty',
    dragging && 'companion-slot-can-drop',
    isOver && 'companion-slot-over'
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      ref={setNodeRef}
      className={classes}
      title={companion ? undefined : 'Companion: drag a Pokémon here'}
      onClick={() => companion && setPat((n) => n + 1)}
      onContextMenu={(e) => {
        e.preventDefault()
        if (companion) setMenu({ x: e.clientX, y: e.clientY })
      }}
    >
      {companion ? (
        <>
          <div key={pat} className={`companion-sprite-wrap${pat > 0 ? ' companion-sprite-pat' : ''}`}>
            {/* Drawn in the same sprite style the battles use (see Options). */}
            <SpriteImage style={loadSpriteStyle()} className="companion-sprite" spriteId={toSpriteId(companion.species)} shiny={companion.shiny} gmax={companion.gmaxLook} alt={companion.species} />
          </div>
          <span className="companion-shadow" />
          {pat > 0 && (
            <span key={`hearts-${pat}`} className="companion-hearts" aria-hidden="true">
              {hearts.map((h, i) => (
                <span
                  key={i}
                  className="companion-heart"
                  style={{ left: `${h.left}%`, top: `${h.top}%`, animationDelay: `${h.delay}s` }}
                >
                  ❤️
                </span>
              ))}
            </span>
          )}
          {/* Its friendship, as a tiny pink bar under it. */}
          <span className="companion-happiness" title={`Friendship ${companion.happiness ?? MAX_HAPPINESS}/${MAX_HAPPINESS}`}>
            <span
              className="companion-happiness-fill"
              style={{ width: `${(Math.min(companion.happiness ?? MAX_HAPPINESS, MAX_HAPPINESS) / MAX_HAPPINESS) * 100}%` }}
            />
          </span>
        </>
      ) : (
        <span className="companion-slot-hint">
          Companion
        </span>
      )}
      {menu &&
        companion &&
        createPortal(
          <div
            className="context-menu-overlay"
            onMouseDown={() => setMenu(null)}
            // Rendered elsewhere, but React still bubbles its clicks to the slot - which would pat it.
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setMenu(null)
            }}
          >
            <ContextMenuPanel x={menu.x} y={menu.y}>
              <div className="context-menu-title">{companion.species} · your companion</div>
              {/* Its size, side by side on one line. */}
              <div className="companion-size-row">
                <span className="companion-size-label">Size</span>
                {/* Auto goes by its height; the size it gives is outlined while it's on. */}
                {(['auto', ...COMPANION_SIZES] as CompanionSizeChoice[]).map((s) => (
                  <button
                    key={s}
                    className={`companion-size-option${s === 'auto' ? ' companion-size-auto' : ''}${s === sizeChoice ? ' companion-size-option-on' : ''}${sizeChoice === 'auto' && s === size ? ' companion-size-option-auto' : ''}`}
                    title={s === 'auto' ? `By its height - ${size} for ${companion.species}` : undefined}
                    onClick={() => onSetSize(s)}
                  >
                    {s === 'auto' ? 'Auto' : s}
                  </button>
                ))}
              </div>
              <button
                className="context-menu-item"
                onClick={() => {
                  setMenu(null)
                  setPat((n) => n + 1)
                }}
              >
                Pat
              </button>
              <button
                className="context-menu-item"
                onClick={() => {
                  setMenu(null)
                  onReturn()
                }}
              >
                Remove as companion
              </button>
            </ContextMenuPanel>
          </div>,
          document.body
        )}
    </div>
  )
}

export default CompanionSlot
