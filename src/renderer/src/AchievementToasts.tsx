import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface Toast {
  id: number
  name: string
}

const TOAST_MS = 5000

/**
 * "Achievement unlocked" pop-ups at the top of the window, wherever the player is (a
 * battle included) - the main process says when one unlocks. Claiming is done from the
 * Achievements list.
 */
function AchievementToasts(): React.JSX.Element {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)

  useEffect(
    () =>
      window.api.onAchievementsUnlocked((names) => {
        const fresh = names.map((name) => ({ id: nextId.current++, name }))
        setToasts((all) => [...all, ...fresh])
        const ids = new Set(fresh.map((t) => t.id))
        setTimeout(() => setToasts((all) => all.filter((t) => !ids.has(t.id))), TOAST_MS)
      }),
    []
  )

  return createPortal(
    <div className="achievement-toasts">
      {toasts.map((toast) => (
        <div key={toast.id} className="achievement-toast" style={{ animationDuration: `${TOAST_MS}ms` }}>
          <span className="achievement-toast-icon">🏆</span>
          <div>
            <div className="achievement-toast-label">Achievement unlocked!</div>
            <div className="achievement-toast-name">{toast.name}</div>
          </div>
        </div>
      ))}
    </div>,
    document.body
  )
}

export default AchievementToasts
