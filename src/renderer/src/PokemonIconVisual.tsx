import type { BoxPokemonView } from '../../shared/battle-types'
import { toSpriteId } from '../../shared/battle-types'
import SpriteImage from './SpriteImage'
import ItemSprite from './ItemSprite'

interface Props {
  mon: BoxPokemonView
}

function PokemonIconVisual({ mon }: Props): React.JSX.Element {
  const spriteId = toSpriteId(mon.species)

  return (
    <>
      <SpriteImage
        style="2d-static"
        className="box-icon-img"
        spriteId={spriteId}
        shiny={mon.shiny}
        alt={mon.species}
        draggable={false}
      />
      {mon.itemSpritenum != null && (
        <ItemSprite spritenum={mon.itemSpritenum} className="box-icon-item" />
      )}
      {(mon.favorite || mon.shiny) && (
        <span className="box-icon-badges">
          {mon.favorite && <span title="Favorite">⭐</span>}
          {mon.shiny && <span title="Shiny">✨</span>}
        </span>
      )}
      <span className="box-icon-name">{mon.species}</span>
      {mon.expPercent !== undefined && (
        <div className="exp-bar-track" title={`${mon.expPercent}% to next level`}>
          <div className="exp-bar-fill" style={{ width: `${mon.expPercent}%` }} />
        </div>
      )}
    </>
  )
}

export default PokemonIconVisual
