import { useEffect, useState } from 'react'
import type { ItemOptionEntry, PremadeTeamSummary, Trainer } from '../../shared/battle-types'
import PremadeTeamRoster from './PremadeTeamRoster'

interface Props {
  onBack: () => void
}

function PremadeTeamsList({ onBack }: Props): React.JSX.Element {
  const [teams, setTeams] = useState<PremadeTeamSummary[] | null>(null)
  const [trainers, setTrainers] = useState<Trainer[]>([])
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<ItemOptionEntry[]>([])
  const [query, setQuery] = useState('')

  function refresh(): void {
    window.api
      .listPremadeTeams()
      .then(setTeams)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
    window.api.listTrainers().then(setTrainers).catch(() => {})
  }

  useEffect(refresh, [])
  useEffect(() => {
    window.api
      .getEditorOptions()
      .then((opts) => setItems(opts.items))
      .catch(() => {})
  }, [])

  async function deleteTeam(id: string): Promise<void> {
    setTeams(await window.api.deletePremadeTeam(id))
  }

  function trainerName(trainerId: string): string {
    return trainers.find((t) => t.id === trainerId)?.name ?? 'Unknown trainer'
  }

  const selectedTeam = teams?.find((t) => t.id === selectedTeamId) ?? null

  // Matches the team's name or its trainer's.
  const needle = query.trim().toLowerCase()
  const visible = (teams ?? []).filter(
    (t) => !needle || `${t.name} ${trainerName(t.trainerId)}`.toLowerCase().includes(needle)
  )

  return (
    <div className="screen">
      <h1>Premade Teams</h1>
      <button onClick={onBack}>Back</button>
      {error && <p style={{ color: '#ff6b6b' }}>{error}</p>}
      <p className="box-empty-hint">
        Premade teams belong to a trainer - add one from that trainer&apos;s editor.
      </p>

      <div className="list-search">
        <input
          type="search"
          value={query}
          placeholder="Search by team or trainer..."
          onChange={(e) => setQuery(e.target.value)}
        />
        {teams && <span className="list-search-count">{needle ? `${visible.length} of ${teams.length}` : teams.length}</span>}
      </div>

      <div className="trainer-list">
        {visible.map((team) => (
          <div key={team.id} className="trainer-list-row">
            <div className="trainer-list-info">
              <div className="trainer-list-name">
                {team.name}
                {team.requiredLevelCap > 1 && <span className="level-cap-badge" title={`Its strongest Pokemon is level ${team.requiredLevelCap}, so it can only be fought at a level cap of ${team.requiredLevelCap} or higher`}>Lvl {team.requiredLevelCap}</span>}
                {team.isDoubleBattle && <span className="double-battle-badge">2v2</span>}
              </div>
              <div className="trainer-list-meta">
                Trainer: {trainerName(team.trainerId)} · {team.mons.length}/6 Pokemon
              </div>
            </div>
            <button onClick={() => setSelectedTeamId(team.id)}>Edit Roster</button>
            <button onClick={() => void deleteTeam(team.id)}>Delete</button>
          </div>
        ))}
        {teams && teams.length === 0 && <p className="box-empty-hint">No premade teams yet.</p>}
        {teams && teams.length > 0 && visible.length === 0 && (
          <p className="box-empty-hint">No teams match &quot;{query}&quot;.</p>
        )}
      </div>

      {selectedTeam && (
        <PremadeTeamRoster
          team={selectedTeam}
          items={items}
          onClose={() => setSelectedTeamId(null)}
          onTeamsChange={refresh}
        />
      )}
    </div>
  )
}

export default PremadeTeamsList
