import { createPortal } from 'react-dom'
import ContextMenuPanel from './ContextMenuPanel'

interface Props {
  x: number
  y: number
  species: string
  // What it can evolve into right now (see runEvolutionOptions on the main side).
  evolutions: string[]
  onEvolve: (targetSpecies: string) => void
  // What it holds - "Move item" only shows when it holds something.
  heldItem: string | null
  onMoveItem: () => void
  onEdit: () => void
  onClose: () => void
}

// Clicking (or right-clicking) a run Pokemon: edit its moves, evolve it, or move its
// held item.
function RunMonContextMenu({ x, y, species, evolutions, onEvolve, heldItem, onMoveItem, onEdit, onClose }: Props): React.JSX.Element {
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
        <button className="context-menu-item" onClick={onEdit}>
          Edit moves
        </button>
        {evolutions.map((target) => (
          <button key={target} className="context-menu-item" onClick={() => onEvolve(target)}>
            Evolve into {target}
          </button>
        ))}
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
