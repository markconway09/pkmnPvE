import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface Toast {
  id: number
  name: string
  // A finished daily mission rather than an achievement.
  mission?: boolean
}

const TOAST_MS = 5000

// A clicked toast asks the main menu to open that achievement (or the daily missions).
// Clicked away from the menu (in a battle, say), it waits until the menu is back.
export interface RewardsFocus {
  tab: 'missions' | 'achievements'
  name: string
}
const FOCUS_EVENT = 'rewards-focus'
let pendingFocus: RewardsFocus | null = null

/** The main menu listens here: `listener` gets any click still waiting, then each new one. */
export function onRewardsFocus(listener: (focus: RewardsFocus) => void): () => void {
  if (pendingFocus) {
    listener(pendingFocus)
    pendingFocus = null
  }
  const handler = (e: Event): void => {
    pendingFocus = null
    listener((e as CustomEvent<RewardsFocus>).detail)
  }
  window.addEventListener(FOCUS_EVENT, handler)
  return () => window.removeEventListener(FOCUS_EVENT, handler)
}

function requestFocus(focus: RewardsFocus): void {
  // Kept until the menu takes it - the event clears it straight away when the menu is up.
  pendingFocus = focus
  window.dispatchEvent(new CustomEvent(FOCUS_EVENT, { detail: focus }))
}

/**
 * "Achievement unlocked" pop-ups at the top of the window, wherever the player is (a
 * battle included) - the main process says when one unlocks. Clicking one opens the
 * Achievements list at it; claiming is done from there.
 */
function AchievementToasts(): React.JSX.Element {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)

  function show(names: string[], mission: boolean): void {
    if (names.length === 0) return
    const fresh = names.map((name) => ({ id: nextId.current++, name, mission }))
    setToasts((all) => [...all, ...fresh])
    const ids = new Set(fresh.map((t) => t.id))
    setTimeout(() => setToasts((all) => all.filter((t) => !ids.has(t.id))), TOAST_MS)
  }

  useEffect(() => window.api.onAchievementsUnlocked((names) => show(names, false)), [])
  useEffect(() => window.api.onMissionsChanged((finished) => show(finished, true)), [])

  return createPortal(
    <div className="achievement-toasts">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="achievement-toast"
          style={{ animationDuration: `${TOAST_MS}ms` }}
          title={toast.mission ? 'Open the daily missions' : 'Open the achievement'}
          onClick={() => {
            requestFocus({ tab: toast.mission ? 'missions' : 'achievements', name: toast.name })
            setToasts((all) => all.filter((t) => t.id !== toast.id))
          }}
        >
          <span className="achievement-toast-icon">{toast.mission ? '📋' : '🏆'}</span>
          <div>
            <div className="achievement-toast-label">{toast.mission ? 'Daily mission complete!' : 'Achievement unlocked!'}</div>
            <div className="achievement-toast-name">{toast.name}</div>
          </div>
        </div>
      ))}
    </div>,
    document.body
  )
}

export default AchievementToasts
