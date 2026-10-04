import type { MoveInfo } from '../../shared/battle-types'

// An animation for any move, worked out from its own data (type, category,
// target, flags, whether it makes contact or hits more than once) instead of
// a hand-authored table per move - the only way to cover the whole move list
// without writing ~600 bespoke entries. A short override table (MOVE_KINDS)
// fixes the well-known moves the rules get wrong. The styles:
// - projectile: a type icon cluster arcs over to the target and pops on it
// - stream: a quick line of icons pours into the target (Flamethrower, Scald...)
// - beam: a solid line from user to target swells and fades (Hyper Beam...)
// - strike: it drops onto the target from the top of the field (Thunderbolt, Rock Slide)
// - quake: nothing flies - the field shakes hard and dust kicks up under the target
// - eruption: the type's icons burst up from under the target (Earth Power)
// - wave: a ring spreads out from the user across the field (Discharge, Hyper Voice)
// - tide: a solid blue wave rises behind the user and rolls across over the foes (Surf, Muddy Water)
// - melee: the user dashes in, with a slash, fist, kick or bite mark on the target
// - burst / arrows: a status move - a ring of icons, or stat arrows rising or falling
export type MoveAnimKind =
  | 'projectile'
  | 'stream'
  | 'beam'
  | 'strike'
  | 'quake'
  | 'eruption'
  | 'wave'
  | 'tide'
  | 'burst'
  | 'arrows'
  | 'melee'

// The mark a contact move leaves on its target as it lands (see moveParticleShapes.tsx).
export type MeleeMark = 'slash' | 'fist' | 'kick' | 'bite'

export interface MoveAnimRecipe {
  kind: MoveAnimKind
  // Which particle shape/color it uses (see moveParticleShapes.tsx and the
  // .anim-particle.type-X rules in styles.css).
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
  // An entry hazard move (Stealth Rock, Spikes...): its pieces (battle/fx images) are
  // thrown across at the foe's side as the projectile, instead of a type particle.
  hazardImages?: string[]
  // A contact move's mark on the target, if it has one.
  mark?: MeleeMark
  // A stat move's arrows: rising for a boost, falling for a drop - on the user
  // when it targets itself (Swords Dance), else on its target (Growl).
  arrows?: { dir: 'up' | 'down'; onSelf: boolean }
  // How many icons a stream pours out - more for a stronger move.
  streamCount?: number
  // A self-destructing move (Explosion...): its wave bursts out of a blast on
  // the user and the whole field rumbles while it spreads.
  explosion?: boolean
}

const BASE_DURATION_MS = 600
const MELEE_DURATION_MS = 400
const BURST_DURATION_MS = 520
const STRIKE_DURATION_MS = 520
const QUAKE_DURATION_MS = 700
const BEAM_DURATION_MS = 620
const WAVE_DURATION_MS = 640
const TIDE_DURATION_MS = 820
const STREAM_DURATION_MS = 460
const ERUPTION_DURATION_MS = 600
const ARROWS_DURATION_MS = 700
const REP_STAGGER_MS = 160
const BIG_HIT_POWER = 90

function clampedLerp(x: number, x0: number, x1: number, y0: number, y1: number): number {
  if (x <= x0) return y0
  if (x >= x1) return y1
  return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0)
}

// A weak move (Pound, 40 BP) snaps out quickly; a heavy one (Hyper Beam, 150
// BP) has more wind-up and follow-through - scales the base duration between
// 80% and 145% across a move's normal power range instead of every hit
// taking exactly the same time regardless of how hard it lands.
function scaledDuration(basePower: number, base: number): number {
  return Math.round(base * clampedLerp(basePower, 40, 150, 0.8, 1.45))
}

/** Field/team effects and moves with no real attack of their own - nothing worth animating. */
const NO_TARGET_TYPES = new Set(['foeSide', 'allySide', 'allyTeam'])
// A status move aimed at these plays its arrows on the user itself.
const SELF_TARGETS = new Set(['self', 'adjacentAllyOrSelf', 'allies'])
// Moves that hit everything around the user (or every foe).
const SPREAD_TARGETS = new Set(['allAdjacent', 'allAdjacentFoes', 'all'])

// Entry hazard moves throw their own pieces at the foe's side (the same images
// SideHazards draws on the ground).
const HAZARD_IMAGES: Record<string, string[]> = {
  stealthrock: ['rock1', 'rock2'],
  spikes: ['caltrop'],
  toxicspikes: ['poisoncaltrop'],
  stickyweb: ['web']
}

// The well-known moves whose style the rules below would get wrong.
const MOVE_KINDS: Record<string, MoveAnimKind> = {
  // Things that come down from above.
  rockslide: 'strike',
  stoneedge: 'strike',
  iciclecrash: 'strike',
  dracometeor: 'strike',
  weatherball: 'strike',
  hurricane: 'strike',
  // Things that come up from the ground under the target.
  earthpower: 'eruption',
  precipiceblades: 'eruption',
  frenzyplant: 'eruption',
  blastburn: 'eruption',
  magmastorm: 'eruption',
  firepledge: 'eruption',
  grasspledge: 'eruption',
  waterpledge: 'eruption',
  // Beams the name doesn't give away.
  dragonpulse: 'beam',
  nightshade: 'beam',
  freezedry: 'beam',
  photongeyser: 'beam',
  fleurcannon: 'beam',
  // Auras and spreading shockwaves on a single target.
  darkpulse: 'wave',
  psychic: 'wave',
  psyshock: 'wave',
  petalblizzard: 'wave',
  waterspout: 'wave',
  eruption: 'wave',
  // A wall of water rolling over the foes.
  surf: 'tide',
  muddywater: 'tide',
  // Pours, not single shots.
  leafstorm: 'stream',
  bubblebeam: 'stream',
  // Ground moves that are thrown, not quakes.
  mudshot: 'projectile',
  mudbomb: 'projectile',
  mudslap: 'projectile',
  scorchingsands: 'projectile',
  bonemerang: 'projectile',
  bonerush: 'projectile',
  boneclub: 'projectile',
  // Electric moves that are thrown or aimed, not lightning from above.
  electroball: 'projectile',
  voltswitch: 'projectile',
  chargebeam: 'beam',
  electroweb: 'wave',
  // The user blows itself up - a blast wave out from it (see SELF_DESTRUCT_MOVES).
  selfdestruct: 'wave',
  explosion: 'wave',
  mistyexplosion: 'wave'
}

// Moves where the user faints blowing itself up: their wave gets a blast and a field rumble.
const SELF_DESTRUCT_MOVES = new Set(['selfdestruct', 'explosion', 'mistyexplosion'])

// A priority move (Quick Attack, Extreme Speed, Sucker Punch...) plays this much faster.
const PRIORITY_SPEED = 0.55

export function animationFor(info: MoveInfo): MoveAnimRecipe {
  const recipe = baseAnimationFor(info)
  return info.priority > 0 ? { ...recipe, durationMs: Math.round(recipe.durationMs * PRIORITY_SPEED) } : recipe
}

function hasFlag(info: MoveInfo, flag: string): boolean {
  return !!info.animFlags?.includes(flag)
}

// The mark a contact move leaves, from its flags and name: Showdown flags
// punches, bites and slicing moves; kicks and claws only show in the name.
function meleeMarkFor(info: MoveInfo): MeleeMark | undefined {
  const id = info.id
  if (hasFlag(info, 'bite') || /fang|bite|crunch|jaw/.test(id)) return 'bite'
  if (hasFlag(info, 'punch')) return 'fist'
  if (/kick|stomp|knee|axe/.test(id)) return 'kick'
  if (hasFlag(info, 'slicing') || /slash|claw|cut|scissor|blade|razor|swipe|scratch/.test(id)) return 'slash'
  if (info.type === 'Fighting') return 'fist'
  return undefined
}

function kindFor(info: MoveInfo): MoveAnimKind {
  const override = MOVE_KINDS[info.id]
  if (override) return override
  if (info.contact) return 'melee'
  const special = info.category === 'Special'
  const spread = SPREAD_TARGETS.has(info.target)
  if (info.type === 'Ground') return 'quake'
  if (/beam|laser|cannon/.test(info.id)) return 'beam'
  if (special && (spread || hasFlag(info, 'sound'))) return 'wave'
  if (info.type === 'Electric') return 'strike'
  if (special && (info.type === 'Fire' || info.type === 'Water') && !hasFlag(info, 'bullet')) return 'stream'
  return 'projectile'
}

const KIND_DURATIONS: Record<MoveAnimKind, number> = {
  projectile: BASE_DURATION_MS,
  stream: STREAM_DURATION_MS,
  beam: BEAM_DURATION_MS,
  strike: STRIKE_DURATION_MS,
  quake: QUAKE_DURATION_MS,
  eruption: ERUPTION_DURATION_MS,
  wave: WAVE_DURATION_MS,
  tide: TIDE_DURATION_MS,
  burst: BURST_DURATION_MS,
  arrows: ARROWS_DURATION_MS,
  melee: MELEE_DURATION_MS
}

function baseAnimationFor(info: MoveInfo): MoveAnimRecipe {
  const reps = info.multihit ? 2 : 1
  const type = info.type.toLowerCase()
  const bigHit = info.basePower >= BIG_HIT_POWER

  const hazardImages = HAZARD_IMAGES[info.id]
  if (hazardImages) {
    return { kind: 'projectile', type, durationMs: BASE_DURATION_MS, reps: 1, bigHit: false, hazardImages }
  }

  if (info.category === 'Status') {
    if (info.boostDir) {
      const arrows = { dir: info.boostDir, onSelf: SELF_TARGETS.has(info.target) }
      return { kind: 'arrows', type, durationMs: ARROWS_DURATION_MS, reps: 1, bigHit: false, arrows }
    }
    if (NO_TARGET_TYPES.has(info.target)) {
      return { kind: 'burst', type, none: true, durationMs: 0, reps: 1, bigHit: false }
    }
    return { kind: 'burst', type, durationMs: BURST_DURATION_MS, reps: 1, bigHit: false }
  }

  const kind = kindFor(info)
  const recipe: MoveAnimRecipe = {
    kind,
    type,
    durationMs: scaledDuration(info.basePower, KIND_DURATIONS[kind]),
    reps,
    // A quake always shakes the field - that's the whole animation.
    bigHit: bigHit || kind === 'quake'
  }
  if (kind === 'melee') recipe.mark = meleeMarkFor(info)
  if (SELF_DESTRUCT_MOVES.has(info.id)) {
    recipe.explosion = true
    recipe.bigHit = true
  }
  if (kind === 'stream') recipe.streamCount = Math.round(clampedLerp(info.basePower, 40, 120, 5, 9))
  return recipe
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
