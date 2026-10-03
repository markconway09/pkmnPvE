import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type {
  AiDifficulty,
  BossStep,
  ItemDropConfig,
  ItemOptionEntry,
  ProgressionState,
  TeamMode,
  Trainer
} from '../../shared/battle-types'
import { BOSS_PRIZE, MAX_TRAINER_DROPS, POKEMON_TYPES, TRAINER_PRIZE_PER_POKEMON } from '../../shared/battle-types'
import { trainerSpriteUrl } from './trainerSprite'
import { randomTrainerName } from './trainerNames'
import TrainerSpritePicker from './TrainerSpritePicker'
import TrainerTeamsSection from './TrainerTeamsSection'
import ItemDropPicker from './ItemDropPicker'
import FieldStartPicker from './FieldStartPicker'
import { formatMoney } from './money'

interface Props {
  trainer: Trainer | null
  // Every trainer - for the names around this one in the boss order.
  trainers: Trainer[]
  onClose: () => void
  onSaved: () => void
}

type DraftStep = Omit<BossStep, 'id'>

const DIFFICULTIES: [AiDifficulty, string][] = [
  ['easy', 'Easy'],
  ['normal', 'Normal'],
  ['hard', 'Hard']
]

const stepsOf = (p: ProgressionState): DraftStep[] =>
  p.bossOrder.map(({ trainerId, requiredTrainerWins, levelCapAfterWin, unlocksLateItems }) => ({
    trainerId,
    requiredTrainerWins,
    levelCapAfterWin,
    unlocksLateItems: !!unlocksLateItems
  }))

// The classic game's trainer editor: who the trainer is, what beating it pays, where it
// sits in the boss order (for a boss), and its teams.
function TrainerEditor({ trainer, trainers, onClose, onSaved }: Props): React.JSX.Element {
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
  const [fieldWeather, setFieldWeather] = useState<string | null>(trainer?.fieldWeather ?? null)
  const [fieldTerrain, setFieldTerrain] = useState<string | null>(trainer?.fieldTerrain ?? null)
  const [fieldTrickRoom, setFieldTrickRoom] = useState(trainer?.fieldTrickRoom ?? false)
  // One row per possible reward, so an unused slot is a row with no item.
  const [drops, setDrops] = useState<ItemDropConfig[]>(() =>
    Array.from({ length: MAX_TRAINER_DROPS }, (_, i) => trainer?.drops[i] ?? { itemId: null, chance: 100 })
  )
  const [pickerOpen, setPickerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<ItemOptionEntry[]>([])

  // The boss order (shared by every player) and this player's progress through it.
  const [progression, setProgression] = useState<ProgressionState | null>(null)
  const [inOrder, setInOrder] = useState(false)
  // Its place in the order, from 0.
  const [position, setPosition] = useState(0)
  const [requiredWins, setRequiredWins] = useState(0)
  const [capAfterWin, setCapAfterWin] = useState(20)
  const [unlocksLateItems, setUnlocksLateItems] = useState(false)

  useEffect(() => {
    window.api
      .getEditorOptions()
      .then((opts) => setItems(opts.items))
      .catch(() => {})
    window.api
      .getProgression()
      .then((p) => {
        setProgression(p)
        const index = p.bossOrder.findIndex((s) => s.trainerId === trainer?.id)
        const step = p.bossOrder[index]
        if (step) {
          setInOrder(true)
          setPosition(index)
          setRequiredWins(step.requiredTrainerWins)
          setCapAfterWin(step.levelCapAfterWin)
          setUnlocksLateItems(!!step.unlocksLateItems)
        } else {
          // A new boss goes at the end, its cap a step past the last one's.
          setPosition(p.bossOrder.length)
          setCapAfterWin(Math.min(100, (p.bossOrder.at(-1)?.levelCapAfterWin ?? p.levelCap) + 5))
        }
      })
      .catch(() => {})
  }, [trainer?.id])

  // The order without this trainer - what its position is counted against.
  const others = progression ? stepsOf(progression).filter((s) => s.trainerId !== trainerId) : []
  const nameOf = (id: string): string => trainers.find((t) => t.id === id)?.name ?? 'Unknown trainer'
  const before = others[position - 1]
  const after = others[position]
  const beaten = !!trainerId && !!progression?.bossesDefeated.includes(trainerId)
  const nextBossId = progression?.bossOrder.find((s) => !progression.bossesDefeated.includes(s.trainerId))?.trainerId

  async function saveBossOrder(id: string): Promise<void> {
    if (!progression) return
    const current = stepsOf(progression)
    const next = current.filter((s) => s.trainerId !== id)
    if (isBoss && inOrder) {
      next.splice(Math.min(position, next.length), 0, {
        trainerId: id,
        requiredTrainerWins: Math.max(0, Math.round(requiredWins) || 0),
        levelCapAfterWin: Math.max(1, Math.min(100, Math.round(capAfterWin) || 1)),
        unlocksLateItems
      })
    }
    if (JSON.stringify(next) !== JSON.stringify(current)) setProgression(await window.api.setBossOrder(next))
  }

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
        // Only a boss starts its fights with weather or terrain.
        fieldWeather: isBoss ? fieldWeather : null,
        fieldTerrain: isBoss ? fieldTerrain : null,
        fieldTrickRoom: isBoss && fieldTrickRoom,
        drops: drops.filter((d) => d.itemId)
      }
      let id = trainerId
      if (id) {
        await window.api.updateTrainer(id, input)
      } else {
        id = (await window.api.addTrainer(input)).id
        setTrainerId(id)
      }
      await saveBossOrder(id)
      onSaved()
      // A new trainer with premade teams stays open, for its teams to be added.
      if (teamMode !== 'custom' || trainerId) onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const statusText = !inOrder
    ? 'Not in the boss order - it never comes up as a boss fight'
    : beaten
      ? 'Beaten on this save'
      : trainerId && nextBossId === trainerId
        ? 'The next boss on this save'
        : 'Not reached yet on this save'

  return createPortal(
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-panel trainer-editor-modal" onMouseDown={(e) => e.stopPropagation()}>
        <h2>{trainerId ? 'Edit Trainer' : 'New Trainer'}</h2>
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

              <div className="trainer-editor-card">
                <h3>Role</h3>
                <label className="trainer-toggle">
                  <input type="checkbox" checked={isBoss} onChange={(e) => setIsBoss(e.target.checked)} />
                  <span>
                    Boss
                    <small>Fought from Boss Battle, in the boss order - never as a random trainer</small>
                  </span>
                </label>
                <label className="trainer-toggle">
                  <input type="checkbox" checked={alwaysAvailable} onChange={(e) => setAlwaysAvailable(e.target.checked)} />
                  <span>
                    Always available
                    <small>Its cap-relative teams can come up at any level cap</small>
                  </span>
                </label>
                <label className="trainer-toggle">
                  <input type="checkbox" checked={teamRocket} onChange={(e) => setTeamRocket(e.target.checked)} />
                  <span>
                    Team Rocket member
                    <small>The only trainers fought while a Team Rocket event is queued</small>
                  </span>
                </label>
                {isBoss && (
                  <label className="trainer-toggle">
                    <input type="checkbox" checked={rocketEvent} onChange={(e) => setRocketEvent(e.target.checked)} />
                    <span>
                      Team Rocket event
                      <small>While it&apos;s the next boss, Trainer Battle fights Team Rocket only</small>
                    </span>
                  </label>
                )}
              </div>
              {isBoss && (
                <FieldStartPicker
                  weather={fieldWeather}
                  terrain={fieldTerrain}
                  onWeatherChange={setFieldWeather}
                  onTerrainChange={setFieldTerrain}
                trickRoom={fieldTrickRoom}
                onTrickRoomChange={setFieldTrickRoom}
                />
              )}
            </div>

            <div className="trainer-editor-column">
              <div className="trainer-editor-card">
                <h3>Rewards</h3>
                <p className="editor-hint">
                  Prize money: {isBoss ? formatMoney(BOSS_PRIZE) : `${formatMoney(TRAINER_PRIZE_PER_POKEMON)} per Pokemon on its team`}, plus
                  the level cap as a percentage on top
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
              </div>

              {/* The boss order - what the Progression screen used to set. */}
              <div className={`trainer-editor-card${isBoss ? '' : ' trainer-editor-card-off'}`}>
                <h3>Boss order</h3>
                {!isBoss ? (
                  <p className="editor-hint">Make it a boss to put it in the boss order.</p>
                ) : !progression ? (
                  <p className="editor-hint">Loading...</p>
                ) : (
                  <>
                    <label className="trainer-toggle">
                      <input type="checkbox" checked={inOrder} onChange={(e) => setInOrder(e.target.checked)} />
                      <span>
                        In the boss order
                        <small className={beaten ? 'trainer-status-beaten' : undefined}>{statusText}</small>
                      </span>
                    </label>
                    {inOrder && (
                      <div className="trainer-boss-fields">
                        <label className="editor-field">
                          <span>Fight</span>
                          <select value={position} onChange={(e) => setPosition(Number(e.target.value))}>
                            {Array.from({ length: others.length + 1 }, (_, i) => (
                              <option key={i} value={i}>
                                #{i + 1}
                                {i === others.length ? ' (last)' : ''}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="editor-field">
                          <span>Wins needed</span>
                          <input
                            type="number"
                            min={0}
                            value={requiredWins}
                            onChange={(e) => setRequiredWins(Number(e.target.value))}
                          />
                        </label>
                        <label className="editor-field">
                          <span>Cap after</span>
                          <input
                            type="number"
                            min={1}
                            max={100}
                            value={capAfterWin}
                            onChange={(e) => setCapAfterWin(Number(e.target.value))}
                          />
                        </label>
                        <p className="editor-hint trainer-boss-neighbours">
                          {before ? `After ${nameOf(before.trainerId)} (cap ${before.levelCapAfterWin})` : 'The first boss'}
                          {after ? ` · before ${nameOf(after.trainerId)}` : ''}
                        </p>
                        <label className="trainer-toggle trainer-boss-late">
                          <input
                            type="checkbox"
                            checked={unlocksLateItems}
                            onChange={(e) => setUnlocksLateItems(e.target.checked)}
                          />
                          <span>
                            Unlocks Exp. Candies &amp; evolution items in the Shop
                            <small>They stay out of the Shop until it&apos;s beaten (drops aren&apos;t affected)</small>
                          </span>
                        </label>
                      </div>
                    )}
                  </>
                )}
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

export default TrainerEditor
