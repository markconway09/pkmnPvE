import type { MoveInfo } from '../../shared/battle-types'

// A generic animation for any move, worked out from its own data (type,
// category, whether it makes contact, whether it hits more than once)
// instead of a hand-authored table per move - the only way to cover the
// whole move list without writing ~600 bespoke entries. A status move plays
// on whoever it's really aimed at (itself, or its target); a damaging move
// either lunges in for contact or flings a type-shaped particle cluster
// (see moveParticleShapes.tsx), repeated a couple of times for a multi-hit
// move, and scaled a bit faster/slower by the move's own power.
export type MoveAnimKind = 'projectile' | 'burst' | 'melee'

export interface MoveAnimRecipe {
  kind: MoveAnimKind
  // Which particle shape/color it uses (see moveParticleShapes.tsx and the
  // .anim-particle.type-X rules in styles.css) - burst reuses the same
  // shape, just animated outward in a ring instead of at a target.
  type: string
  // A move with no useful animation (a stat move with no attack, most
  // Status moves on the field itself, ...) plays nothing rather than a
  // generic burst that would just be noise.
  none?: boolean
  durationMs: number
  // How many times the effect repeats, staggered - 2 for a move that hits
  // more than once, otherwise 1.
  reps: number
  // A strong hit (see BIG_HIT_POWER) also shakes the whole field, not just
  // flashing the target - AnimationLayer reads this to decide whether to.
  bigHit: boolean
}

const BASE_DURATION_MS = 480
const MELEE_DURATION_MS = 380
const BURST_DURATION_MS = 460
const REP_STAGGER_MS = 140
const BIG_HIT_POWER = 90

function clampedLerp(x: number, x0: number, x1: number, y0: number, y1: number): number {
  if (x <= x0) return y0
  if (x >= x1) return y1
  return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0)
}

// A weak move (Pound, 40 BP) snaps out quickly; a heavy one (Hyper Beam, 150
// BP) has more wind-up and follow-through - scales the base duration between
// 75% and 145% across a move's normal power range instead of every hit
// taking exactly the same time regardless of how hard it lands.
function scaledDuration(basePower: number, base: number): number {
  return Math.round(base * clampedLerp(basePower, 40, 150, 0.75, 1.45))
}

/** Field/team effects and moves with no real attack of their own - nothing worth animating. */
const NO_TARGET_TYPES = new Set(['foeSide', 'allySide', 'allyTeam'])

export function animationFor(info: MoveInfo): MoveAnimRecipe {
  const reps = info.multihit ? 2 : 1
  const type = info.type.toLowerCase()
  const bigHit = info.basePower >= BIG_HIT_POWER

  if (info.category === 'Status') {
    if (NO_TARGET_TYPES.has(info.target)) {
      return { kind: 'burst', type, none: true, durationMs: 0, reps: 1, bigHit: false }
    }
    return { kind: 'burst', type, durationMs: BURST_DURATION_MS, reps: 1, bigHit: false }
  }

  if (info.contact) {
    return { kind: 'melee', type, durationMs: scaledDuration(info.basePower, MELEE_DURATION_MS), reps, bigHit }
  }
  return { kind: 'projectile', type, durationMs: scaledDuration(info.basePower, BASE_DURATION_MS), reps, bigHit }
}

// The same 18-type palette as .anim-particle.type-X / .move-button.type-X in
// styles.css, kept here too so the field-impact flash (a plain JS-set CSS
// variable, not its own 18-rule block) can use the same colors.
export const TYPE_COLORS: Record<string, string> = {
  normal: '#a4acaf',
  fire: '#f08030',
  water: '#6890f0',
  electric: '#f8d030',
  grass: '#78c850',
  ice: '#98d8d8',
  fighting: '#c03028',
  poison: '#a040a0',
  ground: '#e0c068',
  flying: '#a890f0',
  psychic: '#f85888',
  bug: '#a8b820',
  rock: '#b8a038',
  ghost: '#705898',
  dragon: '#7038f8',
  dark: '#705848',
  steel: '#b8b8d0',
  fairy: '#ee99ac'
}

export { REP_STAGGER_MS }
