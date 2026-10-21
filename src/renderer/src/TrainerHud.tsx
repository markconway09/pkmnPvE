import type { BattleRewardsView, OpponentModifiersView, RosterSlotView } from '../../shared/battle-types'
import { trainerSpriteUrl } from './trainerSprite'
import RewardsTooltipContent from './RewardsTooltipContent'
import Tooltip from './Tooltip'
import SpriteImage from './SpriteImage'
import { loadSpriteStyle } from './spriteStyle'
import { toSpriteId } from '../../shared/battle-types'
import type { CompanionSize } from '../../shared/battle-types'
import RarityCard from './RarityCard'
import { statusLabel, t, titleName } from './i18n'

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
}

const TEAM_SIZE = 6

// A chaos draft opponent's modifiers - their battle-start ones, then their Pokemon's boosts.
function ModifiersTooltipContent({ modifiers }: { modifiers: OpponentModifiersView }): React.JSX.Element {
  return (
    <div className="tooltip-panel rewards-tooltip">
      <div className="tooltip-title">{t('hud.chaosModifiers')}</div>
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
      {modifiers.field.length === 0 && modifiers.mons.length === 0 && <div className="tooltip-row">{t('hud.noModifiers')}</div>}
    </div>
  )
}

// A team member's ball on hover: its sprite, its name, and its HP bar with any status.
function BallTooltipContent({ slot }: { slot: RosterSlotView }): React.JSX.Element {
  const hp = slot.fainted ? 0 : Math.max(0, Math.min(100, slot.hpPercent ?? 100))
  const hpClass = hp > 50 ? 'hp-high' : hp > 20 ? 'hp-mid' : 'hp-low'
  return (
    <div className="tooltip-panel trainer-hud-ball-tip">
      <SpriteImage
        style={loadSpriteStyle()}
        className={`trainer-hud-ball-tip-sprite${slot.fainted ? ' trainer-hud-ball-tip-fainted' : ''}`}
        spriteId={toSpriteId(slot.species)}
        shiny={slot.shiny}
        gmax={slot.gmaxLook}
        alt={slot.species}
      />
      <div className="trainer-hud-ball-tip-info">
        <div className="trainer-hud-ball-tip-name">
          {slot.species}
          {slot.fainted ? (
            <span className="trainer-hud-ball-tip-down">{t('hud.faintedTag')}</span>
          ) : (
            slot.status && <span className={`status-badge status-${slot.status}`}>{statusLabel(slot.status)}</span>
          )}
        </div>
        <div className="hp-bar-track">
          <div className={`hp-bar-fill ${hpClass}`} style={{ width: `${hp}%` }} />
          <span className="hp-bar-text">{hp}%</span>
        </div>
      </div>
    </div>
  )
}

function ballClass(slot: RosterSlotView | undefined): string {
  if (!slot) return 'trainer-hud-ball trainer-hud-ball-empty'
  if (slot.fainted) return 'trainer-hud-ball trainer-hud-ball-fainted'
  if (slot.status) return `trainer-hud-ball trainer-hud-ball-statused trainer-hud-ball-${slot.status}`
  return 'trainer-hud-ball'
}

function TrainerHud({ name, title, gold, spriteId, roster, align, size = 'small', rewards, modifiers, companion }: Props): React.JSX.Element {
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
    // Wrapped like the companion's figure, so both trainers stand the same way.
    <div className="trainer-hud-figure">{sprite}</div>
  )
  const nameText = (
    <>
      {name}
      {title && (
        <span className="trainer-hud-title">
          <span className="trainer-hud-title-the">{t('hud.the')}</span>
          {titleName(title)}
        </span>
      )}
    </>
  )
  const nameRow = gold ? (
    <RarityCard tier="legendary" framed className="trainer-hud-name trainer-hud-name-gold" title={t('menu.dexComplete')}>
      {nameText}
    </RarityCard>
  ) : (
    <div className="trainer-hud-name">{nameText}</div>
  )
  // Both trainers alike: the name along the top, the sprite centred under it, and the
  // team as a column of small balls down the side facing the other trainer.
  return (
    <div className={`trainer-hud trainer-hud-${align} trainer-hud-${size} trainer-hud-stacked`}>
      {nameRow}
      {figure}
      <div className="trainer-hud-ball-column">
        {slots.map((slot, i) =>
          slot ? (
            <Tooltip key={i} placement={align === 'left' ? 'right' : 'below'} content={<BallTooltipContent slot={slot} />}>
              <span className={ballClass(slot)} />
            </Tooltip>
          ) : (
            <span key={i} className={ballClass(slot)} />
          )
        )}
      </div>
    </div>
  )
}

export default TrainerHud
