import { useEffect, useState } from 'react'
import type { BossStep, ProgressionState, Trainer } from '../../shared/battle-types'
import { trainerSpriteUrl } from './trainerSprite'

interface Props {
  onBack: () => void
}

type DraftStep = Omit<BossStep, 'id'>

function ProgressionEditor({ onBack }: Props): React.JSX.Element {
  const [progression, setProgression] = useState<ProgressionState | null>(null)
  const [trainers, setTrainers] = useState<Trainer[]>([])
  const [steps, setSteps] = useState<DraftStep[]>([])
  const [levelCapInput, setLevelCapInput] = useState('')
  const [addTrainerId, setAddTrainerId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function refresh(): void {
    window.api
      .getProgression()
      .then((p) => {
        setProgression(p)
        setSteps(p.bossOrder.map(({ trainerId, requiredTrainerWins, levelCapAfterWin, unlocksLateItems }) => ({
          trainerId,
          requiredTrainerWins,
          levelCapAfterWin,
          unlocksLateItems
        })))
        setLevelCapInput(String(p.levelCap))
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
    window.api.listTrainers().then(setTrainers).catch(() => {})
  }

  useEffect(refresh, [])

  const bossTrainers = trainers.filter((t) => t.isBoss)
  const availableToAdd = bossTrainers.filter((t) => !steps.some((s) => s.trainerId === t.id))
  const trainerName = (id: string): string => trainers.find((t) => t.id === id)?.name ?? 'Unknown trainer'
  const trainerSprite = (id: string): string => trainers.find((t) => t.id === id)?.spriteId ?? 'youngster'

  async function saveOrder(next: DraftStep[]): Promise<void> {
    setSteps(next)
    setBusy(true)
    try {
      setProgression(await window.api.setBossOrder(next))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  function move(index: number, dir: -1 | 1): void {
    const target = index + dir
    if (target < 0 || target >= steps.length) return
    const next = [...steps]
    ;[next[index], next[target]] = [next[target], next[index]]
    void saveOrder(next)
  }

  function updateStep(index: number, patch: Partial<DraftStep>): void {
    void saveOrder(steps.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }

  function removeStep(index: number): void {
    void saveOrder(steps.filter((_, i) => i !== index))
  }

  function addStep(): void {
    if (!addTrainerId) return
    void saveOrder([
      ...steps,
      { trainerId: addTrainerId, requiredTrainerWins: 0, levelCapAfterWin: (progression?.levelCap ?? 15) + 5 }
    ])
    setAddTrainerId('')
  }

  async function applyLevelCap(): Promise<void> {
    const n = Number(levelCapInput)
    if (!Number.isFinite(n)) return
    setBusy(true)
    try {
      setProgression(await window.api.setLevelCap(n))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="screen">
      <h1>Progression</h1>
      <button onClick={onBack}>Back</button>
      {error && <p style={{ color: '#ff6b6b' }}>{error}</p>}

      <h2 className="options-heading">Current Level Cap</h2>
      <div className="trainer-name-row" style={{ maxWidth: 200 }}>
        <input
          type="number"
          min={1}
          max={100}
          value={levelCapInput}
          onChange={(e) => setLevelCapInput(e.target.value)}
        />
        <button disabled={busy} onClick={() => void applyLevelCap()}>
          Set
        </button>
      </div>
      {progression && (
        <p className="box-empty-hint">{progression.trainerWinsSinceLastBoss} trainer win(s) since the last boss.</p>
      )}

      <h2 className="options-heading">Boss Order</h2>
      <p className="box-empty-hint">
        Mini-bosses usually need 0 trainer wins to unlock. Main bosses typically require a few.
      </p>
      <div className="trainer-list">
        {steps.map((step, i) => (
          <div key={step.trainerId} className="trainer-list-row">
            <img className="trainer-list-sprite" src={trainerSpriteUrl(trainerSprite(step.trainerId))} alt="" />
            <div className="trainer-list-info">
              <div className="trainer-list-name">
                {i + 1}. {trainerName(step.trainerId)}
              </div>
              <div className="trainer-list-meta">
                Requires{' '}
                <input
                  type="number"
                  min={0}
                  className="progression-inline-input"
                  value={step.requiredTrainerWins}
                  onChange={(e) => updateStep(i, { requiredTrainerWins: Number(e.target.value) })}
                />{' '}
                trainer win(s) · Cap becomes{' '}
                <input
                  type="number"
                  min={1}
                  max={100}
                  className="progression-inline-input"
                  value={step.levelCapAfterWin}
                  onChange={(e) => updateStep(i, { levelCapAfterWin: Number(e.target.value) })}
                />{' '}
                ·{' '}
                <label title="Exp. Candies and evolution items stay out of the shop until this boss is beaten (drops aren't affected)">
                  <input
                    type="checkbox"
                    checked={!!step.unlocksLateItems}
                    onChange={(e) => updateStep(i, { unlocksLateItems: e.target.checked })}
                  />{' '}
                  Unlocks Exp. Candies &amp; evo items in the shop
                </label>
              </div>
            </div>
            <button disabled={i === 0} onClick={() => move(i, -1)}>
              ↑
            </button>
            <button disabled={i === steps.length - 1} onClick={() => move(i, 1)}>
              ↓
            </button>
            <button onClick={() => removeStep(i)}>Remove</button>
          </div>
        ))}
        {steps.length === 0 && <p className="box-empty-hint">No bosses in the order yet.</p>}
      </div>

      <div className="trainer-add-row">
        <select value={addTrainerId} onChange={(e) => setAddTrainerId(e.target.value)}>
          <option value="">Add a boss trainer...</option>
          {availableToAdd.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <button disabled={!addTrainerId} onClick={addStep}>
          Add
        </button>
      </div>
    </div>
  )
}

export default ProgressionEditor
