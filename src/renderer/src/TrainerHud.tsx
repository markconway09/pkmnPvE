import type { BattleRewardsView, OpponentModifiersView, RosterSlotView } from '../../shared/battle-types'
import { trainerSpriteUrl } from './trainerSprite'
import { ballStateFor, pokeballStyle } from './pokeballIcon'
import RewardsTooltipContent from './RewardsTooltipContent'
import Tooltip from './Tooltip'
import SpriteImage from './SpriteImage'
import { loadSpriteStyle } from './spriteStyle'
import { toSpriteId } from '../../shared/battle-types'
import type { CompanionSize } from '../../shared/battle-types'
import RarityCard from './RarityCard'

interface Props {
  name: string
  // The player's achievement title, in gold beside their name.
  title?: string | null
  // A full Pokedex: the name and title sit in a gold card.
  gold?: boolean
  spriteId: string
  roster: RosterSlotView[]
  align: 'left' | 'right'
  // 'large' is the bigger panel under the move buttons - same info, just easier to read at a
  // glance without leaning in. Defaults to the compact bar above the battle field.
  size?: 'small' | 'large'
  // The opponent's sprite shows what winning pays out when hovered. Undefined means
  // don't show it; null is a friendly match with nothing to win.
  rewards?: BattleRewardsView | null
  // A chaos draft opponent: their modifiers, shown on hover in place of the rewards.
  modifiers?: OpponentModifiersView | null
  // The player's companion, standing beside their sprite, at the size they picked.
  companion?: { species: string; shiny: boolean; gmaxLook?: boolean; size: CompanionSize } | null
  // No Poke Balls - the player's own team is on show beside the battle anyway.
  hideBalls?: boolean
}

const TEAM_SIZE = 6

// A chaos draft opponent's modifiers - their battle-start ones, then their Pokemon's boosts.
function ModifiersTooltipContent({ modifiers }: { modifiers: OpponentModifiersView }): React.JSX.Element {
  return (
    <div className="tooltip-panel rewards-tooltip">
      <div className="tooltip-title">Chaos modifiers</div>
      {modifiers.field.map((line) => (
        <div key={line} className="rewards-row">
          <span className="rewards-name">{line}</span>
        </div>
      ))}
      {modifiers.mons.map((mon) => (
        <div key={mon.species} className="rewards-row">
          <span className="rewards-name">{mon.species}</span>
          <span className="rewards-source">{mon.boosts.join(' · ')}</span>
        </div>
      ))}
      {modifiers.field.length === 0 && modifiers.mons.length === 0 && <div className="tooltip-row">No modifiers this battle</div>}
    </div>
  )
}
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

function TrainerHud({ name, title, gold, spriteId, roster, align, size = 'small', rewards, modifiers, companion, hideBalls }: Props): React.JSX.Element {
  const slots = Array.from({ length: TEAM_SIZE }, (_, i) => roster[i])
  const sprite =
    modifiers || rewards !== undefined ? (
      <Tooltip
        placement="below"
        content={modifiers ? <ModifiersTooltipContent modifiers={modifiers} /> : <RewardsTooltipContent rewards={rewards ?? null} />}
      >
        <img className="trainer-hud-sprite" src={trainerSpriteUrl(spriteId)} alt={name} />
      </Tooltip>
    ) : (
      <img className="trainer-hud-sprite" src={trainerSpriteUrl(spriteId)} alt={name} />
    )
  const figure = companion ? (
    // The trainer with their companion at their feet, just in front of them.
    <div className="trainer-hud-figure">
      {sprite}
      <SpriteImage
        style={loadSpriteStyle()}
        className={`trainer-hud-companion trainer-hud-companion-${companion.size.toLowerCase()}`}
        spriteId={toSpriteId(companion.species)}
        shiny={companion.shiny}
        gmax={companion.gmaxLook}
        alt={companion.species}
      />
    </div>
  ) : (
    sprite
  )
  const nameText = (
    <>
      {name}
      {title && (
        <span className="trainer-hud-title">
          <span className="trainer-hud-title-the">the</span>
          {title}
        </span>
      )}
    </>
  )
  const nameRow = gold ? (
    <RarityCard tier="legendary" framed className="trainer-hud-name trainer-hud-name-gold" title="Pokédex complete">
      {nameText}
    </RarityCard>
  ) : (
    <div className="trainer-hud-name">{nameText}</div>
  )
  // The player (no Poke Balls): the name along the top, the sprites centred under it.
  if (hideBalls) {
    return (
      <div className={`trainer-hud trainer-hud-${align} trainer-hud-${size} trainer-hud-stacked`}>
        {nameRow}
        {figure}
      </div>
    )
  }
  return (
    <div className={`trainer-hud trainer-hud-${align} trainer-hud-${size}`}>
      {figure}
      <div className="trainer-hud-info">
        {nameRow}
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
