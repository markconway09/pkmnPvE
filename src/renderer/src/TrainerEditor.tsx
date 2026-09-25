import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type {
  AiDifficulty,
  ItemDropConfig,
  ItemOptionEntry,
  PremadeTeamSummary,
  TeamMode,
  Trainer
} from '../../shared/battle-types'
import { BOSS_PRIZE, MAX_TRAINER_DROPS, POKEMON_TYPES, TRAINER_PRIZE_PER_POKEMON } from '../../shared/battle-types'
import { trainerSpriteUrl } from './trainerSprite'
import { randomTrainerName } from './trainerNames'
import TrainerSpritePicker from './TrainerSpritePicker'
import PremadeTeamRoster from './PremadeTeamRoster'
import ItemDropPicker from './ItemDropPicker'
import { formatMoney } from './money'

interface Props {
  trainer: Trainer | null
  onClose: () => void
  onSaved: () => void
}

function TrainerEditor({ trainer, onClose, onSaved }: Props): React.JSX.Element {
  const [trainerId, setTrainerId] = useState<string | null>(trainer?.id ?? null)
  const [name, setName] = useState(trainer?.name ?? randomTrainerName())
  const [spriteId, setSpriteId] = useState(trainer?.spriteId ?? 'youngster')
  const [difficulty, setDifficulty] = useState<AiDifficulty>(trainer?.difficulty ?? 'normal')
  const [teamMode, setTeamMode] = useState<TeamMode>(trainer?.teamMode ?? 'random')
  const [monotype, setMonotype] = useState<string>(trainer?.monotype ?? POKEMON_TYPES[0])
  const [isBoss, setIsBoss] = useState(trainer?.isBoss ?? false)
  const [teamRocket, setTeamRocket] = useState(trainer?.teamRocket ?? false)
  const [alwaysAvailable, setAlwaysAvailable] = useState(trainer?.alwaysAvailable ?? false)
  const [rocketEvent, setRocketEvent] = useState(trainer?.rocketEvent ?? false)
  // One row per possible reward, so an unused slot is a row with no item.
  const [drops, setDrops] = useState<ItemDropConfig[]>(() =>
    Array.from({ length: MAX_TRAINER_DROPS }, (_, i) => trainer?.drops[i] ?? { itemId: null, chance: 100 })
  )
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

  async function save(): Promise<void> {
    setSaving(true)
    setError(null)
    try {
      const input = {
        name: name.trim() || randomTrainerName(),
        spriteId,
        difficulty,
        teamMode,
        monotype: teamMode === 'monotype' ? monotype : null,
        isBoss,
        teamRocket,
        alwaysAvailable,
        rocketEvent: isBoss && rocketEvent,
        drops: drops.filter((d) => d.itemId)
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
        <h2>{trainerId ? 'Edit Trainer' : 'New Trainer'}</h2>
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

          <label className="editor-field editor-field-checkbox">
            <span>Boss trainer</span>
            <input type="checkbox" checked={isBoss} onChange={(e) => setIsBoss(e.target.checked)} />
          </label>

          <label className="editor-field editor-field-checkbox">
            <span>Always available (its cap-relative teams appear at any level cap)</span>
            <input type="checkbox" checked={alwaysAvailable} onChange={(e) => setAlwaysAvailable(e.target.checked)} />
          </label>
          <label className="editor-field editor-field-checkbox">
            <span>Team Rocket member</span>
            <input type="checkbox" checked={teamRocket} onChange={(e) => setTeamRocket(e.target.checked)} />
          </label>
          {isBoss && (
            <label className="editor-field editor-field-checkbox">
              <span>Team Rocket event (while queued, Trainer Battle is Team Rocket only)</span>
              <input type="checkbox" checked={rocketEvent} onChange={(e) => setRocketEvent(e.target.checked)} />
            </label>
          )}

          <p className="editor-hint">
            Prize money: {isBoss ? `${formatMoney(BOSS_PRIZE)}` : `${formatMoney(TRAINER_PRIZE_PER_POKEMON)} per Pokemon on their team`}, plus the level cap as a percentage on top
          </p>

          {drops.map((drop, i) => (
            <ItemDropPicker
              key={i}
              label={`Item reward ${i + 1}`}
              items={items}
              itemId={drop.itemId}
              chance={drop.chance}
              onChangeItem={(itemId) => setDrops((all) => all.map((d, j) => (j === i ? { ...d, itemId } : d)))}
              onChangeChance={(chance) => setDrops((all) => all.map((d, j) => (j === i ? { ...d, chance } : d)))}
            />
          ))}

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

export default TrainerEditor
