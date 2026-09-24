import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { BoxPokemonView, BoxState, LoadoutView } from '../../shared/battle-types'
import { toSpriteId } from '../../shared/battle-types'
import SpriteImage from './SpriteImage'

interface Props {
  team: (string | null)[]
  monsById: Map<string, BoxPokemonView>
  onApplied: (box: BoxState) => void
  onClose: () => void
}

function TeamPreview({ team, monsById }: { team: (string | null)[]; monsById: Map<string, BoxPokemonView> }): React.JSX.Element {
  return (
    <div className="loadout-preview">
      {team.map((id, i) => {
        const mon = id ? monsById.get(id) : undefined
        return (
          <div key={i} className="loadout-preview-slot">
            {mon ? (
              <SpriteImage style="2d-static" spriteId={toSpriteId(mon.species)} shiny={mon.shiny} alt={mon.species} />
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

function LoadoutsModal({ team, monsById, onApplied, onClose }: Props): React.JSX.Element {
  const [loadouts, setLoadouts] = useState<LoadoutView[]>([])
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.api
      .listLoadouts()
      .then(setLoadouts)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  async function saveCurrentTeam(): Promise<void> {
    if (!newName.trim()) {
      setError('Give this loadout a name')
      return
    }
    setBusy(true)
    setError(null)
    try {
      setLoadouts(await window.api.saveLoadout(newName))
      setNewName('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function applyLoadout(id: string): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      onApplied(await window.api.applyLoadout(id))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function overwrite(id: string): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      setLoadouts(await window.api.updateLoadout(id))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function submitRename(id: string): Promise<void> {
    if (!renameValue.trim()) {
      setError('Give this loadout a name')
      return
    }
    setBusy(true)
    setError(null)
    try {
      setLoadouts(await window.api.renameLoadout(id, renameValue))
      setRenamingId(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      setLoadouts(await window.api.deleteLoadout(id))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-panel loadouts-modal" onMouseDown={(e) => e.stopPropagation()}>
        <h2>Loadouts</h2>
        <p className="box-empty-hint">Save your current team and switch between saved lineups quickly.</p>

        <div className="loadout-save-row">
          <input
            placeholder="Loadout name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void saveCurrentTeam()}
          />
          <button disabled={busy} onClick={() => void saveCurrentTeam()}>
            Save Current Team
          </button>
        </div>
        <TeamPreview team={team} monsById={monsById} />

        {error && <p className="editor-error">{error}</p>}

        <h3>Saved loadouts</h3>
        {loadouts.length === 0 ? (
          <p className="box-empty-hint">No loadouts saved yet.</p>
        ) : (
          <div className="loadout-list">
            {loadouts.map((loadout) => (
              <div key={loadout.id} className="loadout-row">
                <div className="loadout-row-header">
                  {renamingId === loadout.id ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && void submitRename(loadout.id)}
                      onBlur={() => void submitRename(loadout.id)}
                    />
                  ) : (
                    <span
                      className="loadout-row-name"
                      onClick={() => {
                        setRenamingId(loadout.id)
                        setRenameValue(loadout.name)
                      }}
                      title="Click to rename"
                    >
                      {loadout.name}
                    </span>
                  )}
                </div>
                <TeamPreview team={loadout.team} monsById={monsById} />
                <div className="loadout-row-actions">
                  <button disabled={busy} onClick={() => void applyLoadout(loadout.id)}>
                    Load
                  </button>
                  <button disabled={busy} title="Overwrite with your current team" onClick={() => void overwrite(loadout.id)}>
                    Overwrite
                  </button>
                  <button disabled={busy} onClick={() => void remove(loadout.id)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="editor-actions">
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default LoadoutsModal
