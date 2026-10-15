import { useEffect, useState } from 'react'
import type { MoveInfo, MoveMatchup, PokemonSummary, StatBlock } from '../../shared/battle-types'
import { fetchMoveInfo } from './moveInfoCache'
import { fetchItemSpritenum } from './itemSpritenumCache'
import { itemIconStyle } from './itemIcon'
import { effectivenessClass, effectivenessText, effectivenessWords } from './effectiveness'
import { abilityName, itemName, moveName, natureName, t, typeName } from './i18n'

interface Props {
  // A Pokemon out in battle also carries the stats it has right now (stat stages,
  // item, ability, status and field applied); everywhere else it's just the base stats.
  // It also carries its moves' effectiveness against the foes out.
  pokemon: PokemonSummary & { effectiveStats?: StatBlock; moveMatchups?: Record<string, MoveMatchup[]> }
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
  const stat = (key: ShownStat): React.JSX.Element => {
    const base = pokemon.stats[key]
    const now = current[key]
    return <span className={now > base ? 'stat-up' : now < base ? 'stat-down' : undefined}>{t(`stat.${key}`)} {now}</span>
  }

  return (
    <div className="tooltip-panel pokemon-tooltip">
      <div className="tooltip-title">
        {pokemon.species} <span className="tooltip-level">{t('mon.lv', { level: pokemon.level })}</span>
      </div>
      <div className="tooltip-row">
        {pokemon.types.map((type) => (
          <span key={type} className={`type-badge type-${type.toLowerCase()}`}>
            {typeName(type)}
          </span>
        ))}
      </div>
      <div className="tooltip-row">{t('mon.ability', { name: pokemon.ability ? abilityName(pokemon.ability) : t('mon.unknown') })}</div>
      <div className="tooltip-row tooltip-row-item">
        {itemSpritenum !== null && <span style={itemIconStyle(itemSpritenum)} />}
        {t('mon.item', { name: pokemon.item ? itemName(pokemon.item) : t('mon.none') })}
      </div>
      {pokemon.nature && <div className="tooltip-row">{t('mon.nature', { name: natureName(pokemon.nature) })}</div>}
      {pokemon.teraType && (
        <div className="tooltip-row">
          {t('mon.teraType')}{' '}
          <span className={`type-badge type-${pokemon.teraType.toLowerCase()}`}>{typeName(pokemon.teraType)}</span>
        </div>
      )}
      <div className="tooltip-stats">
        <span>
          {t('stat.hp')} {pokemon.stats.hp}
        </span>
        {stat('atk')}
        {stat('def')}
        {stat('spa')}
        {stat('spd')}
        {stat('spe')}
      </div>
      <div className="tooltip-moves">
        {pokemon.moveIds.map((id, i) => {
          const move = moves[i]
          return (
            <div key={id} className="tooltip-move-line">
              {moveName(move ? move.name : id)}
              {move && <span className={`type-badge tooltip-move-type type-${move.type.toLowerCase()}`}>{typeName(move.type)}</span>}
              {/* In battle: how hard it hits each foe out, left to right as on screen. */}
              {pokemon.moveMatchups?.[id]?.map((chip, n) => (
                <span
                  key={n}
                  className={`eff-chip ${effectivenessClass(chip.multiplier)}`}
                  title={t('eff.vs', { name: chip.foeName, words: effectivenessWords(chip.multiplier) })}
                >
                  {effectivenessText(chip.multiplier)}
                </span>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default PokemonTooltipContent
