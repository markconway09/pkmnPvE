import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ItemOptionEntry } from '../../shared/battle-types'
import type { AchievementsState, AchievementView } from '../../shared/achievements'
import { ACHIEVEMENT_CATEGORIES } from '../../shared/achievements'
import ItemSprite from './ItemSprite'
import { formatMoney } from './money'
import { errorMessage, pointOf, useFloatingNotes } from './FloatingNotes'
import CoinIcon from './CoinIcon'

interface Props {
  state: AchievementsState
  onChange: (state: AchievementsState) => void
  // A reward was claimed - the money and box may have changed.
  onClaimed: (money: number) => void
  onClose: () => void
}

/** The Achievements list: progress on each, and a Claim button for every one unlocked. */
function AchievementsModal({ state, onChange, onClaimed, onClose }: Props): React.JSX.Element {
  const [items, setItems] = useState<Map<string, ItemOptionEntry>>(new Map())
  const [busy, setBusy] = useState(false)
  const notes = useFloatingNotes()

  useEffect(() => {
    window.api
      .getEditorOptions()
      .then((options) => setItems(new Map(options.items.map((i) => [i.id, i]))))
      .catch(() => {})
  }, [])

  async function claim(e: React.MouseEvent, achievement: AchievementView): Promise<void> {
    const at = pointOf(e)
    setBusy(true)
    try {
      const result = await window.api.claimAchievement(achievement.id)
      onChange(result.state)
      onClaimed(result.money)
      notes.show(`Got ${result.rewardText}`, at)
    } catch (err) {
      notes.show(errorMessage(err), at, 'bad')
    } finally {
      setBusy(false)
    }
  }

  // Every unlocked reward at once, one after another.
  async function claimAll(e: React.MouseEvent): Promise<void> {
    const at = pointOf(e)
    const waiting = state.achievements.filter((a) => a.unlocked && !a.claimed)
    setBusy(true)
    try {
      for (const achievement of waiting) {
        const result = await window.api.claimAchievement(achievement.id)
        onChange(result.state)
        onClaimed(result.money)
      }
      notes.show(`Claimed ${waiting.length} reward${waiting.length === 1 ? '' : 's'}`, at)
    } catch (err) {
      notes.show(errorMessage(err), at, 'bad')
    } finally {
      setBusy(false)
    }
  }

  async function chooseTitle(title: string | null): Promise<void> {
    try {
      onChange(await window.api.setAchievementTitle(title))
    } catch {
      // The list shows only earned titles, so this can't really fail.
    }
  }

  const done = state.achievements.filter((a) => a.unlocked).length
  const unclaimed = state.achievements.filter((a) => a.unlocked && !a.claimed).length
  return createPortal(
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-panel achievements-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="shop-header">
          <h2>Achievements</h2>
          {unclaimed > 0 && (
            <button className="achievements-claim-all" disabled={busy} onClick={(e) => void claimAll(e)}>
              Claim all ({unclaimed})
            </button>
          )}
          <span className="achievements-count">
            {done} / {state.achievements.length}
          </span>
          <label className="achievements-title-pick" title="A title to show beside your name">
            Title
            <select
              value={state.title ?? ''}
              disabled={state.titles.length === 0}
              onChange={(e) => void chooseTitle(e.target.value || null)}
            >
              <option value="">{state.titles.length === 0 ? 'None earned yet' : 'No title'}</option>
              {state.titles.map((title) => (
                <option key={title} value={title}>
                  {title}
                </option>
              ))}
            </select>
          </label>
        </div>

        {ACHIEVEMENT_CATEGORIES.map((category) => (
          <section key={category}>
            <h3 className="shop-category-heading">{category}</h3>
            <div className="achievement-list">
              {state.achievements
                .filter((a) => a.category === category)
                .map((a) => {
                  // A secret achievement says nothing about itself until it's unlocked.
                  const secret = a.category === 'Secret' && !a.unlocked
                  return (
                    <div
                      key={a.id}
                      className={`achievement${a.unlocked ? ' achievement-unlocked' : ''}${a.claimed ? ' achievement-claimed' : ''}`}
                    >
                      <span className="achievement-icon">{a.unlocked ? '🏆' : secret ? '❔' : '🔒'}</span>
                      <div className="achievement-body">
                        <span className="achievement-name">{secret ? '???' : a.name}</span>
                        <span className="achievement-desc">{secret ? 'A secret achievement' : a.description}</span>
                        {!secret && !a.unlocked && a.goal > 1 && (
                          <div
                            className="achievement-progress"
                            title={`${a.progress.toLocaleString('en-US')} / ${a.goal.toLocaleString('en-US')}`}
                          >
                            <div
                              className="achievement-progress-fill"
                              style={{ width: `${(a.progress / a.goal) * 100}%` }}
                            />
                            <span>
                              {a.progress.toLocaleString('en-US')} / {a.goal.toLocaleString('en-US')}
                            </span>
                          </div>
                        )}
                      </div>
                      {!secret && (
                        <div className="achievement-reward">
                          {(a.reward.keyItems ?? []).map((keyItem) => {
                            const item = items.get(keyItem)
                            return (
                              <span
                                key={keyItem}
                                className="achievement-reward-chip achievement-reward-key"
                                title={`Key item: ${item?.name ?? keyItem}`}
                              >
                                {item && <ItemSprite spritenum={item.spritenum} />}
                                {item?.name ?? keyItem}
                              </span>
                            )
                          })}
                          {(a.reward.items ?? []).map(({ itemId, count }) => {
                            const item = items.get(itemId)
                            return (
                              <span key={itemId} className="achievement-reward-chip" title={item?.name ?? itemId}>
                                {item && <ItemSprite spritenum={item.spritenum} />}
                                {count > 1 && `×${count}`}
                              </span>
                            )
                          })}
                          {!!a.reward.money && (
                            <span className="achievement-reward-chip">{formatMoney(a.reward.money)}</span>
                          )}
                          {!!a.reward.coins && (
                            <span className="achievement-reward-chip">
                              <CoinIcon /> {a.reward.coins.toLocaleString('en-US')}</span>
                          )}
                          {a.reward.title && (
                            <span
                              className="achievement-reward-chip achievement-reward-title"
                              title="A title to show beside your name"
                            >
                              “{a.reward.title}”
                            </span>
                          )}
                        </div>
                      )}
                      <div className="achievement-action">
                        {a.claimed ? (
                          <span className="achievement-done">✓ Claimed</span>
                        ) : (
                          <button disabled={!a.unlocked || busy} onClick={(e) => void claim(e, a)}>
                            Claim
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
            </div>
          </section>
        ))}

        <div className="editor-actions">
          <button onClick={onClose}>Close</button>
        </div>
        {notes.layer}
      </div>
    </div>,
    document.body
  )
}

export default AchievementsModal
