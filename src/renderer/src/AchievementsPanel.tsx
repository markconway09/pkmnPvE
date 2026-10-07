import { useEffect, useRef, useState } from 'react'
import type { ItemOptionEntry } from '../../shared/battle-types'
import type { AchievementsState, AchievementView } from '../../shared/achievements'
import { ACHIEVEMENT_CATEGORIES } from '../../shared/achievements'
import ItemSprite from './ItemSprite'
import SpriteImage from './SpriteImage'
import ShinyIcon from './ShinyIcon'
import { toSpriteId } from '../../shared/battle-types'
import { formatMoney } from './money'
import { errorMessage, pointOf, useFloatingNotes } from './FloatingNotes'
import CoinIcon from './CoinIcon'
import { titlePerk } from '../../shared/titles'

type Show = 'unlocked' | 'locked' | 'all'

interface Props {
  state: AchievementsState
  onChange: (state: AchievementsState) => void
  // A reward was claimed - the money and box may have changed.
  onClaimed: (money: number) => void
  // An achievement (by name) to scroll to and flash - from a clicked pop-up.
  focus?: string | null
  onFocused?: () => void
}

/** The Achievements tab: progress on each, and a Claim button for every one unlocked. */
function AchievementsPanel({ state, onChange, onClaimed, focus, onFocused }: Props): React.JSX.Element {
  const [items, setItems] = useState<Map<string, ItemOptionEntry>>(new Map())
  const [busy, setBusy] = useState(false)
  const [show, setShow] = useState<Show>('all')
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
  const total = state.achievements.length
  const shown = state.achievements.filter((a) => (show === 'all' ? true : show === 'unlocked' ? a.unlocked : !a.unlocked))

  const panelRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  // The category whose heading was last scrolled past - lit in the button row.
  const [current, setCurrent] = useState<string>(ACHIEVEMENT_CATEGORIES[0])
  // Whether a reward to claim is on screen right now - the floating Claim button hides then.
  const [claimableInView, setClaimableInView] = useState(false)

  // Where a category's heading sits in the scroll, just under the sticky button row.
  function sectionTop(category: string): number | null {
    const panel = panelRef.current
    const section = panel?.querySelector<HTMLElement>(`[data-category="${category}"]`)
    if (!panel || !section) return null
    const barHeight = barRef.current?.offsetHeight ?? 0
    return panel.scrollTop + section.getBoundingClientRect().top - panel.getBoundingClientRect().top - barHeight
  }

  function goToCategory(category: string): void {
    const top = sectionTop(category)
    if (top === null) return
    panelRef.current?.scrollTo({ top, behavior: 'smooth' })
  }

  // On scroll: light the category being read, and check whether a claimable card is visible.
  function onScroll(): void {
    const panel = panelRef.current
    if (!panel) return
    let reading: string = ACHIEVEMENT_CATEGORIES[0]
    for (const category of ACHIEVEMENT_CATEGORIES) {
      const top = sectionTop(category)
      if (top !== null && top <= panel.scrollTop + 4) reading = category
    }
    setCurrent(reading)
    const view = panel.getBoundingClientRect()
    const viewTop = view.top + (barRef.current?.offsetHeight ?? 0)
    const visible = Array.from(panel.querySelectorAll<HTMLElement>('.achievement-claimable')).some((el) => {
      const r = el.getBoundingClientRect()
      return r.bottom > viewTop && r.top < view.bottom
    })
    setClaimableInView(visible)
  }
  useEffect(onScroll, [state, show])

  // Scroll to the first reward waiting to be claimed (showing locked ones too if needed), and flash it.
  // The card to flash next, as a selector - set, then scrolled to once it's on the page.
  const [flashTarget, setFlashTarget] = useState<string | null>(null)
  function goToFirstClaimable(): void {
    if (unclaimed === 0) return
    if (show === 'locked') setShow('all')
    setFlashTarget('.achievement-claimable')
  }
  // A clicked pop-up: go to that achievement, showing all if the filter hides it.
  useEffect(() => {
    if (!focus) return
    const target = state.achievements.find((a) => a.name === focus)
    if (!target) return
    onFocused?.()
    if (show !== 'all' && (show === 'unlocked') !== target.unlocked) setShow('all')
    setFlashTarget(`[data-achievement="${CSS.escape(target.id)}"]`)
  }, [focus, state])
  useEffect(() => {
    if (!flashTarget) return
    setFlashTarget(null)
    const el = panelRef.current?.querySelector<HTMLElement>(flashTarget)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.remove('achievement-flash')
    void el.offsetWidth
    el.classList.add('achievement-flash')
  }, [flashTarget])

  function renderCard(a: AchievementView): React.JSX.Element {
    // A secret achievement says nothing about itself until it's unlocked.
    const secret = a.category === 'Secret' && !a.unlocked
    const claimable = a.unlocked && !a.claimed
    return (
      <div
        key={a.id}
        data-achievement={a.id}
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
              <div
                className="mission-progress-fill"
                style={{
                  width: `${(Math.min(a.progress, a.goal) / a.goal) * 100}%`
                }}
              />
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
              {(a.reward.pokemon ?? []).map(({ species, level, shiny }) => (
                <li key={`mon-${species}`} className="achievement-reward-mon" title="A gift Pokemon - sent to the box">
                  <span className="mission-reward-icon">
                    <SpriteImage style="2d-static" spriteId={toSpriteId(species)} shiny={shiny} alt={species} draggable={false} />
                  </span>
                  <span className="mission-reward-name">
                    {species} {level && <span className="achievement-reward-mon-level">Lv. {level}</span>}
                  </span>
                  {shiny ? <ShinyIcon /> : <span className="achievement-reward-tag">Pokémon</span>}
                </li>
              ))}
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
                  title={titlePerk(a.reward.title)}
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
            <button
              className={claimable ? 'mission-claim' : undefined}
              disabled={!a.unlocked || busy}
              onClick={(e) => void claim(e, a)}
            >
              {a.unlocked ? 'Claim reward' : 'Locked'}
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div ref={panelRef} className="rewards-scroll achievements-view" onScroll={onScroll}>
      {/* Everything at a glance: how many are unlocked, and every reward waiting at once. */}
      <div className="missions-summary achievements-summary">
        <div className="missions-summary-count">
          <strong>{done}</strong>
          <span>/ {total} unlocked</span>
        </div>
        <div className="achievements-summary-bar">
          <div style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }} />
        </div>
        {/* Unlocked, still locked, or every one - like the TMs window. */}
        <span className="tms-filter">
          {(['unlocked', 'locked', 'all'] as Show[]).map((s) => (
            <button key={s} className={show === s ? 'tms-filter-on' : undefined} onClick={() => setShow(s)}>
              {s === 'unlocked' ? 'Unlocked' : s === 'locked' ? 'Locked' : 'All'}
            </button>
          ))}
        </span>
        {unclaimed > 0 && (
          <button className="achievements-claim-all" disabled={busy} onClick={(e) => void claimAll(e)}>
            Claim all ({unclaimed})
          </button>
        )}
      </div>

      {/* One button per category - it scrolls down to that category, and glows while it holds a reward to claim. */}
      <div ref={barRef} className="achievements-tabs-bar">
        <span className="tms-filter achievements-categories">
          {ACHIEVEMENT_CATEGORIES.map((category) => {
            const inCategory = state.achievements.filter((a) => a.category === category)
            const got = inCategory.filter((a) => a.unlocked).length
            const waiting = waitingIn(category)
            const complete = inCategory.length > 0 && got === inCategory.length
            return (
              <button
                key={category}
                className={`${current === category ? 'tms-filter-on' : ''}${waiting > 0 ? ' achievements-category-glow' : ''}${complete ? ' achievements-category-complete' : ''}`}
                title={waiting > 0 ? `${waiting} reward${waiting === 1 ? '' : 's'} to claim` : undefined}
                disabled={!shown.some((a) => a.category === category)}
                onClick={() => goToCategory(category)}
              >
                {category}
                <span className="achievements-tab-count">{complete ? '★' : `${got}/${inCategory.length}`}</span>
                {waiting > 0 && <span className="achievements-tab-badge">{waiting}</span>}
              </button>
            )
          })}
        </span>
        {/* Floats under the buttons while there's a reward waiting that isn't on screen. */}
        {unclaimed > 0 && !claimableInView && (
          <div className="achievements-goto-float">
            <button className="achievements-goto" onClick={goToFirstClaimable} title="Go to the first reward to claim">
              Claim ↓
            </button>
          </div>
        )}
      </div>

      {/* Every category on the one page, each under its heading, cards two to a row. */}
      {shown.length === 0 && <p className="achievements-empty">{show === 'unlocked' ? 'None unlocked yet.' : 'All unlocked!'}</p>}
      {ACHIEVEMENT_CATEGORIES.map((category) => {
        const inCategory = shown.filter((a) => a.category === category)
        if (inCategory.length === 0) return null
        return (
          <section key={category} data-category={category} className="achievements-section">
            <h3 className="shop-category-heading achievements-section-heading">{category}</h3>
            <div className="achievement-grid">{inCategory.map(renderCard)}</div>
          </section>
        )
      })}

      {notes.layer}
    </div>
  )
}

export default AchievementsPanel
