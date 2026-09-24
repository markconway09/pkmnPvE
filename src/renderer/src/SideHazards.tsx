import type { FieldEffectView } from '../../shared/battle-types'

interface Props {
  hazards: FieldEffectView[]
}

interface Piece {
  image: string
  // Offset from the middle of the ground strip, and height above its bottom
  // edge - scattered by hand the way Showdown scatters its own.
  dx: number
  bottom: number
  width: number
  opacity: number
}

// All semi-transparent because they're drawn over the Pokemon (rocks and the
// web use Showdown's own opacities).
const rock = (image: 'rock1' | 'rock2', dx: number, bottom: number): Piece => ({
  image,
  dx,
  bottom,
  width: 26,
  opacity: 0.5
})
const caltrop = (image: 'caltrop' | 'poisoncaltrop', dx: number, bottom: number): Piece => ({
  image,
  dx,
  bottom,
  width: 26,
  opacity: 0.6
})

// Where each layer of each hazard sits (Showdown's placements for the same
// hazards, flattened to a strip on the floor). Layer n of a stacking hazard
// is piece n - 1, so extra layers only ever add pieces.
const PIECES: Record<string, Piece[]> = {
  stealthrock: [rock('rock1', -40, 10), rock('rock2', -20, 0), rock('rock1', 30, 6), rock('rock2', 10, 2)],
  spikes: [caltrop('caltrop', -25, 2), caltrop('caltrop', 30, -2), caltrop('caltrop', 50, 2)],
  toxicspikes: [caltrop('poisoncaltrop', 5, 2), caltrop('poisoncaltrop', -15, 6)],
  stickyweb: [{ image: 'web', dx: 15, bottom: 4, width: 90, opacity: 0.4 }]
}

const LABELS: Record<string, string> = {
  stealthrock: 'Stealth Rock',
  spikes: 'Spikes',
  toxicspikes: 'Toxic Spikes',
  stickyweb: 'Sticky Web'
}

// Entry hazards on one side of the field, drawn on the ground at that side's
// Pokemon (semi-transparent, over its sprite).
function SideHazards({ hazards }: Props): React.JSX.Element | null {
  const pieces = hazards.flatMap((hazard) => {
    const all = PIECES[hazard.id] ?? []
    const visible = hazard.layers != null ? all.slice(0, hazard.layers) : all
    return visible.map((piece, i) => ({ piece, key: `${hazard.id}-${i}`, hazard }))
  })
  if (pieces.length === 0) return null

  return (
    <div className="side-hazards">
      {pieces.map(({ piece, key, hazard }) => (
        <img
          key={key}
          className="side-hazard-piece"
          src={`./battle/fx/${piece.image}.png`}
          alt=""
          draggable={false}
          title={`${LABELS[hazard.id] ?? hazard.name}${hazard.layers != null ? ` (${hazard.layers} layer${hazard.layers === 1 ? '' : 's'})` : ''}`}
          style={{
            left: `calc(50% + ${piece.dx}px)`,
            bottom: piece.bottom,
            width: piece.width,
            opacity: piece.opacity
          }}
        />
      ))}
    </div>
  )
}

export default SideHazards
