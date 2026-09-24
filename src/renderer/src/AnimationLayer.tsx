import { useEffect, useRef, useState, type RefObject } from 'react'
import type { MoveEvent } from '../../shared/battle-types'
import { animationFor, REP_STAGGER_MS, TYPE_COLORS } from './moveAnimations'
import { fetchMoveInfo } from './moveInfoCache'
import MoveParticleShape from './moveParticleShapes'

interface Props {
  // A ref to .battle-field - effects are positioned relative to it, and
  // measured against the real sprite elements inside it (see BattleSprite's
  // own data-slot attribute).
  fieldRef: RefObject<HTMLDivElement | null>
  trigger: MoveEvent | null
  onDone: () => void
}

interface Point {
  x: number
  y: number
}

interface FlyingParticle extends Point {
  id: number
  type: string
  toX: number
  toY: number
  // The midpoint the particle actually passes through - offset to one side
  // of the straight line for a projectile (a gentle arc, not a dead-straight
  // shot), equal to the plain midpoint for a burst-ring particle (which
  // should still travel straight out).
  midX: number
  midY: number
  delayMs: number
  durationMs: number
  // A shot's trailing sparks are smaller/fainter than its leader - see
  // .anim-particle-trail.
  trail: boolean
}

function slotElement(field: HTMLDivElement, slot: string): HTMLElement | null {
  return field.querySelector(`.sprite-image-wrap[data-slot="${slot}"]`)
}

// The element's center, in pixels relative to the field - not the viewport,
// since the field itself can be anywhere on screen.
// Where a move that misses goes instead, like Showdown's own miss animations: past
// the target, off to one side of it (a random side), rather than into it.
const MISS_SIDE_PX = 70
const MISS_OVERSHOOT_PX = 35
function missPoint(from: Point, to: Point): Point {
  const dist = Math.hypot(to.x - from.x, to.y - from.y) || 1
  const dx = (to.x - from.x) / dist
  const dy = (to.y - from.y) / dist
  const side = Math.random() < 0.5 ? -1 : 1
  return {
    x: to.x - dy * MISS_SIDE_PX * side + dx * MISS_OVERSHOOT_PX,
    y: to.y + dx * MISS_SIDE_PX * side + dy * MISS_OVERSHOOT_PX
  }
}

function centerOf(el: HTMLElement, field: HTMLDivElement): Point {
  const r = el.getBoundingClientRect()
  const fr = field.getBoundingClientRect()
  return { x: r.left + r.width / 2 - fr.left, y: r.top + r.height / 2 - fr.top }
}

function jitter(px: number): number {
  return (Math.random() - 0.5) * 2 * px
}

// The point a particle passes through halfway along its flight - the plain
// midpoint (bowPx 0, used for a burst ring) or offset to one side of it by
// bowPx along the perpendicular (used for a projectile, so it arcs instead
// of flying in a straight line).
function arcMidpoint(from: Point, to: Point, bowPx: number): Point {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const dist = Math.hypot(dx, dy) || 1
  const perpX = -dy / dist
  const perpY = dx / dist
  return { x: (from.x + to.x) / 2 + perpX * bowPx, y: (from.y + to.y) / 2 + perpY * bowPx }
}

const MAX_LUNGE_PX = 40
// A projectile shot is a small cluster, not one lone dot: the real particle,
// plus this many smaller trailing sparks a beat behind it.
const TRAIL_COUNT = 2
const TRAIL_DELAY_MS = 45
const TRAIL_JITTER_PX = 9
// How far a projectile's flight path bows to one side, relative to its
// travel distance - capped so a long-range shot doesn't arc absurdly wide.
const ARC_BOW_FACTOR = 0.2
const ARC_BOW_MAX_PX = 50
// A status move's burst is a ring of the type's particle expanding outward
// from the user, instead of one dot scaling in place.
const BURST_RING_COUNT = 6
const BURST_RING_RADIUS = 42
// How long the target's impact-flash overlay (see styles.css) stays on, and
// the field-wide flash/shake that goes with it.
const IMPACT_FLASH_MS = 260
const IMPACT_FLASH_CLASS = 'impact-flash'
const IMPACT_SHAKE_MS = 320
const IMPACT_SHAKE_CLASS = 'impact-shake'
const FIELD_FLASH_MS = 320
const FIELD_FLASH_CLASS = 'field-flash-active'
const FIELD_SHAKE_MS = 360
const FIELD_SHAKE_CLASS = 'battle-field-shake'

/**
 * Plays a move's animation over the battle field, worked out from the move's
 * own data (see moveAnimations.ts) rather than a hand-authored table, so it
 * covers the whole move list: a type-shaped particle cluster arcing toward
 * each target (see moveParticleShapes.tsx) with an impact flash and a bit of
 * recoil on arrival, a ring of that same shape bursting outward from the
 * user for a status move, or - for a contact move - the user's own sprite
 * dashing into its target and back, flashing it at the moment of impact. A
 * hard enough hit also flashes/shakes the whole field, not just the target.
 * Repeats (staggered) for a multi-hit move.
 */
function AnimationLayer({ fieldRef, trigger, onDone }: Props): React.JSX.Element | null {
  const [particles, setParticles] = useState<FlyingParticle[]>([])
  const idRef = useRef(0)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const meleeElRef = useRef<HTMLElement | null>(null)
  const spriteFxElsRef = useRef<HTMLElement[]>([])
  const fieldFxRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!trigger) return
    let cancelled = false

    const clearTimers = (): void => {
      for (const t of timersRef.current) clearTimeout(t)
      timersRef.current = []
    }

    const finish = (): void => {
      clearTimers()
      if (meleeElRef.current) {
        meleeElRef.current.classList.remove('anim-melee-lunge')
        meleeElRef.current = null
      }
      for (const el of spriteFxElsRef.current) el.classList.remove(IMPACT_FLASH_CLASS, IMPACT_SHAKE_CLASS)
      spriteFxElsRef.current = []
      if (fieldFxRef.current) {
        fieldFxRef.current.classList.remove(FIELD_FLASH_CLASS, FIELD_SHAKE_CLASS)
        fieldFxRef.current = null
      }
      setParticles([])
      onDone()
    }

    // Flashes and shakes the target at the moment a hit actually lands, not
    // when the animation starts - scheduled relative to this trigger's own
    // timers so it's cleaned up the same way as everything else.
    const impactAt = (el: HTMLElement | null, delayMs: number): void => {
      if (!el) return
      const timer = setTimeout(() => {
        el.classList.add(IMPACT_FLASH_CLASS, IMPACT_SHAKE_CLASS)
        spriteFxElsRef.current.push(el)
        timersRef.current.push(setTimeout(() => el.classList.remove(IMPACT_FLASH_CLASS), IMPACT_FLASH_MS))
        timersRef.current.push(setTimeout(() => el.classList.remove(IMPACT_SHAKE_CLASS), IMPACT_SHAKE_MS))
      }, delayMs)
      timersRef.current.push(timer)
    }

    // Once per trigger (not once per hit) - a wash over the whole field at
    // the first landed hit, tinted by the move's type; a hard-hitting move
    // also gives the field itself a brief shake.
    const fieldImpactAt = (field: HTMLDivElement, type: string, delayMs: number, shake: boolean): void => {
      const timer = setTimeout(() => {
        field.style.setProperty('--flash-color', TYPE_COLORS[type] ?? TYPE_COLORS.normal)
        field.classList.add(FIELD_FLASH_CLASS)
        if (shake) field.classList.add(FIELD_SHAKE_CLASS)
        fieldFxRef.current = field
        timersRef.current.push(setTimeout(() => field.classList.remove(FIELD_FLASH_CLASS), FIELD_FLASH_MS))
        if (shake) timersRef.current.push(setTimeout(() => field.classList.remove(FIELD_SHAKE_CLASS), FIELD_SHAKE_MS))
      }, delayMs)
      timersRef.current.push(timer)
    }

    const field = fieldRef.current
    if (!field) {
      finish()
      return
    }

    void fetchMoveInfo(trigger.moveId).then((info) => {
      if (cancelled) return
      const recipe = info ? animationFor(info) : null
      if (!recipe || recipe.none) {
        finish()
        return
      }

      const attackerEl = slotElement(field, trigger.attackerSlot)
      if (!attackerEl) {
        finish()
        return
      }
      const from = centerOf(attackerEl, field)
      const totalMs = recipe.durationMs + (recipe.reps - 1) * REP_STAGGER_MS

      if (recipe.kind === 'melee') {
        const targetSlot = trigger.targetSlots[0] ?? trigger.attackerSlot
        const targetEl = slotElement(field, targetSlot)
        // A miss dashes off past its side instead - and lands nothing.
        const meleeMissed = !!trigger.missedSlots?.includes(targetSlot)
        const targetCenter = targetEl ? centerOf(targetEl, field) : from
        const to = meleeMissed && targetEl ? missPoint(from, targetCenter) : targetCenter
        const dx = Math.max(-MAX_LUNGE_PX, Math.min(MAX_LUNGE_PX, (to.x - from.x) * 0.3))
        const dy = Math.max(-MAX_LUNGE_PX, Math.min(MAX_LUNGE_PX, (to.y - from.y) * 0.3))
        attackerEl.style.setProperty('--lunge-x', `${dx}px`)
        attackerEl.style.setProperty('--lunge-y', `${dy}px`)
        attackerEl.style.setProperty('--lunge-duration', `${recipe.durationMs}ms`)
        attackerEl.style.setProperty('--lunge-reps', String(recipe.reps))
        attackerEl.classList.add('anim-melee-lunge')
        meleeElRef.current = attackerEl
        // The impact lands partway through the dash-out, not at the midpoint
        // of the whole out-and-back cycle - see the asymmetric lunge keyframe.
        for (let i = 0; i < recipe.reps; i++) {
          const landMs = i * REP_STAGGER_MS + recipe.durationMs * 0.35
          if (meleeMissed) continue
          impactAt(targetEl, landMs)
          if (i === 0) fieldImpactAt(field, recipe.type, landMs, recipe.bigHit)
        }
        timersRef.current.push(setTimeout(finish, totalMs))
      } else if (recipe.kind === 'burst') {
        const spawned: FlyingParticle[] = []
        for (let i = 0; i < recipe.reps; i++) {
          for (let ring = 0; ring < BURST_RING_COUNT; ring++) {
            const angle = (Math.PI * 2 * ring) / BURST_RING_COUNT
            const to = { x: from.x + Math.cos(angle) * BURST_RING_RADIUS, y: from.y + Math.sin(angle) * BURST_RING_RADIUS }
            const mid = arcMidpoint(from, to, 0)
            spawned.push({
              id: idRef.current++,
              type: recipe.type,
              x: from.x,
              y: from.y,
              toX: to.x,
              toY: to.y,
              midX: mid.x,
              midY: mid.y,
              delayMs: i * REP_STAGGER_MS,
              durationMs: recipe.durationMs,
              trail: false
            })
          }
        }
        setParticles((prev) => [...prev, ...spawned])
        timersRef.current.push(setTimeout(finish, totalMs))
      } else {
        const targets = trigger.targetSlots.length > 0 ? trigger.targetSlots : [trigger.attackerSlot]
        const spawned: FlyingParticle[] = []
        let lastArrivalMs = 0
        let firstLandingMs = Infinity
        for (const slot of targets) {
          const targetEl = slotElement(field, slot)
          if (!targetEl) continue
          // A missed target: the shot flies past its side instead, and nothing lands.
          const missed = !!trigger.missedSlots?.includes(slot)
          const to = missed ? missPoint(from, centerOf(targetEl, field)) : centerOf(targetEl, field)
          const dist = Math.hypot(to.x - from.x, to.y - from.y)
          const bow = Math.min(ARC_BOW_MAX_PX, dist * ARC_BOW_FACTOR) * (Math.random() < 0.5 ? -1 : 1)
          for (let i = 0; i < recipe.reps; i++) {
            const delay = i * REP_STAGGER_MS
            const leadMid = arcMidpoint(from, to, bow)
            spawned.push({
              id: idRef.current++,
              type: recipe.type,
              x: from.x,
              y: from.y,
              toX: to.x,
              toY: to.y,
              midX: leadMid.x,
              midY: leadMid.y,
              delayMs: delay,
              durationMs: recipe.durationMs,
              trail: false
            })
            for (let t = 0; t < TRAIL_COUNT; t++) {
              const trailDelay = delay + (t + 1) * TRAIL_DELAY_MS
              const trailTo = { x: to.x + jitter(TRAIL_JITTER_PX), y: to.y + jitter(TRAIL_JITTER_PX) }
              const trailFrom = { x: from.x + jitter(4), y: from.y + jitter(4) }
              const trailMid = arcMidpoint(trailFrom, trailTo, bow * (0.6 + 0.15 * t))
              spawned.push({
                id: idRef.current++,
                type: recipe.type,
                x: trailFrom.x,
                y: trailFrom.y,
                toX: trailTo.x,
                toY: trailTo.y,
                midX: trailMid.x,
                midY: trailMid.y,
                delayMs: trailDelay,
                durationMs: recipe.durationMs,
                trail: true
              })
              lastArrivalMs = Math.max(lastArrivalMs, trailDelay + recipe.durationMs)
            }
            if (missed) continue
            const landMs = delay + recipe.durationMs
            impactAt(targetEl, landMs)
            firstLandingMs = Math.min(firstLandingMs, landMs)
          }
        }
        if (spawned.length === 0) {
          finish()
          return
        }
        if (Number.isFinite(firstLandingMs)) fieldImpactAt(field, recipe.type, firstLandingMs, recipe.bigHit)
        setParticles((prev) => [...prev, ...spawned])
        timersRef.current.push(setTimeout(finish, Math.max(totalMs, lastArrivalMs)))
      }
    })

    return () => {
      cancelled = true
      clearTimers()
      if (meleeElRef.current) {
        meleeElRef.current.classList.remove('anim-melee-lunge')
        meleeElRef.current = null
      }
      for (const el of spriteFxElsRef.current) el.classList.remove(IMPACT_FLASH_CLASS, IMPACT_SHAKE_CLASS)
      spriteFxElsRef.current = []
      if (fieldFxRef.current) {
        fieldFxRef.current.classList.remove(FIELD_FLASH_CLASS, FIELD_SHAKE_CLASS)
        fieldFxRef.current = null
      }
    }
    // trigger is a fresh object each time one is requested - that's the signal to (re)play.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger])

  if (particles.length === 0) return null

  return (
    <div className="anim-layer">
      {particles.map((p) => (
        <span
          key={p.id}
          className={`anim-particle type-${p.type}${p.trail ? ' anim-particle-trail' : ''}`}
          style={
            {
              animationDelay: `${p.delayMs}ms`,
              animationDuration: `${p.durationMs}ms`,
              '--from-x': `${p.x}px`,
              '--from-y': `${p.y}px`,
              '--mid-x': `${p.midX}px`,
              '--mid-y': `${p.midY}px`,
              '--to-x': `${p.toX}px`,
              '--to-y': `${p.toY}px`
            } as React.CSSProperties
          }
        >
          <MoveParticleShape type={p.type} />
        </span>
      ))}
    </div>
  )
}

export default AnimationLayer
