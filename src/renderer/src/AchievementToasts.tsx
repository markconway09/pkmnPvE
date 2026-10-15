import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toSpriteId, type PokedexRegistration } from '../../shared/battle-types'
import SpriteImage from './SpriteImage'
import { achievementNameOf, missionTextOf, t } from './i18n'

interface Toast {
  id: number
  name: string
  // A finished daily mission rather than an achievement.
  mission?: boolean
  // A Pokedex entry registered for the first time (a new form, or a new Pokemon).
  dex?: 'species' | 'form'
}

const TOAST_MS = 5000

// A clicked toast asks the main menu to open that achievement (or the daily missions, or
// the Pokedex at that entry). Clicked away from the menu (in a battle, say), it waits
// until the menu is back.
export interface RewardsFocus {
  tab: 'missions' | 'achievements' | 'pokedex'
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

// "New Pokemon registered" pop-ups can be held back - while a case opening spins, so the
// pop-up doesn't give away what it lands on. Each hold hands back its release; the
// entries wait until every hold is let go.
let dexHolds = 0
let heldDex: PokedexRegistration[] = []
let showDex: ((entries: PokedexRegistration[]) => void) | null = null

/** Holds back new Pokedex entry pop-ups until the returned release is called (once is enough). */
export function holdDexToasts(): () => void {
  dexHolds++
  let released = false
  return () => {
    if (released) return
    released = true
    dexHolds--
    if (dexHolds > 0 || heldDex.length === 0) return
    const entries = heldDex
    heldDex = []
    showDex?.(entries)
  }
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
    add(names.map((name) => ({ id: nextId.current++, name, mission })))
  }

  function add(fresh: Toast[]): void {
    setToasts((all) => [...all, ...fresh])
    const ids = new Set(fresh.map((t) => t.id))
    setTimeout(() => setToasts((all) => all.filter((t) => !ids.has(t.id))), TOAST_MS)
  }

  useEffect(() => window.api.onAchievementsUnlocked((names) => show(names, false)), [])
  useEffect(() => window.api.onMissionsChanged((finished) => show(finished, true)), [])
  useEffect(() => {
    const showEntries = (entries: PokedexRegistration[]): void =>
      add(entries.map((e) => ({ id: nextId.current++, name: e.species, dex: e.form ? 'form' : 'species' })))
    showDex = showEntries
    const stop = window.api.onPokedexRegistered((entries) => {
      if (dexHolds > 0) heldDex = [...heldDex, ...entries]
      else showEntries(entries)
    })
    return () => {
      stop()
      if (showDex === showEntries) showDex = null
    }
  }, [])

  return createPortal(
    <div className="achievement-toasts">
      {toasts.map((toast) =>
        toast.dex ? (
          // A new Pokedex entry: clicking it opens the Pokedex there.
          <div
            key={toast.id}
            className="achievement-toast dex-toast"
            style={{ animationDuration: `${TOAST_MS}ms` }}
            title={t('toast.openDex')}
            onClick={() => {
              requestFocus({ tab: 'pokedex', name: toast.name })
              setToasts((all) => all.filter((t) => t.id !== toast.id))
            }}
          >
            <SpriteImage style="3d-static" className="dex-toast-sprite" spriteId={toSpriteId(toast.name)} alt={toast.name} />
            <div>
              <div className="achievement-toast-label">{toast.dex === 'form' ? t('toast.newForm') : t('toast.newMon')}</div>
              <div className="achievement-toast-name">{toast.name}</div>
            </div>
          </div>
        ) : (
          <div
            key={toast.id}
            className="achievement-toast"
            style={{ animationDuration: `${TOAST_MS}ms` }}
            title={toast.mission ? t('toast.openMissions') : t('toast.openAchievement')}
            onClick={() => {
              requestFocus({ tab: toast.mission ? 'missions' : 'achievements', name: toast.name })
              setToasts((all) => all.filter((t) => t.id !== toast.id))
            }}
          >
            <span className="achievement-toast-icon">{toast.mission ? '📋' : '🏆'}</span>
            <div>
              <div className="achievement-toast-label">{toast.mission ? t('toast.missionDone') : t('toast.achievement')}</div>
              <div className="achievement-toast-name">{toast.mission ? missionTextOf(toast.name) : achievementNameOf(toast.name)}</div>
            </div>
          </div>
        )
      )}
    </div>,
    document.body
  )
}

export default AchievementToasts
