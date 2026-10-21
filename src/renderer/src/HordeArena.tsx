import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  HORDE_BERRY_CHANCE,
  HORDE_BERRY_HEAL,
  HORDE_BOSS_HP,
  HORDE_BOSS_TIMES_MS,
  HORDE_DURATION_MS,
  HORDE_ELITE_EVERY_MS,
  HORDE_ELITE_HP,
  HORDE_EXPLODER_CHAIN_MS,
  HORDE_EXPLODER_CHANCE,
  HORDE_EXPLODER_COUNT,
  HORDE_EXPLODER_FUSE_MS,
  HORDE_EXPLODER_LEAD_GRACE_MS,
  HORDE_EXPLODER_POWER,
  HORDE_EXPLODER_REACH,
  HORDE_EXPLODER_WILD_CHANCE,
  HORDE_KO_EXP,
  HORDE_LEVEL_HEAL,
  HORDE_BASE_STATS,
  HORDE_BOSS_HOLD_BONUS,
  HORDE_EFFECT,
  HORDE_EFFECT_BONUS_MOVES,
  HORDE_EFFECT_MASTERY_MOVES,
  HORDE_EFFECT_BY_MOVES,
  HORDE_EFFECT_OTHER_TYPE_SHARE,
  HORDE_ELITE_HOLD_SHARE,
  HORDE_FREEZE_SHARE,
  HORDE_HOLD_TYPES,
  HORDE_EVOLVE_HEAL,
  HORDE_LUCK_POINTS,
  HORDE_MULTI_REPEAT_MS,
  HORDE_MULTI_REPEAT_SHARE,
  HORDE_EXPLODER_HP,
  HORDE_MULTI_TARGETS,
  HORDE_REROLLS,
  HORDE_BOSS_ATTACK_RAMP_MS,
  HORDE_CRIT_CHANCE,
  hordeSoftCap,
  HORDE_GMAX_CHANCE,
  HORDE_GMAX_HP,
  HORDE_GMAX_WALK,
  HORDE_ITEM_FLASH_MS,
  HORDE_ITEM_LIFESPAN_MS,
  HORDE_MAX_MUSHROOM_HP,
  HORDE_MEGA_CHARGE,
  HORDE_MEGA_ENERGY_SHARE,
  HORDE_MEGA_ENERGY_CHANCE,
  HORDE_MEGA_LEVEL,
  HORDE_MEGA_MS,
  HORDE_MEGA_SPEED,
  HORDE_CRIT_DAMAGE,
  HORDE_ENDLESS_BOSS_EVERY_MS,
  HORDE_BOSS_WALK_RAMP_MS,
  HORDE_ELITE_FULL_EVOLVE_MS,
  HORDE_MOVE_UPGRADE,
  HORDE_EXTRA_HIT_SHARE,
  HORDE_RARITIES,
  HORDE_SPREAD_RADIUS,
  HORDE_ARENA_HEIGHT,
  HORDE_BIG_NUGGET_MONEY,
  HORDE_BONUS_STATS,
  HORDE_BOOSTER_SPEED,
  HORDE_BOSS_SPACING,
  HORDE_FLAME_ORB_DAMAGE,
  HORDE_FOE_HITBOX,
  HORDE_FOE_OFFTYPE_CHANCE,
  HORDE_HITBOX_OVERLAP,
  HORDE_ICY_ROCK_MS,
  HORDE_ITEMS,
  HORDE_ITEM_BUFF_MS,
  HORDE_ITEM_CHANCE,
  HORDE_CHEST_DROP_CHANCE,
  HORDE_ENDLESS_ITEM_SHARE,
  hordeBaseCount,
  hordeCountIsBounce,
  hordeRepeatsOnMulti,
  hordeShownCount,
  hordeCountKind,
  hordeCountUpgrade,
  HORDE_LEAD_HITBOX,
  HORDE_PICKUP_PULL,
  HORDE_PICKUP_RANGE,
  HORDE_PROJECTILE_SPEED,
  HORDE_SCARF_WALK,
  HORDE_SPREAD_FOCUS_BONUS,
  HORDE_SPREAD_WAVE_MS,
  HORDE_FOE_SPACING,
  HORDE_PLAYER_WALK,
  HORDE_STATS,
  HORDE_REGEN_DELAY_MS,
  hordeCurseGain,
  HORDE_SHAPES,
  HORDE_WORLD_WIDTH,
  HORDE_WORLD_HEIGHT,
  HORDE_FOE_LEASH,
  HORDE_RISE_NEAR,
  HORDE_RISE_FAR,
  HORDE_RISE_MS,
  HORDE_GOLD_PER_EXP,
  HORDE_GOLD_CARD,
  HORDE_CHEST_NEAR,
  HORDE_CHEST_FAR,
  HORDE_CHEST_SPACING,
  HORDE_CHEST_REACH,
  HORDE_CHEST_EVERY_MS,
  HORDE_MOST_CHESTS,
  HORDE_SHRINE_KINDS,
  HORDE_SHRINES_AT_START,
  HORDE_SHRINE_EVERY_MS,
  HORDE_SHRINE_SPACING,
  HORDE_SHRINE_LEAD_GAP,
  HORDE_SHRINE_REACH,
  HORDE_SHRINE_ICON,
  HORDE_TOTEM_FOES,
  HORDE_TOTEM_RING,
  HORDE_TOTEM_HP,
  HORDE_TOTEM_LEVELS,
  HORDE_TOTEM_PILES,
  HORDE_TOTEM_RISE,
  HORDE_TAPU_RADIUS,
  HORDE_TAPU_HOLD_MS,
  HORDE_TAPU_BOOST,
  HORDE_TAPU_DRAIN,
  HORDE_TAPU_DEFENDERS,
  HORDE_TAPU_DEFENDER_LEVELS,
  HORDE_SHRINE_GOLD,
  HORDE_SHRINE_GOLD_CHESTS,
  HORDE_TAPU_STATS,
  type HordeShrineKind,
  HORDE_GOLD_SPRITE,
  HORDE_CHEST_SPRITE,
  HORDE_HELD_ITEMS,
  HORDE_HELD_IDS,
  HORDE_MAX_MOVES,
  HORDE_MAX_TOMES,
  HORDE_HELMET_SHARE,
  HORDE_EJECT_LINE,
  HORDE_EJECT_EVERY_MS,
  HORDE_EJECT_REACH,
  HORDE_EJECT_PUSH,
  HORDE_EJECT_SAFE_MS,
  HORDE_METRONOME_STACKS,
  HORDE_SASH_SAFE_MS,
  HORDE_SASH_COOLDOWN_MS,
  HORDE_SHELL_BELL_CAP,
  HORDE_REAPER_ELITE_SHARE,
  HORDE_REAPER_ATTACK,
  HORDE_PEARL_GOLD,
  HORDE_PEARL_MAX,
  HORDE_MUSCLE_BAND_MULT,
  HORDE_BATTERY_REACH,
  HORDE_BATTERY_SHARE,
  HORDE_CHARCOAL_REACH,
  HORDE_CHARCOAL_SHARE,
  HORDE_ICE_FREEZE_MS,
  HORDE_RUSH_MS,
  HORDE_SPELL_TAG_KOS,
  hordeStackedChance,
  hordeChestCost,
  hordeHeldTotals,
  hordeRarityUpCost,
  hordeRaiseRarity,
  hordeRollChest,
  hordeResistBoost,
  formatHordeTime,
  hordeDamage,
  hordeEffectChance,
  hordeEffectTypes,
  hordeTypeEffect,
  hordeRollCrits,
  hordeEffectiveness,
  hordeBaseStatPercent,
  hordeBonusPercent,
  hordeCooldownUpgrade,
  hordeCritUpgrade,
  HORDE_WALK_SLOWEST,
  hordeExpToNext,
  hordeUpgradePower,
  hordeHitsMany,
  hordeMoveShape,
  hordeMoveDef,
  hordeMoveOf,
  hordeMoveBand,
  hordeFindMoveDef,
  hordeMoveCatalog,
  hordeFoeMovePower,
  HORDE_MOMENTUM_MS,
  HORDE_ESCALATE_RESET_MS,
  HORDE_HURT_RECENT_MS,
  HORDE_DASH_MS,
  HORDE_DASH_SAFE_MS,
  HORDE_RECOIL_CAP,
  HORDE_SCATTER_BOUNCE_SHARE,
  HORDE_TRI_PARALYSIS_MS,
  HORDE_SELF_BURN_SAFE,
  HORDE_PARALYSIS_SLOW,
  HORDE_PARALYSIS_SLOW_MS,
  HORDE_FLINCH_STOP_MS,
  HORDE_LEAD_MOD_MIN,
  HORDE_LEAD_MOD_MAX,
  HORDE_MAX_ZONES,
  HORDE_HOP_REACH,
  HORDE_BOOMERANG_OUT,
  HORDE_ORBIT,
  HORDE_ZONE_DRIFT,
  HORDE_METEOR_FALL_MS,
  HORDE_ECHO_MS,
  hordeRangeUpgrade,
  hordePierceSize,
  hordeMaxFoes,
  hordeRollItem,
  hordeFoeCooldownScale,
  hordeFoeHpScale,
  hordeFoeLevel,
  hordeFoeWalk,
  hordeFoeWalkScale,
  hordeEndlessWalkScale,
  hordeFoeAttackScale,
  hordeWaveEliteShare,
  hordeEliteCount,
  hordeLevelChoices,
  hordeChoiceKey,
  hordeCanBanish,
  hordeUpgradeTotal,
  hordeMoveCooldown,
  hordeMovePower,
  hordePoolIndex,
  HORDE_DITTO_BIG_LEVEL,
  HORDE_DITTO_REST_MS,
  HORDE_DITTO_TRANSFORM_MS,
  HORDE_MINIOR_CORE_SPEED,
  hordeRarityOdds,
  hordeSpeedFactor,
  hordeLeadWalk,
  hordeStats,
  hordeWave,
  type HordeBaseStat,
  type HordeBonusStat,
  type HordeFoeKind,
  type HordeHeld,
  type HordeHeldId,
  type HordeHeldStat,
  type HordeTome,
  type HordeItemId,
  type HordeChoice,
  type HordeMove,
  type HordeTypeEffect,
  type HordeLeadStat,
  type HordeMoveAnim,
  type HordeTrait,
  type HordeResult,
  type HordeReward,
  type HordeSave,
  type HordeSetup,
  type HordeSpecies,
  type HordeStat,
  type HordeStats
} from '../../shared/horde'
import SpriteImage from './SpriteImage'
import ShinyIcon from './ShinyIcon'
import RarityCard from './RarityCard'
import HordeChestOpen, { heldBuffText } from './HordeChestOpen'
import ItemSprite from './ItemSprite'
import { gmaxSpriteCandidates, loadSpriteStyle, spriteCandidates } from './spriteStyle'
import { TYPE_COLORS } from './moveAnimations'
import { LOCATION_BUTTON_BACKDROP, backdropUrl, locationIconUrl, nextHordeGroundTile } from './battleScenery'
import { IS_MOBILE_LAYOUT } from './platform'
import { formatMoney } from './money'
import { loadBool, savePref } from './soundPrefs'
import { hitSoundsOn, playHit, preloadHitSounds, setHitSoundsOn } from './hitSounds'
import { itemName, moveName, typeName, useT } from './i18n'
import { hordeTraitText } from './hordeMoveText'
import { HordeFlashFx, HordeStrikeFx, hordeLandingKind, hordeShotClass, ERUPT_ANIMS, MARK_ANIMS, METEOR_ANIMS } from './hordeMoveFx'
import type { MessageKey } from '../../shared/i18n'
import type { RarityTier } from '../../shared/battle-types'
import { WILD_LOCATIONS } from '../../shared/battle-types'

// How big a floor tile's pixels show: arena units per texture pixel (the arena is
// 1000 units tall, so a 64px tile repeats about every sixth of the screen).
const HORDE_GROUND_UNITS_PER_PX = 2.5

type FoeKind = HordeFoeKind

interface Foe {
  id: number
  // The last damage it took (Wildfire's explosion goes off for a share of the hit that finishes it).
  lastHit?: number
  sp: HordeSpecies
  kind: FoeKind
  // The final boss: beating it wins the run.
  final: boolean
  // A Gigantamax boss: twice the HP, half the pace, and a Max Mushroom when beaten.
  gmax: boolean
  // An elite that came with a wave (endless mode): its items and Mega Energy drop as a wild one's do.
  swarm: boolean
  level: number
  stats: HordeStats
  hp: number
  maxHp: number
  // Where it stands in the arena (its feet).
  x: number
  y: number
  // Arena units a second.
  walk: number
  // Stopped close enough to the lead to attack - it only attacks once it has.
  stopped: boolean
  moves: HordeMove[]
  // Only run down once it's close enough to attack - so its first attack is the moment it arrives.
  cooldowns: number[]
  flashUntil: number
  // When it turned up, on the run's clock - a boss gets quicker the longer it's been about.
  bornAt: number
  // Rising out of the ground until then (on the run's clock): no hitbox, no walking, no attacking.
  risingUntil: number
  // How long its rise takes, if not HORDE_RISE_MS (a Totem Trial's callers rise slower).
  riseMs?: number
  // Being washed (or knocked) back: which way, and how much further it has to slide.
  slide: { dx: number; dy: number; left: number } | null
  // When it fainted - it fades out, then goes.
  faintedAt: number | null
  // The type effects on it (see HORDE_EFFECT), each lasting until a time on the run's clock.
  fx: FoeEffects
  // An exploder (see HORDE_EXPLODER_FUSE_MS), once its fuse is lit when it blows (on the run's clock),
  // and whether the lead set it off - by knocking it out, or by a chain that started with one it knocked out.
  exploder?: boolean
  fuseAt?: number
  byLead?: boolean
  // Called up by a Totem Trial (that shrine's id) - and whether it's the totem itself.
  shrine?: number
  totem?: boolean
}

// A knocked-out exploder, left standing where it fell until its fuse burns down and it blows up.
interface Bomb {
  id: number
  sp: HordeSpecies
  kind: FoeKind
  x: number
  y: number
  level: number
  attack: number
  fuseAt: number
  byLead: boolean
}

// What a blast comes from: where, how strong, and whether the lead set it off.
interface BlastSource {
  x: number
  y: number
  level: number
  attack: number
  byLead: boolean
}

// A level-up choice taken, for the pause menu's list: at what level, how rare, and what it was.
interface TakenChoice {
  level: number
  rarity: RarityTier
  kind: string
  title: string
  detail?: string
  // The card as it was offered, shown when hovering its row (none in runs saved before this).
  card?: CardFace
  // A Tapu Ruin's blessing rather than a level-up pick.
  shrine?: boolean
}

// What a level-up choice's card shows: its kind, title, badges, each value before and
// after, and the lines under them.
interface CardFace {
  rarity: RarityTier
  kind: string
  title: string
  // Each value it changes: before (none for a new move's own) and after, and a head start it comes with.
  changes: { label: string; before?: string | number; after: string | number; bump?: string }[]
  lines: string[]
  // The badges under the title - a move's shape and its type's effect - each with what it means,
  // shown when hovered (tapped on a phone). Cards saved before them have the one badge instead.
  tags?: { label: string; tip: string[]; color?: string; pips?: number }[]
  // A move's own twist, under its stats.
  twist?: string
  // A tome's rank once taken (none for a new one).
  rank?: number
  color?: string
  badge?: string
  isNew: boolean
  icon?: 'physical' | 'special' | 'status'
  // Which sort of card it is - a new move, a move's upgrade, a tome or a type's effect - so
  // each looks its own at a glance (none on cards saved before this).
  group?: 'move' | 'upgrade' | 'tome'
  // The move's (or effect's) type, shown as a type badge.
  type?: string
}

interface FoeEffects {
  // Damage a second.
  burn: { dps: number; until: number } | null
  poison: { dps: number; from: number; until: number }[]
  // Stopped where it stands (paralysis, tremor, a confused foe fainting nearby).
  stopUntil: number
  frozenUntil: number
  // Paralysis's slow, and Ice's chill (each stack slowing by `per`).
  slow: { amount: number; until: number } | null
  chill: { stacks: number; per: number; until: number } | null
  // Guard Break: each stack lowers Defense by `per`.
  guard: { stacks: number; per: number; until: number } | null
  vulnerableUntil: number
  confusedUntil: number
  spookedUntil: number
  // Spooked by running into a fleeing foe (Swarm) - it doesn't pass it on.
  spookCaught?: boolean
  charm: { cut: number; until: number } | null
  // Stats lowered by moves (see foeDrop), each by a share until a time - none in runs saved before them.
  drop?: Partial<Record<HordeLeadStat, { amount: number; until: number }>>
}

function noEffects(): FoeEffects {
  return {
    burn: null,
    poison: [],
    stopUntil: 0,
    frozenUntil: 0,
    slow: null,
    chill: null,
    guard: null,
    vulnerableUntil: 0,
    confusedUntil: 0,
    spookedUntil: 0,
    charm: null,
    drop: {}
  }
}

// Stealth Rock left on the ground.
interface Rock {
  id: number
  x: number
  y: number
  dps: number
  until: number
  // The foes that have stepped on it (Avalanche's burst hits each once).
  hit?: number[]
}

interface Popup {
  id: number
  x: number
  y: number
  text: string
  kind: 'hit' | 'crit' | 'super' | 'weak' | 'miss' | 'heal' | 'hurt' | 'level' | 'effect' | 'dot' | 'item'
  born: number
  // A type effect's popup, in its type's colour.
  color?: string
}

interface Burst {
  id: number
  x: number
  y: number
  type: string
  spread: boolean
  born: number
}

interface KnownMove {
  move: HordeMove
  // Its upgrades so far: percent more power, percent off its cooldown, percent more reach,
  // extra shots or strikes, percent more crit damage, and how many.
  power: number
  cut: number
  range: number
  count: number
  crit: number
  upgrades: number
  // What its twist keeps count of (see HordeTrait): how many times it's been used, the run of
  // uses in a row and when it was last used, the power its KOs have added for good, and until
  // when it's charging up or rampaging (on the run's clock).
  uses?: number
  streak?: number
  lastUseAt?: number
  koPower?: number
  chargeUntil?: number
  rampUntil?: number
}

// Where the Stealth Rock pieces sit on a rock spot, round its middle.
const ROCK_PIECES = [
  { image: 'rock1', dx: -18, dy: -4, width: 24 },
  { image: 'rock2', dx: 10, dy: -8, width: 22 },
  { image: 'rock1', dx: 2, dy: 6, width: 20 },
  { image: 'rock2', dx: 22, dy: 4, width: 18 }
]

/** A known move's twist. */
function traitOf(known: KnownMove): HordeTrait {
  return hordeMoveDef(known.move).trait
}

/** A known move's own look, if it has one. */
function animOf(known: KnownMove): HordeMoveAnim | undefined {
  return hordeMoveDef(known.move).anim
}

// How much further a move reaches with its reach upgrades.
function reachScale(known: KnownMove): number {
  return 1 + known.range / 100
}

/** How many times its width a stream is: its reach upgrades widen it by more than they lengthen it. */
function beamWidthScale(known: KnownMove): number {
  return 1 + (known.range / 100) * HORDE_SHAPES.beamWidthGrowth
}

// Electric's chain jumping from one foe to the next: a bolt between them for a moment.
interface Arc {
  id: number
  x1: number
  y1: number
  x2: number
  y2: number
  type: string
  born: number
}

// A move flying to its target - it hits when it gets there. A blast explodes there, hitting
// everyone close by; scatter's shots are smaller; a piercing shot flies straight on instead,
// hitting every foe it passes once, until it's flown its range.
interface Shot {
  id: number
  x: number
  y: number
  targetId: number
  known: KnownMove
  blast?: boolean
  small?: boolean
  pierce?: { dx: number; dy: number; size: number; hit: Set<number> }
  // Which way it's flying, kept so that once its target faints it flies straight on.
  heading?: { dx: number; dy: number }
  // The share of the move's damage it deals, when the move fires more shots than it started with.
  share?: number
  // Split off another shot (it doesn't split or come back again), the hops it has left and the
  // foes it's hit (bounce), and a boomerang's flight: how much further it goes on before it
  // turns, then flying back to the lead (a piercing shot that ends at the lead).
  child?: boolean
  bounces?: number
  hitIds?: number[]
  outLeft?: number
  returning?: boolean
}

// A strike called down on a foe: it lands (on the run's clock) a moment later, wherever the
// foe is by then - or on another foe at random if that one's gone.
interface Strike {
  id: number
  targetId: number
  known: KnownMove
  // Hits many (one of rain's strikes) or one (a strike move).
  many: boolean
  landsAt: number
  // The share of the move's damage it deals (see Shot).
  share?: number
  // A strike its twist called down after the first (Thunder's storm) - it calls no more.
  follow?: boolean
  // How long before landing it's drawn coming down.
  fallMs?: number
}

// A stream pouring out in front of the lead the way it was aimed, hitting everything in it
// each pulse. The type effect rolls only on a foe's first pulse.
interface Beam {
  id: number
  known: KnownMove
  dx: number
  dy: number
  // On the run's clock.
  born: number
  pulses: number
  hit: Set<number>
  // The hardest hit it's landed on one foe, for the ground it leaves (see the zone twist).
  best?: number
  // A stream poured from somewhere other than the lead (Fire Blast's star): where from, how long
  // and wide, and the share of a stream's usual run (and pulses) it lasts.
  from?: { x: number; y: number }
  length?: number
  width?: number
  part?: number
}

// A cone, a blast's explosion or a strike coming down: only drawn, for a moment (real time).
interface Flash {
  id: number
  // ...or a move's own look as it lands (see hordeMoveFx): a bolt from the sky, a burst up out of
  // the ground, a crater, a swirl, or a melee hit's mark - or a shot bouncing off a foe.
  kind: 'cone' | 'blast' | 'strike' | 'boom' | 'bolt' | 'erupt' | 'crater' | 'vortex' | 'mark' | 'hop'
  anim?: HordeMoveAnim
  x: number
  y: number
  dx: number
  dy: number
  type: string
  born: number
  // A cone's depth or a blast's size, with its move's reach upgrades.
  reach?: number
}

// A spread move's wave rolling out round the lead - it hits everyone inside once fully out.
interface Wave {
  id: number
  known: KnownMove
  // On the run's clock (an aftershock's is when it starts rolling out).
  born: number
  // How far it rolls out, times the move's own ring, and the share of the damage it deals.
  reach?: number
  share?: number
  // An aftershock: it brings no more of them.
  follow?: boolean
  // Tidal Wave (Water's mastery): it washes everything in the ring away, with no twists.
  tide?: boolean
}

// Ground a move left behind (see the zone and trap twists): it hurts foes standing in it every
// second, and may slow them, pull them in, or wander about.
interface Zone {
  id: number
  known: KnownMove
  x: number
  y: number
  reach: number
  dps: number
  slow: number
  pull: number
  drift: boolean
  // A wandering zone's heading.
  dx: number
  dy: number
  born: number
  until: number
}

// Balls circling the lead (the orbit shape), each foe hit at most once every so often.
interface Orb {
  id: number
  known: KnownMove
  balls: number
  born: number
  until: number
  hits: Record<number, number>
}

// A stat of the lead's raised or lowered for a while by a move.
interface LeadMod {
  stat: HordeLeadStat
  amount: number
  until: number
  // The type of the move that did it (for its colour in the effects row).
  type?: string
}

// Experience, or an item, lying where a wild Pokemon fell until the lead picks it up.
interface Drop {
  id: number
  x: number
  y: number
  exp: number
  item: HordeItemId | null
  // Mega Energy rather than experience (exp is how much).
  mega: boolean
  // When it dropped, on the run's clock - an item only lasts a minute.
  born: number
  // Experience from a shrine (a Totem Trial), whose gold Good as Gold doesn't raise.
  shrine?: boolean
  // Picked up and flying to the lead.
  pulled: boolean
}

// How a run ends: fainted, or given up / ended by the player.
type Outcome = 'fainted' | 'quit'

// A chest on the field, waiting to be opened with gold.
interface Chest {
  id: number
  x: number
  y: number
}

// A shrine on the field (see HORDE_SHRINE_EVERY_MS): a Totem Trial, once started, until all it
// called up are down; a Tapu Ruin, once its defenders have woken, and how full it is (in ms stood in it).
interface Shrine {
  id: number
  kind: HordeShrineKind
  x: number
  y: number
  started: boolean
  heldMs: number
}

interface Game {
  // The screen's width in arena units (its height is HORDE_ARENA_HEIGHT), matching the stage's shape.
  width: number
  // The field it's played on, and the camera: the field's spot at the screen's top left.
  worldW: number
  worldH: number
  camX: number
  camY: number
  // Where the lead stands on the field, and which way it faces (1 right, -1 left).
  px: number
  py: number
  facing: 1 | -1
  // Where the lead's last move struck, for its lunge toward it.
  aimX: number
  aimY: number
  elapsed: number
  nextWaveAt: number
  nextEliteAt: number
  // Knocked-out exploders burning down, and when a blast last hit the lead.
  bombs: Bomb[]
  leadBlastAt: number
  bossesSpawned: number
  kos: number
  level: number
  levelsGained: number
  exp: number
  // Levels gained whose choice hasn't been made yet - true for the one it evolved at (all legendary).
  pendingChoices: boolean[]
  // What it is now, and how far along its evolution line (setup.evolutions) it's got.
  form: HordeSpecies
  evolved: number
  known: KnownMove[]
  // The percent each stat has gained from level-up picks, the percents from Area, Haste, Pickup and Crit picks, and the Luck picked up.
  statBonus: Record<HordeBaseStat, number>
  bonus: Record<HordeBonusStat, number>
  luck: number
  // Multi-target picks taken (each lets single-target moves hit one more foe in the spread ring), level-up rerolls
  // and banishes left, and the new moves and tomes banished (see hordeChoiceKey) - never offered again this run.
  multi: number
  rerolls: number
  banishes: number
  banished: string[]
  // How many more times the Move Deleter (from a level-up) can be used this run.
  moveDeletes: number
  // A run saved before moveDeletes: whether its one use was spent.
  moveDeleted?: boolean
  // Every level-up choice taken, oldest first.
  log: TakenChoice[]
  // The tomes held (see HORDE_MAX_TOMES), in the order they were taken.
  tomes: HordeTome[]
  // Gold to open chests with, the chests still on the field, how many have been opened, the
  // held items they gave, and when endless mode next adds a chest (on the run's clock).
  gold: number
  chests: Chest[]
  chestsOpened: number
  held: HordeHeld
  nextChestAt: number
  // The shrines still on the field, when the next of each kind turns up (on the run's clock),
  // and how many have been done this run.
  shrines: Shrine[]
  nextShrineAt: number
  shrinesDone: number
  // A shrine's reward, shown big at the top of the screen until then (on the run's clock).
  shrineBanner: { kind: HordeShrineKind; title: string; lines: string[]; until: number } | null
  stats: HordeStats
  hp: number
  maxHp: number
  cooldowns: number[]
  lastMove: { name: string; type: string; at: number } | null
  hurtAt: number
  // When a foe last hurt the lead, on the run's clock - HP back over time waits a moment after (see HORDE_REGEN_DELAY_MS).
  hurtClock: number
  foes: Foe[]
  popups: Popup[]
  bursts: Burst[]
  arcs: Arc[]
  shots: Shot[]
  waves: Wave[]
  strikes: Strike[]
  // Melee and piercing moves' repeats from Multi-shot, each going off again at its time.
  repeats: { known: KnownMove; at: number }[]
  beams: Beam[]
  flashes: Flash[]
  drops: Drop[]
  // What moves' twists leave about (see Zone, Orb, LeadMod): ground that hurts, balls circling the
  // lead, its stats raised or lowered for a while.
  zones: Zone[]
  orbs: Orb[]
  leadMods: LeadMod[]
  // A dash under way (on the run's clock): only the lead's sprite darts this far the given way and
  // back - the lead itself (and the camera) stays put. And a move's vanishing act - the lead comes
  // up under its foe once it's over. Till safeUntil nothing can hit it.
  dash: { dx: number; dy: number; reach: number; start: number } | null
  burrow: { known: KnownMove; targetId: number; until: number } | null
  safeUntil: number
  // A rampage leaves the lead's moves coming round slower till then, by this much.
  fatigue: { amount: number; until: number } | null
  // Hyper Beam leaves the lead's other moves (all but this one) coming round slower till then, by this much.
  exhaust: { moveId: string; amount: number; until: number } | null
  // Overheat's burn on the lead: HP lost every second (never fainting from it) till then.
  leadBurn: { hurt: number; until: number } | null
  // Held items' own rules: when a Focus Sash and the Eject Button can next go off, the Metronome's stacks, and
  // the Shell Bell's healing in the second it's in (and which second).
  sashReadyAt: number
  ejectReadyAt: number
  metronome: number
  bell: { second: number; healed: number; carry: number }
  // Rarity-ups bought on the level-up screen this run (each dearer than the last).
  rarityUps: number
  // Every chest opened this run, paid for or not (Relic Crown, Luck Incense), the Reaper Cloth's
  // executes, when the Eject Pack's rush ends, and whether the level-up on screen is a Rare Candy's.
  chestsGot: number
  reaped: number
  rushUntil: number
  candyScreen: boolean
  // How long it's been walking without stopping (Momentum), and until when the screen shakes (real time).
  walkMs: number
  shakeUntil: number
  // When gems lying close together are next merged, on the run's clock.
  nextGatherAt: number
  focusId: number | null
  seq: number
  // Real time (performance.now) - for the effects, which keep their own pace.
  now: number
  // The run's own clock, which (unlike elapsed) keeps going through the final boss - type effects time by it.
  clock: number
  // When damage over time (burn, poison, rocks) next ticks.
  nextTickAt: number
  // When Tidal Wave and Gale next go off, and how many hits since the last sure Ambush (Assassin).
  nextTideAt: number
  nextGaleAt: number
  darkHits: number
  // Iron Guard's and Leech's shield, soaking up damage before HP.
  shield: number
  tailwind: { speed: number; until: number } | null
  rage: { stacks: number; per: number; until: number } | null
  rocks: Rock[]
  // The items' effects: until when the Choice Scarf, Booster Energy and Flame Orb last (on
  // the run's clock), and the Big Nuggets picked up.
  scarfUntil: number
  boosterUntil: number
  flameUntil: number
  bigNuggets: number
  // Mega Evolved: into what (null when not), until when, and the Mega Energy gathered toward the next.
  megaForm: HordeSpecies | null
  megaUntil: number
  megaCharge: number
  // Mega Evolved at least once this run.
  megaEvolved: boolean
  // Minior's Core form or what Ditto has transformed into (null when it's itself), and when
  // Ditto next changes (into something, or back).
  altForm: HordeSpecies | null
  nextShiftAt: number
  // What Max Mushrooms have grown its max HP by, as a multiplier.
  hpMult: number
  // Lasted the full 10 minutes (the final boss is out), and beat that boss - which completes
  // the run and starts endless mode, with a boss every 5 minutes.
  timeUp: boolean
  cleared: boolean
  endless: boolean
  // When endless mode began (on the arena's clock) - elites only start speeding up from then.
  endlessAt?: number
  nextEndlessBossAt: number
  endlessBosses: number
  // How many chests had been opened when endless mode began (see shrineGold).
  endlessChests?: number
  // How many screen pixels an arena unit is, for drawing lengths (Electric's bolts).
  unitPx: number
  // The damage each move has dealt this run, by its name (EFFECTS_KEY for effects' own damage).
  damage: Record<string, number>
  outcome: Outcome | null
}

// Where burns, poison, rocks, chains and tremors add up in the run's damage list.
const EFFECTS_KEY = ''

// How far outside the screen wild Pokemon turn up, and how far along an edge from its
// corner (as a share of that edge) - so they pour in from the corners.
const SPAWN_OUTSIDE = 50
const SPAWN_CORNER_SHARE = 0.35
// The lead keeps this far inside the field's edges.
const PLAYER_MARGIN = 30
// How wide an angle (radians) a wave rises across, on its side of the lead.
const WAVE_SPREAD = 0.9
// Water's bonus drags foes within this of the push's path.
const DRAG_WIDTH = 40
// Rage's bonus hits a foe behind the target - no more than this angle off the line through it.
const BEHIND_COS = Math.cos(Math.PI / 6)
// Experience dropped this close to a pile still on the ground joins it.
const EXP_MERGE_REACH = 30
// Every so often, gems lying this close together merge into one once there's enough of them
// for the next size up (keeping the arena from filling up with gems).
const EXP_GATHER_REACH = 110
const EXP_GATHER_EVERY_MS = 500
// A shot, or something pulled in, arrives once this close.
const ARRIVE_REACH = 14
// Shots aim this far above a foe's feet, at its body.
const BODY_HEIGHT = 25
const POPUP_MS = 800
// How long a shrine's reward stays up at the top of the screen.
const SHRINE_BANNER_MS = 6000

// A pause menu switch: its label, and a sliding knob on a track lit up while it's on.
function PauseToggle({ label, on, onChange }: { label: string; on: boolean; onChange: (on: boolean) => void }): React.JSX.Element {
  return (
    <button type="button" role="switch" aria-checked={on} className={`horde-switch${on ? ' horde-switch-on' : ''}`} onClick={() => onChange(!on)}>
      <span className="horde-switch-label">{label}</span>
      <span className="horde-switch-track" aria-hidden="true">
        <span className="horde-switch-knob" />
      </span>
    </button>
  )
}
// The range rings round the lead (switched on or off in the pause menu), and how long one
// lights up after a pick grows it.
type RingKind = 'spread' | 'melee' | 'pickup'
const RING_FLASH_MS = 1500
// The popups that are damage numbers - the ones the pause menu can switch off.
const DAMAGE_POPUPS: Popup['kind'][] = ['hit', 'crit', 'super', 'weak', 'hurt', 'dot']
const BURST_MS = 380
const FAINT_MS = 420
const ARC_MS = 220
// How long a cone, a blast or a strike coming down is drawn.
const FLASH_MS = 300
// How long an exploder's blast is drawn (its fireball, then the smoke drifting off).
const BOOM_MS = 900
// How long the rest last, where it isn't FLASH_MS: a move's own look takes its own time.
const FLASH_LASTS: Partial<Record<Flash['kind'], number>> = { boom: BOOM_MS, bolt: 320, erupt: 480, crater: 520, vortex: 650, mark: 280, hop: 380 }
// Kenney's particle images (CC0, public/battle/horde/fx): white shapes each move effect tints
// with its type's colour, and the exploders' fireballs (one of three, at random), flash and smoke.
const fxFile = (name: string): string => `./battle/horde/fx/${name}.png`
const fxUrl = (name: string): string => `url('${fxFile(name)}')`
const FX_VARS = {
  '--fx-star': fxUrl('star'),
  '--fx-sparkle': fxUrl('sparkle'),
  '--fx-burst': fxUrl('burst'),
  '--fx-ring': fxUrl('ring'),
  '--fx-bolt': fxUrl('bolt'),
  '--fx-bolt-side': fxUrl('bolt-side'),
  '--fx-streak': fxUrl('streak'),
  '--fx-flash': fxUrl('flash'),
  '--fx-smoke': fxUrl('smoke')
} as React.CSSProperties
const BOOM_FIREBALLS = 3
// Every effect picture, so the run can load them all before the first move goes off.
const FX_FILES = [
  ...['star', 'sparkle', 'burst', 'ring', 'bolt', 'bolt-side', 'streak', 'flash', 'smoke'],
  ...Array.from({ length: BOOM_FIREBALLS }, (_, i) => `explosion-${i}`)
].map(fxFile)
// How fast a washed-back foe slides, in arena units a second.
const SLIDE_SPEED = 700

/**
 * How much quicker a boss (and in endless mode an elite too) has got for how long it's been on the field: its walking, and its attacks.
 * An elite left over from before endless mode counts only from when it began, so it doesn't leap to full speed the moment the final boss falls.
 * In endless mode every foe also walks quicker the longer endless mode has gone on (see hordeEndlessWalkScale).
 */
function bossRamp(g: Game, foe: Foe): { walk: number; attack: number } {
  const endless = g.endless ? hordeEndlessWalkScale(g.elapsed) : 1
  if (foe.kind !== 'boss' && !(foe.kind === 'elite' && g.endless)) return { walk: endless, attack: 1 }
  const since = foe.kind === 'elite' ? Math.max(foe.bornAt, g.endlessAt ?? 0) : foe.bornAt
  const onField = Math.max(0, g.clock - since)
  return { walk: (1 + onField / HORDE_BOSS_WALK_RAMP_MS) * endless, attack: 1 + onField / HORDE_BOSS_ATTACK_RAMP_MS }
}

const STAT_KEYS = {
  hp: 'horde.stat.hp',
  atk: 'horde.stat.atk',
  def: 'horde.stat.def',
  spe: 'horde.stat.spe',
  area: 'horde.stat.area',
  haste: 'horde.stat.haste',
  pickup: 'horde.stat.pickup',
  critChance: 'horde.stat.critChance',
  critDamage: 'horde.stat.critDamage',
  exp: 'horde.stat.exp',
  resist: 'horde.stat.resist',
  regen: 'horde.stat.regen',
  goldGain: 'horde.stat.goldGain',
  luck: 'horde.stat.luck'
} as const

// What each ability (a level-up pick of a stat) is called - after a Pokemon ability.
const ABILITY_KEYS: Record<HordeStat, MessageKey> = {
  hp: 'horde.stat.hp',
  atk: 'horde.ability.atk',
  def: 'horde.ability.def',
  spe: 'horde.ability.spe',
  area: 'horde.ability.area',
  haste: 'horde.ability.haste',
  pickup: 'horde.ability.pickup',
  critChance: 'horde.ability.critChance',
  critDamage: 'horde.ability.critDamage',
  exp: 'horde.ability.exp',
  resist: 'horde.ability.resist',
  regen: 'horde.ability.regen',
  goldGain: 'horde.ability.goldGain',
  luck: 'horde.ability.luck',
  curse: 'horde.ability.curse'
}

function isBonusStat(stat: HordeStat): stat is HordeBonusStat {
  return (HORDE_BONUS_STATS as HordeStat[]).includes(stat)
}

const RARITY_KEYS = {
  common: 'rarity.common',
  uncommon: 'rarity.uncommon',
  rare: 'rarity.rare',
  epic: 'rarity.epic',
  legendary: 'rarity.legendary'
} as const

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)]
}

function typeColor(type: string): string {
  return TYPE_COLORS[type.toLowerCase()] ?? TYPE_COLORS.normal
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by)
}

// Who's drawn in front: whoever stands lower on screen.
// Only the ones still going - the same list back when none are done, so a quiet frame
// builds no new lists.
function keep<T>(list: T[], going: (item: T) => boolean): T[] {
  return list.every(going) ? list : list.filter(going)
}

function depth(y: number): number {
  return 10 + Math.round(y / 10)
}

// The four corners, as which side each is on (0 left/top, 1 right/bottom).
const CORNERS: [number, number][] = [
  [0, 0],
  [1, 0],
  [0, 1],
  [1, 1]
]

/**
 * The lead's stats: its form's at its level, with the percent its stat picks add on top -
 * all but Speed, whose picks quicken the walk instead (see leadWalk).
 */
function leadStats(form: HordeSpecies, level: number, bonus: Record<HordeBaseStat, number>): HordeStats {
  const base = hordeStats(form.baseStats, level)
  const out = {} as HordeStats
  for (const stat of HORDE_BASE_STATS) out[stat] = stat === 'spe' ? base.spe : Math.round(base[stat] * (1 + bonus[stat] / 100))
  return out
}

/** How fast the lead walks for its Speed, with its Speed picks, items and upgrades (more for a slow lead - see hordeLeadWalk). */
function leadWalk(g: Game, bonusPercent = statPercents(g).spe): number {
  return hordeLeadWalk(g.stats.spe, g.level, bonusPercent)
}

/** What the held items add, by what they raise (nothing for what none raise). */
/** The label of what a move's count upgrades add (see hordeCountKind). */
const COUNT_LABEL_KEYS = { bounces: 'horde.change.bounces', hits: 'horde.change.hits', shots: 'horde.change.count' } as const

function heldOf(g: Game, stat: HordeHeldStat): number {
  return hordeHeldTotals(g.held)[stat] ?? 0
}

/** The share (0-1) of its own moves' drawbacks the lead shrugs off, from Clear Amulets. */
function amuletShare(g: Game): number {
  return Math.min(1, heldOf(g, 'amulet') / 100)
}

/** The percent each base stat has gained: from tomes and from held items. */
function statPercents(g: Game): Record<HordeBaseStat, number> {
  const out = { ...g.statBonus }
  for (const stat of HORDE_BASE_STATS) out[stat] += heldOf(g, stat)
  out.atk += reaperAttack(g) + spellTagAttack(g)
  return out
}

/** The Attack (percent) from the Reaper Cloth's executes this run. */
function reaperAttack(g: Game): number {
  return g.reaped * HORDE_REAPER_ATTACK
}

/** The Attack (percent) from Spell Tags, for every so many KOs this run. */
function spellTagAttack(g: Game): number {
  return Math.floor(g.kos / HORDE_SPELL_TAG_KOS) * heldOf(g, 'koAttack')
}

/** The damage (percent) held items add right now: Relic Crowns by chests opened, Pearl Strings by gold held, Quick Powders by walking speed bonus. */
function growingDamage(g: Game): { crown: number; pearl: number; powder: number } {
  return {
    crown: heldOf(g, 'chestDamage') * g.chestsGot,
    pearl: Math.min(HORDE_PEARL_MAX, heldOf(g, 'goldDamage') * Math.floor(g.gold / HORDE_PEARL_GOLD)),
    powder: heldOf(g, 'speedDamage') * Math.max(0, statPercents(g).spe)
  }
}

/** The Luck from Luck Incenses, for every chest opened this run. */
function incenseLuck(g: Game): number {
  return heldOf(g, 'chestLuck') * g.chestsGot
}

/** A chance (0-1) from the held copies of an item whose chances don't simply add up (Card Key, Bright Powder). */
function stackedChance(g: Game, id: HordeHeldId): number {
  return hordeStackedChance(id, g.held[id] ?? 0)
}

/** One of Area, Haste, Pickup, Crit chance and Crit damage: from tomes and held items (Crit past its soft cap gives less). */
function bonusOf(g: Game, stat: HordeBonusStat, extra = 0): number {
  return Math.round(hordeSoftCap(stat, g.bonus[stat] + heldOf(g, stat) + extra) * 10) / 10
}

/** The lead's Luck: from tomes (and the Horde page) and Lucky Punches. */
function luckOf(g: Game): number {
  return g.luck + heldOf(g, 'luck') + incenseLuck(g)
}

/** A spot moved onto the field, at least this far in from its edges. */
function clampToWorld(g: Game, x: number, y: number, margin: number): { x: number; y: number } {
  return {
    x: Math.max(margin, Math.min(g.worldW - margin, x)),
    y: Math.max(margin, Math.min(g.worldH - margin, y))
  }
}

/**
 * Chests turning up around the lead: each a little way off (out of reach, but close by) and
 * apart from every other - or, failing that after a few tries, wherever the last try landed.
 */
function placeChests(g: Game, count: number): void {
  for (let n = 0; n < count; n++) {
    let spot = { x: g.px, y: g.py }
    for (let tries = 0; tries < 40; tries++) {
      const angle = Math.random() * Math.PI * 2
      const far = HORDE_CHEST_NEAR + Math.random() * (HORDE_CHEST_FAR - HORDE_CHEST_NEAR)
      spot = clampToWorld(g, g.px + Math.cos(angle) * far, g.py + Math.sin(angle) * far, 80)
      const clear =
        dist(spot.x, spot.y, g.px, g.py) > HORDE_CHEST_REACH &&
        g.chests.every((c) => dist(c.x, c.y, spot.x, spot.y) >= HORDE_CHEST_SPACING)
      if (clear) break
    }
    g.chests.push({ id: g.seq++, ...spot })
  }
}

/**
 * A shrine of a kind turning up anywhere on the field, well away from the lead and every other
 * shrine - or, failing that after many tries, the try that was furthest from them all.
 */
function placeShrine(g: Game, kind: HordeShrineKind): void {
  const margin = HORDE_TAPU_RADIUS + 40
  const gap = (x: number, y: number): number =>
    Math.min(dist(x, y, g.px, g.py) - HORDE_SHRINE_LEAD_GAP, ...g.shrines.map((s) => dist(s.x, s.y, x, y) - HORDE_SHRINE_SPACING))
  let best = { x: margin, y: margin }
  let bestGap = -Infinity
  for (let tries = 0; tries < 60; tries++) {
    const x = margin + Math.random() * (g.worldW - 2 * margin)
    const y = margin + Math.random() * (g.worldH - 2 * margin)
    const room = gap(x, y)
    if (room > bestGap) {
      best = { x, y }
      bestGap = room
    }
    if (room >= 0) break
  }
  g.shrines.push({ id: g.seq++, kind, ...best, started: false, heldMs: 0 })
}

/** The shrines of every kind turning up together (see HORDE_SHRINES_AT_START). */
function placeShrines(g: Game, each: number): void {
  for (let n = 0; n < each; n++) for (const kind of HORDE_SHRINE_KINDS) placeShrine(g, kind)
}

/** The camera on the lead, kept inside the field. */
function followLead(g: Game): void {
  g.camX = Math.max(0, Math.min(g.worldW - g.width, g.px - g.width / 2))
  g.camY = Math.max(0, Math.min(g.worldH - HORDE_ARENA_HEIGHT, g.py - HORDE_ARENA_HEIGHT / 2))
}

function newGame(setup: HordeSetup): Game {
  // The Horde page's upgrades start it off with HP, Speed, Haste, Pickup, Luck and rerolls.
  const up = setup.upgrades
  const statBonus = { hp: hordeUpgradeTotal('hp', up.hp), atk: 0, def: 0, spe: hordeUpgradeTotal('spe', up.spe ?? 0) }
  const stats = leadStats(setup.fighter, 1, statBonus)
  // The stage is measured once it's on screen; until then a 16:9 screen. The lead starts in the field's middle.
  const width = Math.round((HORDE_ARENA_HEIGHT * 16) / 9)
  const px = HORDE_WORLD_WIDTH / 2
  const py = HORDE_WORLD_HEIGHT / 2
  const g: Game = {
    width,
    worldW: HORDE_WORLD_WIDTH,
    worldH: HORDE_WORLD_HEIGHT,
    camX: px - width / 2,
    camY: py - HORDE_ARENA_HEIGHT / 2,
    px,
    py,
    facing: 1,
    aimX: px,
    aimY: py,
    elapsed: 0,
    nextWaveAt: 1500,
    nextEliteAt: HORDE_ELITE_EVERY_MS,
    bombs: [],
    leadBlastAt: -Infinity,
    bossesSpawned: 0,
    kos: 0,
    level: 1,
    levelsGained: 0,
    exp: 0,
    pendingChoices: [],
    form: setup.fighter,
    evolved: 0,
    // It starts knowing just the setup's first move.
    known: [{ move: setup.moves[0], power: 0, cut: 0, range: 0, count: 0, crit: 0, upgrades: 0 }],
    statBonus,
    bonus: {
      area: 0,
      haste: hordeUpgradeTotal('haste', up.haste),
      pickup: hordeUpgradeTotal('pickup', up.pickup),
      critChance: 0,
      critDamage: 0,
      exp: 0,
      resist: 0,
      regen: 0,
      goldGain: 0
    },
    luck: hordeUpgradeTotal('luck', up.luck),
    multi: 0,
    rerolls: HORDE_REROLLS + hordeUpgradeTotal('reroll', up.reroll) + (setup.extraRerolls ?? 0),
    banishes: hordeUpgradeTotal('banish', up.banish ?? 0),
    banished: [],
    moveDeletes: setup.moveDeletes ?? 1,
    log: [],
    tomes: [],
    gold: 0,
    chests: [],
    chestsOpened: 0,
    held: {},
    nextChestAt: HORDE_CHEST_EVERY_MS,
    stats,
    hp: stats.hp,
    maxHp: stats.hp,
    cooldowns: [400],
    lastMove: null,
    hurtAt: 0,
    hurtClock: -Infinity,
    foes: [],
    popups: [],
    bursts: [],
    arcs: [],
    shots: [],
    waves: [],
    strikes: [],
    repeats: [],
    beams: [],
    flashes: [],
    drops: [],
    zones: [],
    orbs: [],
    leadMods: [],
    dash: null,
    burrow: null,
    safeUntil: 0,
    fatigue: null,
    exhaust: null,
    leadBurn: null,
    sashReadyAt: 0,
    ejectReadyAt: 0,
    metronome: 0,
    bell: { second: 0, healed: 0, carry: 0 },
    rarityUps: 0,
    chestsGot: 0,
    reaped: 0,
    rushUntil: 0,
    candyScreen: false,
    walkMs: 0,
    shakeUntil: 0,
    nextGatherAt: 0,
    focusId: null,
    seq: 1,
    now: performance.now(),
    clock: 0,
    nextTickAt: 1000,
    nextTideAt: 0,
    nextGaleAt: 0,
    darkHits: 0,
    shield: 0,
    tailwind: null,
    rage: null,
    rocks: [],
    scarfUntil: 0,
    boosterUntil: 0,
    flameUntil: 0,
    bigNuggets: 0,
    megaForm: null,
    megaUntil: 0,
    megaEvolved: false,
    megaCharge: 0,
    altForm: null,
    nextShiftAt: HORDE_DITTO_REST_MS,
    hpMult: 1,
    timeUp: false,
    cleared: false,
    endless: false,
    nextEndlessBossAt: 0,
    endlessBosses: 0,
    unitPx: 1,
    damage: {},
    outcome: null,
    shrines: [],
    nextShrineAt: HORDE_SHRINE_EVERY_MS,
    shrinesDone: 0,
    shrineBanner: null
  }
  placeShrines(g, HORDE_SHRINES_AT_START)
  return g
}

/**
 * The state of play to save: everything mid-flight (shots, strikes, waves, streams) and
 * everything only drawn (popups, bursts, bolts, flashes) is left out, as are fainting foes -
 * and anything timed in real time, which starts over when it's carried on.
 */
function saveGame(g: Game): unknown {
  return {
    ...g,
    foes: g.foes.filter((f) => f.faintedAt === null).map((f) => ({ ...f, flashUntil: 0 })),
    popups: [],
    bursts: [],
    arcs: [],
    shots: [],
    waves: [],
    strikes: [],
    repeats: [],
    beams: [],
    flashes: [],
    orbs: [],
    dash: null,
    burrow: null,
    safeUntil: 0,
    lastMove: null,
    hurtAt: 0,
    outcome: null
  }
}

/** A saved state of play, carried on from now. */
function loadGame(saved: unknown): Game {
  const g = { ...(saved as Game), now: performance.now() }
  g.damage ??= {}
  // A run saved before the Experience or Resisted damage tomes: none of them yet.
  g.bonus = { ...g.bonus, exp: g.bonus.exp ?? 0, resist: g.bonus.resist ?? 0, regen: g.bonus.regen ?? 0, goldGain: g.bonus.goldGain ?? 0 }
  g.hurtClock ??= -Infinity
  // A run saved while HP was still an ability: its slot frees up (the HP it gave stays).
  if (g.tomes) g.tomes = g.tomes.filter((tm) => tm.stat !== 'hp')
  // A run saved before the field: what was on its one screen moves to the field's middle,
  // with no chests, tomes, gold or held items yet (its stat picks still count).
  if (!g.worldW) {
    g.worldW = HORDE_WORLD_WIDTH
    g.worldH = HORDE_WORLD_HEIGHT
    const dx = (g.worldW - g.width) / 2
    const dy = (g.worldH - HORDE_ARENA_HEIGHT) / 2
    g.px += dx
    g.py += dy
    g.aimX += dx
    g.aimY += dy
    for (const list of [g.foes, g.drops, g.rocks]) {
      for (const at of list) {
        at.x += dx
        at.y += dy
      }
    }
    g.tomes = []
    g.gold = 0
    g.chests = []
    g.chestsOpened = 0
    g.held = {}
    g.nextChestAt = g.clock + HORDE_CHEST_EVERY_MS
  }
  for (const foe of g.foes) foe.risingUntil ??= 0
  // A run saved before exploders.
  g.bombs ??= []
  g.leadBlastAt = -Infinity
  // A run saved before banishes: none to use.
  g.banishes ??= 0
  g.banished ??= []
  // A run saved before the Move Deleter could be used more than once.
  g.moveDeletes ??= g.moveDeleted ? 0 : 1
  // A run saved before moves had twists: nothing left about, and its moves (and the wild
  // Pokemon's) as the list has them now - one no longer in it counts as the list's first.
  g.zones ??= []
  g.orbs = []
  g.leadMods ??= []
  g.dash = null
  g.burrow = null
  g.safeUntil = 0
  g.fatigue ??= null
  g.exhaust ??= null
  g.leadBurn ??= null
  g.sashReadyAt ??= 0
  g.ejectReadyAt ??= 0
  g.metronome ??= 0
  g.bell ??= { second: 0, healed: 0, carry: 0 }
  g.rarityUps ??= 0
  g.chestsGot ??= g.chestsOpened ?? 0
  g.reaped ??= 0
  g.rushUntil ??= 0
  g.candyScreen ??= false
  g.walkMs ??= 0
  g.nextTideAt ??= 0
  g.nextGaleAt ??= 0
  g.darkHits ??= 0
  g.shakeUntil = 0
  // A run saved before shrines: none yet, the first of each turning up in a moment.
  g.shrines ??= []
  g.nextShrineAt ??= g.clock
  g.shrinesDone ??= 0
  g.shrineBanner ??= null
  for (const k of g.known) {
    k.move = hordeMoveOf(hordeMoveDef(k.move))
    k.crit ??= 0
  }
  for (const foe of g.foes) {
    foe.moves = foe.moves.map((m) => hordeMoveOf(hordeMoveDef(m)))
    foe.fx.drop ??= {}
  }
  followLead(g)
  return g
}

/** How a run is going, as reported to be paid for (or saved). */
function runResult(g: Game): HordeResult {
  return {
    survivedMs: Math.round(g.elapsed),
    kos: g.kos,
    level: g.level,
    won: g.cleared,
    bigNuggets: g.bigNuggets,
    species: g.form.species,
    megaEvolved: !!g.megaEvolved,
    moves: g.known.map((k) => ({ id: k.move.id, power: k.power, cut: k.cut, range: k.range, count: k.count, crit: k.crit, upgrades: k.upgrades })),
    damage: g.damage,
    tomes: g.tomes,
    held: g.held,
    chests: g.chestsOpened
  }
}

/** How much one of the lead's stats is raised (or, below 0, lowered) by moves right now, as a share. */
function leadMod(g: Game, stat: HordeLeadStat): number {
  const sum = g.leadMods.reduce((total, m) => total + (m.stat === stat && m.until > g.clock ? m.amount : 0), 0)
  return Math.max(HORDE_LEAD_MOD_MIN, Math.min(HORDE_LEAD_MOD_MAX, sum))
}

/** How much one of a foe's stats is lowered by moves right now, as a share. */
function foeDropOf(fx: FoeEffects, stat: HordeLeadStat, clock: number): number {
  const d = fx.drop?.[stat]
  return d && d.until > clock ? d.amount : 0
}

/** How much further this one move reaches than others of its shape (the reach twist), times. */
function ownReach(known: KnownMove): number {
  const tr = traitOf(known)
  return tr.kind === 'reach' ? 1 + tr.bonus / 100 : 1
}

/** How far a wave move rolls out, times the spread ring (the wideRing twist). */
function ownRing(known: KnownMove): number {
  const tr = traitOf(known)
  return tr.kind === 'wideRing' ? 1 + tr.bonus / 100 : 1
}

/** Where an orbit move's balls are right now, going round the lead. */
function orbSpots(g: Game, orb: Orb): { x: number; y: number }[] {
  const turn = (HORDE_ORBIT.turns * (g.clock - orb.born)) / 1000
  const radius = HORDE_ORBIT.radius * (1 + bonusOf(g, 'area') / 100)
  return Array.from({ length: orb.balls }, (_, i) => {
    const angle = (turn + i / orb.balls) * Math.PI * 2
    return { x: g.px + Math.cos(angle) * radius, y: g.py - BODY_HEIGHT + Math.sin(angle) * radius * 0.8 }
  })
}

/** The chance (percent) of a critical hit: with Crit chance tomes and items, and Ambush's bonus. */
function critChance(g: Game): number {
  return HORDE_CRIT_CHANCE + bonusOf(g, 'critChance') + (effectRank(g, 'Dark').bonus ? HORDE_EFFECT.ambushCritChance : 0)
}

/** How far spread moves reach, with Range tomes and items. */
function spreadRadius(g: Game): number {
  // Range widens it, and so do wave moves' reach upgrades.
  const waves = g.known.reduce((sum, k) => sum + (hordeMoveShape(k.move) === 'nova' ? k.range : 0), 0)
  return HORDE_SPREAD_RADIUS * (1 + (bonusOf(g, 'area') + waves) / 100)
}

/**
 * How far melee moves reach (between feet): one reach for them all, stretched by every melee
 * move's reach upgrades and by Range.
 */
function meleeRadius(g: Game): number {
  const melee = g.known.reduce((sum, k) => sum + (hordeMoveShape(k.move) === 'melee' ? k.range : 0), 0)
  return HORDE_SHAPES.meleeReach * (1 + (melee + bonusOf(g, 'area')) / 100)
}

/** How far off experience and items are picked up, with Pickup tomes and items. */
function pickupRange(g: Game): number {
  return HORDE_PICKUP_RANGE * (1 + bonusOf(g, 'pickup') / 100)
}

/** A known move's cooldown, with its own upgrades, Haste tomes and items, and the moves it knows (Solar Beam). */
function leadCooldown(g: Game, known: KnownMove): number {
  return hordeMoveCooldown(known.move, known.cut + bonusOf(g, 'haste'), knownMoves(g))
}

/** Whether a spot on the field is on screen (or just off it). */
function onScreen(g: Game, at: { x: number; y: number }): boolean {
  return at.x > g.camX - 10 && at.x < g.camX + g.width + 10 && at.y > g.camY - 10 && at.y < g.camY + HORDE_ARENA_HEIGHT + 10
}

/** Whether a foe is up out of the ground (and so can be hit, walk and attack). */
function risen(g: Game, foe: Foe): boolean {
  return foe.risingUntil <= g.clock
}

/** What the lead is right now: its Mega form while Mega Evolved, Minior's Core or Ditto's transformation, else its own. */
function leadForm(g: Game): HordeSpecies {
  return g.megaForm ?? g.altForm ?? g.form
}

/** The lead's moves, without their upgrades. */
function knownMoves(g: Game): HordeMove[] {
  return g.known.map((k) => k.move)
}

/** A type's effect with the moves the lead knows (none without a move of the type). */
function effectRank(g: Game, type: string): HordeTypeEffect {
  return hordeTypeEffect(knownMoves(g), type)
}

/** How many type effects are on a foe right now (for Hex). */
function effectCount(fx: FoeEffects, clock: number): number {
  return [
    !!fx.burn && fx.burn.until > clock,
    fx.poison.some((p) => p.until > clock),
    fx.stopUntil > clock || (!!fx.slow && fx.slow.until > clock),
    fx.frozenUntil > clock || (!!fx.chill && fx.chill.until > clock),
    !!fx.guard && fx.guard.until > clock,
    fx.vulnerableUntil > clock,
    fx.confusedUntil > clock,
    fx.spookedUntil > clock,
    !!fx.charm && fx.charm.until > clock
  ].filter(Boolean).length
}

/** The types whose effects are on a foe right now, for the dots under its HP bar. */
function effectTypesOn(fx: FoeEffects, clock: number): string[] {
  const on: string[] = []
  if (fx.vulnerableUntil > clock) on.push('Normal')
  if (fx.burn && fx.burn.until > clock) on.push('Fire')
  if (fx.stopUntil > clock || (fx.slow && fx.slow.until > clock)) on.push('Ground')
  if (fx.frozenUntil > clock || (fx.chill && fx.chill.until > clock)) on.push('Ice')
  if (fx.guard && fx.guard.until > clock) on.push('Fighting')
  if (fx.poison.some((p) => p.until > clock)) on.push('Poison')
  if (fx.confusedUntil > clock) on.push('Psychic')
  if (fx.spookedUntil > clock) on.push('Bug')
  if (fx.charm && fx.charm.until > clock) on.push('Fairy')
  return on
}

/** A badge under a level-up card's title (a move's shape or its type's effect), with what it means in a tooltip. */
function CardTag({ tag }: { tag: NonNullable<CardFace['tags']>[number] }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  return (
    <span
      className={`horde-choice-badge horde-card-tag${open ? ' horde-card-tag-open' : ''}`}
      style={tag.color ? ({ '--move-color': tag.color } as React.CSSProperties) : undefined}
      onClick={
        IS_MOBILE_LAYOUT
          ? (ev) => {
              ev.stopPropagation()
              setOpen((o) => !o)
            }
          : undefined
      }
      onMouseLeave={() => setOpen(false)}
    >
      {tag.label}
      {tag.pips !== undefined && (
        <span className="horde-effect-pips">
          {Array.from({ length: HORDE_EFFECT_MASTERY_MOVES }, (_, i) => (
            <span key={i} className={i < (tag.pips ?? 0) ? 'on' : ''} />
          ))}
        </span>
      )}
      <span className="horde-card-tip">
        {tag.tip.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </span>
    </span>
  )
}

interface Props {
  setup: HordeSetup
  // A saved run being carried on: its state of play and any choice that was on screen.
  resume?: Omit<HordeSave, 'setup'> | null
  // The saved run is being given up: it opens already ended, on its results.
  giveUp?: boolean
  // The run's over and paid for (null when paying failed, or it was saved) - back to the Horde page.
  onExit: (reward: HordeReward | null) => void
}

/**
 * A Horde run, played out over the whole window and seen from above: the player steers the
 * lead (WASD, the arrow keys, or holding the mouse or a finger on the ground) while wild
 * Pokemon pour in from the corners and chase it, every move going off on its own cooldown
 * (see shared/horde.ts). Each level-up stops the clock for a choice. Clicking a wild
 * Pokemon makes it the target for single-target moves.
 */
function HordeArena({ setup, resume, giveUp, onExit }: Props): React.JSX.Element {
  const t = useT()
  const fighter = setup.fighter
  // The moves a run can learn (and the wild Pokemon use) - the list as it is now for a run saved
  // before it changed. Worked out once, not on every frame.
  const [catalog] = useState(() => (setup.moves.every((m) => hordeFindMoveDef(m.id)) ? setup.moves : hordeMoveCatalog()))
  const [allTypes] = useState(() => [...new Set(catalog.map((m) => m.type))])
  // The moves of each type and strength, sorted out once rather than on every spawn.
  const [bandMoves] = useState(() => new Map<string, HordeMove[]>())
  const spriteStyle = useRef(loadSpriteStyle()).current
  // Every Pokemon the run can bring on, every move effect's picture and the hit sounds, fetched
  // and decoded up front - so one turning up for the first time doesn't hold the frame up while
  // it loads.
  const preloaded = useRef<HTMLImageElement[]>([])
  useEffect(() => {
    const species = [...setup.pools.flat(), ...setup.bossPool, ...(setup.exploders ?? []), ...Object.values(setup.evolved).flat()]
    const urls = new Set(species.map((sp) => spriteCandidates(spriteStyle, 'front', sp.spriteId, false)[0]))
    for (const sp of [...setup.gmaxPool, ...setup.bossPool.filter((b) => b.canGmax)]) {
      urls.add(gmaxSpriteCandidates(spriteStyle, 'front', sp.spriteId, false)[0])
    }
    for (const url of FX_FILES) urls.add(url)
    if (hitSoundsOn('horde')) preloadHitSounds()
    preloaded.current = [...urls].map((url) => {
      const img = new Image()
      img.src = url
      img.decode().catch(() => {})
      return img
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // The location's floor tile for this run (main and backup take turns), if it has any.
  const [groundTile] = useState(() => nextHordeGroundTile(setup.location))
  const [startGame] = useState(() => {
    const g = resume ? loadGame(resume.game) : newGame(setup)
    if (giveUp) g.outcome = 'quit'
    return g
  })
  const game = useRef<Game>(startGame)
  const [, setFrame] = useState(0)
  // A run carried on starts paused, so it doesn't start up before the player's ready.
  const [paused, setPaused] = useState(!!resume && !giveUp)
  // The card shown beside a hovered row of the pause menu's list, and where.
  const [logTip, setLogTip] = useState<{ card: CardFace; left: number; top: number } | null>(null)
  // On a phone: which of the pause menu's lists is open in a window of its own.
  const [pauseList, setPauseList] = useState<'log' | 'held' | null>(null)
  // The tooltip shown over a type effect or held item in the bar under the moves (hovered), and
  // the effect or item opened up in the pause menu's window (tapped).
  const [loadoutTip, setLoadoutTip] = useState<{ key: string; left: number; bottom?: number; top?: number } | null>(null)
  const [openTip, setOpenTip] = useState<string | null>(null)
  useEffect(() => {
    if (!paused) {
      setLogTip(null)
      setPauseList(null)
    }
  }, [paused])
  // The level-up choice on screen; the clock stops until one is taken.
  const [choices, setChoices] = useState<{
    list: HordeChoice[]
    evolution: boolean
  } | null>(giveUp ? null : ((resume?.choices as { list: HordeChoice[]; evolution: boolean } | null) ?? null))
  // The Move Deleter's list of known moves, while it's open.
  const [deleting, setDeleting] = useState(false)
  useEffect(() => setDeleting(false), [choices])
  // Saving the run to carry on later, and why it couldn't be.
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const stopped = useRef(false)
  // The stats window (on a phone, where the top bar has no room for them) stops the clock too.
  const [statsOpen, setStatsOpen] = useState(false)
  // A chest being opened: the items it gave, shown coming out of it - the clock stops meanwhile.
  const [chestItems, setChestItems] = useState<HordeHeldId[] | null>(null)
  stopped.current = paused || !!choices || statsOpen || !!chestItems
  // Damage numbers on or off (the pause menu's switch), kept per computer.
  const [damageNumbers, setDamageNumbers] = useState(() => loadBool('horde.damageNumbers', true))
  const showDamage = useRef(damageNumbers)
  showDamage.current = damageNumbers
  // Hit effects (the burst and the white flash on a foe as a move lands) on or off, the same way.
  const [hitEffects, setHitEffects] = useState(() => loadBool('horde.hitEffects', true))
  // Moves' own visuals (shots, arcs, waves, streams, strikes, cones and blasts) on or off, the same way.
  const [moveAnims, setMoveAnims] = useState(() => loadBool('horde.moveAnims', true))
  const [hitSounds, setHitSounds] = useState(() => hitSoundsOn('horde'))
  // Experience flying in once in pickup range on or off, the same way - off, it's taken the moment it's in range.
  const [expPull, setExpPull] = useState(() => loadBool('horde.expPull', true))
  // Range rings round the lead: all, main or off, kept per computer.
  const [rings, setRings] = useState(() => loadBool('horde.ringsOn', true))
  // When a pick last grew each ring (real time), so it lights up for a moment.
  const ringFlash = useRef<Record<RingKind, number>>({ spread: -Infinity, melee: -Infinity, pickup: -Infinity }).current
  const pullExp = useRef(expPull)
  pullExp.current = expPull
  const [reward, setReward] = useState<HordeReward | null | 'pending'>('pending')
  const [payError, setPayError] = useState<string | null>(null)
  const reported = useRef(false)
  // Steering: the direction keys held down, and where a held mouse button or finger is (in
  // arena units across the screen - the field under it changes as the camera moves).
  const keys = useRef(new Set<string>()).current
  const pointer = useRef<{ x: number; y: number } | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)

  // A pointer's spot on the screen, in arena units.
  function arenaPoint(e: React.PointerEvent): { x: number; y: number } | null {
    const rect = stageRef.current?.getBoundingClientRect()
    if (!rect || !rect.width || !rect.height) return null
    return {
      x: ((e.clientX - rect.left) / rect.width) * game.current.width,
      y: ((e.clientY - rect.top) / rect.height) * HORDE_ARENA_HEIGHT
    }
  }

  function addPopup(g: Game, x: number, y: number, text: string, kind: Popup['kind']): void {
    // With damage numbers switched off, hits, crits, burns and the lead's own hurt show nothing.
    if (!showDamage.current && DAMAGE_POPUPS.includes(kind)) return
    g.popups.push({ id: g.seq++, x, y, text, kind, born: g.now })
  }

  // A popup over the lead.
  function leadPopup(g: Game, text: string, kind: Popup['kind']): void {
    addPopup(g, g.px, g.py, text, kind)
  }

  // A spot just off screen near one of the screen's corners: along either of its two edges,
  // not far from it - moved onto the field if that's past its edge.
  function spawnPoint(g: Game, corner: number): { x: number; y: number } {
    const [cx, cy] = CORNERS[corner]
    const along = Math.random() * SPAWN_CORNER_SHARE
    const at =
      Math.random() < 0.5
        ? // On the top or bottom edge.
          {
            x: cx ? g.width * (1 - along) : g.width * along,
            y: cy ? HORDE_ARENA_HEIGHT + SPAWN_OUTSIDE : -SPAWN_OUTSIDE
          }
        : // On the left or right edge.
          {
            x: cx ? g.width + SPAWN_OUTSIDE : -SPAWN_OUTSIDE,
            y: cy ? HORDE_ARENA_HEIGHT * (1 - along) : HORDE_ARENA_HEIGHT * along
          }
    return clampToWorld(g, g.camX + at.x, g.camY + at.y, PLAYER_MARGIN)
  }

  // Where elites and bosses come from: off the screen's corner furthest from the lead
  // (toward the field's middle where the lead stands by an edge), giving it room.
  function farPoint(g: Game): { x: number; y: number } {
    const sx = g.px - g.camX
    const sy = g.py - g.camY
    return spawnPoint(g, (sx < g.width / 2 ? 1 : 0) + (sy < HORDE_ARENA_HEIGHT / 2 ? 2 : 0))
  }

  // Where a wild Pokemon rises out of the ground: a little way from the lead, that way (any
  // way if not given), kept on the field and never right on top of the lead.
  function risePoint(g: Game, angle = Math.random() * Math.PI * 2): { x: number; y: number } {
    let at = { x: g.px, y: g.py }
    for (let tries = 0; tries < 6; tries++) {
      const a = tries ? Math.random() * Math.PI * 2 : angle
      const d = (HORDE_RISE_NEAR + Math.random() * (HORDE_RISE_FAR - HORDE_RISE_NEAR)) * HORDE_ARENA_HEIGHT
      at = clampToWorld(g, g.px + Math.cos(a) * d, g.py + Math.sin(a) * d, PLAYER_MARGIN)
      if (dist(at.x, at.y, g.px, g.py) >= HORDE_RISE_NEAR * HORDE_ARENA_HEIGHT * 0.6) break
    }
    return at
  }

  // A wild Pokemon's moves, from the same list: a weak one of its type (a medium one
  // too after 4 minutes), an elite's weak and medium, a boss's medium and strong. Now and
  // then one is of another type than its own.
  function foeMoves(sp: HordeSpecies, kind: FoeKind, elapsed: number): HordeMove[] {
    const bands = kind === 'boss' ? (['medium', 'strong'] as const) : kind === 'elite' || elapsed >= 4 * 60000 ? (['weak', 'medium'] as const) : (['weak'] as const)
    return bands.map((band) => {
      const others = allTypes.filter((type) => !sp.types.includes(type))
      const type = others.length && Math.random() < HORDE_FOE_OFFTYPE_CHANCE ? pick(others) : pick(sp.types)
      const sortKey = `${type}|${band}`
      let fits = bandMoves.get(sortKey)
      if (!fits) {
        fits = catalog.filter((m) => m.type === type && hordeMoveBand(m) === band)
        bandMoves.set(sortKey, fits)
      }
      return fits.length ? pick(fits) : (catalog.find((m) => m.type === type) ?? catalog[0])
    })
  }

  // A wild Pokemon rising out of the ground at a spot (near the lead, any way, unless given).
  // A big boss has the final boss's HP. Given an exploder's species, it's that exploder; given
  // extra levels, it's that many levels higher (a Tapu Ruin's defenders).
  function spawnFoe(
    g: Game,
    kind: FoeKind,
    final = false,
    at = risePoint(g),
    big = final,
    swarm = false,
    exploder?: HordeSpecies,
    extraLevels = 0
  ): void {
    const wild = setup.pools[hordePoolIndex(g.elapsed, setup.pools.length)]
    let sp = exploder ?? pick(kind === 'boss' ? setup.bossPool : wild)
    // Now and then a boss comes Gigantamax; one that has a Gigantamax form always does.
    const rolledGmax = kind === 'boss' && setup.gmaxPool.length > 0 && Math.random() < HORDE_GMAX_CHANCE
    if (rolledGmax) sp = pick(setup.gmaxPool)
    const gmax = kind === 'boss' && (rolledGmax || !!sp.canGmax)
    // An elite is one of the wild Pokemon about, evolved - once in the first half of the run,
    // as far as it goes after that (or as it is, if it doesn't evolve).
    if (kind === 'elite') {
      const stages = setup.evolved[sp.species] ?? []
      if (stages.length) sp = g.elapsed >= HORDE_ELITE_FULL_EVOLVE_MS ? stages[stages.length - 1] : stages[0]
    }
    const lift = (kind === 'boss' ? 6 : kind === 'elite' ? 3 : 0) + extraLevels
    const level = Math.min(100, hordeFoeLevel(g.elapsed) + lift)
    const stats = hordeStats(sp.baseStats, level, 15)
    const hpMult =
      hordeFoeHpScale(g.elapsed) *
      (kind === 'boss' ? HORDE_BOSS_HP[big ? HORDE_BOSS_HP.length - 1 : 0] : kind === 'elite' ? HORDE_ELITE_HP : 1)
    // Exploders (a horde of them, or a wild Pokemon that rolls as one) are a bit tougher.
    const explodes = !!exploder || (kind === 'wild' && !!sp.explodes && Math.random() < HORDE_EXPLODER_WILD_CHANCE)
    const maxHp = Math.max(1, Math.round(stats.hp * hpMult * (gmax ? HORDE_GMAX_HP : 1) * (explodes ? HORDE_EXPLODER_HP : 1)))
    // Its Speed sets its pace; a boss lumbers in at half that, and wild ones and elites get quicker as the run goes on.
    const walk =
      hordeFoeWalk(stats.spe, level) *
      (kind === 'boss' ? 0.5 : hordeFoeWalkScale(g.elapsed)) *
      (gmax ? HORDE_GMAX_WALK : 1)
    const moves = foeMoves(sp, kind, g.elapsed)
    g.foes.push({
      id: g.seq++,
      sp,
      kind,
      final,
      gmax,
      swarm,
      level,
      stats,
      hp: maxHp,
      maxHp,
      x: at.x,
      y: at.y,
      walk,
      stopped: false,
      moves,
      // The first move straight away on arriving, a second one a little after.
      cooldowns: moves.map((m, i) => (i === 0 ? 0 : hordeMoveCooldown(m) * 0.5)),
      flashUntil: 0,
      bornAt: g.clock,
      risingUntil: g.clock + HORDE_RISE_MS,
      slide: null,
      faintedAt: null,
      fx: noEffects(),
      // One of an exploder horde always is; a wild Pokemon that can learn Explosion only sometimes,
      // and an elite or a boss never - they attack like any other.
      exploder: explodes ? true : undefined
    })
  }

  // A small horde of this third of the run's exploders (as many as there's room for), rising up together on one side of the lead.
  function spawnExploders(g: Game, room: number): void {
    const list = setup.exploders
    if (!list?.length) return
    const sp = list[hordePoolIndex(g.elapsed, list.length)]
    const [least, most] = HORDE_EXPLODER_COUNT
    const count = Math.min(room, least + Math.floor(Math.random() * (most - least + 1)))
    const side = Math.random() * Math.PI * 2
    for (let i = 0; i < count; i++) spawnFoe(g, 'wild', false, risePoint(g, side + (Math.random() - 0.5) * WAVE_SPREAD), false, false, sp)
  }

  // A standing exploder's fuse burning down: it faints as it blows up - no experience for that,
  // unless the lead set it off (then it counts as knocked out, blowing up there and then).
  function explode(g: Game, foe: Foe): void {
    if (foe.faintedAt !== null) return
    if (foe.byLead) {
      knockOut(g, foe, true)
      return
    }
    foe.faintedAt = g.now
    foe.fuseAt = undefined
    if (g.focusId === foe.id) g.focusId = null
    blowUp(g, blastFrom(foe), foe)
  }

  function blastFrom(foe: Foe): BlastSource {
    return { x: foe.x, y: foe.y, level: foe.level, attack: foe.stats.atk, byLead: !!foe.byLead }
  }

  // A blast: everything within reach is hit (the lead only if no blast has just hit it), and
  // exploders caught in it - standing or knocked out - go off a moment later, counted as the lead's if this one was.
  function blowUp(g: Game, src: BlastSource, self?: Foe): void {
    g.flashes.push({ id: g.seq++, kind: 'boom', x: src.x, y: src.y, dx: 0, dy: 0, type: 'Fire', born: g.now, reach: HORDE_EXPLODER_REACH })
    const blast = (defense: number): number =>
      hordeDamage({
        level: src.level,
        power: HORDE_EXPLODER_POWER,
        attack: src.attack,
        defense,
        stab: false,
        effectiveness: 1,
        spread: false,
        crit: false
      })
    if (
      !g.outcome &&
      g.clock - g.leadBlastAt >= HORDE_EXPLODER_LEAD_GRACE_MS &&
      dist(src.x, src.y, g.px, g.py) <= HORDE_EXPLODER_REACH + HORDE_LEAD_HITBOX
    ) {
      g.leadBlastAt = g.clock
      hurtPlayer(g, Math.max(1, Math.round(blast(g.stats.def) * hordeFoeAttackScale(g.elapsed))))
    }
    const chainAt = g.clock + HORDE_EXPLODER_CHAIN_MS
    for (const other of standingFoes(g)) {
      if (other === self || dist(other.x, other.y, src.x, src.y) > HORDE_EXPLODER_REACH + HORDE_FOE_HITBOX[other.kind]) continue
      if (other.exploder) {
        other.fuseAt = other.fuseAt === undefined ? chainAt : Math.min(other.fuseAt, chainAt)
        if (src.byLead) other.byLead = true
      } else damageFoe(g, other, blast(other.stats.def) * hordeFoeHpScale(g.elapsed), 'hit', false)
    }
    for (const bomb of g.bombs) {
      if (dist(bomb.x, bomb.y, src.x, src.y) > HORDE_EXPLODER_REACH + HORDE_FOE_HITBOX[bomb.kind]) continue
      bomb.fuseAt = Math.min(bomb.fuseAt, chainAt)
      if (src.byLead) bomb.byLead = true
    }
  }

  // Stats worked out again (a level, an evolution or a stat pick), keeping the HP it's lost.
  function refreshStats(g: Game, heal: number): void {
    const lost = g.maxHp - g.hp
    g.stats = leadStats(leadForm(g), g.level, statPercents(g))
    // Max Mushrooms add to its max HP on top.
    g.stats.hp = Math.round(g.stats.hp * g.hpMult)
    // Minior's Core is quicker still.
    if (setup.coreForm && g.altForm === setup.coreForm) g.stats.spe = Math.round(g.stats.spe * (1 + HORDE_MINIOR_CORE_SPEED))
    g.maxHp = g.stats.hp
    g.hp = Math.max(1, Math.min(g.maxHp, g.maxHp - lost + Math.round(g.maxHp * heal)))
  }

  function levelUp(g: Game): void {
    g.levelsGained++
    g.level = Math.min(100, g.level + 1)
    const next = setup.evolutions[g.evolved]
    const evolves = !!next && g.level >= next.level
    if (evolves) {
      leadPopup(g, t('horde.evolved', { name: next.into.species }), 'level')
      g.form = next.into
      g.evolved++
    } else {
      leadPopup(g, t('horde.levelUp', { level: g.level }), 'level')
    }
    refreshStats(g, HORDE_LEVEL_HEAL + (evolves ? HORDE_EVOLVE_HEAL : 0))
    g.pendingChoices.push(evolves)
  }

  // What a level-up choice was, in words, for the pause menu's list.
  function describeChoice(g: Game, choice: HordeChoice): TakenChoice {
    const level = g.level - g.pendingChoices.length + 1
    const entry = { level, rarity: choice.rarity }
    if (choice.kind === 'learn') return { ...entry, kind: t('horde.choice.learn'), title: moveName(choice.move.name) }
    if (choice.kind === 'upgrade')
      return { ...entry, kind: t('horde.choice.upgrade'), title: moveName(g.known[choice.slot]?.move.name ?? '') }
    if (choice.kind === 'multi') return { ...entry, kind: t('horde.choice.multi'), title: t('horde.multi'), detail: `+${HORDE_MULTI_TARGETS}` }
    if (choice.kind === 'gold') return { ...entry, kind: t('horde.choice.gold'), title: t('horde.gold'), detail: `+${HORDE_GOLD_CARD[choice.rarity]}` }
    const rank = (g.tomes.find((tm) => tm.stat === choice.stat)?.ranks ?? 0) + 1
    const curse = hordeCurseGain(choice.rarity, rank - 1)
    const detail =
      choice.stat === 'luck'
        ? `+${HORDE_LUCK_POINTS[choice.rarity]}`
        : choice.stat === 'curse'
          ? `+${curse.up}% / -${curse.down}%`
          : `+${isBonusStat(choice.stat) ? hordeBonusPercent(choice.stat, choice.rarity, rank - 1) : hordeBaseStatPercent(choice.stat, choice.rarity, rank - 1)}%`
    return { ...entry, kind: choice.isNew ? t('horde.choice.tome') : t('horde.choice.tomeUp', { rank }), title: t(ABILITY_KEYS[choice.stat]), detail }
  }

  function applyChoice(choice: HordeChoice, card: CardFace): void {
    const g = game.current
    g.log.push({ ...describeChoice(g, choice), card })
    const up = HORDE_MOVE_UPGRADE[choice.rarity]
    if (choice.kind === 'learn') {
      // A new move starts with its card's upgrade already in - none for a common one.
      const b = choice.boosts
      g.known.push({
        move: choice.move,
        power: b.includes('power') ? hordeUpgradePower(choice.move, choice.rarity) : 0,
        cut: b.includes('cooldown') ? up.cooldown : 0,
        range: b.includes('range') ? hordeRangeUpgrade(choice.move, choice.rarity) : 0,
        count: b.includes('count') ? hordeCountUpgrade(choice.move, choice.rarity) : 0,
        crit: b.includes('crit') ? hordeCritUpgrade(choice.rarity) : 0,
        upgrades: b.length ? 1 : 0
      })
      g.cooldowns.push(300)
    } else if (choice.kind === 'upgrade') {
      // Only what the card raises.
      const k = g.known[choice.slot]
      if (k) {
        // Each softened by the upgrades the move already has.
        if (choice.boosts.includes('power')) k.power += hordeUpgradePower(k.move, choice.rarity, k.upgrades)
        if (choice.boosts.includes('cooldown')) k.cut += hordeCooldownUpgrade(choice.rarity, k.upgrades)
        if (choice.boosts.includes('range')) k.range += hordeRangeUpgrade(k.move, choice.rarity, k.upgrades)
        if (choice.boosts.includes('count')) k.count += hordeCountUpgrade(k.move, choice.rarity)
        if (choice.boosts.includes('crit')) k.crit += hordeCritUpgrade(choice.rarity, k.upgrades)
        k.upgrades++
      }
    } else if (choice.kind === 'multi') {
      g.multi++
    } else if (choice.kind === 'gold') {
      g.gold += HORDE_GOLD_CARD[choice.rarity]
    } else {
      // An ability: a new one takes a slot, one held goes up a rank - then it adds its stat.
      const stat = choice.stat
      const tome = g.tomes.find((tm) => tm.stat === stat)
      const ranksHeld = tome?.ranks ?? 0
      if (tome) tome.ranks++
      else g.tomes.push({ stat, ranks: 1 })
      if (stat === 'luck') g.luck += HORDE_LUCK_POINTS[choice.rarity]
      else if (isBonusStat(stat)) g.bonus[stat] += hordeBonusPercent(stat, choice.rarity, ranksHeld)
      else if (stat === 'curse') {
        // Curse: sturdier (HP and Defense) but slower.
        const { up, down } = hordeCurseGain(choice.rarity, ranksHeld)
        g.statBonus.hp += up
        g.statBonus.def += up
        g.statBonus.spe -= down
        refreshStats(g, 0)
      }
      else {
        g.statBonus[stat] += hordeBaseStatPercent(stat, choice.rarity, ranksHeld)
        refreshStats(g, 0)
      }
    }
    // A pick that grows a ring lights it up for a moment: wave moves' reach the spread ring,
    // melee moves' reach (or a first melee move) the melee ring, Pickup the pickup ring - and
    // Range both the spread and the melee ring.
    const grown = (move: HordeMove): RingKind | null =>
      hordeMoveShape(move) === 'nova' ? 'spread' : hordeMoveShape(move) === 'melee' ? 'melee' : null
    let ring: RingKind | null = null
    if (choice.kind === 'learn')
      ring = choice.boosts.includes('range') || hordeMoveShape(choice.move) === 'melee' ? grown(choice.move) : null
    else if (choice.kind === 'upgrade' && choice.boosts.includes('range')) ring = g.known[choice.slot] ? grown(g.known[choice.slot].move) : null
    else if (choice.kind === 'stat' && choice.stat === 'pickup') ring = 'pickup'
    if (ring) ringFlash[ring] = performance.now()
    if (choice.kind === 'stat' && choice.stat === 'area') for (const r of ['spread', 'melee'] as RingKind[]) ringFlash[r] = performance.now()
    g.pendingChoices.shift()
    setChoices(null)
  }

  // The types the lead will gain from its evolutions still to come and any Mega form it can
  // reach - new moves of those turn up more often (none for Ditto, whose moves follow the area).
  function futureTypes(g: Game): string[] {
    if (setup.moveTypes) return []
    const ahead = setup.evolutions.slice(g.evolved).map((e) => e.into)
    const forms = [g.form, ...ahead]
    const megas = forms.map((f) => setup.megas[f.species]).filter((m): m is HordeSpecies => !!m)
    return [...new Set([...ahead, ...megas].flatMap((f) => f.types))]
  }

  // A level-up's choices, rolled with the lead's Luck and moves.
  function rollChoices(g: Game, evolution: boolean): HordeChoice[] {
    const list = dealChoices(g, evolution)
    // A Rare Candy's level-up: every card one rarity higher, rerolls too.
    if (!g.candyScreen) return list
    const known = knownMoves(g)
    return list.map((c) => hordeRaiseRarity(c, known))
  }

  function dealChoices(g: Game, evolution: boolean): HordeChoice[] {
    return hordeLevelChoices(
      g.known.map((k) => k.move),
      catalog,
      setup.moveTypes ?? g.form.types,
      luckOf(g),
      evolution,
      g.multi,
      undefined,
      futureTypes(g),
      g.tomes.map((tm) => tm.stat),
      g.banished,
      setup.learnTypes
    )
  }

  // Opening the chest the lead stands by, if there's gold enough: its items are the lead's for
  // good straight away, then shown coming out of it while the clock waits.
  function openChest(): void {
    const g = game.current
    if (stopped.current || g.outcome) return
    const chest = g.chests.find((c) => dist(c.x, c.y, g.px, g.py) <= HORDE_CHEST_REACH)
    if (!chest) return
    const cost = hordeChestCost(g.chestsOpened)
    if (g.gold < cost) {
      leadPopup(g, t('horde.needGold', { gold: Math.ceil(cost - g.gold) }), 'miss')
      return
    }
    // Card Keys: now and then it opens for free - no gold, and no dearer chests after.
    if (Math.random() < stackedChance(g, 'cardKey')) leadPopup(g, t('horde.freeChest'), 'item')
    else {
      g.gold -= cost
      g.chestsOpened++
    }
    g.chests = g.chests.filter((c) => c !== chest)
    giveChest(g)
  }

  // A chest's items held, and the chest shown opening (after any still opening).
  function giveChest(g: Game): void {
    g.chestsGot++
    const items = hordeRollChest(luckOf(g), g.held)
    for (const id of items) g.held[id] = (g.held[id] ?? 0) + 1
    refreshStats(g, 0)
    stopped.current = true
    setChestItems((open) => [...(open ?? []), ...items])
  }

  // The Totem Trial the lead stands by that hasn't started yet, if any.
  function shrineInReach(g: Game): Shrine | null {
    return g.shrines.find((s) => s.kind === 'totem' && !s.started && dist(s.x, s.y, g.px, g.py) <= HORDE_SHRINE_REACH) ?? null
  }

  // E (or a tap): starting the Totem Trial the lead stands by, else opening the chest it stands by.
  function interact(): void {
    const g = game.current
    if (stopped.current || g.outcome) return
    const shrine = shrineInReach(g)
    if (shrine) startTotem(g, shrine)
    else openChest()
  }

  // A Totem Trial starting: its totem (a tougher elite) rises by the shrine, and a ring of wild
  // Pokemon round it - the trial is done once every one of them is down.
  function startTotem(g: Game, shrine: Shrine): void {
    shrine.started = true
    const [least, most] = HORDE_TOTEM_FOES
    const count = least + Math.floor(Math.random() * (most - least + 1))
    // Each rises slowly, so the lead can get out of the ring before it closes.
    const called = (): Foe => {
      const foe = g.foes[g.foes.length - 1]
      foe.shrine = shrine.id
      foe.riseMs = HORDE_RISE_MS * HORDE_TOTEM_RISE
      foe.risingUntil = g.clock + foe.riseMs
      return foe
    }
    spawnFoe(g, 'elite', false, clampToWorld(g, shrine.x, shrine.y - 40, PLAYER_MARGIN))
    const totem = called()
    totem.totem = true
    totem.maxHp = totem.hp = Math.round(totem.maxHp * HORDE_TOTEM_HP)
    const turn = Math.random() * Math.PI * 2
    for (let i = 0; i < count; i++) {
      const angle = turn + (i / count) * Math.PI * 2
      spawnFoe(g, 'wild', false, clampToWorld(g, shrine.x + Math.cos(angle) * HORDE_TOTEM_RING, shrine.y + Math.sin(angle) * HORDE_TOTEM_RING, PLAYER_MARGIN))
      called()
    }
    addPopup(g, shrine.x, shrine.y - 60, t('horde.shrine.totemStart'), 'level')
  }

  // A Tapu Ruin stepped into for the first time: high-level elites rise round it to defend it.
  function wakeTapu(g: Game, shrine: Shrine): void {
    shrine.started = true
    const turn = Math.random() * Math.PI * 2
    for (let i = 0; i < HORDE_TAPU_DEFENDERS; i++) {
      const angle = turn + (i / HORDE_TAPU_DEFENDERS) * Math.PI * 2
      const at = clampToWorld(g, shrine.x + Math.cos(angle) * HORDE_TAPU_RADIUS, shrine.y + Math.sin(angle) * HORDE_TAPU_RADIUS, PLAYER_MARGIN)
      spawnFoe(g, 'elite', false, at, false, false, undefined, HORDE_TAPU_DEFENDER_LEVELS)
    }
    addPopup(g, shrine.x, shrine.y - 60, t('horde.shrine.tapuWake'), 'level')
  }

  // The gold a shrine done adds: a set amount plus a share of what a chest costs now.
  // Chests opened in endless mode count only a quarter here, so a shrine's gold doesn't race up with their prices.
  function shrineGold(g: Game): number {
    const before = g.endless ? Math.min(g.chestsOpened, g.endlessChests ?? g.chestsOpened) : g.chestsOpened
    const counted = before + (g.chestsOpened - before) / 4
    return Math.round(HORDE_SHRINE_GOLD + hordeChestCost(counted) * HORDE_SHRINE_GOLD_CHESTS)
  }

  // A Totem Trial done: experience worth the lead's next few levels scattered about the shrine, and gold straight away.
  function finishTotem(g: Game, shrine: Shrine): void {
    let exp = 0
    for (let i = 0; i < HORDE_TOTEM_LEVELS; i++) exp += hordeExpToNext(g.levelsGained + i)
    const piles = HORDE_TOTEM_PILES
    for (let i = 0; i < piles; i++) {
      const angle = (i / piles) * Math.PI * 2
      const at = clampToWorld(g, shrine.x + Math.cos(angle) * 110, shrine.y + Math.sin(angle) * 110, 20)
      g.drops.push({ id: g.seq++, ...at, exp: exp / piles, item: null, mega: false, born: g.clock, pulled: false, shrine: true })
    }
    const gold = shrineGold(g)
    g.gold += gold
    g.shrineBanner = {
      kind: 'totem',
      title: t('horde.shrine.totemDone'),
      lines: [t('horde.shrine.rewardExp', { levels: HORDE_TOTEM_LEVELS }), t('horde.shrine.rewardGold', { gold })],
      until: g.clock + SHRINE_BANNER_MS
    }
    endShrine(g, shrine)
  }

  // A Tapu Ruin filled: one stat at random raised for good, and some gold.
  function finishTapu(g: Game, shrine: Shrine): void {
    const stat = pick(HORDE_TAPU_STATS)
    let amount: number
    if (stat === 'luck') {
      amount = Math.round(HORDE_LUCK_POINTS.legendary * HORDE_TAPU_BOOST)
      g.luck += amount
    } else if (isBonusStat(stat)) {
      amount = Math.round(hordeBonusPercent(stat, 'legendary') * HORDE_TAPU_BOOST * 10) / 10
      g.bonus[stat] += amount
    } else {
      amount = Math.round(hordeBaseStatPercent(stat, 'legendary') * HORDE_TAPU_BOOST * 10) / 10
      g.statBonus[stat] += amount
      refreshStats(g, 0)
    }
    const gold = shrineGold(g)
    g.gold += gold
    const statName = t(STAT_KEYS[stat])
    const shown = stat === 'luck' ? `+${amount}` : `+${amount}%`
    g.shrineBanner = {
      kind: 'tapu',
      title: t('horde.shrine.tapuDone'),
      lines: [t('horde.shrine.rewardStat', { stat: statName, amount: shown }), t('horde.shrine.rewardGold', { gold })],
      until: g.clock + SHRINE_BANNER_MS
    }
    // In the pause menu's list of upgrades taken, beside the level-up picks.
    g.log.push({ level: g.level, rarity: 'legendary', kind: t('horde.shrine.tapu'), title: statName, detail: shown, shrine: true })
    endShrine(g, shrine)
  }

  function endShrine(g: Game, shrine: Shrine): void {
    g.shrines = g.shrines.filter((s) => s !== shrine)
    g.shrinesDone++
  }

  // Skipping a level-up: nothing is taken, the run goes on.
  function skipChoice(): void {
    game.current.pendingChoices.shift()
    setChoices(null)
  }

  // Rolling a level-up's choices again, while rerolls are left.
  function rerollChoices(): void {
    const g = game.current
    if (!choices || g.rerolls <= 0) return
    g.rerolls--
    setChoices({ list: rollChoices(g, choices.evolution), evolution: choices.evolution })
  }

  // Raising every card shown one rarity, for gold (dearer each time this run), while any can go higher.
  function raiseRarity(): void {
    const g = game.current
    if (!choices || choices.list.every((c) => c.rarity === 'legendary')) return
    const cost = hordeRarityUpCost(g.rarityUps)
    if (g.gold < cost) return
    g.gold -= cost
    g.rarityUps++
    const known = knownMoves(g)
    setChoices({ list: choices.list.map((c) => hordeRaiseRarity(c, known)), evolution: choices.evolution })
  }

  // The Move Deleter, once a run (twice with Shapeshifter): the lead forgets a move (never its last), freeing the slot,
  // and the level-up's choices are rolled again for the moves it has now - no reroll spent.
  function deleteMove(slot: number): void {
    const g = game.current
    setDeleting(false)
    if (!choices || g.moveDeletes <= 0 || g.known.length <= 1 || !g.known[slot]) return
    g.moveDeletes--
    g.known.splice(slot, 1)
    g.cooldowns.splice(slot, 1)
    setChoices({ list: rollChoices(g, choices.evolution), evolution: choices.evolution })
  }

  // Banishing a level-up card, while banishes are left: what it offered never turns up again
  // this run, and a fresh card (not one already showing) takes its place - if there's one left.
  function banishChoice(choice: HordeChoice): void {
    const g = game.current
    const known = g.known.map((k) => k.move)
    if (!choices || !hordeCanBanish(choice) || g.banishes <= 0) return
    g.banishes--
    g.banished.push(hordeChoiceKey(choice, known))
    const rest = choices.list.filter((c) => c !== choice)
    const showing = new Set(rest.map((c) => hordeChoiceKey(c, known)))
    const fresh = rollChoices(g, choices.evolution).find((c) => !showing.has(hordeChoiceKey(c, known)))
    const list = choices.list.flatMap((c) => (c !== choice ? [c] : fresh ? [fresh] : []))
    setChoices({ list: list.length ? list : rollChoices(g, choices.evolution), evolution: choices.evolution })
  }

  // A type effect's popup, in its type's colour.
  function effectPopup(g: Game, x: number, y: number, type: string): void {
    g.popups.push({
      id: g.seq++,
      x,
      y,
      text: t(`horde.effect.${type}` as MessageKey),
      kind: 'effect',
      born: g.now,
      color: typeColor(type)
    })
  }

  // The foes up and about - not fainted, and not still rising out of the ground.
  function standingFoes(g: Game): Foe[] {
    return g.foes.filter((f) => f.faintedAt === null && risen(g, f))
  }

  // The standing foes nearest to one, closest first.
  function nearestTo(g: Game, foe: Foe, count: number, reach = Infinity): Foe[] {
    const gap = (f: Foe): number => dist(f.x, f.y, foe.x, foe.y)
    return standingFoes(g)
      .filter((f) => f !== foe && gap(f) <= reach)
      .sort((a, b) => gap(a) - gap(b))
      .slice(0, count)
  }

  // Wild Pokemon never leave the field.
  function keepNear(g: Game, foe: Foe): void {
    const at = clampToWorld(g, foe.x, foe.y, 0)
    foe.x = at.x
    foe.y = at.y
  }

  // Which way is away from the lead, from a spot (any way at all if it's right on the lead).
  function awayFromLead(g: Game, x: number, y: number): { dx: number; dy: number } {
    const d = dist(x, y, g.px, g.py)
    if (d < 1) {
      const angle = Math.random() * Math.PI * 2
      return { dx: Math.cos(angle), dy: Math.sin(angle) }
    }
    return { dx: (x - g.px) / d, dy: (y - g.py) / d }
  }

  // An effect's damage straight onto a foe: no roll, no type matchup.
  function damageFoe(g: Game, foe: Foe, dmg: number, kind: Popup['kind'] = 'dot', byLead = true, key = EFFECTS_KEY): void {
    if (foe.faintedAt !== null) return
    const amount = Math.max(1, Math.round(dmg))
    foe.lastHit = amount
    if (byLead) g.damage[key] = (g.damage[key] ?? 0) + Math.min(foe.hp, amount)
    foe.hp -= Math.min(foe.hp, amount)
    foe.flashUntil = g.now + 120
    addPopup(g, foe.x, foe.y, String(amount), kind)
    if (foe.hp <= 0) knockOut(g, foe)
  }

  // Stopped where it stands for a while - half as long for an elite (bosses are never held).
  function hold(g: Game, foe: Foe, ms: number): void {
    const share = foe.kind === 'elite' ? HORDE_ELITE_HOLD_SHARE : 1
    foe.fx.stopUntil = Math.max(foe.fx.stopUntil, g.clock + ms * share)
  }

  function burn(g: Game, foe: Foe, dps: number): void {
    const active = foe.fx.burn && foe.fx.burn.until > g.clock ? foe.fx.burn.dps : 0
    foe.fx.burn = {
      dps: Math.max(active, dps),
      until: g.clock + HORDE_EFFECT.burnMs
    }
  }

  // Pushed away from the lead; with Wash Away's bonus it takes the foes in its path along too.
  function push(g: Game, foe: Foe, distance: number, drag: boolean): void {
    const { dx, dy } = awayFromLead(g, foe.x, foe.y)
    const fromX = foe.x
    const fromY = foe.y
    foe.slide = { dx, dy, left: distance }
    foe.stopped = false
    if (!drag) return
    for (const other of standingFoes(g)) {
      if (other === foe || other.kind === 'boss') continue
      // How far along the push's path it stands, and how far to the side of it.
      const along = (other.x - fromX) * dx + (other.y - fromY) * dy
      const side = Math.abs((other.x - fromX) * dy - (other.y - fromY) * dx)
      if (along > 0 && along < distance && side <= DRAG_WIDTH) {
        other.slide = { dx, dy, left: distance / 2 }
        other.stopped = false
      }
    }
  }

  // A shield on the lead, never past this share of its max HP.
  function addShield(g: Game, amount: number, capShare: number): void {
    g.shield = Math.max(g.shield, Math.min(g.shield + Math.round(amount), Math.round(g.maxHp * capShare)))
  }

  // How much a foe's slows hold it back (1 is its full pace), for walking and attacking alike.
  function foePace(g: Game, foe: Foe): number {
    const fx = foe.fx
    let pace = 1
    if (fx.slow && fx.slow.until > g.clock) pace *= 1 - fx.slow.amount
    if (fx.chill && fx.chill.until > g.clock) pace *= 1 - Math.min(HORDE_EFFECT.chillMaxSlow, fx.chill.stacks * fx.chill.per)
    // A Speed drop, and the slowest ground it stands on.
    pace *= 1 - foeDropOf(fx, 'spe', g.clock)
    let zoneSlow = 0
    for (const z of g.zones) if (z.slow > zoneSlow && dist(z.x, z.y, foe.x, foe.y) <= z.reach + HORDE_FOE_HITBOX[foe.kind]) zoneSlow = z.slow
    return pace * (1 - zoneSlow)
  }

  // Experience on the ground where a foe fell - into a pile already lying close by if there
  // is one, so a crowd's KOs don't litter the arena.
  function dropExp(g: Game, x: number, y: number, exp: number, mega = false): void {
    const pile = g.drops.find((d) => !d.item && d.mega === mega && !d.shrine && !d.pulled && dist(d.x, d.y, x, y) <= EXP_MERGE_REACH)
    if (pile) pile.exp += exp
    else g.drops.push({ id: g.seq++, x, y, exp, item: null, mega, born: g.clock, pulled: false })
  }

  // An item on the ground by where a foe fell.
  function dropItem(g: Game, x: number, y: number, item: HordeItemId): void {
    const angle = Math.random() * Math.PI * 2
    g.drops.push({ id: g.seq++, x: x + Math.cos(angle) * 24, y: y + Math.sin(angle) * 24, exp: 0, item, mega: false, born: g.clock, pulled: false })
  }

  // Gems lying close together merge into one where there's enough of them for the next size
  // up - wild KOs' into an elite's, elites' into a boss's - and a boss-sized one gathers in
  // whatever lies around it. Mega Energy only merges with Mega Energy.
  function gatherExp(g: Game): void {
    const loose = g.drops.filter((d) => !d.item && !d.pulled)
    const gone = new Set<Drop>()
    for (const drop of loose) {
      if (gone.has(drop)) continue
      const near = loose.filter(
        (o) => o !== drop && !gone.has(o) && o.mega === drop.mega && dist(o.x, o.y, drop.x, drop.y) <= EXP_GATHER_REACH
      )
      if (!near.length) continue
      const total = near.reduce((sum, o) => sum + o.exp, drop.exp)
      const nextSize = drop.exp < HORDE_KO_EXP.elite ? HORDE_KO_EXP.elite : drop.exp < HORDE_KO_EXP.boss ? HORDE_KO_EXP.boss : 0
      if (total < nextSize) continue
      // The new gem lies at the middle of the old ones, weighted by how much each held.
      drop.x = near.reduce((sum, o) => sum + o.x * o.exp, drop.x * drop.exp) / total
      drop.y = near.reduce((sum, o) => sum + o.y * o.exp, drop.y * drop.exp) / total
      drop.exp = total
      for (const o of near) gone.add(o)
    }
    if (gone.size) g.drops = g.drops.filter((d) => !gone.has(d))
  }

  // Whether the lead's form has a Mega form it can use (Mega Evolved now or not) - Mega Energy
  // drops while it does. One that never evolves only once it's reached HORDE_MEGA_LEVEL.
  function hasMega(g: Game): boolean {
    if (!setup.evolutions.length && g.level < HORDE_MEGA_LEVEL) return false
    return !!setup.megas[g.form.species]
  }

  // Mega Energy picked up: it fills the Mega bar, which Mega Evolves the lead the moment it's
  // full - or, while Mega Evolved, adds to the time left (never past a full bar's worth).
  function gainMegaEnergy(g: Game, energy: number): void {
    if (g.megaForm) {
      const left = g.megaUntil - g.clock + (energy / HORDE_MEGA_CHARGE) * HORDE_MEGA_MS
      g.megaUntil = g.clock + Math.min(HORDE_MEGA_MS, left)
      return
    }
    g.megaCharge = Math.min(HORDE_MEGA_CHARGE, g.megaCharge + energy)
    if (g.megaCharge >= HORDE_MEGA_CHARGE && hasMega(g)) megaEvolve(g)
  }

  // A full Mega bar Mega Evolves the lead for a while.
  function megaEvolve(g: Game): void {
    g.megaForm = setup.megas[g.form.species]
    g.megaUntil = g.clock + HORDE_MEGA_MS
    g.megaCharge = 0
    g.megaEvolved = true
    refreshStats(g, 0)
    leadPopup(g, t('horde.megaEvolved', { name: g.megaForm.species }), 'level')
  }

  // Experience, with the Horde page's Exp upgrade, Experience tomes, Lucky Eggs and Exp. Shares on top - and the gold that
  // comes with it (by the experience before those, with Amulet Coins on top - and Good as Gold, but not on a shrine's).
  function gainExp(g: Game, exp: number, shrine = false): void {
    g.gold += exp * HORDE_GOLD_PER_EXP * (1 + (heldOf(g, 'gold') + (shrine ? 0 : bonusOf(g, 'goldGain'))) / 100)
    g.exp += exp * (1 + (hordeUpgradeTotal('exp', setup.upgrades.exp) + bonusOf(g, 'exp')) / 100)
    while (g.exp >= hordeExpToNext(g.levelsGained)) {
      g.exp -= hordeExpToNext(g.levelsGained)
      levelUp(g)
    }
  }

  // What an item does as it's picked up (see HORDE_ITEMS).
  function useItem(g: Game, item: HordeItemId): void {
    switch (item) {
      case 'magnet':
        for (const d of g.drops) if (!d.item) d.pulled = true
        break
      case 'choiceScarf':
        g.scarfUntil = g.clock + HORDE_ITEM_BUFF_MS
        break
      case 'boosterEnergy':
        g.boosterUntil = g.clock + HORDE_ITEM_BUFF_MS
        break
      case 'flameOrb':
        g.flameUntil = g.clock + HORDE_ITEM_BUFF_MS
        break
      case 'icyRock':
        // Every wild Pokemon on screen frozen solid - an elite for half as long, a boss a quarter.
        for (const foe of standingFoes(g)) {
          if (onScreen(g, foe)) foe.fx.frozenUntil = Math.max(foe.fx.frozenUntil, g.clock + HORDE_ICY_ROCK_MS * HORDE_FREEZE_SHARE[foe.kind])
        }
        break
      case 'fullRestore':
        g.hp = g.maxHp
        break
      case 'bigNugget':
        g.bigNuggets++
        break
      case 'chest':
        // Opened for free, with no effect on what the field's chests cost.
        giveChest(g)
        break
      case 'maxMushroom':
        // Its max HP grows for good, the HP it gains with it.
        g.hpMult *= 1 + HORDE_MAX_MUSHROOM_HP / 100
        refreshStats(g, 0)
        break
    }
    leadPopup(g, t(`horde.item.${item}` as MessageKey), 'item')
  }

  // Knocked out - by the lead, or by a blast (viaBlast: an exploder then blows up there and then).
  function knockOut(g: Game, foe: Foe, viaBlast = false): void {
    foe.faintedAt = g.now
    g.kos++
    // Spell Tags: more Attack with every so many KOs.
    if (g.kos % HORDE_SPELL_TAG_KOS === 0 && heldOf(g, 'koAttack') > 0) refreshStats(g, 0)
    // Charcoal: now and then it explodes, hitting those right by it for a share of the hit that finished it.
    const finisher = foe.lastHit ?? 0
    if (finisher > 0 && Math.random() * 100 < heldOf(g, 'koBlast')) {
      g.flashes.push({ id: g.seq++, kind: 'blast', x: foe.x, y: foe.y, dx: 0, dy: 0, type: 'Fire', born: g.now, reach: HORDE_CHARCOAL_REACH })
      for (const other of nearestTo(g, foe, Infinity, HORDE_CHARCOAL_REACH + HORDE_FOE_HITBOX[foe.kind])) damageFoe(g, other, finisher * HORDE_CHARCOAL_SHARE, 'hit')
    }
    if (g.focusId === foe.id) g.focusId = null
    // Beating the final boss starts endless mode.
    if (foe.final && !g.endless) {
      g.cleared = true
      g.endless = true
      g.endlessAt = g.clock
      g.endlessChests = g.chestsOpened
      g.nextEndlessBossAt = g.elapsed + HORDE_ENDLESS_BOSS_EVERY_MS
      leadPopup(g, t('horde.clearedPopup'), 'level')
    }
    // Its experience drops where it fell (on the arena), to be picked up - and now and then an item.
    const fellX = Math.max(20, Math.min(g.worldW - 20, foe.x))
    const fellY = Math.max(20, Math.min(g.worldH - 20, foe.y))
    dropExp(g, fellX, fellY, HORDE_KO_EXP[foe.kind])
    // While the lead could Mega Evolve, Mega Energy too. An elite that came with a wave drops these as a wild one does.
    const loot = foe.swarm ? 'wild' : foe.kind
    if (hasMega(g) && Math.random() < HORDE_MEGA_ENERGY_CHANCE[loot]) dropExp(g, fellX + 14, fellY + 10, HORDE_KO_EXP[foe.kind], true)
    const itemShare = g.endless && loot !== 'boss' ? HORDE_ENDLESS_ITEM_SHARE : 1
    if (Math.random() < HORDE_ITEM_CHANCE[loot] * itemShare) dropItem(g, fellX, fellY, hordeRollItem())
    // A chest to pick up: always from a boss, now and then from an elite.
    if (Math.random() < HORDE_CHEST_DROP_CHANCE[loot]) dropItem(g, fellX - 18, fellY - 6, 'chest')
    // A Gigantamax boss leaves a Max Mushroom.
    if (foe.gmax) dropItem(g, fellX, fellY, 'maxMushroom')
    if (Math.random() < HORDE_BERRY_CHANCE && g.hp < g.maxHp) {
      const heal = Math.round(g.maxHp * HORDE_BERRY_HEAL)
      g.hp = Math.min(g.maxHp, g.hp + heal)
      leadPopup(g, t('horde.berry', { hp: heal }), 'heal')
    }

    // What the effects on it do as it faints.
    const fx = foe.fx
    const E = HORDE_EFFECT
    if (fx.burn && fx.burn.until > g.clock && effectRank(g, 'Fire').bonus) {
      for (const other of standingFoes(g)) {
        if (other !== foe && dist(other.x, other.y, foe.x, foe.y) <= E.burnSpreadReach) burn(g, other, fx.burn.dps)
      }
    }
    if (fx.confusedUntil > g.clock && effectRank(g, 'Psychic').bonus) {
      for (const other of nearestTo(g, foe, g.foes.length, E.confuseReach)) if (other.kind !== 'boss') hold(g, other, E.confuseStunMs)
    }
    // Wildfire: a burning foe explodes, hitting those nearby for a share of the hit that finished it.
    if (fx.burn && fx.burn.until > g.clock && effectRank(g, 'Fire').mastery) {
      const boom = (foe.lastHit ?? fx.burn.dps) * E.wildfireShare
      g.flashes.push({ id: g.seq++, kind: 'blast', x: foe.x, y: foe.y, dx: 0, dy: 0, type: 'Fire', born: g.now, reach: E.burnSpreadReach })
      for (const other of nearestTo(g, foe, Infinity, E.burnSpreadReach)) damageFoe(g, other, boom, 'hit')
    }
    // Plague: its poison passes to the nearest foe.
    const poisons = fx.poison.filter((p) => p.until > g.clock)
    if (poisons.length && effectRank(g, 'Poison').mastery) {
      const next = nearestTo(g, foe, 1, E.plagueReach)[0]
      if (next) {
        next.fx.poison = [...next.fx.poison.filter((p) => p.until > g.clock), ...poisons].slice(-E.poisonStacks)
        effectPopup(g, next.x, next.y, 'Poison')
      }
    }
    // Enchant: a charmed foe charms those nearby, and heals the lead.
    if (fx.charm && fx.charm.until > g.clock && effectRank(g, 'Fairy').mastery) {
      const cut = fx.charm.cut
      for (const other of nearestTo(g, foe, Infinity, E.charmSpreadReach)) {
        const active = other.fx.charm && other.fx.charm.until > g.clock ? other.fx.charm.cut : 0
        other.fx.charm = { cut: Math.max(active, cut), until: g.clock + E.charmMs }
      }
      healLead(g, g.maxHp * E.enchantHeal)
    }
    // An exploder knocked out blows up all the same, and any it sets off count as the lead's too:
    // caught in a blast straight away, otherwise once its fuse (what's left of it, if lit) burns down -
    // its body standing in its place till then.
    if (foe.exploder) {
      foe.byLead = true
      if (viaBlast) blowUp(g, blastFrom(foe), foe)
      else {
        g.bombs.push({
          id: g.seq++,
          sp: foe.sp,
          kind: foe.kind,
          x: foe.x,
          y: foe.y,
          level: foe.level,
          attack: foe.stats.atk,
          fuseAt: foe.fuseAt ?? g.clock + HORDE_EXPLODER_FUSE_MS,
          byLead: true
        })
        // Gone at once, with no fading out - the body takes its place.
        foe.faintedAt = g.now - FAINT_MS
      }
      foe.fuseAt = undefined
    }
  }

  // A popup for a move's twist going off, in its type's colour.
  function twistPopup(g: Game, x: number, y: number, text: string, type: string): void {
    g.popups.push({ id: g.seq++, x, y, text, kind: 'effect', born: g.now, color: typeColor(type) })
  }

  // HP back for the lead (more with Big Roots).
  function healLead(g: Game, amount: number): void {
    const heal = Math.round(amount * (1 + heldOf(g, 'healing') / 100))
    if (heal < 1 || g.hp >= g.maxHp) return
    g.hp = Math.min(g.maxHp, g.hp + heal)
    leadPopup(g, `+${heal}`, 'heal')
  }

  // Shell Bells: a share of the damage dealt back as HP - no more in any one second than a share
  // of max HP, with what's under a whole point carried over (and no popup, it's so often).
  function bellHeal(g: Game, dealt: number): void {
    const share = heldOf(g, 'lifesteal')
    if (share <= 0 || dealt <= 0) return
    const second = Math.floor(g.clock / 1000)
    if (g.bell.second !== second) g.bell = { second, healed: 0, carry: g.bell.carry }
    const cap = g.maxHp * HORDE_SHELL_BELL_CAP
    const amount = Math.min((dealt * share) / 100, cap - g.bell.healed)
    if (amount <= 0) return
    g.bell.healed += amount
    g.bell.carry += amount
    const whole = Math.floor(g.bell.carry)
    if (whole < 1) return
    g.bell.carry -= whole
    g.hp = Math.min(g.maxHp, g.hp + whole)
  }

  // The lead's stats raised (or, with a share below 0, lowered) for a while.
  function changeLeadStats(g: Game, stats: HordeLeadStat[], amount: number, ms: number, type: string): void {
    g.leadMods = [...g.leadMods.filter((m) => m.until > g.clock), ...stats.map((stat) => ({ stat, amount, until: g.clock + ms, type }))]
    const names = stats.map((s) => t(STAT_KEYS[s])).join(', ')
    twistPopup(g, g.px, g.py, t(amount > 0 ? 'horde.proc.statUp' : 'horde.proc.statDown', { stat: names }), type)
  }

  // Ground left behind by a move (see Zone) - the oldest goes once there's too much of it.
  function addZone(
    g: Game,
    known: KnownMove,
    x: number,
    y: number,
    reach: number,
    dps: number,
    ms: number,
    opts: { slow?: number; pull?: number; drift?: boolean } = {}
  ): void {
    const angle = Math.random() * Math.PI * 2
    g.zones.push({
      id: g.seq++,
      known,
      x,
      y,
      reach,
      dps: Math.max(1, dps),
      slow: opts.slow ?? 0,
      pull: opts.pull ?? 0,
      drift: !!opts.drift,
      dx: Math.cos(angle),
      dy: Math.sin(angle),
      born: g.clock,
      until: g.clock + ms
    })
    if (g.zones.length > HORDE_MAX_ZONES) g.zones.splice(0, g.zones.length - HORDE_MAX_ZONES)
  }

  // A move's look as it lands on a foe: its mark (melee), a bolt, a burst from below, a crater or a swirl.
  function landingFlash(g: Game, known: KnownMove, foe: Foe): boolean {
    const anim = animOf(known)
    const kind = anim && MARK_ANIMS.includes(anim) ? 'mark' : hordeLandingKind(anim)
    if (!kind) return false
    g.flashes.push({ id: g.seq++, kind, anim, x: foe.x, y: foe.y, dx: 0, dy: 0, type: known.move.type, born: g.now })
    // A meteor shakes the ground.
    if (kind === 'crater') g.shakeUntil = g.now + 180
    return true
  }

  // The lead's sprite darting at a foe, to just short of it, and back - nothing can hit it meanwhile.
  function dashAt(g: Game, foe: Foe): void {
    const away = awayFromLead(g, foe.x, foe.y)
    const stop = Math.max(0, awayOf(g, foe) - (HORDE_LEAD_HITBOX + HORDE_FOE_HITBOX[foe.kind] - 4))
    g.dash = { dx: away.dx, dy: away.dy, reach: stop, start: g.clock }
    g.safeUntil = Math.max(g.safeUntil, g.clock + HORDE_DASH_SAFE_MS)
  }

  // What a move's twist does to a foe it just hit for `dmg` (main hits only - not a melee
  // move's clips or a stream's later pulses).
  function hitTwist(g: Game, known: KnownMove, foe: Foe, dmg: number): void {
    const tr = traitOf(known)
    const type = known.move.type
    const fx = foe.fx
    const boss = foe.kind === 'boss'
    const share = foe.kind === 'elite' ? HORDE_ELITE_HOLD_SHARE : 1
    const roll = (chance: number): boolean => Math.random() * 100 < chance
    const standing = foe.faintedAt === null
    switch (tr.kind) {
      case 'knockback':
        if (!boss && standing) push(g, foe, tr.distance * share, false)
        break
      case 'pull':
        // Foes nearby dragged in to the one hit.
        for (const other of nearestTo(g, foe, Infinity, tr.reach)) {
          if (other.kind === 'boss') continue
          const d = dist(other.x, other.y, foe.x, foe.y)
          if (d < 1) continue
          other.slide = { dx: (foe.x - other.x) / d, dy: (foe.y - other.y) / d, left: Math.max(0, d - HORDE_FOE_SPACING * 0.6) }
          other.stopped = false
        }
        break
      case 'splash': {
        // Draco Meteor: an explosion where it lands.
        const reach = tr.reach + HORDE_FOE_HITBOX[foe.kind]
        if (tr.boom) g.flashes.push({ id: g.seq++, kind: 'blast', x: foe.x, y: foe.y, dx: 0, dy: 0, type, born: g.now, reach })
        for (const other of nearestTo(g, foe, Infinity, reach)) damageFoe(g, other, dmg * tr.share, 'hit', true, known.move.name)
        break
      }
      case 'hurl': {
        // Thrown away from the lead; those where it comes down are hit too, and shoved.
        const away = awayFromLead(g, foe.x, foe.y)
        const lands = { x: foe.x + away.dx * tr.distance * share, y: foe.y + away.dy * tr.distance * share }
        if (!boss && standing) push(g, foe, tr.distance * share, false)
        for (const other of standingFoes(g)) {
          if (other === foe || dist(other.x, other.y, lands.x, lands.y) > tr.reach + HORDE_FOE_HITBOX[other.kind]) continue
          damageFoe(g, other, dmg * tr.share, 'hit', true, known.move.name)
          if (other.kind !== 'boss') push(g, other, tr.distance * 0.3, false)
        }
        break
      }
      case 'recoil': {
        // Never more than a share of its max HP a hit, and never fainting from it.
        const hurt = Math.min(Math.round(dmg * tr.share), Math.round(g.maxHp * HORDE_RECOIL_CAP))
        if (hurt > 0 && g.hp > 1) {
          g.hp = Math.max(1, g.hp - hurt)
          leadPopup(g, `-${hurt}`, 'hurt')
        }
        break
      }
      case 'drain':
        healLead(g, dmg * tr.share)
        break
      case 'flinch':
        // Sucker Punch: only a foe something is slowing (or has frozen).
        if (tr.slowed && !(foePace(g, foe) < 1 || fx.frozenUntil > g.clock)) break
        if (!boss && standing && roll(tr.chance)) {
          foe.cooldowns = foe.moves.map((m) => hordeMoveCooldown(m) * hordeFoeCooldownScale(g.elapsed) * share)
          hold(g, foe, HORDE_FLINCH_STOP_MS)
          twistPopup(g, foe.x, foe.y, t('horde.proc.flinch'), type)
        }
        break
      case 'freeze':
        // Ice Beam: frozen solid - an elite for half as long, a boss a quarter.
        if (standing && roll(tr.chance)) {
          fx.frozenUntil = Math.max(fx.frozenUntil, g.clock + tr.ms * HORDE_FREEZE_SHARE[foe.kind])
          twistPopup(g, foe.x, foe.y, t('horde.proc.frozen'), 'Ice')
        }
        break
      case 'paralyze':
        if (!boss && standing && roll(tr.chance)) {
          hold(g, foe, tr.ms)
          fx.slow = { amount: Math.max(fx.slow && fx.slow.until > g.clock ? fx.slow.amount : 0, HORDE_PARALYSIS_SLOW), until: g.clock + tr.ms + HORDE_PARALYSIS_SLOW_MS }
          twistPopup(g, foe.x, foe.y, t('horde.proc.paralyze'), type)
        }
        break
      case 'confuse':
        // Psyshock: only a foe that was at full HP before this hit.
        if (tr.fullHp && foe.hp + dmg < foe.maxHp) break
        if (!boss && standing && roll(tr.chance)) {
          fx.confusedUntil = Math.max(fx.confusedUntil, g.clock + tr.ms * share)
          twistPopup(g, foe.x, foe.y, t('horde.proc.confuse'), type)
        }
        break
      case 'inflict':
        // Its own type's effect at the strength the lead's moves give it (at its weakest without one of the type).
        if (standing && roll(tr.chance)) {
          const rank = effectRank(g, tr.type)
          applyEffect(g, tr.type, foe, dmg, rank.moves ? rank.potency : 1, rank.bonus)
        }
        break
      case 'chain': {
        // Like Electric's chain, but sure to jump.
        const hit = new Set<Foe>([foe])
        let from = foe
        for (let jump = 0; jump < tr.jumps; jump++) {
          const next = nearestTo(g, from, g.foes.length, HORDE_EFFECT.chainReach).find((f) => !hit.has(f))
          if (!next) break
          hit.add(next)
          g.arcs.push({ id: g.seq++, x1: from.x, y1: from.y - 20, x2: next.x, y2: next.y - 20, type, born: g.now })
          damageFoe(g, next, dmg * tr.share, 'hit', true, known.move.name)
          from = next
        }
        break
      }
      case 'foeDrop': {
        // Half as much on a boss.
        if (!standing) break
        const amount = (tr.percent / 100) * (boss ? 0.5 : 1)
        const active = foeDropOf(fx, tr.stat, g.clock)
        fx.drop = { ...fx.drop, [tr.stat]: { amount: Math.max(active, amount), until: g.clock + tr.ms } }
        if (!active) twistPopup(g, foe.x, foe.y, t('horde.proc.statDown', { stat: t(STAT_KEYS[tr.stat]) }), type)
        break
      }
      case 'triAttack': {
        // Paralysed, frozen or burned, one at random.
        if (!standing || !roll(tr.chance)) break
        const pickOne = Math.floor(Math.random() * 3)
        if (pickOne === 0) {
          if (boss) break
          hold(g, foe, HORDE_TRI_PARALYSIS_MS * share)
          fx.slow = { amount: Math.max(fx.slow && fx.slow.until > g.clock ? fx.slow.amount : 0, HORDE_PARALYSIS_SLOW), until: g.clock + HORDE_TRI_PARALYSIS_MS + HORDE_PARALYSIS_SLOW_MS }
          twistPopup(g, foe.x, foe.y, t('horde.proc.paralyze'), 'Electric')
        } else if (pickOne === 1) {
          // Frozen solid - an elite for half as long, a boss a quarter.
          fx.frozenUntil = Math.max(fx.frozenUntil, g.clock + HORDE_EFFECT.freezeMs * HORDE_FREEZE_SHARE[foe.kind])
          twistPopup(g, foe.x, foe.y, t('horde.proc.frozen'), 'Ice')
        } else {
          const rank = effectRank(g, 'Fire')
          applyEffect(g, 'Fire', foe, dmg, rank.moves ? rank.potency : 1, rank.bonus)
          twistPopup(g, foe.x, foe.y, t('horde.proc.burned'), 'Fire')
        }
        break
      }
      case 'trap':
        // Held in a swirl that hurts it every second (a boss isn't held, but still hurt).
        if (!standing) break
        if (!boss) hold(g, foe, tr.ms * share)
        addZone(g, known, foe.x, foe.y, HORDE_FOE_HITBOX[foe.kind] + 10, dmg * tr.share, tr.ms)
        break
      case 'zone': {
        // Shots, strikes and piercing shots leave it where they hit (blasts, waves and streams where they land - see there).
        const shape = hordeMoveShape(known.move)
        if (shape === 'shot' || shape === 'strike' || shape === 'pierce')
          addZone(g, known, foe.x, foe.y, tr.reach * reachScale(known), dmg * tr.share, tr.ms, tr)
        break
      }
    }
  }

  // What a move's twist does when it knocks a foe out.
  function koTwist(g: Game, known: KnownMove, foe: Foe): void {
    const tr = traitOf(known)
    if (tr.kind === 'gold') {
      g.gold += tr.amount
      twistPopup(g, foe.x, foe.y, t('horde.proc.gold', { gold: tr.amount }), 'Steel')
    } else if (tr.kind === 'koHeal') healLead(g, g.maxHp * tr.share)
    else if (tr.kind === 'koStack') known.koPower = Math.min(tr.max, (known.koPower ?? 0) + tr.per)
  }

  // How much harder a walk-pace move lands right now, times (null for any other move).
  function paceMult(g: Game, move: HordeMove): number | null {
    const tr = hordeMoveDef(move).trait
    if (tr.kind !== 'scaleWith' || (tr.source !== 'speed' && tr.source !== 'slowness')) return null
    const most = 1 + tr.amount / 100
    // How many times the slowest pace the lead walks: Electro Ball grows with it (in full at
    // that many times), Gyro Ball is in full at the slowest pace and fades as it grows.
    const pace = (leadWalk(g) * (1 + leadMod(g, 'spe'))) / HORDE_WALK_SLOWEST
    if (tr.source === 'speed') return Math.max(1, Math.min(most, pace))
    return Math.max(1, Math.min(most, most / Math.max(1, pace)))
  }

  // The power a move whose power changes as it plays would have if used right now, times (null for
  // any other move, or one it can't tell for while not yet known).
  function boostNow(g: Game, move: HordeMove): number | null {
    const tr = hordeMoveDef(move).trait
    const known = g.known.find((k) => k.move.id === move.id)
    switch (tr.kind) {
      case 'momentum':
        return 1 + (tr.max / 100) * Math.min(1, g.walkMs / HORDE_MOMENTUM_MS)
      case 'scaleWith': {
        const paced = paceMult(g, move)
        if (paced !== null) return paced
        // At full HP in full, down to amount% at none.
        if (tr.source === 'hp') return tr.amount / 100 + (1 - tr.amount / 100) * (g.hp / g.maxHp)
        // Outrage: nothing extra at full HP, up to amount% more at none.
        if (tr.source === 'lowHp') return 1 + (tr.amount / 100) * (1 - g.hp / g.maxHp)
        if (tr.source === 'tomes') return 1 + (tr.amount / 100) * g.tomes.reduce((sum, tm) => sum + tm.ranks, 0)
        return g.now - g.hurtAt < HORDE_HURT_RECENT_MS ? 1 + tr.amount / 100 : 1
      }
      case 'typeBoost': {
        // Phantom Force: for each move of the type known, itself included.
        const count = 1 + knownMoves(g).filter((m) => m.type === tr.type && m.id !== move.id).length
        return 1 + Math.min(tr.max, tr.per * count) / 100
      }
      case 'escalate': {
        // Rollout: its next use adds on to the streak, unless it went unused too long.
        if (!known) return null
        const going = known.lastUseAt !== undefined && g.clock - known.lastUseAt <= HORDE_ESCALATE_RESET_MS
        return 1 + Math.min(tr.max, tr.per * (going ? (known.streak ?? 0) : 0)) / 100
      }
      case 'koStack':
        return known ? 1 + (known.koPower ?? 0) / 100 : null
      default:
        return null
    }
  }

  // A move's twist in words, with the boost it has right now if its power changes as it plays.
  function twistText(g: Game, move: HordeMove): string {
    const text = hordeTraitText(t, move)
    const boost = boostNow(g, move)
    if (boost === null) return text
    // Dragon Energy's can be below nothing extra.
    const n = Math.round((boost - 1) * 100)
    return `${text} - ${t('horde.paceBoostNow', { n: n < 0 ? String(n) : `+${n}` })}`
  }

  // How much harder a move's twist makes this hit land, times.
  function twistMult(g: Game, known: KnownMove, foe: Foe): number {
    const tr = traitOf(known)
    const more = (on: boolean, bonus: number): number => (on ? 1 + bonus / 100 : 1)
    switch (tr.kind) {
      case 'momentum':
      case 'scaleWith':
      case 'typeBoost':
        return boostNow(g, known.move) ?? 1
      case 'escalate':
        return 1 + Math.min(tr.max, tr.per * Math.max(0, (known.streak ?? 1) - 1)) / 100
      case 'koStack':
        return 1 + (known.koPower ?? 0) / 100
      case 'vsBig':
        return more(foe.kind !== 'wild', tr.bonus)
      case 'vsStatus':
        return more(tr.type ? effectTypesOn(foe.fx, g.clock).includes(tr.type) : effectCount(foe.fx, g.clock) > 0, tr.bonus)
      case 'firstStrike':
        return more(foe.hp >= foe.maxHp, tr.bonus)
      case 'far':
        return more(foe.fx.spookedUntil > g.clock || awayOf(g, foe) > spreadRadius(g) * 1.3, tr.bonus)
      case 'counter':
        return more(foe.stopped && foe.cooldowns.length > 0 && Math.min(...foe.cooldowns) <= 700, tr.bonus)
      default:
        return 1
    }
  }

  // A move's type effect going off on a foe it just hit for `dmg` (see HORDE_EFFECT).
  function applyEffect(g: Game, type: string, foe: Foe, dmg: number, potency: number, bonus: boolean): void {
    const fx = foe.fx
    const c = g.clock
    const E = HORDE_EFFECT
    // A boss shrugs off being held or moved (it took more damage from the hit instead); an elite gets half.
    const shrug = foe.kind === 'boss' && HORDE_HOLD_TYPES.includes(type)
    const share = foe.kind === 'elite' ? HORDE_ELITE_HOLD_SHARE : 1
    // With every move of the type, its mastery rule too.
    const mastery = effectRank(g, type).mastery
    let onLead = false
    switch (type) {
      case 'Normal':
        if (!shrug) foe.cooldowns = foe.moves.map((m) => hordeMoveCooldown(m) * hordeFoeCooldownScale(g.elapsed) * share)
        if (bonus) fx.vulnerableUntil = c + E.flinchVulnerableMs
        // Shockwave: every foe close to it flinches too (not bosses).
        if (mastery)
          for (const other of nearestTo(g, foe, Infinity, E.shockwaveReach)) {
            if (other.kind === 'boss') continue
            const otherShare = other.kind === 'elite' ? HORDE_ELITE_HOLD_SHARE : 1
            other.cooldowns = other.moves.map((m) => hordeMoveCooldown(m) * hordeFoeCooldownScale(g.elapsed) * otherShare)
            if (bonus) other.fx.vulnerableUntil = c + E.flinchVulnerableMs
          }
        break
      case 'Fire':
        burn(g, foe, dmg * E.burnShare * potency)
        break
      case 'Water':
        if (!shrug) push(g, foe, E.pushDistance * potency * share, bonus)
        break
      case 'Grass': {
        // Overgrowth: twice the healing under half HP, and a higher shield.
        const low = mastery && g.hp < g.maxHp / 2
        const heal = Math.max(1, Math.round(dmg * E.leechShare * potency * (low ? E.overgrowthHeal : 1) * (1 + heldOf(g, 'healing') / 100)))
        const room = g.maxHp - g.hp
        g.hp = Math.min(g.maxHp, g.hp + heal)
        if (bonus && heal > room) addShield(g, heal - room, mastery ? E.overgrowthShieldMax : E.leechShieldMax)
        leadPopup(g, `+${heal}`, 'heal')
        break
      }
      case 'Electric': {
        // The hit jumps on to the nearest foe not hit yet, and on from there.
        const hit = new Set<Foe>([foe])
        let from = foe
        for (let jump = 0; jump < E.chainJumps + (bonus ? E.chainBonusJumps : 0); jump++) {
          const next = nearestTo(g, from, g.foes.length, E.chainReach).find((f) => !hit.has(f))
          if (!next) break
          hit.add(next)
          g.arcs.push({ id: g.seq++, x1: from.x, y1: from.y - 20, x2: next.x, y2: next.y - 20, type, born: g.now })
          damageFoe(g, next, dmg * E.chainShare * potency, 'hit')
          // Overload: paralysed for a moment.
          if (mastery && next.kind !== 'boss') hold(g, next, E.overloadMs)
          from = next
        }
        break
      }
      case 'Ice': {
        const stacks = (fx.chill && fx.chill.until > c ? fx.chill.stacks : 0) + 1
        const per = Math.max(fx.chill?.per ?? 0, E.chillSlow * potency)
        // Frozen solid - an elite for half as long, a boss a quarter.
        if (stacks >= E.chillStacks) {
          fx.frozenUntil = Math.max(fx.frozenUntil, c + E.freezeMs * potency * HORDE_FREEZE_SHARE[foe.kind])
          fx.chill = null
        } else {
          fx.chill = {
            stacks: Math.min(stacks, E.chillStacks),
            per,
            until: c + E.chillMs
          }
        }
        break
      }
      case 'Fighting': {
        const stacks = Math.min(E.breakStacks, (fx.guard && fx.guard.until > c ? fx.guard.stacks : 0) + 1)
        const per = Math.min(E.breakMaxPerStack, Math.max(fx.guard?.per ?? 0, E.breakPerStack * potency))
        fx.guard = { stacks, per, until: c + E.breakMs }
        if (bonus && stacks === E.breakStacks && foe.kind !== 'boss') push(g, foe, E.breakPush * share, false)
        break
      }
      case 'Poison':
        fx.poison = [
          ...fx.poison.filter((p) => p.until > c),
          {
            dps: dmg * E.poisonShare * potency,
            from: c,
            until: c + E.poisonMs
          }
        ].slice(-E.poisonStacks)
        break
      case 'Ground':
        for (const other of standingFoes(g)) {
          if (other === foe || dist(other.x, other.y, foe.x, foe.y) > E.tremorReach) continue
          damageFoe(g, other, dmg * E.tremorShare * potency, 'hit')
          if (bonus && other.kind !== 'boss') hold(g, other, E.tremorStopMs)
        }
        // Sinkhole: slowing ground where it hit (counted as one of the Ground moves').
        if (mastery) {
          const ground = g.known.find((k) => k.move.type === 'Ground')
          if (ground) addZone(g, ground, foe.x, foe.y, E.sinkholeReach, 0, E.sinkholeMs, { slow: E.sinkholeSlow })
        }
        break
      case 'Flying': {
        const active = g.tailwind && g.tailwind.until > c ? g.tailwind.speed : 0
        g.tailwind = {
          speed: Math.max(active, E.tailwindSpeed * potency),
          until: c + E.tailwindMs
        }
        onLead = true
        break
      }
      case 'Psychic':
        // Mind Control: longer.
        if (!shrug) fx.confusedUntil = Math.max(fx.confusedUntil, c + E.confuseMs * potency * share * (mastery ? E.mindControlLonger : 1))
        break
      case 'Bug':
        if (!shrug) {
          fx.spookedUntil = Math.max(fx.spookedUntil, c + E.spookMs * potency * share)
          fx.spookCaught = false
        }
        break
      case 'Rock':
        g.rocks = [
          ...g.rocks.filter((r) => r.until > c),
          {
            id: g.seq++,
            x: foe.x,
            y: foe.y,
            dps: dmg * E.rockShare * potency,
            until: c + E.rockMs,
            hit: []
          }
        ].slice(mastery ? -E.avalancheSpots : bonus ? -2 : -1)
        break
      case 'Dragon': {
        // Ascent: more stacks.
        const stacks = Math.min(mastery ? E.ascentStacks : E.rageStacks, (g.rage && g.rage.until > c ? g.rage.stacks : 0) + 1)
        g.rage = {
          stacks,
          per: Math.max(g.rage?.per ?? 0, E.ragePerStack * potency),
          until: c + E.rageMs
        }
        onLead = true
        break
      }
      case 'Steel':
        addShield(g, dmg * E.guardShare * potency, mastery ? E.fortressMax : E.guardMax)
        onLead = true
        break
      case 'Fairy': {
        const active = fx.charm && fx.charm.until > c ? fx.charm.cut : 0
        fx.charm = {
          cut: Math.min(E.charmMaxCut, Math.max(active, E.charmCut * potency)),
          until: c + E.charmMs
        }
        break
      }
      // Ghost's Execute and Dark's Ambush are all in the hit itself.
    }
    if (onLead) effectPopup(g, g.px, g.py, type)
    else effectPopup(g, foe.x, foe.y, type)
  }

  // Only what's on screen (and up out of the ground) can be hit.
  function hittable(g: Game): Foe[] {
    return g.foes.filter((f) => f.faintedAt === null && risen(g, f) && onScreen(g, f))
  }

  function awayOf(g: Game, f: Foe): number {
    return dist(f.x, f.y, g.px, g.py)
  }

  // How far melee moves reach a foe (bigger ones from further off), with all their reach upgrades.
  function meleeReach(g: Game, foe: Foe): number {
    return meleeRadius(g) + HORDE_FOE_HITBOX[foe.kind]
  }

  // A few foes picked at random, none twice.
  function randomFoes(list: Foe[], count: number): Foe[] {
    const pool = [...list]
    const out: Foe[] = []
    while (out.length < count && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0])
    return out
  }

  // Everyone in the spread ring round the lead (a wave's reach) - or this many times as far out.
  function inRing(g: Game, scale = 1): Foe[] {
    return hittable(g).filter((f) => awayOf(g, f) <= spreadRadius(g) * scale)
  }

  // A move's extra shots or strikes from its upgrades: that many more foes not already
  // aimed at - the nearest, or random ones - going round the same ones again if there
  // aren't enough.
  function withCount(g: Game, known: KnownMove, targets: Foe[], from: Foe[], pick: 'near' | 'random'): Foe[] {
    if (known.count <= 0) return targets
    const others = from.filter((f) => !targets.includes(f))
    const more = pick === 'random' ? randomFoes(others, known.count) : others.sort((a, b) => awayOf(g, a) - awayOf(g, b)).slice(0, known.count)
    for (let i = 0; more.length < known.count; i++) more.push(targets[i % targets.length])
    return [...targets, ...more]
  }

  // Extra shots thin each hit, but not all the way: each extra counts for only part of a
  // shot when splitting the move's damage (times the shots it started with), so more shots
  // still add some damage in all.
  function shotShare(known: KnownMove): number {
    if (hordeCountIsBounce(known.move)) return 1
    const base = hordeBaseCount(known.move)
    return base / (base + known.count * (1 - HORDE_EXTRA_HIT_SHARE))
  }

  // Everyone in a stream from the lead the given way: along it, and no further to either side
  // than half its width (plus their own size). Its reach upgrades lengthen it, and widen it by half as much again.
  function inBeam(g: Game, dx: number, dy: number, length: number, width: number, from = { x: g.px, y: g.py }): Foe[] {
    return hittable(g).filter((f) => {
      const along = (f.x - from.x) * dx + (f.y - from.y) * dy
      const side = Math.abs((f.x - from.x) * dy - (f.y - from.y) * dx)
      return along >= -HORDE_FOE_HITBOX[f.kind] && along <= length && side <= width / 2 + HORDE_FOE_HITBOX[f.kind]
    })
  }

  // Everyone in a cone from the lead the given way, this deep.
  function inCone(g: Game, dx: number, dy: number, reach: number): Foe[] {
    const S = HORDE_SHAPES
    const cos = Math.cos(S.coneAngle / 2)
    return hittable(g).filter((f) => {
      const d = awayOf(g, f)
      if (d > reach + HORDE_FOE_HITBOX[f.kind]) return false
      return d <= HORDE_LEAD_HITBOX + HORDE_FOE_HITBOX[f.kind] || ((f.x - g.px) * dx + (f.y - g.py) * dy) / d >= cos
    })
  }

  // Single-target shapes' extras. Multi-target: the nearest other foes inside the spread ring
  // are hit too (a strike's anywhere at random); melee moves repeat instead. Fully
  // enraged (with Rage's bonus), a Dragon move also goes for the foe behind its target - the
  // nearest one further off than it, roughly in line with it.
  function withExtras(g: Game, known: KnownMove, first: Foe, from: Foe[], pick: 'near' | 'random'): Foe[] {
    const move = known.move
    const targets = [first]
    if (g.multi > 0 && hordeMoveShape(move) !== 'melee') {
      const others = from.filter((f) => f !== first)
      const count = g.multi * HORDE_MULTI_TARGETS
      if (pick === 'random') targets.push(...randomFoes(others, count))
      else targets.push(...others.sort((a, b) => awayOf(g, a) - awayOf(g, b)).slice(0, count))
    }
    const rage = g.rage && g.rage.until > g.clock ? g.rage : null
    // Ascent (Dragon's mastery): any move, at its higher stack count.
    const dragon = effectRank(g, 'Dragon')
    const fullRage = (dragon.mastery ? HORDE_EFFECT.ascentStacks : HORDE_EFFECT.rageStacks) <= (rage?.stacks ?? 0)
    if ((move.type === 'Dragon' || dragon.mastery) && dragon.bonus && fullRage) {
      const line = awayFromLead(g, first.x, first.y)
      const inLine = (f: Foe): boolean => {
        const d = dist(f.x, f.y, first.x, first.y)
        return d > 0 && ((f.x - first.x) * line.dx + (f.y - first.y) * line.dy) / d >= BEHIND_COS
      }
      const behind = hittable(g)
        .filter((f) => !targets.includes(f) && inLine(f))
        .sort((a, b) => dist(a.x, a.y, first.x, first.y) - dist(b.x, b.y, first.x, first.y))[0]
      if (behind) targets.push(behind)
    }
    return targets
  }

  // A melee hit: harder than usual, clipping the foes right beside it for a share (all of it
  // scaled by share - less for a Multi-target repeat).
  function meleeHit(g: Game, known: KnownMove, foe: Foe, share = 1): void {
    const S = HORDE_SHAPES
    const beside = nearestTo(g, foe, Infinity, S.meleeSplashReach + HORDE_FOE_HITBOX[foe.kind])
    strike(g, known, foe, false, { bonus: S.meleeBonus, share })
    for (const other of beside) strike(g, known, other, false, { bonus: S.meleeBonus, share: S.meleeSplashShare * share, effect: false })
  }

  // The lead uses one move; false if there's nothing for it to hit yet (or it's still charging
  // up). Its uses are counted first, so a run of them in a row counts this one - and taken back
  // if it didn't go off.
  function playerAttack(g: Game, known: KnownMove, repeatShare = 1): boolean {
    const tr = traitOf(known)
    const first = repeatShare === 1
    if (tr.kind === 'charge' && first) {
      if (known.chargeUntil === undefined) {
        if (hittable(g).length) known.chargeUntil = g.clock + tr.ms
        return false
      }
      if (g.clock < known.chargeUntil) return false
      known.chargeUntil = undefined
    }
    const before = { streak: known.streak, lastUseAt: known.lastUseAt, uses: known.uses }
    if (first) {
      if (known.lastUseAt === undefined || g.clock - known.lastUseAt > HORDE_ESCALATE_RESET_MS) known.streak = 0
      known.streak = (known.streak ?? 0) + 1
      known.lastUseAt = g.clock
      known.uses = (known.uses ?? 0) + 1
    }
    if (!fireMove(g, known, repeatShare)) {
      Object.assign(known, before)
      return false
    }
    // Metronome: one more stack for each use while the lead goes unhit.
    if (first) g.metronome = Math.min(HORDE_METRONOME_STACKS, g.metronome + 1)
    // Clear Amulets shrug off a share of the move's own drawbacks (all of them, with enough).
    const amulet = amuletShare(g)
    if (first && tr.kind === 'selfDrop' && amulet < 1) changeLeadStats(g, [tr.stat], (-tr.percent / 100) * (1 - amulet), tr.ms, known.move.type)
    // A chance of raised stats once a use, however many foes its shots hit.
    if (first && tr.kind === 'selfBoost' && Math.random() * 100 < tr.chance) changeLeadStats(g, tr.stats, tr.percent / 100, tr.ms, known.move.type)
    if (first && tr.kind === 'selfBurn' && amulet < 1 && !g.known.some((k) => HORDE_SELF_BURN_SAFE.includes(k.move.type))) {
      g.leadBurn = { hurt: Math.max(1, Math.round((g.maxHp * tr.percent * (1 - amulet)) / 100)), until: g.clock + tr.ms }
      twistPopup(g, g.px, g.py, t('horde.proc.burned'), known.move.type)
    }
    if (first && tr.kind === 'selfHurt' && g.hp > 1) {
      const hurt = Math.max(1, Math.round((g.maxHp * tr.percent) / 100))
      leadPopup(g, `-${Math.min(hurt, g.hp - 1)}`, 'hurt')
      g.hp = Math.max(1, g.hp - hurt)
    }
    if (first && tr.kind === 'exhaust' && amulet < 1) {
      g.exhaust = { moveId: known.move.id, amount: (tr.slow / 100) * (1 - amulet), until: g.clock + tr.ms }
      twistPopup(g, g.px, g.py, t('horde.proc.recharge'), known.move.type)
    }
    if (first && tr.kind === 'rampage' && !(known.rampUntil !== undefined && known.rampUntil > g.clock)) known.rampUntil = g.clock + tr.ms
    return true
  }

  // A move going off, by its shape (and twist); false if there's nothing for it to hit yet. Streams,
  // cones and aimed shots go for the picked foe, or else the nearest. A melee or piercing move's
  // Multi-target repeat hits for repeatShare of the damage.
  function fireMove(g: Game, known: KnownMove, repeatShare = 1): boolean {
    const move = known.move
    const S = HORDE_SHAPES
    const shape = hordeMoveShape(move)
    const tr = traitOf(known)
    const anim = animOf(known)
    const standing = hittable(g)
    if (!standing.length) return false
    // How many times each shot hits, this use (the multiHit twist).
    const hits = tr.kind === 'multiHit' ? tr.min + Math.floor(Math.random() * (tr.max - tr.min + 1)) : 1
    // A strike's fall: a meteor takes longer to come down; a delayed one lands later still.
    const fallMs = anim && METEOR_ANIMS.includes(anim) ? HORDE_METEOR_FALL_MS : S.strikeDelayMs
    const landDelay = fallMs + (tr.kind === 'delayed' ? tr.ms : 0)
    const focused = standing.find((f) => f.id === g.focusId)
    const nearest = standing.reduce((best, f) => (awayOf(g, f) < awayOf(g, best) ? f : best))
    let aim = focused ?? nearest
    const shotFrom = { x: g.px, y: g.py - BODY_HEIGHT }
    const toward = awayFromLead(g, aim.x, aim.y)
    switch (shape) {
      case 'shot': {
        const targets = withCount(g, known, withExtras(g, known, aim, standing.filter((f) => awayOf(g, f) <= spreadRadius(g)), 'near'), standing, 'near')
        // Every nth use, more shots at the next nearest foes (round again if there aren't enough).
        if (tr.kind === 'everyNth' && (known.uses ?? 0) % tr.n === 0) {
          const byNear = standing.filter((f) => !targets.includes(f)).sort((a, b) => awayOf(g, a) - awayOf(g, b))
          for (let i = 0; i < tr.extra; i++) targets.push(byNear[i] ?? targets[i % targets.length])
        }
        for (const foe of targets) {
          // Each hit of a multi-hit shot flies a little behind the last.
          const toward = awayFromLead(g, foe.x, foe.y)
          for (let h = 0; h < hits; h++)
            g.shots.push({
              id: g.seq++,
              x: shotFrom.x - toward.dx * 22 * h,
              y: shotFrom.y - toward.dy * 22 * h,
              targetId: foe.id,
              known,
              small: hits > 1,
              share: shotShare(known),
              bounces: tr.kind === 'bounce' ? tr.jumps : undefined
            })
        }
        break
      }
      case 'strike': {
        // On the picked foe, or else the nearest. Its extra strikes (from upgrades and
        // Multi-target alike) come down on other foes on screen picked at random, one after
        // another - on that same foe again if there aren't enough, a Multi-target one then for a
        // share of the damage.
        const extras = known.count
        const repeats = g.multi * HORDE_MULTI_TARGETS
        const others = randomFoes(standing.filter((f) => f !== aim), extras + repeats)
        for (let n = 0; n <= extras + repeats; n++) {
          const target = n === 0 ? aim : (others[n - 1] ?? aim)
          const again = n > extras && target === aim
          g.strikes.push({
            id: g.seq++,
            targetId: target.id,
            known,
            many: false,
            landsAt: g.clock + landDelay + n * HORDE_MULTI_REPEAT_MS,
            share: shotShare(known) * (again ? HORDE_MULTI_REPEAT_SHARE : 1),
            fallMs
          })
        }
        break
      }
      case 'melee': {
        // The picked foe if it's in reach, else the nearest that is - or nothing yet. A dash or a
        // vanishing act reaches further; the reach twist further still.
        const extra = tr.kind === 'dash' ? tr.reach : tr.kind === 'burrow' ? tr.reach : 0
        const inReach = standing.filter((f) => awayOf(g, f) <= meleeReach(g, f) * ownReach(known) + extra)
        const target = focused && inReach.includes(focused) ? focused : inReach.includes(nearest) ? nearest : null
        if (!target) return false
        aim = target
        // Vanishing: it comes up under the foe in a moment (see step), and nothing can hit it meanwhile.
        if (tr.kind === 'burrow' && repeatShare === 1) {
          if (g.burrow) return false
          g.burrow = { known, targetId: target.id, until: g.clock + tr.ms }
          g.safeUntil = Math.max(g.safeUntil, g.burrow.until + HORDE_DASH_SAFE_MS)
          break
        }
        if (tr.kind === 'dash' && awayOf(g, target) > HORDE_LEAD_HITBOX + HORDE_FOE_HITBOX[target.kind] + 10) dashAt(g, target)
        const struck = withExtras(g, known, target, inReach, 'near')
        // Cleaving: the next nearest foes in reach too.
        if (tr.kind === 'cleave')
          struck.push(...inReach.filter((f) => !struck.includes(f)).sort((a, b) => awayOf(g, a) - awayOf(g, b)).slice(0, tr.extra))
        // Gyro Ball: its upgrades add hits, thinning each a little (as extra shots do).
        const def = hordeMoveDef(move)
        const swings = hits + (def.hitBoost ? known.count : 0)
        const swingShare = def.hitBoost ? repeatShare * shotShare(known) : repeatShare
        for (const foe of struck) {
          for (let h = 0; h < swings; h++) meleeHit(g, known, foe, swingShare)
          landingFlash(g, known, foe)
        }
        break
      }
      case 'beam':
        g.beams.push({ id: g.seq++, known, dx: toward.dx, dy: toward.dy, born: g.clock, pulses: 0, hit: new Set() })
        break
      case 'cone': {
        const reach = S.coneReach * reachScale(known) * ownReach(known)
        g.flashes.push({ id: g.seq++, kind: 'cone', x: g.px, y: g.py, dx: toward.dx, dy: toward.dy, type: move.type, born: g.now, reach })
        for (const foe of inCone(g, toward.dx, toward.dy, reach)) strike(g, known, foe, true)
        break
      }
      case 'pierce':
        g.shots.push({
          id: g.seq++,
          ...shotFrom,
          targetId: aim.id,
          known,
          pierce: { dx: toward.dx, dy: toward.dy, size: HORDE_SHAPES.pierceBaseSize * hordePierceSize(known.range), hit: new Set() },
          share: repeatShare
        })
        break
      case 'blast': {
        // Only at foes inside the spread ring: the picked one if it's there, else the nearest - or nothing yet.
        const ring = inRing(g)
        const target = focused && ring.includes(focused) ? focused : ring.includes(nearest) ? nearest : null
        if (!target) return false
        aim = target
        g.shots.push({ id: g.seq++, ...shotFrom, targetId: aim.id, known, blast: true })
        break
      }
      case 'scatter': {
        // Each at a different foe, the nearest first - round them again if there are more shots than foes.
        const byNear = [...standing].sort((a, b) => awayOf(g, a) - awayOf(g, b))
        // Its upgrades add bounces rather than shots (on top of a bounce move's own), and a Multi-target repeat fires for a share.
        const shots = hordeBaseCount(move)
        for (let i = 0; i < shots; i++) {
          const foe = byNear[i % byNear.length]
          const toward = awayFromLead(g, foe.x, foe.y)
          for (let h = 0; h < hits; h++)
            g.shots.push({
              id: g.seq++,
              x: shotFrom.x - toward.dx * 18 * h,
              y: shotFrom.y - toward.dy * 18 * h,
              targetId: foe.id,
              known,
              small: true,
              share: shotShare(known) * repeatShare,
              bounces: (tr.kind === 'bounce' ? tr.jumps : 0) + known.count
            })
        }
        break
      }
      case 'rain': {
        const strikes = S.rainStrikes + known.count
        for (let i = 0; i < strikes; i++)
          g.strikes.push({
            id: g.seq++,
            targetId: pick(standing).id,
            known,
            many: true,
            landsAt: g.clock + landDelay + (S.rainMs * i) / strikes,
            share: shotShare(known),
            fallMs
          })
        break
      }
      case 'nova':
        if (!inRing(g, ownRing(known)).length) return false
        g.waves.push({ id: g.seq++, known, born: g.clock, reach: ownRing(known) })
        // Expanding Force: another wave for each other move of the type known, one after another.
        if (tr.kind === 'echo') {
          const others = knownMoves(g).filter((m) => m.type === tr.type && m.id !== move.id).length
          for (let n = 1; n <= Math.min(tr.max, others); n++)
            g.waves.push({ id: g.seq++, known, born: g.clock + n * HORDE_ECHO_MS, reach: ownRing(known) })
        }
        break
      case 'orbit':
        // Balls circling the lead for a while; a new set takes over from any still going.
        g.orbs = g.orbs.filter((o) => o.known !== known)
        g.orbs.push({ id: g.seq++, known, balls: hordeBaseCount(move) + known.count, born: g.clock, until: g.clock + HORDE_ORBIT.ms, hits: {} })
        break
    }
    g.lastMove = { name: move.name, type: move.type, at: g.now }
    g.aimX = aim.x
    g.aimY = aim.y
    return true
  }

  // One of the lead's moves landing on a foe - spread if it's one that hits many. A part hit
  // (a stream's pulse, a melee move's clip) deals that share of the damage, a melee one lands
  // harder by its bonus, and some can't set off the type effect.
  function strike(
    g: Game,
    known: KnownMove,
    foe: Foe,
    spread: boolean,
    opts: { share?: number; bonus?: number; effect?: boolean } = {}
  ): number {
    // Something earlier (a tremor, a grub) may already have knocked it out.
    if (foe.faintedAt !== null) return 0
    const move = known.move
    const tr = traitOf(known)
    const E = HORDE_EFFECT
    const moves = knownMoves(g)
    const rage = g.rage && g.rage.until > g.clock ? g.rage : null
    const power = hordeMovePower(move, known.power)
    // Body Press hits with the lead's Defense (and its Defense raises or drops) instead of its Attack.
    const hitStat = tr.kind === 'bodyPress' ? g.stats.def * (1 + leadMod(g, 'def')) : g.stats.atk * (1 + leadMod(g, 'atk'))
    const attack = hitStat * (1 + (rage ? rage.stacks * rage.per : 0))
    const fx = foe.fx
    g.bursts.push({
      id: g.seq++,
      x: foe.x,
      y: foe.y,
      type: move.type,
      spread,
      born: g.now
    })
    // Freeze-Dry and the like: super effective on a type whatever the chart says (resisted counts twice over).
    const charted = hordeEffectiveness(setup.typeChart, move.type, foe.sp.types)
    const eff = tr.kind === 'superVs' && foe.sp.types.includes(tr.type) ? charted * 4 : charted
    const stab = leadForm(g).types.includes(move.type)
    // Each type among the lead's moves rolls for its effect on this hit.
    const procs =
      opts.effect === false ? [] : hordeEffectTypes(moves).filter((type) => Math.random() * 100 < hordeEffectChance(move, type, moves))
    // A critical hit, by its chance with Crit picks; Dark's Ambush makes the hit one, landing harder still.
    // Past 100% a hit can crit more than once, its crit damage multiplying again each time.
    // Assassin (Dark's mastery): every so many hits is a sure Ambush, and a crit on a foe under
    // half HP lands twice.
    const dark = effectRank(g, 'Dark')
    if (dark.mastery && opts.effect !== false) {
      g.darkHits++
      if (g.darkHits % E.assassinEvery === 0 && !procs.includes('Dark')) procs.push('Dark')
    }
    const ambush = procs.includes('Dark')
    let crits = Math.max(ambush || tr.kind === 'alwaysCrit' ? 1 : 0, hordeRollCrits(critChance(g) + (tr.kind === 'critUp' ? tr.chance : 0)))
    if (dark.mastery && crits > 0 && foe.hp < foe.maxHp * E.assassinLine) crits++
    const crit = crits > 0
    const critDamage =
      (HORDE_CRIT_DAMAGE * (1 + (bonusOf(g, 'critDamage') + known.crit) / 100) + (ambush ? E.ambushCritDamage * effectRank(g, 'Dark').potency : 0)) ** crits
    const guard = fx.guard && fx.guard.until > g.clock ? fx.guard : null
    let dmg = hordeDamage({
      level: g.level,
      power,
      attack,
      defense:
        foe.stats.def *
        (1 - (guard ? guard.stacks * guard.per : 0)) *
        (1 - foeDropOf(fx, 'def', g.clock)) *
        (tr.kind === 'armorPierce' ? 1 - tr.share : 1),
      stab,
      effectiveness: eff,
      spread,
      crit,
      critDamage
    })
    // The Resisted damage tome: a resisted hit lands harder, per resist.
    dmg = Math.floor(dmg * hordeResistBoost(eff, bonusOf(g, 'resist')))
    // What makes this hit land harder: a single-target move on a foe inside the spread ring,
    // a flinched foe left open, Hex, a frozen foe shattering, Execute, or a boss shrugging
    // off being held - and twice over while the Flame Orb lasts.
    let mult = 1 + (opts.bonus ?? 0)
    if (!spread && dist(foe.x, foe.y, g.px, g.py) <= spreadRadius(g)) mult += HORDE_SPREAD_FOCUS_BONUS
    if (fx.vulnerableUntil > g.clock) mult += E.flinchVulnerable
    if (move.type === 'Bug' && effectRank(g, 'Bug').bonus) mult += E.hexPerEffect * effectCount(fx, g.clock)
    const ice = effectRank(g, 'Ice')
    if (move.type === 'Ice' && ice.bonus && fx.frozenUntil > g.clock) {
      mult += E.shatterBonus
      fx.frozenUntil = 0
      // Permafrost: the foes right around it freeze solid.
      if (ice.mastery)
        for (const other of nearestTo(g, foe, Infinity, E.permafrostReach))
          other.fx.frozenUntil = Math.max(other.fx.frozenUntil, g.clock + E.freezeMs * ice.potency * HORDE_FREEZE_SHARE[other.kind])
    }
    // Combo: a fully broken foe takes more from every move. Swarm: so does a spooked one.
    if (guard && guard.stacks >= E.breakStacks && effectRank(g, 'Fighting').mastery) mult += E.comboBonus
    if (fx.spookedUntil > g.clock && effectRank(g, 'Bug').mastery) mult += E.swarmBonus
    // Haunt (Ghost's mastery): Execute starts higher, and an elite that low faints outright too.
    const ghost = effectRank(g, 'Ghost')
    const executes = procs.includes('Ghost') && foe.hp <= foe.maxHp * (ghost.mastery ? E.hauntLine : E.executeLine)
    if (executes) mult += E.executeBonus * ghost.potency
    if (foe.kind === 'boss' && procs.some((type) => HORDE_HOLD_TYPES.includes(type))) mult += HORDE_BOSS_HOLD_BONUS
    // Expert Belts: moves of the lead's own types land harder.
    if (stab) mult += heldOf(g, 'stab') / 100
    // Metronomes: more for each use since the lead was last hit.
    mult += (g.metronome * heldOf(g, 'metronome')) / 100
    // Relic Crowns, Pearl Strings and Quick Powders.
    const grown = growingDamage(g)
    mult += (grown.crown + grown.pearl + grown.powder) / 100
    // Muscle Bands: now and then a hit lands many times harder.
    if (Math.random() * 100 < heldOf(g, 'bigHit')) mult *= HORDE_MUSCLE_BAND_MULT
    if (g.flameUntil > g.clock) mult *= HORDE_FLAME_ORB_DAMAGE
    // The move's own twist.
    mult *= twistMult(g, known, foe)
    mult *= opts.share ?? 1
    dmg = Math.max(1, Math.floor(dmg * mult))
    if (
      executes &&
      ghost.bonus &&
      ((foe.kind === 'wild' && foe.hp <= foe.maxHp * E.executeKillLine) ||
        (ghost.mastery && foe.kind === 'elite' && foe.hp <= foe.maxHp * E.hauntEliteKillLine))
    )
      dmg = foe.hp
    // Reaper Cloths: now and then a wild Pokemon (an elite less often, never a boss) is knocked out
    // outright, and each one leaves the lead a little more Attack for good.
    const reap = heldOf(g, 'execute') * (foe.kind === 'elite' ? HORDE_REAPER_ELITE_SHARE : foe.kind === 'boss' ? 0 : 1)
    if (reap > 0 && dmg < foe.hp && Math.random() * 100 < reap) {
      dmg = foe.hp
      g.reaped++
      refreshStats(g, 0)
      twistPopup(g, foe.x, foe.y, t('horde.proc.reaped'), 'Ghost')
    }
    foe.lastHit = dmg
    g.damage[move.name] = (g.damage[move.name] ?? 0) + Math.min(foe.hp, dmg)
    bellHeal(g, Math.min(foe.hp, dmg))
    foe.hp -= Math.min(foe.hp, dmg)
    foe.flashUntil = g.now + 120
    addPopup(g, foe.x, foe.y, String(dmg), crit ? 'crit' : eff > 1 ? 'super' : eff < 1 ? 'weak' : 'hit')
    playHit(eff, 'horde')
    for (const type of procs) {
      if (type === 'Dark') effectPopup(g, foe.x, foe.y, 'Dark')
      else if (type !== 'Ghost' || executes) {
        const rank = effectRank(g, type)
        applyEffect(g, type, foe, dmg, rank.potency, rank.bonus)
      }
    }
    if (opts.effect !== false) hitTwist(g, known, foe, dmg)
    // King's Rocks: any hit may make the foe flinch, as a flinching move does.
    const rock = heldOf(g, 'flinch')
    if (rock > 0 && foe.kind !== 'boss' && foe.hp > 0 && foe.faintedAt === null && Math.random() * 100 < rock) {
      const share = foe.kind === 'elite' ? HORDE_ELITE_HOLD_SHARE : 1
      foe.cooldowns = foe.moves.map((m) => hordeMoveCooldown(m) * hordeFoeCooldownScale(g.elapsed) * share)
      hold(g, foe, HORDE_FLINCH_STOP_MS)
      twistPopup(g, foe.x, foe.y, t('horde.proc.flinch'), 'Normal')
    }
    heldOnHit(g, foe, dmg)
    if (foe.hp <= 0 && foe.faintedAt === null) {
      koTwist(g, known, foe)
      knockOut(g, foe)
    }
    return dmg
  }

  // What held items do on any hit of the lead's: Cell Batteries call lightning down on another foe
  // nearby, Never-Melt Ice freezes, Poison Barbs poison.
  function heldOnHit(g: Game, foe: Foe, dmg: number): void {
    if (Math.random() * 100 < heldOf(g, 'lightning')) {
      const near = nearestTo(g, foe, 3, HORDE_BATTERY_REACH)
      const target = near.length ? near[Math.floor(Math.random() * near.length)] : foe
      if (target.faintedAt === null) {
        g.flashes.push({ id: g.seq++, kind: 'bolt', anim: 'sky', x: target.x, y: target.y, dx: 0, dy: 0, type: 'Electric', born: g.now })
        damageFoe(g, target, dmg * HORDE_BATTERY_SHARE, 'hit')
      }
    }
    if (foe.faintedAt !== null || foe.hp <= 0) return
    if (Math.random() * 100 < heldOf(g, 'freezeHit')) {
      foe.fx.frozenUntil = Math.max(foe.fx.frozenUntil, g.clock + HORDE_ICE_FREEZE_MS * HORDE_FREEZE_SHARE[foe.kind])
      twistPopup(g, foe.x, foe.y, t('horde.proc.frozen'), 'Ice')
    }
    if (Math.random() * 100 < heldOf(g, 'poisonHit')) {
      const rank = effectRank(g, 'Poison')
      applyEffect(g, 'Poison', foe, dmg, rank.moves ? rank.potency : 1, rank.bonus)
    }
  }

  function hurtPlayer(g: Game, dmg: number, attacker?: Foe): void {
    // Mid-dash or vanished, nothing lands.
    if (g.safeUntil > g.clock) return
    // Bright Powders: now and then the hit misses outright.
    if (Math.random() < stackedChance(g, 'brightPowder')) {
      leadPopup(g, t('horde.dodged'), 'miss')
      return
    }
    // Eject Pack: a burst of speed for a moment after being hit.
    if (g.held.ejectPack) g.rushUntil = g.clock + HORDE_RUSH_MS
    // Rocky Helmets: whoever lands a hit loses a share of its own max HP (an elite less, a boss far less).
    const helmet = heldOf(g, 'helmet')
    if (attacker && helmet > 0 && attacker.faintedAt === null)
      damageFoe(g, attacker, (attacker.maxHp * helmet * HORDE_HELMET_SHARE[attacker.kind]) / 100, 'hit')
    // Metronome: being hit drops every stack.
    g.metronome = 0
    const hpBefore = g.hp
    // Fortress (Steel's mastery): while shielded, a share bounces back at the attacker.
    if (attacker && g.shield > 0 && effectRank(g, 'Steel').mastery) damageFoe(g, attacker, dmg * HORDE_EFFECT.fortressReflect, 'hit')
    // Iron Guard's bonus: less damage while shielded. The shield soaks up what it can first.
    if (g.shield > 0 && effectRank(g, 'Steel').bonus) dmg = Math.max(1, Math.round(dmg * (1 - HORDE_EFFECT.guardCut)))
    const soaked = Math.min(g.shield, dmg)
    g.shield -= soaked
    dmg -= soaked
    g.hp = Math.max(0, g.hp - dmg)
    g.hurtAt = g.now
    if (dmg > 0) g.hurtClock = g.clock
    leadPopup(g, `-${dmg}`, 'hurt')
    // A Focus Sash: the lead hangs on at 1 HP, nothing lands for a moment, and the sash is used up
    // (the next can't save it till the cooldown's over).
    if (g.hp <= 0 && (g.held.focusSash ?? 0) > 0 && g.clock >= g.sashReadyAt) {
      g.sashReadyAt = g.clock + HORDE_SASH_COOLDOWN_MS
      g.held.focusSash = (g.held.focusSash ?? 0) - 1
      if (!g.held.focusSash) delete g.held.focusSash
      g.hp = 1
      g.safeUntil = g.clock + HORDE_SASH_SAFE_MS
      twistPopup(g, g.px, g.py, t('horde.proc.sash'), 'Fighting')
    }
    // Eject Button: the first drop under the line knocks every foe nearby away (then it waits a while).
    const line = g.maxHp * HORDE_EJECT_LINE
    if (g.held.ejectButton && g.hp > 0 && hpBefore >= line && g.hp < line && g.clock >= g.ejectReadyAt) {
      g.ejectReadyAt = g.clock + HORDE_EJECT_EVERY_MS
      g.safeUntil = Math.max(g.safeUntil, g.clock + HORDE_EJECT_SAFE_MS)
      g.flashes.push({ id: g.seq++, kind: 'blast', x: g.px, y: g.py, dx: 0, dy: 0, type: 'Normal', born: g.now, reach: HORDE_EJECT_REACH })
      for (const foe of standingFoes(g))
        if (foe.kind !== 'boss' && awayOf(g, foe) <= HORDE_EJECT_REACH + HORDE_FOE_HITBOX[foe.kind])
          push(g, foe, HORDE_EJECT_PUSH * (foe.kind === 'elite' ? HORDE_ELITE_HOLD_SHARE : 1), false)
      twistPopup(g, g.px, g.py, t('horde.proc.eject'), 'Normal')
    }
    if (g.hp <= 0 && !g.outcome) g.outcome = 'fainted'
  }

  function foeAttack(g: Game, foe: Foe, move: HordeMove): void {
    const fx = foe.fx
    // Confused, it lashes out at the wild Pokemon nearest it instead.
    if (fx.confusedUntil > g.clock) {
      const other = nearestTo(g, foe, 1, 200)[0]
      if (!other) return
      g.bursts.push({
        id: g.seq++,
        x: other.x,
        y: other.y,
        type: move.type,
        spread: false,
        born: g.now
      })
      const hit = hordeDamage({
        level: foe.level,
        power: hordeMovePower(move),
        attack: foe.stats.atk,
        defense: other.stats.def,
        stab: foe.sp.types.includes(move.type),
        effectiveness: hordeEffectiveness(setup.typeChart, move.type, other.sp.types),
        spread: false,
        crit: false
      })
      // Mind Control (Psychic's mastery): it hits harder.
      damageFoe(g, other, hit * (effectRank(g, 'Psychic').mastery ? HORDE_EFFECT.mindControlDamage : 1), 'hit', false)
      return
    }
    const charm = fx.charm && fx.charm.until > g.clock ? fx.charm : null
    // Charm's bonus: a charmed foe sometimes can't bring itself to attack.
    if (charm && effectRank(g, 'Fairy').bonus && Math.random() < HORDE_EFFECT.charmSkip) {
      effectPopup(g, foe.x, foe.y, 'Fairy')
      return
    }
    const eff = hordeEffectiveness(setup.typeChart, move.type, leadForm(g).types)
    // The hit lands on the lead's side facing the attacker.
    const toward = awayFromLead(g, foe.x, foe.y)
    g.bursts.push({
      id: g.seq++,
      x: g.px + toward.dx * 20,
      y: g.py + toward.dy * 20,
      type: move.type,
      spread: false,
      born: g.now
    })
    const dmg = hordeDamage({
      level: foe.level,
      power: hordeFoeMovePower(move),
      attack: foe.stats.atk,
      defense: g.stats.def * (1 + leadMod(g, 'def')),
      stab: foe.sp.types.includes(move.type),
      effectiveness: eff,
      spread: false,
      crit: Math.random() * 100 < HORDE_CRIT_CHANCE
    })
    // Harder hits as the run goes on, lighter ones when charmed.
    const hit = dmg * hordeFoeAttackScale(g.elapsed) * (charm ? 1 - charm.cut : 1) * (1 - foeDropOf(fx, 'atk', g.clock))
    hurtPlayer(g, Math.max(1, Math.round(hit)), foe)
  }

  function step(g: Game, dt: number): void {
    // The clock holds at 0:00 while the final boss is fought; beating it starts endless mode.
    g.elapsed = g.endless ? g.elapsed + dt : Math.min(HORDE_DURATION_MS, g.elapsed + dt)
    g.clock += dt
    const E = HORDE_EFFECT
    // At 0:00 the final boss is out - beating it completes the run.
    if (!g.timeUp && g.elapsed >= HORDE_DURATION_MS) {
      g.timeUp = true
      leadPopup(g, t('horde.completedPopup'), 'level')
    }
    // No waves or elites while the final boss is fought.
    const bossFight = g.timeUp && !g.endless
    // Mega Evolution wears off.
    if (g.megaForm && g.clock >= g.megaUntil) {
      g.megaForm = null
      refreshStats(g, 0)
      leadPopup(g, t('horde.megaEnded'), 'level')
    }
    // Minior breaks into its Core below half HP, and is a Meteor again once healed to half.
    if (setup.coreForm) {
      const core = g.hp < g.maxHp / 2
      if (core !== (g.altForm === setup.coreForm)) {
        g.altForm = core ? setup.coreForm : null
        refreshStats(g, 0)
        leadPopup(g, t(core ? 'horde.coreOut' : 'horde.shellBack'), 'level')
      }
    }
    // Ditto turns into one of the wild Pokemon about for a while, then back, over and over.
    if (setup.transforms && g.clock >= g.nextShiftAt) {
      if (g.altForm) {
        g.altForm = null
        g.nextShiftAt = g.clock + HORDE_DITTO_REST_MS
        leadPopup(g, t('horde.transformEnded'), 'level')
      } else {
        // From level 20, an elite or boss on the field if there is one.
        const big = g.level >= HORDE_DITTO_BIG_LEVEL ? g.foes.filter((f) => f.faintedAt === null && f.kind !== 'wild') : []
        const wild = setup.pools[hordePoolIndex(g.elapsed, setup.pools.length)]
        g.altForm = big.length ? big[Math.floor(Math.random() * big.length)].sp : wild[Math.floor(Math.random() * wild.length)]
        g.nextShiftAt = g.clock + HORDE_DITTO_TRANSFORM_MS
        leadPopup(g, t('horde.transformed', { name: g.altForm.species }), 'level')
      }
      refreshStats(g, 0)
    }

    // Bosses, elites and waves.
    // Elites and bosses come from off the screen's corner furthest from the lead; each wave
    // rises out of the ground together on one side of it, a different side at random each time.
    while (g.bossesSpawned < HORDE_BOSS_TIMES_MS.length && g.elapsed >= HORDE_BOSS_TIMES_MS[g.bossesSpawned]) {
      spawnFoe(g, 'boss', g.bossesSpawned === HORDE_BOSS_TIMES_MS.length - 1, farPoint(g))
      g.bossesSpawned++
    }
    // In endless mode bosses every 5 minutes, one more each time (2, then 3, 4...), every other time one of them a big one.
    if (g.endless && g.elapsed >= g.nextEndlessBossAt) {
      g.endlessBosses++
      for (let i = 0; i <= g.endlessBosses; i++) spawnFoe(g, 'boss', false, farPoint(g), i === 0 && g.endlessBosses % 2 === 0)
      g.nextEndlessBossAt += HORDE_ENDLESS_BOSS_EVERY_MS
    }
    if (!bossFight && g.elapsed >= g.nextEliteAt) {
      // More of them as the run goes on (see hordeEliteCount).
      if (!HORDE_BOSS_TIMES_MS.includes(g.nextEliteAt))
        for (let i = hordeEliteCount(g.elapsed); i > 0; i--) spawnFoe(g, 'elite', false, farPoint(g))
      g.nextEliteAt += HORDE_ELITE_EVERY_MS
    }
    if (!bossFight && g.elapsed >= g.nextWaveAt) {
      const wave = hordeWave(g.elapsed)
      const room = hordeMaxFoes(g.elapsed) - g.foes.filter((f) => f.faintedAt === null).length
      const side = Math.random() * Math.PI * 2
      // In endless mode more and more of them come as elites.
      const eliteShare = hordeWaveEliteShare(g.elapsed)
      // Now and then a horde of exploders comes instead.
      if (setup.exploders?.length && Math.random() < HORDE_EXPLODER_CHANCE) spawnExploders(g, room)
      else
        for (let i = 0; i < Math.min(room, wave.size); i++) {
          const at = risePoint(g, side + (Math.random() - 0.5) * WAVE_SPREAD)
          if (Math.random() < eliteShare) spawnFoe(g, 'elite', false, at, false, true)
          else spawnFoe(g, 'wild', false, at)
        }
      g.nextWaveAt += wave.intervalMs
    }

    // A dash is over once the sprite is back (out and back again).
    if (g.dash && g.clock - g.dash.start >= HORDE_DASH_MS * 2) g.dash = null
    // Vanished, it comes up under its foe (or the nearest, if that one's gone) and hits it.
    if (g.burrow && g.clock >= g.burrow.until) {
      const b = g.burrow
      g.burrow = null
      const on = hittable(g)
      const foe = on.find((f) => f.id === b.targetId) ?? on.sort((x, y) => awayOf(g, x) - awayOf(g, y))[0]
      if (foe && g.known.includes(b.known) && !g.outcome) {
        const away = awayFromLead(g, foe.x, foe.y)
        const at = clampToWorld(g, foe.x - away.dx * (HORDE_LEAD_HITBOX + HORDE_FOE_HITBOX[foe.kind]), foe.y - away.dy * (HORDE_LEAD_HITBOX + HORDE_FOE_HITBOX[foe.kind]), PLAYER_MARGIN)
        g.px = at.x
        g.py = at.y
        meleeHit(g, b.known, foe)
        landingFlash(g, b.known, foe)
        g.lastMove = { name: b.known.move.name, type: b.known.move.type, at: g.now }
      }
    }

    // The lead walks where it's steered: the keys, or else toward a held pointer.
    let mx = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0)
    let my = (keys.has('down') ? 1 : 0) - (keys.has('up') ? 1 : 0)
    // The Choice Scarf, and the Eject Pack's rush after being hit.
    const scarf = (g.scarfUntil > g.clock ? HORDE_SCARF_WALK : 1) * (g.rushUntil > g.clock ? 1 + heldOf(g, 'hurtRush') / 100 : 1)
    const walkStep = (HORDE_PLAYER_WALK * leadWalk(g) * scarf * dt) / 1000
    let reach = walkStep
    if (!mx && !my && pointer.current) {
      mx = g.camX + pointer.current.x - g.px
      my = g.camY + pointer.current.y - g.py
      // Stop on the spot rather than jitter around it.
      reach = Math.min(walkStep, Math.hypot(mx, my))
    }
    const len = Math.hypot(mx, my)
    // Mid-dash or underground, it can't walk; Momentum counts how long it's kept walking.
    if (len > 0.5 && !g.burrow) {
      const at = clampToWorld(g, g.px + (mx / len) * reach, g.py + (my / len) * reach, PLAYER_MARGIN)
      g.px = at.x
      g.py = at.y
      if (Math.abs(mx) > 0.5) g.facing = mx > 0 ? 1 : -1
      g.walkMs += dt
    } else g.walkMs = 0
    followLead(g)

    // Another chest turns up every so often all run long, somewhere around the lead,
    // while the field holds fewer than the most it can.
    if (g.clock >= g.nextChestAt) {
      g.nextChestAt = g.clock + HORDE_CHEST_EVERY_MS
      if (g.chests.length < HORDE_MOST_CHESTS) placeChests(g, 1)
    }

    // One more shrine of each kind every 5 minutes, all run long.
    if (g.clock >= g.nextShrineAt) {
      g.nextShrineAt += HORDE_SHRINE_EVERY_MS
      placeShrines(g, 1)
    }
    // Totem Trials whose callers are all down are done; Tapu Ruins fill while the lead stands in
    // them (waking their defenders the first time) and slowly drain while it's out.
    for (const shrine of [...g.shrines]) {
      if (shrine.kind === 'totem') {
        if (shrine.started && !g.foes.some((f) => f.shrine === shrine.id && f.faintedAt === null)) finishTotem(g, shrine)
      } else if (dist(shrine.x, shrine.y, g.px, g.py) <= HORDE_TAPU_RADIUS) {
        if (!shrine.started) wakeTapu(g, shrine)
        shrine.heldMs += dt
        if (shrine.heldMs >= HORDE_TAPU_HOLD_MS) finishTapu(g, shrine)
      } else shrine.heldMs = Math.max(0, shrine.heldMs - dt * HORDE_TAPU_DRAIN)
    }

    // Damage over time, once a second: burns, poison and Stealth Rock.
    if (g.clock >= g.nextTickAt) {
      g.nextTickAt += 1000
      // Regenerator and Leftovers: a little HP back every second, once a moment has passed since the last hit.
      const regen = bonusOf(g, 'regen')
      if (regen > 0 && g.hp > 0 && g.hp < g.maxHp && g.clock - g.hurtClock >= HORDE_REGEN_DELAY_MS) g.hp = Math.min(g.maxHp, g.hp + Math.max(1, Math.round((g.maxHp * regen) / 100)))
      // A burn on the lead (Overheat): a share of its max HP every second, never fainting from it.
      if (g.leadBurn && g.leadBurn.until > g.clock && g.hp > 1) {
        const hurt = Math.min(g.leadBurn.hurt, g.hp - 1)
        g.hp -= hurt
        leadPopup(g, `-${hurt}`, 'hurt')
      }
      g.rocks = keep(g.rocks, (r) => r.until > g.clock)
      const toxic = effectRank(g, 'Poison').bonus
      for (const foe of standingFoes(g)) {
        const fx = foe.fx
        let dot = 0
        if (fx.burn && fx.burn.until > g.clock) dot += fx.burn.dps
        fx.poison = fx.poison.filter((p) => p.until > g.clock)
        for (const p of fx.poison) dot += p.dps * (toxic ? 1 + (E.toxicGrowth * (g.clock - p.from)) / 1000 : 1)
        for (const rock of g.rocks) if (dist(rock.x, rock.y, foe.x, foe.y) <= E.rockReach) dot += rock.dps
        if (dot > 0) damageFoe(g, foe, dot)
        // Ground moves left behind, each counting toward its move.
        for (const z of g.zones)
          if (z.dps > 0 && z.until > g.clock && dist(z.x, z.y, foe.x, foe.y) <= z.reach + HORDE_FOE_HITBOX[foe.kind])
            damageFoe(g, foe, z.dps, 'dot', true, z.known.move.name)
      }
    }

    // Chasing: each walks straight at the lead and stops once their hitboxes overlap a little.
    // A spooked foe flees away from it instead; a held, frozen or confused one stands still.
    const windSlow = g.tailwind && g.tailwind.until > g.clock && effectRank(g, 'Flying').bonus ? E.tailwindFoeSlow : 0
    const rocksSlow = effectRank(g, 'Rock').bonus
    const bug = effectRank(g, 'Bug')
    const standing = standingFoes(g)
    for (const foe of standing) {
      const fx = foe.fx
      const away = awayFromLead(g, foe.x, foe.y)
      if (foe.slide) {
        // Washed back: it slides the rest of the way before it can walk again.
        const glide = Math.min(foe.slide.left, (SLIDE_SPEED * dt) / 1000)
        foe.x += foe.slide.dx * glide
        foe.y += foe.slide.dy * glide
        foe.slide.left -= glide
        if (foe.slide.left <= 0.5) foe.slide = null
        keepNear(g, foe)
      } else if (fx.spookedUntil > g.clock) {
        foe.x += (away.dx * foe.walk * dt) / 1000
        foe.y += (away.dy * foe.walk * dt) / 1000
        keepNear(g, foe)
        // Swarm (Bug's mastery): it spooks those it runs into (who don't pass it on; bosses shrug it off).
        if (bug.mastery && !fx.spookCaught)
          for (const other of standing) {
            if (other === foe || other.kind === 'boss' || other.fx.spookedUntil > g.clock) continue
            if (dist(other.x, other.y, foe.x, foe.y) > E.swarmReach + HORDE_FOE_HITBOX[other.kind]) continue
            other.fx.spookedUntil = g.clock + E.spookMs * bug.potency * (other.kind === 'elite' ? HORDE_ELITE_HOLD_SHARE : 1)
            other.fx.spookCaught = true
          }
      } else {
        const held =
          fx.stopUntil > g.clock || fx.frozenUntil > g.clock || fx.confusedUntil > g.clock || foe.fuseAt !== undefined
        const onRock = rocksSlow && g.rocks.some((r) => dist(r.x, r.y, foe.x, foe.y) <= E.rockReach)
        const pace = held ? 0 : foePace(g, foe) * (1 - windSlow) * (onRock ? 1 - E.rockSlow : 1) * bossRamp(g, foe).walk
        const gap = dist(foe.x, foe.y, g.px, g.py) - (HORDE_LEAD_HITBOX + HORDE_FOE_HITBOX[foe.kind] - HORDE_HITBOX_OVERLAP)
        const stride = Math.min(Math.max(0, gap), (foe.walk * pace * dt) / 1000)
        foe.x -= away.dx * stride
        foe.y -= away.dy * stride
      }
    }
    // Avalanche (Rock's mastery): a foe first stepping on rocks takes a burst.
    if (effectRank(g, 'Rock').mastery)
      for (const rock of g.rocks) {
        if (rock.until <= g.clock) continue
        rock.hit ??= []
        for (const foe of standing) {
          if (foe.faintedAt !== null || rock.hit.includes(foe.id) || dist(rock.x, rock.y, foe.x, foe.y) > E.rockReach) continue
          rock.hit.push(foe.id)
          damageFoe(g, foe, rock.dps * E.avalancheBurst, 'hit')
        }
      }
    // Tidal Wave (Water's mastery): a wave rolls out from the lead every so often, as the strongest Water move.
    const water = effectRank(g, 'Water')
    if (water.mastery && g.clock >= g.nextTideAt && !g.outcome) {
      g.nextTideAt = g.clock + E.tideEveryMs
      const tidal = g.known
        .filter((k) => k.move.type === 'Water')
        .reduce<KnownMove | null>((best, k) => (!best || hordeMovePower(k.move, k.power) > hordeMovePower(best.move, best.power) ? k : best), null)
      if (tidal) g.waves.push({ id: g.seq++, known: tidal, born: g.clock, share: E.tideShare, follow: true, tide: true })
    }
    // Gale (Flying's mastery): while Tailwind blows, a gust knocks back the foes close to the lead now and then.
    if (g.tailwind && g.tailwind.until > g.clock && effectRank(g, 'Flying').mastery && g.clock >= g.nextGaleAt) {
      g.nextGaleAt = g.clock + E.galeEveryMs
      g.flashes.push({ id: g.seq++, kind: 'blast', x: g.px, y: g.py, dx: 0, dy: 0, type: 'Flying', born: g.now, reach: E.galeReach })
      for (const foe of standing)
        if (foe.faintedAt === null && foe.kind !== 'boss' && awayOf(g, foe) <= E.galeReach + HORDE_FOE_HITBOX[foe.kind])
          push(g, foe, E.galePush * (foe.kind === 'elite' ? HORDE_ELITE_HOLD_SHARE : 1), false)
    }
    // Then they shoulder each other apart so a crowd doesn't pile onto one spot (nothing shifts a boss).
    for (let i = 0; i < standing.length; i++) {
      for (let j = i + 1; j < standing.length; j++) {
        const a = standing[i]
        const b = standing[j]
        const spacing = a.kind === 'boss' || b.kind === 'boss' ? HORDE_BOSS_SPACING : HORDE_FOE_SPACING
        let d = dist(a.x, a.y, b.x, b.y)
        if (d >= spacing) continue
        let nx = (b.x - a.x) / d
        let ny = (b.y - a.y) / d
        if (d < 0.01) {
          const angle = Math.random() * Math.PI * 2
          nx = Math.cos(angle)
          ny = Math.sin(angle)
          d = 0
        }
        const overlap = spacing - d
        const aShare = a.kind === 'boss' ? 0 : b.kind === 'boss' ? 1 : 0.5
        a.x -= nx * overlap * aShare
        a.y -= ny * overlap * aShare
        b.x += nx * overlap * (1 - aShare)
        b.y += ny * overlap * (1 - aShare)
      }
    }
    // A wild Pokemon or a boss left far behind rises again near the lead (elites keep chasing).
    for (const foe of standing) {
      if (foe.kind === 'elite' || foe.fuseAt !== undefined || dist(foe.x, foe.y, g.px, g.py) <= HORDE_FOE_LEASH * HORDE_ARENA_HEIGHT) continue
      const at = risePoint(g)
      foe.x = at.x
      foe.y = at.y
      foe.slide = null
      foe.risingUntil = g.clock + HORDE_RISE_MS
      foe.riseMs = undefined
    }
    // Close enough to attack: its hitbox touching the lead's.
    for (const foe of standing) {
      keepNear(g, foe)
      foe.stopped = dist(foe.x, foe.y, g.px, g.py) <= HORDE_LEAD_HITBOX + HORDE_FOE_HITBOX[foe.kind]
      // An exploder that's reached the lead lights its fuse and stands still.
      if (foe.exploder && foe.stopped && foe.fuseAt === undefined) foe.fuseAt = g.clock + HORDE_EXPLODER_FUSE_MS
    }

    // Ground left behind: it goes once it's had its time. A whirlwind wanders toward the nearest
    // foe and drags those about it in (not bosses).
    g.zones = keep(g.zones, (z) => z.until > g.clock)
    for (const z of g.zones) {
      if (z.drift) {
        const target = standing.filter((f) => dist(f.x, f.y, z.x, z.y) < 500).sort((a, b) => dist(a.x, a.y, z.x, z.y) - dist(b.x, b.y, z.x, z.y))[0]
        if (target) {
          const d = Math.max(1, dist(target.x, target.y, z.x, z.y))
          z.dx = z.dx * 0.9 + ((target.x - z.x) / d) * 0.1
          z.dy = z.dy * 0.9 + ((target.y - z.y) / d) * 0.1
          const n = Math.hypot(z.dx, z.dy) || 1
          z.dx /= n
          z.dy /= n
        }
        const at = clampToWorld(g, z.x + (z.dx * HORDE_ZONE_DRIFT * dt) / 1000, z.y + (z.dy * HORDE_ZONE_DRIFT * dt) / 1000, PLAYER_MARGIN)
        z.x = at.x
        z.y = at.y
      }
      if (z.pull > 0)
        for (const foe of standing) {
          if (foe.kind === 'boss' || foe.faintedAt !== null) continue
          const d = dist(foe.x, foe.y, z.x, z.y)
          if (d < 8 || d > z.reach * 1.8) continue
          const step = Math.min(d - 8, (z.pull * dt) / 1000)
          foe.x += ((z.x - foe.x) / d) * step
          foe.y += ((z.y - foe.y) / d) * step
        }
    }
    // Orbiting balls hit what they touch, each foe once in a while.
    if (g.orbs.length) {
      g.orbs = g.orbs.filter((o) => o.until > g.clock && g.known.includes(o.known))
      const on = hittable(g)
      for (const orb of g.orbs) {
        for (const at of orbSpots(g, orb)) {
          for (const foe of on) {
            if (g.outcome || foe.faintedAt !== null) continue
            if (dist(at.x, at.y, foe.x, foe.y - BODY_HEIGHT) > HORDE_ORBIT.size + HORDE_FOE_HITBOX[foe.kind]) continue
            if (g.clock - (orb.hits[foe.id] ?? -Infinity) < HORDE_ORBIT.hitEveryMs) continue
            orb.hits[foe.id] = g.clock
            strike(g, orb.known, foe, true)
          }
        }
      }
    }

    // The lead's moves - quicker while Tailwind blows, Booster Energy lasts or it's Mega Evolved (Speed only makes it walk faster).
    const tailwind = g.tailwind && g.tailwind.until > g.clock ? g.tailwind.speed : 0
    const booster = g.boosterUntil > g.clock ? HORDE_BOOSTER_SPEED : 0
    const mega = g.megaForm ? HORDE_MEGA_SPEED : 0
    // Moves raising or lowering its Speed change how fast they come round too, and so does a rampage's tiredness.
    const fatigue = g.fatigue && g.fatigue.until > g.clock ? g.fatigue.amount : 0
    const speed = (1 + tailwind) * (1 + booster) * (1 + mega) * (1 + leadMod(g, 'spe')) * (1 - fatigue)
    // Hyper Beam's recharge slows every move but itself.
    const exhaust = g.exhaust && g.exhaust.until > g.clock ? g.exhaust : null
    g.known.forEach((known, i) => {
      // A rampage over: the lead tires, and the move comes round as usual from here.
      if (known.rampUntil !== undefined && g.clock >= known.rampUntil) {
        const tr = traitOf(known)
        known.rampUntil = undefined
        if (tr.kind === 'rampage' && amuletShare(g) < 1) {
          g.fatigue = { amount: tr.fatigue * (1 - amuletShare(g)), until: g.clock + tr.fatigueMs }
          twistPopup(g, g.px, g.py, t('horde.proc.fatigue'), known.move.type)
        }
        g.cooldowns[i] = leadCooldown(g, known)
      }
      const tired = exhaust && exhaust.moveId !== known.move.id ? 1 - exhaust.amount : 1
      g.cooldowns[i] = Math.max(0, g.cooldowns[i] - dt * speed * tired)
      if (g.cooldowns[i] === 0 && !g.outcome && playerAttack(g, known)) {
        // Rampaging, it goes off again and again.
        const tr = traitOf(known)
        g.cooldowns[i] = tr.kind === 'rampage' && known.rampUntil !== undefined && known.rampUntil > g.clock ? tr.everyMs : leadCooldown(g, known)
        // Multi-shot makes a melee or piercing move (or Tri Attack) go off again, once more per pick, in a quick run.
        if (hordeRepeatsOnMulti(known.move))
          for (let n = 1; n <= g.multi * HORDE_MULTI_TARGETS; n++) g.repeats.push({ known, at: g.clock + n * HORDE_MULTI_REPEAT_MS })
      }
    })
    // A repeat with nothing to hit (no foe in a melee move's reach) is simply lost.
    const dueRepeats = g.repeats.filter((r) => r.at <= g.clock)
    if (dueRepeats.length) {
      g.repeats = g.repeats.filter((r) => r.at > g.clock)
      for (const r of dueRepeats) if (!g.outcome && g.known.includes(r.known)) playerAttack(g, r.known, HORDE_MULTI_REPEAT_SHARE)
    }

    // Moves on their way. A shot flies at its target (or, if that's fainted, straight on
    // until it runs into another foe or leaves the screen) and hits on arriving - a blast hitting everyone close by too; a piercing shot
    // flies straight on, hitting each foe it passes; a spread wave hits everyone in the ring
    // once fully out; a stream hits everything in it each pulse; a strike lands on its foe.
    const S = HORDE_SHAPES
    const flight = (HORDE_PROJECTILE_SPEED * dt) / 1000
    // Worked out once a frame for every shot, not once per shot: the foes by id, and the
    // on-screen foes a shot can run into. A foe can still faint partway through, so each
    // use checks it's standing.
    const foeById = new Map(g.foes.map((f) => [f.id, f]))
    let onScreenFoes: Foe[] | null = null
    // A shot landing on a foe: a blast hits everyone close by too.
    const land = (shot: Shot, target: Foe): void => {
      if (g.outcome) return
      const many = hordeHitsMany(shot.known.move)
      const tr = traitOf(shot.known)
      if (shot.blast) {
        const reach = S.blastReach * reachScale(shot.known) * (tr.kind === 'bigBlast' ? 1 + tr.bonus / 100 : 1)
        const caught = nearestTo(g, target, Infinity, reach)
        g.flashes.push({ id: g.seq++, kind: 'blast', x: target.x, y: target.y, dx: 0, dy: 0, type: shot.known.move.type, born: g.now, reach })
        let best = strike(g, shot.known, target, many)
        for (const foe of caught) best = Math.max(best, strike(g, shot.known, foe, many))
        if (tr.kind === 'zone') addZone(g, shot.known, target.x, target.y, tr.reach * reachScale(shot.known), best * tr.share, tr.ms, tr)
        // Fire Blast: the blast bursts into small streams in a star, as long and wide as the blast is big.
        if (tr.kind === 'starStreams') {
          const turn = Math.random() * Math.PI * 2
          for (let i = 0; i < tr.count; i++) {
            const angle = turn + (i / tr.count) * Math.PI * 2
            g.beams.push({
              id: g.seq++,
              known: shot.known,
              dx: Math.cos(angle),
              dy: Math.sin(angle),
              born: g.clock,
              pulses: 0,
              hit: new Set(),
              from: { x: target.x, y: target.y },
              length: reach * tr.length,
              width: (S.beamWidth / 2) * (reach / S.blastReach),
              part: tr.part
            })
          }
        }
      } else strike(g, shot.known, target, many, { share: shot.share })
      const from = { x: target.x, y: target.y - BODY_HEIGHT }
      // Hopping on to the next foe nearby it hasn't hit.
      // A scatter shot's bounces each hit for a share of the first shot (not a share of a share).
      const scatter = hordeMoveShape(shot.known.move) === 'scatter'
      const bounceShare = scatter ? Math.max(HORDE_SCATTER_BOUNCE_SHARE, tr.kind === 'bounce' ? tr.share : 0) : undefined
      let bounced = false
      if ((tr.kind === 'bounce' || scatter) && (shot.bounces ?? 0) > 0) {
        const hit = [...(shot.hitIds ?? []), target.id]
        const next = nearestTo(g, target, Infinity, HORDE_HOP_REACH).find((f) => !hit.includes(f.id) && onScreen(g, f))
        const share = bounceShare === undefined ? (shot.share ?? 1) * (tr.kind === 'bounce' ? tr.share : 1) : shot.hitIds ? (shot.share ?? 1) : (shot.share ?? 1) * bounceShare
        if (next) {
          g.shots.push({ id: g.seq++, ...from, targetId: next.id, known: shot.known, small: shot.small, share, bounces: (shot.bounces ?? 1) - 1, hitIds: hit })
          // A ring popping off the foe it bounced from, so the hop reads at a glance.
          g.flashes.push({ id: g.seq++, kind: 'hop', x: from.x, y: from.y, dx: 0, dy: 0, type: shot.known.move.type, born: g.now })
          bounced = true
        }
      }
      // Splitting into smaller shots at the foes nearby.
      if (tr.kind === 'split' && !shot.child && shot.known.upgrades >= tr.upgrades)
        for (const other of nearestTo(g, target, tr.shots, HORDE_HOP_REACH))
          g.shots.push({ id: g.seq++, ...from, targetId: other.id, known: shot.known, small: true, child: true, share: (shot.share ?? 1) * tr.share })
      // A boomerang flies on past its target the way it was going, then turns and flies back
      // to the lead - through every foe in its way, each way (its target too, on the way back). One
      // that bounces only does so from the last foe it bounces to, as strong as the first shot.
      if (tr.kind === 'boomerang' && !shot.child && !bounced) {
        const on = shot.heading ?? awayFromLead(g, target.x, target.y)
        const firstShare = shot.hitIds && bounceShare ? (shot.share ?? 1) / bounceShare : (shot.share ?? 1)
        g.shots.push({
          id: g.seq++,
          ...from,
          targetId: target.id,
          known: shot.known,
          small: true,
          child: true,
          outLeft: HORDE_BOOMERANG_OUT,
          share: firstShare * tr.share,
          pierce: { dx: on.dx, dy: on.dy, size: 1, hit: new Set([target.id]) }
        })
      }
    }
    // Shots a landing sets off (a bounce, a split, a boomerang) are added on to g.shots while it's
    // being gone through - kept apart here and put back after, so they aren't dropped.
    const flying = g.shots
    const flyingCount = flying.length
    g.shots = flying.filter((shot) => {
      if (shot.pierce) {
        const p = shot.pierce
        // A boomerang going on past its target: once it's gone far enough it turns, free to hit everyone again.
        if (shot.outLeft !== undefined && !shot.returning) {
          shot.outLeft -= flight
          if (shot.outLeft <= 0) {
            shot.returning = true
            p.hit.clear()
          }
        }
        if (shot.returning) {
          // Homing in on the lead, and gone once it's back.
          const home = dist(shot.x, shot.y, g.px, g.py - BODY_HEIGHT)
          if (home <= Math.max(ARRIVE_REACH * 2, flight)) return false
          p.dx = (g.px - shot.x) / home
          p.dy = (g.py - BODY_HEIGHT - shot.y) / home
        }
        shot.x += p.dx * flight
        shot.y += p.dy * flight
        onScreenFoes ??= hittable(g)
        for (const foe of onScreenFoes) {
          if (foe.faintedAt !== null || p.hit.has(foe.id)) continue
          if (dist(shot.x, shot.y, foe.x, foe.y - BODY_HEIGHT) > ARRIVE_REACH * p.size + HORDE_FOE_HITBOX[foe.kind]) continue
          p.hit.add(foe.id)
          if (!g.outcome) strike(g, shot.known, foe, true, { share: shot.share })
          // Power Gem: stronger with each foe it passes.
          const tr = traitOf(shot.known)
          if (tr.kind === 'pierceGrow') shot.share = (shot.share ?? 1) * (1 + tr.per / 100)
        }
        return onScreen(g, shot)
      }
      const target = foeById.get(shot.targetId)
      if (target && target.faintedAt === null) {
        const tx = target.x
        const ty = target.y - BODY_HEIGHT
        const d = dist(shot.x, shot.y, tx, ty)
        if (d <= Math.max(ARRIVE_REACH, flight)) {
          land(shot, target)
          return false
        }
        shot.heading = { dx: (tx - shot.x) / d, dy: (ty - shot.y) / d }
        shot.x += shot.heading.dx * flight
        shot.y += shot.heading.dy * flight
        return true
      }
      // Its target fainted: it flies straight on and lands on the first foe it runs into.
      if (!shot.heading) {
        // Fainted before the shot first moved - it heads for where that foe fell.
        if (!target) return false
        const d = dist(shot.x, shot.y, target.x, target.y - BODY_HEIGHT)
        if (!d) return false
        shot.heading = { dx: (target.x - shot.x) / d, dy: (target.y - BODY_HEIGHT - shot.y) / d }
      }
      shot.x += shot.heading.dx * flight
      shot.y += shot.heading.dy * flight
      onScreenFoes ??= hittable(g)
      for (const foe of onScreenFoes) {
        if (foe.faintedAt !== null) continue
        if (dist(shot.x, shot.y, foe.x, foe.y - BODY_HEIGHT) > ARRIVE_REACH + HORDE_FOE_HITBOX[foe.kind]) continue
        land(shot, foe)
        return false
      }
      return onScreen(g, shot)
    })
    if (flying.length > flyingCount) g.shots.push(...flying.slice(flyingCount))
    g.waves = g.waves.filter((wave) => {
      if (g.clock - wave.born < HORDE_SPREAD_WAVE_MS) return true
      if (g.outcome) return false
      // Tidal Wave: everyone in the ring hit and washed away - no twists, no effects.
      if (wave.tide) {
        const water = effectRank(g, 'Water')
        for (const foe of inRing(g)) {
          strike(g, wave.known, foe, true, { share: wave.share, effect: false })
          if (foe.faintedAt === null && foe.kind !== 'boss')
            push(g, foe, HORDE_EFFECT.pushDistance * water.potency * (foe.kind === 'elite' ? HORDE_ELITE_HOLD_SHARE : 1), water.bonus)
        }
        return false
      }
      const tr = traitOf(wave.known)
      let best = 0
      for (const foe of inRing(g, wave.reach ?? 1)) best = Math.max(best, strike(g, wave.known, foe, true, { share: wave.share }))
      // A second, wider wave after a moment.
      if (tr.kind === 'aftershock' && !wave.follow)
        g.waves.push({ id: g.seq++, known: wave.known, born: g.clock + tr.delayMs, reach: (wave.reach ?? 1) * tr.reach, share: tr.share, follow: true })
      // Ground left round the lead, stretched as far as the wave itself is (Range and every wave move's reach upgrades).
      if (tr.kind === 'zone' && best > 0)
        addZone(g, wave.known, g.px, g.py, tr.reach * (spreadRadius(g) / HORDE_SPREAD_RADIUS), best * tr.share, tr.ms, tr)
      return false
    })
    g.beams = g.beams.filter((beam) => {
      // Each pulse lands its share of the stream's run (a part-stream runs only its share of the pulses, no type effect).
      const part = beam.part ?? 1
      const pulses = Math.max(1, Math.round(S.beamPulses * part))
      const runMs = S.beamMs * part
      const due = Math.min(pulses, Math.floor(((g.clock - beam.born) / runMs) * pulses) + 1)
      while (beam.pulses < due && !g.outcome) {
        beam.pulses++
        const length = beam.length ?? S.beamLength * reachScale(beam.known) * ownReach(beam.known)
        const width = beam.width ?? S.beamWidth * beamWidthScale(beam.known)
        for (const foe of inBeam(g, beam.dx, beam.dy, length, width, beam.from)) {
          const first = !beam.hit.has(foe.id)
          beam.hit.add(foe.id)
          const dmg = strike(g, beam.known, foe, true, { share: S.beamPulseShare, effect: first && !beam.from })
          beam.best = Math.max(beam.best ?? 0, dmg)
          // A freezing stream rolls on every pulse, not just the first.
          if (!first && traitOf(beam.known).kind === 'freeze') hitTwist(g, beam.known, foe, dmg)
        }
      }
      const going = g.clock - beam.born < runMs
      // Done: it leaves its ground along where it poured.
      const tr = traitOf(beam.known)
      if (!going && tr.kind === 'zone' && (beam.best ?? 0) > 0 && !g.outcome) {
        const length = S.beamLength * reachScale(beam.known) * ownReach(beam.known)
        for (let i = 1; i <= 3; i++)
          addZone(g, beam.known, g.px + beam.dx * length * (i / 3.4), g.py + beam.dy * length * (i / 3.4), tr.reach * beamWidthScale(beam.known), (beam.best ?? 0) / S.beamPulseShare * tr.share, tr.ms, tr)
      }
      return going
    })
    const storm: Strike[] = []
    g.strikes = g.strikes.filter((s) => {
      if (g.clock < s.landsAt) return true
      if (g.outcome) return false
      const on = hittable(g)
      const nearestOn = (): Foe | null => (on.length ? on.reduce((best, f) => (awayOf(g, f) < awayOf(g, best) ? f : best)) : null)
      const target = on.find((f) => f.id === s.targetId) ?? (s.many ? (on.length ? pick(on) : null) : nearestOn())
      if (!target) return false
      if (!landingFlash(g, s.known, target))
        g.flashes.push({ id: g.seq++, kind: 'strike', x: target.x, y: target.y, dx: 0, dy: 0, type: s.known.move.type, born: g.now })
      strike(g, s.known, target, s.many, { share: s.share })
      // A storm: more strikes on random foes over the next moment.
      const tr = traitOf(s.known)
      if (tr.kind === 'storm' && !s.follow)
        for (let i = 1; i <= tr.count; i++)
          storm.push({
            id: g.seq++,
            targetId: pick(on).id,
            known: s.known,
            many: false,
            landsAt: g.clock + (tr.ms * i) / tr.count,
            share: (s.share ?? 1) * tr.share,
            follow: true,
            fallMs: s.fallMs
          })
      return false
    })
    g.strikes.push(...storm)

    if (g.clock >= g.nextGatherAt) {
      g.nextGatherAt = g.clock + EXP_GATHER_EVERY_MS
      gatherExp(g)
    }
    // Experience and items on the ground: picked up once inside the pickup range, then pulled in.
    const pickupReach = pickupRange(g)
    const pull = (HORDE_PICKUP_PULL * dt) / 1000
    g.drops = g.drops.filter((drop) => {
      // An item left lying a minute is gone - all but a chest, which waits to be picked up.
      if (drop.item && drop.item !== 'chest' && !drop.pulled && g.clock - drop.born >= HORDE_ITEM_LIFESPAN_MS) return false
      const d = dist(drop.x, drop.y, g.px, g.py)
      if (!drop.pulled && d <= pickupReach) drop.pulled = true
      if (!drop.pulled) return true
      // With the pull-in switched off, experience is taken where it lies.
      if (d <= Math.max(ARRIVE_REACH, pull) || (!drop.item && !pullExp.current)) {
        if (drop.item) useItem(g, drop.item)
        else if (drop.mega) gainMegaEnergy(g, drop.exp * HORDE_MEGA_ENERGY_SHARE)
        else gainExp(g, drop.exp, drop.shrine)
        return false
      }
      drop.x += ((g.px - drop.x) / d) * pull
      drop.y += ((g.py - drop.y) / d) * pull
      return true
    })

    // The wild Pokemon's moves, once they've reached the lead - quicker as the clock runs.
    // A confused one attacks from wherever it stands (at its neighbours); a held, frozen or
    // fleeing one can't attack, and slows hold its attacks back as much as its walking.
    // Their moves keep coming round while they're out of reach, so one hits the moment its hitbox
    // touches the lead's - only its next move, though: the rest wait at half their cooldown till then.
    const foeScale = hordeFoeCooldownScale(g.elapsed)
    for (const foe of g.foes) {
      if (foe.faintedAt !== null || !risen(g, foe) || g.outcome || foe.exploder) continue
      const fx = foe.fx
      if (fx.stopUntil > g.clock || fx.frozenUntil > g.clock || fx.spookedUntil > g.clock) continue
      const inReach = fx.confusedUntil > g.clock || foe.stopped
      const foeSpeed = hordeSpeedFactor(foe.stats.spe, foe.level) * foePace(g, foe) * bossRamp(g, foe).attack
      const next = foe.cooldowns.indexOf(Math.min(...foe.cooldowns))
      foe.moves.forEach((move, i) => {
        const floor = inReach || i === next ? 0 : hordeMoveCooldown(move) * foeScale * 0.5
        if (foe.cooldowns[i] > floor) foe.cooldowns[i] = Math.max(floor, foe.cooldowns[i] - dt * foeSpeed)
        if (inReach && foe.cooldowns[i] <= 0 && !g.outcome) {
          foeAttack(g, foe, move)
          foe.cooldowns[i] = hordeMoveCooldown(move) * foeScale
        }
      })
    }

    // Exploders whose fuse has burnt down blow up - over and over while blasts set off more of them.
    for (let lit = true; lit; ) {
      lit = false
      for (const foe of g.foes) {
        if (foe.exploder && foe.faintedAt === null && foe.fuseAt !== undefined && foe.fuseAt <= g.clock) {
          explode(g, foe)
          lit = true
        }
      }
      const due = g.bombs.filter((b) => b.fuseAt <= g.clock)
      if (due.length) {
        g.bombs = g.bombs.filter((b) => b.fuseAt > g.clock)
        for (const bomb of due) blowUp(g, bomb)
        lit = true
      }
    }

    g.foes = keep(g.foes, (f) => f.faintedAt === null || g.now - f.faintedAt < FAINT_MS)
    g.popups = keep(g.popups, (p) => g.now - p.born < POPUP_MS)
    g.bursts = keep(g.bursts, (b) => g.now - b.born < BURST_MS)
    g.arcs = keep(g.arcs, (a) => g.now - a.born < ARC_MS)
    g.flashes = keep(g.flashes, (f) => g.now - f.born < (FLASH_LASTS[f.kind] ?? FLASH_MS))
  }

  // The loop: steps the run every frame (never more than 50 ms at a time, so a stall
  // doesn't jump it ahead) and redraws. A level-up waiting for its choice stops the clock.
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const tick = (now: number): void => {
      const g = game.current
      const dt = Math.min(50, now - last)
      last = now
      if (!stopped.current && !g.outcome) {
        g.now = now
        step(g, dt)
        if (g.pendingChoices.length > 0 && !g.outcome) {
          stopped.current = true
          const evolution = g.pendingChoices[0]
          // A Rare Candy is used up on the next level-up (not one where every card is already legendary).
          g.candyScreen = !evolution && (g.held.rareCandy ?? 0) > 0
          if (g.candyScreen) {
            g.held.rareCandy = (g.held.rareCandy ?? 0) - 1
            if (!g.held.rareCandy) delete g.held.rareCandy
          }
          setChoices({ list: rollChoices(g, evolution), evolution })
        }
      }
      // Nothing moves while it's stopped (paused, a choice or a chest up), so nothing to redraw.
      if (!stopped.current) setFrame((f) => (f + 1) % 1_000_000)
      if (!g.outcome) raf = requestAnimationFrame(tick)
      else setFrame((f) => f + 1)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The screen is as wide as the stage's shape makes it (its height is fixed), so distances
  // look the same every way; the field stays the same size whatever the screen.
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const fit = (): void => {
      if (!stage.clientWidth || !stage.clientHeight) return
      const g = game.current
      g.width = Math.min(g.worldW, (HORDE_ARENA_HEIGHT * stage.clientWidth) / stage.clientHeight)
      g.unitPx = stage.clientHeight / HORDE_ARENA_HEIGHT
      followLead(g)
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  // WASD or the arrow keys steer. Escape (or P) pauses; so does leaving the window.
  useEffect(() => {
    const direction = (e: KeyboardEvent): string | null => {
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          return 'up'
        case 'ArrowDown':
        case 's':
        case 'S':
          return 'down'
        case 'ArrowLeft':
        case 'a':
        case 'A':
          return 'left'
        case 'ArrowRight':
        case 'd':
        case 'D':
          return 'right'
      }
      return null
    }
    const onKey = (e: KeyboardEvent): void => {
      if (game.current.outcome) return
      const dir = direction(e)
      if (dir) {
        keys.add(dir)
        e.preventDefault()
      } else if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') setPaused((p) => !p)
      else if (e.key === 'e' || e.key === 'E') interact()
    }
    const onKeyUp = (e: KeyboardEvent): void => {
      const dir = direction(e)
      if (dir) keys.delete(dir)
    }
    const letGo = (): void => {
      keys.clear()
      pointer.current = null
    }
    const onHide = (): void => {
      letGo()
      if (document.hidden && !game.current.outcome) setPaused(true)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', letGo)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', letGo)
      document.removeEventListener('visibilitychange', onHide)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const g = game.current

  // Once it's over, report how it went (once) to be paid.
  useEffect(() => {
    if (!g.outcome || reported.current) return
    reported.current = true
    window.api
      .finishHorde(setup.token, runResult(g))
      .then(setReward)
      .catch((e: Error) => {
        setPayError(e.message)
        setReward(null)
      })
  })

  const toNext = hordeExpToNext(g.levelsGained)
  const boss = g.foes.find((f) => f.kind === 'boss' && f.faintedAt === null)
  const hpShare = g.hp / g.maxHp
  const lunging = g.lastMove && g.now - g.lastMove.at < 160
  // The lunge leans toward whatever the last move struck.
  const lungeAim = awayFromLead(g, g.aimX, g.aimY)
  const lunge = { x: Math.round(lungeAim.dx * 12), y: Math.round(lungeAim.dy * 12) }
  const hurting = g.now - g.hurtAt < 160

  // A chance in percent, to one decimal place at most.
  const percent = (chance: number): number => Math.round(chance * 10) / 10
  // A known move's chance to set off its own type's effect, as it plays.
  const effectChance = (move: HordeMove): number => percent(hordeEffectChance(move, move.type, knownMoves(g)))
  // A move's badges on its card: its shape, and its type's effect as it'll stand with the move
  // known - how many moves of the type, the chance a hit, and the bonus rule it unlocks.
  const moveTags = (move: HordeMove, learning: boolean): NonNullable<CardFace['tags']> => {
    const info = shapeInfo(move)
    const rank = hordeTypeEffect(learning ? [...knownMoves(g), move] : knownMoves(g), move.type)
    const effect = t(`horde.effect.${move.type}` as MessageKey)
    const effectTip = [
      t(`horde.effectDesc.${move.type}` as MessageKey),
      t('horde.effectStack', {
        effect,
        count: rank.moves,
        max: HORDE_EFFECT_MASTERY_MOVES,
        chance: percent(rank.chance),
        other: percent(rank.chance * HORDE_EFFECT_OTHER_TYPE_SHARE)
      })
    ]
    if (rank.bonus && !effectRank(g, move.type).bonus)
      effectTip.push(t('horde.effectUnlocks', { text: t(`horde.effectBonus.${move.type}` as MessageKey) }))
    if (rank.mastery && !effectRank(g, move.type).mastery)
      effectTip.push(t('horde.effectUnlocksMastery', { text: t(`horde.effectMastery.${move.type}` as MessageKey) }))
    return [
      { label: info.badge, tip: [info.note] },
      { label: effect, tip: effectTip, color: typeColor(move.type), pips: Math.min(rank.moves, HORDE_EFFECT_MASTERY_MOVES) }
    ]
  }

  // How a move goes off: its shape's name (for the card's badge) and what it does.
  const shapeInfo = (move: HordeMove): { badge: string; note: string } => {
    const shape = hordeMoveShape(move)
    const note = t(`horde.shapeNote.${shape}` as MessageKey, { n: hordeBaseCount(move) })
    return {
      badge: t(`horde.shape.${shape}` as MessageKey),
      note: note.charAt(0).toUpperCase() + note.slice(1)
    }
  }

  // A move's reach in percent, with its upgrades.
  const reachPercent = (range: number): string => `${100 + range}%`
  // A piercing shot's size in percent - its reach upgrades make it bigger instead, by less and less.
  const sizePercent = (range: number): string => `${Math.round(hordePierceSize(range) * 100)}%`

  // A move's cooldown in seconds as it plays, Speed included.
  const seconds = (move: HordeMove, cut: number): string => `${(hordeMoveCooldown(move, cut + bonusOf(g, 'haste'), knownMoves(g)) / 1000).toFixed(1)}s`

  // What some copies of a held item add in all, in words.
  const heldText = (id: HordeHeldId, copies: number): string => heldBuffText(t, id, copies)

  // How many ranks of a tome the lead already holds.
  const tomeRanks = (stat: HordeStat): number => g.tomes.find((tm) => tm.stat === stat)?.ranks ?? 0

  // A tome card's rank once taken - none for a new one, which gets the New badge instead.
  const tomeRank = (stat: HordeStat, isNew: boolean): number | undefined => (isNew ? undefined : tomeRanks(stat) + 1)

  // What a choice's card shows, worked out from the run as it is now.
  const choiceFace = (choice: HordeChoice): CardFace => {
    const up = HORDE_MOVE_UPGRADE[choice.rarity]
    let kind: string
    let title: string
    let lines: string[] = []
    // What the pick changes: each value before and after.
    let changes: CardFace['changes'] = []
    let color: string | undefined
    let badge: string | undefined
    // A new move's card gets a "New" badge too.
    let isNew = false
    let group: CardFace['group']
    let type: string | undefined
    let tags: CardFace['tags']
    let twist: string | undefined
    let rank: number | undefined
    if (choice.kind === 'learn') {
      group = 'move'
      type = choice.move.type
      const b = choice.boosts
      kind = t('horde.kind.move')
      title = moveName(choice.move.name)
      const headPower = hordeUpgradePower(choice.move, choice.rarity)
      isNew = true
      tags = moveTags(choice.move, true)
      twist = twistText(g, choice.move)
      // Its power and cooldown, with the head start its card's rarity gives it.
      const power = b.includes('power') ? headPower : 0
      const cut = b.includes('cooldown') ? up.cooldown : 0
      changes = [
        { label: t('horde.change.power'), after: hordeMovePower(choice.move, power), bump: power ? `+${power}%` : undefined },
        { label: t('horde.change.cooldown'), after: seconds(choice.move, cut), bump: cut ? `-${cut}%` : undefined }
      ]
      if (b.includes('range')) {
        const pierces = hordeMoveShape(choice.move) === 'pierce'
        const range = hordeRangeUpgrade(choice.move, choice.rarity)
        changes.push(
          pierces
            ? { label: t('horde.change.size'), after: sizePercent(up.range), bump: `+${Math.round((hordePierceSize(up.range) - 1) * 100)}%` }
            : { label: t('horde.change.range'), after: reachPercent(range), bump: `+${range}%` }
        )
      }
      if (b.includes('count')) {
        const more = hordeCountUpgrade(choice.move, choice.rarity)
        changes.push({ label: t(COUNT_LABEL_KEYS[hordeCountKind(choice.move)]), after: hordeShownCount(choice.move, more), bump: `+${more}` })
      }
      if (b.includes('crit')) {
        const crit = hordeCritUpgrade(choice.rarity)
        changes.push({ label: t('horde.change.crit'), after: `+${crit}%`, bump: `+${crit}%` })
      }
      color = typeColor(choice.move.type)
    } else if (choice.kind === 'upgrade') {
      const known = g.known[choice.slot]
      kind = t('horde.choice.upgrade')
      title = moveName(known.move.name)
      group = 'upgrade'
      type = known.move.type
      // Only what this card raises.
      const b = choice.boosts
      if (b.includes('power'))
        changes.push({
          label: t('horde.change.power'),
          before: hordeMovePower(known.move, known.power),
          after: hordeMovePower(known.move, known.power + hordeUpgradePower(known.move, choice.rarity, known.upgrades))
        })
      if (b.includes('cooldown'))
        changes.push({
          label: t('horde.change.cooldown'),
          before: seconds(known.move, known.cut),
          after: seconds(known.move, known.cut + hordeCooldownUpgrade(choice.rarity, known.upgrades))
        })
      if (b.includes('range') && hordeMoveShape(known.move) === 'pierce')
        changes.push({
          label: t('horde.change.size'),
          before: sizePercent(known.range),
          after: sizePercent(known.range + hordeRangeUpgrade(known.move, choice.rarity, known.upgrades))
        })
      else if (b.includes('range')) {
        // A melee move shows the reach all melee moves share.
        const from = hordeMoveShape(known.move) === 'melee' ? Math.round((meleeRadius(g) / HORDE_SHAPES.meleeReach - 1) * 100) : known.range
        changes.push({
          label: t('horde.change.range'),
          before: reachPercent(from),
          after: reachPercent(from + hordeRangeUpgrade(known.move, choice.rarity, known.upgrades))
        })
      }
      if (b.includes('count'))
        changes.push({
          label: t(COUNT_LABEL_KEYS[hordeCountKind(known.move)]),
          before: hordeShownCount(known.move, known.count),
          after: hordeShownCount(known.move, known.count + hordeCountUpgrade(known.move, choice.rarity))
        })
      if (b.includes('crit'))
        changes.push({
          label: t('horde.change.crit'),
          before: `+${known.crit}%`,
          after: `+${known.crit + hordeCritUpgrade(choice.rarity, known.upgrades)}%`
        })
      tags = moveTags(known.move, false)
      twist = twistText(g, known.move)
      color = typeColor(known.move.type)
    } else if (choice.kind === 'multi') {
      kind = t('horde.choice.multi')
      title = t('horde.multi')
      changes = [
        {
          label: t('horde.change.targets'),
          before: 1 + g.multi * HORDE_MULTI_TARGETS,
          after: 1 + (g.multi + 1) * HORDE_MULTI_TARGETS
        }
      ]
      lines = [t('horde.multiNote')]
    } else if (choice.kind === 'gold') {
      kind = t('horde.choice.gold')
      title = t('horde.gold')
      changes = [{ label: t('horde.gold'), before: Math.floor(g.gold), after: Math.floor(g.gold) + HORDE_GOLD_CARD[choice.rarity] }]
      lines = [t('horde.goldNote')]
    } else if (choice.stat === 'luck') {
      group = 'tome'
      isNew = !!choice.isNew
      kind = t('horde.kind.tome')
      rank = tomeRank(choice.stat, isNew)
      title = t(ABILITY_KEYS.luck)
      changes = [
        {
          label: t(STAT_KEYS.luck),
          before: luckOf(g),
          after: luckOf(g) + HORDE_LUCK_POINTS[choice.rarity],
          bump: `+${HORDE_LUCK_POINTS[choice.rarity]}`
        }
      ]
      lines = [t('horde.luckNote')]
    } else if (isBonusStat(choice.stat)) {
      const stat = choice.stat
      group = 'tome'
      isNew = !!choice.isNew
      kind = t('horde.kind.tome')
      rank = tomeRank(stat, isNew)
      title = t(ABILITY_KEYS[stat])
      changes = [
        {
          label: t(STAT_KEYS[stat]),
          before: `+${bonusOf(g, stat)}%`,
          after: `+${bonusOf(g, stat, hordeBonusPercent(stat, choice.rarity, tomeRanks(stat)))}%`
        }
      ]
      lines = [t(`horde.${stat}Note` as MessageKey)]
    } else if (choice.stat === 'curse') {
      // Curse: HP and Defense up, the walk down.
      const { up, down } = hordeCurseGain(choice.rarity, tomeRanks('curse'))
      const percents = statPercents(g)
      const after = leadStats(leadForm(g), g.level, { ...percents, hp: percents.hp + up, def: percents.def + up })
      after.hp = Math.round(after.hp * g.hpMult)
      group = 'tome'
      isNew = !!choice.isNew
      kind = t('horde.kind.tome')
      rank = tomeRank('curse', isNew)
      title = t(ABILITY_KEYS.curse)
      changes = [
        { label: t(STAT_KEYS.hp), before: g.stats.hp, after: after.hp, bump: `+${up}%` },
        { label: t(STAT_KEYS.def), before: g.stats.def, after: after.def, bump: `+${up}%` },
        {
          label: t('horde.change.walk'),
          before: `${Math.round(leadWalk(g) * 100)}%`,
          after: `${Math.round(leadWalk(g, percents.spe - down) * 100)}%`,
          bump: `-${down}%`
        }
      ]
      lines = [t('horde.curseNote')]
    } else {
      const stat = choice.stat
      const percents = statPercents(g)
      const after = leadStats(leadForm(g), g.level, {
        ...percents,
        [stat]: percents[stat] + hordeBaseStatPercent(stat, choice.rarity, tomeRanks(stat))
      })
      // With what Max Mushrooms and Minior's Core add on top, as refreshStats does.
      after.hp = Math.round(after.hp * g.hpMult)
      if (setup.coreForm && g.altForm === setup.coreForm) after.spe = Math.round(after.spe * (1 + HORDE_MINIOR_CORE_SPEED))
      group = 'tome'
      isNew = !!choice.isNew
      kind = t('horde.kind.tome')
      rank = tomeRank(stat, isNew)
      title = t(ABILITY_KEYS[stat])
      // Speed picks show the walk they bring (the slower the lead, the more).
      changes =
        stat === 'spe'
          ? [
              {
                label: t('horde.change.walk'),
                before: `${Math.round(leadWalk(g) * 100)}%`,
                after: `${Math.round(leadWalk(g, percents.spe + hordeBaseStatPercent('spe', choice.rarity, tomeRanks('spe'))) * 100)}%`
              }
            ]
          : [
              {
                label: t(STAT_KEYS[stat]),
                before: g.stats[stat],
                after: after[stat]
              }
            ]
      const gain = hordeBaseStatPercent(stat, choice.rarity, tomeRanks(stat))
      changes[0].bump = `+${gain}%`
      if (stat === 'spe') {
        // The badge shows how much faster this lead really walks, since quick leads get only part of the pick.
        const faster = Math.round((leadWalk(g, percents.spe + gain) / leadWalk(g) - 1) * 100)
        changes[0].bump = `+${faster}%`
        lines = [t('horde.walkPercent', { percent: gain, faster })]
      }
    }
    return { rarity: choice.rarity, kind, title, changes, lines, color, badge, isNew, group, type, tags, twist, rank }
  }

  // A card's classes: its sort (each with its own colour and mark), and a glow when it's new.
  const cardClass = (face: CardFace): string =>
    [face.group && `horde-choice-${face.group}`, face.isNew && 'horde-choice-fresh'].filter(Boolean).join(' ')

  // A card's insides - the same on a level-up choice and in the pause menu's hover card.
  const cardBody = ({ rarity, kind, title, changes, lines, color, badge, isNew, type, tags, twist, rank }: CardFace): React.JSX.Element => (
    <>
      <span className="horde-choice-top">
        <span className="horde-choice-kind" style={color ? ({ '--move-color': color } as React.CSSProperties) : undefined}>
          {kind}
        </span>
        {isNew && <span className="horde-choice-badge horde-choice-badge-new">{t('horde.badge.new')}</span>}
        <span className="horde-choice-rarity">{t(RARITY_KEYS[rarity])}</span>
      </span>
      {type && <span className={`type-badge horde-choice-type type-${type.toLowerCase()}`}>{typeName(type)}</span>}
      <span className="horde-choice-head">
        <span className="horde-choice-title">{title}</span>
        {rank !== undefined && <span className="horde-choice-badge horde-choice-badge-rank">{t('horde.tomeRank', { rank })}</span>}
      </span>
      {tags ? (
        <span className="horde-choice-badges">
          {tags.map((tag) => (
            <CardTag key={tag.label} tag={tag} />
          ))}
        </span>
      ) : (
        badge && (
          <span className="horde-choice-badges">
            <span className="horde-choice-badge" style={color ? ({ '--move-color': color } as React.CSSProperties) : undefined}>
              {badge}
            </span>
          </span>
        )
      )}
      {changes.length > 0 && (
        <span className="horde-choice-stats">
          {changes.map((change) => (
            <span key={change.label} className="horde-choice-stat">
              <span className="horde-choice-label">{change.label}</span>
              <span className="horde-choice-values">
                {change.before !== undefined && (
                  <>
                    <span className="horde-choice-before">{change.before}</span>
                    <span className="horde-choice-arrow">→</span>
                  </>
                )}
                <b className="horde-choice-after">{change.after}</b>
                {change.bump && <span className="horde-choice-bump">{change.bump}</span>}
              </span>
            </span>
          ))}
        </span>
      )}
      {twist && <span className="horde-choice-twist">{twist}</span>}
      {lines.map((line) => (
        <span key={line} className="horde-choice-text">
          {line}
        </span>
      ))}
    </>
  )

  const choiceCard = (choice: HordeChoice, i: number): React.JSX.Element => {
    const face = choiceFace(choice)
    const banishable = g.banishes > 0 && hordeCanBanish(choice)
    return (
      <RarityCard
        key={i}
        tier={choice.rarity}
        framed
        lift
        className={`horde-choice ${cardClass(face)}${banishable ? ' horde-choice-banishable' : ''}`}
        role={IS_MOBILE_LAYOUT ? undefined : 'button'}
        tabIndex={IS_MOBILE_LAYOUT ? undefined : 0}
        style={{ animationDelay: `${i * 0.05}s` }}
        onClick={IS_MOBILE_LAYOUT ? undefined : () => applyChoice(choice, face)}
      >
        {cardBody(face)}
        {IS_MOBILE_LAYOUT && (
          <button className="horde-btn horde-btn-primary horde-choice-take" onClick={() => applyChoice(choice, face)}>
            {t('horde.take')}
          </button>
        )}
        {banishable && (
          <button
            className="horde-banish"
            title={t('horde.banishTip')}
            onClick={(e) => {
              e.stopPropagation()
              banishChoice(choice)
            }}
          >
            {t('horde.banish')}
          </button>
        )}
      </RarityCard>
    )
  }

  const odds = hordeRarityOdds(luckOf(g))
  // The items whose effects last a while, and until when.
  const itemBuffs: { item: HordeItemId; until: number }[] = [
    { item: 'choiceScarf', until: g.scarfUntil },
    { item: 'boosterEnergy', until: g.boosterUntil },
    { item: 'flameOrb', until: g.flameUntil }
  ]
  // The held items whose bonus grows over the run, and what it is now (only those held).
  const grown = growingDamage(g)
  const growing: { id: HordeHeldId; text: string }[] = (
    [
      { id: 'relicCrown', text: t('horde.growDamage', { n: Math.round(grown.crown * 10) / 10 }) },
      { id: 'luckIncense', text: t('horde.growLuck', { n: incenseLuck(g) }) },
      { id: 'reaperCloth', text: t('horde.growAttack', { n: Math.round(reaperAttack(g) * 10) / 10 }) },
      { id: 'pearlString', text: t('horde.growDamage', { n: Math.round(grown.pearl * 10) / 10 }) },
      { id: 'quickPowder', text: t('horde.growDamage', { n: Math.round(grown.powder * 10) / 10 }) },
      { id: 'spellTag', text: t('horde.growAttack', { n: Math.round(spellTagAttack(g) * 10) / 10 }) }
    ] as { id: HordeHeldId; text: string }[]
  ).filter((item) => g.held[item.id])
  // How far the lead's sprite is out on a dash right now: out to its foe, then back.
  const dashOut = ((): { x: number; y: number } => {
    if (!g.dash) return { x: 0, y: 0 }
    const k = Math.max(0, Math.min(2, (g.clock - g.dash.start) / HORDE_DASH_MS))
    const out = g.dash.reach * (k <= 1 ? k : 2 - k)
    return { x: g.dash.dx * out, y: g.dash.dy * out }
  })()
  // Where something on the field sits, as a share of the field layer.
  const place = (x: number, y: number): { left: string; top: string } => ({
    left: `${(x / g.worldW) * 100}%`,
    top: `${(y / g.worldH) * 100}%`
  })
  // A circle of this radius round a spot, sized by the field's height (arena units are square).
  const circle = (x: number, y: number, radius: number): React.CSSProperties => ({
    ...place(x, y),
    height: `${((2 * radius) / g.worldH) * 100}%`
  })
  // The chest the lead stands by (the nearest within reach), and what the next one costs.
  const chestCost = hordeChestCost(g.chestsOpened)
  const nearChest = g.chests.reduce<Chest | null>((best, c) => {
    const d = dist(c.x, c.y, g.px, g.py)
    return d <= HORDE_CHEST_REACH && (!best || d < dist(best.x, best.y, g.px, g.py)) ? c : best
  }, null)
  // The nearest chest anywhere, for the arrow at the screen's edge while it's off screen.
  const nextChest = g.chests.reduce<Chest | null>(
    (best, c) => (!best || dist(c.x, c.y, g.px, g.py) < dist(best.x, best.y, g.px, g.py) ? c : best),
    null
  )
  // The Totem Trial the lead could start, and the nearest shrine anywhere (for its own arrow at the screen's edge).
  const nearShrine = shrineInReach(g)
  const nextShrine = g.shrines.reduce<Shrine | null>(
    (best, s) => (!best || dist(s.x, s.y, g.px, g.py) < dist(best.x, best.y, g.px, g.py) ? s : best),
    null
  )
  // How many a started Totem Trial's callers are still up.
  const totemLeft = (s: Shrine): number => g.foes.filter((f) => f.shrine === s.id && f.faintedAt === null).length
  // An arrow at the screen's edge pointing from the lead toward a spot off screen.
  const edgeArrow = (at: { x: number; y: number }, className: string, icon: React.ReactNode): React.JSX.Element => {
    const dx = at.x - g.px
    const dy = at.y - g.py
    // Out from the lead's spot on screen to an edge, kept a little way in.
    const sx = g.px - g.camX
    const sy = g.py - g.camY
    const pad = 50
    const tx = dx > 0 ? (g.width - pad - sx) / dx : dx < 0 ? (pad - sx) / dx : Infinity
    const ty = dy > 0 ? (HORDE_ARENA_HEIGHT - pad - sy) / dy : dy < 0 ? (pad - sy) / dy : Infinity
    const k = Math.max(0, Math.min(tx, ty))
    return (
      <span
        className={className}
        style={{
          left: `${((sx + dx * k) / g.width) * 100}%`,
          top: `${((sy + dy * k) / HORDE_ARENA_HEIGHT) * 100}%`
        }}
      >
        <span className="horde-chest-arrow-head" style={{ rotate: `${Math.atan2(dy, dx)}rad` }} />
        {icon}
      </span>
    )
  }
  // Once the run is over: the damage each move dealt, the most first.
  const damageList = g.outcome ? Object.entries(g.damage).filter(([, d]) => d > 0).sort((a, b) => b[1] - a[1]) : []
  const damageTotal = damageList.reduce((sum, [, d]) => sum + d, 0)

  // The lead's stats, in the top bar (or the stats window on a phone).
  const statRows = (
    <>
      {g.multi > 0 && (
        <span>
          {t('horde.multi')} <b>+{g.multi * HORDE_MULTI_TARGETS}</b>
        </span>
      )}
      {HORDE_STATS.filter((s): s is Exclude<HordeStat, 'curse'> => s !== 'curse' && (!isBonusStat(s) || bonusOf(g, s) > 0)).map((s) => (
        <span key={s}>
          {t(STAT_KEYS[s])} <b>{s === 'luck' ? luckOf(g) : isBonusStat(s) ? `+${bonusOf(g, s)}%` : s === 'spe' ? `${g.stats.spe} · ${Math.round(leadWalk(g) * 100)}%` : g.stats[s]}</b>
        </span>
      ))}
    </>
  )

  // The pause menu's list of every level-up choice taken, newest first.
  const logList = (
    <div className="horde-log">
      <span className="horde-log-title">{t('horde.log')}</span>
      {g.log.length === 0 ? (
        <span className="horde-log-empty">{t('horde.logEmpty')}</span>
      ) : (
        <div className="horde-log-list">
          {g.log
            .map((entry, i) => (
              <RarityCard
                key={i}
                tier={entry.rarity}
                className={`horde-log-row${entry.shrine ? ' horde-log-shrine' : ''}`}
                onMouseEnter={(e) => {
                  const card = entry.card
                  if (!card) return
                  // Beside the row - on its right, or its left if there's no room.
                  const row = e.currentTarget.getBoundingClientRect()
                  const left = row.right + 12 + 230 <= window.innerWidth ? row.right + 12 : Math.max(8, row.left - 242)
                  setLogTip({ card, left, top: Math.max(8, Math.min(row.top, window.innerHeight - 360)) })
                }}
                onMouseLeave={() => setLogTip(null)}
              >
                <span className="horde-log-level">{t('horde.lv', { level: entry.level })}</span>
                <span className="horde-log-kind">{entry.kind}</span>
                <b className="horde-log-name">{entry.title}</b>
                {entry.detail && <span className="horde-log-detail">{entry.detail}</span>}
              </RarityCard>
            ))
            .reverse()}
        </div>
      )}
    </div>
  )

  // A type effect's tooltip: what it does, its chance and strength with each count of moves of
  // the type (the lead's own count lit up), and the bonus all of them unlock.
  const effectTip = (type: string): React.JSX.Element => {
    const rank = effectRank(g, type)
    const bonus = t(`horde.effectBonus.${type}` as MessageKey)
    const mastery = t(`horde.effectMastery.${type}` as MessageKey)
    return (
      <div className="horde-tip-body" style={{ '--move-color': typeColor(type) } as React.CSSProperties}>
        <span className="horde-tip-title">
          <span className={`type-badge type-${type.toLowerCase()}`}>{typeName(type)}</span>
          <b>{t(`horde.effect.${type}` as MessageKey)}</b>
        </span>
        <span className="horde-tip-text">{t(`horde.effectDesc.${type}` as MessageKey)}</span>
        <ul className="horde-tip-levels">
          {Array.from({ length: HORDE_EFFECT_MASTERY_MOVES }, (_, i) => i + 1).map((count) => (
            <li key={count} className={rank.moves === count || (count === HORDE_EFFECT_MASTERY_MOVES && rank.moves > count) ? 'horde-tip-on' : ''}>
              {t('horde.effectLevel', {
                count,
                max: HORDE_EFFECT_MASTERY_MOVES,
                chance: HORDE_EFFECT_BY_MOVES[count].chance,
                potency: HORDE_EFFECT_BY_MOVES[count].potency
              })}
            </li>
          ))}
          <li className={rank.bonus ? 'horde-tip-on' : ''}>
            {t('horde.effectBonusLine', { max: HORDE_EFFECT_BONUS_MOVES, text: bonus.charAt(0).toUpperCase() + bonus.slice(1) })}
          </li>
          <li className={rank.mastery ? 'horde-tip-on' : ''}>
            {t('horde.effectMasteryLine', { max: HORDE_EFFECT_MASTERY_MOVES, text: mastery.charAt(0).toUpperCase() + mastery.slice(1) })}
          </li>
        </ul>
        <span className="horde-tip-note">{t('horde.effectOtherNote')}</span>
      </div>
    )
  }

  // A held item's tooltip: its name and what all its copies add.
  const heldTip = (id: HordeHeldId): React.JSX.Element => (
    <div className="horde-tip-body">
      <span className="horde-tip-title">
        <b>{itemName(HORDE_HELD_ITEMS[id].name)}</b>
        <span className="horde-muted">×{g.held[id] ?? 0}</span>
      </span>
      <span className="horde-tip-text">{heldText(id, g.held[id] ?? 0)}</span>
    </div>
  )

  // Hovering something in the bar under the moves shows its tooltip above it (below it for the
  // held items up in the scene's corner).
  const tipAt = (key: string, el: Element, below = false): void => {
    const r = el.getBoundingClientRect()
    const half = Math.min(170, window.innerWidth / 2 - 8)
    const left = Math.min(window.innerWidth - half, Math.max(half, r.left + r.width / 2))
    setLoadoutTip(below ? { key, left, top: r.bottom + 6 } : { key, left, bottom: window.innerHeight - r.top + 6 })
  }
  const tipHandlers = (key: string, below = false): React.HTMLAttributes<HTMLElement> => ({
    onMouseEnter: (ev) => tipAt(key, ev.currentTarget, below),
    onMouseLeave: () => setLoadoutTip(null)
  })

  // What an item picked up does, in words.
  const itemDesc = (item: HordeItemId): string => {
    const amount: Partial<Record<HordeItemId, number>> = {
      choiceScarf: Math.round((HORDE_SCARF_WALK - 1) * 100),
      boosterEnergy: Math.round(HORDE_BOOSTER_SPEED * 100),
      flameOrb: Math.round((HORDE_FLAME_ORB_DAMAGE - 1) * 100),
      icyRock: HORDE_ICY_ROCK_MS / 1000,
      maxMushroom: HORDE_MAX_MUSHROOM_HP
    }
    return t(`horde.itemDesc.${item}` as MessageKey, {
      n: amount[item] ?? 0,
      s: HORDE_ITEM_BUFF_MS / 1000,
      money: formatMoney(HORDE_BIG_NUGGET_MONEY)
    })
  }

  // An item's tooltip in the effects row: its name and what it does.
  const itemTip = (item: HordeItemId): React.JSX.Element => (
    <div className="horde-tip-body">
      <span className="horde-tip-title">
        <b>{t(`horde.item.${item}` as MessageKey)}</b>
      </span>
      <span className="horde-tip-text">{itemDesc(item)}</span>
    </div>
  )
  // Hovering an item in the effects row shows its tooltip below it; on a phone a tap does.
  const itemTipHandlers = (item: HordeItemId): React.HTMLAttributes<HTMLElement> =>
    IS_MOBILE_LAYOUT
      ? {
          onClick: (ev) => {
            const key = `item:${item}`
            if (loadoutTip?.key === key) setLoadoutTip(null)
            else tipAt(key, ev.currentTarget, true)
          }
        }
      : tipHandlers(`item:${item}`, true)
  // The item a tooltip is open on, while it still shows in the row - the tooltip closes once it runs out.
  const tipItem = loadoutTip?.key.startsWith('item:') ? (loadoutTip.key.slice('item:'.length) as HordeItemId) : null
  const tipItemShown =
    tipItem === 'bigNugget' ? g.bigNuggets > 0 : !!tipItem && (itemBuffs.find((b) => b.item === tipItem)?.until ?? 0) > g.clock

  // An ability's tooltip: its rank, what it adds in all now, and what it does.
  const tomeTip = (stat: HordeStat): React.JSX.Element => {
    const value =
      stat === 'luck'
        ? String(luckOf(g))
        : isBonusStat(stat)
          ? `+${bonusOf(g, stat)}%`
          : stat === 'spe'
            ? `${t('horde.change.walk')} ${Math.round(leadWalk(g) * 100)}%`
            : stat === 'curse'
              ? `${t(STAT_KEYS.hp)} ${g.stats.hp} · ${t(STAT_KEYS.def)} ${g.stats.def} · ${t('horde.change.walk')} ${Math.round(leadWalk(g) * 100)}%`
              : `${g.stats[stat]} (+${statPercents(g)[stat]}%)`
    return (
      <div className="horde-tip-body" style={{ '--move-color': '#a98bff' } as React.CSSProperties}>
        <span className="horde-tip-title">
          <b>{t(ABILITY_KEYS[stat])}</b>
          <span className="horde-choice-badge horde-choice-badge-rank">{t('horde.tomeRank', { rank: tomeRanks(stat) })}</span>
        </span>
        <span className="horde-tip-text">
          <b>{value}</b>
        </span>
        {(stat === 'luck' || stat === 'curse' || isBonusStat(stat)) && <span className="horde-tip-text">{t(`horde.${stat}Note` as MessageKey)}</span>}
      </div>
    )
  }

  // A known move's tooltip: its type, shape and what that does, its power and cooldown as it
  // plays, its type's effect chance, and its own twist.
  const moveTip = (known: KnownMove): React.JSX.Element => {
    const info = shapeInfo(known.move)
    const chance = effectChance(known.move)
    return (
      <div className="horde-tip-body" style={{ '--move-color': typeColor(known.move.type) } as React.CSSProperties}>
        <span className="horde-tip-title">
          <span className={`type-badge type-${known.move.type.toLowerCase()}`}>{typeName(known.move.type)}</span>
          <b>{moveName(known.move.name)}</b>
          {known.upgrades > 0 && <span className="horde-move-rank">{t('horde.upgrades', { count: known.upgrades })}</span>}
        </span>
        <span className="horde-tip-text">
          <b>{info.badge}</b> - {info.note}
        </span>
        <span className="horde-tip-text">
          {t('horde.movesStats', { power: hordeMovePower(known.move, known.power), seconds: (leadCooldown(g, known) / 1000).toFixed(1) })}
          {chance > 0 && ` · ${t('horde.effectChance', { effect: t(`horde.effect.${known.move.type}` as MessageKey), chance })}`}
        </span>
        <span className="horde-choice-twist">{twistText(g, known.move)}</span>
      </div>
    )
  }

  // The lead's type effects, in the order its moves brought them.
  const effectTypes = hordeEffectTypes(knownMoves(g))

  // The pause menu's list of type effects - each opening up to its tooltip when tapped.
  const effectsList = (
    <div className="horde-log">
      <span className="horde-log-title">{t('horde.effectsTitle')}</span>
      {!effectTypes.length ? (
        <span className="horde-log-empty">{t('horde.effectsEmpty')}</span>
      ) : (
        <div className="horde-log-list">
          {effectTypes.map((type) => {
            const key = `effect:${type}`
            const rank = effectRank(g, type)
            return (
              <button
                key={type}
                className={`horde-effect-row${openTip === key ? ' horde-effect-row-open' : ''}`}
                style={{ '--move-color': typeColor(type) } as React.CSSProperties}
                onClick={() => setOpenTip(openTip === key ? null : key)}
              >
                <span className="horde-effect-row-head">
                  <b>{t(`horde.effect.${type}` as MessageKey)}</b>
                  <span className="horde-effect-pips">
                    {Array.from({ length: HORDE_EFFECT_MASTERY_MOVES }, (_, i) => (
                      <span key={i} className={i < rank.moves ? 'on' : ''} />
                    ))}
                  </span>
                </span>
                {openTip === key && effectTip(type)}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )

  // The pause menu's list of held items, with what all their copies add.
  const heldList = (
    <div className="horde-log">
      <span className="horde-log-title">{t('horde.heldItems', { chests: g.chestsOpened })}</span>
      {!HORDE_HELD_IDS.some((id) => g.held[id]) ? (
        <span className="horde-log-empty">{t('horde.heldEmpty')}</span>
      ) : (
        <div className="horde-log-list">
          {HORDE_HELD_IDS.filter((id) => g.held[id]).map((id) => {
            const def = HORDE_HELD_ITEMS[id]
            const copies = g.held[id] ?? 0
            return (
              <RarityCard key={id} tier={def.rarity} className="horde-log-row">
                <ItemSprite spritenum={def.spritenum} />
                <b className="horde-log-name">{itemName(def.name)}</b>
                <span className="horde-log-kind">×{copies}</span>
                <span className="horde-log-detail">{heldText(id, copies)}</span>
              </RarityCard>
            )
          })}
        </div>
      )}
    </div>
  )

  return createPortal(
    <div className="horde-arena">
      <div className="horde-hud">
        <div className="horde-hud-lead">
          <span className="horde-hud-name">
            {leadForm(g).species} <span className="horde-hud-level">{t('horde.lv', { level: g.level })}</span>
          </span>
          <div className="horde-hp">
            <div
              className={`horde-hp-fill${hpShare <= 0.2 ? ' horde-hp-red' : hpShare <= 0.5 ? ' horde-hp-yellow' : ''}`}
              style={{ width: `${hpShare * 100}%` }}
            />
            {g.shield > 0 && <div className="horde-hp-shield" style={{ width: `${Math.min(1, g.shield / g.maxHp) * 100}%` }} />}
            <span className="horde-hp-text">
              {g.hp}/{g.maxHp}
              {g.shield > 0 && ` (+${g.shield})`}
            </span>
          </div>
          <div className="horde-exp">
            <div className="horde-exp-fill" style={{ width: `${(g.exp / toNext) * 100}%` }} />
          </div>
          {/* The Mega bar, for a lead that can Mega Evolve at some stage: charging, then draining while Mega Evolved. */}
          {Object.keys(setup.megas).length > 0 && (
            <div className={`horde-mega-bar${g.megaForm ? ' horde-mega-active' : ''}`}>
              <div
                className="horde-mega-fill"
                style={{
                  width: `${(g.megaForm ? Math.max(0, g.megaUntil - g.clock) / HORDE_MEGA_MS : g.megaCharge / HORDE_MEGA_CHARGE) * 100}%`
                }}
              />
            </div>
          )}
          <div className="horde-hud-stats">{statRows}</div>
        </div>
        <div className="horde-hud-clock">
          {g.endless ? (
            <>
              <span className="horde-clock horde-clock-endless">+{formatHordeTime(g.elapsed - HORDE_DURATION_MS)}</span>
              <span className="horde-hud-sub horde-endless-label">{t('horde.endless')}</span>
            </>
          ) : g.timeUp ? (
            <>
              <span className="horde-clock horde-clock-endless">0:00</span>
              <span className="horde-hud-sub horde-endless-label">{t('horde.beatFinalBoss')}</span>
            </>
          ) : (
            <span className="horde-clock">{formatHordeTime(HORDE_DURATION_MS - g.elapsed)}</span>
          )}
          <span className="horde-hud-sub">{t('horde.kos', { kos: g.kos })}</span>
          <span className="horde-hud-gold">
            <ItemSprite spritenum={HORDE_GOLD_SPRITE} className="horde-gold-icon" />
            {Math.floor(g.gold)}
          </span>
        </div>
        {/* Where the run is and what the next chest costs - only on the PC, where the bar has room. */}
        {!IS_MOBILE_LAYOUT && (
          <div className="horde-hud-place">
            <span className="horde-hud-place-name">
              <img src={locationIconUrl(setup.location)} alt="" className="horde-hud-place-icon" />
              {WILD_LOCATIONS.find((l) => l.id === setup.location)?.label}
            </span>
            <span className={`horde-hud-sub horde-hud-chest${g.gold >= chestCost ? ' horde-hud-chest-affordable' : ''}`}>
              {t('horde.chestPrice')} <ItemSprite spritenum={HORDE_GOLD_SPRITE} className="horde-gold-icon" />
              {chestCost}
            </span>
          </div>
        )}
        <div className="horde-hud-actions">
          {/* Only on a phone, where the stats don't fit in the bar. */}
          <button className="horde-btn horde-stats-btn" onClick={() => setStatsOpen(true)} disabled={!!g.outcome}>
            {t('horde.stats')}
          </button>
          <button className="horde-btn" onClick={() => setPaused(true)} disabled={!!g.outcome}>
            {t('horde.pause')}
          </button>
        </div>
      </div>
      {/* The effects on the lead right now - a row of its own across the window, kept even when empty so nothing shifts. */}
      <div className="horde-hud-effects">
        {itemBuffs.map(
          (buff) =>
            buff.until > g.clock && (
              <span key={buff.item} className="horde-hud-buff horde-hud-item" {...itemTipHandlers(buff.item)}>
                <ItemSprite spritenum={HORDE_ITEMS[buff.item].spritenum} />
                <span className="horde-hud-item-name">{t(`horde.item.${buff.item}` as MessageKey)}</span> {Math.ceil((buff.until - g.clock) / 1000)}s
              </span>
            )
        )}
        {/* The held items whose bonus grows over the run, with what it is now. */}
        {growing.map((item) => (
          <span key={item.id} className="horde-hud-buff horde-hud-item" title={itemName(HORDE_HELD_ITEMS[item.id].name)}>
            <ItemSprite spritenum={HORDE_HELD_ITEMS[item.id].spritenum} />
            {item.text}
          </span>
        ))}
        {/* The Eject Pack's rush after being hit, with the time left. */}
        {!!g.held.ejectPack && g.rushUntil > g.clock && (
          <span className="horde-hud-buff horde-hud-item">
            <ItemSprite spritenum={HORDE_HELD_ITEMS.ejectPack.spritenum} />
            <span className="horde-hud-item-name">{itemName(HORDE_HELD_ITEMS.ejectPack.name)}</span> {Math.ceil((g.rushUntil - g.clock) / 1000)}s
          </span>
        )}
        {/* A Focus Sash (another still held) and the Eject Button recharging, with the time left. */}
        {!!g.held.focusSash && g.sashReadyAt > g.clock && (
          <span className="horde-hud-buff horde-hud-item horde-hud-debuff">
            <ItemSprite spritenum={HORDE_HELD_ITEMS.focusSash.spritenum} />
            <span className="horde-hud-item-name">{itemName(HORDE_HELD_ITEMS.focusSash.name)}</span> {Math.ceil((g.sashReadyAt - g.clock) / 1000)}s
          </span>
        )}
        {!!g.held.ejectButton && g.ejectReadyAt > g.clock && (
          <span className="horde-hud-buff horde-hud-item horde-hud-debuff">
            <ItemSprite spritenum={HORDE_HELD_ITEMS.ejectButton.spritenum} />
            <span className="horde-hud-item-name">{itemName(HORDE_HELD_ITEMS.ejectButton.name)}</span> {Math.ceil((g.ejectReadyAt - g.clock) / 1000)}s
          </span>
        )}
        {g.bigNuggets > 0 && (
          <span className="horde-hud-buff horde-hud-item" {...itemTipHandlers('bigNugget')}>
            <ItemSprite spritenum={HORDE_ITEMS.bigNugget.spritenum} />×{g.bigNuggets}
          </span>
        )}
        {g.tailwind && g.tailwind.until > g.clock && (
          <span className="horde-hud-buff" style={{ '--move-color': typeColor('Flying') } as React.CSSProperties}>
            {t('horde.effect.Flying')} +{Math.round(g.tailwind.speed * 100)}%
          </span>
        )}
        {g.rage && g.rage.until > g.clock && (
          <span className="horde-hud-buff" style={{ '--move-color': typeColor('Dragon') } as React.CSSProperties}>
            {t('horde.effect.Dragon')} +{Math.round(g.rage.stacks * g.rage.per * 100)}%
          </span>
        )}
        {/* The lead's stats raised or lowered by its moves (Overheat, Close Combat...), each with the time left. */}
        {(['atk', 'def', 'spe'] as const).map((stat) => {
          const mods = g.leadMods.filter((m) => m.stat === stat && m.until > g.clock)
          const amount = Math.round(leadMod(g, stat) * 100)
          if (!mods.length || !amount) return null
          const last = mods.reduce((a, b) => (b.until > a.until ? b : a))
          return (
            <span
              key={`mod:${stat}`}
              className={`horde-hud-buff${amount < 0 ? ' horde-hud-debuff' : ''}`}
              style={{ '--move-color': typeColor(last.type ?? 'Normal') } as React.CSSProperties}
            >
              {t(STAT_KEYS[stat])} {amount > 0 ? '+' : ''}
              {amount}% {Math.ceil((last.until - g.clock) / 1000)}s
            </span>
          )
        })}
      </div>

      <div
        ref={stageRef}
        className={`horde-stage${g.now < g.shakeUntil ? ' horde-shake' : ''}`}
        style={
          {
            ...FX_VARS,
            '--horde-ground': `url('${groundTile?.url ?? backdropUrl(LOCATION_BUTTON_BACKDROP[setup.location])}')`
          } as React.CSSProperties
        }
        // Holding the mouse button or a finger on the ground walks the lead toward it.
        onPointerDown={(e) => {
          if (g.outcome) return
          pointer.current = arenaPoint(e)
          e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          if (pointer.current) pointer.current = arenaPoint(e)
        }}
        onPointerUp={() => (pointer.current = null)}
        onPointerCancel={() => (pointer.current = null)}
      >
        {boss && (
          <div className="horde-boss-bar">
            <span>
              {(() => {
                const name = boss.gmax ? t('horde.gmaxName', { name: boss.sp.species }) : boss.sp.species
                return boss.final ? t('horde.finalBoss', { name }) : t('horde.boss', { name })
              })()}
              <span className="horde-boss-speed">{t('horde.bossSpeed', { speed: bossRamp(g, boss).walk.toFixed(1) })}</span>
            </span>
            <div className="horde-boss-hp">
              <div style={{ width: `${(boss.hp / boss.maxHp) * 100}%` }} />
            </div>
          </div>
        )}
        {/* The held items from chests with how many of each, in the scene's top-left corner (on a
            phone they live in the pause menu instead). */}
        {!IS_MOBILE_LAYOUT && HORDE_HELD_IDS.some((id) => g.held[id]) && (
          <div className="horde-held" onPointerDown={(e) => e.stopPropagation()}>
            {HORDE_HELD_IDS.filter((id) => g.held[id]).map((id) => (
              <RarityCard key={id} tier={HORDE_HELD_ITEMS[id].rarity} className="horde-held-item">
                <span {...tipHandlers(`held:${id}`, true)}>
                  <ItemSprite spritenum={HORDE_HELD_ITEMS[id].spritenum} />
                </span>
                {(g.held[id] ?? 0) > 1 && <span className="horde-held-count">×{g.held[id]}</span>}
              </RarityCard>
            ))}
          </div>
        )}
        <div
          className={`horde-world${groundTile ? ' horde-world-tiled' : ''}`}
          style={
            {
              width: `${(g.worldW / g.width) * 100}%`,
              height: `${(g.worldH / HORDE_ARENA_HEIGHT) * 100}%`,
              transform: `translate(${(-g.camX / g.worldW) * 100}%, ${(-g.camY / g.worldH) * 100}%)`,
              // A floor tile repeats at a set size (each of its pixels so many arena units);
              // a backdrop instead tiles across the field, one screen a tile.
              '--horde-tile-w': groundTile
                ? `${((groundTile.px * HORDE_GROUND_UNITS_PER_PX) / g.worldW) * 100}%`
                : `${(g.width / g.worldW) * 100}%`,
              '--horde-tile-h': groundTile
                ? `${((groundTile.px * HORDE_GROUND_UNITS_PER_PX) / g.worldH) * 100}%`
                : `${(HORDE_ARENA_HEIGHT / g.worldH) * 100}%`
            } as React.CSSProperties
          }
        >
        {/* The chests about the field, each with its price - the one the lead stands by lit up. */}
        {g.chests.map((chest) => (
          <span
            key={chest.id}
            className={`horde-chest${nearChest === chest ? ' horde-chest-near' : ''}${g.gold >= chestCost ? ' horde-chest-affordable' : ''}`}
            style={{ ...place(chest.x, chest.y), zIndex: depth(chest.y) }}
            onPointerDown={(e) => {
              // Tapping the chest the lead stands by opens it.
              if (nearChest !== chest) return
              e.stopPropagation()
              openChest()
            }}
          >
            <ItemSprite spritenum={HORDE_CHEST_SPRITE} className="horde-chest-sprite" />
            <span className="horde-chest-price">
              <ItemSprite spritenum={HORDE_GOLD_SPRITE} className="horde-gold-icon" />
              {chestCost}
            </span>
          </span>
        ))}
        {/* A Tapu Ruin's circle, filling as the lead stands in it. */}
        {g.shrines.map(
          (s) =>
            s.kind === 'tapu' && (
              <div
                key={`ring-${s.id}`}
                className={`horde-tapu-ring${dist(s.x, s.y, g.px, g.py) <= HORDE_TAPU_RADIUS ? ' horde-tapu-ring-in' : ''}`}
                style={{ ...circle(s.x, s.y, HORDE_TAPU_RADIUS), '--tapu-fill': s.heldMs / HORDE_TAPU_HOLD_MS } as React.CSSProperties}
              />
            )
        )}
        {/* The shrines, each with what it is and how it's going - a Totem Trial the lead stands by lit up. */}
        {g.shrines.map((s) => (
          <span
            key={s.id}
            className={`horde-shrine horde-shrine-${s.kind}${nearShrine === s ? ' horde-shrine-near' : ''}${s.started ? ' horde-shrine-active' : ''}`}
            style={{ ...place(s.x, s.y), zIndex: depth(s.y) }}
            onPointerDown={(e) => {
              // Tapping the Totem Trial the lead stands by starts it.
              if (nearShrine !== s) return
              e.stopPropagation()
              interact()
            }}
          >
            <img src={HORDE_SHRINE_ICON} className="horde-shrine-icon" alt="" />
            <span className="horde-shrine-label">
              {s.kind === 'totem'
                ? s.started
                  ? t('horde.shrine.totemLeft', { count: totemLeft(s) })
                  : t('horde.shrine.totem')
                : s.heldMs > 0
                  ? `${t('horde.shrine.tapu')} ${Math.floor((s.heldMs / HORDE_TAPU_HOLD_MS) * 100)}%`
                  : t('horde.shrine.tapu')}
            </span>
          </span>
        ))}
        {(() => {
          // The range rings round the lead, all of them unless switched off; a ring a pick just grew lights up.
          const flashing = (ring: RingKind): boolean => rings && g.now - ringFlash[ring] < RING_FLASH_MS
          const ringClass = (base: string, ring?: RingKind): string =>
            `${base}${rings ? '' : ' horde-ring-hidden'}${ring && flashing(ring) ? ' horde-ring-flash' : ''}`
          const hot = g.foes.some((f) => f.faintedAt === null && f.stopped)
          const hasMelee = g.known.some((k) => hordeMoveShape(k.move) === 'melee')
          return (
            <>
              <div className={ringClass('horde-spread-ring', 'spread')} style={circle(g.px, g.py, spreadRadius(g))} />
              {/* How far melee moves reach - only with one known. */}
              {hasMelee && (
                <div
                  className={ringClass('horde-melee-ring', 'melee')}
                  style={circle(g.px, g.py, meleeRadius(g))}
                />
              )}
              {/* The lead's hitbox: a wild Pokemon can hit it once its circle touches this one. */}
              <div
                className={ringClass(`horde-hitbox horde-hitbox-lead${hot ? ' horde-hitbox-hot' : ''}`)}
                style={circle(g.px, g.py, HORDE_LEAD_HITBOX)}
              />
              {/* How far off experience and items are picked up. */}
              <div
                className={ringClass('horde-pickup-ring', 'pickup')}
                style={circle(g.px, g.py, pickupRange(g))}
              />
            </>
          )
        })()}
        {g.foes.map(
          (foe) =>
            foe.faintedAt === null &&
            risen(g, foe) && (
              <div
                key={foe.id}
                className={`horde-hitbox${foe.stopped ? ' horde-hitbox-hot' : ''}`}
                style={circle(foe.x, foe.y, HORDE_FOE_HITBOX[foe.kind])}
              />
            )
        )}

        {/* Ground moves left behind: a pool in their type's colour, fading as it runs out. */}
        {moveAnims && g.zones.map((z) => (
          <div
            key={z.id}
            className={`horde-fx-zone horde-fx-zone-${z.known.move.type.toLowerCase()}${z.drift ? ' horde-fx-zone-whirl' : ''}${z.slow ? ' horde-fx-zone-slow' : ''}`}
            style={
              {
                ...circle(z.x, z.y, z.reach),
                '--move-color': typeColor(z.known.move.type),
                '--zone-left': Math.max(0, Math.min(1, (z.until - g.clock) / Math.max(1, z.until - z.born)))
              } as React.CSSProperties
            }
          />
        ))}

        {/* Experience and items on the ground. */}
        {g.drops.map((drop) =>
          drop.item ? (
            <span
              key={drop.id}
              className={`horde-drop horde-drop-item${drop.pulled ? ' horde-drop-pulled' : ''}${
                !drop.pulled && drop.item !== 'chest' && g.clock - drop.born >= HORDE_ITEM_FLASH_MS ? ' horde-drop-expiring' : ''
              }`}
              style={place(drop.x, drop.y)}
            >
              <ItemSprite spritenum={HORDE_ITEMS[drop.item].spritenum} />
            </span>
          ) : (
            <span
              key={drop.id}
              className={`horde-drop horde-gem${
                drop.mega ? ' horde-gem-mega' : drop.exp >= HORDE_KO_EXP.boss ? ' horde-gem-boss' : drop.exp >= HORDE_KO_EXP.elite ? ' horde-gem-elite' : ''
              }`}
              style={place(drop.x, drop.y)}
            />
          )
        )}

        <div
          className={`horde-unit horde-player horde-size-${leadForm(g).size.toLowerCase()}${lunging ? ' horde-lunge' : ''}${hurting ? ' horde-hurt' : ''}${
            g.dash ? ' horde-dashing' : ''
          }${g.burrow ? ' horde-burrowed' : ''}${g.known.some((k) => k.chargeUntil !== undefined) ? ' horde-charging' : ''}${
            g.known.some((k) => k.rampUntil !== undefined && k.rampUntil > g.clock) ? ' horde-raging' : ''
          }`}
          style={
            {
              ...place(g.px + dashOut.x, g.py + dashOut.y),
              zIndex: depth(g.py + dashOut.y),
              // Sprites face left; flipped, it faces right.
              '--face': -g.facing,
              '--lunge-x': `${lunge.x}px`,
              '--lunge-y': `${lunge.y}px`,
              // The colour of whatever it's charging up or rampaging with.
              '--move-color': typeColor(
                g.known.find((k) => k.chargeUntil !== undefined || (k.rampUntil !== undefined && k.rampUntil > g.clock))?.move.type ??
                  g.burrow?.known.move.type ??
                  g.lastMove?.type ??
                  'Normal'
              )
            } as React.CSSProperties
          }
        >
          <SpriteImage
            key={leadForm(g).spriteId}
            style={spriteStyle}
            spriteId={leadForm(g).spriteId}
            shiny={fighter.shiny}
            className={`horde-sprite${g.evolved || g.megaForm ? ' horde-evolved' : ''}${g.megaForm ? ' horde-mega-sprite' : ''}`}
            draggable={false}
          />
          {/* Its HP (and shield) just under its feet. */}
          <div className="horde-lead-hp">
            <div
              className={`horde-lead-hp-fill${hpShare <= 0.2 ? ' horde-hp-red' : hpShare <= 0.5 ? ' horde-hp-yellow' : ''}`}
              style={{ width: `${hpShare * 100}%` }}
            />
            {g.shield > 0 && <div className="horde-lead-hp-shield" style={{ width: `${Math.min(1, g.shield / g.maxHp) * 100}%` }} />}
          </div>
          {g.lastMove && g.now - g.lastMove.at < 700 && (
            <span
              key={g.lastMove.at}
              className="horde-move-call"
              style={
                {
                  '--move-color': typeColor(g.lastMove.type)
                } as React.CSSProperties
              }
            >
              {moveName(g.lastMove.name)}
            </span>
          )}
        </div>

        {/* Stealth Rock: a few of the battle screen's Stealth Rock pieces scattered on the spot. */}
        {g.rocks.map((rock) => (
          <span key={rock.id} className="horde-rock" style={place(rock.x, rock.y)}>
            {ROCK_PIECES.map((p, i) => (
              <img
                key={i}
                src={`./battle/fx/${p.image}.png`}
                alt=""
                draggable={false}
                style={{ left: `calc(50% + ${p.dx}px)`, top: `calc(50% + ${p.dy}px)`, width: p.width }}
              />
            ))}
          </span>
        ))}

        {g.foes.map((foe) => {
          const on = foe.faintedAt === null ? effectTypesOn(foe.fx, g.clock) : []
          return (
            <div
              key={foe.id}
              className={`horde-unit horde-foe horde-foe-${foe.kind} horde-size-${foe.sp.size.toLowerCase()}${foe.gmax ? ' horde-foe-gmax' : ''}${foe.totem ? ' horde-foe-totem' : ''}${foe.faintedAt !== null ? ' horde-fainted' : ''}${
                hitEffects && g.now < foe.flashUntil ? ' horde-flash' : ''
              }${g.focusId === foe.id ? ' horde-focused' : ''}${foe.fx.frozenUntil > g.clock ? ' horde-frozen' : ''}${
                foe.fx.stopUntil > g.clock ? ' horde-stopped' : ''
              }${foe.fx.spookedUntil > g.clock ? ' horde-fleeing' : ''}${foe.fx.confusedUntil > g.clock ? ' horde-confused' : ''}${
                foe.faintedAt === null && foe.stopped ? ' horde-in-reach' : ''
              }${foe.slide ? ' horde-sliding' : ''}${foe.faintedAt === null && !risen(g, foe) ? ' horde-rising' : ''}${
                foe.exploder ? ' horde-foe-exploder' : ''
              }${foe.fuseAt !== undefined && foe.faintedAt === null ? ' horde-fusing' : ''}`}
              style={
                {
                  ...place(foe.x, foe.y),
                  zIndex: depth(foe.y),
                  '--rise': risen(g, foe) ? 1 : Math.max(0, 1 - (foe.risingUntil - g.clock) / (foe.riseMs ?? HORDE_RISE_MS)),
                  // It faces the lead - or away from it while fleeing.
                  '--face': (foe.x < g.px) !== foe.fx.spookedUntil > g.clock ? -1 : 1
                } as React.CSSProperties
              }
              onPointerDown={(e) => {
                // Picking a target, not walking.
                e.stopPropagation()
                if (foe.faintedAt === null) g.focusId = g.focusId === foe.id ? null : foe.id
              }}
            >
              {/* Coming up out of the ground: a patch of dirt under it, kicking up dust. */}
              {!risen(g, foe) && <span className="horde-rise-dirt" />}
              <SpriteImage style={spriteStyle} spriteId={foe.sp.spriteId} gmax={foe.gmax} className="horde-sprite" draggable={false} />
              <div className="horde-foe-hp">
                <div style={{ width: `${(foe.hp / foe.maxHp) * 100}%` }} />
              </div>
              {on.length > 0 && (
                <div className="horde-foe-effects">
                  {on.map((type) => (
                    <span key={type} style={{ background: typeColor(type) }} />
                  ))}
                </div>
              )}
              {foe.kind !== 'wild' && <span className="horde-foe-level">{t('horde.lv', { level: foe.level })}</span>}
            </div>
          )
        })}

        {/* Knocked-out exploders' bodies, burning down. */}
        {g.bombs.map((bomb) => (
          <div
            key={bomb.id}
            className={`horde-unit horde-foe horde-foe-${bomb.kind} horde-size-${bomb.sp.size.toLowerCase()} horde-foe-exploder horde-fusing horde-bomb`}
            style={
              {
                ...place(bomb.x, bomb.y),
                zIndex: depth(bomb.y),
                '--face': bomb.x < g.px ? -1 : 1
              } as React.CSSProperties
            }
          >
            <SpriteImage style={spriteStyle} spriteId={bomb.sp.spriteId} className="horde-sprite" draggable={false} />
          </div>
        ))}
        {g.bombs.map((bomb) => (
          <div
            key={`fuse-${bomb.id}`}
            className="horde-fuse-ring"
            style={
              {
                ...circle(bomb.x, bomb.y, HORDE_EXPLODER_REACH),
                '--fuse': Math.min(1, Math.max(0, 1 - (bomb.fuseAt - g.clock) / HORDE_EXPLODER_FUSE_MS))
              } as React.CSSProperties
            }
          />
        ))}
        {/* A lit exploder's blast reach, filling in as its fuse burns down. */}
        {g.foes.map((foe) =>
          foe.fuseAt !== undefined && foe.faintedAt === null ? (
            <div
              key={`fuse-${foe.id}`}
              className="horde-fuse-ring"
              style={
                {
                  ...circle(foe.x, foe.y, HORDE_EXPLODER_REACH),
                  '--fuse': Math.min(1, Math.max(0, 1 - (foe.fuseAt - g.clock) / HORDE_EXPLODER_FUSE_MS))
                } as React.CSSProperties
              }
            />
          ) : null
        )}
        {moveAnims && g.shots.map((shot) => (
          <span
            key={shot.id}
            className={`horde-shot horde-shot-${hordeMoveBand(shot.known.move)}${hordeShotClass(animOf(shot.known))}${shot.small ? ' horde-shot-small' : ''}${
              shot.blast ? ' horde-shot-blast' : ''
            }${shot.pierce ? ' horde-shot-pierce' : ''}${shot.hitIds ? ' horde-shot-hop' : ''}`}
            style={
              {
                ...place(shot.x, shot.y),
                // Centred first, then turned and grown round its middle (the separate rotate/scale
                // properties would also grow the centring offset and pull a big shot off its spot).
                transform: shot.pierce
                  ? `translate(-50%, -50%) rotate(${Math.atan2(shot.pierce.dy, shot.pierce.dx)}rad) scale(${shot.pierce.size})`
                  : undefined,
                '--move-color': typeColor(shot.known.move.type)
              } as React.CSSProperties
            }
          />
        ))}
        {moveAnims &&
          g.orbs.flatMap((orb) =>
            orbSpots(g, orb).map((at, i) => (
              <span
                key={`${orb.id}-${i}`}
                className="horde-fx-orb"
                style={{ ...place(at.x, at.y), '--move-color': typeColor(orb.known.move.type) } as React.CSSProperties}
              />
            ))
          )}
        {moveAnims && g.arcs.map((arc) => (
          <span
            key={arc.id}
            className="horde-arc"
            style={
              {
                ...place(arc.x1, arc.y1),
                width: `${dist(arc.x1, arc.y1, arc.x2, arc.y2) * g.unitPx}px`,
                rotate: `${Math.atan2(arc.y2 - arc.y1, arc.x2 - arc.x1)}rad`,
                '--move-color': typeColor(arc.type)
              } as React.CSSProperties
            }
          />
        ))}
        {moveAnims && g.waves.filter((wave) => g.clock >= wave.born).map((wave) => (
          <div
            key={wave.id}
            className={`horde-wave${wave.follow ? ' horde-fx-aftershock' : ''}`}
            style={
              {
                ...circle(g.px, g.py, spreadRadius(g) * (wave.reach ?? 1)),
                '--move-color': typeColor(wave.known.move.type),
                '--wave-ms': `${HORDE_SPREAD_WAVE_MS}ms`
              } as React.CSSProperties
            }
          />
        ))}
        {moveAnims && g.beams.map((beam) => (
          <span
            key={beam.id}
            className="horde-beam"
            style={
              {
                ...(beam.from ? place(beam.from.x, beam.from.y) : place(g.px, g.py - BODY_HEIGHT)),
                width: `${(beam.length ?? HORDE_SHAPES.beamLength * reachScale(beam.known) * ownReach(beam.known)) * g.unitPx}px`,
                height: `${(beam.width ?? HORDE_SHAPES.beamWidth * beamWidthScale(beam.known)) * g.unitPx}px`,
                rotate: `${Math.atan2(beam.dy, beam.dx)}rad`,
                '--move-color': typeColor(beam.known.move.type),
                '--beam-ms': `${HORDE_SHAPES.beamMs * (beam.part ?? 1)}ms`
              } as React.CSSProperties
            }
          >
            {/* Its reach's outline, a soft glow, the bright flowing core, a flare at the lead's end
                and a ring marking where its reach ends. */}
            <span className="horde-beam-edge" />
            <span className="horde-beam-glow" />
            <span className="horde-beam-flow" />
            <span className="horde-beam-mouth" />
            <span className="horde-beam-end" />
          </span>
        ))}
        {moveAnims && g.strikes.map((s) => {
          // Coming down on its foe: a streak falling from above onto a mark at its feet.
          const foe = g.foes.find((f) => f.id === s.targetId)
          const fall = s.fallMs ?? HORDE_SHAPES.strikeDelayMs
          if (!foe || g.clock < s.landsAt - fall) return null
          return (
            <HordeStrikeFx
              key={s.id}
              anim={animOf(s.known)}
              style={
                {
                  ...place(foe.x, foe.y),
                  '--move-color': typeColor(s.known.move.type),
                  '--strike-ms': `${fall}ms`,
                  // How far through its fall it is, so one drawn late doesn't start over.
                  '--fall-delay': `${-Math.max(0, fall - (s.landsAt - g.clock))}ms`
                } as React.CSSProperties
              }
            />
          )
        })}
        {/* An exploder's blast shows even with move animations off. */}
        {g.flashes.filter((f) => moveAnims || f.kind === 'boom').map((f) =>
          f.kind === 'cone' ? (
            <div
              key={f.id}
              className="horde-cone"
              style={
                {
                  ...circle(f.x, f.y, f.reach ?? HORDE_SHAPES.coneReach),
                  '--move-color': typeColor(f.type),
                  '--cone-from': `${Math.atan2(f.dy, f.dx) + Math.PI / 2 - HORDE_SHAPES.coneAngle / 2}rad`,
                  '--cone-angle': `${HORDE_SHAPES.coneAngle}rad`
                } as React.CSSProperties
              }
            />
          ) : f.kind === 'boom' ? (
            // A flash, a fireball swelling out over the blast's reach, and smoke drifting off -
            // each blast's fireball picked and turned by its id, so a chain of them doesn't look the same.
            <div
              key={f.id}
              className="horde-boom"
              style={
                {
                  ...circle(f.x, f.y, f.reach ?? HORDE_EXPLODER_REACH),
                  '--boom-img': fxUrl(`explosion-${f.id % BOOM_FIREBALLS}`),
                  '--boom-turn': `${(f.id * 137) % 360}deg`
                } as React.CSSProperties
              }
            >
              <span className="horde-boom-flash" />
            </div>
          ) : f.kind === 'hop' ? (
            <div key={f.id} className="horde-hop" style={{ ...circle(f.x, f.y, 40), '--move-color': typeColor(f.type) } as React.CSSProperties} />
          ) : f.kind === 'bolt' || f.kind === 'erupt' || f.kind === 'crater' || f.kind === 'vortex' || f.kind === 'mark' ? (
            <HordeFlashFx
              key={f.id}
              kind={f.kind}
              anim={f.anim}
              seed={f.id}
              // A bolt reaches down from the top of the screen.
              heightPx={(f.y - g.camY) * g.unitPx}
              style={{ ...place(f.x, f.y), '--move-color': typeColor(f.type) } as React.CSSProperties}
            />
          ) : (
            <div
              key={f.id}
              className={f.kind === 'blast' ? 'horde-blast' : 'horde-strike-hit'}
              style={
                {
                  ...circle(f.x, f.y, f.kind === 'blast' ? (f.reach ?? HORDE_SHAPES.blastReach) : 45),
                  '--move-color': typeColor(f.type)
                } as React.CSSProperties
              }
            />
          )
        )}
        {hitEffects && g.bursts.map((b) => (
          <span
            key={b.id}
            className={`horde-burst${b.spread ? ' horde-burst-spread' : ''}`}
            style={
              {
                ...place(b.x, b.y),
                '--burst-color': typeColor(b.type)
              } as React.CSSProperties
            }
          />
        ))}
        {g.popups.map((p) => (
          <span
            key={p.id}
            className={`horde-popup horde-popup-${p.kind}`}
            style={{
              ...place(p.x, p.y),
              color: p.color
            }}
          >
            {p.text}
          </span>
        ))}
        </div>

        {/* Floating at the top of the scene, under the top bar: each Totem Trial under way with
            how many of its callers are left, then a shrine's reward for a while once done. */}
        {!g.outcome && (
          <div className="horde-shrine-top">
            {g.shrines
              .filter((s) => s.kind === 'totem' && s.started)
              .map((s) => (
                <div key={s.id} className="horde-shrine-tracker">
                  <img src={HORDE_SHRINE_ICON} className="horde-shrine-tracker-icon" alt="" />
                  <b>{t('horde.shrine.totem')}</b>
                  <span>{t('horde.shrine.totemLeft', { count: totemLeft(s) })}</span>
                </div>
              ))}
            {g.shrineBanner && g.shrineBanner.until > g.clock && (
              <div key={g.shrineBanner.until} className={`horde-shrine-banner horde-shrine-banner-${g.shrineBanner.kind}`}>
                <img src={HORDE_SHRINE_ICON} className="horde-shrine-banner-icon" alt="" />
                <div className="horde-shrine-banner-text">
                  <b className="horde-shrine-banner-title">{g.shrineBanner.title}</b>
                  {g.shrineBanner.lines.map((line) => (
                    <span key={line} className="horde-shrine-banner-line">
                      {line}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Standing by a Totem Trial not yet started: how to start it. */}
        {nearShrine && !g.outcome && (
          <button
            className="horde-btn horde-btn-primary horde-chest-open-btn"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={interact}
          >
            {t('horde.shrine.totemStartBtn')}
            <span className="horde-chest-key">E</span>
          </button>
        )}

        {/* Standing by a chest: what it costs, and how to open it. */}
        {nearChest && !nearShrine && !g.outcome && (
          <button
            className={`horde-btn horde-chest-open-btn${g.gold >= chestCost ? ' horde-btn-primary' : ''}`}
            // Kept from the stage under it, which would grab the pointer to walk the lead and swallow the click.
            onPointerDown={(e) => e.stopPropagation()}
            onClick={openChest}
          >
            {t('horde.openChest')} <ItemSprite spritenum={HORDE_GOLD_SPRITE} className="horde-gold-icon" />
            {chestCost}
            <span className="horde-chest-key">E</span>
          </button>
        )}

        {/* The nearest chest while it's off screen: an arrow at the screen's edge pointing to it. */}
        {nextChest && !onScreen(g, nextChest) && edgeArrow(nextChest, 'horde-chest-arrow', <ItemSprite spritenum={HORDE_CHEST_SPRITE} />)}
        {/* The nearest shrine while it's off screen, the same way. */}
        {nextShrine &&
          !onScreen(g, nextShrine) &&
          edgeArrow(nextShrine, 'horde-chest-arrow horde-shrine-arrow', <img src={HORDE_SHRINE_ICON} className="horde-shrine-arrow-icon" alt="" />)}

        {/* The minimap: the whole field, the screen's box on it, the lead, the chests, and the elites and bosses. */}
        <div className="horde-minimap" style={{ aspectRatio: `${g.worldW} / ${g.worldH}` }}>
          <span
            className="horde-minimap-view"
            style={{
              left: `${(g.camX / g.worldW) * 100}%`,
              top: `${(g.camY / g.worldH) * 100}%`,
              width: `${(g.width / g.worldW) * 100}%`,
              height: `${(HORDE_ARENA_HEIGHT / g.worldH) * 100}%`
            }}
          />
          {g.chests.map((c) => (
            <span key={c.id} className="horde-minimap-dot horde-minimap-chest" style={place(c.x, c.y)} />
          ))}
          {g.shrines.map((s) => (
            <span key={s.id} className={`horde-minimap-dot horde-minimap-shrine horde-minimap-shrine-${s.kind}`} style={place(s.x, s.y)} />
          ))}
          {g.foes.map(
            (f) =>
              f.kind !== 'wild' &&
              f.faintedAt === null && <span key={f.id} className={`horde-minimap-dot horde-minimap-${f.kind}`} style={place(f.x, f.y)} />
          )}
          <span className="horde-minimap-dot horde-minimap-lead" style={place(g.px, g.py)} />
        </div>
      </div>

      <div className="horde-moves">
        {g.known.map((known, i) => {
          const cooldown = leadCooldown(g, known)
          const ready = 1 - g.cooldowns[i] / cooldown
          return (
            <div
              key={known.move.id}
              className="horde-move"
              {...(IS_MOBILE_LAYOUT ? {} : tipHandlers(`move:${i}`))}
              onClick={
                IS_MOBILE_LAYOUT
                  ? (ev) => {
                      const key = `move:${i}`
                      if (loadoutTip?.key === key) setLoadoutTip(null)
                      else tipAt(key, ev.currentTarget)
                    }
                  : undefined
              }
              style={
                {
                  '--move-color': typeColor(known.move.type)
                } as React.CSSProperties
              }
            >
              <div className="horde-move-fill" style={{ width: `${Math.min(1, Math.max(0, ready)) * 100}%` }} />
              <span className="horde-move-name">
                {moveName(known.move.name)}
                {known.upgrades > 0 && <span className="horde-move-rank"> {t('horde.upgrades', { count: known.upgrades })}</span>}
              </span>
              <span className="horde-move-meta">
                <span className="horde-move-tag">{t(`horde.shape.${hordeMoveShape(known.move)}` as MessageKey)}</span>
                {effectChance(known.move) > 0 && (
                  <span className="horde-move-tag horde-move-effect">
                    {t(`horde.effect.${known.move.type}` as MessageKey)} {effectChance(known.move)}%
                  </span>
                )}
                {hordeMovePower(known.move, known.power)} · {(cooldown / 1000).toFixed(1)}s
              </span>
            </div>
          )
        })}
        {/* The move slots still empty. */}
        {Array.from({ length: Math.max(0, HORDE_MAX_MOVES - g.known.length) }, (_, i) => (
          <div key={`empty-${i}`} className="horde-move horde-slot-empty">
            <span className="horde-move-name">{t('horde.emptyMove')}</span>
          </div>
        ))}
      </div>

      {/* The tome slots, and the held items from chests with how many of each. */}
      <div className="horde-loadout">
        <div className="horde-tomes">
          {Array.from({ length: HORDE_MAX_TOMES }, (_, i) => {
            const tome = g.tomes[i]
            return tome ? (
              <span
                key={tome.stat}
                className="horde-tome"
                {...(IS_MOBILE_LAYOUT ? {} : tipHandlers(`tome:${tome.stat}`))}
                onClick={
                  IS_MOBILE_LAYOUT
                    ? (ev) => {
                        const key = `tome:${tome.stat}`
                        if (loadoutTip?.key === key) setLoadoutTip(null)
                        else tipAt(key, ev.currentTarget)
                      }
                    : undefined
                }
              >
                <span className="horde-tome-name">{t(ABILITY_KEYS[tome.stat])}</span>
                <b className="horde-tome-rank">{tome.ranks}</b>
              </span>
            ) : (
              <span key={`empty-${i}`} className="horde-tome horde-slot-empty">
                <span className="horde-tome-name">{t('horde.emptyTome')}</span>
              </span>
            )
          })}
        </div>
        {/* The type effects its moves bring, by name - hovering one shows what it does at each count of moves. */}
        {effectTypes.length > 0 && (
          <div className="horde-effects">
            {effectTypes.map((type) => {
              const rank = effectRank(g, type)
              return (
                <span
                  key={type}
                  className={`horde-effect${rank.bonus ? ' horde-effect-bonus' : ''}${rank.mastery ? ' horde-effect-mastery' : ''}`}
                  style={{ '--move-color': typeColor(type) } as React.CSSProperties}
                  {...tipHandlers(`effect:${type}`)}
                >
                  <span className="horde-effect-name">{t(`horde.effect.${type}` as MessageKey)}</span>
                  <span className="horde-effect-pips">
                    {Array.from({ length: HORDE_EFFECT_MASTERY_MOVES }, (_, i) => (
                      <span key={i} className={i < rank.moves ? 'on' : ''} />
                    ))}
                  </span>
                </span>
              )
            })}
          </div>
        )}
      </div>
      {loadoutTip && (!tipItem || tipItemShown) && (
        <div
          className={`horde-tip${loadoutTip.key.startsWith('move:') || loadoutTip.key.startsWith('tome:') ? ' horde-tip-move' : ''}`}
          style={{ left: loadoutTip.left, bottom: loadoutTip.bottom, top: loadoutTip.top }}
        >
          {tipItem
            ? itemTip(tipItem)
            : loadoutTip.key.startsWith('effect:')
            ? effectTip(loadoutTip.key.slice('effect:'.length))
            : loadoutTip.key.startsWith('tome:')
              ? tomeTip(loadoutTip.key.slice('tome:'.length) as HordeStat)
              : loadoutTip.key.startsWith('move:')
              ? g.known[Number(loadoutTip.key.slice('move:'.length))] && moveTip(g.known[Number(loadoutTip.key.slice('move:'.length))])
              : heldTip(loadoutTip.key.slice('held:'.length) as HordeHeldId)}
        </div>
      )}

      {chestItems && !g.outcome && (
        <HordeChestOpen
          items={chestItems}
          held={g.held}
          onDone={() => {
            setChestItems(null)
          }}
        />
      )}

      {choices && !g.outcome && (
        <div className="horde-overlay">
          <div className="horde-choices">
            <h2>
              {choices.evolution
                ? t('horde.evolvedTitle', { name: g.form.species })
                : t('horde.levelUp', {
                    level: g.level - g.pendingChoices.length + 1
                  })}
            </h2>
            {choices.evolution && <p className="horde-choices-note">{t('horde.evolvedNote')}</p>}
            <div className="horde-choice-row">{choices.list.map(choiceCard)}</div>
            <div className="horde-choice-actions">
              <button className="horde-action horde-action-reroll" disabled={g.rerolls <= 0} onClick={rerollChoices}>
                <span className="horde-action-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12a8 8 0 1 1-2.34-5.66" /><path d="M20 4v5h-5" /></svg>
                </span>
                {t('horde.reroll')}
                <span className="horde-action-count">{g.rerolls}</span>
              </button>
              {!choices.list.every((c) => c.rarity === 'legendary') && (
                <button
                  className="horde-action horde-action-rarity"
                  disabled={g.gold < hordeRarityUpCost(g.rarityUps)}
                  title={t('horde.rarityUpTip')}
                  onClick={raiseRarity}
                >
                  <span className="horde-action-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 15l6-6 6 6" /><path d="M6 20l6-6 6 6" /></svg>
                  </span>
                  {t('horde.rarityUp')}
                  <span className={`horde-action-count horde-action-price${g.gold < hordeRarityUpCost(g.rarityUps) ? ' horde-action-price-short' : ''}`}>
                    <ItemSprite spritenum={HORDE_GOLD_SPRITE} className="horde-gold-icon" />
                    {hordeRarityUpCost(g.rarityUps)}
                  </span>
                </button>
              )}
              <button
                className={`horde-action horde-action-delete${deleting ? ' horde-action-on' : ''}`}
                disabled={g.moveDeletes <= 0 || g.known.length <= 1}
                title={t('horde.moveDeleterTip')}
                onClick={() => setDeleting((d) => !d)}
              >
                <span className="horde-action-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                </span>
                {t('horde.moveDeleter')}
                <span className="horde-action-count">{g.moveDeletes}</span>
              </button>
              <button className="horde-action horde-action-skip" onClick={skipChoice}>
                {t('horde.skip')}
                <span className="horde-action-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l6 6-6 6M13 6l6 6-6 6" /></svg>
                </span>
              </button>
              {g.banishes > 0 && <span className="horde-banish-count">{t('horde.banishesLeft', { count: g.banishes })}</span>}
            </div>
            {deleting && g.moveDeletes > 0 && (
              <div className="horde-move-deleter">
                <span>{t('horde.moveDeleterPick')}</span>
                {g.known.map((k, i) => (
                  <button key={k.move.name} className="horde-btn" onClick={() => deleteMove(i)}>
                    {moveName(k.move.name)}
                  </button>
                ))}
                <button className="horde-btn" onClick={() => setDeleting(false)}>
                  {t('horde.moveDeleterCancel')}
                </button>
              </div>
            )}
            <div className="horde-odds">
              {t('horde.oddsLabel', { luck: luckOf(g) })}
              {HORDE_RARITIES.map((r) => (
                <span key={r} className={`horde-odds-tier rarity-tier-${r}`}>
                  {t(RARITY_KEYS[r])} {(odds[r] * 100).toFixed(odds[r] < 0.1 ? 1 : 0)}%
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {statsOpen && !paused && !choices && !g.outcome && (
        <div className="horde-overlay" onClick={() => setStatsOpen(false)}>
          <div className="horde-panel horde-stats-panel" onClick={(e) => e.stopPropagation()}>
            <h2>
              {leadForm(g).species} <span className="horde-hud-level">{t('horde.lv', { level: g.level })}</span>
            </h2>
            <div className="horde-stats-list">
              <span>
                {t(STAT_KEYS.hp)}{' '}
                <b>
                  {g.hp}/{g.maxHp}
                  {g.shield > 0 && ` (+${g.shield})`}
                </b>
              </span>
              {statRows}
            </div>
            <button className="horde-btn horde-btn-primary" onClick={() => setStatsOpen(false)}>
              {t('horde.resume')}
            </button>
          </div>
        </div>
      )}

      {paused && !g.outcome && (
        <div className="horde-overlay horde-pause">
          <div className="horde-panel horde-pause-panel">
            <h2>{t('horde.paused')}</h2>
            {/* The level-up choices taken and the held items, each in a window of its own. */}
            <div className="horde-pause-list-btns">
              <button className="horde-btn" onClick={() => setPauseList('log')}>
                {t('horde.log')}
              </button>
              <button className="horde-btn" onClick={() => setPauseList('held')}>
                {t('horde.effectsItems', { count: HORDE_HELD_IDS.reduce((sum, id) => sum + (g.held[id] ?? 0), 0) })}
              </button>
            </div>
            {logTip && (
              <RarityCard
                tier={logTip.card.rarity}
                framed
                className={`horde-choice horde-log-tip ${cardClass(logTip.card)}`}
                style={{ left: logTip.left, top: logTip.top }}
              >
                {cardBody(logTip.card)}
              </RarityCard>
            )}
            {/* Display switches, kept per computer. */}
            <div className="horde-pause-toggles">
              <PauseToggle
                label={t('horde.damageNumbers')}
                on={damageNumbers}
                onChange={(on) => {
                  setDamageNumbers(on)
                  savePref('horde.damageNumbers', on)
                  // Switched off: clear the ones already floating too.
                  if (!on) g.popups = g.popups.filter((p) => !DAMAGE_POPUPS.includes(p.kind))
                }}
              />
              <PauseToggle
                label={t('horde.hitEffects')}
                on={hitEffects}
                onChange={(on) => {
                  setHitEffects(on)
                  savePref('horde.hitEffects', on)
                }}
              />
              <PauseToggle
                label={t('horde.hitSounds')}
                on={hitSounds}
                onChange={(on) => {
                  setHitSounds(on)
                  setHitSoundsOn('horde', on)
                }}
              />
              <PauseToggle
                label={t('horde.expPull')}
                on={expPull}
                onChange={(on) => {
                  setExpPull(on)
                  savePref('horde.expPull', on)
                }}
              />
              <PauseToggle
                label={t('horde.moveAnims')}
                on={moveAnims}
                onChange={(on) => {
                  setMoveAnims(on)
                  savePref('horde.moveAnims', on)
                }}
              />
              <PauseToggle
                label={t('horde.rings')}
                on={rings}
                onChange={(on) => {
                  setRings(on)
                  savePref('horde.ringsOn', on)
                }}
              />
            </div>
            <button className="horde-btn horde-btn-primary" disabled={saving} onClick={() => setPaused(false)}>
              {t('horde.resume')}
            </button>
            {/* Leaves the run saved, to carry on from the Horde page. */}
            <button
              className="horde-btn"
              disabled={saving}
              onClick={() => {
                setSaving(true)
                setSaveError(null)
                window.api
                  .saveHorde(setup.token, { setup, game: saveGame(g), choices }, runResult(g))
                  .then(() => onExit(null))
                  .catch((e: Error) => {
                    setSaveError(e.message)
                    setSaving(false)
                  })
              }}
            >
              {saving ? t('horde.saving') : t('horde.saveQuit')}
            </button>
            {saveError && <p className="horde-error">{saveError}</p>}
          </div>
          {/* The window for one of the lists. */}
          {pauseList && (
            <div className="horde-overlay horde-pause-list-modal" onClick={() => setPauseList(null)}>
              <div className="horde-panel" onClick={(e) => e.stopPropagation()}>
                {pauseList === 'log' ? (
                  logList
                ) : (
                  <div className="horde-pause-effects-items">
                    {effectsList}
                    {heldList}
                  </div>
                )}
                <button className="horde-btn horde-btn-primary" onClick={() => setPauseList(null)}>
                  {t('common.close')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {g.outcome && (
        <div className="horde-overlay">
          <div className="horde-panel">
            <h2>
              {g.outcome === 'fainted' ? t('horde.fainted', { name: g.form.species }) : g.cleared ? t('horde.ended') : t('horde.quit')}
            </h2>
            {g.cleared && <div className="horde-new-best">{t('horde.won')}</div>}
            <div className="horde-results">
              <span>{t('horde.survived')}</span>
              <b>{formatHordeTime(g.elapsed)}</b>
              {g.endless && (
                <>
                  <span>{t('horde.endless')}</span>
                  <b>+{formatHordeTime(g.elapsed - HORDE_DURATION_MS)}</b>
                </>
              )}
              <span>{t('horde.kosLabel')}</span>
              <b>{g.kos}</b>
              <span>{t('horde.levelReached')}</span>
              <b>{g.level}</b>
              {g.bigNuggets > 0 && (
                <>
                  <span>{t('horde.item.bigNugget')}</span>
                  <b>
                    ×{g.bigNuggets} (+{formatMoney(g.bigNuggets * HORDE_BIG_NUGGET_MONEY)})
                  </b>
                </>
              )}
              <span>{t('horde.earned')}</span>
              <b>{reward === 'pending' ? '…' : reward ? formatMoney(reward.money) : '-'}</b>
            </div>
            {reward && reward !== 'pending' && reward.newBest && <div className="horde-new-best">{t('horde.newBest')}</div>}
            {/* Cleared: the lead joins the Box. */}
            {reward && reward !== 'pending' && reward.caught && (
              <div className="horde-caught">
                <SpriteImage style="3d-static" spriteId={reward.caught.spriteId} shiny={reward.caught.shiny} className="horde-caught-sprite" alt={reward.caught.species} />
                <span>
                  {t('horde.caught', { name: reward.caught.species })}
                  {reward.caught.shiny && <ShinyIcon />}
                </span>
              </div>
            )}
            {damageList.length > 0 && (
              <div className="horde-damage">
                <div className="horde-damage-title">{t('horde.damageDealt')}</div>
                {damageList.map(([name, dmg]) => (
                  <div className="horde-damage-row" key={name}>
                    <span className="horde-damage-name">{name === EFFECTS_KEY ? t('horde.damageEffects') : moveName(name)}</span>
                    <span className="horde-damage-bar">
                      <span style={{ width: `${(dmg / damageList[0][1]) * 100}%` }} />
                    </span>
                    <b>{dmg.toLocaleString()}</b>
                    <span className="horde-damage-share">{Math.round((dmg / damageTotal) * 100)}%</span>
                  </div>
                ))}
              </div>
            )}
            {payError && <p className="horde-error">{payError}</p>}
            <button
              className="horde-btn horde-btn-primary"
              disabled={reward === 'pending'}
              onClick={() => onExit(reward === 'pending' ? null : reward)}
            >
              {t('horde.back')}
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body
  )
}

export default HordeArena
