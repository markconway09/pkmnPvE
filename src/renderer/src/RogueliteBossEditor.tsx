import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { AiDifficulty, ItemOptionEntry, RogueliteBossClass, TeamMode, Trainer } from '../../shared/battle-types'
import { POKEMON_GENERATIONS, POKEMON_TYPES, ROGUELITE_BOSS_CLASSES } from '../../shared/battle-types'
import { trainerSpriteUrl } from './trainerSprite'
import { randomTrainerName } from './trainerNames'
import TrainerSpritePicker from './TrainerSpritePicker'
import TrainerTeamsSection from './TrainerTeamsSection'

interface Props {
  trainer: Trainer | null
  // Every trainer - for how many bosses each generation already has.
  trainers: Trainer[]
  onClose: () => void
  onSaved: () => void
}

const DIFFICULTIES: [AiDifficulty, string][] = [
  ['easy', 'Easy'],
  ['normal', 'Normal'],
  ['hard', 'Hard']
]

// The Roguelite bosses' own trainer editor (Debug → Edit Roguelite Bosses) - kept apart
// from the classic TrainerEditor so run-only settings can go here without cluttering
// that one. Everything it saves is a Roguelite boss: none of the classic game's boss,
// always-available or Team Rocket options apply.
function RogueliteBossEditor({ trainer, trainers, onClose, onSaved }: Props): React.JSX.Element {
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
  const [pickerOpen, setPickerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<ItemOptionEntry[]>([])

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

  useEffect(() => {
    window.api
      .getEditorOptions()
      .then((opts) => setItems(opts.items))
      .catch(() => {})
  }, [])

  const rewardAbilityId = abilities.find((a) => a.name.toLowerCase() === rewardAbility.trim().toLowerCase())?.id ?? ''

  // The other bosses of the chosen generation, by class - a run needs 8 Gym Leaders,
  // 4 Elite Four and a Champion from it.
  const sameGeneration = trainers.filter(
    (t) => t.rogueliteBoss && t.id !== trainerId && generation && t.rogueliteGeneration === generation
  )
  const classCount = (c: RogueliteBossClass): number => sameGeneration.filter((t) => t.rogueliteClass === c).length

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
      // A new boss with premade teams stays open, for its teams to be added.
      if (teamMode !== 'custom' || trainerId) onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-panel trainer-editor-modal" onMouseDown={(e) => e.stopPropagation()}>
        <h2>{trainerId ? 'Edit Roguelite Boss' : 'New Roguelite Boss'}</h2>
        <div className="trainer-editor-scroll">
          <div className="trainer-editor-grid">
            <div className="trainer-editor-column">
              <div className="trainer-editor-identity">
                <button
                  type="button"
                  className="trainer-editor-sprite"
                  title={`${spriteId} - click to change`}
                  onClick={() => setPickerOpen(true)}
                >
                  <img src={trainerSpriteUrl(spriteId)} alt={spriteId} />
                  <span>Change</span>
                </button>
                <div className="trainer-editor-identity-fields">
                  <label className="editor-field">
                    <span>Name</span>
                    <div className="trainer-name-row">
                      <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
                      <button type="button" title="A random name" onClick={() => setName(randomTrainerName())}>
                        🎲
                      </button>
                    </div>
                  </label>
                  <div className="editor-field">
                    <span>AI difficulty</span>
                    <div className="trainer-chips">
                      {DIFFICULTIES.map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          className={`trainer-chip trainer-chip-${id}${difficulty === id ? ' trainer-chip-on' : ''}`}
                          onClick={() => setDifficulty(id)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="trainer-editor-column">
              <div className="trainer-editor-card">
                <h3>Run</h3>
                <div className="editor-field">
                  <span>Class</span>
                  <div className="trainer-chips">
                    {ROGUELITE_BOSS_CLASSES.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className={`trainer-chip${bossClass === c.id ? ' trainer-chip-on' : ''}`}
                        onClick={() => setBossClass(c.id)}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="editor-field">
                  <span>Generation</span>
                  <div className="trainer-chips trainer-gen-chips">
                    {POKEMON_GENERATIONS.map((g) => (
                      <button
                        key={g}
                        type="button"
                        className={`trainer-chip${generation === g ? ' trainer-chip-on' : ''}`}
                        onClick={() => setGeneration(g)}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
                {generation !== '' && (
                  <p className="editor-hint">
                    Gen {generation} already has {classCount('gymLeader')}/8 Gym Leaders, {classCount('eliteFour')}/4 Elite
                    Four and {classCount('champion')}/1 Champion besides this one
                  </p>
                )}
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
                <p className="editor-hint">Its premade teams are set to the floor&apos;s level and trimmed to the boss&apos;s size.</p>
              </div>
            </div>
          </div>

          <TrainerTeamsSection
            trainerId={trainerId}
            teamMode={teamMode}
            monotype={monotype}
            items={items}
            onTeamModeChange={setTeamMode}
            onMonotypeChange={setMonotype}
            onError={setError}
          />
        </div>
        {error && <p className="editor-error">{error}</p>}
        <div className="editor-actions">
          <button onClick={onClose} disabled={saving}>
            {trainerId && !trainer ? 'Close' : 'Cancel'}
          </button>
          <button onClick={() => void save()} disabled={saving}>
            Save
          </button>
        </div>
      </div>

      {pickerOpen && (
        <TrainerSpritePicker value={spriteId} onChange={setSpriteId} onClose={() => setPickerOpen(false)} />
      )}
    </div>,
    document.body
  )
}

export default RogueliteBossEditor
