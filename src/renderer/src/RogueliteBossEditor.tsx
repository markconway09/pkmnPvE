import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type {
  AiDifficulty,
  ItemOptionEntry,
  RogueliteBossClass,
  PremadeTeamSummary,
  TeamMode,
  Trainer
} from '../../shared/battle-types'
import { POKEMON_GENERATIONS, POKEMON_TYPES, ROGUELITE_BOSS_CLASSES } from '../../shared/battle-types'
import { trainerSpriteUrl } from './trainerSprite'
import { randomTrainerName } from './trainerNames'
import TrainerSpritePicker from './TrainerSpritePicker'
import PremadeTeamRoster from './PremadeTeamRoster'

interface Props {
  trainer: Trainer | null
  onClose: () => void
  onSaved: () => void
}

// The Roguelite bosses' own trainer editor (Debug → Edit Roguelite Bosses) - kept apart
// from the classic TrainerEditor so run-only settings can go here without cluttering
// that one. Everything it saves is a Roguelite boss: none of the classic game's boss,
// always-available or Team Rocket options apply.
function RogueliteBossEditor({ trainer, onClose, onSaved }: Props): React.JSX.Element {
  const [trainerId, setTrainerId] = useState<string | null>(trainer?.id ?? null)
  const [name, setName] = useState(trainer?.name ?? randomTrainerName())
  const [spriteId, setSpriteId] = useState(trainer?.spriteId ?? 'youngster')
  const [difficulty, setDifficulty] = useState<AiDifficulty>(trainer?.difficulty ?? 'normal')
  const [teamMode, setTeamMode] = useState<TeamMode>(trainer?.teamMode ?? 'random')
  const [monotype, setMonotype] = useState<string>(trainer?.monotype ?? POKEMON_TYPES[0])
  // Empty until picked - a boss made before classes existed has none yet.
  const [bossClass, setBossClass] = useState<RogueliteBossClass | ''>(trainer?.rogueliteClass ?? '')
  const [generation, setGeneration] = useState<number | ''>(trainer?.rogueliteGeneration ?? '')
  // The ability beating this boss offers (typed by name, stored by id).
  const [rewardAbility, setRewardAbility] = useState('')
  const [abilities, setAbilities] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    window.api
      .listAllAbilities()
      .then((list) => {
        setAbilities(list)
        const current = list.find((a) => a.id === trainer?.rogueliteRewardAbility)
        if (current) setRewardAbility(current.name)
      })
      .catch(() => {})
  }, [trainer?.rogueliteRewardAbility])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [teams, setTeams] = useState<PremadeTeamSummary[]>([])
  const [newTeamName, setNewTeamName] = useState('')
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [teamBusy, setTeamBusy] = useState(false)
  const [items, setItems] = useState<ItemOptionEntry[]>([])

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

  useEffect(() => {
    window.api
      .getEditorOptions()
      .then((opts) => setItems(opts.items))
      .catch(() => {})
  }, [])

  const rewardAbilityId = abilities.find((a) => a.name.toLowerCase() === rewardAbility.trim().toLowerCase())?.id ?? ''

  async function save(): Promise<void> {
    if (rewardAbility.trim() && !rewardAbilityId) {
      setError(`There's no ability called "${rewardAbility.trim()}"`)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const input = {
        name: name.trim() || randomTrainerName(),
        spriteId,
        difficulty,
        teamMode,
        monotype: teamMode === 'monotype' ? monotype : null,
        isBoss: false,
        rogueliteBoss: true,
        teamRocket: false,
        alwaysAvailable: false,
        rocketEvent: false,
        rogueliteClass: bossClass || undefined,
        rogueliteGeneration: generation || undefined,
        rogueliteRewardAbility: rewardAbilityId || undefined,
        // Run bosses don't drop anything - whatever a trainer already had is just kept.
        drops: trainer?.drops ?? []
      }
      if (trainerId) {
        await window.api.updateTrainer(trainerId, input)
      } else {
        const created = await window.api.addTrainer(input)
        setTrainerId(created.id)
      }
      onSaved()
      if (teamMode !== 'custom') onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  async function addTeam(): Promise<void> {
    if (!trainerId) return
    setTeamBusy(true)
    try {
      setTeams(await window.api.addPremadeTeam(trainerId, newTeamName.trim() || 'New Team'))
      setNewTeamName('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setTeamBusy(false)
    }
  }

  async function deleteTeam(id: string): Promise<void> {
    setTeamBusy(true)
    try {
      setTeams(await window.api.deletePremadeTeam(id))
    } finally {
      setTeamBusy(false)
    }
  }

  const selectedTeam = teams.find((t) => t.id === selectedTeamId) ?? null

  return createPortal(
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-panel pokemon-editor trainer-editor-modal" onMouseDown={(e) => e.stopPropagation()}>
        <h2>{trainerId ? 'Edit Roguelite Boss' : 'New Roguelite Boss'}</h2>
        <div className="editor-form">
          <label className="editor-field">
            <span>Name</span>
            <div className="trainer-name-row">
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
              <button type="button" onClick={() => setName(randomTrainerName())}>
                Random
              </button>
            </div>
          </label>

          <label className="editor-field">
            <span>AI Difficulty</span>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as AiDifficulty)}>
              <option value="easy">Easy</option>
              <option value="normal">Normal</option>
              <option value="hard">Hard</option>
            </select>
          </label>

          <label className="editor-field">
            <span>Class</span>
            <select value={bossClass} onChange={(e) => setBossClass(e.target.value as RogueliteBossClass | '')}>
              {!bossClass && <option value="">Choose a class...</option>}
              {ROGUELITE_BOSS_CLASSES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <label className="editor-field">
            <span>Reward ability</span>
            <input
              type="text"
              list="boss-reward-abilities"
              placeholder="None (beating it gives an item pick)"
              value={rewardAbility}
              onChange={(e) => setRewardAbility(e.target.value)}
            />
            <datalist id="boss-reward-abilities">
              {abilities.map((a) => (
                <option key={a.id} value={a.name} />
              ))}
            </datalist>
          </label>

          <label className="editor-field">
            <span>Generation</span>
            <select value={generation} onChange={(e) => setGeneration(e.target.value ? Number(e.target.value) : '')}>
              {!generation && <option value="">Choose a generation...</option>}
              {POKEMON_GENERATIONS.map((g) => (
                <option key={g} value={g}>
                  Generation {g}
                </option>
              ))}
            </select>
          </label>

          <div className="editor-section">
            <h3>Sprite</h3>
            <button type="button" className="trainer-sprite-current" onClick={() => setPickerOpen(true)}>
              <img className="trainer-sprite-current-img" src={trainerSpriteUrl(spriteId)} alt={spriteId} />
              <div className="trainer-sprite-current-info">
                <span>{spriteId}</span>
                <span className="trainer-sprite-change-hint">Click to change</span>
              </div>
            </button>
          </div>

          <div className="editor-section">
            <h3>Team</h3>
            <select value={teamMode} onChange={(e) => setTeamMode(e.target.value as TeamMode)}>
              <option value="random">Random Pokemon (no legendaries)</option>
              <option value="monotype">Random monotype (no legendaries)</option>
              <option value="custom">Custom premade teams</option>
            </select>

            {teamMode === 'monotype' && (
              <select value={monotype} onChange={(e) => setMonotype(e.target.value)} style={{ marginTop: 8 }}>
                {POKEMON_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            )}

            {teamMode === 'custom' &&
              (!trainerId ? (
                <p className="editor-hint">Save the trainer first, then add premade teams below.</p>
              ) : (
                <>
                  <div className="trainer-add-row" style={{ marginTop: 8 }}>
                    <input
                      type="text"
                      placeholder="Team name"
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void addTeam()
                      }}
                    />
                    <button type="button" disabled={teamBusy} onClick={() => void addTeam()}>
                      Add Team
                    </button>
                  </div>
                  <div className="trainer-list" style={{ marginTop: 8 }}>
                    {teams.map((t) => (
                      <div key={t.id} className="trainer-list-row">
                        <div className="trainer-list-info">
                          <div className="trainer-list-name">
                            {t.name} ({t.mons.length}/6)
                            {t.requiredLevelCap > 1 && <span className="level-cap-badge" title={`Its strongest Pokemon is level ${t.requiredLevelCap}, so it can only be fought at a level cap of ${t.requiredLevelCap} or higher`}>Lvl {t.requiredLevelCap}</span>}
                            {t.isDoubleBattle && <span className="double-battle-badge">2v2</span>}
                          </div>
                        </div>
                        <button type="button" onClick={() => setSelectedTeamId(t.id)}>
                          Edit Roster
                        </button>
                        <button type="button" disabled={teamBusy} onClick={() => void deleteTeam(t.id)}>
                          Delete
                        </button>
                      </div>
                    ))}
                    {teams.length === 0 && <p className="box-empty-hint">No teams yet - add one above.</p>}
                  </div>
                </>
              ))}
          </div>
        </div>
        {error && <p className="editor-error">{error}</p>}
        <div className="editor-actions">
          <button onClick={onClose} disabled={saving}>
            {teamMode === 'custom' && trainerId ? 'Close' : 'Cancel'}
          </button>
          <button onClick={() => void save()} disabled={saving}>
            Save
          </button>
        </div>
      </div>

      {pickerOpen && (
        <TrainerSpritePicker value={spriteId} onChange={setSpriteId} onClose={() => setPickerOpen(false)} />
      )}
      {selectedTeam && (
        <PremadeTeamRoster
          team={selectedTeam}
          items={items}
          onClose={() => setSelectedTeamId(null)}
          onTeamsChange={setTeams}
        />
      )}
    </div>,
    document.body
  )
}

export default RogueliteBossEditor
