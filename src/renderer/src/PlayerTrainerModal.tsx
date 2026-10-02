import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { LeagueMilestone, TrainerProfile } from '../../shared/battle-types'
import { runDifficultyInfo } from '../../shared/battle-types'
import type { AchievementsState } from '../../shared/achievements'
import { titlePerk } from '../../shared/titles'
import { trainerSpriteUrl } from './trainerSprite'
import TrainerSpritePicker from './TrainerSpritePicker'

interface Props {
  username: string
  trainerSprite: string
  onChangeTrainerSprite: (id: string) => void
  // The title changed here - the menu bar shows it too.
  onTitleChanged?: () => void
  onClose: () => void
}

/**
 * The Trainer Card: the player's sprite and title, the road to the League and their
 * statistics. (The Pokedex and challenging a player open from the player menu.)
 */
function PlayerTrainerModal({
  username,
  trainerSprite,
  onChangeTrainerSprite,
  onTitleChanged,
  onClose
}: Props): React.JSX.Element {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [profile, setProfile] = useState<TrainerProfile | null>(null)
  // The titles earned from achievements, and the one shown.
  const [titles, setTitles] = useState<Pick<AchievementsState, 'title' | 'titles'> | null>(null)

  useEffect(() => {
    window.api
      .getTrainerProfile()
      .then(setProfile)
      .catch(() => {})
    window.api
      .getAchievements()
      .then(setTitles)
      .catch(() => {})
  }, [])

  async function chooseTitle(title: string | null): Promise<void> {
    try {
      setTitles(await window.api.setAchievementTitle(title))
      onTitleChanged?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const league = profile?.league ?? []
  const countBeaten = (group: LeagueMilestone['group']): number =>
    league.filter((m) => m.group === group && m.defeated).length
  const championBeaten = countBeaten('champion') > 0

  return createPortal(
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-panel player-trainer-modal" onMouseDown={(e) => e.stopPropagation()}>
        <h2>{username}</h2>
        <div className="trainer-card-row">
          <button className="trainer-sprite-current" onClick={() => setPickerOpen(true)}>
            <img className="trainer-sprite-current-img" src={trainerSpriteUrl(trainerSprite)} alt={trainerSprite} />
            <div className="trainer-sprite-current-info">
              <span>{trainerSprite}</span>
              <span className="trainer-sprite-change-hint">Click to change</span>
            </div>
          </button>
          {/* The title shown beside the name - earned from achievements. */}
          <label className="trainer-card-title">
            <span>Title</span>
            <select
              value={titles?.title ?? ''}
              disabled={!titles || titles.titles.length === 0}
              onChange={(e) => void chooseTitle(e.target.value || null)}
            >
              <option value="">{titles && titles.titles.length === 0 ? 'None earned yet' : 'No title'}</option>
              {titles?.titles.map((title) => (
                <option key={title} value={title}>
                  {title}
                </option>
              ))}
            </select>
            {/* What the shown title does - only that one's perk is active. */}
            <span className="trainer-card-perk">
              {titles?.title ? titlePerk(titles.title) : 'Earned from achievements - each one has a perk'}
            </span>
          </label>
        </div>
        {error && <p className="editor-error">{error}</p>}

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
                <span className="profile-stat-value">{profile.stats.raidsWon.toLocaleString('en-US')}</span>
                <span className="profile-stat-label">Max Raids won</span>
              </div>
              <div className="profile-stat">
                <span className="profile-stat-value">
                  {profile.stats.bestFloor || '—'}
                  {profile.stats.bestFloor && profile.stats.bestFloorDifficulty
                    ? ` (${runDifficultyInfo(profile.stats.bestFloorDifficulty).label})`
                    : ''}
                </span>
                <span className="profile-stat-label">Roguelite best floor</span>
              </div>
            </div>
          </div>
        )}

        <div className="editor-actions">
          <button onClick={onClose}>Close</button>
        </div>
      </div>

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
