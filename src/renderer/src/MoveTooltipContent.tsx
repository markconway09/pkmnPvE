import { useEffect, useState } from 'react'
import type { LiveMovePower, MoveInfo } from '../../shared/battle-types'
import { fetchMoveInfo } from './moveInfoCache'
import { movePowerText } from './movePower'

interface Props {
  moveId: string
  fallbackName?: string
  // What the move hits for right now, in a battle - shown in place of the printed power.
  power?: LiveMovePower
}

function MoveTooltipContent({ moveId, fallbackName, power }: Props): React.JSX.Element {
  const [info, setInfo] = useState<MoveInfo | null | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    setInfo(undefined)
    fetchMoveInfo(moveId).then((result) => {
      if (!cancelled) setInfo(result)
    })
    return () => {
      cancelled = true
    }
  }, [moveId])

  if (info === undefined) return <div className="tooltip-panel">Loading...</div>
  if (info === null) return <div className="tooltip-panel">{fallbackName ?? moveId}</div>

  return (
    <div className="tooltip-panel">
      <div className="tooltip-title">{info.name}</div>
      <div className="tooltip-row">
        <span className={`type-badge type-${info.type.toLowerCase()}`}>{info.type}</span>
        <span className="tooltip-category">{info.category}</span>
      </div>
      <div className="tooltip-row">
        <span>Power: {movePowerText(power, info.basePower)}</span>
        <span>Accuracy: {info.accuracy === true ? '—' : `${info.accuracy}%`}</span>
        <span>PP: {info.pp}</span>
      </div>
      {info.description && <div className="tooltip-desc">{info.description}</div>}
    </div>
  )
}

export default MoveTooltipContent
