// Horde mode's rules, shared by the main process (which builds the run and pays for it)
// and the renderer (which plays it out in real time).
//
// The player picks one of 10 random unevolved Pokemon, which starts at level 1 knowing one
// weak move of its type. Seen from above, the player walks it around an open arena while
// wild Pokemon pour in from the corners in ever bigger, ever stronger waves and chase it down.
// Its moves go off by themselves, each on its own cooldown; spread moves hit every wild
// Pokemon close by. KOs drop experience to pick up, and each level offers a choice: learn
// a move, upgrade one, or raise a stat. Lasting 10 minutes clears the run; after that it
// goes on as endless mode - ever more, ever tougher wild Pokemon - until it faints or the
// player ends it, and how long it lasted in all is its score.
//
// Moves are simplified: each type has its own handful (see horde-moves.ts), each with its
// own power, cooldown and shape - a shot, a strike on a random foe, a close-up hit, a stream,
// a cone, and so on (see HORDE_SHAPES) - and a twist only it has. Attack and Sp. Atk are one Attack
// stat, Defense and Sp. Def one Defense, and Luck (from level-up picks only) makes rarer
// level-up choices turn up more often. A Pokemon that evolves does so mid-run, and that
// level-up's choices are all legendary.

import type { CompanionSize, RarityTier, StatBlock, WildLocationId } from './battle-types'
import {
  HORDE_MOVE_DEFS,
  HORDE_ORBIT,
  hordeFindMoveDef,
  hordeMoveIdOf,
  type HordeMoveBand,
  type HordeMoveDef,
  type HordeMoveShape
} from './horde-moves'

export * from './horde-moves'

// How long a run must last to be cleared; endless mode goes on from there. The final boss turns up then.
export const HORDE_DURATION_MS = 10 * 60 * 1000
// A boss halfway, and the final one as the run is cleared.
export const HORDE_BOSS_TIMES_MS = [5 * 60 * 1000, HORDE_DURATION_MS]
// An elite every 30 seconds: one of the wild Pokemon about, evolved (once in the first half of
// the run, as far as it goes after that) - bigger and tougher.
export const HORDE_ELITE_EVERY_MS = 30 * 1000
export const HORDE_ELITE_FULL_EVOLVE_MS = 5 * 60 * 1000
// Exploders: each wave has this chance of being a small horde of them instead (between the two
// counts), one kind per third of the run - and a wild Pokemon that can learn Explosion or
// Self-Destruct has HORDE_EXPLODER_WILD_CHANCE of being one too (elites and bosses never are;
// they fight with their moves like any other). They walk at the lead like any wild Pokemon but never attack: once
// their hitbox touches the lead's they stand still and blow up after the fuse, hitting everything
// within the blast's reach - the lead and wild Pokemon alike - far harder than any attack, and
// fainting (no experience for that). One knocked out drops its experience, then still blows up
// once its fuse burns down (what's left of it, if it was already lit). An exploder caught in a
// blast goes off almost at once, so they chain - all counting as knocked out if the lead set off the first.
export const HORDE_EXPLODER_CHANCE = 0.05
export const HORDE_EXPLODER_WILD_CHANCE = 0.25
export const HORDE_EXPLODER_COUNT = [5, 8]
export const HORDE_EXPLODER_FUSE_MS = 1800
export const HORDE_EXPLODER_CHAIN_MS = 120
export const HORDE_EXPLODER_REACH = 130
// Exploders have this many times a wild Pokemon's HP.
export const HORDE_EXPLODER_HP = 1.5
// The blast's power (a typeless hit - Ghosts aren't spared). Against wild Pokemon it grows as
// their HP does, so it keeps clearing crowds late on.
export const HORDE_EXPLODER_POWER = 250
// After a blast hits the lead, more blasts can't for this long - a chain hurts, but not six times over.
export const HORDE_EXPLODER_LEAD_GRACE_MS = 500
// Ranged wild Pokemon: one whose Sp. Atk is higher than its Attack has this chance of being one
// (elites, bosses and exploders never are). It keeps about this far from the lead (feet to feet),
// edging round it at this share of its pace and backing off (at this share of its pace) if the lead
// comes too close, and fires
// its moves as shots at where the lead stood - slow enough to step out of the way. A shot hits if
// it passes this close to the lead's middle and fades after this long; a blast move landing, an
// exploder's blast or the Eject Button wipes out the shots caught in it.
export const HORDE_RANGED_CHANCE = 0.25
export const HORDE_RANGED_KEEP_AWAY = 320
export const HORDE_RANGED_STRAFE = 0.45
export const HORDE_RANGED_BACK_OFF = 0.5
export const HORDE_FOE_SHOT_SPEED = 260
export const HORDE_FOE_SHOT_HITBOX = 12
export const HORDE_FOE_SHOT_MS = 3000
// Each area's exploders, by evolution line: a third of the run picks one of its lines at random
// and brings that line's Pokemon for it (the first third its first one, and so on).
// The ocean's Pyukumuku can't learn Explosion, but fits the beach too well to leave out.
export const HORDE_EXPLODER_LINES: Partial<Record<WildLocationId, string[][]>> = {
  cave: [
    ['Geodude', 'Graveler', 'Golem'],
    ['Geodude-Alola', 'Graveler-Alola', 'Golem-Alola']
  ],
  mountain: [
    ['Roggenrola', 'Boldore', 'Gigalith'],
    ['Onix', 'Onix', 'Onix']
  ],
  volcano: [['Rolycoly', 'Carkol', 'Coalossal']],
  desert: [['Baltoy', 'Baltoy', 'Claydol']],
  forest: [['Pineco', 'Pineco', 'Forretress']],
  city: [['Trubbish', 'Trubbish', 'Garbodor']],
  industry: [
    ['Voltorb', 'Voltorb', 'Electrode'],
    ['Koffing', 'Koffing', 'Weezing']
  ],
  cemetery: [
    ['Pumpkaboo', 'Pumpkaboo', 'Gourgeist'],
    ['Drifloon', 'Drifloon', 'Drifblim']
  ],
  ocean: [
    ['Pyukumuku', 'Pyukumuku', 'Pyukumuku'],
    ['Pincurchin', 'Pincurchin', 'Pincurchin']
  ]
}
// Endless mode brings bosses every 5 minutes as well, one more each time (2 at 5 minutes in,
// 3 at 10, 4 at 15...) - every other time (10 minutes in, 20, 30...) one of them as big as the final boss.
export const HORDE_ENDLESS_BOSS_EVERY_MS = 5 * 60 * 1000
// A boss (and in endless mode an elite) gets quicker the longer it's on the field: its walking pace grows by its own amount
// every this long, its attacks by theirs every that long.
export const HORDE_BOSS_WALK_RAMP_MS = 20000
export const HORDE_BOSS_ATTACK_RAMP_MS = 60000
// How much more HP an elite, the midway boss and the final boss have than a wild one.
export const HORDE_ELITE_HP = 4
export const HORDE_BOSS_HP = [21, 36]
export type HordeFoeKind = 'wild' | 'elite' | 'boss'
// The experience a KO drops on the ground (picked up to fill the bar): a wild Pokemon, an elite, a boss.
export const HORDE_KO_EXP: Record<HordeFoeKind, number> = { wild: 1, elite: 6, boss: 25 }
// The most wild Pokemon in the arena at first - a wave waits for room past this. The arena
// makes room for this many more each pace minute, up to the most it can hold.
export const HORDE_MAX_FOES = 24
export const HORDE_FOES_PER_MINUTE = 6
export const HORDE_MOST_FOES = 120
// The screen, in the arena's own units: 1000 high, as wide as the screen's shape makes it.
export const HORDE_ARENA_HEIGHT = 1000
// The field the run is played on - about 3 screens each way - with the camera following the
// lead round it. Wild Pokemon that fall this many screen heights behind are brought back
// up near it (not elites or bosses, which keep chasing).
export const HORDE_WORLD_WIDTH = 5400
export const HORDE_WORLD_HEIGHT = 3000
export const HORDE_FOE_LEASH = 1.6
// Wild Pokemon rise out of the ground this far from the lead (in screen heights), and while
// they're coming up - this long - they can't be hit, can't hit back and don't walk.
export const HORDE_RISE_NEAR = 0.55
export const HORDE_RISE_FAR = 0.85
export const HORDE_RISE_MS = 700
// In endless mode they rise twice as fast.
export const HORDE_ENDLESS_RISE_FAST = 2
// How fast the lead walks, in arena units a second (its Speed makes it quicker or slower - see hordeWalkFactor).
export const HORDE_PLAYER_WALK = 190
// Hitboxes: a circle round each Pokemon's feet, this wide (radius). A wild Pokemon can hit the
// lead once their hitboxes touch; it walks in until they overlap a little.
export const HORDE_LEAD_HITBOX = 25
export const HORDE_FOE_HITBOX: Record<HordeFoeKind, number> = { wild: 22, elite: 28, boss: 42 }
export const HORDE_HITBOX_OVERLAP = 8
// Experience and items on the ground are picked up from this far (it starts as far as a wild
// Pokemon can hit from), then fly to the lead at this pace.
export const HORDE_PICKUP_RANGE = HORDE_LEAD_HITBOX + HORDE_FOE_HITBOX.wild
export const HORDE_PICKUP_PULL = 650
// Spread moves hit every wild Pokemon within this of the lead; single-target moves reach anywhere.
export const HORDE_SPREAD_RADIUS = 150
// How fast a single-target move flies to its target (arena units a second), and how long a
// spread move's wave takes to roll out - the damage lands when they get there.
export const HORDE_PROJECTILE_SPEED = 1100
export const HORDE_SPREAD_WAVE_MS = 260
// The chance each of a wild Pokemon's moves is of another type than its own.
export const HORDE_FOE_OFFTYPE_CHANCE = 0.1
// Wild Pokemon shoulder each other apart to at least this far (bosses take more room).
export const HORDE_FOE_SPACING = 46
export const HORDE_BOSS_SPACING = 90
// What each level heals, as a share of max HP.
export const HORDE_LEVEL_HEAL = 0.1
// How many Pokemon to pick from at the start.
export const HORDE_STARTER_CHOICES = 10
// The chance a lot of them has a legendary-class one in it - one roll per lot, and never
// more than one.
export const HORDE_LINEUP_LEGENDARY_CHANCE = 0.05
// How long a lost run must last to deal a new lot to pick from (a cleared run always does).
export const HORDE_LINEUP_KEEP_MS = 3 * 60 * 1000
// What dealing a new lot to pick from costs, in Poke Dollars, every time.
export const HORDE_LINEUP_REROLL_COST = 1000
// Level-up choices: how many are offered, the most moves known, and the most abilities held.
// An ability (a "tome" in the code) is one of HORDE_STATS: picking a new one takes a slot, and later
// level-ups upgrade it. Once both kinds of slot are full, level-ups only offer upgrades to
// what it has (and Multi-target, which takes no slot).
export const HORDE_LEVEL_CHOICES = 3
export const HORDE_MAX_MOVES = 4
export const HORDE_MAX_TOMES = 4
// When there's nothing at all left to offer, a level-up gives this much gold instead (by rarity).
export const HORDE_GOLD_CARD: Record<RarityTier, number> = { common: 15, uncommon: 25, rare: 40, epic: 60, legendary: 100 }
// A level-up's choices can be rolled again this many times a run (or the level-up skipped) -
// more with the Horde page's reroll upgrade, up to 10.
export const HORDE_REROLLS = 1
// Multi-target, a legendary-only pick: each one makes shots and strikes also hit this many
// more foes, and melee and piercing moves go off this many more times in a row (this far
// apart), up to this many picks. It only turns up while the lead knows one of those, and only
// as often as a legendary card is rolled (always, on the level it evolves at).
export const HORDE_MULTI_TARGETS = 1
export const HORDE_MULTI_REPEAT_MS = 180
// Each of those repeats hits for this share of the first one's damage.
export const HORDE_MULTI_REPEAT_SHARE = 0.35
export const HORDE_MAX_MULTI = 3
// The levels a Pokemon evolves at, however it evolves in the games, by how many times it
// evolves: a two-stage line at 20, a three-stage one at 14 and 34.
export const HORDE_EVO_LEVELS: Record<number, number[]> = { 1: [20], 2: [14, 34] }
// A Pokemon that never evolves but can Mega Evolve only gathers Mega Energy from this level.
export const HORDE_MEGA_LEVEL = 20
// What evolving heals, as a share of max HP.
export const HORDE_EVOLVE_HEAL = 0.3
// Minior: below half HP its shell breaks into its Core form, this much quicker on top; healed
// back to half or more, it's a Meteor again.
export const HORDE_MINIOR_CORE_SPEED = 0.5
// Ditto: it turns into one of the area's wild Pokemon (with that Pokemon's stats) for this long,
// then is itself again for this long, over and over.
export const HORDE_DITTO_TRANSFORM_MS = 20000
export const HORDE_DITTO_REST_MS = 5000
// From this level on, Ditto turns into an elite or boss on the field when there is one.
export const HORDE_DITTO_BIG_LEVEL = 20

// Each level-up choice has a rarity, which sets how much it gives. Without Luck it's
// common half the time and legendary 1 time in 50.
export const HORDE_RARITIES: RarityTier[] = ['common', 'uncommon', 'rare', 'epic', 'legendary']
export const HORDE_RARITY_WEIGHTS: Record<RarityTier, number> = {
  common: 50,
  uncommon: 28,
  rare: 14,
  epic: 6,
  legendary: 2
}
// Each point of Luck multiplies a rarity's weight by this much more, compounding - the
// rarer, the more it gains. Luck counts for less the more there is (see HORDE_LUCK_SOFT_CAP).
export const HORDE_LUCK_WEIGHT: Record<RarityTier, number> = {
  common: 0,
  uncommon: 0.03,
  rare: 0.06,
  epic: 0.09,
  legendary: 0.12
}
// A stat pick: the percent it adds (HP, Attack, Defense, Speed), or the Luck points.
export const HORDE_STAT_PERCENT: Record<RarityTier, number> = {
  common: 5,
  uncommon: 8,
  rare: 12,
  epic: 18,
  legendary: 25
}
export const HORDE_LUCK_POINTS: Record<RarityTier, number> = {
  common: 1,
  uncommon: 2,
  rare: 3,
  epic: 4,
  legendary: 5
}
// A move upgrade: the percent more power, the percent off its cooldown, the percent more
// reach (for a move with a limited reach), the extra shots or strikes (for a move with
// no reach of its own - only ever one more, whatever the rarity), and the percent more crit
// damage (instead of extra strikes, for a move marked critBoost). Each card raises only some of those - see HORDE_BOOST_COUNT. A new
// move starts with its card's upgrade already in (none for a common one).
export const HORDE_MOVE_UPGRADE: Record<RarityTier, { power: number; cooldown: number; range: number; count: number; crit: number }> = {
  common: { power: 12, cooldown: 5, range: 10, count: 1, crit: 24 },
  uncommon: { power: 18, cooldown: 7, range: 16, count: 1, crit: 36 },
  rare: { power: 24, cooldown: 10, range: 20, count: 1, crit: 54 },
  epic: { power: 36, cooldown: 12, range: 26, count: 1, crit: 72 },
  legendary: { power: 54, cooldown: 17, range: 36, count: 1, crit: 108 }
}
// What a move upgrade can raise.
export type HordeMoveBoost = 'power' | 'cooldown' | 'range' | 'count' | 'crit'
// How many of those a card raises, picked at random: one, two for a rare or epic, every one for a legendary.
export const HORDE_BOOST_COUNT: Record<RarityTier, number> = {
  common: 1,
  uncommon: 1,
  rare: 2,
  epic: 2,
  legendary: 3
}
// Extra shots or strikes from move upgrades thin every hit, but each extra counts for only
// (1 - this) of a hit in the split, so they still add damage: one extra strike on a single
// strike makes two at 2/3 each, three extras make four at 1/2 each.
export const HORDE_EXTRA_HIT_SHARE = 0.5
// A spread move's upgrades add only this share of the power a single-target move's do.
export const HORDE_SPREAD_UPGRADE_SHARE = 0.5
// A piercing shot's upgrades add more than that.
export const HORDE_PIERCE_UPGRADE_SHARE = 0.9
// What a run pays: per KO, per second survived, and for beating the final boss.
export const HORDE_MONEY_PER_KO = 6
export const HORDE_MONEY_PER_SECOND = 3
export const HORDE_WIN_MONEY = 1500

/** One of the simplified moves, as the setup sends it (the rest is in its HordeMoveDef). */
export interface HordeMove {
  // "thunderbolt"
  id: string
  name: string
  type: string
}

// What a move that isn't in the list (from a run saved before it changed) counts as.
const UNKNOWN_MOVE_DEF: HordeMoveDef = HORDE_MOVE_DEFS[0]

/** A move's power, cooldown, shape, rarity and twist. */
export function hordeMoveDef(move: HordeMove): HordeMoveDef {
  return hordeFindMoveDef(move.id) ?? hordeFindMoveDef(move.name) ?? UNKNOWN_MOVE_DEF
}

/** A move as the setup sends it. */
export function hordeMoveOf(def: HordeMoveDef): HordeMove {
  return { id: hordeMoveIdOf(def.name), name: def.name, type: def.type }
}

/** Every move in the list. */
export function hordeMoveCatalog(): HordeMove[] {
  return HORDE_MOVE_DEFS.map(hordeMoveOf)
}

/** How hard a move is (see HordeMoveBand). */
export function hordeMoveBand(move: HordeMove): HordeMoveBand {
  return hordeMoveDef(move).band
}

// Type effects: each type among the lead's moves brings its own effect (a burn for Fire, a
// poison for Poison...), and every hit from any of its moves can set off each of them. The
// more of its moves share a type, the likelier that effect (percent a hit) and the stronger
// (times what it does) - by how many moves of the type it knows.
export const HORDE_EFFECT_BY_MOVES: Record<number, { chance: number; potency: number }> = {
  1: { chance: 8, potency: 1 },
  2: { chance: 15, potency: 1.25 },
  3: { chance: 22, potency: 1.5 },
  4: { chance: 30, potency: 1.8 }
}
// A move of another type sets the effect off half as often.
export const HORDE_EFFECT_OTHER_TYPE_SHARE = 0.5
// Moves that hit a whole crowd at once - waves, cones and streams - set effects off half as often again.
export const HORDE_EFFECT_CROWD_SHARE = 0.5
const HORDE_EFFECT_CROWD_SHAPES: HordeMoveShape[] = ['nova', 'cone', 'beam', 'orbit']
// With this many moves of one type, its effect gains its bonus rule - and with this many (every
// move the lead holds) its mastery rule, a stronger one on top.
export const HORDE_EFFECT_BONUS_MOVES = 2
export const HORDE_EFFECT_MASTERY_MOVES = 4
// Effects that hold a foe still or move it last half as long on an elite. A boss shrugs
// them off, and takes this much more damage from that hit instead.
export const HORDE_HOLD_TYPES = ['Normal', 'Water', 'Psychic', 'Bug']
export const HORDE_ELITE_HOLD_SHARE = 0.5
export const HORDE_BOSS_HOLD_BONUS = 0.15
// Being frozen (by Ice's chill or an Icy Rock) lasts half as long on an elite, a quarter as long on a boss.
export const HORDE_FREEZE_SHARE: Record<HordeFoeKind, number> = { wild: 1, elite: 0.5, boss: 0.25 }

// What each type's effect does, at its base potency (the bonus rule's numbers don't grow).
export const HORDE_EFFECT = {
  // Normal - Flinch: the foe's attack is cancelled and its cooldowns start over. Bonus: it takes more damage for a while.
  // Mastery (Shockwave): every foe close to it flinches too.
  flinchVulnerable: 0.2,
  flinchVulnerableMs: 2000,
  shockwaveReach: 80,
  // Fire - Burn: a share of the hit's damage every second (grows). Bonus: a burning foe that faints sets those nearby burning.
  // Mastery (Wildfire): it explodes too, hitting those nearby for a share of the hit that finished it.
  burnShare: 0.15,
  burnMs: 4000,
  burnSpreadReach: 120,
  wildfireShare: 0.5,
  // Water - Wash Away: pushed away from the lead this far (grows). Bonus: it drags along foes it's pushed through.
  // Mastery (Tidal Wave): every so often a wave rolls out from the lead, washing away everything
  // in the ring and hitting for a share of the strongest Water move.
  pushDistance: 80,
  tideEveryMs: 8000,
  tideShare: 0.5,
  // Grass - Leech: heals the lead for a share of the damage (grows). Bonus: healing past full HP becomes a shield.
  // Mastery (Overgrowth): it heals twice as much under half HP, and the shield goes higher.
  leechShare: 0.08,
  leechShieldMax: 0.2,
  overgrowthHeal: 2,
  overgrowthShieldMax: 0.4,
  // Electric - Chain: the hit jumps on to the next foe nearby for a share of its damage (grows), and on from there. Bonus: two more jumps.
  chainShare: 0.4,
  chainReach: 180,
  chainJumps: 1,
  chainBonusJumps: 2,
  // Mastery (Overload): every foe the chain jumps to is paralysed for a moment.
  overloadMs: 500,
  // Ice - Chill: each one slows the foe more (grows); enough of them freeze it solid. Bonus: a frozen foe hit by Ice shatters.
  chillSlow: 0.15,
  chillMaxSlow: 0.6,
  chillMs: 3000,
  chillStacks: 3,
  freezeMs: 2000,
  shatterBonus: 0.6,
  // Mastery (Permafrost): a shatter freezes the foes right around it solid.
  permafrostReach: 70,
  // Fighting - Guard Break: Defense lowered (grows), stacking. Bonus: once fully broken, hits knock it back.
  breakPerStack: 0.15,
  breakMaxPerStack: 0.25,
  breakStacks: 3,
  breakMs: 5000,
  breakPush: 40,
  // Mastery (Combo): a fully broken foe takes this much more damage from every move.
  comboBonus: 0.3,
  // Poison - Poison: a share of the hit's damage every second (grows), stacking. Bonus: Toxic, each stack hurting more by the second.
  poisonShare: 0.08,
  poisonMs: 8000,
  poisonStacks: 5,
  toxicGrowth: 0.1,
  // Mastery (Plague): a poisoned foe that faints passes its stacks to the nearest foe this close.
  plagueReach: 220,
  // Ground - Tremor: a share of the damage splashes onto foes nearby (grows). Bonus: the splash stops them for a moment.
  tremorShare: 0.3,
  tremorReach: 90,
  tremorStopMs: 400,
  // Mastery (Sinkhole): each tremor leaves slowing ground where it hit.
  sinkholeReach: 60,
  sinkholeSlow: 0.35,
  sinkholeMs: 1500,
  // Flying - Tailwind: the lead's cooldowns run faster for a while (grows). Bonus: wild Pokemon walk slower while it blows.
  tailwindSpeed: 0.2,
  tailwindMs: 3000,
  tailwindFoeSlow: 0.25,
  // Mastery (Gale): while it blows, a gust knocks back the foes close to the lead every few seconds.
  galeEveryMs: 3000,
  galeReach: 110,
  galePush: 70,
  // Psychic - Confusion: the foe stands still attacking other wild Pokemon (grows). Bonus: if it faints confused, those nearby are stopped.
  confuseMs: 2500,
  confuseStunMs: 1000,
  confuseReach: 100,
  // Mastery (Mind Control): confusion lasts longer, and confused foes hit other wild Pokemon harder.
  mindControlLonger: 1.5,
  mindControlDamage: 2,
  // Bug - Spook: the foe turns and flees for a while (grows). Bonus: Hex, Bug moves hurt more for each effect on the foe.
  spookMs: 1500,
  hexPerEffect: 0.2,
  // Mastery (Swarm): a fleeing foe spooks those it runs into, and spooked foes take more damage from every move.
  swarmReach: 40,
  swarmBonus: 0.25,
  // Rock - Stealth Rock: rocks left on the ground hurt foes standing on them every second (grows), two spots at once. Bonus: three spots, and rocks slow.
  rockShare: 0.25,
  rockMs: 9000,
  rockSpots: 2,
  rockBonusSpots: 3,
  rockReach: 50,
  rockSlow: 0.2,
  // Mastery (Avalanche): up to 6 spots, and a foe first stepping on rocks takes a burst (times their damage a second).
  avalancheSpots: 6,
  // Spikes and Toxic Spikes (from moves) last as long as rocks and as many lie about at once - by the
  // lead's rank in Ground for Spikes, in Poison for Toxic Spikes. Spikes hurt as rocks do; Toxic Spikes
  // hurt for this smaller share and poison a foe the first time it steps on them.
  toxicSpikeShare: 0.08,
  avalancheBurst: 3,
  // Ghost - Execute: more damage to a foe low on HP (grows). Bonus: a wild Pokemon (not an elite or boss) that low faints outright.
  executeBonus: 0.4,
  executeLine: 0.3,
  executeKillLine: 0.15,
  // Mastery (Haunt): Execute starts higher, and elites (not bosses) that low faint outright too.
  hauntLine: 0.45,
  hauntEliteKillLine: 0.1,
  // Dragon - Rage: the lead's Attack rises (grows), stacking. Bonus: fully enraged, Dragon moves hit the foe behind too.
  ragePerStack: 0.08,
  rageStacks: 3,
  rageMs: 5000,
  // Mastery (Ascent): more stacks, and fully enraged every move hits the foe behind.
  ascentStacks: 5,
  // Dark - Ambush: the hit is a critical hit, landing this much harder than one usually does (grows). Bonus: every move crits more often.
  ambushCritDamage: 0.25,
  ambushCritChance: 5,
  // Mastery (Assassin): every so many hits is a sure Ambush, and crits on a foe under this share of its HP land twice.
  assassinEvery: 5,
  assassinLine: 0.5,
  // Steel - Iron Guard: a shield for a share of the damage (grows). Bonus: the lead takes less damage while shielded.
  guardShare: 0.12,
  guardMax: 0.25,
  guardCut: 0.15,
  // Mastery (Fortress): while shielded, a share of the damage taken bounces back at the attacker, and the shield goes higher.
  fortressReflect: 0.3,
  fortressMax: 0.4,
  // Fairy - Charm: the foe deals less damage for a while (grows). Bonus: a charmed foe sometimes skips its attack.
  charmCut: 0.25,
  charmMaxCut: 0.6,
  charmMs: 4000,
  charmSkip: 0.25,
  // Mastery (Enchant): a charmed foe that faints charms those nearby and heals the lead a share of its max HP.
  charmSpreadReach: 120,
  enchantHeal: 0.02
}

/** One type's effect for the lead: how many of its moves are of the type, its chance a hit, its potency, and whether its bonus and mastery rules are in. */
export interface HordeTypeEffect {
  moves: number
  chance: number
  potency: number
  bonus: boolean
  mastery: boolean
}

/** A type's effect with these moves known (none at all without a move of the type). */
export function hordeTypeEffect(known: HordeMove[], type: string): HordeTypeEffect {
  const moves = known.filter((m) => m.type === type).length
  const step = HORDE_EFFECT_BY_MOVES[Math.min(moves, HORDE_EFFECT_MASTERY_MOVES)]
  return {
    moves,
    chance: step?.chance ?? 0,
    potency: step?.potency ?? 1,
    bonus: moves >= HORDE_EFFECT_BONUS_MOVES,
    mastery: moves >= HORDE_EFFECT_MASTERY_MOVES
  }
}

/** The types whose effects these moves bring, each once. */
export function hordeEffectTypes(known: HordeMove[]): string[] {
  return [...new Set(known.map((m) => m.type))]
}

/**
 * A move's chance (percent) to set off a type's effect with these moves known - half for a move of
 * another type (otherShare of it, with the Master of Elements title), half again for one that hits a crowd.
 */
export function hordeEffectChance(move: HordeMove, type: string, known: HordeMove[], otherShare = HORDE_EFFECT_OTHER_TYPE_SHARE): number {
  const crowd = HORDE_EFFECT_CROWD_SHAPES.includes(hordeMoveShape(move)) ? HORDE_EFFECT_CROWD_SHARE : 1
  // A move with an effectBoost for the type (Stealth Rock for Rock) sets it off that many times as often.
  const tr = hordeMoveDef(move).trait
  const boost = tr.kind === 'effectBoost' && tr.type === type ? tr.times : 1
  return hordeTypeEffect(known, type).chance * (move.type === type ? 1 : otherShare) * crowd * boost
}

// Duo synergies: a lead holding at least 1 move of each of a pair's two types gets that pair's
// own rule on top of its type effects - several at once, one for every pair its moves cover.
export type HordeDuoId =
  | 'steamBurst'
  | 'thermalShock'
  | 'conductor'
  | 'flashFreeze'
  | 'monsoon'
  | 'ashes'
  | 'glacier'
  | 'mudslide'
  | 'landslide'
  | 'thunderstorm'
  | 'firestorm'
  | 'swarmFront'
  | 'infestation'
  | 'rot'
  | 'nightmare'
  | 'mindOverMatter'
  | 'haymaker'
  | 'siren'
  | 'reaper'
  | 'possession'
  | 'inferno'
  | 'magnetize'
  | 'aegis'
  | 'bloom'

export const HORDE_DUOS: { id: HordeDuoId; types: [string, string] }[] = [
  { id: 'steamBurst', types: ['Fire', 'Water'] },
  { id: 'thermalShock', types: ['Fire', 'Ice'] },
  { id: 'conductor', types: ['Water', 'Electric'] },
  { id: 'flashFreeze', types: ['Water', 'Ice'] },
  { id: 'monsoon', types: ['Water', 'Grass'] },
  { id: 'ashes', types: ['Fire', 'Grass'] },
  { id: 'glacier', types: ['Ice', 'Rock'] },
  { id: 'mudslide', types: ['Ground', 'Water'] },
  { id: 'landslide', types: ['Ground', 'Rock'] },
  { id: 'thunderstorm', types: ['Flying', 'Electric'] },
  { id: 'firestorm', types: ['Flying', 'Fire'] },
  { id: 'swarmFront', types: ['Flying', 'Bug'] },
  { id: 'infestation', types: ['Poison', 'Bug'] },
  { id: 'rot', types: ['Grass', 'Poison'] },
  { id: 'nightmare', types: ['Psychic', 'Dark'] },
  { id: 'mindOverMatter', types: ['Fighting', 'Psychic'] },
  { id: 'haymaker', types: ['Normal', 'Fighting'] },
  { id: 'siren', types: ['Dark', 'Fairy'] },
  { id: 'reaper', types: ['Ghost', 'Dark'] },
  { id: 'possession', types: ['Ghost', 'Psychic'] },
  { id: 'inferno', types: ['Dragon', 'Fire'] },
  { id: 'magnetize', types: ['Electric', 'Steel'] },
  { id: 'aegis', types: ['Steel', 'Fairy'] },
  { id: 'bloom', types: ['Grass', 'Fairy'] }
]

// What each duo does.
export const HORDE_DUO = {
  // Steam Burst (Fire + Water): washing away a burning foe deals the rest of its burn at once,
  // and splashes this share of it onto foes this close.
  steamSplash: 0.5,
  steamReach: 90,
  // Thermal Shock (Fire + Ice): burning a chilled foe (or chilling a burning one) bursts for this
  // share of the hit and ends both. Fire moves shatter frozen foes as Ice moves do.
  thermalShare: 1,
  // Conductor (Water + Electric): a washed-away foe is soaked this long; a chain picks soaked foes
  // first, reaches them this much further, and hits them this much harder.
  soakMs: 3000,
  conductorReach: 1.5,
  conductorHit: 2,
  // Flash Freeze (Water + Ice): a washed-away foe that slams into another freezes both this long.
  flashFreezeMs: 1000,
  // Monsoon (Water + Grass): each Wash Away heals the Leech share of the hit, once more for each foe it drags along.
  // Ashes (Fire + Grass): burns heal the lead this share of the Leech share of their damage.
  ashesShare: 0.5,
  // Glacier (Ice + Rock): a foe on rocks is chilled every second; a frozen one shatters for this many times the rocks' damage.
  glacierShatter: 3,
  // Mudslide (Ground + Water): tremors leave mud this big that slows this much for this long, and
  // Wash Away pushes foes on mud this much further.
  mudReach: 60,
  mudSlow: 0.3,
  mudMs: 2000,
  mudPush: 1.5,
  // Landslide (Ground + Rock): a tremor by a rock spot hits every foe on it for the tremor share again.
  // Thunderstorm (Flying + Electric): while Tailwind blows, lightning every so often on a foe this
  // many spread rings out, hitting for this share of the strongest Electric move and setting off a chain.
  stormEveryMs: 1500,
  stormRing: 1.5,
  stormShare: 0.5,
  // Firestorm (Flying + Fire): while Tailwind blows, burning foes this many spread rings out set those
  // near them burning every second.
  firestormRing: 1,
  // Swarm Front (Flying + Bug): spooked foes flee this much faster, and each spook adds this long to Tailwind.
  swarmFrontFlee: 2,
  swarmFrontWindMs: 500,
  // Infestation (Poison + Bug): every poison stack counts as an effect for Hex, and a fleeing foe gives
  // 1 poison stack to foes it runs into (each one no more than once this often).
  infestEveryMs: 1000,
  // Rot (Grass + Poison): Leech heals this many times as much from a poisoned foe.
  rotHeal: 2,
  // Nightmare (Psychic + Dark): every hit on a confused foe is an Ambush, and each crit adds this
  // long to the confusion (no more than this many times its usual length ahead).
  nightmareMs: 500,
  nightmareMax: 2,
  // Mind over Matter (Fighting + Psychic): a confused foe's Defense counts as fully broken.
  // Haymaker (Normal + Fighting): a flinch on a fully broken foe knocks it this far back and stops it this long.
  haymakerPush: 120,
  haymakerStopMs: 1000,
  // Siren (Dark + Fairy): crits on a charmed foe land this much harder.
  sirenCrit: 0.5,
  // Reaper (Ghost + Dark): a crit leaving a wild foe under the Execute line finishes it, and its move comes round at once.
  // Possession (Ghost + Psychic): a confused wild foe knocked under the Execute line fights for the
  // lead this long - its hits on other wild Pokemon this many times as hard, and counted as the lead's.
  possessMs: 5000,
  possessDamage: 2,
  // Inferno (Dragon + Fire): each Rage stack raises burns this much, and fully enraged every hit burns.
  infernoPerStack: 0.15,
  // Magnetize (Electric + Steel): each chain jump gives a shield of this share of max HP.
  magnetizeShield: 0.02,
  // Aegis (Steel + Fairy): a charmed foe's hits wear the shield down only this share as much.
  aegisWear: 0.5,
  // Bloom (Grass + Fairy): each charmed foe heals the lead this share of max HP a second, no more than this in all.
  bloomHeal: 0.003,
  bloomMax: 0.03
}

/** The duos these moves make: every pair with at least 1 move of each of its types. */
export function hordeActiveDuos(known: HordeMove[]): (typeof HORDE_DUOS)[number][] {
  const types = hordeEffectTypes(known)
  return HORDE_DUOS.filter((duo) => duo.types.every((type) => types.includes(type)))
}

/** The ids of the duos these moves make. */
export function hordeActiveDuoIds(known: HordeMove[]): Set<HordeDuoId> {
  return new Set(hordeActiveDuos(known).map((duo) => duo.id))
}

/**
 * The duos these moves make or can still make, each with whether a move of each of its two types
 * is held - those made first, then those a move short. One needing more moves than the free slots
 * hold is out of reach.
 */
export function hordeDuoProgress(known: HordeMove[]): { duo: (typeof HORDE_DUOS)[number]; has: [boolean, boolean] }[] {
  const types = hordeEffectTypes(known)
  const free = HORDE_MAX_MOVES - known.length
  return HORDE_DUOS.map((duo) => ({ duo, has: [types.includes(duo.types[0]), types.includes(duo.types[1])] as [boolean, boolean] }))
    .filter(({ has }) => has.filter((h) => !h).length <= free)
    .sort((a, b) => b.has.filter(Boolean).length - a.has.filter(Boolean).length)
}

// Each upgrade a move already has makes the next a little weaker: its power, cooldown and
// reach are divided by 1 + this much per upgrade held - 5 upgrades in, a card gives 80%; 10 in, two-thirds.
// Extra shots stay at one each.
export const HORDE_MOVE_UPGRADE_FALLOFF = 0.05

/** A move upgrade's amount, softened by how many upgrades the move already has (never under 1). */
function hordeSoftenUpgrade(amount: number, upgradesHeld: number): number {
  if (!amount) return 0
  return Math.max(1, Math.round(amount / (1 + HORDE_MOVE_UPGRADE_FALLOFF * Math.max(0, upgradesHeld))))
}

/** The percent more power a move upgrade (or a new move's head start) of this rarity gives - less for a move that hits many, and for one already upgraded. */
export function hordeUpgradePower(move: HordeMove, rarity: RarityTier, upgradesHeld = 0): number {
  const power = HORDE_MOVE_UPGRADE[rarity].power
  const share = hordeMoveShape(move) === 'pierce' ? HORDE_PIERCE_UPGRADE_SHARE : hordeHitsMany(move) ? HORDE_SPREAD_UPGRADE_SHARE : 1
  return hordeSoftenUpgrade(power * share, upgradesHeld)
}

/** The percent off its cooldown a move upgrade of this rarity gives - less for a move already upgraded. */
export function hordeCooldownUpgrade(rarity: RarityTier, upgradesHeld = 0): number {
  return hordeSoftenUpgrade(HORDE_MOVE_UPGRADE[rarity].cooldown, upgradesHeld)
}

/** The percent more crit damage a move upgrade of this rarity gives - less for a move already upgraded. */
export function hordeCritUpgrade(rarity: RarityTier, upgradesHeld = 0): number {
  return hordeSoftenUpgrade(HORDE_MOVE_UPGRADE[rarity].crit, upgradesHeld)
}

// How each of the lead's moves goes off (see HordeMoveShape). Single-target shapes (shot,
// strike, melee) hit one foe; the rest can hit many, and their upgrades add only half as much
// power (nine tenths for piercing shots).
// Streams, cones and piercing shots aim at the picked foe, or else the nearest.
export const HORDE_SHAPE_LIST: HordeMoveShape[] = ['shot', 'strike', 'melee', 'beam', 'cone', 'pierce', 'blast', 'scatter', 'rain', 'nova', 'orbit']
export const HORDE_MANY_SHAPES: HordeMoveShape[] = ['beam', 'cone', 'pierce', 'blast', 'scatter', 'rain', 'nova', 'orbit']
// The shapes with a reach of their own, which upgrades can stretch (a melee hit's reach, a
// stream's length and width, a cone's depth, a piercing shot's size, a blast's size, how far a
// wave rolls out).
export const HORDE_REACH_SHAPES: HordeMoveShape[] = ['melee', 'beam', 'cone', 'pierce', 'blast', 'nova']
// The rest fire some number of shots, strikes or orbiting balls, which upgrades can add to.
export const HORDE_COUNT_SHAPES: HordeMoveShape[] = ['shot', 'strike', 'scatter', 'rain', 'orbit']
export const HORDE_SHAPES = {
  // A strike lands this long after it's called down.
  strikeDelayMs: 250,
  // Melee: how far it reaches (between feet), how much harder it lands, and the foes beside
  // the target it clips (this close to it) for this share of the damage.
  meleeReach: 150,
  meleeBonus: 0.25,
  meleeSplashReach: 50,
  meleeSplashShare: 0.5,
  // A stream: how long and wide, how long it lasts, and how many pulses it hits in (each a
  // share of the damage; the type effect rolls once per foe per use). Reach upgrades stretch its
  // length by their share and its width by this many times that share.
  beamLength: 255,
  beamWidth: 70,
  beamWidthGrowth: 1.5,
  beamMs: 1350,
  beamPulses: 9,
  // Each pulse hits for this share of the move's damage.
  beamPulseShare: 0.3,
  // A cone: how deep, how wide an angle, and the share of the lead's Attack it hits with.
  coneReach: 156,
  coneAngle: (70 * Math.PI) / 180,
  // A piercing shot flies on until it leaves the arena; its reach upgrades make it bigger
  // instead - in full up to the first size, at half the rate up to the second, and by less and
  // less past that. It also starts this many times an ordinary shot's size before any upgrade.
  pierceSoftSize: 4,
  pierceSlowSize: 6,
  pierceBaseSize: 1.6,
  // A blast hits everyone this close to where it explodes.
  blastReach: 110,
  // Scatter's shots, and rain's strikes and how long they take to all come down.
  scatterShots: 3,
  rainStrikes: 5,
  rainMs: 600
}

/** A move's shape. */
export function hordeMoveShape(move: HordeMove): HordeMoveShape {
  return hordeMoveDef(move).shape
}

/** Whether a move can hit many foes at once. */
export function hordeHitsMany(move: HordeMove): boolean {
  return HORDE_MANY_SHAPES.includes(hordeMoveShape(move))
}

/** A move's power and cooldown with its upgrades: percent more power, percent off its cooldown. */
export function hordeMovePower(move: HordeMove, powerBonus = 0): number {
  return Math.round(hordeMoveDef(move).power * (1 + powerBonus / 100))
}

/**
 * A move's power as a wild Pokemon uses it: one hit for the lot - a move that hits several
 * times counts as its usual number of hits, so a wild Pokemon's Bullet Seed isn't a tickle.
 */
export function hordeFoeMovePower(move: HordeMove): number {
  const def = hordeMoveDef(move)
  return def.trait.kind === 'multiHit' ? Math.round((def.power * (def.trait.min + def.trait.max)) / 2) : def.power
}

// The cuts have diminishing returns rather than a floor: the cooldown is divided by
// 1 + cut%, so -50% leaves two-thirds of it, -100% half and -200% a third.
// A typeCut move (Solar Beam) takes its time off for each move of its type among the lead's
// known moves first, never under the floor.
const HORDE_TYPE_CUT_FLOOR_MS = 1000
export function hordeMoveCooldown(move: HordeMove, cooldownCut = 0, known: HordeMove[] = []): number {
  const def = hordeMoveDef(move)
  const tr = def.trait
  const off = tr.kind === 'typeCut' ? tr.ms * known.filter((k) => k.type === tr.type).length : 0
  const cooldownMs = off ? Math.max(HORDE_TYPE_CUT_FLOOR_MS, def.cooldownMs - off) : def.cooldownMs
  return Math.round(cooldownMs / (1 + Math.max(0, cooldownCut) / 100))
}

/**
 * How many times its size a piercing shot is with this much reach upgrade (percent): the
 * full amount up to 4x (+300%), then half of it up to 6x (+700%), then less and less (a
 * quarter at first) - 6.6x at +1100%, 7x at +1600%, 7.7x at +2500%.
 */
export function hordePierceSize(range: number): number {
  const soft = HORDE_SHAPES.pierceSoftSize
  const slow = HORDE_SHAPES.pierceSlowSize
  const size = 1 + Math.max(0, range) / 100
  if (size <= soft) return size
  // Raw size at which the half-rate growth reaches the second size.
  const slowFrom = soft + (slow - soft) * 2
  if (size <= slowFrom) return soft + (size - soft) / 2
  return slow + (Math.sqrt(1 + size - slowFrom) - 1) / 2
}

// Every melee move shares one reach (like wave moves share the ring), so their reach
// upgrades add up between them - each only this share of a card's usual amount.
export const HORDE_MELEE_RANGE_SHARE = 0.5
// Blasts and waves stretch further than that with each reach upgrade, and piercing shots grow more still.
export const HORDE_AREA_RANGE_SHARE = 1.25
export const HORDE_PIERCE_RANGE_SHARE = 3

/** How much more reach (percent) a move upgrade of this rarity adds - less for a melee move, more for a blast, wave or piercing shot, and less for a move already upgraded. */
export function hordeRangeUpgrade(move: HordeMove, rarity: RarityTier, upgradesHeld = 0): number {
  const range = HORDE_MOVE_UPGRADE[rarity].range
  const shape = hordeMoveShape(move)
  const share =
    shape === 'melee'
      ? HORDE_MELEE_RANGE_SHARE
      : shape === 'blast' || shape === 'nova' || hordeMoveDef(move).areaBoost
        ? HORDE_AREA_RANGE_SHARE
        : shape === 'pierce'
          ? HORDE_PIERCE_RANGE_SHARE
          : 1
  return hordeSoftenUpgrade(range * share, upgradesHeld)
}

/** Whether a move has a reach of its own that upgrades can stretch (its shape's, or the ground an areaBoost move leaves). */
export function hordeHasReach(move: HordeMove): boolean {
  return HORDE_REACH_SHAPES.includes(hordeMoveShape(move)) || !!hordeMoveDef(move).areaBoost
}

/** How many shots or strikes a move fires before any upgrades (one for a reach shape). */
export function hordeBaseCount(move: HordeMove): number {
  const shape = hordeMoveShape(move)
  return shape === 'scatter' ? (hordeMoveDef(move).shots ?? HORDE_SHAPES.scatterShots) : shape === 'rain' ? HORDE_SHAPES.rainStrikes : shape === 'orbit' ? HORDE_ORBIT.balls : 1
}

/** Whether a move's shot upgrades add bounces instead of shots (every scatter move). */
export function hordeCountIsBounce(move: HordeMove): boolean {
  return hordeMoveShape(move) === 'scatter'
}

/** The shots a move fires with this many shot upgrades - or, for one whose upgrades add bounces, its bounces. */
export function hordeShownCount(move: HordeMove, count: number): number {
  return hordeCountIsBounce(move) ? count : hordeBaseCount(move) + count
}

/** What a move's count upgrades add, for their label: bounces (scatter moves), hits on its foe (a hitBoost melee move) or shots. */
export function hordeCountKind(move: HordeMove): 'bounces' | 'hits' | 'shots' {
  return hordeCountIsBounce(move) ? 'bounces' : hordeMoveDef(move).hitBoost ? 'hits' : 'shots'
}

/** Whether Multi-target makes this move go off again in a quick run (melee, piercing and scatter moves). */
export function hordeRepeatsOnMulti(move: HordeMove): boolean {
  const shape = hordeMoveShape(move)
  return shape === 'melee' || shape === 'pierce' || hordeCountIsBounce(move)
}

/** How many more shots or strikes an upgrade adds - only ever one, whatever its rarity or the move. */
export function hordeCountUpgrade(_move: HordeMove, rarity: RarityTier): number {
  return Math.min(1, HORDE_MOVE_UPGRADE[rarity].count)
}

/** What upgrading this move can raise: power, cooldown, and its reach, its crit damage (a critBoost move) or else how many shots it fires (or hits it lands, a hitBoost move). */
export function hordeMoveBoosts(move: HordeMove): HordeMoveBoost[] {
  const def = hordeMoveDef(move)
  return ['power', 'cooldown', def.hitBoost ? 'count' : hordeHasReach(move) ? 'range' : def.critBoost ? 'crit' : 'count']
}

/** What a move upgrade of this rarity raises, picked at random (in the usual order). */
export function hordeRollBoosts(move: HordeMove, rarity: RarityTier): HordeMoveBoost[] {
  const all = hordeMoveBoosts(move)
  const picked = shuffled(all).slice(0, HORDE_BOOST_COUNT[rarity])
  return all.filter((b) => picked.includes(b))
}

// The stats Horde mode uses - Attack covers Sp. Atk, Defense covers Sp. Def. The rest
// aren't a Pokemon's own: they start at nothing and only come from level-up picks - Mega Launcher
// ('area': the spread ring, and cones, blasts, streams, piercing shots and orbits by half as much),
// Long Reach ('reach': melee moves' reach, and a little pickup range), Haste (every cooldown shorter), Pickup (how
// far off experience and items are picked up), Crit chance (percentage points onto the
// chance of a critical hit), Crit damage (percent onto how hard one lands), Experience (percent
// more from every gem), Resisted damage (percent onto a hit a foe resists, see hordeResistBoost),
// Regen (percent of max HP back every second), Gold (percent more gold from foes' experience, not
// shrines') and Luck.
export type HordeBaseStat = 'hp' | 'atk' | 'def' | 'spe'
export const HORDE_BASE_STATS: HordeBaseStat[] = ['hp', 'atk', 'def', 'spe']
export type HordeStats = Record<HordeBaseStat, number>
export type HordeBonusStat = 'area' | 'reach' | 'haste' | 'pickup' | 'critChance' | 'critDamage' | 'exp' | 'resist' | 'regen' | 'goldGain'
export const HORDE_BONUS_STATS: HordeBonusStat[] = ['area', 'reach', 'haste', 'pickup', 'critChance', 'critDamage', 'exp', 'resist', 'regen', 'goldGain']
// Curse is an ability of its own rather than a stat: more HP and Defense, but slower (see hordeCurseGain).
export type HordeStat = HordeBaseStat | HordeBonusStat | 'luck' | 'curse'
// The abilities a level-up can offer (each named after a Pokemon ability, see horde.ability.*):
// every stat but HP, plus Curse.
export const HORDE_STATS: HordeStat[] = ['atk', 'def', 'spe', 'area', 'reach', 'haste', 'pickup', 'critChance', 'critDamage', 'exp', 'resist', 'luck', 'regen', 'goldGain', 'curse']
// A pick of one of those adds this many times a stat pick's percent (Haste's comes off every
// move's cooldown, added to each move's own upgrades, with the same diminishing returns).
// Regenerator: 0.2% of max HP a second for a common pick up to 1% for a legendary one.
// Good as Gold: +8% gold for a common pick up to +40% for a legendary one.
export const HORDE_BONUS_SCALE: Record<HordeBonusStat, number> = { area: 0.875, reach: 0.875, haste: 1, pickup: 4, critChance: 0.6, critDamage: 1.7, exp: 1, resist: 2.5, regen: 0.04, goldGain: 1.6 }
// Mega Launcher: cones, blasts, streams, piercing shots and orbits grow by this share of what it adds to the spread ring.
export const HORDE_LAUNCHER_SHARE = 0.5
// Long Reach: pickup range grows by a third of what a Magnet Pull pick of the same rarity would add.
export const HORDE_REACH_PICKUP_SHARE = HORDE_BONUS_SCALE.pickup / 3 / HORDE_BONUS_SCALE.reach
// Mega Launcher's shapes (beside waves, which live in the spread ring), and Long Reach's.
const HORDE_LAUNCHER_SHAPES: HordeMoveShape[] = ['nova', 'cone', 'blast', 'beam', 'pierce', 'orbit']
// A new Mega Launcher or Long Reach while no known move makes use of it turns up this much as often as other abilities.
export const HORDE_UNUSED_TOME_WEIGHT = 1 / 3

/** Whether a new ability does anything for these moves - Mega Launcher and Long Reach only once a move of theirs is known. */
export function hordeTomeUseful(stat: HordeStat, known: HordeMove[]): boolean {
  if (stat === 'area') return known.some((m) => HORDE_LAUNCHER_SHAPES.includes(hordeMoveShape(m)))
  if (stat === 'reach') return known.some((m) => hordeMoveShape(m) === 'melee')
  return true
}

// Curse: each pick adds this many times a stat pick's percent to HP and Defense alike (+8% to
// +40%), and takes this many times that off the lead's Speed (3 to 15 points) - never past the
// most, and once there it's no longer offered (the pick that reaches it gives only its share of HP and Defense).
export const HORDE_CURSE_SCALE = 1.6
export const HORDE_CURSE_SLOW = 0.375
export const HORDE_CURSE_MAX_SLOW = 50
// Any HP back over time (Regenerator, Leftovers) waits this long after the lead is hit, so
// stacking it with Defense can't make the lead outheal everything.
export const HORDE_REGEN_DELAY_MS = 1500
// The same for the four base stats. Speed tomes add flat Speed points instead of a percent:
// 5 for a common pick up to 25 for a legendary one (see hordeWalkFactor for what they're worth).
export const HORDE_BASE_SCALE: Record<HordeBaseStat, number> = { hp: 1, atk: 1, def: 1, spe: 1 }
// A critical hit's chance (percent) and how much harder it lands, before any picks.
export const HORDE_CRIT_CHANCE = 4
export const HORDE_CRIT_DAMAGE = 1.5

// Sniper (Crit chance) past +200% and Merciless (Crit damage) past +300% give less and less:
// what's over the line counts as over / (1 + over / line), so it can never add more than the line
// again (+300% Crit chance counts as +267%, +600% Crit damage as +450%).
export const HORDE_BONUS_SOFT_CAP: Partial<Record<HordeBonusStat, number>> = { critChance: 200, critDamage: 300 }

/** A bonus stat's percent after its soft cap (see HORDE_BONUS_SOFT_CAP). */
export function hordeSoftCap(stat: HordeBonusStat, percent: number): number {
  const line = HORDE_BONUS_SOFT_CAP[stat]
  if (line === undefined || percent <= line) return percent
  const over = percent - line
  return line + over / (1 + over / line)
}

/**
 * How many times a hit crits with this chance (percent): past 100% every hit crits, and
 * what's over is the chance it crits again - at 170% one crit for sure, and seven times in
 * ten the crit damage lands twice over (a third time past 200%, and so on).
 */
export function hordeRollCrits(chance: number): number {
  const sure = Math.floor(Math.max(0, chance) / 100)
  return sure + (Math.random() * 100 < chance - sure * 100 ? 1 : 0)
}

// Some tomes give less with each rank already held: a pick adds its percent divided by
// 1 + this much per rank. Crit damage: half at the 6th pick. Resisted damage: half at the 6th too.
// Experience, Attack, Defense, Regenerator, Good as Gold and Curse: half at the 11th. Never under 1% (0.1% for Regenerator).
// Speed has none: each Speed point already walks less faster the more Speed the lead has.
export const HORDE_TOME_FALLOFF: Partial<Record<HordeStat, number>> = {
  exp: 0.1,
  critDamage: 0.2,
  resist: 0.2,
  atk: 0.1,
  def: 0.1,
  regen: 0.1,
  goldGain: 0.1,
  curse: 0.1
}

/** What a tome pick's percent is divided by, with this many ranks of it already held. */
function hordeTomeDivisor(stat: HordeStat, ranksHeld: number): number {
  return 1 + (HORDE_TOME_FALLOFF[stat] ?? 0) * Math.max(0, ranksHeld)
}

/** The percent a pick of one of the base stats adds, given how many ranks of that tome are already held. */
export function hordeBaseStatPercent(stat: HordeBaseStat, rarity: RarityTier, ranksHeld = 0): number {
  const full = HORDE_STAT_PERCENT[rarity] * HORDE_BASE_SCALE[stat]
  const divisor = hordeTomeDivisor(stat, ranksHeld)
  return divisor === 1 ? full : Math.max(1, Math.round((full / divisor) * 10) / 10)
}

/** The percent a pick of one of the bonus stats adds, given how many ranks of that tome are already held. */
export function hordeBonusPercent(stat: HordeBonusStat, rarity: RarityTier, ranksHeld = 0): number {
  const full = HORDE_STAT_PERCENT[rarity] * HORDE_BONUS_SCALE[stat]
  const divisor = hordeTomeDivisor(stat, ranksHeld)
  // Regenerator's percents are small, so it keeps one decimal.
  if (stat === 'regen') return Math.max(0.1, Math.round((full / divisor) * 10) / 10)
  return divisor === 1 ? Math.round(full) : Math.max(1, Math.round(full / divisor))
}

/** What a Curse pick adds to HP and Defense (each) and its Speed debuff, in percent - with this much slow already on. */
export function hordeCurseGain(rarity: RarityTier, ranksHeld = 0, slowHeld = 0): { up: number; down: number } {
  const up = Math.max(1, Math.round((HORDE_STAT_PERCENT[rarity] * HORDE_CURSE_SCALE) / hordeTomeDivisor('curse', ranksHeld)))
  const down = Math.max(1, Math.round(up * HORDE_CURSE_SLOW))
  const room = Math.max(0, HORDE_CURSE_MAX_SLOW - slowHeld)
  if (down <= room) return { up, down }
  return { up: Math.round((up * room) / down), down: room }
}

// Items a KO sometimes drops (a wild Pokemon now and then, an elite often, a boss always),
// picked up like experience. Each has a weight for which one it is (none for one that only
// drops from somewhere in particular), and its icon.
export type HordeItemId =
  'magnet' | 'choiceScarf' | 'boosterEnergy' | 'flameOrb' | 'icyRock' | 'fullRestore' | 'bigNugget' | 'maxMushroom' | 'chest'
export const HORDE_ITEMS: Record<HordeItemId, { weight: number; spritenum: number }> = {
  // Pulls every bit of experience on the ground to the lead.
  magnet: { weight: 20, spritenum: 273 },
  // Twice the walking pace for a while.
  choiceScarf: { weight: 15, spritenum: 69 },
  // Every cooldown runs faster for a while.
  boosterEnergy: { weight: 15, spritenum: 745 },
  // Twice the damage for a while.
  flameOrb: { weight: 12, spritenum: 145 },
  // Freezes every wild Pokemon on screen (an elite for half as long, a boss a quarter).
  icyRock: { weight: 12, spritenum: 221 },
  // Back to full HP (shown with Berry Juice's icon).
  fullRestore: { weight: 10, spritenum: 22 },
  // Adds to what the run pays.
  bigNugget: { weight: 6, spritenum: 27 },
  // Only from a Gigantamax boss: the lead's max HP grows for good.
  maxMushroom: { weight: 0, spritenum: -32 },
  // Only from bosses and now and then an elite (see HORDE_CHEST_DROP_CHANCE): opens there and
  // then, for free - and without making the chests on the field any dearer (the chests' own icon).
  chest: { weight: 0, spritenum: -40 }
}
export const HORDE_ITEM_IDS = Object.keys(HORDE_ITEMS) as HordeItemId[]
export const HORDE_ITEM_CHANCE: Record<HordeFoeKind, number> = { wild: 0.015, elite: 0.3, boss: 1 }
// A dropped chest, on top of any item: every boss leaves one, an elite 1 time in 10.
export const HORDE_CHEST_DROP_CHANCE: Record<HordeFoeKind, number> = { wild: 0, elite: 0.1, boss: 1 }
// In endless mode wild Pokemon and elites drop items only this share as often (a boss still always does).
export const HORDE_ENDLESS_ITEM_SHARE = 0.25
// How long the Choice Scarf, Booster Energy and Flame Orb last, and what they do.
export const HORDE_ITEM_BUFF_MS = 30000
export const HORDE_SCARF_WALK = 2
export const HORDE_BOOSTER_SPEED = 0.5
export const HORDE_FLAME_ORB_DAMAGE = 2
export const HORDE_ICY_ROCK_MS = 10000
export const HORDE_BIG_NUGGET_MONEY = 5000
// What a Max Mushroom adds to the lead's max HP, in percent.
export const HORDE_MAX_MUSHROOM_HP = 10
// Items on the ground last a minute, flashing through the last 10 seconds (a dropped chest stays till it's picked up).
export const HORDE_ITEM_LIFESPAN_MS = 60000
export const HORDE_ITEM_FLASH_MS = 50000

// Gold: every point of experience picked up brings 1 gold with it, spent on the chests about
// the field. The field starts with none; one turns up every so often all run long (endless
// mode included) while there are fewer than the most it holds - somewhere around the lead
// (between the near and far distances) and apart from every other chest. The first costs this
// much, and each one opened makes the next cost this many times more, on top of a step: 15,
// 28, 42, 60, 81, 105, 133... and ever dearer in endless mode.
export const HORDE_GOLD_PER_EXP = 1
export const HORDE_MOST_CHESTS = 8
export const HORDE_CHEST_EVERY_MS = 30000
export const HORDE_CHEST_COST = 15
export const HORDE_CHEST_COST_STEP = 10
export const HORDE_CHEST_COST_GROWTH = 1.1
export const HORDE_CHEST_NEAR = 250
export const HORDE_CHEST_FAR = 550
export const HORDE_CHEST_SPACING = 200
// The lead opens a chest from this close.
export const HORDE_CHEST_REACH = 100
// How many items a chest gives, one to five: one half the time, two a quarter, three 1 in 8,
// four 1 in 12 and five 1 in 25 - Luck makes more likelier (by the same soft cap as rarities),
// but never touches the items' rarities.
export const HORDE_CHEST_ITEM_WEIGHTS = [50, 25, 13, 8, 4]
export const HORDE_CHEST_LUCK_WEIGHT = [0, 0.02, 0.04, 0.06, 0.08]

/** What a chest costs after this many have been opened. */
export function hordeChestCost(opened: number): number {
  return Math.round((HORDE_CHEST_COST + HORDE_CHEST_COST_STEP * opened) * Math.pow(HORDE_CHEST_COST_GROWTH, opened))
}

// Shrines: two Totem Trials and two Tapu Ruins stand about the field from the start, and one
// more of each turns up every 5 minutes all run long (endless mode included) - each well away
// from the lead and from every other shrine. Once done, a shrine is gone.
export type HordeShrineKind = 'totem' | 'tapu'
export const HORDE_SHRINE_KINDS: HordeShrineKind[] = ['totem', 'tapu']
export const HORDE_SHRINES_AT_START = 2
export const HORDE_SHRINE_EVERY_MS = 5 * 60 * 1000
export const HORDE_SHRINE_SPACING = 800
export const HORDE_SHRINE_LEAD_GAP = 600
// A Totem Trial is started (E, or a tap) from this close. Its totem - an elite with half again
// its HP - rises by the shrine with this many wild Pokemon round it, a ring this wide; the trial
// is done once every one of them is down, however long that takes. It then scatters experience
// worth this many of the lead's next levels about the shrine.
export const HORDE_SHRINE_REACH = 110
export const HORDE_TOTEM_FOES = [10, 14]
export const HORDE_TOTEM_RING = 280
export const HORDE_TOTEM_HP = 1.5
export const HORDE_TOTEM_LEVELS = 2
export const HORDE_TOTEM_PILES = 10
// The totem and its ring rise out of the ground this many times slower than other foes, so the
// lead has time to slip out of the ring before it closes.
export const HORDE_TOTEM_RISE = 3
// A Tapu Ruin fills while the lead stands in its circle, and keeps what it has filled while the
// lead is out of it. The first time the lead steps in, this many elites
// rise round it to defend it, this many levels above the run's elites (and as many again the
// first time it's half full). Once full it raises one
// stat at random for good - by this many times a legendary pick of it, without taking an
// ability slot.
export const HORDE_TAPU_RADIUS = 180
export const HORDE_TAPU_HOLD_MS = 30000
export const HORDE_TAPU_DEFENDERS = 3
export const HORDE_TAPU_DEFENDER_LEVELS = 10
export const HORDE_TAPU_BOOST = 1.5
// Either shrine done adds gold straight away: this much, plus this many chests at their current price.
export const HORDE_SHRINE_GOLD = 100
export const HORDE_SHRINE_GOLD_CHESTS = 1.5
// What a Tapu Ruin can raise: every stat but Curse, HP included.
export const HORDE_TAPU_STATS: Exclude<HordeStat, 'curse'>[] = ['hp', 'atk', 'def', 'spe', 'area', 'reach', 'haste', 'pickup', 'critChance', 'critDamage', 'exp', 'resist', 'luck', 'regen', 'goldGain']
// The shrines' look: the achievements icon.
export const HORDE_SHRINE_ICON = './icons/nav/achievements.png'

// Held items, from chests (each by its English name, for its translation): each copy adds its buff for good, stacking with every other copy.
// What a held item can raise: the four base stats and Range, Haste, Pickup, Crit chance and
// Crit damage (in percent, like the tomes), Luck (points), and a few of their own - more
// experience and gold, HP back every second (percent of max HP), and harder hits from moves
// of the lead's own types (all percent) - and the rule-bending ones: faints saved (Focus Sash),
// a flinch chance on every hit (King's Rock), damage dealt healed (Shell Bell), attackers' max HP
// hit back at them (Rocky Helmet), more healing (Big Root), Eject Button uses a minute, power a
// use while unhit (Metronome) and the lead's own drawbacks shrugged off (Clear Amulet) - and the
// Megabonk-style ones: damage and Luck for every chest opened, an execute that leaves Attack behind,
// free chests, damage by gold held, huge hits, lightning, KO blasts, freezes, poison, dodges, a
// rush when hit, damage by walking speed, a rarer level-up, and Attack by KOs.
export type HordeHeldStat =
  | HordeStat
  | 'gold'
  | 'stab'
  | 'sash'
  | 'flinch'
  | 'lifesteal'
  | 'helmet'
  | 'healing'
  | 'eject'
  | 'metronome'
  | 'amulet'
  | 'chestDamage'
  | 'chestLuck'
  | 'execute'
  | 'freeChest'
  | 'goldDamage'
  | 'bigHit'
  | 'lightning'
  | 'koBlast'
  | 'slowHit'
  | 'poisonHit'
  | 'dodge'
  | 'hurtRush'
  | 'speedDamage'
  | 'candy'
  | 'koAttack'
  | 'reroll'
  | 'ghosts'
export type HordeHeldId =
  | 'hpUp'
  | 'protein'
  | 'iron'
  | 'carbos'
  | 'quickClaw'
  | 'scopeLens'
  | 'wideLens'
  | 'luckyEgg'
  | 'expShare'
  | 'amuletCoin'
  | 'razorClaw'
  | 'leftovers'
  | 'magnet'
  | 'choiceBand'
  | 'assaultVest'
  | 'expertBelt'
  | 'lifeOrb'
  | 'luckyPunch'
  | 'kingsRock'
  | 'bigRoot'
  | 'shellBell'
  | 'rockyHelmet'
  | 'clearAmulet'
  | 'ejectButton'
  | 'metronome'
  | 'focusSash'
  | 'relicCrown'
  | 'luckIncense'
  | 'reaperCloth'
  | 'cardKey'
  | 'pearlString'
  | 'muscleBand'
  | 'cellBattery'
  | 'charcoal'
  | 'neverMeltIce'
  | 'poisonBarb'
  | 'brightPowder'
  | 'ejectPack'
  | 'quickPowder'
  | 'rareCandy'
  | 'spellTag'
  | 'loadedDice'
  | 'oddKeystone'
// A one-time item (unique) turns up in a chest only while the lead hasn't got it - one copy a run.
// One-time items are all legendary, and items whose bonus grows over the run are mythical (epic).
export const HORDE_HELD_ITEMS: Record<HordeHeldId, { name: string; rarity: RarityTier; stat: HordeHeldStat; amount: number; spritenum: number; unique?: boolean }> = {
  hpUp: { name: 'HP Up', rarity: 'common', stat: 'hp', amount: 2, spritenum: -33 },
  protein: { name: 'Protein', rarity: 'common', stat: 'atk', amount: 2, spritenum: -34 },
  iron: { name: 'Iron', rarity: 'common', stat: 'def', amount: 2, spritenum: -35 },
  carbos: { name: 'Carbos', rarity: 'common', stat: 'spe', amount: 4, spritenum: -36 },
  quickClaw: { name: 'Quick Claw', rarity: 'uncommon', stat: 'haste', amount: 5, spritenum: 373 },
  scopeLens: { name: 'Scope Lens', rarity: 'uncommon', stat: 'critChance', amount: 3, spritenum: 429 },
  wideLens: { name: 'Wide Lens', rarity: 'uncommon', stat: 'area', amount: 6, spritenum: 537 },
  luckyEgg: { name: 'Lucky Egg', rarity: 'uncommon', stat: 'exp', amount: 8, spritenum: -37 },
  expShare: { name: 'Exp. Share', rarity: 'rare', stat: 'exp', amount: 15, spritenum: -41 },
  amuletCoin: { name: 'Amulet Coin', rarity: 'uncommon', stat: 'gold', amount: 10, spritenum: -38 },
  razorClaw: { name: 'Razor Claw', rarity: 'rare', stat: 'critDamage', amount: 15, spritenum: 382 },
  leftovers: { name: 'Leftovers', rarity: 'rare', stat: 'regen', amount: 0.5, spritenum: 242 },
  magnet: { name: 'Magnet', rarity: 'rare', stat: 'pickup', amount: 25, spritenum: 273 },
  choiceBand: { name: 'Choice Band', rarity: 'epic', stat: 'atk', amount: 10, spritenum: 68 },
  assaultVest: { name: 'Assault Vest', rarity: 'epic', stat: 'def', amount: 10, spritenum: 581 },
  expertBelt: { name: 'Expert Belt', rarity: 'epic', stat: 'stab', amount: 15, spritenum: 132 },
  lifeOrb: { name: 'Life Orb', rarity: 'legendary', stat: 'atk', amount: 20, spritenum: 249 },
  luckyPunch: { name: 'Lucky Punch', rarity: 'epic', stat: 'luck', amount: 3, spritenum: 261 },
  kingsRock: { name: "King's Rock", rarity: 'uncommon', stat: 'flinch', amount: 2, spritenum: 236 },
  bigRoot: { name: 'Big Root', rarity: 'uncommon', stat: 'healing', amount: 5, spritenum: 29 },
  shellBell: { name: 'Shell Bell', rarity: 'rare', stat: 'lifesteal', amount: 0.3, spritenum: 438 },
  rockyHelmet: { name: 'Rocky Helmet', rarity: 'rare', stat: 'helmet', amount: 2, spritenum: 417 },
  clearAmulet: { name: 'Clear Amulet', rarity: 'legendary', stat: 'amulet', amount: 100, spritenum: 747, unique: true },
  ejectButton: { name: 'Eject Button', rarity: 'legendary', stat: 'eject', amount: 1, spritenum: 118, unique: true },
  metronome: { name: 'Metronome', rarity: 'epic', stat: 'metronome', amount: 1, spritenum: 289 },
  focusSash: { name: 'Focus Sash', rarity: 'legendary', stat: 'sash', amount: 1, spritenum: 151 },
  relicCrown: { name: 'Relic Crown', rarity: 'legendary', stat: 'chestDamage', amount: 1.5, spritenum: -42, unique: true },
  luckIncense: { name: 'Luck Incense', rarity: 'legendary', stat: 'chestLuck', amount: 1, spritenum: -43, unique: true },
  reaperCloth: { name: 'Reaper Cloth', rarity: 'legendary', stat: 'execute', amount: 0.5, spritenum: 385, unique: true },
  cardKey: { name: 'Card Key', rarity: 'rare', stat: 'freeChest', amount: 10, spritenum: -44 },
  pearlString: { name: 'Pearl String', rarity: 'epic', stat: 'goldDamage', amount: 1, spritenum: -45 },
  muscleBand: { name: 'Muscle Band', rarity: 'epic', stat: 'bigHit', amount: 1, spritenum: 297 },
  cellBattery: { name: 'Cell Battery', rarity: 'uncommon', stat: 'lightning', amount: 4, spritenum: 60 },
  charcoal: { name: 'Charcoal', rarity: 'uncommon', stat: 'koBlast', amount: 8, spritenum: 61 },
  neverMeltIce: { name: 'Never-Melt Ice', rarity: 'uncommon', stat: 'slowHit', amount: 2, spritenum: 305 },
  poisonBarb: { name: 'Poison Barb', rarity: 'uncommon', stat: 'poisonHit', amount: 5, spritenum: 343 },
  brightPowder: { name: 'Bright Powder', rarity: 'rare', stat: 'dodge', amount: 5, spritenum: 51 },
  ejectPack: { name: 'Eject Pack', rarity: 'legendary', stat: 'hurtRush', amount: 30, spritenum: 714, unique: true },
  quickPowder: { name: 'Quick Powder', rarity: 'epic', stat: 'speedDamage', amount: 0.25, spritenum: 374 },
  rareCandy: { name: 'Rare Candy', rarity: 'epic', stat: 'candy', amount: 1, spritenum: -2 },
  spellTag: { name: 'Spell Tag', rarity: 'legendary', stat: 'koAttack', amount: 0.5, spritenum: 461, unique: true },
  loadedDice: { name: 'Loaded Dice', rarity: 'legendary', stat: 'reroll', amount: 1, spritenum: 751 },
  oddKeystone: { name: 'Odd Keystone', rarity: 'epic', stat: 'ghosts', amount: 4, spritenum: -46 }
}
// King's Rock: its flinch works as a move's own (no bosses; an elite's attacks start over for half as long).
// Shell Bell: what it heals in any one second tops out at this share of max HP, however many are held.
export const HORDE_SHELL_BELL_CAP = 0.03
// Rocky Helmet: a foe that hits the lead loses its percent of its own max HP - an elite this share
// of that, a boss this share.
export const HORDE_HELMET_SHARE: Record<HordeFoeKind, number> = { wild: 1, elite: 0.5, boss: 0.1 }
// Eject Button (one a run): the first drop below this share of max HP knocks every foe this
// close this far away, and nothing lands on the lead for a moment - then it waits this long.
export const HORDE_EJECT_LINE = 0.3
export const HORDE_EJECT_EVERY_MS = 20000
export const HORDE_EJECT_REACH = 260
export const HORDE_EJECT_PUSH = 220
export const HORDE_EJECT_SAFE_MS = 1000
// A level-up knocks every foe (but a boss) this close this far away, and nothing lands on the lead
// for this long once play goes on - so the crowd can't finish it off while the cards were up.
export const HORDE_LEVEL_PUSH_REACH = 260
export const HORDE_LEVEL_PUSH = 220
export const HORDE_LEVEL_SAFE_MS = 1000
// Metronome: each use of any move while the lead goes unhit adds a stack (up to this many), each
// stack its percent more power; being hit drops them all.
export const HORDE_METRONOME_STACKS = 10
// Focus Sash: saves the lead from fainting once and is used up - left on 1 HP, and nothing lands for
// this long. After one goes, the next can't for a while, so a burst of hits doesn't eat several.
export const HORDE_SASH_SAFE_MS = 2000
export const HORDE_SASH_COOLDOWN_MS = 15000
// Relic Crown: its percent more damage for every chest opened this run (dropped and free ones too);
// Luck Incense (one a run): its Luck for every one opened after it was found.
// Reaper Cloth (one a run): its percent a hit to knock a wild Pokemon out outright (an elite half as often, a boss
// never), each one adding this much Attack (percent) for the rest of the run.
export const HORDE_REAPER_ELITE_SHARE = 0.5
export const HORDE_REAPER_ATTACK = 0.5
// Pearl String: its percent more damage for every this much gold held, up to this much (percent) in all.
export const HORDE_PEARL_GOLD = 1000
export const HORDE_PEARL_MAX = 100
// Muscle Band: its percent a hit to land this many times harder.
export const HORDE_MUSCLE_BAND_MULT = 10
// Cell Battery: its percent a hit to call lightning down on a foe this close to the one hit, for
// this share of the hit (not the one hit, if there's another).
export const HORDE_BATTERY_REACH = 300
export const HORDE_BATTERY_SHARE = 1
// Charcoal: its percent a foe knocked out explodes, hitting those this close for this share of the hit that finished it.
export const HORDE_CHARCOAL_REACH = 100
export const HORDE_CHARCOAL_SHARE = 0.75
// Never-Melt Ice: every hit slows the foe by its percent (all copies together, up to this much) for this long.
export const HORDE_ICE_SLOW_MAX = 50
export const HORDE_ICE_SLOW_MS = 2000
// Eject Pack (one a run): its percent quicker walk for this long after the lead is hit.
export const HORDE_RUSH_MS = 3000
// Quick Powder: its percent more damage for each point of Speed buff (Speed picks, Carbos, upgrades) - Curse's
// slow doesn't take any off.
// Spell Tag: its percent more Attack for every this many KOs this run.
export const HORDE_SPELL_TAG_KOS = 100
// Loaded Dice: one more level-up reroll each, and each one deals a level-up's cards again for free
// when none of them is legendary.
// Odd Keystone: buying a field chest, starting a Totem Trial or filling a Tapu Ruin calls up a ghost
// for each one, which fires its many Shadow Balls at the foes this close, this far apart, and fades.
export const HORDE_GHOST_REACH = 450
export const HORDE_GHOST_SHOT_MS = 300
// Rare Candy: the next level-up's cards (rerolls included) come one rarity higher, and the candy is
// used up (not on an all-legendary one, when the lead evolves).

// Card Keys and Bright Powders don't simply add up: each copy's chance (the first one's in full)
// counts for less the more there are - two Card Keys are 18%, not 20%, and it never reaches 100%.
export const HORDE_STACKED_CHANCE_STATS: HordeHeldStat[] = ['freeChest', 'dodge']

/** A chance (0-1) from some copies of an item whose chances don't simply add up (see HORDE_STACKED_CHANCE_STATS). */
export function hordeStackedChance(id: HordeHeldId, copies: number): number {
  if (copies <= 0) return 0
  const p = HORDE_HELD_ITEMS[id].amount / 100
  const k = p / (1 - p)
  return 1 - 1 / (1 + k * copies)
}

// The held stats shown as a plain count rather than a percent.
export const HORDE_HELD_COUNT_STATS: HordeHeldStat[] = ['luck', 'sash', 'chestLuck', 'candy', 'spe', 'reroll', 'ghosts']
export const HORDE_HELD_IDS = Object.keys(HORDE_HELD_ITEMS) as HordeHeldId[]
// Gold's own icon (Relic Gold) and the chests' (a Machine Part).
export const HORDE_GOLD_SPRITE = -39
export const HORDE_CHEST_SPRITE = -40

/** The held items picked up, as how many copies of each. */
export type HordeHeld = Partial<Record<HordeHeldId, number>>

/** What all the held items add, by what they raise. */
export function hordeHeldTotals(held: HordeHeld): Record<HordeHeldStat, number> {
  const out = {} as Record<HordeHeldStat, number>
  for (const id of HORDE_HELD_IDS) {
    const copies = held[id] ?? 0
    if (!copies) continue
    const { stat, amount } = HORDE_HELD_ITEMS[id]
    out[stat] = (out[stat] ?? 0) + amount * copies
  }
  return out
}

/**
 * A chest's items: how many by the odds (with Luck), each's rarity rolled without Luck, then one of
 * that rarity - never a one-time item the lead already has (or that this chest already gave).
 */
export function hordeRollChest(luck: number, held: HordeHeld = {}): HordeHeldId[] {
  const effective = luck > 0 ? (luck * HORDE_LUCK_SOFT_CAP) / (luck + HORDE_LUCK_SOFT_CAP) : 0
  const weights = HORDE_CHEST_ITEM_WEIGHTS.map((w, i) => w * Math.exp(HORDE_CHEST_LUCK_WEIGHT[i] * effective))
  let roll = Math.random() * weights.reduce((a, b) => a + b, 0)
  let count = 1
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i]
    if (roll < 0) {
      count = i + 1
      break
    }
  }
  const out: HordeHeldId[] = []
  for (let i = 0; i < count; i++) {
    const rarity = hordeRollRarity(0)
    const open = HORDE_HELD_IDS.filter((id) => HORDE_HELD_ITEMS[id].rarity === rarity && !(HORDE_HELD_ITEMS[id].unique && (held[id] || out.includes(id))))
    out.push(pick(open))
  }
  return out
}

// Mega Evolution: while the lead is a form that can Mega Evolve, KOs also drop Mega Energy
// (a wild Pokemon 2 times in 5, an elite or boss always - half as much as its experience). The
// bar filling Mega Evolves it straight away, for a while: its Mega form's stats, types and
// look, and every cooldown running faster. Energy picked up while Mega Evolved adds to the
// time left (a full bar's worth being the whole 30 seconds).
export const HORDE_MEGA_CHARGE = 40
export const HORDE_MEGA_ENERGY_SHARE = 0.5
export const HORDE_MEGA_ENERGY_CHANCE: Record<HordeFoeKind, number> = { wild: 0.4, elite: 1, boss: 1 }
export const HORDE_MEGA_MS = 30000
export const HORDE_MEGA_SPEED = 0.2

// Gigantamax: now and then a boss comes Gigantamax (one of the Pokemon with that form), with
// walking half as fast, and drops a Max Mushroom when beaten.
export const HORDE_GMAX_CHANCE = 0.3
export const HORDE_GMAX_WALK = 0.5

/** Which item a drop is, by the items' weights. */
export function hordeRollItem(): HordeItemId {
  let roll = Math.random() * HORDE_ITEM_IDS.reduce((sum, id) => sum + HORDE_ITEMS[id].weight, 0)
  for (const id of HORDE_ITEM_IDS) {
    roll -= HORDE_ITEMS[id].weight
    if (roll < 0) return id
  }
  return 'magnet'
}

/** A Pokemon to pick from at the start (the setup's lead is one of these). */
export interface HordeStarter {
  species: string
  spriteId: string
  size: CompanionSize
  shiny: boolean
  // Its rarity colour, as in the box (grey to gold).
  rarityTier: RarityTier
  types: string[]
  // Its base stats, Attack being the better of its Attack and Sp. Atk.
  baseStats: HordeStats
  // What it evolves into last in the run, and the Mega form it can reach - if any.
  finalForm?: { species: string; spriteId: string; types?: string[] }
  mega?: { species: string; spriteId: string }
  // Whether the Pokemon the card shows (its last form, or its Mega) is in the player's Pokedex.
  registered?: boolean
}

/** What Start deals: the area the run is in (its wild Pokemon, its backdrop) and the Pokemon to pick from. */
export interface HordeOffer {
  location: WildLocationId
  starters: HordeStarter[]
}

/** A wild Pokemon the waves can bring, at whatever level the clock says. */
export interface HordeSpecies {
  species: string
  spriteId: string
  // How big it's drawn, by its real height - the same sizes as the companion's.
  size: CompanionSize
  types: string[]
  baseStats: HordeStats
  // It has a Gigantamax form - as a boss it always comes Gigantamax.
  canGmax?: boolean
  // It can learn Explosion or Self-Destruct (or is one of an area's exploders): as a wild
  // Pokemon it may be an exploder (see HORDE_EXPLODER_WILD_CHANCE).
  explodes?: boolean
  // Its Sp. Atk is higher than its Attack: as a wild Pokemon it may be a ranged one (see HORDE_RANGED_CHANCE).
  special?: boolean
}

/** A stage the lead evolves into, and the level it does so at. */
export interface HordeEvolution {
  level: number
  into: HordeSpecies
}

/** Everything the renderer needs to play a run, from horde:start. */
export interface HordeSetup {
  token: string
  // The wild area it's in - its Pokemon come in the waves, and it's the backdrop.
  location: WildLocationId
  fighter: HordeStarter
  // What it evolves into on the way, in order (empty if it doesn't).
  evolutions: HordeEvolution[]
  // Minior: the Core form it breaks into below half HP.
  coreForm?: HordeSpecies
  // Ditto: it transforms into the wild Pokemon, and its moves come from the area's types, not its own.
  transforms?: boolean
  moveTypes?: string[]
  // The types of attacking move its line learns in the games: by level-up, or only some other
  // way (TM, egg, tutor) - new moves of those turn up more often (none for Ditto or older saves).
  learnTypes?: Record<string, HordeLearnSource>
  // Every move, the lead's first one first.
  moves: HordeMove[]
  // Wild Pokemon by stage of the run: the first minutes, the middle, the end.
  pools: HordeSpecies[][]
  // Strong fully-evolved Pokemon for the bosses.
  bossPool: HordeSpecies[]
  // The exploders for each third of the run (see HORDE_EXPLODER_LINES) - none in runs saved before them.
  exploders?: HordeSpecies[]
  // What each of the pools' Pokemon evolves into, stage by stage, for the elites.
  evolved: Record<string, HordeSpecies[]>
  // The Mega form of each of the lead's forms that can Mega Evolve (one of them, for Charizard).
  megas: Record<string, HordeSpecies>
  // Pokemon with a Gigantamax form, for the bosses that come Gigantamax.
  gmaxPool: HordeSpecies[]
  // Attacking type -> defending type -> multiplier, for single types (dual types multiply).
  typeChart: Record<string, Record<string, number>>
  // How many times the Move Deleter can be used this run (twice with the Shapeshifter title).
  // Runs saved before it count as once.
  moveDeletes?: number
  // Schooling: extra level-up rerolls the run starts with.
  extraRerolls?: number
  // Master of Elements: the share of a type effect's chance moves of other types get (half without it).
  otherTypeShare?: number
  // The duo synergies the player has had on in a run before (see HORDE_DUOS) - none in runs saved before them.
  duosUsed?: HordeDuoId[]
  best: HordeRecord | null
  // The upgrades bought on the Horde page, as they were when the run started.
  upgrades: HordeUpgrades
}

/**
 * A run saved to carry on later: what Start dealt, and the arena's own state of play and
 * any level-up choice on screen (both only the arena reads).
 */
export interface HordeSave {
  setup: HordeSetup
  game: unknown
  choices: unknown
}

/** The saved run, as the Horde page shows it. */
export interface HordeSavedRun {
  species: string
  spriteId: string
  shiny: boolean
  location: WildLocationId
  survivedMs: number
  kos: number
  level: number
}

/** How a run went, as the renderer reports it to horde:finish. */
export interface HordeResult {
  survivedMs: number
  kos: number
  level: number
  // Lasted the full 10 minutes (survivedMs counts on into endless mode).
  won: boolean
  // Big Nuggets picked up, each adding to the pay.
  bigNuggets: number
  // What the lead was by the end (evolved, if it did).
  species: string
  // Mega Evolved at some point in the run.
  megaEvolved?: boolean
  // The moves it knew by the end and their upgrades, for the run history.
  moves?: HordeRunMove[]
  // The damage each move dealt, by its name ('' for type effects' own damage).
  damage?: Record<string, number>
  // The tomes it held and their ranks, the held items it picked up, and the chests it opened.
  tomes?: HordeTome[]
  held?: HordeHeld
  chests?: number
  // Every duo synergy that was on at some point in the run.
  duos?: HordeDuoId[]
}

/** An ability held: which stat, and how many times it's been picked (the first included). */
export interface HordeTome {
  stat: HordeStat
  ranks: number
}

/** A move the lead knew by the end of a run: its id and the upgrades it had taken. */
export interface HordeRunMove {
  id: string
  // Percent more power, percent off its cooldown, percent more reach, extra shots, percent more
  // crit damage, and how many upgrades.
  power: number
  cut: number
  range: number
  count: number
  crit?: number
  upgrades: number
}

/** One finished run, as the run history shows it. */
export interface HordeHistoryEntry {
  // When it ended.
  at: number
  location: WildLocationId
  // What it started as, and what it was by the end.
  starter: string
  species: string
  spriteId: string
  shiny: boolean
  survivedMs: number
  kos: number
  level: number
  won: boolean
  money: number
  bigNuggets: number
  megaEvolved: boolean
  moves: HordeRunMove[]
  // The damage each move dealt (see HordeResult) - none for runs from before it was kept.
  damage?: Record<string, number>
  // Tomes, held items and chests opened (see HordeResult) - none for runs from before them.
  tomes?: HordeTome[]
  held?: HordeHeld
  chests?: number
}

// How many finished runs the history keeps, newest first.
export const HORDE_HISTORY_RUNS = 50

export interface HordeRecord {
  survivedMs: number
  kos: number
  // What the lead was by the end, and how it looked.
  species: string
  spriteId: string
  shiny: boolean
  won: boolean
}

// How many of a player's best runs are kept.
export const HORDE_TOP_RUNS = 3

export interface HordeReward {
  money: number
  moneyTotal: number
  best: HordeRecord | null
  // The best runs, best first, and where this one placed among them (null if it didn't).
  top: HordeRecord[]
  place: number | null
  newBest: boolean
  // A cleared run's lead, sent to the Box at level 1.
  caught?: { species: string; spriteId: string; shiny: boolean }
}

/** The base stats Horde mode uses: Attack is the better of Attack and Sp. Atk, Defense the average of Defense and Sp. Def. */
export function hordeBaseStats(base: StatBlock): HordeStats {
  return {
    hp: base.hp,
    atk: Math.max(base.atk, base.spa),
    def: Math.round((base.def + base.spd) / 2),
    spe: base.spe
  }
}

/** Stats at a level - the games' own formula, a set IV and no EVs or nature. */
export function hordeStats(base: HordeStats, level: number, iv = 31): HordeStats {
  const core = (b: number): number => Math.floor(((2 * b + iv) * level) / 100)
  return {
    hp: base.hp === 1 ? 1 : core(base.hp) + level + 10,
    atk: core(base.atk) + 5,
    def: core(base.def) + 5,
    spe: core(base.spe) + 5
  }
}

/** How much faster (above 1) or slower a wild Pokemon's Speed makes its cooldowns, for its level. */
export function hordeSpeedFactor(speed: number, level: number): number {
  const ratio = speed / (level + 50)
  return Math.min(1.5, Math.max(0.75, 0.6 + 0.4 * ratio))
}

// The lead's walk from its Speed: an even pace (1) at a Speed of its level + 50, never under
// HORDE_WALK_FLOOR and never reaching HORDE_WALK_FLOOR + 1. Each Speed point counts for less the
// more Speed there is: at level 50, 40 -> 50 Speed walks about 5% faster, 500 -> 600 about 2%,
// and doubling an even pace's Speed walks only about 1.2 times as fast.
const HORDE_WALK_FLOOR = 0.6
const HORDE_WALK_BEND = 1.5

/** How much faster (above 1) or slower the lead walks for its Speed (buffs and Curse included) at its level. */
export function hordeWalkFactor(speed: number, level: number): number {
  const ratio = Math.max(0, speed) / (level + 50)
  return HORDE_WALK_FLOOR + ratio / (ratio + HORDE_WALK_BEND)
}

// A slow lead's pace: Electro Ball and Gyro Ball measure the walk against it.
export const HORDE_WALK_SLOWEST = 0.75

/** The lead's net Speed points: its Speed buff (picks, Carbos, upgrades) less Curse's debuff - 0 with neither. */
export function hordeNetSpeed(buff: number, debuff = 0): number {
  return Math.max(0, buff) - Math.min(HORDE_CURSE_MAX_SLOW, Math.max(0, debuff))
}

/**
 * How fast the lead walks: its Speed (buffs already in it) less Curse's debuff, at its level.
 */
export function hordeLeadWalk(speed: number, level: number, debuff = 0): number {
  return hordeWalkFactor(speed - Math.min(HORDE_CURSE_MAX_SLOW, Math.max(0, debuff)), level)
}

/**
 * What a hit's damage is multiplied by for the Resisted damage tome: a resisted hit lands this
 * much harder for each time it's resisted (twice over against a double resist). At +100% a
 * resisted hit lands as hard as a neutral one, and past that the foe's resistance plays into
 * the lead's hands. Neutral and super-effective hits are untouched.
 */
export function hordeResistBoost(effectiveness: number, bonusPercent: number): number {
  if (effectiveness >= 1 || bonusPercent <= 0) return 1
  const resists = Math.round(Math.log2(1 / effectiveness))
  return (1 + bonusPercent / 100) ** resists
}

/** The type multiplier against a Pokemon's one or two types (an immunity counting as a 4x resist). */
// No one is immune in a horde: a type that would be counts as resisting it four times over.
const HORDE_IMMUNE_MULTIPLIER = 0.25

export function hordeEffectiveness(chart: Record<string, Record<string, number>>, moveType: string, types: string[]): number {
  let m = 1
  for (const type of types) m *= chart[moveType]?.[type] || HORDE_IMMUNE_MULTIPLIER
  return m
}

/**
 * One hit's damage - the games' formula: level, power, Attack against Defense,
 * same-type bonus, type matchup, a roll of 85-100% and now and then a critical hit.
 * Spread moves hit at their listed power (their lower power is set in horde-moves.ts).
 */
export function hordeDamage(opts: {
  level: number
  power: number
  attack: number
  defense: number
  stab: boolean
  effectiveness: number
  spread: boolean
  crit: boolean
  // How much harder a critical hit lands (1.5 unless upgraded).
  critDamage?: number
}): number {
  if (opts.effectiveness === 0) return 0
  const base = Math.floor(Math.floor((Math.floor((2 * opts.level) / 5 + 2) * opts.power * opts.attack) / opts.defense) / 50) + 2
  let dmg = base
  if (opts.crit) dmg *= opts.critDamage ?? HORDE_CRIT_DAMAGE
  dmg *= 0.85 + Math.random() * 0.15
  if (opts.stab) dmg *= 1.5
  dmg *= opts.effectiveness
  return Math.max(1, Math.floor(dmg))
}

/** How many KO points the next level takes, from the run's levels gained so far - climbing a little faster the higher it gets. */
export function hordeExpToNext(levelsGained: number): number {
  return 3 + levelsGained + Math.floor((levelsGained * levelsGained) / 60)
}

/** The minute of the run, with a fraction. */
function minutes(elapsedMs: number): number {
  return elapsedMs / 60000
}

// The wild Pokemon toughen over the whole run at a steady pace, reaching their peak by this
// many minutes in (20 minutes into endless mode). The rates below are per "pace minute" - the
// clock's minutes stretched so 30 of them count as 20.
const HORDE_SCALING_MINUTES = 30
const HORDE_SCALING_PACE_MINUTES = 20

/** How far along the toughening is, in pace minutes. */
function paceMinutes(elapsedMs: number): number {
  return (minutes(Math.max(0, elapsedMs)) * HORDE_SCALING_PACE_MINUTES) / HORDE_SCALING_MINUTES
}

/** Wild Pokemon's level: 2 at the start, climbing steadily to 100 by 30 minutes in (20 into endless mode). */
export function hordeFoeLevel(elapsedMs: number): number {
  const level = 2 + 98 * Math.min(1, paceMinutes(elapsedMs) / HORDE_SCALING_PACE_MINUTES)
  return Math.max(2, Math.min(100, Math.round(level)))
}

// Wild Pokemon's HP grows this many times over every 10 minutes on the clock, smoothly in between
// (twice as fast in endless mode), and waves come this much more often each pace minute (never closer than the last).
const HORDE_FOE_HP_GROWTH_PER_10_MINUTES = 4
const HORDE_ENDLESS_HP_GROWTH_PER_10_MINUTES = 8
const HORDE_WAVE_GROWTH = 0.15
const HORDE_MIN_WAVE_MS = 120

/** Extra HP on wild Pokemon as the clock runs, on top of their levels - 4x every 10 minutes, 8x in endless mode. */
export function hordeFoeHpScale(elapsedMs: number): number {
  const m = minutes(Math.max(0, elapsedMs))
  const main = Math.min(m, minutes(HORDE_DURATION_MS))
  return (
    Math.pow(HORDE_FOE_HP_GROWTH_PER_10_MINUTES, main / 10) * Math.pow(HORDE_ENDLESS_HP_GROWTH_PER_10_MINUTES, (m - main) / 10)
  )
}

/**
 * Extra Defense on wild Pokemon in endless mode, on top of their levels - growing as their HP
 * does there, 8x every 10 minutes (1 before endless mode).
 */
export function hordeFoeDefScale(elapsedMs: number): number {
  const endless = minutes(Math.max(0, elapsedMs - HORDE_DURATION_MS))
  return Math.pow(HORDE_ENDLESS_HP_GROWTH_PER_10_MINUTES, endless / 10)
}

/** The most wild Pokemon in the arena at once, now. */
export function hordeMaxFoes(elapsedMs: number): number {
  return Math.min(HORDE_MOST_FOES, HORDE_MAX_FOES + Math.floor(HORDE_FOES_PER_MINUTE * paceMinutes(elapsedMs)))
}

// Some of each wave come as elites: 1 in 20 at first, climbing to 9 in 10 by 30 minutes in.
const HORDE_WAVE_ELITE_START = 0.05
const HORDE_WAVE_ELITE_MOST = 0.9
const HORDE_WAVE_ELITE_FULL_MINUTES = 20

/** The share of a wave's wild Pokemon that come as elites now. */
export function hordeWaveEliteShare(elapsedMs: number): number {
  const m = paceMinutes(elapsedMs)
  return Math.min(HORDE_WAVE_ELITE_MOST, HORDE_WAVE_ELITE_START + ((HORDE_WAVE_ELITE_MOST - HORDE_WAVE_ELITE_START) * m) / HORDE_WAVE_ELITE_FULL_MINUTES)
}

// Wild Pokemon's hits land this many times harder than the damage formula gives from the start,
// this much harder each pace minute on top of their levels, compounding - and in endless mode this
// much harder again each minute on the clock, so only a lead that keeps raising its Defense isn't
// knocked out in one hit.
const HORDE_FOE_ATTACK = 2
const HORDE_FOE_ATTACK_GROWTH = 1.06
const HORDE_ENDLESS_ATTACK_GROWTH = 1.25

/** How much harder than the damage formula gives wild Pokemon hit now. */
export function hordeFoeAttackScale(elapsedMs: number): number {
  const endlessMinutes = minutes(Math.max(0, elapsedMs - HORDE_DURATION_MS))
  return HORDE_FOE_ATTACK * Math.pow(HORDE_FOE_ATTACK_GROWTH, paceMinutes(elapsedMs)) * Math.pow(HORDE_ENDLESS_ATTACK_GROWTH, endlessMinutes)
}

/** How many elites come each minute: one at first, and one more every 3 minutes. */
export function hordeEliteCount(elapsedMs: number): number {
  return 1 + Math.floor(paceMinutes(elapsedMs) / 2)
}

/**
 * How long a wild Pokemon waits between attacks, as a share of the move's own cooldown:
 * the move's own at first, getting quicker (by 15 minutes in) down to a third of it.
 */
export function hordeFoeCooldownScale(elapsedMs: number): number {
  return Math.max(0.325, 1 - 0.0675 * paceMinutes(elapsedMs))
}

// How fast wild Pokemon walk in, in arena units a second, for one as quick as a base-100
// Speed Pokemon at its level; anything slower walks slower (down to just over half that),
// and only the very fastest a little quicker (up to 15% more).
export const HORDE_FOE_WALK = 70

// Wild (unevolved) Pokemon walk this much quicker each pace minute, up to the most.
const HORDE_FOE_WALK_GROWTH = 0.07
const HORDE_FOE_MOST_WALK = 3

/** How much quicker than at the start wild Pokemon walk now. */
export function hordeFoeWalkScale(elapsedMs: number): number {
  return Math.min(HORDE_FOE_MOST_WALK, 1 + HORDE_FOE_WALK_GROWTH * paceMinutes(elapsedMs))
}

// In endless mode every foe on the field (bosses too) walks quicker still, by this much more
// each minute into it - 15% a minute, so twice its pace by about 7 minutes in, three times by 13.
const HORDE_ENDLESS_WALK_PER_MINUTE = 0.15

/** How much quicker every foe walks for how long endless mode has been going (1 before it). */
export function hordeEndlessWalkScale(elapsedMs: number): number {
  return 1 + HORDE_ENDLESS_WALK_PER_MINUTE * minutes(Math.max(0, elapsedMs - HORDE_DURATION_MS))
}

/** A wild Pokemon's walking speed from its Speed stat at its level. */
export function hordeFoeWalk(speed: number, level: number): number {
  const base100 = Math.floor(((2 * 100 + 15) * level) / 100) + 5
  const ratio = speed / base100
  const factor = ratio <= 1 ? Math.max(0.55, 0.45 + 0.55 * ratio) : Math.min(1.15, 1 + (ratio - 1) * 0.25)
  return HORDE_FOE_WALK * factor
}

/** How long between waves, and how many in each. */
export function hordeWave(elapsedMs: number): {
  intervalMs: number
  size: number
} {
  const m = paceMinutes(elapsedMs)
  return {
    intervalMs: Math.max(HORDE_MIN_WAVE_MS, 2600 / (1 + HORDE_WAVE_GROWTH * m)),
    // One bigger every 3 minutes.
    size: 1 + Math.floor(m / 2)
  }
}

/** Which of the setup's pools the waves draw from now. */
export function hordePoolIndex(elapsedMs: number, poolCount: number): number {
  return Math.min(poolCount - 1, Math.floor((elapsedMs / HORDE_DURATION_MS) * poolCount))
}

/**
 * A level-up choice: learn a move, upgrade a known one (by its slot), take a new tome or
 * upgrade one held (isNew tells which) - each with a rarity.
 * With nothing else left to offer, it's gold.
 */
export type HordeChoice =
  | { kind: 'learn'; move: HordeMove; rarity: RarityTier; boosts: HordeMoveBoost[] }
  | { kind: 'upgrade'; slot: number; rarity: RarityTier; boosts: HordeMoveBoost[] }
  | { kind: 'stat'; stat: HordeStat; rarity: RarityTier; isNew?: boolean }
  | { kind: 'gold'; rarity: RarityTier }
  | { kind: 'multi'; rarity: RarityTier }

// The stronger a move, the rarer the choice that offers it (each move's rarity is in its HordeMoveDef).
const moveRarity = (m: HordeMove): RarityTier => hordeMoveDef(m).rarity

// The second new move's card: one of the lead's own types this often, else one of the
// types it'll gain by evolving or Mega Evolving this often (if there are any), else any other type.
export const HORDE_LEARN_OWN_CHANCE = 0.67
export const HORDE_LEARN_FUTURE_CHANCE = 0.4

/** How the lead's line learns attacking moves of a type in the games. */
export type HordeLearnSource = 'level' | 'taught'

// A new move's type is picked by weight: types its line learns moves of by level-up are
// much likelier than others, ones it can only be taught a bit less so, and types it can't
// learn at all still turn up now and then.
export const HORDE_LEARN_WEIGHT: Record<HordeLearnSource | 'none', number> = { level: 8, taught: 4, none: 1 }
// ...and a type that would complete a duo synergy with a known move's type this many times as likely.
export const HORDE_LEARN_DUO_WEIGHT = 1.25

// A new move's card only knows which types it draws from until its rarity is rolled: the
// lead's own, the ones it'll gain later, or any other.
type LearnFrom = 'own' | 'future' | 'other'
type UnrolledChoice =
  | { kind: 'learn'; from: LearnFrom }
  | { kind: 'upgrade'; slot: number }
  | { kind: 'stat'; stat: HordeStat; isNew: boolean }
  | { kind: 'multi' }

const rarityRank = (r: RarityTier): number => HORDE_RARITIES.indexOf(r)

// Luck gives less the more there is: it counts as Luck x cap / (Luck + cap), so 130 Luck
// counts as 65 and it never counts past the cap - late runs stay a mix instead of all legendary.
export const HORDE_LUCK_SOFT_CAP = 130

// Each rarity's weight with this much Luck.
function rarityWeights(luck: number): number[] {
  const effective = luck > 0 ? (luck * HORDE_LUCK_SOFT_CAP) / (luck + HORDE_LUCK_SOFT_CAP) : 0
  return HORDE_RARITIES.map((r) => HORDE_RARITY_WEIGHTS[r] * Math.exp(HORDE_LUCK_WEIGHT[r] * effective))
}

/** A rarity rolled with this much Luck. */
export function hordeRollRarity(luck: number): RarityTier {
  const weights = rarityWeights(luck)
  let roll = Math.random() * weights.reduce((a, b) => a + b, 0)
  for (let i = 0; i < HORDE_RARITIES.length; i++) {
    roll -= weights[i]
    if (roll < 0) return HORDE_RARITIES[i]
  }
  return 'common'
}

/** Each rarity's chance (0-1) with this much Luck. */
export function hordeRarityOdds(luck: number): Record<RarityTier, number> {
  const weights = rarityWeights(luck)
  const total = weights.reduce((a, b) => a + b, 0)
  return Object.fromEntries(HORDE_RARITIES.map((r, i) => [r, weights[i] / total])) as Record<RarityTier, number>
}

function shuffled<T>(list: T[]): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * The choices a level-up offers: a couple of new moves while there's room (mostly of the
 * lead's own types, and often of the types its evolutions or Mega form will have, else mostly of
 * types its line learns moves of in the games), upgrading any known move, upgrading any tome held,
 * and a couple of new tomes while there's room (see HORDE_MAX_TOMES) - three of those, picked at random
 * (leaving out new moves and tomes banished this run, see hordeCanBanish),
 * each with a rarity rolled with the lead's Luck (or all legendary, on the level it evolves at).
 * A new move is picked once its rarity is rolled: the strongest kind that rarity offers
 * (see each move's rarity), or a weaker one if it knows those already. Now and then
 * Multi-target can turn up too while it knows a move it helps, until it's been picked
 * HORDE_MAX_MULTI times or banished - but only when that card's rarity rolls legendary. A move upgrade (or a new move's head start)
 * raises only what its rarity allows (see HORDE_BOOST_COUNT), rolled with the card.
 */
export function hordeLevelChoices(
  known: HordeMove[],
  catalog: HordeMove[],
  types: string[],
  luck: number,
  allLegendary: boolean,
  multiPicks = 0,
  count = HORDE_LEVEL_CHOICES,
  futureTypes: string[] = [],
  tomes: HordeStat[] = [],
  banished: string[] = [],
  learnTypes: Record<string, HordeLearnSource> = {},
  // Tomes held that can't go any higher (Curse at its most slow) - not offered again.
  maxed: HordeStat[] = []
): HordeChoice[] {
  const banishedSet = new Set(banished)
  const isBanished = (key: string): boolean => banishedSet.has(key)
  const pool: UnrolledChoice[] = []
  const knownIds = new Set(known.map((m) => m.id))
  const unknown = catalog.filter((m) => !knownIds.has(m.id) && !isBanished(`type:${m.type}`) && !isBanished(`move:${m.id}`))
  if (known.length < HORDE_MAX_MOVES && unknown.length) {
    // Two new moves, each its own type two times in three - or, with types still to come from
    // evolving, its own less often and those instead - else any other type.
    const future = futureTypes.filter((t) => !types.includes(t) && unknown.some((m) => m.type === t))
    const futureChance = future.length ? HORDE_LEARN_FUTURE_CHANCE : 0
    const ownChance = HORDE_LEARN_OWN_CHANCE * (1 - futureChance)
    for (let i = 0; i < 2; i++) {
      const roll = Math.random()
      pool.push({ kind: 'learn', from: roll < futureChance ? 'future' : roll < futureChance + ownChance ? 'own' : 'other' })
    }
  }
  known.forEach((_, slot) => pool.push({ kind: 'upgrade', slot }))
  for (const stat of tomes) if (!maxed.includes(stat)) pool.push({ kind: 'stat', stat, isNew: false })
  // Two new tomes - Mega Launcher and Long Reach less often while no known move makes use of them.
  if (tomes.length < HORDE_MAX_TOMES) {
    const open = HORDE_STATS.filter((s) => !tomes.includes(s) && !isBanished(`stat:${s}`))
    for (let i = 0; i < 2 && open.length; i++) {
      const weights = open.map((s) => (hordeTomeUseful(s, known) ? 1 : HORDE_UNUSED_TOME_WEIGHT))
      let roll = Math.random() * weights.reduce((sum, w) => sum + w, 0)
      let at = weights.findIndex((w) => (roll -= w) < 0)
      if (at < 0) at = open.length - 1
      pool.push({ kind: 'stat', stat: open[at], isNew: true })
      open.splice(at, 1)
    }
  }
  // Multi-target only while it knows a move it helps (its legendary roll comes below).
  const helped = known.some((m) => !hordeHitsMany(m) || hordeRepeatsOnMulti(m))
  if (helped && multiPicks < HORDE_MAX_MULTI && !isBanished('multi')) pool.push({ kind: 'multi' })

  // A move of the right types (or any, if there's none) the rarity allows: its type picked by
  // how the lead's line learns it (see HORDE_LEARN_WEIGHT), then that type's strongest kind.
  // The two new moves are always of different types.
  const takenTypes = new Set<string>()
  const pickMove = (source: LearnFrom, rarity: RarityTier): HordeMove | null => {
    const open = unknown.filter((m) => !takenTypes.has(m.type))
    const typed = open.filter((m) =>
      source === 'own' ? types.includes(m.type) : source === 'future' ? futureTypes.includes(m.type) && !types.includes(m.type) : !types.includes(m.type)
    )
    const from = typed.length ? typed : open
    const allowed = from.filter((m) => rarityRank(moveRarity(m)) <= rarityRank(rarity))
    if (!allowed.length) return null
    // A type that would complete a duo synergy with a move already known is a little likelier.
    const knownTypes = hordeEffectTypes(known)
    const pairs = (type: string): boolean =>
      !knownTypes.includes(type) && HORDE_DUOS.some((d) => d.types.includes(type) && d.types.some((other) => other !== type && knownTypes.includes(other)))
    const typeWeights = [...new Set(allowed.map((m) => m.type))].map((type) => ({
      type,
      weight: HORDE_LEARN_WEIGHT[learnTypes[type] ?? 'none'] * (pairs(type) ? HORDE_LEARN_DUO_WEIGHT : 1)
    }))
    let roll = Math.random() * typeWeights.reduce((sum, w) => sum + w.weight, 0)
    const type = (typeWeights.find((w) => (roll -= w.weight) < 0) ?? typeWeights[typeWeights.length - 1]).type
    const ofType = allowed.filter((m) => m.type === type)
    const best = Math.max(...ofType.map((m) => rarityRank(moveRarity(m))))
    const move = pick(ofType.filter((m) => rarityRank(moveRarity(m)) === best))
    takenTypes.add(move.type)
    return move
  }

  // At least one choice that isn't a move: one of the stat picks goes first.
  const order = shuffled(pool)
  const notMove = order.findIndex((c) => c.kind === 'stat')
  if (notMove > 0) order.unshift(...order.splice(notMove, 1))
  const out: HordeChoice[] = []
  for (const choice of order) {
    if (out.length >= count) break
    const rarity = allLegendary ? 'legendary' : hordeRollRarity(luck)
    // Multi-target is offered only when its card rolls legendary; otherwise it sits this one out.
    if (choice.kind === 'multi') {
      if (rarity === 'legendary') out.push({ kind: 'multi', rarity })
    }
    else if (choice.kind === 'learn') {
      const move = pickMove(choice.from, rarity)
      // A common new move starts with no upgrade.
      if (move) out.push({ kind: 'learn', move, rarity, boosts: rarity === 'common' ? [] : hordeRollBoosts(move, rarity) })
    } else if (choice.kind === 'upgrade') {
      out.push({ ...choice, rarity, boosts: hordeRollBoosts(known[choice.slot], rarity) })
    } else out.push({ ...choice, rarity })
  }
  // Everything full and maxed out: gold instead.
  if (!out.length) out.push({ kind: 'gold', rarity: allLegendary ? 'legendary' : hordeRollRarity(luck) })
  return out
}

/**
 * What a level-up card offers - a move (learning it or upgrading it), a tome (taking it or
 * upgrading it), Multi-target or gold - so two cards offering the same can be told apart.
 * Banishing a card keeps its key, and that tome is never offered again that run - or, for a new
 * move, no move of its type is.
 */
export function hordeChoiceKey(choice: HordeChoice, known: HordeMove[]): string {
  if (choice.kind === 'learn') return `type:${choice.move.type}`
  if (choice.kind === 'upgrade') return `move:${known[choice.slot]?.id ?? choice.slot}`
  if (choice.kind === 'stat') return `stat:${choice.stat}`
  if (choice.kind === 'multi') return 'multi'
  return choice.kind
}

/** Whether a level-up card can be banished: only something new - a move to learn, a tome to take or Multi-target, never an upgrade. */
export function hordeCanBanish(choice: HordeChoice): boolean {
  return choice.kind === 'learn' || choice.kind === 'multi' || (choice.kind === 'stat' && !!choice.isNew)
}

// The level-up screen's rarity-up: gold raises every card shown one rarity (a legendary one
// stays as it is). The first costs this much, and each one bought makes the next cost this many
// times more, on top of a step: 25, 35, 47, 58, 71, 85... - counted over the whole run.
export const HORDE_RARITY_UP_COST = 25
export const HORDE_RARITY_UP_STEP = 9
export const HORDE_RARITY_UP_GROWTH = 1.04

/** What raising a level-up's rarities costs after this many have been bought this run. */
export function hordeRarityUpCost(used: number): number {
  return Math.round((HORDE_RARITY_UP_COST + HORDE_RARITY_UP_STEP * used) * Math.pow(HORDE_RARITY_UP_GROWTH, used))
}

/**
 * A level-up card one rarity up: a new move stays the same move, and it and a move upgrade roll
 * what they raise again for the new rarity (see HORDE_BOOST_COUNT); a tome or gold just reads the
 * higher rarity. A legendary card (Multi-target always is) comes back as it was.
 */
export function hordeRaiseRarity(choice: HordeChoice, known: HordeMove[]): HordeChoice {
  if (choice.rarity === 'legendary') return choice
  const rarity = HORDE_RARITIES[rarityRank(choice.rarity) + 1]
  if (choice.kind === 'learn') return { ...choice, rarity, boosts: hordeRollBoosts(choice.move, rarity) }
  if (choice.kind === 'upgrade') return known[choice.slot] ? { ...choice, rarity, boosts: hordeRollBoosts(known[choice.slot], rarity) } : choice
  return { ...choice, rarity }
}

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)]
}

/** What a run pays for how it went. */
export function hordeMoney(result: HordeResult): number {
  return (
    result.kos * HORDE_MONEY_PER_KO +
    Math.floor(result.survivedMs / 1000) * HORDE_MONEY_PER_SECOND +
    (result.won ? HORDE_WIN_MONEY : 0) +
    Math.max(0, Math.floor(result.bigNuggets || 0)) * HORDE_BIG_NUGGET_MONEY
  )
}

/** A run's time, m:ss. */
export function formatHordeTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

// Upgrades bought with Poke Dollars on the Horde page, kept between runs. Each has ranks
// bought one at a time, each rank dearer than the last: its first rank costs `cost`, and
// each one after adds `step` more. A rank adds `per` to what the upgrade raises.
export type HordeUpgradeId = 'hp' | 'exp' | 'haste' | 'spe' | 'pickup' | 'reroll' | 'luck' | 'banish'
export interface HordeUpgradeDef {
  id: HordeUpgradeId
  per: number
  max: number
  cost: number
  step: number
}
export const HORDE_UPGRADES: HordeUpgradeDef[] = [
  // Percent more max HP (the same as HP picks).
  { id: 'hp', per: 1, max: 25, cost: 2500, step: 1000 },
  // Percent more experience from every gem.
  { id: 'exp', per: 1, max: 20, cost: 4000, step: 3000 },
  // Percent off every move's cooldown (the same as Haste picks).
  { id: 'haste', per: 0.5, max: 20, cost: 4000, step: 3000 },
  // Speed points, so a quicker walk (the same as Speed picks).
  { id: 'spe', per: 1, max: 25, cost: 2500, step: 1000 },
  // Percent wider pickup range (the same as Pickup picks).
  { id: 'pickup', per: 10, max: 10, cost: 4000, step: 3000 },
  // One more level-up reroll a run.
  { id: 'reroll', per: 1, max: 9, cost: 10000, step: 10000 },
  // One point of Luck to start each run with.
  { id: 'luck', per: 1, max: 10, cost: 25000, step: 15000 },
  // One banish a run (runs start with none): a level-up card thrown out, and what it offered
  // never offered again that run.
  { id: 'banish', per: 1, max: 15, cost: 10000, step: 10000 }
]
export type HordeUpgrades = Record<HordeUpgradeId, number>

export function hordeNoUpgrades(): HordeUpgrades {
  return { hp: 0, exp: 0, haste: 0, spe: 0, pickup: 0, reroll: 0, luck: 0, banish: 0 }
}

/** What the next rank of an upgrade costs, or null once it's maxed. */
export function hordeUpgradeCost(def: HordeUpgradeDef, rank: number): number | null {
  return rank >= def.max ? null : def.cost + def.step * rank
}

/** What an upgrade adds in all at this rank (percent or points). */
export function hordeUpgradeTotal(id: HordeUpgradeId, rank: number): number {
  return (HORDE_UPGRADES.find((d) => d.id === id)?.per ?? 0) * rank
}
