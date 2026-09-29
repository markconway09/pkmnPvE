export type GameCornerGame = 'slots' | 'blackjack' | 'roulette' | 'plinko'

const GAMES: { game: GameCornerGame; label: string }[] = [
  { game: 'slots', label: '🎰 Slots' },
  { game: 'blackjack', label: '🃏 Blackjack' },
  { game: 'roulette', label: '🎡 Roulette' },
  { game: 'plinko', label: '🔻 Plinko' }
]

interface Props {
  current: GameCornerGame
  // Locked mid-spin / mid-hand.
  disabled?: boolean
  onSwitch: (game: GameCornerGame) => void
}

/** The strip at the top of each Game Corner game, to switch to another one. */
function GameCornerTabs({ current, disabled, onSwitch }: Props): React.JSX.Element {
  return (
    <div className="game-corner-tabs">
      {GAMES.map(({ game, label }) => (
        <button
          key={game}
          className={`game-corner-tab${current === game ? ' game-corner-tab-active' : ''}`}
          disabled={disabled && current !== game}
          onClick={() => current !== game && onSwitch(game)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export default GameCornerTabs
