import { GAME_CORNER_TITLES, TITLE_PERKS } from '../../shared/titles'
import type { GameCornerGame } from './GameCornerTabs'
import type { GameCornerPerks } from '../../shared/titles'
import Tooltip from './Tooltip'

interface Props {
  game: GameCornerGame
  perks: GameCornerPerks
}

/**
 * A badge under a Game Corner game for each title on that changes it (High Roller and the
 * game's own payout title), its perk on hovering. Nothing when none is on.
 */
function GameCornerTitles({ game, perks }: Props): React.JSX.Element | null {
  const titles = GAME_CORNER_TITLES[game].filter((t) => perks.titles.includes(t))
  if (titles.length === 0) return null
  return (
    <div className="game-corner-titles">
      {titles.map((title) => (
        <Tooltip key={title} placement="above" content={<div className="tooltip-panel game-corner-info-panel">{TITLE_PERKS[title]}</div>}>
          <span className="game-corner-title-badge">★ {title}</span>
        </Tooltip>
      ))}
    </div>
  )
}

export default GameCornerTitles
