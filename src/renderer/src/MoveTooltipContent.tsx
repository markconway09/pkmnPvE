import { useEffect, useState } from 'react'
import type { LiveMovePower, MoveInfo } from '../../shared/battle-types'
import { fetchMoveInfo } from './moveInfoCache'
import { categoryName, movePowerText } from './movePower'
import { moveName, moveText, t, typeName } from './i18n'

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

  if (info === undefined) return <div className="tooltip-panel">{t('common.loading')}</div>
  if (info === null) return <div className="tooltip-panel">{moveName(fallbackName ?? moveId)}</div>

  const type = power?.type ?? info.type
  return (
    <div className="tooltip-panel">
      <div className="tooltip-title">{moveName(info.name)}</div>
      <div className="tooltip-row">
        <span className={`type-badge type-${type.toLowerCase()}`}>{typeName(type)}</span>
        <span className="tooltip-category">{categoryName(info.category)}</span>
      </div>
      <div className="tooltip-row">
        <span>{t('move.power', { n: movePowerText(power, info.basePower) })}</span>
        <span>{t('move.accuracy', { n: info.accuracy === true ? '—' : `${info.accuracy}%` })}</span>
        <span>{t('move.pp', { n: info.pp })}</span>
      </div>
      {info.description && <div className="tooltip-desc">{moveText(info.id, info.description)}</div>}
    </div>
  )
}

export default MoveTooltipContent
