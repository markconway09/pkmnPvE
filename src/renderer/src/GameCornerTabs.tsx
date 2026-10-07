import CoinIcon from './CoinIcon'
import ModalSpinner from './ModalSpinner'
import TabStrip, { type TabStripTab } from './TabStrip'

export type GameCornerGame = 'slots' | 'blackjack' | 'roulette' | 'plinko' | 'dice'
// The Game Corner window's tabs: its games, and the Coin Shop counter.
export type GameCornerTab = GameCornerGame | 'shop'

/** What each game gets from the Game Corner window around it. */
export interface GameCornerGameProps {
  // "Buy some at the Coin Shop", for when the coins run out.
  onOpenCoinShop: () => void
  // Mid-spin / mid-hand: the tabs and the close button lock until it's over.
  onBusyChange: (busy: boolean) => void
  // The coins the game shows, for the balance in the window's top bar.
  onCoinsChange: (coins: number | null) => void
}

const TABS: TabStripTab<GameCornerTab>[] = [
  { id: 'slots', label: '🎰 Slots' },
  { id: 'blackjack', label: '🃏 Blackjack' },
  { id: 'roulette', label: '🎡 Roulette' },
  { id: 'plinko', label: '🔻 Plinko' },
  { id: 'dice', label: '🎲 Dice' },
  {
    id: 'shop',
    label: (
      <>
        <CoinIcon /> Coin Shop
      </>
    )
  }
]

interface Props {
  current: GameCornerTab
  // Locked mid-spin / mid-hand.
  disabled?: boolean
  onSwitch: (tab: GameCornerTab) => void
  // Left out when the Game Corner is a page of the main menu rather than a window.
  onClose?: () => void
}

/** The strip across the top of the Game Corner window, to switch games or go to the Coin Shop. */
function GameCornerTabs({ current, disabled, onSwitch, onClose }: Props): React.JSX.Element {
  return (
    <TabStrip
      className="game-corner-tabs"
      tabs={TABS}
      current={current}
      disabled={disabled}
      onSwitch={onSwitch}
      onClose={onClose}
      closeDisabled={disabled}
    />
  )
}

/** What a tab shows while its game loads: a spinner filling the window. */
export function GameCornerLoading(): React.JSX.Element {
  return (
    <div className="game-corner-game game-corner-loading">
      <ModalSpinner />
    </div>
  )
}

export default GameCornerTabs
