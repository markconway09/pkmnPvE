import { useEffect, useRef, useState, type RefObject } from 'react'
import { LEECH_SEED_DRAIN_EVENT, type MoveEvent } from '../../shared/battle-types'
import { animationFor, REP_STAGGER_MS, TYPE_COLORS, type MeleeMark, type MoveAnimRecipe } from './moveAnimations'
import { fetchMoveInfo } from './moveInfoCache'
import MoveParticleShape, { MeleeMarkShape, StatArrowShape } from './moveParticleShapes'
import { animSpeed, animTimeFactor } from './animSpeed'

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

// What each effect piece on the layer is:
// - fly: an icon travelling from x/y to toX/toY (through midX/midY)
// - pop: an icon (or a contact move's mark) popping in place at x/y
// - beam: a solid line from x/y, `length` long at `angle` degrees
// - wave: a ring spreading out from x/y to `size` across
// - bolt: a jagged lightning bolt from the top of the field down to x/y
// - tide: a curtain of water `size` thick and `length` long, tilted to `angle`,
//   sweeping its middle from x/y to toX/toY
type FxVariant = 'fly' | 'pop' | 'beam' | 'wave' | 'bolt' | 'tide'

interface Fx extends Point {
  id: number
  variant: FxVariant
  type: string
  delayMs: number
  durationMs: number
  // fly only: where it ends, and the midpoint it passes through - offset to
  // one side of the straight line for a projectile (a gentle arc, not a
  // dead-straight shot).
  toX?: number
  toY?: number
  midX?: number
  midY?: number
  // Extra classes - a smaller trail spark, a straight non-spinning flight...
  className?: string
  // A thrown entry hazard piece (battle/fx image name) in place of the type shape.
  image?: string
  // A Leech Seed orb, sapped from the seeded Pokemon to the one it heals.
  seed?: boolean
  // pop only: a contact move's mark instead of the type icon, tilted by `rotation`.
  mark?: MeleeMark
  rotation?: number
  // A stat arrow instead of the type icon.
  arrow?: 'up' | 'down'
  // beam: its length and angle; wave: how wide it ends up; tide: how wide it is; bolt: its zig-zag points.
  length?: number
  angle?: number
  size?: number
  points?: string
}

type NewFx = Omit<Fx, 'id'>

interface Box extends Point {
  halfW: number
  halfH: number
}

function slotElement(field: HTMLDivElement, slot: string): HTMLElement | null {
  return field.querySelector(`.sprite-image-wrap[data-slot="${slot}"]`)
}

// The element's center and half-size, in pixels relative to the field - not
// the viewport, since the field itself can be anywhere on screen.
function boxOf(el: HTMLElement, field: HTMLDivElement): Box {
  const r = el.getBoundingClientRect()
  const fr = field.getBoundingClientRect()
  // The phone layout draws the field shrunk (CSS zoom): screen pixels back to the field's own.
  const scale = field.offsetWidth ? fr.width / field.offsetWidth : 1
  return {
    x: (r.left + r.width / 2 - fr.left) / scale,
    y: (r.top + r.height / 2 - fr.top) / scale,
    halfW: r.width / 2 / scale,
    halfH: r.height / 2 / scale
  }
}

function centerOf(el: HTMLElement, field: HTMLDivElement): Point {
  const { x, y } = boxOf(el, field)
  return { x, y }
}

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

// A lightning bolt's zig-zag, in a box BOLT_WIDTH_PX wide and `height` tall:
// it wanders side to side on the way down and ends dead center at the bottom.
const BOLT_WIDTH_PX = 44
const BOLT_SEGMENT_PX = 24
function boltPoints(height: number): string {
  const mid = BOLT_WIDTH_PX / 2
  const points = [`${mid + jitter(6)},0`]
  const segments = Math.max(3, Math.round(height / BOLT_SEGMENT_PX))
  for (let i = 1; i < segments; i++) {
    const side = i % 2 === 0 ? -1 : 1
    points.push(`${mid + side * (5 + Math.random() * 12)},${(height * i) / segments}`)
  }
  points.push(`${mid},${height}`)
  return points.join(' ')
}

const MAX_LUNGE_PX = 40
// A projectile shot is a small cluster, not one lone icon: the real one,
// plus this many smaller trailing sparks a beat behind it.
const TRAIL_COUNT = 2
const TRAIL_DELAY_MS = 55
const TRAIL_JITTER_PX = 10
// How far a projectile's flight path bows to one side, relative to its
// travel distance - capped so a long-range shot doesn't arc absurdly wide.
const ARC_BOW_FACTOR = 0.2
const ARC_BOW_MAX_PX = 50
// The pop of the move's icon on its target as it lands.
const POP_MS = 420
// A status move's burst is a ring of the type's icon expanding outward
// from the user, instead of one dot scaling in place.
const BURST_RING_COUNT = 6
const BURST_RING_RADIUS = 58
// A stream: icons poured out this far apart, each crossing in this share of the move's time.
const STREAM_GAP_MS = 55
const STREAM_FLIGHT_SHARE = 0.75
// A strike from above: this many pieces fall (one bolt for Electric), each in this share of the time.
const STRIKE_PIECES = 3
const STRIKE_GAP_MS = 110
const STRIKE_FALL_SHARE = 0.5
// A bolt flashes on the target this far into its own flicker.
const BOLT_HIT_SHARE = 0.12
// A beam lands this far into its own swell.
const BEAM_HIT_SHARE = 0.3
// A quake: the target bounces twice, with dust puffing up from its feet.
const QUAKE_DUST = 7
const QUAKE_BOUNCE_SHARES = [0.12, 0.5]
// An eruption: icons shooting up from under the target, this far apart.
const ERUPTION_COUNT = 6
const ERUPTION_GAP_MS = 60
const ERUPTION_FLIGHT_SHARE = 0.7
// A wave: how far past the farthest target the ring keeps spreading, and the icons riding it.
const WAVE_REACH = 1.35
const WAVE_MIN_RADIUS_PX = 200
const WAVE_ICONS = 8
const WAVE_SECOND_RING_MS = 130
// An explosion's blast on the user grows to this size as its wave goes out.
const EXPLOSION_BLAST_PX = 220
// A tide: a curtain of water this thick (most of it the fading tail), sweeping in from
// one corner of the field until all of it has left by the opposite one.
const TIDE_WIDTH_PX = 320
// Its color - blue whatever the move's type (Muddy Water too).
const TIDE_COLOR = '#2f6fd6'
// A stat move's arrows: this many side by side, rising or falling over the Pokemon.
const ARROW_COUNT = 3
const ARROW_SPREAD_PX = 30
const ARROW_GAP_MS = 110
// A contact move's mark pops on the target this long.
const MARK_MS = 420
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
const FIELD_QUAKE_CLASS = 'battle-field-quake'
// A status move: its user sways side to side a little while it's used.
const STATUS_SWAY_MS = 520
const STATUS_SWAY_CLASS = 'anim-status-sway'
// Leech Seed sapping HP: a stream of green orbs from the seeded Pokemon to the one it heals.
const SEED_ORB_COUNT = 5
const SEED_ORB_STAGGER_MS = 90
const SEED_ORB_FLIGHT_MS = 620
// A stat boost's arrows are warm, a drop's cool - the same for every type.
const ARROW_COLORS = { up: '#ff8a3d', down: '#4aa8ff' }

/**
 * Plays a move's animation over the battle field, worked out from the move's
 * own data (see moveAnimations.ts) rather than a hand-authored table, so it
 * covers the whole move list: type icons arcing, pouring or dropping onto each
 * target (see moveParticleShapes.tsx), a beam, a spreading wave, a quake that
 * shakes the whole field, an eruption under the target, the user's own sprite
 * dashing in with a slash/fist/kick/bite mark for a contact move, or a ring or
 * stat arrows for a status move. Each hit flashes and jolts its target as it
 * lands; a hard enough hit also flashes/shakes the whole field. Repeats
 * (staggered) for a multi-hit move. Its speed (or skipping it) comes from
 * Options (see animSpeed.ts).
 */
function AnimationLayer({ fieldRef, trigger, onDone }: Props): React.JSX.Element | null {
  const [fx, setFx] = useState<Fx[]>([])
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

    const clearClasses = (): void => {
      if (meleeElRef.current) {
        meleeElRef.current.classList.remove('anim-melee-lunge', STATUS_SWAY_CLASS)
        meleeElRef.current = null
      }
      for (const el of spriteFxElsRef.current) el.classList.remove(IMPACT_FLASH_CLASS, IMPACT_SHAKE_CLASS)
      spriteFxElsRef.current = []
      if (fieldFxRef.current) {
        fieldFxRef.current.classList.remove(FIELD_FLASH_CLASS, FIELD_SHAKE_CLASS, FIELD_QUAKE_CLASS)
        fieldFxRef.current = null
      }
    }

    const finish = (): void => {
      clearTimers()
      clearClasses()
      setFx([])
      onDone()
    }

    const field = fieldRef.current
    if (!field || animSpeed() === 'off') {
      finish()
      return
    }

    // Every time below is scaled by the Options speed (Fast plays it all quicker).
    const factor = animTimeFactor()
    const t = (ms: number): number => Math.round(ms * factor)
    const after = (ms: number, fn: () => void): void => {
      timersRef.current.push(setTimeout(fn, ms))
    }

    // The pieces this trigger spawns, and when the last of them ends.
    const spawned: Fx[] = []
    let endMs = 0
    const spawn = (piece: NewFx): void => {
      spawned.push({ ...piece, id: idRef.current++ })
      endMs = Math.max(endMs, piece.delayMs + piece.durationMs)
    }
    const fly = (type: string, from: Point, to: Point, bowPx: number, delayMs: number, durationMs: number, extra: Partial<NewFx> = {}): void => {
      const mid = arcMidpoint(from, to, bowPx)
      spawn({ variant: 'fly', type, x: from.x, y: from.y, toX: to.x, toY: to.y, midX: mid.x, midY: mid.y, delayMs, durationMs, ...extra })
    }
    const pop = (type: string, at: Point, delayMs: number, extra: Partial<NewFx> = {}): void => {
      spawn({ variant: 'pop', type, x: at.x, y: at.y, delayMs, durationMs: t(POP_MS), ...extra })
    }
    const play = (): void => {
      setFx((prev) => [...prev, ...spawned])
    }

    // Flashes and shakes the target at the moment a hit actually lands, not
    // when the animation starts - scheduled relative to this trigger's own
    // timers so it's cleaned up the same way as everything else.
    const impactAt = (el: HTMLElement | null, delayMs: number): void => {
      if (!el) return
      after(delayMs, () => {
        // Off and on again, so a second hit right after the first restarts it.
        el.classList.remove(IMPACT_FLASH_CLASS, IMPACT_SHAKE_CLASS)
        void el.offsetWidth
        el.classList.add(IMPACT_FLASH_CLASS, IMPACT_SHAKE_CLASS)
        spriteFxElsRef.current.push(el)
        after(IMPACT_FLASH_MS, () => el.classList.remove(IMPACT_FLASH_CLASS))
        after(IMPACT_SHAKE_MS, () => el.classList.remove(IMPACT_SHAKE_CLASS))
      })
    }

    // Once per trigger (not once per hit) - a wash over the whole field at
    // the first landed hit, tinted by the move's type; a hard-hitting move
    // also gives the field itself a brief shake.
    const fieldImpactAt = (type: string, delayMs: number, shake: boolean): void => {
      after(delayMs, () => {
        field.style.setProperty('--flash-color', TYPE_COLORS[type] ?? TYPE_COLORS.normal)
        field.classList.add(FIELD_FLASH_CLASS)
        if (shake) field.classList.add(FIELD_SHAKE_CLASS)
        fieldFxRef.current = field
        after(FIELD_FLASH_MS, () => field.classList.remove(FIELD_FLASH_CLASS))
        if (shake) after(FIELD_SHAKE_MS, () => field.classList.remove(FIELD_SHAKE_CLASS))
      })
    }

    if (trigger.moveId === LEECH_SEED_DRAIN_EVENT) {
      const seededEl = slotElement(field, trigger.attackerSlot)
      const healerEl = trigger.targetSlots[0] ? slotElement(field, trigger.targetSlots[0]) : null
      if (!seededEl || !healerEl) {
        finish()
        return
      }
      const from = centerOf(seededEl, field)
      const to = centerOf(healerEl, field)
      const dist = Math.hypot(to.x - from.x, to.y - from.y)
      for (let i = 0; i < SEED_ORB_COUNT; i++) {
        // Each orb bows its own way a little, so they drift over as a loose stream.
        const bow = Math.min(ARC_BOW_MAX_PX, dist * ARC_BOW_FACTOR) * (i % 2 === 0 ? 1 : -1) * (0.4 + Math.random() * 0.6)
        const start = { x: from.x + jitter(14), y: from.y + jitter(14) }
        const end = { x: to.x + jitter(10), y: to.y + jitter(10) }
        fly('grass', start, end, bow, t(i * SEED_ORB_STAGGER_MS), t(SEED_ORB_FLIGHT_MS), { seed: true })
      }
      play()
      after(endMs, finish)
      return () => {
        cancelled = true
        clearTimers()
      }
    }

    void fetchMoveInfo(trigger.moveId).then((info) => {
      if (cancelled) return
      const base = info ? animationFor(info) : null
      const attackerEl = slotElement(field, trigger.attackerSlot)
      const isStatus = info?.category === 'Status'
      if (isStatus && attackerEl) {
        attackerEl.classList.add(STATUS_SWAY_CLASS)
        meleeElRef.current = attackerEl
      }
      if (!base || base.none) {
        // A status move with no particles of its own (Stealth Rock, Reflect...) still sways.
        if (isStatus && attackerEl) after(STATUS_SWAY_MS, finish)
        else finish()
        return
      }
      if (!attackerEl) {
        finish()
        return
      }
      const recipe: MoveAnimRecipe = { ...base, durationMs: t(base.durationMs) }
      const stagger = t(REP_STAGGER_MS)
      const from = centerOf(attackerEl, field)
      const color = recipe.type
      // The targets it's aimed at (itself, if nothing else), each with whether it missed.
      const targets = (trigger.targetSlots.length > 0 ? trigger.targetSlots : [trigger.attackerSlot])
        .map((slot) => ({ el: slotElement(field, slot), missed: !!trigger.missedSlots?.includes(slot) }))
        .filter((target): target is { el: HTMLElement; missed: boolean } => !!target.el)
      let firstLandingMs = Infinity
      const landed = (el: HTMLElement, ms: number): void => {
        impactAt(el, ms)
        firstLandingMs = Math.min(firstLandingMs, ms)
      }
      // The whole field's flash (and shake, for a big hit) at the first landed hit.
      const fieldFlash = (): void => {
        // A quake or an explosion already rumbles the field the whole way through.
        const shake = recipe.bigHit && recipe.kind !== 'quake' && !recipe.explosion
        if (Number.isFinite(firstLandingMs)) fieldImpactAt(recipe.type, firstLandingMs, shake)
      }

      switch (recipe.kind) {
        case 'melee': {
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
            const landMs = i * stagger + recipe.durationMs * 0.35
            if (meleeMissed || !targetEl) continue
            landed(targetEl, landMs)
            // Its mark (claw slashes, a fist...) pops on the target as it lands,
            // or the type's own icon for a plain tackle.
            const at = { x: targetCenter.x + jitter(10), y: targetCenter.y + jitter(10) }
            if (recipe.mark) {
              pop(color, at, landMs, { mark: recipe.mark, rotation: jitter(20), durationMs: t(MARK_MS), className: 'anim-pop-mark' })
            } else {
              pop(color, at, landMs)
            }
          }
          fieldFlash()
          endMs = Math.max(endMs, recipe.durationMs + (recipe.reps - 1) * stagger)
          break
        }

        case 'burst': {
          for (let i = 0; i < recipe.reps; i++) {
            for (let ring = 0; ring < BURST_RING_COUNT; ring++) {
              const angle = (Math.PI * 2 * ring) / BURST_RING_COUNT
              const to = { x: from.x + Math.cos(angle) * BURST_RING_RADIUS, y: from.y + Math.sin(angle) * BURST_RING_RADIUS }
              fly(color, from, to, 0, i * stagger, recipe.durationMs, { className: 'anim-particle-ring' })
            }
          }
          endMs = Math.max(endMs, STATUS_SWAY_MS)
          break
        }

        case 'arrows': {
          const arrows = recipe.arrows ?? { dir: 'up', onSelf: true }
          const onEls = arrows.onSelf ? [attackerEl] : targets.filter((target) => !target.missed).map((target) => target.el)
          for (const el of onEls) {
            const box = boxOf(el, field)
            const top = box.y - box.halfH * 0.55
            const bottom = box.y + box.halfH * 0.45
            for (let i = 0; i < ARROW_COUNT; i++) {
              const x = box.x + (i - (ARROW_COUNT - 1) / 2) * ARROW_SPREAD_PX
              // The middle arrow leads; the outer two follow a beat later.
              const delay = t((i === 1 ? 0 : 1) * ARROW_GAP_MS + (i === 2 ? ARROW_GAP_MS / 2 : 0))
              const start = { x, y: arrows.dir === 'up' ? bottom : top }
              const end = { x, y: arrows.dir === 'up' ? top : bottom }
              fly(color, start, end, 0, delay, recipe.durationMs, { arrow: arrows.dir, className: 'anim-particle-straight anim-particle-arrow' })
            }
          }
          endMs = Math.max(endMs, STATUS_SWAY_MS)
          break
        }

        case 'quake': {
          // Nothing flies: the whole field rumbles for the length of the move,
          // each target bounces twice and dust kicks up around its feet.
          field.style.setProperty('--quake-ms', `${recipe.durationMs}ms`)
          field.classList.add(FIELD_QUAKE_CLASS)
          fieldFxRef.current = field
          after(recipe.durationMs, () => field.classList.remove(FIELD_QUAKE_CLASS))
          for (const target of targets) {
            const box = boxOf(target.el, field)
            const feet = box.y + box.halfH * 0.75
            for (let i = 0; i < QUAKE_DUST; i++) {
              const start = { x: box.x + jitter(box.halfW * 0.8), y: feet + jitter(6) }
              const end = { x: start.x + jitter(30), y: feet - 25 - Math.random() * 35 }
              fly('ground', start, end, 0, t(i * 45), Math.round(recipe.durationMs * 0.6), { className: 'anim-particle-straight anim-particle-dust' })
            }
            if (target.missed) continue
            for (const share of QUAKE_BOUNCE_SHARES) landed(target.el, Math.round(recipe.durationMs * share))
          }
          fieldFlash()
          endMs = Math.max(endMs, recipe.durationMs)
          break
        }

        case 'eruption': {
          for (const target of targets) {
            const box = boxOf(target.el, field)
            const center = target.missed ? missPoint(from, box) : box
            const below = center.y + box.halfH * 0.85
            const flight = Math.round(recipe.durationMs * ERUPTION_FLIGHT_SHARE)
            for (let i = 0; i < ERUPTION_COUNT; i++) {
              const start = { x: center.x + jitter(box.halfW * 0.6), y: below }
              const end = { x: start.x + jitter(25), y: center.y - box.halfH * (0.6 + Math.random() * 0.5) }
              fly(color, start, end, 0, t(i * ERUPTION_GAP_MS), flight, {
                className: `anim-particle-straight${i % 2 === 1 ? ' anim-particle-stream' : ''}`
              })
            }
            if (!target.missed) {
              landed(target.el, Math.round(flight * 0.3))
              landed(target.el, t((ERUPTION_COUNT - 1) * ERUPTION_GAP_MS) + Math.round(flight * 0.3))
            }
          }
          fieldFlash()
          break
        }

        case 'wave': {
          // A ring (and a thinner one just behind it) spreading out from the
          // user past its farthest target, with the type's icons riding it; it
          // hits each target as the ring reaches it.
          const reaches = targets.map((target) => {
            const c = centerOf(target.el, field)
            return Math.hypot(c.x - from.x, c.y - from.y)
          })
          const radius = Math.max(WAVE_MIN_RADIUS_PX, Math.max(0, ...reaches) * WAVE_REACH)
          if (recipe.explosion) {
            // Explosion & co: a fireball blooms on the user as the wave goes
            // out, and the whole field rumbles for as long as it spreads.
            spawn({ variant: 'wave', type: color, x: from.x, y: from.y, size: EXPLOSION_BLAST_PX, delayMs: 0, durationMs: Math.round(recipe.durationMs * 0.7), className: 'anim-blast' })
            field.style.setProperty('--quake-ms', `${recipe.durationMs}ms`)
            field.classList.add(FIELD_QUAKE_CLASS)
            fieldFxRef.current = field
            after(recipe.durationMs, () => field.classList.remove(FIELD_QUAKE_CLASS))
          }
          for (let i = 0; i < recipe.reps; i++) {
            const delay = i * stagger
            spawn({ variant: 'wave', type: color, x: from.x, y: from.y, size: radius * 2, delayMs: delay, durationMs: recipe.durationMs })
            spawn({
              variant: 'wave',
              type: color,
              x: from.x,
              y: from.y,
              size: radius * 1.6,
              delayMs: delay + t(WAVE_SECOND_RING_MS),
              durationMs: recipe.durationMs,
              className: 'anim-wave-thin'
            })
            const spin = Math.random() * Math.PI
            for (let k = 0; k < WAVE_ICONS; k++) {
              const angle = spin + (Math.PI * 2 * k) / WAVE_ICONS
              const to = { x: from.x + Math.cos(angle) * radius, y: from.y + Math.sin(angle) * radius }
              fly(color, from, to, 0, delay, recipe.durationMs, { className: 'anim-particle-straight anim-particle-ring' })
            }
            targets.forEach((target, n) => {
              if (target.missed) return
              landed(target.el, delay + Math.round((reaches[n] / radius) * recipe.durationMs))
            })
          }
          fieldFlash()
          break
        }

        case 'tide': {
          // A see-through curtain of water sweeps diagonally across the field
          // from behind the user, hitting each target as its front passes.
          const aimX = targets.reduce((sum, target) => sum + centerOf(target.el, field).x, 0) / (targets.length || 1)
          const dir = aimX < from.x ? -1 : 1
          // It sweeps corner to corner: bottom left to top right, or the reverse
          // when the foes are on the left. Distances below are measured along that line.
          const fieldW = field.clientWidth
          const fieldH = field.clientHeight
          const diag = Math.hypot(fieldW, fieldH) || 1
          const dx = (dir * fieldW) / diag
          const dy = (-dir * fieldH) / diag
          const along = (x: number, y: number): number => x * dx + y * dy
          const corners = [along(0, 0), along(fieldW, 0), along(0, fieldH), along(fieldW, fieldH)]
          const startFront = Math.min(...corners)
          const endFront = Math.max(...corners) + TIDE_WIDTH_PX
          const travel = endFront - startFront
          // The curtain's middle point when its front is `front` along the line.
          const middleAt = (front: number): Point => ({ x: dx * (front - TIDE_WIDTH_PX / 2), y: dy * (front - TIDE_WIDTH_PX / 2) })
          const start = middleAt(startFront)
          const end = middleAt(endFront)
          for (let i = 0; i < recipe.reps; i++) {
            const delay = i * stagger
            spawn({
              variant: 'tide',
              type: color,
              x: start.x,
              y: start.y,
              toX: end.x,
              toY: end.y,
              size: TIDE_WIDTH_PX,
              // Long enough to span the whole field across its path.
              length: diag * 2,
              angle: (Math.atan2(dy, dx) * 180) / Math.PI,
              delayMs: delay,
              durationMs: recipe.durationMs
            })
            for (const target of targets) {
              if (target.missed) continue
              const c = centerOf(target.el, field)
              const hitMs = delay + Math.round(((along(c.x, c.y) - startFront) / travel) * recipe.durationMs)
              landed(target.el, hitMs)
              pop(color, c, hitMs)
            }
          }
          fieldFlash()
          break
        }

        case 'beam': {
          for (const target of targets) {
            const center = centerOf(target.el, field)
            const to = target.missed ? missPoint(from, center) : center
            const length = Math.hypot(to.x - from.x, to.y - from.y)
            const angle = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI
            for (let i = 0; i < recipe.reps; i++) {
              const delay = i * stagger
              spawn({ variant: 'beam', type: color, x: from.x, y: from.y, length, angle, delayMs: delay, durationMs: recipe.durationMs })
              if (target.missed) continue
              const hitMs = delay + Math.round(recipe.durationMs * BEAM_HIT_SHARE)
              landed(target.el, hitMs)
              pop(color, to, hitMs)
            }
          }
          fieldFlash()
          break
        }

        case 'stream': {
          const count = recipe.streamCount ?? 6
          const flight = Math.round(recipe.durationMs * STREAM_FLIGHT_SHARE)
          for (const target of targets) {
            const center = centerOf(target.el, field)
            const to = target.missed ? missPoint(from, center) : center
            const dist = Math.hypot(to.x - from.x, to.y - from.y)
            const bow = Math.min(ARC_BOW_MAX_PX, dist * ARC_BOW_FACTOR) * 0.35
            for (let i = 0; i < count; i++) {
              // Each icon wobbles a little to alternate sides, so it reads as a pour.
              const end = { x: to.x + jitter(12), y: to.y + jitter(12) }
              fly(color, from, end, bow * (i % 2 === 0 ? 1 : -1), t(i * STREAM_GAP_MS), flight, { className: 'anim-particle-stream' })
            }
            if (target.missed) continue
            const lastMs = t((count - 1) * STREAM_GAP_MS) + flight
            landed(target.el, flight)
            landed(target.el, lastMs)
            pop(color, to, lastMs)
          }
          fieldFlash()
          break
        }

        case 'strike': {
          // Comes down on the target from the top of the field - a lightning
          // bolt for Electric, falling pieces (rocks, icicles, meteors) otherwise.
          for (const target of targets) {
            const center = centerOf(target.el, field)
            const to = target.missed ? missPoint(from, center) : center
            for (let i = 0; i < recipe.reps; i++) {
              const delay = i * stagger
              if (recipe.type === 'electric') {
                spawn({ variant: 'bolt', type: color, x: to.x, y: to.y, points: boltPoints(to.y), delayMs: delay, durationMs: recipe.durationMs })
                const hitMs = delay + Math.round(recipe.durationMs * BOLT_HIT_SHARE)
                pop(color, to, hitMs)
                if (!target.missed) landed(target.el, hitMs)
                continue
              }
              const fall = Math.round(recipe.durationMs * STRIKE_FALL_SHARE)
              for (let p = 0; p < STRIKE_PIECES; p++) {
                const pieceDelay = delay + t(p * STRIKE_GAP_MS)
                const end = { x: to.x + jitter(22), y: to.y + jitter(14) }
                const start = { x: end.x + 30 + jitter(20), y: -40 }
                fly(color, start, end, 0, pieceDelay, fall, { className: 'anim-particle-straight' })
                if (!target.missed) landed(target.el, pieceDelay + fall)
              }
              const lastMs = delay + t((STRIKE_PIECES - 1) * STRIKE_GAP_MS) + fall
              pop(color, to, lastMs)
            }
          }
          fieldFlash()
          break
        }

        case 'projectile': {
          // An entry hazard lands on the foe's side - at each of its Pokemon out.
          const foeSide = trigger.attackerSlot.startsWith('p1') ? 'p2' : 'p1'
          const hazardEls = recipe.hazardImages
            ? (['a', 'b'] as const).map((s) => slotElement(field, `${foeSide}${s}`)).filter((el): el is HTMLElement => !!el)
            : []
          const shotTargets = hazardEls.length > 0 ? hazardEls.map((el) => ({ el, missed: false })) : targets
          let pieceIndex = 0
          const nextPiece = (): string | undefined =>
            recipe.hazardImages ? recipe.hazardImages[pieceIndex++ % recipe.hazardImages.length] : undefined
          for (const target of shotTargets) {
            // A missed target: the shot flies past its side instead, and nothing lands.
            const center = centerOf(target.el, field)
            const to = target.missed ? missPoint(from, center) : center
            const dist = Math.hypot(to.x - from.x, to.y - from.y)
            const bow = Math.min(ARC_BOW_MAX_PX, dist * ARC_BOW_FACTOR) * (Math.random() < 0.5 ? -1 : 1)
            for (let i = 0; i < recipe.reps; i++) {
              const delay = i * stagger
              fly(color, from, to, bow, delay, recipe.durationMs, { image: nextPiece() })
              for (let k = 0; k < TRAIL_COUNT; k++) {
                const trailTo = { x: to.x + jitter(TRAIL_JITTER_PX), y: to.y + jitter(TRAIL_JITTER_PX) }
                const trailFrom = { x: from.x + jitter(4), y: from.y + jitter(4) }
                fly(color, trailFrom, trailTo, bow * (0.6 + 0.15 * k), delay + t((k + 1) * TRAIL_DELAY_MS), recipe.durationMs, {
                  className: 'anim-particle-trail',
                  image: nextPiece()
                })
              }
              // A hazard just lands on the ground - no hit to flash.
              if (target.missed || recipe.hazardImages) continue
              const landMs = delay + recipe.durationMs
              landed(target.el, landMs)
              pop(color, to, landMs)
            }
          }
          fieldFlash()
          break
        }
      }

      if (spawned.length === 0 && endMs === 0) {
        finish()
        return
      }
      play()
      after(Math.max(endMs, recipe.durationMs + (recipe.reps - 1) * stagger), finish)
    })

    return () => {
      cancelled = true
      clearTimers()
      clearClasses()
    }
    // trigger is a fresh object each time one is requested - that's the signal to (re)play.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger])

  if (fx.length === 0) return null

  return <div className="anim-layer">{fx.map(renderFx)}</div>
}

function renderFx(p: Fx): React.JSX.Element {
  const timing = { animationDelay: `${p.delayMs}ms`, animationDuration: `${p.durationMs}ms` }
  const color = p.arrow ? ARROW_COLORS[p.arrow] : (TYPE_COLORS[p.type] ?? TYPE_COLORS.normal)
  const extra = p.className ? ` ${p.className}` : ''

  switch (p.variant) {
    case 'pop':
      return (
        <span
          key={p.id}
          className={`anim-pop${extra}`}
          style={{ ...timing, left: p.x, top: p.y, color, '--pop-rot': `${p.rotation ?? 0}deg` } as React.CSSProperties}
        >
          {p.mark ? <MeleeMarkShape mark={p.mark} /> : <MoveParticleShape type={p.type} />}
        </span>
      )
    case 'beam':
      return (
        <span
          key={p.id}
          className={`anim-beam${extra}`}
          style={{ ...timing, left: p.x, top: p.y, width: p.length, color, '--beam-angle': `${p.angle ?? 0}deg` } as React.CSSProperties}
        />
      )
    case 'wave':
      return (
        <span
          key={p.id}
          className={`anim-wave${extra}`}
          style={{ ...timing, left: p.x, top: p.y, color, '--wave-size': `${p.size ?? 0}px` } as React.CSSProperties}
        />
      )
    case 'tide': {
      // Placed by its top-left corner, so shift by half its size to center it on the path.
      const width = p.size ?? 0
      const height = p.length ?? 0
      return (
        <span
          key={p.id}
          className={`anim-tide${extra}`}
          style={
            {
              ...timing,
              width,
              height,
              color: TIDE_COLOR,
              '--from-x': `${p.x - width / 2}px`,
              '--from-y': `${p.y - height / 2}px`,
              '--to-x': `${(p.toX ?? 0) - width / 2}px`,
              '--to-y': `${(p.toY ?? 0) - height / 2}px`,
              '--tide-angle': `${p.angle ?? 0}deg`
            } as React.CSSProperties
          }
        />
      )
    }
    case 'bolt':
      return (
        <span
          key={p.id}
          className={`anim-bolt${extra}`}
          style={{ ...timing, left: p.x - BOLT_WIDTH_PX / 2, height: p.y, width: BOLT_WIDTH_PX, color }}
        >
          <svg viewBox={`0 0 ${BOLT_WIDTH_PX} ${p.y}`} xmlns="http://www.w3.org/2000/svg">
            <polyline points={p.points} fill="none" stroke="currentColor" strokeWidth="6" strokeLinejoin="round" />
            <polyline points={p.points} fill="none" stroke="#fffbe0" strokeWidth="2" strokeLinejoin="round" />
          </svg>
        </span>
      )
    case 'fly':
      return (
        <span
          key={p.id}
          className={`anim-particle${extra}${p.image ? ' anim-particle-hazard' : ''}${p.seed ? ' anim-particle-seed' : ''}`}
          style={
            {
              ...timing,
              color,
              '--from-x': `${p.x}px`,
              '--from-y': `${p.y}px`,
              '--mid-x': `${p.midX}px`,
              '--mid-y': `${p.midY}px`,
              '--to-x': `${p.toX}px`,
              '--to-y': `${p.toY}px`
            } as React.CSSProperties
          }
        >
          {p.seed ? null : p.image ? (
            <img src={`./battle/fx/${p.image}.png`} alt="" draggable={false} />
          ) : p.arrow ? (
            <StatArrowShape dir={p.arrow} />
          ) : (
            <MoveParticleShape type={p.type} />
          )}
        </span>
      )
  }
}

export default AnimationLayer
