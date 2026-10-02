import { useEffect, useState } from 'react'
import { RarityGlow } from './RarityCard'
import FitName from './FitName'
import type { ActivePokemonView } from '../../shared/battle-types'
import { toSpriteId } from '../../shared/battle-types'
import SpriteImage from './SpriteImage'
import ItemSprite from './ItemSprite'
import PokemonTooltipContent from './PokemonTooltipContent'
import Tooltip from './Tooltip'
import { fetchItemSpritenum } from './itemSpritenumCache'
import { defensiveClass, effectivenessClass, effectivenessText, type EffectivenessChip } from './effectiveness'

// A team member's matchup against the foes out, each list left to right as on screen:
// how well its own types hit them, and how hard their types hit it.
export interface TeamMatchup {
  offense: EffectivenessChip[]
  defense: EffectivenessChip[]
}

interface TeamMemberProps {
  mon: ActivePokemonView
  isActive: boolean
  disabled: boolean
  onClick: () => void
  matchup?: TeamMatchup
}

// Same shorthand BattleSprite flashes on the active Pokemon's HP bar.
const STATUS_LABELS: Record<string, string> = {
  par: 'PAR',
  brn: 'BRN',
  psn: 'PSN',
  tox: 'PSN',
  slp: 'SLP',
  frz: 'FRZ'
}

function TeamMember({ mon, isActive, disabled, onClick, matchup }: TeamMemberProps): React.JSX.Element {
  const spriteId = toSpriteId(mon.species)
  const hpClass = mon.hpPercent > 50 ? 'hp-high' : mon.hpPercent > 20 ? 'hp-mid' : 'hp-low'
  const classes = [
    'team-member',
    'rarity-card',
    `rarity-tier-${mon.rarityTier ?? 'common'}`,
    isActive && 'team-member-active',
    mon.fainted && 'team-member-fainted'
  ]
    .filter(Boolean)
    .join(' ')

  const [itemSpritenum, setItemSpritenum] = useState<number | null>(null)
  useEffect(() => {
    let cancelled = false
    setItemSpritenum(null)
    if (mon.item) {
      fetchItemSpritenum(mon.item).then((num) => {
        if (!cancelled) setItemSpritenum(num)
      })
    }
    return () => {
      cancelled = true
    }
  }, [mon.item])

  return (
    <Tooltip className="team-member-slot" placement="right" content={<PokemonTooltipContent pokemon={mon} />}>
      <button className={classes} disabled={disabled} onClick={onClick}>
        <div className="team-member-top">
          <RarityGlow size={65}>
            <SpriteImage
              style="3d-static"
              className="team-member-icon"
              spriteId={spriteId}
              shiny={mon.shiny}
              alt={mon.species}
            />
          </RarityGlow>
          <div className="team-member-info">
            <div className="team-member-name-row">
              <FitName className="team-member-name" text={mon.species} />
              {mon.status && (
                <span className={`status-badge status-${mon.status}`}>{STATUS_LABELS[mon.status] ?? mon.status.toUpperCase()}</span>
              )}
            </div>
            <span className="team-member-item">
              {itemSpritenum !== null && <ItemSprite spritenum={itemSpritenum} className="team-member-item-icon" />}
              <span className="team-member-item-name">{mon.item || 'No item'}</span>
            </span>
            {matchup && (matchup.offense.length > 0 || matchup.defense.length > 0) && (
              <div className="team-member-matchups">
                <span className="matchup-group" title="How hard its own types hit each foe">
                  ⚔
                  {matchup.offense.map((chip, i) => (
                    <span
                      key={i}
                      className={`eff-chip ${effectivenessClass(chip.multiplier)}`}
                      title={`Its types vs ${chip.foeName}: best ${effectivenessText(chip.multiplier)}`}
                    >
                      {effectivenessText(chip.multiplier)}
                    </span>
                  ))}
                </span>
                <span className="matchup-group" title="How hard each foe's types hit it">
                  🛡
                  {matchup.defense.map((chip, i) => (
                    <span
                      key={i}
                      className={`eff-chip ${defensiveClass(chip.multiplier)}`}
                      title={`${chip.foeName}'s types vs it: worst ${effectivenessText(chip.multiplier)}`}
                    >
                      {effectivenessText(chip.multiplier)}
                    </span>
                  ))}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="hp-bar-track team-member-hp">
          <div className={`hp-bar-fill ${hpClass}`} style={{ width: `${mon.hpPercent}%` }} />
        </div>
      </button>
    </Tooltip>
  )
}

interface Props {
  team: ActivePokemonView[]
  activeFlags: boolean[]
  selectable: boolean
  disabled: boolean
  // 1-indexed team slots already claimed by another active slot's pending
  // switch choice this turn (doubles only) - kept pickable elsewhere, just
  // not here too.
  reservedSlots?: Set<number>
  // Parallel to team: each member's matchup against the foes out.
  matchups?: TeamMatchup[]
  // No switching at all right now: the whole list greys out, with why (if there's a reason
  // worth saying, like a trap) along the top.
  locked?: boolean
  lockedNote?: string
  // Revival Blessing: only the fainted can be picked, to bring one back.
  reviveMode?: boolean
  onSwitch: (slot: number) => void
}

function TeamPanel({ team, activeFlags, selectable, disabled, reservedSlots, matchups, locked, lockedNote, reviveMode, onSwitch }: Props): React.JSX.Element {
  // Doubles: two matchup chips a group (one per foe), so the cards go compact to keep them on one line.
  const doubles = !!matchups?.some((m) => m.offense.length > 1 || m.defense.length > 1)
  return (
    <div className={`menu-panel team-panel${doubles ? ' team-panel-doubles' : ''}${locked ? ' team-panel-locked' : ''}`}>
      {lockedNote && <div className="team-panel-locked-note">{lockedNote}</div>}
      {team.map((mon, i) => (
        <TeamMember
          key={i}
          mon={mon}
          isActive={!!activeFlags[i]}
          disabled={disabled || !selectable || mon.fainted !== !!reviveMode || !!activeFlags[i] || !!reservedSlots?.has(i + 1)}
          onClick={() => onSwitch(i + 1)}
          matchup={matchups?.[i]}
        />
      ))}
    </div>
  )
}

export default TeamPanel
