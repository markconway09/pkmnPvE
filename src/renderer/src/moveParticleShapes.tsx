// A small original icon per move type, used by AnimationLayer instead of a
// plain colored dot - the same idea as Showdown's type-flavored effects, but
// original shapes rather than a port of their art. All are drawn on a 24x24
// canvas centered at (12, 12) so they drop straight into the particle
// wrapper AnimationLayer positions and animates.

function regularPolygonPoints(sides: number, radius: number, rotationDeg = 0): string {
  const points: string[] = []
  for (let i = 0; i < sides; i++) {
    const angle = (Math.PI * 2 * i) / sides - Math.PI / 2 + (rotationDeg * Math.PI) / 180
    points.push(`${(12 + radius * Math.cos(angle)).toFixed(2)},${(12 + radius * Math.sin(angle)).toFixed(2)}`)
  }
  return points.join(' ')
}

function starPoints(spikes: number, outerRadius: number, innerRadius: number, rotationDeg = 0): string {
  const points: string[] = []
  const step = Math.PI / spikes
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outerRadius : innerRadius
    const angle = i * step - Math.PI / 2 + (rotationDeg * Math.PI) / 180
    points.push(`${(12 + r * Math.cos(angle)).toFixed(2)},${(12 + r * Math.sin(angle)).toFixed(2)}`)
  }
  return points.join(' ')
}

const NORMAL_STAR = starPoints(5, 9, 4)
const ELECTRIC_BOLT = '13,1 6,13 11,13 9,23 19,10 13,10'
const ICE_HEX = regularPolygonPoints(6, 9)
const FIGHTING_CHEVRON_TOP = '12,2 20,10 15,10 15,16 9,16 9,10 4,10'
// An asymmetric chunk, not a regular/jagged-star silhouette - keeps it
// reading as "rock" rather than "spiky star" next to Rock and Fairy.
const ROCK_CHUNK = '12,2 19,7 20,15 14,21 6,19 3,11'
const BUG_HEX = regularPolygonPoints(6, 9, 30)
const STEEL_DIAMOND = regularPolygonPoints(4, 9)
const FAIRY_SPARKLE = starPoints(4, 10, 2.5)

function shapeFor(type: string): React.JSX.Element {
  switch (type) {
    case 'fire':
      return <path d="M12 1 Q17 8 14 12 Q19 14 16 21 Q12 24 8 21 Q5 14 10 12 Q7 8 12 1 Z" />
    case 'water':
      return <path d="M12 2 C12 2 19 12 19 16 A7 7 0 1 1 5 16 C5 12 12 2 12 2 Z" />
    case 'electric':
      return <polygon points={ELECTRIC_BOLT} />
    case 'grass':
      return (
        <g>
          <ellipse cx="12" cy="12" rx="10" ry="6" transform="rotate(-40 12 12)" />
          <line x1="4" y1="19" x2="19" y2="5" stroke="rgba(0,0,0,0.35)" strokeWidth="1.4" />
        </g>
      )
    case 'ice':
      return (
        <g>
          <polygon points={ICE_HEX} />
          <line x1="12" y1="3" x2="12" y2="21" stroke="rgba(0,0,0,0.3)" strokeWidth="1" />
          <line x1="4" y1="12" x2="20" y2="12" stroke="rgba(0,0,0,0.3)" strokeWidth="1" />
        </g>
      )
    case 'fighting':
      return <polygon points={FIGHTING_CHEVRON_TOP} />
    case 'poison':
      return <path d="M12 3 C16 8 18 13 18 16 A6 6 0 1 1 6 16 C6 13 8 8 12 3 Z" />
    case 'ground':
      return <path d="M4 16 Q4 9 12 8 Q20 9 20 16 Q20 20 12 20 Q4 20 4 16 Z" />
    case 'flying':
      return <path d="M2 15 Q11 2 22 5 Q15 9 20 17 Q11 14 2 15 Z" />
    case 'psychic':
      return (
        <g>
          <ellipse cx="12" cy="12" rx="10" ry="5.5" />
          <circle cx="12" cy="12" r="2.6" fill="#171b22" />
        </g>
      )
    case 'bug':
      return (
        <g>
          <polygon points={BUG_HEX} />
          <line x1="8" y1="4" x2="4" y2="0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="16" y1="4" x2="20" y2="0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </g>
      )
    case 'rock':
      return <polygon points={ROCK_CHUNK} />
    case 'ghost':
      return <path d="M12 2 Q18 6 18 13 L18 18 Q15 15 13 18 Q11 21 9 18 Q7 15 6 18 L6 13 Q6 6 12 2 Z" opacity="0.85" />
    case 'dragon':
      return <path d="M12 2 Q21 6 17 15 Q15 11 11 11 Q9 7 12 2 Z" />
    case 'dark':
      // Two full circles, opposite winding direction, default nonzero fill
      // rule - the inner one (entirely inside the outer) cancels out to a
      // hole instead of adding more fill, leaving a crescent.
      return <path d="M3,12 A9,9 0 1,1 21,12 A9,9 0 1,1 3,12 Z M8,10 A6,6 0 1,0 20,10 A6,6 0 1,0 8,10 Z" />
    case 'steel':
      return <polygon points={STEEL_DIAMOND} />
    case 'fairy':
      return <polygon points={FAIRY_SPARKLE} />
    case 'normal':
      return <polygon points={NORMAL_STAR} />
    default:
      return <circle cx="12" cy="12" r="8" />
  }
}

interface Props {
  type: string
  className?: string
}

function MoveParticleShape({ type, className }: Props): React.JSX.Element {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
      {shapeFor(type)}
    </svg>
  )
}

export default MoveParticleShape
