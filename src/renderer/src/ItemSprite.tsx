import { itemIconStyle } from './itemIcon'

interface Props {
  spritenum: number
  className?: string
}

// Images drawn edge to edge get this much padding so they match the sheet icons,
// which sit inside a margin of their 24px cell.
const SYNTHETIC_PADDING: Record<number, number> = { '-10': 3 }

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
  '-8': './sprites/misc/shinypatch.png', // Shiny Patch (Serebii's Ability Patch icon)
  '-9': './sprites/misc/lockcapsule.png', // Lock Capsule (Serebii)
  '-10': './sprites/misc/gsball.png', // Random Pokemon (Serebii's GS Ball)
  '-11': './sprites/misc/rotomcatalog.png', // Rotom Catalog (Serebii)
  '-12': './sprites/misc/expcharm.png', // Exp. Charm (Serebii)
  '-13': './sprites/misc/shinycharm.png', // Shiny Charm (Serebii)
  '-14': './sprites/misc/nsolarizer.png', // N-Solarizer (Serebii)
  '-15': './sprites/misc/nlunarizer.png', // N-Lunarizer (Serebii)
  '-16': './sprites/misc/dnasplicers.png', // DNA Splicers (Serebii)
  '-17': './sprites/misc/reinsofunity.png', // Reins of Unity (Serebii)
  '-18': './sprites/misc/friendshipcharm.png', // Friendship Charm (Serebii's Oval Charm)
  '-19': './sprites/misc/catchingcharm.png', // Catching Charm (Serebii)
  '-20': './sprites/misc/itemcharm.png', // Item Charm (Serebii's Mark Charm)
  '-21': './sprites/misc/prisonbottle.png', // Prison Bottle (Serebii)
  '-22': './sprites/misc/revealglass.png', // Reveal Glass (Serebii)
  '-23': './sprites/misc/gracidea.png', // Gracidea (Serebii)
  '-24': './sprites/misc/meteorite.png', // Meteorite (Serebii)
  '-25': './sprites/misc/zygardecube.png', // Zygarde Cube (Serebii)
  '-26': './sprites/misc/raidcrystal.png', // Raid Crystal (Serebii's Crystal Cluster)
  '-27': './sprites/misc/decorationbox.png', // Decoration Box (Serebii's Apricorn Box)
  '-28': './sprites/misc/fashioncase.png', // Fashion Case (Serebii)
  '-29': './sprites/misc/scanner.png', // Scanner
  '-30': './sprites/misc/dexnav.png', // DexNav (Bulbagarden Archives)
  '-31': './sprites/misc/friendshippetal.png', // Friendship Petal (Serebii's Pink Petal)
  '-32': './sprites/misc/maxmushrooms.png', // Max Mushrooms (Serebii)
  // Horde mode's held items with no Showdown sprite, its gold and its chests (all Serebii).
  '-33': './sprites/misc/hpup.png', // HP Up
  '-34': './sprites/misc/protein.png', // Protein
  '-35': './sprites/misc/iron.png', // Iron
  '-36': './sprites/misc/carbos.png', // Carbos
  '-37': './sprites/misc/luckyegg.png', // Lucky Egg
  '-38': './sprites/misc/amuletcoin.png', // Amulet Coin
  '-39': './sprites/misc/relicgold.png', // Relic Gold - Horde mode's gold
  '-40': './sprites/misc/machinepart.png', // Machine Part - Horde mode's chests
  '-41': './sprites/misc/expshare.png', // Exp. Share
  '-42': './sprites/misc/reliccrown.png', // Relic Crown
  '-43': './sprites/misc/luckincense.png', // Luck Incense
  '-44': './sprites/misc/cardkey.png', // Card Key
  '-45': './sprites/misc/pearlstring.png', // Pearl String
  '-46': './sprites/misc/oddkeystone.png' // Odd Keystone
}

function ItemSprite({ spritenum, className }: Props): React.JSX.Element {
  const src = SYNTHETIC_SPRITES[spritenum]
  if (src) {
    return <img className={className} src={src} alt="" style={{
          width: 24,
          height: 24,
          padding: SYNTHETIC_PADDING[spritenum] ?? 0,
          boxSizing: 'border-box',
          objectFit: 'contain',
          flexShrink: 0
        }} />
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
