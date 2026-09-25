import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { MAX_USERNAME_LENGTH } from '../../shared/battle-types'
import type { LeagueMilestone, TrainerProfile } from '../../shared/battle-types'
import { trainerSpriteUrl } from './trainerSprite'
import TrainerSpritePicker from './TrainerSpritePicker'
import PokedexModal from './PokedexModal'

interface Props {
  username: string
  trainerSprite: string
  onChangeTrainerSprite: (id: string) => void
  // Starts a fight against another player's saved team; rejects with why it couldn't.
  onChallengePlayer: (username: string, doubles: boolean) => Promise<void>
  onClose: () => void
}

function PlayerTrainerModal({
  username,
  trainerSprite,
  onChangeTrainerSprite,
  onChallengePlayer,
  onClose
}: Props): React.JSX.Element {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pokedexOpen, setPokedexOpen] = useState(false)
  const [opponent, setOpponent] = useState('')
  const [players, setPlayers] = useState<string[]>([])
  const [challenging, setChallenging] = useState(false)
  const [doubles, setDoubles] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [profile, setProfile] = useState<TrainerProfile | null>(null)

  useEffect(() => {
    window.api
      .getSession()
      .then((session) => setPlayers(session.players))
      .catch(() => {})
    window.api
      .getTrainerProfile()
      .then(setProfile)
      .catch(() => {})
  }, [])

  const league = profile?.league ?? []
  const countBeaten = (group: LeagueMilestone['group']): number =>
    league.filter((m) => m.group === group && m.defeated).length
  const championBeaten = countBeaten('champion') > 0

  async function challenge(): Promise<void> {
    if (challenging || !opponent.trim()) return
    setChallenging(true)
    setError(null)
    try {
      await onChallengePlayer(opponent, doubles)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setChallenging(false)
    }
  }

  return createPortal(
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-panel player-trainer-modal" onMouseDown={(e) => e.stopPropagation()}>
        <h2>{username}</h2>
        <button className="trainer-sprite-current" onClick={() => setPickerOpen(true)}>
          <img className="trainer-sprite-current-img" src={trainerSpriteUrl(trainerSprite)} alt={trainerSprite} />
          <div className="trainer-sprite-current-info">
            <span>{trainerSprite}</span>
            <span className="trainer-sprite-change-hint">Click to change</span>
          </div>
        </button>
        <button className="pokedex-button" onClick={() => setPokedexOpen(true)}>
          Pokédex
        </button>

        {profile && (
          <div className="editor-section">
            <h3>Road to the League</h3>
            <div className="league-bar">
              {league.map((m, i) => (
                <div
                  key={i}
                  className={`league-notch league-notch-${m.group}${m.defeated ? ' league-notch-done' : ''}`}
                  title={`${m.label}${m.defeated ? ' - defeated' : m.defeated === null ? ' - not in the trainer list' : ' - not yet'}`}
                >
                  <div className="league-notch-fill" />
                  <img className="league-notch-sprite" src={trainerSpriteUrl(m.spriteId)} alt={m.label} />
                </div>
              ))}
            </div>
            <p className="league-summary">
              Badges {countBeaten('gym')}/8 · Elite Four {countBeaten('eliteFour')}/4 · Champion{' '}
              {championBeaten ? '🏆' : '—'}
            </p>
          </div>
        )}

        {profile && (
          <div className="editor-section">
            <h3>Statistics</h3>
            <div className="profile-stats">
              <div className="profile-stat">
                <span className="profile-stat-value">{profile.stats.trainersDefeated.toLocaleString('en-US')}</span>
                <span className="profile-stat-label">Trainers defeated</span>
              </div>
              <div className="profile-stat">
                <span className="profile-stat-value">{profile.stats.bossesDefeated.toLocaleString('en-US')}</span>
                <span className="profile-stat-label">Bosses defeated</span>
              </div>
              <div className="profile-stat">
                <span className="profile-stat-value">{profile.stats.wildDefeated.toLocaleString('en-US')}</span>
                <span className="profile-stat-label">Wild Pokémon defeated</span>
              </div>
              <div className="profile-stat">
                <span className="profile-stat-value">{profile.stats.wildCaught.toLocaleString('en-US')}</span>
                <span className="profile-stat-label">Wild Pokémon caught</span>
              </div>
              <div className="profile-stat">
                <span className="profile-stat-value">{profile.stats.bestFloor || '—'}</span>
                <span className="profile-stat-label">Roguelite best floor</span>
              </div>
            </div>
          </div>
        )}

        <div className="editor-section">
          <h3>Challenge a player</h3>
          <p className="editor-hint">
            Fight the team another player on this computer last saved. It&apos;s a friendly match: their whole team is
            set to the level of your highest-level Pokemon, and there are no exp, money or item drops.
          </p>
          <form
            className="trainer-add-row challenge-row"
            onSubmit={(e) => {
              e.preventDefault()
              void challenge()
            }}
          >
            <input
              type="text"
              list="challenge-players"
              placeholder="Their username"
              value={opponent}
              maxLength={MAX_USERNAME_LENGTH}
              onChange={(e) => setOpponent(e.target.value)}
            />
            <datalist id="challenge-players">
              {players.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
            <label className="challenge-doubles">
              <input type="checkbox" checked={doubles} onChange={(e) => setDoubles(e.target.checked)} /> Double battle
            </label>
            <button type="submit" disabled={challenging || !opponent.trim()}>
              Fight
            </button>
          </form>
          {error && <p className="editor-error">{error}</p>}
        </div>

        <div className="editor-actions">
          <button onClick={onClose}>Close</button>
        </div>
      </div>

      {pokedexOpen && <PokedexModal onClose={() => setPokedexOpen(false)} />}

      {pickerOpen && (
        <TrainerSpritePicker
          value={trainerSprite}
          onChange={onChangeTrainerSprite}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>,
    document.body
  )
}

export default PlayerTrainerModal
