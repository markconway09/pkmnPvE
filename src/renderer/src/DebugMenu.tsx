import { useState } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  onClose: () => void
  onTrainers: () => void
  onRogueliteBosses: () => void
  onProgression: () => void
  onAddRandom: () => void
  onWildDrops: () => void
  onShopPrices: () => void
  onAddMoney: () => void
  onResetBossProgress: () => void
  onResetStats: () => void
  addRandomBusy: boolean
}

function DebugMenu({
  onClose,
  onTrainers,
  onRogueliteBosses,
  onProgression,
  onAddRandom,
  onWildDrops,
  onShopPrices,
  onAddMoney,
  onResetBossProgress,
  onResetStats,
  addRandomBusy
}: Props): React.JSX.Element {
  // Only one button needing a second click can be armed at a time.
  const [confirming, setConfirming] = useState<'boss' | 'stats' | null>(null)

  return createPortal(
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-panel debug-menu" onMouseDown={(e) => e.stopPropagation()}>
        <h2>Debug</h2>
        <div className="debug-menu-options">
          <button onClick={onTrainers}>Edit Trainers</button>
          <button onClick={onRogueliteBosses}>Edit Roguelite Bosses</button>
          <button onClick={onProgression}>Progression</button>
          <button onClick={onWildDrops}>Wild Item Drops</button>
          <button onClick={onShopPrices}>Shop Prices</button>
          <button disabled={addRandomBusy} onClick={onAddRandom}>
            Add Random Pokemon (temporary)
          </button>
          <button onClick={onAddMoney}>Add ₽1000</button>
          {confirming === 'boss' ? (
            <button
              className="debug-reset-confirm"
              onClick={() => {
                onResetBossProgress()
                setConfirming(null)
              }}
            >
              Click again to confirm boss reset
            </button>
          ) : (
            <button onClick={() => setConfirming('boss')}>Reset Boss Progression</button>
          )}
          {confirming === 'stats' ? (
            <button
              className="debug-reset-confirm"
              onClick={() => {
                onResetStats()
                setConfirming(null)
              }}
            >
              Click again to confirm reset
            </button>
          ) : (
            <button onClick={() => setConfirming('stats')}>Reset Stats</button>
          )}
        </div>
        <div className="editor-actions">
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default DebugMenu
