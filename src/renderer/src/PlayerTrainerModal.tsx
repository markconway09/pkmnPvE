import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { LeagueMilestone, TrainerProfile } from '../../shared/battle-types'
import { runDifficultyInfo } from '../../shared/battle-types'
import type { AchievementsState } from '../../shared/achievements'
import { titleClash, titlePerk } from '../../shared/titles'
import { TITLE_CHANGED_EVENT } from './BetSlider'
import { trainerSpriteUrl } from './trainerSprite'
import TitlePicker from './TitlePicker'
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
  // The title perks list, folded away until asked for.
  const [perksOpen, setPerksOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [profile, setProfile] = useState<TrainerProfile | null>(null)
  // The titles earned from achievements, the one shown and the ones turned off.
  const [titles, setTitles] = useState<Pick<AchievementsState, 'title' | 'titles' | 'disabled'> | null>(null)

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
      window.dispatchEvent(new Event(TITLE_CHANGED_EVENT))
      onTitleChanged?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function toggleTitle(title: string, active: boolean): Promise<void> {
    try {
      setTitles(await window.api.setTitleActive(title, active))
      window.dispatchEvent(new Event(TITLE_CHANGED_EVENT))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const earned = titles?.titles ?? []
  const isOn = (title: string): boolean => !titles?.disabled.includes(title)
  const onCount = earned.filter(isOn).length

  // What a clashing title turns off when it goes on.
  function clashNote(title: string): string | undefined {
    const clash = titleClash(title)
    if (!clash) return undefined
    if (title === clash.lead) return `Turns off ${clash.rivals.join(', ')}`
    return `Turns off ${clash.lead}`
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
          {/* The title shown beside the name - earned from achievements, just for show. */}
          <div className="trainer-card-title">
            <span>Title</span>
            <TitlePicker
              value={titles?.title ?? null}
              options={titles?.titles.map((title) => ({ title })) ?? []}
              emptyLabel="No title"
              noneLabel="None earned yet"
              onChange={(title) => void chooseTitle(title)}
            />
            <span className="trainer-card-perk-hint">Shown beside your name - just for show</span>
          </div>
        </div>
        {error && <p className="editor-error">{error}</p>}

        {/* Every earned title's perk works for good - each can be turned off here. */}
        <div className="editor-section title-perks-section">
          <button
            type="button"
            className={`title-perks-toggle${perksOpen ? ' title-perks-toggle-open' : ''}`}
            disabled={earned.length === 0}
            onClick={() => setPerksOpen((o) => !o)}
          >
            <span className="title-perks-toggle-name">Title Perks</span>
            <span className="title-perks-toggle-count">
              {earned.length === 0 ? 'Earned from achievements' : `${onCount} of ${earned.length} on`}
            </span>
            {earned.length > 0 && <span className="title-perks-toggle-action">{perksOpen ? 'Hide' : 'Show'}</span>}
            <span className="title-picker-caret" aria-hidden>
              ▾
            </span>
          </button>
          {perksOpen && (
            <div className="title-perks-list">
              {earned.map((title) => {
                const on = isOn(title)
                const note = clashNote(title)
                return (
                  <label key={title} className={`title-perk-row${on ? '' : ' title-perk-row-off'}`}>
                    <span className="title-perk-text">
                      <span className="title-perk-name">{title}</span>
                      <span className="title-perk-desc">{titlePerk(title)}</span>
                      {note && <span className="title-perk-clash">{note}</span>}
                    </span>
                    <input
                      type="checkbox"
                      className="title-perk-switch"
                      checked={on}
                      onChange={(e) => void toggleTitle(title, e.target.checked)}
                    />
                  </label>
                )
              })}
            </div>
          )}
        </div>

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
