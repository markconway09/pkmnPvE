import { createPortal } from 'react-dom'
import ContextMenuPanel from './ContextMenuPanel'

interface Props {
  x: number
  y: number
  species: string
  // What it can evolve into right now (see runEvolutionOptions on the main side).
  evolutions: string[]
  onEvolve: (targetSpecies: string) => void
  onRelearnMoves: () => void
  // What it holds - "Move item" only shows when it holds something.
  heldItem: string | null
  onMoveItem: () => void
  onClose: () => void
}

// Right-click on a run Pokemon: evolve it, give it a fresh moveset, or move its held item.
function RunMonContextMenu({ x, y, species, evolutions, onEvolve, onRelearnMoves, heldItem, onMoveItem, onClose }: Props): React.JSX.Element {
  return createPortal(
    <div
      className="context-menu-overlay"
      onMouseDown={onClose}
      onContextMenu={(e) => {
        e.preventDefault()
        onClose()
      }}
    >
      <ContextMenuPanel x={x} y={y}>
        <div className="context-menu-title">{species}</div>
        {evolutions.map((target) => (
          <button key={target} className="context-menu-item" onClick={() => onEvolve(target)}>
            Evolve into {target}
          </button>
        ))}
        <button
          className="context-menu-item"
          title="Moves from Smogon's sets it can learn at its level first, then its newest level-up moves"
          onClick={onRelearnMoves}
        >
          Update moves
        </button>
        {heldItem && (
          <button className="context-menu-item" onClick={onMoveItem}>
            Move item ({heldItem})
          </button>
        )}
      </ContextMenuPanel>
    </div>,
    document.body
  )
}

export default RunMonContextMenu
