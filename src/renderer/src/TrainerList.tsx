import { useEffect, useState } from 'react'
import type { PremadeTeamSummary, Trainer } from '../../shared/battle-types'
import { trainerSpriteUrl } from './trainerSprite'
import TrainerEditor from './TrainerEditor'
import RogueliteBossEditor from './RogueliteBossEditor'

interface Props {
  onBack: () => void
  onPremadeTeams: () => void
  // The Roguelite bosses' own list (Debug → Edit Roguelite Bosses) instead of the
  // normal game's trainers - each list only ever shows its own.
  roguelite?: boolean
}

const DIFFICULTY_LABELS: Record<string, string> = { easy: 'Easy', normal: 'Normal', hard: 'Hard' }

function TrainerList({ onBack, onPremadeTeams, roguelite = false }: Props): React.JSX.Element {
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
  const listed = (trainers ?? []).filter((t) => !!t.rogueliteBoss === roguelite)
  const visible = listed.filter(
    (t) =>
      !needle ||
      `${t.name} ${t.isBoss ? bossLabel(t) : ''} ${DIFFICULTY_LABELS[t.difficulty]}`.toLowerCase().includes(needle)
  )

  return (
    <div className="screen">
      <h1>{roguelite ? 'Roguelite Bosses' : 'Trainers'}</h1>
      {roguelite && (
        <p className="editor-hint">
          A run&apos;s boss floors pick from these at random. Their premade teams are set to the floor&apos;s level and
          trimmed to the boss&apos;s size.
        </p>
      )}
      <button onClick={onBack}>Back</button>
      <button onClick={onPremadeTeams}>Manage Premade Teams</button>
      <button onClick={() => setEditingTrainer('new')}>{roguelite ? 'Add Roguelite Boss' : 'Add Trainer'}</button>
      {error && <p style={{ color: '#ff6b6b' }}>{error}</p>}
      <div className="list-search">
        <input
          type="search"
          value={query}
          placeholder="Search trainers..."
          onChange={(e) => setQuery(e.target.value)}
        />
        {trainers && <span className="list-search-count">{needle ? `${visible.length} of ${listed.length}` : listed.length}</span>}
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
                {t.rogueliteBoss && (
                  <span className="trainer-boss-badge trainer-roguelite-badge" title="Fought on a Roguelite run's boss floors">
                    Roguelite Boss
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
        {trainers && listed.length === 0 && (
          <p className="box-empty-hint">{roguelite ? 'No Roguelite bosses yet.' : 'No trainers yet.'}</p>
        )}
        {trainers && listed.length > 0 && visible.length === 0 && (
          <p className="box-empty-hint">No trainers match &quot;{query}&quot;.</p>
        )}
      </div>

      {editingTrainer &&
        (roguelite ? (
          <RogueliteBossEditor
            trainer={editingTrainer === 'new' ? null : editingTrainer}
            onClose={() => setEditingTrainer(null)}
            onSaved={refresh}
          />
        ) : (
          <TrainerEditor
            trainer={editingTrainer === 'new' ? null : editingTrainer}
            onClose={() => setEditingTrainer(null)}
            onSaved={refresh}
          />
        ))}
    </div>
  )
}

export default TrainerList
