import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import CoinIcon from './CoinIcon'
import { errorMessage } from './FloatingNotes'

interface Props {
  onClose: () => void
  onTrainers: () => void
  onRogueliteBosses: () => void
  onProgression: () => void
  onAddRandom: () => void
  onWildDrops: () => void
  onShopPrices: () => void
  // The money and coins were set - the menu bar's money needs refreshing.
  onWalletChanged: (money: number) => void
  onResetBossProgress: () => void
  onResetStats: () => void
  addRandomBusy: boolean
}

// Typed digits only (commas and spaces ignored), as a whole number - or null while it's empty.
function parseAmount(text: string): number | null {
  const digits = text.replace(/[^0-9]/g, '')
  return digits ? Number(digits) : null
}

function DebugMenu({
  onClose,
  onTrainers,
  onRogueliteBosses,
  onProgression,
  onAddRandom,
  onWildDrops,
  onShopPrices,
  onWalletChanged,
  onResetBossProgress,
  onResetStats,
  addRandomBusy
}: Props): React.JSX.Element {
  // Only one button needing a second click can be armed at a time.
  const [confirming, setConfirming] = useState<'boss' | 'stats' | null>(null)
  // The wallet as typed - filled in with the current amounts when the menu opens.
  const [moneyText, setMoneyText] = useState('')
  const [coinsText, setCoinsText] = useState('')
  const [walletNote, setWalletNote] = useState<{ text: string; bad: boolean } | null>(null)

  useEffect(() => {
    Promise.all([window.api.getMoney(), window.api.getCoins()])
      .then(([money, coins]) => {
        setMoneyText(String(money))
        setCoinsText(String(coins))
      })
      .catch(() => {})
  }, [])

  async function saveWallet(): Promise<void> {
    const money = parseAmount(moneyText)
    const coins = parseAmount(coinsText)
    if (money === null || coins === null) {
      setWalletNote({ text: 'Enter both amounts', bad: true })
      return
    }
    try {
      const wallet = await window.api.debugSetWallet(money, coins)
      setMoneyText(String(wallet.money))
      setCoinsText(String(wallet.coins))
      onWalletChanged(wallet.money)
      setWalletNote({ text: 'Saved', bad: false })
    } catch (e) {
      setWalletNote({ text: errorMessage(e), bad: true })
    }
  }

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
          <form
            className="debug-wallet"
            onSubmit={(e) => {
              e.preventDefault()
              void saveWallet()
            }}
          >
            <label>
              <span>₽ Money</span>
              <input
                inputMode="numeric"
                value={moneyText}
                onChange={(e) => {
                  setMoneyText(e.target.value)
                  setWalletNote(null)
                }}
              />
            </label>
            <label>
              <span>
                <CoinIcon /> Coins
              </span>
              <input
                inputMode="numeric"
                value={coinsText}
                onChange={(e) => {
                  setCoinsText(e.target.value)
                  setWalletNote(null)
                }}
              />
            </label>
            <button type="submit">Set</button>
          </form>
          {walletNote && <p className={walletNote.bad ? 'editor-error' : 'debug-wallet-saved'}>{walletNote.text}</p>}
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
