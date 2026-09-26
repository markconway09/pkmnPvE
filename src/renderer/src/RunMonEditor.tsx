import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { RunMonEditInfo, RunView } from '../../shared/battle-types'

interface Props {
  runMonId: string
  onClose: () => void
  onSaved: (run: RunView) => void
}

/**
 * Roguelite's own moves editor - apart from the classic Pokemon editor: a run Pokemon's
 * four moves (anything its species can ever learn) and which of them are locked in
 * (kept when its moves change on evolving), with Smogon's sets to fill them in.
 */
function RunMonEditor({ runMonId, onClose, onSaved }: Props): React.JSX.Element {
  const [info, setInfo] = useState<RunMonEditInfo | null>(null)
  const [moves, setMoves] = useState<string[]>(['', '', '', ''])
  const [locked, setLocked] = useState<string[]>([])
  const [setId, setSetId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.api
      .getRunMonEditInfo(runMonId)
      .then((loaded) => {
        setInfo(loaded)
        setMoves([0, 1, 2, 3].map((i) => loaded.moves[i] ?? ''))
        setLocked(loaded.lockedMoves)
        setSetId(loaded.autoSets[0]?.id ?? '')
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [runMonId])

  const moveName = (id: string): string => info?.learnable.find((m) => m.id === id)?.name ?? id

  async function applySet(): Promise<void> {
    if (!setId) return
    setBusy(true)
    setError(null)
    try {
      const setMovesFound = await window.api.runSmogonSet(runMonId, setId)
      // Locked moves stay; the set fills the other slots.
      const keep = moves.filter((m) => m && locked.includes(m))
      const fill = setMovesFound.filter((m) => !keep.includes(m))
      setMoves([0, 1, 2, 3].map((i) => (moves[i] && locked.includes(moves[i]) ? moves[i] : (fill.shift() ?? ''))))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function save(): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      const chosen = moves.filter(Boolean)
      onSaved(await window.api.updateRunMon(runMonId, { moves: chosen, lockedMoves: locked.filter((m) => chosen.includes(m)) }))
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-panel pokemon-editor run-mon-editor" onMouseDown={(e) => e.stopPropagation()}>
        <h2>{info ? `${info.species} - moves` : 'Loading...'}</h2>
        {info && (
          <>
            <div className="editor-section">
              <h3>Smogon set</h3>
              <div className="trainer-add-row">
                <select value={setId} onChange={(e) => setSetId(e.target.value)}>
                  {info.autoSets.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <button disabled={busy || !setId} onClick={() => void applySet()}>
                  Apply
                </button>
              </div>
              <p className="editor-hint">Fills in its moves. Locked moves stay.</p>
            </div>

            <div className="editor-section">
              <h3>Moves</h3>
              {moves.map((move, i) => (
                <div key={i} className="run-editor-move">
                  <select
                    value={move}
                    onChange={(e) => {
                      const next = [...moves]
                      next[i] = e.target.value
                      setMoves(next)
                    }}
                  >
                    <option value="">-</option>
                    {info.learnable
                      .filter((m) => m.id === move || !moves.includes(m.id))
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.type}
                          {m.basePower ? ` · ${m.basePower}` : ''})
                        </option>
                      ))}
                  </select>
                  <label className="run-editor-lock" title="Locked moves are kept when its moves change on evolving">
                    <input
                      type="checkbox"
                      disabled={!move}
                      checked={!!move && locked.includes(move)}
                      onChange={(e) =>
                        setLocked((all) => (e.target.checked ? [...all, move] : all.filter((m) => m !== move)))
                      }
                    />
                    🔒
                  </label>
                </div>
              ))}
              {locked.filter((m) => moves.includes(m)).length > 0 && (
                <p className="editor-hint">
                  Locked: {locked.filter((m) => moves.includes(m)).map(moveName).join(', ')}
                </p>
              )}
            </div>

          </>
        )}
        {error && <p className="editor-error">{error}</p>}
        <div className="editor-actions">
          <button onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button onClick={() => void save()} disabled={busy || !info || !moves.some(Boolean)}>
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default RunMonEditor
