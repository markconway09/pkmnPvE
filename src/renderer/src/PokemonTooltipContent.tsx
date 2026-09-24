import { useEffect, useState } from 'react'
import type { MoveInfo, PokemonSummary, StatBlock } from '../../shared/battle-types'
import { fetchMoveInfo } from './moveInfoCache'
import { fetchItemSpritenum } from './itemSpritenumCache'
import { itemIconStyle } from './itemIcon'

interface Props {
  // A Pokemon out in battle also carries the stats it has right now (stat stages,
  // item, ability, status and field applied); everywhere else it's just the base stats.
  pokemon: PokemonSummary & { effectiveStats?: StatBlock }
}

type ShownStat = 'atk' | 'def' | 'spa' | 'spd' | 'spe'

function PokemonTooltipContent({ pokemon }: Props): React.JSX.Element {
  const [moves, setMoves] = useState<(MoveInfo | null)[]>([])
  const [itemSpritenum, setItemSpritenum] = useState<number | null>(null)
  const moveKey = pokemon.moveIds.join(',')

  useEffect(() => {
    let cancelled = false
    Promise.all(pokemon.moveIds.map((id) => fetchMoveInfo(id))).then((results) => {
      if (!cancelled) setMoves(results)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moveKey])

  useEffect(() => {
    let cancelled = false
    setItemSpritenum(null)
    if (pokemon.item) {
      fetchItemSpritenum(pokemon.item).then((num) => {
        if (!cancelled) setItemSpritenum(num)
      })
    }
    return () => {
      cancelled = true
    }
  }, [pokemon.item])

  // Green when a stat is currently above what it normally is, red when below.
  const current = pokemon.effectiveStats ?? pokemon.stats
  const stat = (label: string, key: ShownStat): React.JSX.Element => {
    const base = pokemon.stats[key]
    const now = current[key]
    return <span className={now > base ? 'stat-up' : now < base ? 'stat-down' : undefined}>{label} {now}</span>
  }

  return (
    <div className="tooltip-panel pokemon-tooltip">
      <div className="tooltip-title">
        {pokemon.species} <span className="tooltip-level">Lv. {pokemon.level}</span>
      </div>
      <div className="tooltip-row">
        {pokemon.types.map((t) => (
          <span key={t} className={`type-badge type-${t.toLowerCase()}`}>
            {t}
          </span>
        ))}
      </div>
      <div className="tooltip-row">Ability: {pokemon.ability || 'Unknown'}</div>
      <div className="tooltip-row tooltip-row-item">
        {itemSpritenum !== null && <span style={itemIconStyle(itemSpritenum)} />}
        Item: {pokemon.item || 'None'}
      </div>
      {pokemon.nature && <div className="tooltip-row">Nature: {pokemon.nature}</div>}
      {pokemon.teraType && (
        <div className="tooltip-row">
          Tera Type: <span className={`type-badge type-${pokemon.teraType.toLowerCase()}`}>{pokemon.teraType}</span>
        </div>
      )}
      <div className="tooltip-stats">
        <span>HP {pokemon.stats.hp}</span>
        {stat('Atk', 'atk')}
        {stat('Def', 'def')}
        {stat('SpA', 'spa')}
        {stat('SpD', 'spd')}
        {stat('Spe', 'spe')}
      </div>
      <div className="tooltip-moves">
        {pokemon.moveIds.map((id, i) => (
          <div key={id} className="tooltip-move-line">
            {moves[i] ? `${moves[i]!.name} (${moves[i]!.type})` : id}
          </div>
        ))}
      </div>
    </div>
  )
}

export default PokemonTooltipContent
