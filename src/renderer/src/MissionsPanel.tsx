import { useEffect, useState } from 'react'
import type { ItemOptionEntry } from '../../shared/battle-types'
import type { MissionReward, MissionsState, MissionTier } from '../../shared/missions'
import ItemSprite from './ItemSprite'
import CoinIcon from './CoinIcon'
import { formatMoney } from './money'
import { errorMessage, pointOf, useFloatingNotes } from './FloatingNotes'
import type { NotePoint } from './FloatingNotes'

interface Props {
  state: MissionsState
  onChange: (state: MissionsState) => void
  // A reward was claimed - the money and bag may have changed.
  onClaimed: (money: number) => void
}

const TIER_LABELS: Record<MissionTier, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }

function countdown(ms: number): string {
  const minutes = Math.max(0, Math.ceil(ms / 60000))
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

// A reward as a list: each item's picture, name and count, then the money and coins.
function RewardList({ reward, items }: { reward: MissionReward; items: Map<string, ItemOptionEntry> }): React.JSX.Element {
  return (
    <ul className="mission-reward-list">
      {(reward.items ?? []).map(({ itemId, count }) => {
        const item = items.get(itemId)
        return (
          <li key={itemId}>
            <span className="mission-reward-icon">{item && <ItemSprite spritenum={item.spritenum} />}</span>
            <span className="mission-reward-name">{item?.name ?? itemId}</span>
            {count > 1 && <span className="mission-reward-count">×{count}</span>}
          </li>
        )
      })}
      {!!reward.money && (
        <li className="mission-reward-money">
          <span className="mission-reward-icon">₽</span>
          <span className="mission-reward-name">{formatMoney(reward.money)}</span>
        </li>
      )}
      {!!reward.coins && (
        <li className="mission-reward-coins">
          <span className="mission-reward-icon">
            <CoinIcon />
          </span>
          <span className="mission-reward-name">{reward.coins.toLocaleString('en-US')} coins</span>
        </li>
      )}
    </ul>
  )
}

// Always shown, finished or not, so every card keeps the same layout: the count over a
// bar that fills in the tier's colour (gold once done).
function MissionBar({ value, goal, done, claimed }: { value: number; goal: number; done: boolean; claimed: boolean }): React.JSX.Element {
  const shown = Math.min(value, goal)
  return (
    <div className={`mission-progress${done ? ' mission-progress-done' : ''}${claimed ? ' mission-progress-claimed' : ''}`}>
      <div className="mission-progress-count">
        <strong>{shown.toLocaleString('en-US')}</strong> / {goal.toLocaleString('en-US')}
        <span className="mission-progress-state">{done ? (claimed ? 'Claimed' : 'Complete!') : `${Math.floor((shown / Math.max(1, goal)) * 100)}%`}</span>
      </div>
      <div className="mission-progress-bar">
        <div className="mission-progress-fill" style={{ width: `${goal > 0 ? (shown / goal) * 100 : 0}%` }} />
      </div>
    </div>
  )
}

/** The day's three missions: progress, rewards to claim, a reroll, and the bonus for all three. */
function MissionsPanel({ state, onChange, onClaimed }: Props): React.JSX.Element {
  const [items, setItems] = useState<Map<string, ItemOptionEntry>>(new Map())
  const [busy, setBusy] = useState(false)
  const notes = useFloatingNotes()
  // The countdown ticks down while the window's open.
  const [openedAt] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    window.api
      .getEditorOptions()
      .then((options) => setItems(new Map(options.items.map((i) => [i.id, i]))))
      .catch(() => {})
    const timer = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(timer)
  }, [])

  // The note goes where the click was - worked out straight away, as the button is gone
  // from the event once the action has been awaited.
  async function act(e: React.MouseEvent, action: (at: NotePoint) => Promise<void>): Promise<void> {
    const at = pointOf(e)
    setBusy(true)
    try {
      await action(at)
    } catch (err) {
      notes.show(errorMessage(err), at, 'bad')
    } finally {
      setBusy(false)
    }
  }

  const claim = (e: React.MouseEvent, slot: number): Promise<void> =>
    act(e, async (at) => {
      const result = await window.api.claimMission(slot)
      onChange(result.state)
      onClaimed(result.money)
      notes.show(`Got ${result.rewardText}`, at)
    })

  const claimBonus = (e: React.MouseEvent): Promise<void> =>
    act(e, async (at) => {
      const result = await window.api.claimMissionBonus()
      onChange(result.state)
      onClaimed(result.money)
      notes.show(`Got ${result.rewardText}`, at)
    })

  const reroll = (e: React.MouseEvent, slot: number): Promise<void> =>
    act(e, async () => {
      onChange(await window.api.rerollMission(slot))
    })

  const remaining = state.msUntilReset - (now - openedAt)
  const finished = state.missions.filter((m) => m.progress >= m.goal).length
  return (
    <div className="rewards-scroll missions-view">
      {/* The day at a glance: how many are done, one segment per mission, the rerolls
          left and the time until they refresh. */}
      <div className="missions-summary">
        <div className="missions-summary-count">
          <strong>{finished}</strong>
          <span>/ {state.missions.length} done today</span>
        </div>
        <div className="missions-summary-segments">
          {state.missions.map((m) => (
            <span
              key={m.slot}
              className={`missions-segment missions-segment-${m.tier}${m.progress >= m.goal ? ' missions-segment-on' : ''}`}
            />
          ))}
        </div>
        <div className="missions-summary-tags">
          <span className="missions-tag" title="Swap an unfinished mission for another of the same difficulty">
            🎲 {state.rerollsLeft} reroll{state.rerollsLeft === 1 ? '' : 's'}
          </span>
          <span className="missions-tag" title="Missions refresh at midnight - an unclaimed reward is lost when they do">
            ⏳ {countdown(remaining)}
          </span>
        </div>
      </div>

      {/* The three missions side by side, each a tall card. */}
      <div className="mission-grid">
        {state.missions.map((m) => {
          const done = m.progress >= m.goal
          return (
            <div
              key={m.slot}
              className={`mission-col mission-col-${m.tier}${done && !m.claimed ? ' mission-col-ready' : ''}${m.claimed ? ' mission-col-claimed' : ''}`}
            >
              <span className="mission-col-tier">{TIER_LABELS[m.tier]}</span>
              <p className="mission-col-text">{m.text}</p>
              <MissionBar value={m.progress} goal={m.goal} done={done} claimed={m.claimed} />
              <div className="mission-col-rewards">
                <span className="mission-col-label">Reward</span>
                <RewardList reward={m.reward} items={items} />
              </div>
              <div className="mission-col-action">
                {m.claimed ? (
                  <span className="mission-col-done">✓ Claimed</span>
                ) : done ? (
                  <button className="mission-claim" disabled={busy} onClick={(e) => void claim(e, m.slot)}>
                    Claim reward
                  </button>
                ) : (
                  <button
                    className="mission-reroll"
                    disabled={busy || state.rerollsLeft < 1}
                    title={state.rerollsLeft < 1 ? 'No rerolls left today' : 'Swap it for another mission of the same difficulty'}
                    onClick={(e) => void reroll(e, m.slot)}
                  >
                    🎲 Reroll
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* The bonus for finishing all three, as a banner under them. */}
      <div
        className={`mission-bonus${state.bonusReady && !state.bonusClaimed ? ' mission-bonus-ready' : ''}${state.bonusClaimed ? ' mission-bonus-claimed' : ''}`}
      >
        <div className="mission-bonus-head">
          <span className="mission-col-tier mission-bonus-tier">Bonus</span>
          <span className="mission-bonus-text">Finish all three</span>
          <span className="mission-bonus-pips">
            {state.missions.map((m) => (
              <span key={m.slot} className={`mission-bonus-pip${m.progress >= m.goal ? ' mission-bonus-pip-on' : ''}`} />
            ))}
          </span>
        </div>
        <RewardList reward={state.bonusReward} items={items} />
        <div className="mission-bonus-action">
          {state.bonusClaimed ? (
            <span className="mission-col-done">✓ Claimed</span>
          ) : (
            <button className="mission-claim" disabled={busy || !state.bonusReady} onClick={(e) => void claimBonus(e)}>
              Claim bonus
            </button>
          )}
        </div>
      </div>

      <p className="editor-hint missions-hint">Missions refresh at midnight - an unclaimed reward is lost when they do.</p>
      {notes.layer}
    </div>
  )
}

export default MissionsPanel
