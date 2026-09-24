import { useEffect, useState } from 'react'
import type { LiveMovePower, MoveInfo } from '../../shared/battle-types'
import { fetchMoveInfo } from './moveInfoCache'
import { movePowerLabel } from './movePower'
import MoveTooltipContent from './MoveTooltipContent'
import Tooltip from './Tooltip'
import { effectivenessClass, effectivenessText, effectivenessWords, type EffectivenessChip } from './effectiveness'

interface Props {
  id: string
  name: string
  pp: number
  maxpp: number
  disabled: boolean
  // What the move hits for right now, when a battle can say.
  power?: LiveMovePower
  // Its type effectiveness against each foe out, in screen order (left to right).
  effectiveness?: EffectivenessChip[]
  // The user's types for the same-type attack bonus: its own (the ones it had before
  // Terastallizing still count), and its Tera type once it has - or will this turn.
  stabTypes?: { own: string[]; tera: string | null }
  onChoose: () => void
}

// 'stab' from its own types, 'tera' from its Tera type alone, 'double' when the Tera
// type is one of its own too (x2 instead of x1.5).
function stabKind(moveType: string, { own, tera }: { own: string[]; tera: string | null }): 'stab' | 'tera' | 'double' | null {
  const fromOwn = own.includes(moveType)
  const fromTera = tera === moveType
  if (fromOwn && fromTera) return 'double'
  if (fromTera) return 'tera'
  return fromOwn ? 'stab' : null
}

const STAB_LABELS = { stab: 'STAB', tera: 'Tera STAB', double: 'STAB ×2' }
const STAB_TITLES = {
  stab: 'Same type as the user: x1.5 power',
  tera: 'Same type as its Tera type: x1.5 power',
  double: 'Its own type and its Tera type: x2 power'
}

function MoveButton({ id, name, pp, maxpp, disabled, power, effectiveness, stabTypes, onChoose }: Props): React.JSX.Element {
  const [info, setInfo] = useState<MoveInfo | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchMoveInfo(id).then((result) => {
      if (!cancelled) setInfo(result)
    })
    return () => {
      cancelled = true
    }
  }, [id])

  const typeClass = info ? `type-${info.type.toLowerCase()}` : ''
  const powerLabel = movePowerLabel(power)
  const stab = info && stabTypes ? stabKind(info.type, stabTypes) : null

  return (
    <Tooltip
      className="move-button-slot"
      // Below rather than above, so it doesn't cover the battle.
      placement="below"
      content={<MoveTooltipContent moveId={id} fallbackName={name} power={power} />}
    >
      <button className={`move-button ${typeClass}`} disabled={disabled} onClick={onChoose}>
        {powerLabel && (
          <span className={`move-power-corner ${power?.dynamic ? 'move-power-live' : ''}`}>{powerLabel}</span>
        )}
        {info && (
          <span className="move-type-corner">
            <img
              className="move-category-icon"
              src={`./sprites/misc/category-${info.category === 'Status' ? 'status' : info.category.toLowerCase()}.png`}
              alt={info.category}
              title={info.category}
            />
            {info.type}
          </span>
        )}
        {stab && info?.category !== 'Status' && (
          <span
            className={`move-stab-corner${stab !== 'stab' ? ' move-stab-tera' : ''}`}
            title={STAB_TITLES[stab]}
          >
            {STAB_LABELS[stab]}
          </span>
        )}
        {effectiveness && effectiveness.length > 0 && (
          <span className="move-eff-corner">
            {effectiveness.map((chip, i) => (
              <span
                key={i}
                className={`eff-chip ${effectivenessClass(chip.multiplier)}`}
                title={`vs ${chip.foeName}: ${effectivenessWords(chip.multiplier)}`}
              >
                {effectivenessText(chip.multiplier)}
              </span>
            ))}
          </span>
        )}
        {name}
        <span className="move-pp">
          {pp}/{maxpp} PP
        </span>
      </button>
    </Tooltip>
  )
}

export default MoveButton
