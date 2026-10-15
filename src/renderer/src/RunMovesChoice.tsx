import { createPortal } from 'react-dom'
import type { MoveInfo, RunMovesPreview } from '../../shared/battle-types'
import { moveName, t, typeName } from './i18n'

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
          <span className={`type-badge type-${move.type.toLowerCase()}`}>{typeName(move.type)}</span>
          <span>{moveName(move.name)}</span>
        </div>
      ))}
      {moves.length === 0 && <p className="box-empty-hint">{t('runMoves.none')}</p>}
    </div>
  )
}

// Battle Tower: a Pokemon starting the run or evolving can keep its moves or take the run
// moveset for what it now is - its moves change only at these moments (and on a catch).
function RunMovesChoice({ title, preview, busy, onKeep, onNew, onCancel }: Props): React.JSX.Element {
  return createPortal(
    <div className="modal-overlay" onMouseDown={onCancel}>
      <div className="modal-panel run-moves-modal" onMouseDown={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        <p className="box-empty-hint">{t('runMoves.question')}</p>
        <div className="run-moves-columns">
          <MoveColumn heading={t('runMoves.current')} moves={preview.current} />
          <MoveColumn heading={t('runMoves.new')} moves={preview.proposed} />
        </div>
        <div className="editor-actions">
          <button disabled={busy} onClick={onCancel}>
            {t('common.cancel')}
          </button>
          <button disabled={busy} onClick={onKeep}>
            {t('runMoves.keep')}
          </button>
          <button disabled={busy} onClick={onNew}>
            {t('runMoves.use')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default RunMovesChoice
