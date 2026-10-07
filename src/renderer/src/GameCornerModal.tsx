import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import GameCornerTabs, { type GameCornerTab } from './GameCornerTabs'
import SlotMachine from './SlotMachine'
import BlackjackTable from './BlackjackTable'
import RouletteTable from './RouletteTable'
import PlinkoBoard from './PlinkoBoard'
import DiceGame from './DiceGame'
import CoinShopPanel from './CoinShopPanel'
import CoinIcon from './CoinIcon'

interface Props {
  // The tab it opens on - the one played last.
  initialTab: GameCornerTab
  // Remembers the tab, so the Game Corner reopens on it.
  onTabChange: (tab: GameCornerTab) => void
  onClose: () => void
  // The wallet changed (coins bought) - the menu bar's money needs refreshing.
  onMoneyChange: (money: number) => void
  // A Pokemon was bought into the box - the main menu's box needs refreshing.
  onBoxChange?: () => void
  // A page of the main menu instead of a window: no overlay and no close button.
  inline?: boolean
  // Mid-spin / mid-hand - the main menu's sidebar locks too, like the tabs.
  onBusyChange?: (busy: boolean) => void
  // Opened from the Items window's Friendship Petal or Shiny Patch: the Coin Shop scrolls
  // to that item's daily deal, then says it has (so it doesn't again next time).
  focusItem?: string | null
  onItemFocused?: () => void
}

/**
 * The Game Corner: one window holding its games and the Coin Shop, with tabs across
 * the top to switch between them and the close button beside them. The coins
 * held float at the top right, under the tabs. A game mid-spin or mid-hand locks the tabs and the
 * close button until it's done.
 */
function GameCornerModal({
  initialTab,
  onTabChange,
  onClose,
  onMoneyChange,
  onBoxChange,
  inline,
  onBusyChange,
  focusItem,
  onItemFocused
}: Props): React.JSX.Element {
  const [tab, setTab] = useState<GameCornerTab>(initialTab)
  const [busy, setBusy] = useState(false)
  useEffect(() => onBusyChange?.(busy), [busy, onBusyChange])
  // Leaving the page never leaves the sidebar locked.
  useEffect(() => () => onBusyChange?.(false), [onBusyChange])
  const [coins, setCoins] = useState<number | null>(null)

  useEffect(() => {
    window.api
      .getCoins()
      .then(setCoins)
      .catch(() => {})
  }, [])

  function switchTab(next: GameCornerTab): void {
    if (busy) return
    setTab(next)
    onTabChange(next)
  }

  const close = (): void => {
    if (!busy) onClose()
  }

  const gameProps = {
    onOpenCoinShop: () => switchTab('shop'),
    onBusyChange: setBusy,
    onCoinsChange: (c: number | null) => {
      if (c !== null) setCoins(c)
    }
  }

  // The coins held - floating over the game in the window, beside the tabs on the page.
  const balance = (
    <div className="game-corner-balance">
      <span className="slots-coins" title="Coins">
        <CoinIcon /> {coins === null ? '…' : coins.toLocaleString('en-US')}
      </span>
    </div>
  )

  const panel = (
    <div
      className={`modal-panel game-corner-modal game-corner-modal-${tab}${inline ? ' game-corner-page' : ''}`}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="game-corner-topbar">
        <GameCornerTabs current={tab} disabled={busy} onSwitch={switchTab} onClose={inline ? undefined : close} />
        {inline && balance}
      </div>

      <div className="game-corner-main">
        <div className="game-corner-body">
          {tab === 'slots' && <SlotMachine {...gameProps} />}
          {tab === 'blackjack' && <BlackjackTable {...gameProps} />}
          {tab === 'roulette' && <RouletteTable {...gameProps} />}
          {tab === 'plinko' && <PlinkoBoard {...gameProps} />}
          {tab === 'dice' && <DiceGame {...gameProps} />}
          {tab === 'shop' && (
            <CoinShopPanel
              onCoinsChange={setCoins}
              onBoxChange={onBoxChange}
              focusItem={focusItem}
              onItemFocused={onItemFocused}
              onMoneyChange={onMoneyChange}
            />
          )}
        </div>

        {/* The window: the coins held, floating at the top right under the tabs. */}
        {!inline && balance}
      </div>
    </div>
  )
  if (inline) return panel
  return createPortal(
    <div className="modal-overlay" onMouseDown={close}>
      {panel}
    </div>,
    document.body
  )
}

export default GameCornerModal
