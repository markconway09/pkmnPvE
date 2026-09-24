import { useEffect, useState } from 'react'
import type { PremadeTeamSummary, Trainer } from '../../shared/battle-types'
import { trainerSpriteUrl } from './trainerSprite'
import TrainerEditor from './TrainerEditor'

interface Props {
  onBack: () => void
  onPremadeTeams: () => void
}

const DIFFICULTY_LABELS: Record<string, string> = { easy: 'Easy', normal: 'Normal', hard: 'Hard' }

function TrainerList({ onBack, onPremadeTeams }: Props): React.JSX.Element {
  const [trainers, setTrainers] = useState<Trainer[] | null>(null)
  const [premadeTeams, setPremadeTeams] = useState<PremadeTeamSummary[]>([])
  const [editingTrainer, setEditingTrainer] = useState<Trainer | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  // Each boss's place in the progression's boss order (1 = the first fight).
  const [bossFightNumber, setBossFightNumber] = useState<Map<string, number>>(new Map())

  function refresh(): void {
    window.api
      .listTrainers()
      .then(setTrainers)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
    window.api.listPremadeTeams().then(setPremadeTeams).catch(() => {})
    window.api
      .getProgression()
      .then((p) => setBossFightNumber(new Map(p.bossOrder.map((step, i) => [step.trainerId, i + 1]))))
      .catch(() => {})
  }

  useEffect(refresh, [])

  async function deleteTrainer(id: string): Promise<void> {
    setTrainers(await window.api.deleteTrainer(id))
  }

  function teamLabel(trainer: Trainer): string {
    if (trainer.teamMode === 'random') return 'Random team'
    if (trainer.teamMode === 'monotype') return `Random ${trainer.monotype ?? '?'} team`
    const count = premadeTeams.filter((t) => t.trainerId === trainer.id).length
    return count > 0 ? `${count} premade team${count === 1 ? '' : 's'}` : 'No premade teams yet'
  }

  const bossLabel = (t: Trainer): string => {
    const n = bossFightNumber.get(t.id)
    return n ? `BOSS #${n}` : 'BOSS'
  }

  // Matches the name, or "boss" / "#12" / the difficulty (so typing "boss", "#12" or "hard" filters by those too).
  const needle = query.trim().toLowerCase()
  const visible = (trainers ?? []).filter(
    (t) =>
      !needle ||
      `${t.name} ${t.isBoss ? bossLabel(t) : ''} ${DIFFICULTY_LABELS[t.difficulty]}`.toLowerCase().includes(needle)
  )

  return (
    <div className="screen">
      <h1>Trainers</h1>
      <button onClick={onBack}>Back</button>
      <button onClick={onPremadeTeams}>Manage Premade Teams</button>
      <button onClick={() => setEditingTrainer('new')}>Add Trainer</button>
      {error && <p style={{ color: '#ff6b6b' }}>{error}</p>}
      <div className="list-search">
        <input
          type="search"
          value={query}
          placeholder="Search trainers..."
          onChange={(e) => setQuery(e.target.value)}
        />
        {trainers && <span className="list-search-count">{needle ? `${visible.length} of ${trainers.length}` : trainers.length}</span>}
      </div>

      <div className="trainer-list">
        {visible.map((t) => (
          <div key={t.id} className="trainer-list-row">
            <img className="trainer-list-sprite" src={trainerSpriteUrl(t.spriteId)} alt={t.name} />
            <div className="trainer-list-info">
              <div className="trainer-list-name">
                {t.name}
                {t.isBoss && (
                  <span
                    className="trainer-boss-badge"
                    title={bossFightNumber.has(t.id) ? `Fight ${bossFightNumber.get(t.id)} in the boss order` : 'Not in the boss order'}
                  >
                    {bossLabel(t)}
                  </span>
                )}
              </div>
              <div className="trainer-list-meta">
                {DIFFICULTY_LABELS[t.difficulty]} · {teamLabel(t)}
              </div>
            </div>
            <button onClick={() => setEditingTrainer(t)}>Edit</button>
            <button onClick={() => void deleteTrainer(t.id)}>Delete</button>
          </div>
        ))}
        {trainers && trainers.length === 0 && <p className="box-empty-hint">No trainers yet.</p>}
        {trainers && trainers.length > 0 && visible.length === 0 && (
          <p className="box-empty-hint">No trainers match &quot;{query}&quot;.</p>
        )}
      </div>

      {editingTrainer && (
        <TrainerEditor
          trainer={editingTrainer === 'new' ? null : editingTrainer}
          onClose={() => setEditingTrainer(null)}
          onSaved={refresh}
        />
      )}
    </div>
  )
}

export default TrainerList
