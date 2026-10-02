import { useEffect, useRef, useState } from 'react'
import type { ItemOptionEntry } from '../../shared/battle-types'
import type { AchievementsState, AchievementView } from '../../shared/achievements'
import { ACHIEVEMENT_CATEGORIES } from '../../shared/achievements'
import ItemSprite from './ItemSprite'
import { formatMoney } from './money'
import { errorMessage, pointOf, useFloatingNotes } from './FloatingNotes'
import CoinIcon from './CoinIcon'
import { titlePerk } from '../../shared/titles'
import TabStrip from './TabStrip'

interface Props {
  state: AchievementsState
  onChange: (state: AchievementsState) => void
  // A reward was claimed - the money and box may have changed.
  onClaimed: (money: number) => void
}

/** The Achievements tab: progress on each, and a Claim button for every one unlocked. */
function AchievementsPanel({ state, onChange, onClaimed }: Props): React.JSX.Element {
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

  const done = state.achievements.filter((a) => a.unlocked).length
  const unclaimed = state.achievements.filter((a) => a.unlocked && !a.claimed).length
  const waitingIn = (category: string): number =>
    state.achievements.filter((a) => a.category === category && a.unlocked && !a.claimed).length

  // Opens on the first category with a reward waiting, else the first one.
  const [tab, setTab] = useState(
    () => ACHIEVEMENT_CATEGORIES.find((c) => waitingIn(c) > 0) ?? ACHIEVEMENT_CATEGORIES[0]
  )
  const panelRef = useRef<HTMLDivElement>(null)

  function openTab(category: (typeof ACHIEVEMENT_CATEGORIES)[number]): void {
    setTab(category)
    panelRef.current?.scrollTo({ top: 0 })
  }

  // Scroll to the first reward waiting to be claimed (switching tab if needed), and flash it.
  const [flashPending, setFlashPending] = useState(false)
  function goToFirstClaimable(): void {
    const target = waitingIn(tab) > 0 ? tab : ACHIEVEMENT_CATEGORIES.find((c) => waitingIn(c) > 0)
    if (!target) return
    setTab(target)
    setFlashPending(true)
  }
  useEffect(() => {
    if (!flashPending) return
    setFlashPending(false)
    const el = panelRef.current?.querySelector<HTMLElement>('.achievement-claimable')
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.remove('achievement-flash')
    void el.offsetWidth
    el.classList.add('achievement-flash')
  }, [flashPending, tab])
  const total = state.achievements.length
  return (
    <div ref={panelRef} className="rewards-scroll achievements-view">
      {/* Everything at a glance: how many are unlocked, and every reward waiting at once. */}
      <div className="missions-summary achievements-summary">
        <div className="missions-summary-count">
          <strong>{done}</strong>
          <span>/ {total} unlocked</span>
        </div>
        <div className="achievements-summary-bar">
          <div style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }} />
        </div>
        {unclaimed > 0 && (
          <button className="achievements-claim-all" disabled={busy} onClick={(e) => void claimAll(e)}>
            Claim all ({unclaimed})
          </button>
        )}
      </div>

      {/* One tab per category; a tab glows while it holds a reward waiting to be claimed. */}
      <div className="achievements-tabs-bar">
        <TabStrip
          className="achievements-tabs"
          current={tab}
          onSwitch={openTab}
          tabs={ACHIEVEMENT_CATEGORIES.map((category) => {
            const inCategory = state.achievements.filter((a) => a.category === category)
            const got = inCategory.filter((a) => a.unlocked).length
            const waiting = waitingIn(category)
            const complete = inCategory.length > 0 && got === inCategory.length
            return {
              id: category,
              title: waiting > 0 ? `${waiting} reward${waiting === 1 ? '' : 's'} to claim` : undefined,
              className: `${waiting > 0 ? 'achievements-tab-glow' : ''}${complete ? ' achievements-tab-complete' : ''}`,
              label: (
                <>
                  <span className="achievements-tab-name">{category}</span>
                  <span className="achievements-tab-count">{complete ? '★' : `${got}/${inCategory.length}`}</span>
                  {waiting > 0 && <span className="achievements-tab-badge">{waiting}</span>}
                </>
              )
            }
          })}
        />
        {/* Floats under the tabs while there's a reward waiting. */}
        {unclaimed > 0 && (
          <div className="achievements-goto-float">
            <button className="achievements-goto" onClick={goToFirstClaimable} title="Go to the first reward to claim">
              Claim ↓
            </button>
          </div>
        )}
      </div>

      {/* The open category's achievements, two cards to a row. */}
      <div className="achievement-grid">
        {state.achievements
          .filter((a) => a.category === tab)
          .map((a) => {
            // A secret achievement says nothing about itself until it's unlocked.
            const secret = a.category === 'Secret' && !a.unlocked
            const claimable = a.unlocked && !a.claimed
            return (
              <div
                key={a.id}
                className={`achievement${a.unlocked ? ' achievement-unlocked' : ' achievement-locked'}${a.claimed ? ' achievement-claimed' : ''}${claimable ? ' achievement-claimable' : ''}`}
              >
                <div className="achievement-head">
                  <span className="achievement-icon">{a.unlocked ? '🏆' : secret ? '❔' : '🔒'}</span>
                  <div className="achievement-titles">
                    <span className="achievement-name">{secret ? '???' : a.name}</span>
                    <span className="achievement-desc">{secret ? 'A secret achievement' : a.description}</span>
                  </div>
                </div>

                {!secret && !a.unlocked && a.goal > 1 && (
                  <div className="mission-progress achievement-progress">
                    <div className="mission-progress-count">
                      <strong>{Math.min(a.progress, a.goal).toLocaleString('en-US')}</strong> / {a.goal.toLocaleString('en-US')}
                      <span className="mission-progress-state">{Math.floor((Math.min(a.progress, a.goal) / a.goal) * 100)}%</span>
                    </div>
                    <div className="mission-progress-bar">
                      <div className="mission-progress-fill" style={{ width: `${(Math.min(a.progress, a.goal) / a.goal) * 100}%` }} />
                    </div>
                  </div>
                )}

                {!secret && (
                  <div className="achievement-rewards">
                    <span className="mission-col-label">Reward</span>
                    <ul className="mission-reward-list">
                      {(a.reward.keyItems ?? []).map((keyItem) => {
                        const item = items.get(keyItem)
                        return (
                          <li key={keyItem} className="achievement-reward-key" title="A key item - kept for good">
                            <span className="mission-reward-icon">{item && <ItemSprite spritenum={item.spritenum} />}</span>
                            <span className="mission-reward-name">{item?.name ?? keyItem}</span>
                            <span className="achievement-reward-tag">Key item</span>
                          </li>
                        )
                      })}
                      {(a.reward.items ?? []).map(({ itemId, count }) => {
                        const item = items.get(itemId)
                        return (
                          <li key={itemId}>
                            <span className="mission-reward-icon">{item && <ItemSprite spritenum={item.spritenum} />}</span>
                            <span className="mission-reward-name">{item?.name ?? itemId}</span>
                            {count > 1 && <span className="mission-reward-count">×{count}</span>}
                          </li>
                        )
                      })}
                      {!!a.reward.money && (
                        <li className="mission-reward-money">
                          <span className="mission-reward-icon">₽</span>
                          <span className="mission-reward-name">{formatMoney(a.reward.money)}</span>
                        </li>
                      )}
                      {!!a.reward.coins && (
                        <li className="mission-reward-coins">
                          <span className="mission-reward-icon">
                            <CoinIcon />
                          </span>
                          <span className="mission-reward-name">{a.reward.coins.toLocaleString('en-US')} coins</span>
                        </li>
                      )}
                      {a.reward.title && (
                        <li
                          className="achievement-reward-title-line"
                          title={`A title to show beside your name - while it's shown: ${titlePerk(a.reward.title)}`}
                        >
                          <span className="mission-reward-icon">“”</span>
                          <span className="mission-reward-name">“{a.reward.title}”</span>
                          <span className="achievement-reward-tag">Title</span>
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                <div className="achievement-action">
                  {a.claimed ? (
                    <span className="mission-col-done">✓ Claimed</span>
                  ) : (
                    <button className={claimable ? 'mission-claim' : undefined} disabled={!a.unlocked || busy} onClick={(e) => void claim(e, a)}>
                      {a.unlocked ? 'Claim reward' : 'Locked'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
      </div>

      {notes.layer}
    </div>
  )
}

export default AchievementsPanel
