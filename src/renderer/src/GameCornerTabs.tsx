export type GameCornerGame = 'slots' | 'blackjack'

interface Props {
  current: GameCornerGame
  // Locked mid-spin / mid-hand.
  disabled?: boolean
  onSwitch: () => void
}

/** The strip at the top of each Game Corner game, to switch to the other one. */
function GameCornerTabs({ current, disabled, onSwitch }: Props): React.JSX.Element {
  const tab = (game: GameCornerGame, label: string): React.JSX.Element => (
    <button
      className={`game-corner-tab${current === game ? ' game-corner-tab-active' : ''}`}
      disabled={disabled && current !== game}
      onClick={() => current !== game && onSwitch()}
    >
      {label}
    </button>
  )
  return (
    <div className="game-corner-tabs">
      {tab('slots', '🎰 Slots')}
      {tab('blackjack', '🃏 Blackjack')}
    </div>
  )
}

export default GameCornerTabs
