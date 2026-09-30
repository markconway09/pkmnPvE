import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ItemOptionEntry } from '../../shared/battle-types'
import type { MissionReward, MissionsState, MissionTier } from '../../shared/missions'
import ItemSprite from './ItemSprite'
import CoinIcon from './CoinIcon'
import { formatMoney } from './money'
import { errorMessage, pointOf, useFloatingNotes } from './FloatingNotes'

interface Props {
  state: MissionsState
  onChange: (state: MissionsState) => void
  // A reward was claimed - the money and bag may have changed.
  onClaimed: (money: number) => void
  onClose: () => void
}

const TIER_LABELS: Record<MissionTier, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }

function countdown(ms: number): string {
  const minutes = Math.max(0, Math.ceil(ms / 60000))
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function RewardChips({ reward, items }: { reward: MissionReward; items: Map<string, ItemOptionEntry> }): React.JSX.Element {
  return (
    <div className="achievement-reward">
      {(reward.items ?? []).map(({ itemId, count }) => {
        const item = items.get(itemId)
        return (
          <span key={itemId} className="achievement-reward-chip" title={item?.name ?? itemId}>
            {item && <ItemSprite spritenum={item.spritenum} />}
            {count > 1 && `×${count}`}
          </span>
        )
      })}
      {!!reward.money && <span className="achievement-reward-chip">{formatMoney(reward.money)}</span>}
      {!!reward.coins && (
        <span className="achievement-reward-chip">
          <CoinIcon /> {reward.coins.toLocaleString('en-US')}
        </span>
      )}
    </div>
  )
}

/** The day's three missions: progress, rewards to claim, a reroll, and the bonus for all three. */
function MissionsModal({ state, onChange, onClaimed, onClose }: Props): React.JSX.Element {
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

  async function act(e: React.MouseEvent, action: () => Promise<void>): Promise<void> {
    const at = pointOf(e)
    setBusy(true)
    try {
      await action()
    } catch (err) {
      notes.show(errorMessage(err), at, 'bad')
    } finally {
      setBusy(false)
    }
  }

  const claim = (e: React.MouseEvent, slot: number): Promise<void> =>
    act(e, async () => {
      const result = await window.api.claimMission(slot)
      onChange(result.state)
      onClaimed(result.money)
      notes.show(`Got ${result.rewardText}`, pointOf(e))
    })

  const claimBonus = (e: React.MouseEvent): Promise<void> =>
    act(e, async () => {
      const result = await window.api.claimMissionBonus()
      onChange(result.state)
      onClaimed(result.money)
      notes.show(`Got ${result.rewardText}`, pointOf(e))
    })

  const reroll = (e: React.MouseEvent, slot: number): Promise<void> =>
    act(e, async () => {
      onChange(await window.api.rerollMission(slot))
    })

  const remaining = state.msUntilReset - (now - openedAt)
  return createPortal(
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-panel missions-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="shop-header">
          <h2>Daily Missions</h2>
          <span className="missions-reset">New missions in {countdown(remaining)}</span>
        </div>

        <div className="achievement-list">
          {state.missions.map((m) => {
            const done = m.progress >= m.goal
            return (
              <div
                key={m.slot}
                className={`achievement mission mission-${m.tier}${done ? ' achievement-unlocked' : ''}${m.claimed ? ' achievement-claimed' : ''}`}
              >
                <span className={`mission-tier mission-tier-${m.tier}`}>{TIER_LABELS[m.tier]}</span>
                <div className="achievement-body">
                  <span className="achievement-name">{m.text}</span>
                  {!done && (
                    <div className="achievement-progress">
                      <div className="achievement-progress-fill" style={{ width: `${(m.progress / m.goal) * 100}%` }} />
                      <span className="achievement-progress-text">
                        {m.progress} / {m.goal}
                      </span>
                    </div>
                  )}
                </div>
                <RewardChips reward={m.reward} items={items} />
                <div className="achievement-action">
                  {m.claimed ? (
                    <span className="achievement-done">✓ Claimed</span>
                  ) : done ? (
                    <button disabled={busy} onClick={(e) => void claim(e, m.slot)}>
                      Claim
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

        <div className={`achievement mission-bonus${state.bonusReady ? ' achievement-unlocked' : ''}${state.bonusClaimed ? ' achievement-claimed' : ''}`}>
          <span className="mission-tier mission-tier-bonus">Bonus</span>
          <div className="achievement-body">
            <span className="achievement-name">Finish all three</span>
          </div>
          <RewardChips reward={state.bonusReward} items={items} />
          <div className="achievement-action">
            {state.bonusClaimed ? (
              <span className="achievement-done">✓ Claimed</span>
            ) : (
              <button disabled={busy || !state.bonusReady} onClick={(e) => void claimBonus(e)}>
                Claim
              </button>
            )}
          </div>
        </div>

        <p className="editor-hint">
          {state.rerollsLeft} reroll{state.rerollsLeft === 1 ? '' : 's'} left today. Missions refresh at midnight - an
          unclaimed reward is lost when they do.
        </p>
        <div className="editor-actions">
          <button onClick={onClose}>Close</button>
        </div>
        {notes.layer}
      </div>
    </div>,
    document.body
  )
}

export default MissionsModal
