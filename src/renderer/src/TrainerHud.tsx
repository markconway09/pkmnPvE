import type { BattleRewardsView, RosterSlotView } from '../../shared/battle-types'
import { trainerSpriteUrl } from './trainerSprite'
import { ballStateFor, pokeballStyle } from './pokeballIcon'
import RewardsTooltipContent from './RewardsTooltipContent'
import Tooltip from './Tooltip'

interface Props {
  name: string
  spriteId: string
  roster: RosterSlotView[]
  align: 'left' | 'right'
  // 'large' is the bigger panel under the move buttons - same info, just easier to read at a
  // glance without leaning in. Defaults to the compact bar above the battle field.
  size?: 'small' | 'large'
  // The opponent's sprite shows what winning pays out when hovered. Undefined means
  // don't show it; null is a friendly match with nothing to win.
  rewards?: BattleRewardsView | null
}

const TEAM_SIZE = 6
const BALL_SCALE = { small: 1, large: 1.8 } as const

// What a pokeball's tooltip says on hover - the Pokemon it stands for, plus
// whether it's currently down or affected by a status. Nothing for a slot
// with no Pokemon in it at all.
function ballTitle(slot: RosterSlotView | undefined): string | undefined {
  if (!slot) return undefined
  if (slot.fainted) return `${slot.species} (fainted)`
  if (slot.status) return `${slot.species} (${slot.status})`
  return slot.species
}

function TrainerHud({ name, spriteId, roster, align, size = 'small', rewards }: Props): React.JSX.Element {
  const slots = Array.from({ length: TEAM_SIZE }, (_, i) => roster[i])
  return (
    <div className={`trainer-hud trainer-hud-${align} trainer-hud-${size}`}>
      {rewards !== undefined ? (
        <Tooltip placement="below" content={<RewardsTooltipContent rewards={rewards} />}>
          <img className="trainer-hud-sprite" src={trainerSpriteUrl(spriteId)} alt={name} />
        </Tooltip>
      ) : (
        <img className="trainer-hud-sprite" src={trainerSpriteUrl(spriteId)} alt={name} />
      )}
      <div className="trainer-hud-info">
        <div className="trainer-hud-name">{name}</div>
        <div className="trainer-hud-balls">
          {slots.map((slot, i) => (
            <span
              key={i}
              className="pokeball-icon"
              style={pokeballStyle(ballStateFor(slot), BALL_SCALE[size])}
              title={ballTitle(slot)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default TrainerHud
