// A small original icon per move type, used by AnimationLayer instead of a
// plain colored dot - the same idea as Showdown's type-flavored effects, but
// original shapes rather than a port of their art. Each is a bold silhouette
// that reads at a glance (flame, drop, bolt, leaf, snowflake, fist...), drawn
// on a 24x24 canvas centered at (12, 12) and filled with currentColor, so the
// wrapper AnimationLayer positions and animates sets its type color. Also the
// marks a contact move leaves on its target (slash, fist, kick, bite) and the
// stat arrows a stat move shows.
import type { MeleeMark } from './moveAnimations'

// Darker detail lines drawn over a shape (a leaf's vein, a rock's facets...).
const DETAIL = 'rgba(0,0,0,0.35)'

function starPoints(spikes: number, outerRadius: number, innerRadius: number, cx = 12, cy = 12): string {
  const points: string[] = []
  const step = Math.PI / spikes
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outerRadius : innerRadius
    const angle = i * step - Math.PI / 2
    points.push(`${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`)
  }
  return points.join(' ')
}

// A gear's outline: a ring of flat-topped teeth around a solid wheel.
function gearPoints(teeth: number, innerRadius: number, outerRadius: number): string {
  const points: string[] = []
  for (let i = 0; i < teeth; i++) {
    const a = (Math.PI * 2 * i) / teeth
    for (const [r, da] of [
      [innerRadius, -0.3],
      [outerRadius, -0.17],
      [outerRadius, 0.17],
      [innerRadius, 0.3]
    ]) {
      points.push(`${(12 + r * Math.cos(a + da)).toFixed(2)},${(12 + r * Math.sin(a + da)).toFixed(2)}`)
    }
  }
  return points.join(' ')
}

// A snowflake's six arms, each with a little V of branches partway out.
function snowflakeLines(): Array<[number, number, number, number]> {
  const lines: Array<[number, number, number, number]> = []
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI * 2 * i) / 6 - Math.PI / 2
    const tip = { x: 12 + 10.5 * Math.cos(a), y: 12 + 10.5 * Math.sin(a) }
    lines.push([12, 12, tip.x, tip.y])
    const base = { x: 12 + 6 * Math.cos(a), y: 12 + 6 * Math.sin(a) }
    for (const side of [-1, 1]) {
      const b = a + side * 0.75
      lines.push([base.x, base.y, base.x + 4 * Math.cos(b), base.y + 4 * Math.sin(b)])
    }
  }
  return lines
}

// A tapered slash stroke from bottom-left to top-right, shifted sideways by `offset`.
function slashPath(offset: number): string {
  const o = (v: number): string => (v + offset).toFixed(2)
  return `M${o(4)} ${o(18)} Q${o(8.6)} ${o(8.6)} ${o(19)} ${o(4)} Q${o(13.4)} ${o(13.4)} ${o(4)} ${o(18)} Z`
}

// A classic five-pointed star, nudged down a little so it sits centred (its
// bottom points don't reach as far as its top one).
const NORMAL_STAR = starPoints(5, 11.5, 4.6, 12, 13)
const ELECTRIC_BOLT = '15,1 4,14 11,14 8,23 20,9 13,9 17,1'
const ROCK_CHUNK = '12,1 20,5 23,13 18,21 8,22 2,15 4,6'
const STEEL_GEAR = gearPoints(8, 8.2, 11.5)
const FAIRY_SPARKLE = starPoints(4, 11, 2.8, 11, 13)
const FAIRY_SPARKLE_SMALL = starPoints(4, 4.5, 1.2, 19.5, 4.5)
const SNOWFLAKE = snowflakeLines()
const FIST_PATH = 'M4 9 Q4 5 8 5 L17 5 Q21 5 21 9 L21 15 Q21 21 15 21 L10 21 Q4 21 4 15 Z'

function fist(): React.JSX.Element {
  return (
    <g>
      <path d={FIST_PATH} />
      <line x1="9" y1="5.5" x2="9" y2="10" stroke={DETAIL} strokeWidth="1.3" />
      <line x1="13" y1="5.5" x2="13" y2="10" stroke={DETAIL} strokeWidth="1.3" />
      <line x1="17" y1="5.5" x2="17" y2="10" stroke={DETAIL} strokeWidth="1.3" />
      <path d="M4.5 12.5 L12 12.5 Q14 12.5 14 14.5 Q14 16.5 12 16.5 L6 16.5" fill="none" stroke={DETAIL} strokeWidth="1.3" />
    </g>
  )
}

function shapeFor(type: string): React.JSX.Element {
  switch (type) {
    case 'fire':
      return (
        <g>
          <path d="M12 1 C13 6 19 8 19 15 A7 7 0 0 1 5 15 C5 11 8 9 8 5 C10 8 10 10 11 11 C12 8 12 4 12 1 Z" />
          <path d="M12 12 C14 14 15.5 15.5 15.5 17.5 A3.5 3.5 0 0 1 8.5 17.5 C8.5 15.5 10.5 14 12 12 Z" fill="rgba(255,236,140,0.8)" />
        </g>
      )
    case 'water':
      return (
        <g>
          <path d="M12 1 C12 1 20 11 20 15.5 A8 8 0 0 1 4 15.5 C4 11 12 1 12 1 Z" />
          <path d="M8 16 Q8 12.5 10.5 10" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.8" strokeLinecap="round" />
        </g>
      )
    case 'electric':
      return <polygon points={ELECTRIC_BOLT} />
    case 'grass':
      return (
        <g>
          <path d="M3 21 Q2 5 21 3 Q20 21 3 21 Z" />
          <path d="M3.5 20.5 L16 8" stroke={DETAIL} strokeWidth="1.4" />
          <path d="M8 15.5 L8 10.5 M11.5 12 L11.5 7.5 M8 15.5 L13 15.5 M11.5 12 L16 12" stroke={DETAIL} strokeWidth="1.1" />
        </g>
      )
    case 'ice':
      return (
        <g stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
          {SNOWFLAKE.map(([x1, y1, x2, y2], i) => (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
          ))}
        </g>
      )
    case 'fighting':
      return fist()
    case 'poison':
      return (
        <g>
          <path d="M12 1 C17 8 20 12 20 15.5 A8 8 0 1 1 4 15.5 C4 12 7 8 12 1 Z" />
          <circle cx="9" cy="15" r="2" fill={DETAIL} />
          <circle cx="15" cy="15" r="2" fill={DETAIL} />
          <path d="M9.5 19.5 L14.5 19.5" stroke={DETAIL} strokeWidth="1.4" />
        </g>
      )
    case 'ground':
      return (
        <g>
          <path d="M1 21 Q3 12 9 11 Q11 6 15.5 7 Q22 9 23 21 Z" />
          <path d="M12 21 L13 16 L11 13 M18 21 L17 15.5" fill="none" stroke={DETAIL} strokeWidth="1.3" />
          <circle cx="5" cy="6" r="1.8" />
          <circle cx="19.5" cy="3.5" r="1.4" />
        </g>
      )
    case 'flying':
      return (
        <g>
          <path d="M20 2 Q8 4 5 15 L3 22 L5 22 L7.5 17 Q19 15 20 2 Z" />
          <path d="M4.5 21 L17 5" stroke={DETAIL} strokeWidth="1.3" />
        </g>
      )
    case 'psychic':
      return (
        <g>
          <path d="M1 12 Q12 2 23 12 Q12 22 1 12 Z" />
          <circle cx="12" cy="12" r="4.2" fill="#171b22" />
          <circle cx="12" cy="12" r="1.6" />
        </g>
      )
    case 'bug':
      return (
        <g>
          <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <line x1="7" y1="10" x2="2" y2="8" />
            <line x1="6.5" y1="14" x2="1.5" y2="14" />
            <line x1="7" y1="18" x2="2.5" y2="21" />
            <line x1="17" y1="10" x2="22" y2="8" />
            <line x1="17.5" y1="14" x2="22.5" y2="14" />
            <line x1="17" y1="18" x2="21.5" y2="21" />
          </g>
          <circle cx="12" cy="5" r="3" />
          <ellipse cx="12" cy="14.5" rx="5.8" ry="7.5" />
          <line x1="12" y1="8" x2="12" y2="22" stroke={DETAIL} strokeWidth="1.2" />
        </g>
      )
    case 'rock':
      return (
        <g>
          <polygon points={ROCK_CHUNK} />
          <path d="M12 1 L11 11 L23 13 M11 11 L8 22 M11 11 L2 15" fill="none" stroke={DETAIL} strokeWidth="1.2" />
        </g>
      )
    case 'ghost':
      return (
        <g>
          <path d="M12 2 Q19.5 2 19.5 10 L19.5 22 L16.5 19 L14 22 L12 19 L10 22 L7.5 19 L4.5 22 L4.5 10 Q4.5 2 12 2 Z" />
          <ellipse cx="9.3" cy="10" rx="1.6" ry="2.3" fill="#171b22" />
          <ellipse cx="14.7" cy="10" rx="1.6" ry="2.3" fill="#171b22" />
        </g>
      )
    case 'dragon':
      // Three curved talons raking down.
      return (
        <g>
          <path d="M3 2 Q10 8 7 22 Q6 12 1 7 Z" />
          <path d="M9 2 Q16 8 13 22 Q12 12 7 7 Z" />
          <path d="M15 2 Q22 8 19 22 Q18 12 13 7 Z" />
        </g>
      )
    case 'dark':
      // Two full circles, opposite winding direction, default nonzero fill
      // rule - the inner one (entirely inside the outer) cancels out to a
      // hole instead of adding more fill, leaving a crescent.
      return <path d="M2,12 A10,10 0 1,1 22,12 A10,10 0 1,1 2,12 Z M8,9.5 A6.5,6.5 0 1,0 21,9.5 A6.5,6.5 0 1,0 8,9.5 Z" />
    case 'steel':
      return (
        <g>
          <polygon points={STEEL_GEAR} />
          <circle cx="12" cy="12" r="3.2" fill={DETAIL} />
        </g>
      )
    case 'fairy':
      return (
        <g>
          <polygon points={FAIRY_SPARKLE} />
          <polygon points={FAIRY_SPARKLE_SMALL} />
        </g>
      )
    case 'normal':
      return <polygon points={NORMAL_STAR} />
    default:
      return <circle cx="12" cy="12" r="9" />
  }
}

function markShape(mark: MeleeMark): React.JSX.Element {
  switch (mark) {
    case 'slash':
      return (
        <g>
          <path d={slashPath(-3.5)} />
          <path d={slashPath(0)} />
          <path d={slashPath(3.5)} />
        </g>
      )
    case 'fist':
      return fist()
    case 'kick':
      return (
        <g>
          <path d="M6 2 L14 2 L14 12 Q22 12 22 18 L22 21 L6 21 Q4 21 4 19 L4 4 Q4 2 6 2 Z" />
          <line x1="4.5" y1="17.5" x2="21.5" y2="17.5" stroke={DETAIL} strokeWidth="1.3" />
        </g>
      )
    case 'bite':
      return (
        <g>
          <polygon points="2,3 22,3 22,5 19,11 16,5 13,11 10,5 7,11 4,5 2,5" />
          <polygon points="2,21 22,21 22,19 19,13 16,19 13,13 10,19 7,13 4,19 2,19" />
        </g>
      )
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

/** A contact move's mark on its target: claw slashes, a fist, a boot or a bite. */
export function MeleeMarkShape({ mark }: { mark: MeleeMark }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
      {markShape(mark)}
    </svg>
  )
}

/** A stat arrow - pointing up for a boost, down for a drop. */
export function StatArrowShape({ dir }: { dir: 'up' | 'down' }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
      <polygon points="12,2 21,11 15.5,11 15.5,22 8.5,22 8.5,11 3,11" transform={dir === 'down' ? 'rotate(180 12 12)' : undefined} />
    </svg>
  )
}

export default MoveParticleShape
