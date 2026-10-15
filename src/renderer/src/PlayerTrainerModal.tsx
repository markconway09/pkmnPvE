import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { LeagueMilestone, TrainerProfile } from '../../shared/battle-types'
import { runDifficultyInfo } from '../../shared/battle-types'
import type { AchievementsState } from '../../shared/achievements'
import { titleClash, titlePerk, type Title } from '../../shared/titles'
import { TITLE_CHANGED_EVENT } from './BetSlider'
import { trainerSpriteUrl } from './trainerSprite'
import TitlePicker from './TitlePicker'
import TrainerSpritePicker from './TrainerSpritePicker'
import RarityCard from './RarityCard'
import { clickWord, numberLocale, t, titleName, titlePerkText } from './i18n'

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
  const [titles, setTitles] = useState<Pick<AchievementsState, 'title' | 'titles' | 'disabled' | 'dexComplete'> | null>(null)

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
    if (title === clash.lead) return t('card.turnsOff', { names: clash.rivals.map(titleName).join(', ') })
    return t('card.turnsOff', { names: titleName(clash.lead) })
  }

  const league = profile?.league ?? []
  const countBeaten = (group: LeagueMilestone['group']): number =>
    league.filter((m) => m.group === group && m.defeated).length
  const championBeaten = countBeaten('champion') > 0

  return createPortal(
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-panel player-trainer-modal" onMouseDown={(e) => e.stopPropagation()}>
        {/* A full Pokedex puts the name in a gold card. */}
        {titles?.dexComplete ? (
          <RarityCard tier="legendary" framed className="trainer-card-name-gold" title={t('card.dexComplete')}>
            <h2>{username}</h2>
            <span className="trainer-card-name-badge">{t('card.dexCompleteBadge')}</span>
          </RarityCard>
        ) : (
          <h2>{username}</h2>
        )}
        <div className="trainer-card-row">
          <button className="trainer-sprite-current" onClick={() => setPickerOpen(true)}>
            <img className="trainer-sprite-current-img" src={trainerSpriteUrl(trainerSprite)} alt={trainerSprite} />
            <div className="trainer-sprite-current-info">
              <span>{trainerSprite}</span>
              <span className="trainer-sprite-change-hint">{t('card.toChange', { click: clickWord() })}</span>
            </div>
          </button>
          {/* The title shown beside the name - earned from achievements, just for show. */}
          <div className="trainer-card-title">
            <span>{t('card.title')}</span>
            <TitlePicker
              value={titles?.title ?? null}
              options={titles?.titles.map((title) => ({ title })) ?? []}
              emptyLabel={t('card.noTitle')}
              noneLabel={t('card.noneEarned')}
              onChange={(title) => void chooseTitle(title)}
            />
            <span className="trainer-card-perk-hint">{t('card.titleHint')}</span>
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
            <span className="title-perks-toggle-name">{t('card.perks')}</span>
            <span className="title-perks-toggle-count">
              {earned.length === 0 ? t('card.perksEarned') : t('card.perksOn', { on: onCount, n: earned.length })}
            </span>
            {earned.length > 0 && <span className="title-perks-toggle-action">{perksOpen ? t('card.hide') : t('card.show')}</span>}
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
                      <span className="title-perk-name">{titleName(title)}</span>
                      <span className="title-perk-desc">{titlePerkText(title as Title, titlePerk(title))}</span>
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
            <h3>{t('card.league')}</h3>
            <div className="league-bar">
              {league.map((m, i) => (
                <div
                  key={i}
                  className={`league-notch league-notch-${m.group}${m.defeated ? ' league-notch-done' : ''}`}
                  title={t(m.defeated ? 'card.defeated' : m.defeated === null ? 'card.notListed' : 'card.notYet', { label: m.label })}
                >
                  <div className="league-notch-fill" />
                  <img className="league-notch-sprite" src={trainerSpriteUrl(m.spriteId)} alt={m.label} />
                </div>
              ))}
            </div>
            <p className="league-summary">
              {t('card.leagueSummary', {
                gym: countBeaten('gym'),
                elite: countBeaten('eliteFour'),
                champion: championBeaten ? '🏆' : '—'
              })}
            </p>
          </div>
        )}

        {profile && (
          <div className="editor-section">
            <h3>{t('card.stats')}</h3>
            <div className="profile-stats">
              <div className="profile-stat">
                <span className="profile-stat-value">{profile.stats.trainersDefeated.toLocaleString(numberLocale())}</span>
                <span className="profile-stat-label">{t('card.trainers')}</span>
              </div>
              <div className="profile-stat">
                <span className="profile-stat-value">{profile.stats.bossesDefeated.toLocaleString(numberLocale())}</span>
                <span className="profile-stat-label">{t('card.bosses')}</span>
              </div>
              <div className="profile-stat">
                <span className="profile-stat-value">{profile.stats.wildDefeated.toLocaleString(numberLocale())}</span>
                <span className="profile-stat-label">{t('card.wildDefeated')}</span>
              </div>
              <div className="profile-stat">
                <span className="profile-stat-value">{profile.stats.wildCaught.toLocaleString(numberLocale())}</span>
                <span className="profile-stat-label">{t('card.wildCaught')}</span>
              </div>
              <div className="profile-stat">
                <span className="profile-stat-value">{profile.stats.raidsWon.toLocaleString(numberLocale())}</span>
                <span className="profile-stat-label">{t('card.raids')}</span>
              </div>
              <div className="profile-stat">
                <span className="profile-stat-value">
                  {profile.stats.bestFloor || '—'}
                  {profile.stats.bestFloor && profile.stats.bestFloorDifficulty
                    ? ` (${runDifficultyInfo(profile.stats.bestFloorDifficulty).label})`
                    : ''}
                </span>
                <span className="profile-stat-label">{t('card.bestFloor')}</span>
              </div>
            </div>
          </div>
        )}

        <div className="editor-actions">
          <button onClick={onClose}>{t('common.close')}</button>
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
