import { useEffect, useState } from 'react'
import { RarityGlow } from './RarityCard'
import type { ItemOptionEntry, PremadeTeamSummary, TeamMode } from '../../shared/battle-types'
import { POKEMON_TYPES, toSpriteId } from '../../shared/battle-types'
import SpriteImage from './SpriteImage'
import ItemSprite from './ItemSprite'
import PremadeTeamRoster from './PremadeTeamRoster'

interface Props {
  // Null until the trainer has been saved - premade teams need a trainer to belong to.
  trainerId: string | null
  teamMode: TeamMode
  monotype: string
  items: ItemOptionEntry[]
  onTeamModeChange: (mode: TeamMode) => void
  onMonotypeChange: (type: string) => void
  onError: (message: string) => void
}

const errorText = (e: unknown): string => (e instanceof Error ? e.message : String(e))

/** A Premade Team's Pokemon as a row of small icons, each with its level. */
export function TeamIcons({ team }: { team: PremadeTeamSummary }): React.JSX.Element {
  return (
    <span className="trainer-team-icons">
      {team.mons.map((m) => (
        <span
          key={m.id}
          className={`trainer-team-icon rarity-card rarity-tier-${m.rarityTier ?? 'common'}`}
          title={`${m.species} · Lv ${m.level}`}
        >
          <RarityGlow size={40}>
            <SpriteImage style="3d-static" spriteId={toSpriteId(m.species)} shiny={m.shiny} alt={m.species} />
          </RarityGlow>
          <span className="trainer-team-icon-level">{m.level}</span>
        </span>
      ))}
      {Array.from({ length: Math.max(0, 6 - team.mons.length) }, (_, i) => (
        <span key={`empty${i}`} className="trainer-team-icon trainer-team-icon-empty" />
      ))}
    </span>
  )
}

/**
 * The trainer editors' Team section (classic and Roguelite alike): how the trainer's team
 * is picked, and for premade teams each one with its Pokemon at a glance - renamed in
 * place, copied, deleted, or opened to edit its roster.
 */
function TrainerTeamsSection({
  trainerId,
  teamMode,
  monotype,
  items,
  onTeamModeChange,
  onMonotypeChange,
  onError
}: Props): React.JSX.Element {
  const [teams, setTeams] = useState<PremadeTeamSummary[]>([])
  const [newTeamName, setNewTeamName] = useState('')
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // The team whose Delete was clicked once - a second click deletes it.
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  // Names being typed, until they're saved on blur / Enter.
  const [names, setNames] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!trainerId) {
      setTeams([])
      return
    }
    window.api
      .listPremadeTeamsForTrainer(trainerId)
      .then(setTeams)
      .catch(() => {})
  }, [trainerId])

  async function run(action: () => Promise<PremadeTeamSummary[]>): Promise<void> {
    setBusy(true)
    try {
      setTeams(await action())
    } catch (e) {
      onError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  async function addTeam(): Promise<void> {
    if (!trainerId) return
    await run(() => window.api.addPremadeTeam(trainerId, newTeamName.trim() || `Team ${teams.length + 1}`))
    setNewTeamName('')
  }

  function rename(team: PremadeTeamSummary): void {
    const name = names[team.id]
    setNames(({ [team.id]: _, ...rest }) => rest)
    if (name === undefined || !name.trim() || name.trim() === team.name) return
    void run(() => window.api.renamePremadeTeam(team.id, name.trim()))
  }

  function remove(id: string): void {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id)
      return
    }
    setConfirmDeleteId(null)
    void run(() => window.api.deletePremadeTeam(id))
  }

  const selectedTeam = teams.find((t) => t.id === selectedTeamId) ?? null
  const itemOf = (id: string | null): ItemOptionEntry | undefined => (id ? items.find((i) => i.id === id) : undefined)

  return (
    <div className="editor-section trainer-teams-section">
      <div className="trainer-teams-header">
        <h3>Team</h3>
        <div className="trainer-team-modes">
          {(
            [
              ['random', 'Random'],
              ['monotype', 'Monotype'],
              ['custom', 'Premade teams']
            ] as [TeamMode, string][]
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              className={`trainer-chip${teamMode === mode ? ' trainer-chip-on' : ''}`}
              onClick={() => onTeamModeChange(mode)}
            >
              {label}
            </button>
          ))}
          {teamMode === 'monotype' && (
            <select className="trainer-team-type" value={monotype} onChange={(e) => onMonotypeChange(e.target.value)}>
              {POKEMON_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {teamMode === 'random' && <p className="editor-hint">A random team of non-legendary Pokemon, sized and levelled for the fight.</p>}
      {teamMode === 'monotype' && <p className="editor-hint">A random team of non-legendary {monotype}-type Pokemon.</p>}

      {teamMode === 'custom' &&
        (!trainerId ? (
          <p className="editor-hint">Save the trainer first, then add its premade teams here.</p>
        ) : (
          <>
            <div className="trainer-team-list">
              {teams.map((t) => {
                const drop = itemOf(t.drop.itemId)
                return (
                  <div key={t.id} className="trainer-team-row">
                    <div className="trainer-team-row-head">
                      <input
                        className="trainer-team-name"
                        value={names[t.id] ?? t.name}
                        title="Rename"
                        onChange={(e) => {
                          const value = e.target.value
                          setNames((all) => ({ ...all, [t.id]: value }))
                        }}
                        onBlur={() => rename(t)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                        }}
                      />
                      <span className="trainer-team-badges">
                        <span className="trainer-pill">{t.mons.length}/6</span>
                        {t.requiredLevelCap > 1 ? (
                          <span
                            className="level-cap-badge"
                            title={`Its strongest Pokemon is level ${t.requiredLevelCap}, so it's only fought from a level cap of ${t.requiredLevelCap}`}
                          >
                            Cap {t.requiredLevelCap}+
                          </span>
                        ) : (
                          t.mons.length > 0 && (
                            <span className="trainer-pill" title="Its levels follow the level cap">
                              Follows cap
                            </span>
                          )
                        )}
                        {t.isDoubleBattle && <span className="double-battle-badge">2v2</span>}
                        {drop && (
                          <span className="trainer-pill trainer-drop-pill" title={`Drops ${drop.name} (${t.drop.chance}%)`}>
                            <ItemSprite spritenum={drop.spritenum} />
                            {t.drop.chance}%
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="trainer-team-row-body">
                      <TeamIcons team={t} />
                      <span className="trainer-team-actions">
                        <button type="button" onClick={() => setSelectedTeamId(t.id)}>
                          Edit Roster
                        </button>
                        <button type="button" disabled={busy} onClick={() => void run(() => window.api.duplicatePremadeTeam(t.id))}>
                          Copy
                        </button>
                        <button
                          type="button"
                          className={confirmDeleteId === t.id ? 'trainer-danger' : undefined}
                          disabled={busy}
                          onClick={() => remove(t.id)}
                          onBlur={() => setConfirmDeleteId((id) => (id === t.id ? null : id))}
                        >
                          {confirmDeleteId === t.id ? 'Sure?' : 'Delete'}
                        </button>
                      </span>
                    </div>
                  </div>
                )
              })}
              {teams.length === 0 && <p className="box-empty-hint">No teams yet - add one below.</p>}
            </div>
            <div className="trainer-add-row">
              <input
                type="text"
                placeholder={`Team ${teams.length + 1}`}
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void addTeam()
                }}
              />
              <button type="button" disabled={busy} onClick={() => void addTeam()}>
                Add Team
              </button>
            </div>
          </>
        ))}

      {selectedTeam && (
        <PremadeTeamRoster
          team={selectedTeam}
          items={items}
          onClose={() => setSelectedTeamId(null)}
          onTeamsChange={setTeams}
        />
      )}
    </div>
  )
}

export default TrainerTeamsSection
