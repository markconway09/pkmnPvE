import { useEffect, useState } from 'react'
import { RarityGlow } from './RarityCard'
import { createPortal } from 'react-dom'
import type { BoxPokemonView, BoxState, LoadoutView } from '../../shared/battle-types'
import { toSpriteId } from '../../shared/battle-types'
import SpriteImage from './SpriteImage'
import { errorMessage, pointOf, useFloatingNotes } from './FloatingNotes'
import { t } from './i18n'

interface Props {
  team: (string | null)[]
  monsById: Map<string, BoxPokemonView>
  onApplied: (box: BoxState) => void
  onClose: () => void
}

// Six slots, each with the Pokemon's sprite on its rarity's colour (the same as the team row).
function TeamPreview({ team, monsById }: { team: (string | null)[]; monsById: Map<string, BoxPokemonView> }): React.JSX.Element {
  return (
    <div className="loadout-preview">
      {team.map((id, i) => {
        const mon = id ? monsById.get(id) : undefined
        return (
          <div
            key={i}
            className={`loadout-preview-slot${mon ? ` loadout-preview-filled rarity-card rarity-tier-${mon.rarityTier ?? 'common'}` : ''}`}
            title={
              mon ? t('loadouts.monTitle', { name: mon.species, level: mon.level }) : id ? t('loadouts.gone') : t('loadouts.empty')
            }
          >
            {mon && (
              <RarityGlow size={null} className="loadout-preview-glow">
                <SpriteImage style="3d-static" spriteId={toSpriteId(mon.species)} shiny={mon.shiny} alt={mon.species} />
              </RarityGlow>
            )}
          </div>
        )
      })}
    </div>
  )
}

const sameTeam = (a: (string | null)[], b: (string | null)[]): boolean => a.every((id, i) => id === b[i])

/**
 * Loadouts: the team right now (saved under a name), and every saved team - load one to
 * switch to it, overwrite it with the current team, rename it (click its name) or delete it.
 */
function LoadoutsModal({ team, monsById, onApplied, onClose }: Props): React.JSX.Element {
  const [loadouts, setLoadouts] = useState<LoadoutView[] | null>(null)
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  // A loadout waiting for a second click on Delete.
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const notes = useFloatingNotes()

  useEffect(() => {
    window.api
      .listLoadouts()
      .then(setLoadouts)
      .catch(() => setLoadouts([]))
  }, [])

  // Runs one action, reporting how it went where it was clicked.
  async function act(e: React.MouseEvent | null, action: () => Promise<string | null>): Promise<void> {
    const at = e ? pointOf(e) : { x: window.innerWidth / 2, y: window.innerHeight / 3 }
    setBusy(true)
    try {
      const done = await action()
      if (done) notes.show(done, at)
    } catch (err) {
      notes.show(errorMessage(err), at, 'bad')
    } finally {
      setBusy(false)
    }
  }

  function saveCurrentTeam(e: React.MouseEvent | null): void {
    const name = newName.trim()
    if (!name) {
      notes.show(t('loadouts.needName'), { x: window.innerWidth / 2, y: window.innerHeight / 3 }, 'bad')
      return
    }
    void act(e, async () => {
      setLoadouts(await window.api.saveLoadout(name))
      setNewName('')
      return t('loadouts.saved', { name })
    })
  }

  function submitRename(id: string): void {
    const name = renameValue.trim()
    setRenamingId(null)
    if (!name || name === loadouts?.find((l) => l.id === id)?.name) return
    void act(null, async () => {
      setLoadouts(await window.api.renameLoadout(id, name))
      return null
    })
  }

  const teamSize = team.filter(Boolean).length

  return createPortal(
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-panel loadouts-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="shop-header">
          <h2>{t('loadouts.title')}</h2>
          {loadouts && <span className="loadouts-count">{t('loadouts.count', { n: loadouts.length })}</span>}
        </div>

        <h3 className="shop-category-heading">{t('loadouts.current')}</h3>
        <div className="loadout-card loadout-card-current">
          <TeamPreview team={team} monsById={monsById} />
          <div className="loadout-save-row">
            <input
              className="loadout-name-input"
              placeholder={t('loadouts.namePlaceholder')}
              value={newName}
              maxLength={40}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveCurrentTeam(null)}
            />
            <button disabled={busy || teamSize === 0} onClick={(e) => saveCurrentTeam(e)}>
              {t('loadouts.saveAs')}
            </button>
          </div>
        </div>

        <h3 className="shop-category-heading">{t('loadouts.savedHeading')}</h3>
        {loadouts && loadouts.length === 0 && <p className="box-empty-hint">{t('loadouts.none')}</p>}
        <div className="loadout-list">
          {loadouts?.map((loadout) => {
            const current = sameTeam(loadout.team, team)
            return (
              <div key={loadout.id} className={`loadout-card${current ? ' loadout-card-active' : ''}`}>
                <div className="loadout-card-top">
                  {renamingId === loadout.id ? (
                    <input
                      className="loadout-name-input"
                      autoFocus
                      value={renameValue}
                      maxLength={40}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') submitRename(loadout.id)
                        if (e.key === 'Escape') setRenamingId(null)
                      }}
                      onBlur={() => submitRename(loadout.id)}
                    />
                  ) : (
                    <button
                      className="loadout-name"
                      title={t('loadouts.rename')}
                      onClick={() => {
                        setRenamingId(loadout.id)
                        setRenameValue(loadout.name)
                      }}
                    >
                      {loadout.name} <span className="loadout-name-edit">✎</span>
                    </button>
                  )}
                  {current && <span className="loadout-current-badge">{t('loadouts.inUse')}</span>}
                </div>
                <div className="loadout-card-body">
                  <TeamPreview team={loadout.team} monsById={monsById} />
                  <div className="loadout-actions">
                    <button
                      className="loadout-load"
                      disabled={busy || current}
                      onClick={(e) =>
                        void act(e, async () => {
                          onApplied(await window.api.applyLoadout(loadout.id))
                          return null
                        })
                      }
                    >
                      {t('loadouts.load')}
                    </button>
                    <button
                      disabled={busy || current || teamSize === 0}
                      title={t('loadouts.overwriteTip')}
                      onClick={(e) =>
                        void act(e, async () => {
                          setLoadouts(await window.api.updateLoadout(loadout.id))
                          return t('loadouts.updated', { name: loadout.name })
                        })
                      }
                    >
                      {t('loadouts.overwrite')}
                    </button>
                    <button
                      className={confirmingDelete === loadout.id ? 'loadout-delete-confirm' : undefined}
                      disabled={busy}
                      onClick={(e) => {
                        if (confirmingDelete !== loadout.id) {
                          setConfirmingDelete(loadout.id)
                          return
                        }
                        setConfirmingDelete(null)
                        void act(e, async () => {
                          setLoadouts(await window.api.deleteLoadout(loadout.id))
                          return t('loadouts.deleted', { name: loadout.name })
                        })
                      }}
                    >
                      {confirmingDelete === loadout.id ? t('loadouts.sure') : t('loadouts.delete')}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="editor-actions">
          <button onClick={onClose}>{t('common.close')}</button>
        </div>
        {notes.layer}
      </div>
    </div>,
    document.body
  )
}

export default LoadoutsModal
