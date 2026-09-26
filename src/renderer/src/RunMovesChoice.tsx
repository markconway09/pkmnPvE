import { createPortal } from 'react-dom'
import type { MoveInfo, RunMovesPreview } from '../../shared/battle-types'

interface Props {
  // "Mudkip starts the run", "Charmander evolves into Charmeleon"...
  title: string
  preview: RunMovesPreview
  busy: boolean
  onKeep: () => void
  onNew: () => void
  onCancel: () => void
}

function MoveColumn({ heading, moves }: { heading: string; moves: MoveInfo[] }): React.JSX.Element {
  return (
    <div className="run-moves-column">
      <h3>{heading}</h3>
      {moves.map((move) => (
        <div key={move.id} className="run-moves-row">
          <span className={`type-badge type-${move.type.toLowerCase()}`}>{move.type}</span>
          <span>{move.name}</span>
        </div>
      ))}
      {moves.length === 0 && <p className="box-empty-hint">No moves</p>}
    </div>
  )
}

// Roguelite: a Pokemon starting the run or evolving can keep its moves or take the run
// moveset for what it now is - its moves change only at these moments (and on a catch).
function RunMovesChoice({ title, preview, busy, onKeep, onNew, onCancel }: Props): React.JSX.Element {
  return createPortal(
    <div className="modal-overlay" onMouseDown={onCancel}>
      <div className="modal-panel run-moves-modal" onMouseDown={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        <p className="box-empty-hint">Keep its moves, or take a new run moveset?</p>
        <div className="run-moves-columns">
          <MoveColumn heading="Current moves" moves={preview.current} />
          <MoveColumn heading="New moves" moves={preview.proposed} />
        </div>
        <div className="editor-actions">
          <button disabled={busy} onClick={onCancel}>
            Cancel
          </button>
          <button disabled={busy} onClick={onKeep}>
            Keep current moves
          </button>
          <button disabled={busy} onClick={onNew}>
            Use new moves
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default RunMovesChoice
