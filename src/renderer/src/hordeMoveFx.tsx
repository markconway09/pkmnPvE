// Horde moves' own looks (see HordeMoveAnim in shared/horde-moves.ts): what a strike looks
// like coming down, what it leaves as it lands, what a shot looks like, and a melee hit's mark.
// The arena places each piece; this draws it. The styles are the .horde-fx-* rules in styles.css.
import type { HordeMoveAnim } from '../../shared/horde'
import { MeleeMarkShape } from './moveParticleShapes'

// Strikes that fall at an angle from far off (they take longer to come down).
export const METEOR_ANIMS: HordeMoveAnim[] = ['meteor', 'iceMeteor', 'rockfall']
// Strikes that burst up out of the ground.
export const ERUPT_ANIMS: HordeMoveAnim[] = ['ground', 'spikes', 'shadow']
// Melee hits' marks.
export const MARK_ANIMS: HordeMoveAnim[] = ['slash', 'fist', 'kick', 'bite', 'horn', 'cross', 'slam']
// Shots' looks.
const SHOT_ANIMS: HordeMoveAnim[] = ['orb', 'star', 'leaf', 'coin', 'needle', 'bubble', 'rock']

/** The extra class a shot gets for its move's look (none for the plain glowing orb). */
export function hordeShotClass(anim: HordeMoveAnim | undefined): string {
  return anim && SHOT_ANIMS.includes(anim) ? ` horde-fx-shot-${anim}` : ''
}

/** What a strike with this look leaves as it lands: a bolt, a burst from below, a crater or a swirl (else the usual flash). */
export function hordeLandingKind(anim: HordeMoveAnim | undefined): 'bolt' | 'erupt' | 'crater' | 'vortex' | null {
  if (anim === 'sky') return 'bolt'
  if (anim && ERUPT_ANIMS.includes(anim)) return 'erupt'
  if (anim && METEOR_ANIMS.includes(anim)) return 'crater'
  if (anim === 'vortex') return 'vortex'
  return null
}

// A jagged lightning bolt's points down a 40 x 100 box, the same each time for the same seed.
function boltPoints(seed: number): string {
  let s = (seed * 9301 + 49297) % 233280
  const rand = (): number => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
  const points: string[] = ['20,0']
  let x = 20
  for (let y = 9; y < 100; y += 9) {
    x = Math.max(6, Math.min(34, x + (rand() - 0.5) * 22))
    points.push(`${x.toFixed(1)},${y}`)
  }
  points.push('20,100')
  return points.join(' ')
}

/**
 * A strike on its way down, by its look: a meteor (or block of ice, or rock) falling at an angle,
 * a crack spreading at the foe's feet before something bursts out, a charge crackling round it
 * before the bolt - or, for any other, the usual streak falling onto a mark.
 */
export function HordeStrikeFx({ anim, style }: { anim: HordeMoveAnim | undefined; style: React.CSSProperties }): React.JSX.Element {
  if (anim && METEOR_ANIMS.includes(anim))
    return (
      <span className={`horde-fx-fall horde-fx-fall-${anim}`} style={style}>
        <span className="horde-fx-fall-rock" />
        <span className="horde-fx-fall-shadow" />
      </span>
    )
  if (anim && ERUPT_ANIMS.includes(anim)) return <span className={`horde-fx-crack horde-fx-crack-${anim}`} style={style} />
  if (anim === 'sky') return <span className="horde-fx-charge" style={style} />
  return <span className="horde-strike" style={style} />
}

/**
 * A move's look as it lands: a lightning bolt from the top of the screen down to the foe
 * (heightPx tall), a burst up out of the ground, a crater with flying debris, a swirl round
 * the foe, or a melee hit's mark.
 */
export function HordeFlashFx({
  kind,
  anim,
  seed,
  heightPx,
  style
}: {
  kind: 'bolt' | 'erupt' | 'crater' | 'vortex' | 'mark'
  anim: HordeMoveAnim | undefined
  seed: number
  heightPx: number
  style: React.CSSProperties
}): React.JSX.Element | null {
  switch (kind) {
    case 'bolt':
      return (
        <span className="horde-fx-bolt" style={{ ...style, height: `${Math.max(120, heightPx)}px` }}>
          <svg viewBox="0 0 40 100" preserveAspectRatio="none">
            <polyline className="horde-fx-bolt-glow" points={boltPoints(seed)} />
            <polyline className="horde-fx-bolt-core" points={boltPoints(seed)} />
          </svg>
          <span className="horde-fx-bolt-flash" />
        </span>
      )
    case 'erupt':
      return (
        <span className={`horde-fx-erupt horde-fx-erupt-${anim ?? 'ground'}`} style={style}>
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="horde-fx-erupt-spike" style={{ '--i': i } as React.CSSProperties} />
          ))}
          <span className="horde-fx-erupt-dust" />
        </span>
      )
    case 'crater':
      return (
        <span className={`horde-fx-crater horde-fx-crater-${anim ?? 'meteor'}`} style={style}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span key={i} className="horde-fx-debris" style={{ '--i': i } as React.CSSProperties} />
          ))}
        </span>
      )
    case 'vortex':
      return <span className="horde-fx-vortex" style={style} />
    case 'mark':
      return (
        <span className={`horde-fx-mark horde-fx-mark-${anim ?? 'slam'}`} style={{ ...style, '--turn': `${(seed * 47) % 60 - 30}deg` } as React.CSSProperties}>
          {anim === 'slash' || anim === 'fist' || anim === 'kick' || anim === 'bite' ? (
            <MeleeMarkShape mark={anim} />
          ) : anim === 'cross' ? (
            <>
              <MeleeMarkShape mark="slash" />
              <span className="horde-fx-mark-cross">
                <MeleeMarkShape mark="slash" />
              </span>
            </>
          ) : anim === 'horn' ? (
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 21 Q8 12 20 3 Q15 13 7 22 Z" />
            </svg>
          ) : (
            <span className="horde-fx-mark-ring" />
          )}
        </span>
      )
  }
}
