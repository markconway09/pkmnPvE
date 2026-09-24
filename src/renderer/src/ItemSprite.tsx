import { itemIconStyle } from './itemIcon'

interface Props {
  spritenum: number
  className?: string
}

// Negative spritenums are sentinels for items with no real Showdown sprite
// (synthetic items this project made up) - shown from a standalone vendored
// image instead of a slice of the sheet.
const SYNTHETIC_SPRITES: Record<number, string> = {
  '-1': './sprites/misc/linkcable.png', // Link Cable
  '-2': './sprites/misc/rarecandy.png', // Rare Candy
  '-3': './sprites/misc/blackaugurite.png', // Black Augurite (Serebii)
  '-4': './sprites/misc/peatblock.png', // Peat Block (Serebii)
  '-5': './sprites/misc/expcandys.png', // Exp. Candy S
  '-6': './sprites/misc/expcandym.png', // Exp. Candy M
  '-7': './sprites/misc/expcandyl.png', // Exp. Candy L
  '-8': './sprites/misc/shinypatch.png' // Shiny Patch (Serebii's Ability Patch icon)
}

function ItemSprite({ spritenum, className }: Props): React.JSX.Element {
  const src = SYNTHETIC_SPRITES[spritenum]
  if (src) {
    return <img className={className} src={src} alt="" style={{ width: 24, height: 24, objectFit: 'contain', flexShrink: 0 }} />
  }
  // A made-up item that hasn't been given an image yet.
  if (spritenum < 0) {
    return (
      <span className={className} style={{ display: 'inline-flex', width: 24, height: 24, alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
        ❓
      </span>
    )
  }
  return <span className={className} style={itemIconStyle(spritenum)} />
}

export default ItemSprite
