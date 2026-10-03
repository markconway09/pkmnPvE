import { useCallback, useEffect, useRef, useState } from 'react'
import type { RarityTier } from '../../shared/battle-types'
import { DEFAULT_SKILL_CHECK, type SkillCheckResult, type SkillCheckSettings } from '../../shared/tms'
import { playClunk, playTick } from './ticks'

export type { SkillCheckResult }

// How long the warning ding plays before the needle starts.
const WARN_MS = 550

const SIZE = 180
const C = SIZE / 2
const R = 62

// A point on the ring, measured clockwise from 12 o'clock.
function polar(r: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180
  return [C + r * Math.sin(rad), C - r * Math.cos(rad)]
}

function arc(r: number, from: number, to: number): string {
  const [x0, y0] = polar(r, from)
  const [x1, y1] = polar(r, to)
  return `M ${x0} ${y0} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x1} ${y1}`
}

// The zone lands somewhere in the lower two thirds of the ring, never right at the start.
const rollZoneStart = (): number => 110 + Math.random() * 170

/** Where the needle stopped, judged against the zone that starts at `zoneStart`. */
export function judgeSkillCheck(angle: number, zoneStart: number, settings: SkillCheckSettings = DEFAULT_SKILL_CHECK): SkillCheckResult {
  if (angle >= zoneStart && angle < zoneStart + settings.greatDeg) return 'great'
  if (angle >= zoneStart && angle < zoneStart + settings.goodDeg) return 'good'
  return 'miss'
}

const RESULT_LABELS: Record<SkillCheckResult, string> = { great: 'GREAT', good: 'GOOD', miss: 'MISSED' }

interface RingProps {
  // Raise it to start a check (0: none yet).
  runKey: number
  settings?: SkillCheckSettings
  // Tints the ring in a rarity colour (a TM search's).
  tier?: RarityTier
  // `timedOut`: the needle went all the way round without a press.
  onDone: (result: SkillCheckResult, timedOut: boolean) => void
  // What the middle says before the first check.
  idleLabel?: string
}

/**
 * One Dead by Daylight style skill check: a ding, then a needle sweeps once around the
 * ring. Space (or a click anywhere on screen) while it's over the zone - the narrow slice at its
 * start is a Great, the rest is Good; anywhere else, or letting it go all the way round,
 * is a miss. Pressing during the ding does nothing, so an early tap can't count.
 */
export function SkillCheckRing({ runKey, settings = DEFAULT_SKILL_CHECK, tier, onDone, idleLabel = '' }: RingProps): React.JSX.Element {
  const [phase, setPhase] = useState<'idle' | 'warn' | 'spin' | 'done'>('idle')
  const [zoneStart, setZoneStart] = useState(rollZoneStart)
  const [result, setResult] = useState<SkillCheckResult | null>(null)
  const [stopAngle, setStopAngle] = useState(0)

  const needleRef = useRef<SVGGElement>(null)
  const angleRef = useRef(0)
  const audioRef = useRef<AudioContext | null>(null)
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  const audio = (): AudioContext => (audioRef.current ??= new AudioContext())
  useEffect(() => () => void audioRef.current?.close(), [])

  useEffect(() => {
    if (runKey <= 0) return
    setZoneStart(rollZoneStart())
    setResult(null)
    setPhase('warn')
  }, [runKey])

  // The ding, then a short wait before the needle's one sweep.
  useEffect(() => {
    if (phase !== 'warn') return
    // A focused button would click again on Space.
    ;(document.activeElement as HTMLElement | null)?.blur?.()
    angleRef.current = 0
    needleRef.current?.setAttribute('transform', `rotate(0 ${C} ${C})`)
    playTick(audio(), 1750, 0.06)
    const t = window.setTimeout(() => setPhase('spin'), WARN_MS)
    return () => window.clearTimeout(t)
  }, [phase])

  const finish = useCallback((res: SkillCheckResult, timedOut = false) => {
    // Straight away, so a key and a click landing together can't both count.
    phaseRef.current = 'done'
    setResult(res)
    setStopAngle(angleRef.current)
    setPhase('done')
    if (res === 'great') {
      playTick(audio(), 1320, 0.07)
      window.setTimeout(() => playTick(audio(), 1980, 0.07), 70)
    } else if (res === 'good') playTick(audio(), 990, 0.06)
    else playClunk(audio())
    onDoneRef.current(res, timedOut)
  }, [])

  useEffect(() => {
    if (phase !== 'spin') return
    let frame = 0
    const began = performance.now()
    const step = (now: number): void => {
      const angle = ((now - began) / settings.spinMs) * 360
      if (angle >= 360) {
        angleRef.current = 360
        finish('miss', true)
        return
      }
      angleRef.current = angle
      needleRef.current?.setAttribute('transform', `rotate(${angle} ${C} ${C})`)
      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [phase, finish, settings.spinMs])

  const press = useCallback(() => {
    if (phaseRef.current === 'spin') finish(judgeSkillCheck(angleRef.current, zoneStart, settings))
  }, [finish, zoneStart, settings])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.code !== 'Space' || e.repeat || phaseRef.current !== 'spin') return
      e.preventDefault()
      press()
    }
    // A click anywhere counts too - except on a button (Give up, Back to menu...).
    const onClick = (e: MouseEvent): void => {
      if (e.button !== 0 || phaseRef.current !== 'spin') return
      if ((e.target as Element | null)?.closest?.('button, input, select, textarea, a')) return
      e.preventDefault()
      press()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onClick)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onClick)
    }
  }, [press])

  const showZone = phase !== 'idle'
  return (
    <svg
      className={`skill-check-ring${result ? ` skill-check-result-${result}` : ''}${tier ? ` skill-check-tier rarity-tier-${tier}` : ''}`}
      width={SIZE}
      height={SIZE}
    >
      <circle className="skill-check-track" cx={C} cy={C} r={R} />
      {showZone && (
        <>
          <path className="skill-check-good" d={arc(R, zoneStart, zoneStart + settings.goodDeg)} />
          <path className="skill-check-great" d={arc(R, zoneStart, zoneStart + settings.greatDeg)} />
        </>
      )}
      <g ref={needleRef} transform={`rotate(${phase === 'done' ? stopAngle : 0} ${C} ${C})`}>
        {showZone && <line className="skill-check-needle" x1={C} y1={C - R + 16} x2={C} y2={C - R - 12} />}
      </g>
      <text className="skill-check-key" x={C} y={C + 5} textAnchor="middle">
        {result ? RESULT_LABELS[result] : phase === 'idle' ? idleLabel : 'SPACE'}
      </text>
    </svg>
  )
}
