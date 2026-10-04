import type { BoxPokemonView } from '../../shared/battle-types'
import FitName from './FitName'
import { MERGE_MAX_STARS, mergeBonusText, mergeGrowthHolding, toSpriteId } from '../../shared/battle-types'
import SpriteImage from './SpriteImage'
import ItemSprite from './ItemSprite'
import ShinyIcon from './ShinyIcon'
import { RarityGlow } from './RarityCard'

interface Props {
  mon: BoxPokemonView
}

function PokemonIconVisual({ mon }: Props): React.JSX.Element {
  const spriteId = toSpriteId(mon.species)

  return (
    <>
      {/* The sprite in a glow of its rarity colour - and a fully merged (★5) Pokemon's
          pulsing gold glow behind it too. */}
      <RarityGlow tier={mon.rarityTier ?? 'common'} size={null} className="box-icon-glow">
        {mon.mergeStars === MERGE_MAX_STARS && <span className="box-icon-star-glow" />}
        <SpriteImage
          style="3d-static"
          className="box-icon-img"
          spriteId={spriteId}
          shiny={mon.shiny}
          gmax={mon.gmaxLook}
          alt={mon.species}
          draggable={false}
        />
        {/* Its held item, tucked in beside the sprite - clear of the name below. */}
        {mon.itemSpritenum != null && <ItemSprite spritenum={mon.itemSpritenum} className="box-icon-item" />}
      </RarityGlow>
      {(mon.favorite || mon.shiny || mon.companion) && (
        <span className="box-icon-badges">
          {mon.companion && (
            <span className="box-icon-companion" title="Your companion - it can't be merged into anything while it's in the slot">
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <ellipse cx="8" cy="11" rx="3.6" ry="3" />
                <ellipse cx="3.2" cy="7" rx="1.6" ry="2" />
                <ellipse cx="6.2" cy="3.8" rx="1.6" ry="2.1" />
                <ellipse cx="9.8" cy="3.8" rx="1.6" ry="2.1" />
                <ellipse cx="12.8" cy="7" rx="1.6" ry="2" />
              </svg>
            </span>
          )}
          {mon.favorite && <span className="box-icon-favorite" title="Favorite">❤️</span>}
          {mon.shiny && <ShinyIcon />}
        </span>
      )}
      {!!mon.mergeStars && (
        <span className="box-icon-stars" title={`Merged ★${mon.mergeStars}: ${mergeBonusText(mon.mergeStars, mon.rarityTier, mergeGrowthHolding(mon.mergeGrowth, mon.item))} to all stats in classic battles`}>
          {'★'.repeat(mon.mergeStars)}
        </span>
      )}
      {mon.eligibleEvolutions && mon.eligibleEvolutions.length > 0 && (
        <span className="box-icon-evo">
          ▲
        </span>
      )}
      <FitName className="box-icon-name" text={mon.species} />
      {mon.expPercent !== undefined && (
        <div className="exp-bar-track" title={`${mon.expPercent}% to next level`}>
          <div className="exp-bar-fill" style={{ width: `${mon.expPercent}%` }} />
        </div>
      )}
    </>
  )
}

export default PokemonIconVisual
