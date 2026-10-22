// Horde mode's moves: every type has its own handful (no set slots), each with its own power,
// cooldown, shape, rarity and twist - the thing only that move does, on top of its type's
// effect (see HORDE_EFFECT in horde.ts). Some also have a look of their own (see HordeMoveAnim).

import type { RarityTier } from './battle-types'

// How a move goes off (see HORDE_SHAPES in horde.ts):
//  shot    - flies to the picked or nearest foe.
//  strike  - comes down on a random foe on screen a moment later.
//  melee   - a close-up hit on the picked or nearest foe if it's within reach (or nothing
//            happens), landing harder, and clipping foes right beside it for half.
//  beam    - a stream in front of the lead, hitting everything in it in a few pulses.
//  cone    - a wide burst in front of the lead, at once.
//  pierce  - a shot flying straight on, hitting every foe it passes.
//  blast   - a shot that explodes on its target, hitting everyone close by.
//  scatter - a few small shots, each at a different foe, the nearest first.
//  rain    - a run of strikes on random foes on screen.
//  nova    - a wave rolling out round the lead, hitting everyone in the spread ring.
//  orbit   - balls circling the lead for a while, hitting whatever they touch.
export type HordeMoveShape = 'shot' | 'strike' | 'melee' | 'beam' | 'cone' | 'pierce' | 'blast' | 'scatter' | 'rain' | 'nova' | 'orbit'

// How hard a move is, roughly: which wild Pokemon use it (wild ones weak moves, elites weak and
// medium, bosses medium and strong), and how big its shots look.
export type HordeMoveBand = 'weak' | 'medium' | 'strong'
export const HORDE_MOVE_BANDS: HordeMoveBand[] = ['weak', 'medium', 'strong']

// The lead's stats a move can raise or lower for a while (and a foe's, for foeDrop).
export type HordeLeadStat = 'atk' | 'def' | 'spe'

// A move's own look, where its shape's usual one doesn't fit:
//  sky       - a lightning bolt from the top of the screen.
//  ground    - a crack at the foe's feet, then a burst up out of the ground.
//  spikes    - the same, as stone spikes.
//  shadow    - the same, as a shadow reaching up.
//  meteor    - a big flaming rock falling at an angle, shaking the ground where it lands.
//  iceMeteor - the same, as a block of ice.
//  rockfall  - the same, as plain rocks.
//  vortex    - a swirl round the foe.
//  orb, star, leaf, coin, needle, bubble, rock - what its shots look like.
//  stealthRock, caltrop - orbiting balls drawn as the battle screen's Stealth Rock pieces or Spikes' caltrops.
//  steam     - orbiting balls drawn as puffs of pink steam.
//  slash, fist, kick, bite, horn, cross, slam - the mark a melee hit leaves on the foe.
export type HordeMoveAnim =
  | 'sky'
  | 'ground'
  | 'spikes'
  | 'shadow'
  | 'meteor'
  | 'iceMeteor'
  | 'rockfall'
  | 'vortex'
  | 'orb'
  | 'star'
  | 'leaf'
  | 'coin'
  | 'needle'
  | 'bubble'
  | 'rock'
  | 'stealthRock'
  | 'caltrop'
  | 'steam'
  | 'slash'
  | 'fist'
  | 'kick'
  | 'bite'
  | 'horn'
  | 'cross'
  | 'slam'

// A move's twist. Percents are whole numbers (25 is 25%), shares fractions (0.25), times in ms,
// distances in arena units. Chances are percent a hit.
export type HordeTrait =
  // More power the longer the lead has kept walking (in full after HORDE_MOMENTUM_MS).
  | { kind: 'momentum'; max: number }
  // A melee move that darts the lead at a foe up to this much further off than its reach - it can't be hit mid-dash.
  | { kind: 'dash'; reach: number }
  // The lead vanishes (can't be hit) for a moment, then comes up under a foe up to this far off and hits it.
  | { kind: 'burrow'; ms: number; reach: number }
  // A shot that hops on to the next foe nearby, this many times, each hop for this share.
  | { kind: 'bounce'; jumps: number; share: number }
  // Each shot (and each bounce) has this chance to paralyse, freeze or burn the foe, one at random.
  | { kind: 'triAttack'; chance: number }
  // Shots that fly on past their target, then turn and fly back to the lead, hitting every foe they pass each way.
  // A scatter shot only does so from the last foe it bounces to (see HORDE_SCATTER_BOUNCE_SHARE).
  | { kind: 'boomerang'; share: number }
  // A shot that splits into smaller ones on landing, once the move has this many upgrades.
  | { kind: 'split'; upgrades: number; shots: number; share: number }
  // Each shot hits this many times (between the two, at random).
  | { kind: 'multiHit'; min: number; max: number }
  // Every nth use fires this many more shots.
  | { kind: 'everyNth'; n: number; extra: number }
  // A piercing shot growing this much stronger (percent) with each foe it passes.
  | { kind: 'pierceGrow'; per: number }
  // A blast this much bigger (percent).
  | { kind: 'bigBlast'; bonus: number }
  // The blast bursts into this many small streams pouring out from it in a star (this many times
  // as long as the blast's reach), each running for this share of a stream's usual run.
  | { kind: 'starStreams'; count: number; length: number; part: number }
  // A wave rolling this much further out (percent) than the spread ring.
  | { kind: 'wideRing'; bonus: number }
  // A melee hit, cone or stream reaching this much further (percent).
  | { kind: 'reach'; bonus: number }
  // A melee hit that also hits this many more foes in reach at full damage.
  | { kind: 'cleave'; extra: number }
  // After it's used, the lead's other moves come round this much slower (percent) for ms.
  | { kind: 'exhaust'; slow: number; ms: number }
  // Its cooldown is this much shorter for each move of this type the lead knows.
  | { kind: 'typeCut'; type: string; ms: number }
  // It goes off again once for each other move of this type the lead knows, up to this many more times.
  | { kind: 'echo'; type: string; max: number }
  // This much more power (percent) for each other move of this type the lead knows, up to the most.
  | { kind: 'typeBoost'; type: string; per: number; max: number }
  // A foe knocked out by it drops this much gold.
  | { kind: 'gold'; amount: number }
  // Hit foes are knocked back this far (elites half as far, bosses not at all).
  | { kind: 'knockback'; distance: number }
  // Foes within this of the one hit are dragged in to it (not bosses).
  | { kind: 'pull'; reach: number }
  // Foes this close to the one hit take this share of the damage too (with an explosion to show it, if boom).
  | { kind: 'splash'; reach: number; share: number; boom?: boolean }
  // The foe is thrown this far, and those it's thrown near (this close) take this share of the damage.
  | { kind: 'hurl'; distance: number; share: number; reach: number }
  // The lead takes this share of the damage it deals (never fainting from it).
  | { kind: 'recoil'; share: number }
  // The lead loses this percent of its max HP each use (never fainting from it).
  | { kind: 'selfHurt'; percent: number }
  // The lead heals this share of the damage it deals.
  | { kind: 'drain'; share: number }
  // The lead heals this share of its max HP for each foe it knocks out.
  | { kind: 'koHeal'; share: number }
  // Each foe it knocks out adds this much power (percent) for the rest of the run, up to the most.
  | { kind: 'koStack'; per: number; max: number }
  // It charges up this long before going off (its power is set for that).
  | { kind: 'charge'; ms: number }
  // Once used it goes off by itself every everyMs for ms, then the lead's moves come round this much slower for fatigueMs.
  | { kind: 'rampage'; ms: number; everyMs: number; fatigueMs: number; fatigue: number }
  // The lead's stat drops by this percent for a while after using it.
  | { kind: 'selfDrop'; stat: HordeLeadStat; percent: number; ms: number }
  // The lead is burned after using it - losing this percent of its max HP every second for ms - unless
  // it knows a move of one of HORDE_SELF_BURN_SAFE's types.
  | { kind: 'selfBurn'; percent: number; ms: number }
  // A chance (percent) to raise the lead's stats by this percent for a while.
  | { kind: 'selfBoost'; stats: HordeLeadStat[]; percent: number; ms: number; chance: number }
  // The foe's stat drops by this percent for a while.
  | { kind: 'foeDrop'; stat: HordeLeadStat; percent: number; ms: number }
  // More power (up to this percent) by how much faster the lead walks than the slowest pace,
  // how close to it it walks, its HP left (or lost), its tomes (per rank held) or having been
  // hit in the last few seconds.
  | { kind: 'scaleWith'; source: 'speed' | 'slowness' | 'hp' | 'lowHp' | 'tomes' | 'hurt'; amount: number }
  // Each use soon after the last adds this much power (percent), up to the most.
  | { kind: 'escalate'; per: number; max: number }
  | { kind: 'critUp'; chance: number }
  | { kind: 'alwaysCrit' }
  // Hits with the lead's Defense in place of its Attack.
  | { kind: 'bodyPress' }
  // More damage (percent) to elites and bosses.
  | { kind: 'vsBig'; bonus: number }
  // More damage (percent) to a foe with an effect on it (of this type's, if given).
  | { kind: 'vsStatus'; bonus: number; type?: string }
  // Super effective on this type, whatever the type chart says.
  | { kind: 'superVs'; type: string }
  // More damage (percent) to a foe still at full HP.
  | { kind: 'firstStrike'; bonus: number }
  // More damage (percent) to a foe far off or fleeing.
  | { kind: 'far'; bonus: number }
  // More damage (percent) to a foe about to attack.
  | { kind: 'counter'; bonus: number }
  // Ignores this share of the foe's Defense.
  | { kind: 'armorPierce'; share: number }
  // A chance to make the foe flinch: its attacks start over (only a slowed or frozen foe, if slowed).
  | { kind: 'flinch'; chance: number; slowed?: boolean }
  // A chance to paralyse the foe: stopped this long, then slowed.
  | { kind: 'paralyze'; chance: number; ms: number }
  // A chance (each hit, a stream's every pulse too) to freeze the foe solid this long.
  | { kind: 'freeze'; chance: number; ms: number }
  // A chance to confuse the foe (only one at full HP, if fullHp).
  | { kind: 'confuse'; chance: number; ms: number; fullHp?: boolean }
  // Its hits are this many times as likely to set off this type's effect.
  | { kind: 'effectBoost'; type: string; times: number }
  // A chance a hit leaves an entry hazard where the foe stood: Spikes (hurting foes on them every second,
  // as Stealth Rock's rocks do) or Toxic Spikes (a little hurt, and poisoning a foe stepping on them).
  | { kind: 'hazard'; hazard: 'spikes' | 'toxicSpikes'; chance: number }
  // A chance to set off this type's effect (even without a move of the type).
  | { kind: 'inflict'; type: string; chance: number }
  // The hit always jumps on to this many more foes nearby, each for this share.
  | { kind: 'chain'; jumps: number; share: number }
  // Leaves ground behind that hurts foes on it every second (this share of the hit) - and may slow them,
  // pull them in, or wander about.
  | { kind: 'zone'; ms: number; reach: number; share: number; slow?: number; pull?: number; drift?: boolean }
  // The foe is held in place this long, hurt every second for this share of the hit.
  | { kind: 'trap'; ms: number; share: number }
  // This many more strikes come down on random foes over the next ms, each for this share.
  | { kind: 'storm'; count: number; share: number; ms: number }
  // A second, wider wave (times the ring) rolls out this long after, for this share.
  | { kind: 'aftershock'; delayMs: number; reach: number; share: number }
  // The strike lands this much later.
  | { kind: 'delayed'; ms: number }

export interface HordeMoveDef {
  name: string
  type: string
  power: number
  cooldownMs: number
  shape: HordeMoveShape
  band: HordeMoveBand
  // The lowest level-up rarity that can offer it.
  rarity: RarityTier
  // The move a lead of this type starts with (one a type).
  starter?: boolean
  trait: HordeTrait
  anim?: HordeMoveAnim
  // Its upgrades raise its crit damage instead of adding strikes.
  critBoost?: boolean
  // Its upgrades widen the ground it leaves instead of adding strikes.
  areaBoost?: boolean
  // A melee move whose upgrades add hits on its foe instead of reach.
  hitBoost?: boolean
  // How many shots a scatter move fires before upgrades (HORDE_SHAPES.scatterShots if not set).
  shots?: number
}

// Momentum's power is in full after walking this long without stopping.
export const HORDE_MOMENTUM_MS = 2000
// Escalate's stack is lost once the move goes this long unused.
export const HORDE_ESCALATE_RESET_MS = 3500
// scaleWith 'hurt': having been hit within this long.
export const HORDE_HURT_RECENT_MS = 3000
// How long a dash takes, and how long the lead can't be hit from its start.
export const HORDE_DASH_MS = 140
export const HORDE_DASH_SAFE_MS = 260
// Recoil never takes more than this share of the lead's max HP a hit.
export const HORDE_RECOIL_CAP = 0.06
// Knowing a move of one of these types keeps the lead from burning itself (see selfBurn).
export const HORDE_SELF_BURN_SAFE = ['Water', 'Ice']
// Paralysis's slow once it can move again.
export const HORDE_PARALYSIS_SLOW = 0.3
export const HORDE_PARALYSIS_SLOW_MS = 2500
// Tri Attack's paralysis: how long it stops the foe (then slowed, as any paralysis).
export const HORDE_TRI_PARALYSIS_MS = 1500
// How long a flinch stops a foe on top of starting its attacks over.
export const HORDE_FLINCH_STOP_MS = 250
// A lead stat can't drop below this share, or rise past this many times, from moves.
export const HORDE_LEAD_MOD_MIN = -0.6
export const HORDE_LEAD_MOD_MAX = 1
// The most zones on the ground at once (the oldest go first).
export const HORDE_MAX_ZONES = 16
// How far a boomerang flies on past its target before it turns back.
export const HORDE_BOOMERANG_OUT = 170
// A scatter move's upgrades add bounces rather than shots: each shot hops on to one more foe
// nearby per upgrade, every hop for this share of the first shot's damage (a bounce move's own share, if more).
export const HORDE_SCATTER_BOUNCE_SHARE = 0.5
// How far a bounce or split looks for its next foe.
export const HORDE_HOP_REACH = 260
// Orbit: how many balls before upgrades, how far out they circle, how long they last, how fast
// they go round (turns a second), how big they are, and how often each foe can be hit by them.
export const HORDE_ORBIT = { balls: 3, radius: 95, ms: 3000, turns: 0.9, size: 26, hitEveryMs: 450 }
// A wandering zone's pace.
export const HORDE_ZONE_DRIFT = 70
// Meteors and rockfalls take this long to come down (instead of a strike's usual moment).
export const HORDE_METEOR_FALL_MS = 550
// An echoing wave's repeats roll out this long apart.
export const HORDE_ECHO_MS = 400

type Def = Omit<HordeMoveDef, 'type'>
const m = (
  name: string,
  shape: HordeMoveShape,
  band: HordeMoveBand,
  power: number,
  cooldownMs: number,
  rarity: RarityTier,
  trait: HordeTrait,
  extra: Partial<Pick<HordeMoveDef, 'anim' | 'starter' | 'critBoost' | 'areaBoost' | 'hitBoost' | 'shots'>> = {}
): Def => ({ name, shape, band, power, cooldownMs, rarity, trait, ...extra })

// Each type's moves, its starter first.
const BY_TYPE: Record<string, Def[]> = {
  Normal: [
    m('Tackle', 'melee', 'weak', 40, 2700, 'common', { kind: 'momentum', max: 50 }, { starter: true, anim: 'slam' }),
    m('Quick Attack', 'melee', 'weak', 35, 2100, 'common', { kind: 'dash', reach: 140 }, { anim: 'slam' }),
    m('Swift', 'scatter', 'weak', 30, 4500, 'common', { kind: 'bounce', jumps: 1, share: 0.6 }, { anim: 'star' }),
    m('Pay Day', 'scatter', 'weak', 30, 4800, 'uncommon', { kind: 'gold', amount: 2 }, { anim: 'coin' }),
    m('Tri Attack', 'scatter', 'medium', 40, 6000, 'uncommon', { kind: 'triAttack', chance: 20 }, { anim: 'orb' }),
    m('Hyper Voice', 'cone', 'medium', 45, 6300, 'uncommon', { kind: 'knockback', distance: 70 }),
    m('Double-Edge', 'melee', 'strong', 120, 9000, 'rare', { kind: 'recoil', share: 0.25 }, { anim: 'slam' }),
    m('Hyper Beam', 'beam', 'strong', 150, 18000, 'epic', { kind: 'exhaust', slow: 50, ms: 4000 })
  ],
  Fire: [
    m('Ember', 'shot', 'weak', 40, 2700, 'common', { kind: 'everyNth', n: 3, extra: 2 }, { starter: true }),
    m('Flame Wheel', 'orbit', 'medium', 30, 7500, 'uncommon', { kind: 'knockback', distance: 35 }),
    m('Fire Spin', 'strike', 'medium', 50, 5400, 'uncommon', { kind: 'trap', ms: 2500, share: 0.15 }, { anim: 'vortex' }),
    m('Flamethrower', 'beam', 'medium', 50, 6000, 'uncommon', { kind: 'zone', ms: 2500, reach: 45, share: 0.12 }),
    m('Heat Wave', 'cone', 'medium', 45, 7800, 'uncommon', { kind: 'inflict', type: 'Fire', chance: 30 }),
    m('Fire Blast', 'blast', 'strong', 75, 9300, 'rare', { kind: 'starStreams', count: 5, length: 0.75, part: 1 / 3 }),
    m('Overheat', 'nova', 'strong', 105, 18000, 'epic', { kind: 'selfBurn', percent: 2, ms: 5000 })
  ],
  Water: [
    m('Water Gun', 'shot', 'weak', 40, 2700, 'common', { kind: 'split', upgrades: 4, shots: 2, share: 0.5 }, { starter: true }),
    m('Bubble', 'scatter', 'weak', 30, 4500, 'common', { kind: 'foeDrop', stat: 'spe', percent: 25, ms: 3000 }, { anim: 'bubble' }),
    m('Aqua Jet', 'melee', 'weak', 35, 2250, 'common', { kind: 'dash', reach: 150 }, { anim: 'slam' }),
    m('Water Pulse', 'blast', 'medium', 45, 5700, 'uncommon', { kind: 'confuse', chance: 25, ms: 2000 }),
    m('Scald', 'shot', 'medium', 65, 5100, 'uncommon', { kind: 'inflict', type: 'Fire', chance: 30 }),
    m('Whirlpool', 'strike', 'medium', 55, 6300, 'uncommon', { kind: 'zone', ms: 3000, reach: 70, share: 0.15, slow: 0.35 }, { anim: 'vortex', areaBoost: true }),
    m('Surf', 'nova', 'medium', 50, 7800, 'uncommon', { kind: 'wideRing', bonus: 25 }),
    m('Hydro Pump', 'beam', 'strong', 70, 9750, 'rare', { kind: 'knockback', distance: 100 })
  ],
  Grass: [
    m('Vine Whip', 'melee', 'weak', 40, 2700, 'common', { kind: 'reach', bonus: 60 }, { starter: true, anim: 'slash' }),
    m('Razor Leaf', 'scatter', 'weak', 30, 4500, 'common', { kind: 'boomerang', share: 0.6 }, { anim: 'leaf' }),
    m('Bullet Seed', 'shot', 'weak', 15, 3300, 'common', { kind: 'multiHit', min: 2, max: 5 }),
    m('Giga Drain', 'strike', 'medium', 65, 5400, 'uncommon', { kind: 'drain', share: 0.25 }),
    m('Energy Ball', 'shot', 'medium', 70, 5400, 'uncommon', { kind: 'foeDrop', stat: 'def', percent: 20, ms: 4000 }, { anim: 'orb' }),
    m('Petal Blizzard', 'nova', 'medium', 45, 7800, 'uncommon', { kind: 'zone', ms: 2500, reach: 110, share: 0.1 }),
    m('Solar Beam', 'beam', 'strong', 120, 11250, 'epic', { kind: 'typeCut', type: 'Fire', ms: 2000 })
  ],
  Electric: [
    m('Thunder Shock', 'shot', 'weak', 40, 2700, 'common', { kind: 'paralyze', chance: 15, ms: 700 }, { starter: true }),
    m('Spark', 'melee', 'weak', 45, 3000, 'common', { kind: 'dash', reach: 130 }, { anim: 'slam' }),
    m('Electroweb', 'cone', 'weak', 30, 4800, 'common', { kind: 'foeDrop', stat: 'spe', percent: 35, ms: 3000 }),
    m('Electro Ball', 'shot', 'medium', 60, 5100, 'uncommon', { kind: 'scaleWith', source: 'speed', amount: 100 }, { anim: 'orb' }),
    m('Thunderbolt', 'strike', 'medium', 70, 5400, 'uncommon', { kind: 'chain', jumps: 2, share: 0.5 }, { anim: 'sky' }),
    m('Discharge', 'nova', 'medium', 45, 7800, 'uncommon', { kind: 'zone', ms: 2000, reach: 120, share: 0.1, slow: 0.25 }),
    m('Volt Tackle', 'melee', 'strong', 120, 9000, 'rare', { kind: 'recoil', share: 0.2 }, { anim: 'slam' }),
    m('Thunder', 'strike', 'strong', 110, 9750, 'epic', { kind: 'storm', count: 2, share: 0.5, ms: 600 }, { anim: 'sky', critBoost: true })
  ],
  Ice: [
    m('Ice Shard', 'shot', 'weak', 40, 2250, 'common', { kind: 'firstStrike', bonus: 40 }, { starter: true }),
    m('Powder Snow', 'cone', 'weak', 30, 4800, 'common', { kind: 'inflict', type: 'Ice', chance: 40 }),
    m('Icicle Spear', 'shot', 'weak', 15, 3600, 'common', { kind: 'multiHit', min: 2, max: 5 }, { anim: 'needle' }),
    m('Freeze-Dry', 'shot', 'medium', 70, 5400, 'uncommon', { kind: 'superVs', type: 'Water' }),
    m('Ice Beam', 'beam', 'medium', 50, 6000, 'uncommon', { kind: 'freeze', chance: 20, ms: 2000 }),
    m('Avalanche', 'nova', 'medium', 45, 7500, 'uncommon', { kind: 'scaleWith', source: 'hurt', amount: 100 }),
    m('Icicle Crash', 'strike', 'strong', 85, 8700, 'rare', { kind: 'flinch', chance: 30 }, { anim: 'iceMeteor' }),
    m('Blizzard', 'nova', 'strong', 60, 9750, 'epic', { kind: 'zone', ms: 3000, reach: 140, share: 0.1, slow: 0.3 })
  ],
  Fighting: [
    m('Rock Smash', 'melee', 'weak', 40, 2700, 'common', { kind: 'inflict', type: 'Fighting', chance: 50 }, { starter: true, anim: 'fist' }),
    m('Mach Punch', 'melee', 'weak', 35, 1950, 'common', { kind: 'firstStrike', bonus: 50 }, { anim: 'fist' }),
    m('Low Sweep', 'cone', 'weak', 30, 4800, 'common', { kind: 'foeDrop', stat: 'spe', percent: 30, ms: 3000 }),
    m('Drain Punch', 'melee', 'medium', 70, 5400, 'uncommon', { kind: 'drain', share: 0.3 }, { anim: 'fist' }),
    m('Brick Break', 'melee', 'medium', 75, 5400, 'uncommon', { kind: 'vsBig', bonus: 50 }, { anim: 'kick' }),
    m('Body Press', 'melee', 'medium', 80, 5700, 'uncommon', { kind: 'bodyPress' }, { anim: 'slam' }),
    m('Aura Sphere', 'pierce', 'medium', 55, 6300, 'uncommon', { kind: 'knockback', distance: 50 }, { anim: 'orb' }),
    m('Close Combat', 'melee', 'strong', 130, 9300, 'epic', { kind: 'selfDrop', stat: 'def', percent: 25, ms: 4000 }, { anim: 'fist' })
  ],
  Poison: [
    m('Poison Sting', 'shot', 'weak', 35, 2400, 'common', { kind: 'inflict', type: 'Poison', chance: 30 }, { starter: true, anim: 'needle' }),
    m('Acid', 'cone', 'weak', 30, 4800, 'common', { kind: 'foeDrop', stat: 'def', percent: 20, ms: 4000 }),
    m('Poison Jab', 'melee', 'medium', 70, 4800, 'uncommon', { kind: 'critUp', chance: 15 }, { anim: 'fist' }),
    m('Venoshock', 'shot', 'medium', 60, 5100, 'uncommon', { kind: 'vsStatus', bonus: 100, type: 'Poison' }),
    m('Sludge Bomb', 'blast', 'medium', 55, 6300, 'uncommon', { kind: 'inflict', type: 'Poison', chance: 25 }),
    m('Mortal Spin', 'orbit', 'weak', 25, 6600, 'uncommon', { kind: 'hazard', hazard: 'toxicSpikes', chance: 50 }),
    m('Sludge Wave', 'nova', 'medium', 50, 7800, 'uncommon', { kind: 'inflict', type: 'Poison', chance: 25 }),
    m('Gunk Shot', 'pierce', 'strong', 75, 9300, 'rare', { kind: 'zone', ms: 3000, reach: 45, share: 0.12 })
  ],
  Ground: [
    m('Mud-Slap', 'cone', 'weak', 25, 4200, 'common', { kind: 'foeDrop', stat: 'atk', percent: 20, ms: 4000 }, { starter: true }),
    m('Spikes', 'orbit', 'medium', 25, 7200, 'uncommon', { kind: 'hazard', hazard: 'spikes', chance: 50 }, { anim: 'caltrop' }),
    m('Mud Shot', 'shot', 'weak', 45, 3300, 'common', { kind: 'foeDrop', stat: 'spe', percent: 30, ms: 3000 }),
    m('Bulldoze', 'nova', 'weak', 30, 5400, 'common', { kind: 'foeDrop', stat: 'spe', percent: 40, ms: 2500 }),
    m('High Horsepower', 'melee', 'medium', 80, 6300, 'uncommon', { kind: 'knockback', distance: 90 }, { anim: 'kick' }),
    m('Drill Run', 'pierce', 'medium', 55, 6000, 'uncommon', { kind: 'critUp', chance: 20 }),
    m('Earth Power', 'strike', 'medium', 75, 5700, 'uncommon', { kind: 'splash', reach: 70, share: 0.5 }, { anim: 'ground' }),
    m('Earthquake', 'nova', 'strong', 60, 9750, 'rare', { kind: 'aftershock', delayMs: 450, reach: 1.4, share: 0.6 })
  ],
  Flying: [
    m('Peck', 'melee', 'weak', 50, 2550, 'common', { kind: 'critUp', chance: 25 }, { starter: true, anim: 'horn' }),
    m('Gust', 'strike', 'weak', 40, 3300, 'common', { kind: 'knockback', distance: 60 }, { anim: 'vortex' }),
    m('Aerial Ace', 'melee', 'weak', 45, 3000, 'common', { kind: 'scaleWith', source: 'speed', amount: 100 }, { anim: 'slash' }),
    m('Air Cutter', 'cone', 'medium', 45, 5700, 'uncommon', { kind: 'reach', bonus: 40 }),
    m('Air Slash', 'pierce', 'medium', 55, 6000, 'uncommon', { kind: 'flinch', chance: 25 }),
    m('Brave Bird', 'melee', 'strong', 120, 9000, 'rare', { kind: 'recoil', share: 0.3 }, { anim: 'slam' }),
    m('Hurricane', 'strike', 'strong', 90, 10500, 'epic', { kind: 'zone', ms: 3500, reach: 80, share: 0.2, slow: 0.3, drift: true }, { anim: 'vortex' })
  ],
  Psychic: [
    m('Confusion', 'strike', 'weak', 40, 3000, 'common', { kind: 'confuse', chance: 20, ms: 1500 }, { starter: true }),
    m('Psybeam', 'beam', 'medium', 45, 6000, 'uncommon', { kind: 'confuse', chance: 30, ms: 2000 }),
    m('Zen Headbutt', 'melee', 'medium', 80, 5700, 'uncommon', { kind: 'flinch', chance: 25 }, { anim: 'slam' }),
    m('Psyshock', 'shot', 'medium', 70, 5400, 'uncommon', { kind: 'confuse', chance: 100, ms: 2000, fullHp: true }, { anim: 'orb' }),
    m('Stored Power', 'shot', 'medium', 40, 4800, 'rare', { kind: 'scaleWith', source: 'tomes', amount: 10 }, { anim: 'orb' }),
    m('Expanding Force', 'nova', 'medium', 45, 7800, 'uncommon', { kind: 'echo', type: 'Psychic', max: 3 }),
    m('Psychic', 'strike', 'strong', 90, 8700, 'rare', { kind: 'hurl', distance: 120, share: 0.4, reach: 70 }),
    m('Future Sight', 'strike', 'strong', 140, 10500, 'epic', { kind: 'delayed', ms: 1800 })
  ],
  Bug: [
    m('Bug Bite', 'melee', 'weak', 40, 2700, 'common', { kind: 'koHeal', share: 0.03 }, { starter: true, anim: 'bite' }),
    m('Fury Cutter', 'melee', 'weak', 30, 2400, 'common', { kind: 'escalate', per: 25, max: 150 }, { anim: 'slash' }),
    m('Struggle Bug', 'cone', 'weak', 30, 4800, 'common', { kind: 'foeDrop', stat: 'atk', percent: 25, ms: 3000 }),
    m('Pin Missile', 'scatter', 'weak', 15, 4500, 'common', { kind: 'multiHit', min: 2, max: 4 }, { anim: 'needle' }),
    m('Fell Stinger', 'melee', 'medium', 50, 4800, 'uncommon', { kind: 'koStack', per: 3, max: 90 }, { anim: 'horn' }),
    m('X-Scissor', 'melee', 'medium', 75, 5400, 'uncommon', { kind: 'cleave', extra: 1 }, { anim: 'cross' }),
    m('Bug Buzz', 'nova', 'medium', 50, 7800, 'uncommon', { kind: 'foeDrop', stat: 'def', percent: 20, ms: 3000 }),
    m('Megahorn', 'melee', 'strong', 120, 9300, 'rare', { kind: 'knockback', distance: 110 }, { anim: 'horn' })
  ],
  Rock: [
    m('Rock Throw', 'shot', 'weak', 45, 3000, 'common', { kind: 'split', upgrades: 0, shots: 2, share: 0.35 }, { starter: true, anim: 'rock' }),
    m('Rollout', 'melee', 'weak', 30, 2250, 'common', { kind: 'escalate', per: 30, max: 150 }, { anim: 'slam' }),
    m('Rock Slide', 'rain', 'medium', 40, 6300, 'uncommon', { kind: 'flinch', chance: 20 }, { anim: 'rockfall' }),
    m('Ancient Power', 'scatter', 'medium', 30, 5400, 'uncommon', { kind: 'selfBoost', stats: ['atk', 'def', 'spe'], percent: 15, ms: 5000, chance: 20 }, { anim: 'rock', shots: 5 }),
    m('Power Gem', 'pierce', 'medium', 55, 6000, 'uncommon', { kind: 'pierceGrow', per: 15 }),
    m('Stealth Rock', 'orbit', 'medium', 25, 7200, 'uncommon', { kind: 'effectBoost', type: 'Rock', times: 2 }, { anim: 'stealthRock' }),
    m('Stone Edge', 'strike', 'strong', 100, 8700, 'rare', { kind: 'critUp', chance: 25 }, { anim: 'spikes', critBoost: true }),
    m('Head Smash', 'melee', 'strong', 150, 10500, 'epic', { kind: 'recoil', share: 0.4 }, { anim: 'slam' })
  ],
  Ghost: [
    m('Astonish', 'melee', 'weak', 35, 2550, 'common', { kind: 'flinch', chance: 30 }, { starter: true, anim: 'slash' }),
    m('Shadow Sneak', 'strike', 'weak', 40, 2400, 'common', { kind: 'firstStrike', bonus: 40 }, { anim: 'shadow' }),
    m('Shadow Claw', 'melee', 'medium', 70, 4800, 'uncommon', { kind: 'critUp', chance: 25 }, { anim: 'slash' }),
    m('Hex', 'nova', 'medium', 45, 7200, 'uncommon', { kind: 'vsStatus', bonus: 100 }),
    m('Shadow Ball', 'shot', 'medium', 75, 5700, 'uncommon', { kind: 'foeDrop', stat: 'def', percent: 20, ms: 4000 }, { anim: 'orb' }),
    m('Poltergeist', 'strike', 'strong', 100, 9000, 'rare', { kind: 'vsBig', bonus: 60 }, { anim: 'shadow' }),
    m('Phantom Force', 'melee', 'strong', 100, 18000, 'rare', { kind: 'typeBoost', type: 'Ghost', per: 20, max: 80 }, { anim: 'slash' })
  ],
  Dragon: [
    m('Dragon Breath', 'cone', 'weak', 30, 4500, 'common', { kind: 'paralyze', chance: 25, ms: 800 }, { starter: true }),
    m('Twister', 'strike', 'weak', 45, 3900, 'common', { kind: 'flinch', chance: 20 }, { anim: 'vortex' }),
    m('Dragon Claw', 'melee', 'medium', 75, 5100, 'uncommon', { kind: 'critUp', chance: 15 }, { anim: 'slash' }),
    m('Dragon Pulse', 'blast', 'medium', 60, 6300, 'uncommon', { kind: 'bigBlast', bonus: 40 }),
    m('Dragon Rush', 'melee', 'strong', 100, 8250, 'rare', { kind: 'dash', reach: 220 }, { anim: 'slam' }),
    m('Dragon Energy', 'beam', 'strong', 90, 9750, 'rare', { kind: 'scaleWith', source: 'hp', amount: 40 }),
    m('Outrage', 'melee', 'strong', 90, 18000, 'epic', { kind: 'scaleWith', source: 'lowHp', amount: 40 }, { anim: 'slash' }),
    m('Draco Meteor', 'rain', 'strong', 60, 18000, 'epic', { kind: 'splash', reach: 80, share: 0.35, boom: true }, { anim: 'meteor' })
  ],
  Dark: [
    m('Bite', 'melee', 'weak', 45, 2700, 'common', { kind: 'flinch', chance: 20 }, { starter: true, anim: 'bite' }),
    m('Ceaseless Edge', 'melee', 'medium', 60, 4800, 'rare', { kind: 'hazard', hazard: 'spikes', chance: 60 }, { anim: 'slash' }),
    m('Sucker Punch', 'melee', 'weak', 50, 3000, 'common', { kind: 'flinch', chance: 100, slowed: true }, { anim: 'fist' }),
    m('Snarl', 'cone', 'weak', 30, 4800, 'common', { kind: 'foeDrop', stat: 'atk', percent: 25, ms: 3000 }),
    m('Pursuit', 'shot', 'weak', 40, 3000, 'common', { kind: 'far', bonus: 60 }),
    m('Crunch', 'melee', 'medium', 80, 5400, 'uncommon', { kind: 'foeDrop', stat: 'def', percent: 25, ms: 4000 }, { anim: 'bite' }),
    m('Knock Off', 'melee', 'medium', 65, 5400, 'uncommon', { kind: 'vsBig', bonus: 50 }, { anim: 'slash' }),
    m('Fiery Wrath', 'nova', 'strong', 55, 8250, 'rare', { kind: 'flinch', chance: 20 }),
    m('Wicked Blow', 'melee', 'strong', 90, 9300, 'epic', { kind: 'alwaysCrit' }, { anim: 'fist' })
  ],
  Steel: [
    m('Metal Claw', 'melee', 'weak', 45, 2700, 'common', { kind: 'selfBoost', stats: ['atk'], percent: 10, ms: 4000, chance: 25 }, { starter: true, anim: 'slash' }),
    m('Bullet Punch', 'melee', 'weak', 35, 1950, 'common', { kind: 'dash', reach: 110 }, { anim: 'fist' }),
    m('Mirror Shot', 'shot', 'weak', 40, 3000, 'common', { kind: 'bounce', jumps: 2, share: 0.7 }),
    m('Gyro Ball', 'melee', 'medium', 70, 5400, 'uncommon', { kind: 'scaleWith', source: 'slowness', amount: 150 }, { anim: 'slam' }),
    m('Flash Cannon', 'pierce', 'medium', 60, 6300, 'uncommon', { kind: 'foeDrop', stat: 'def', percent: 25, ms: 5000 }),
    m('Iron Head', 'melee', 'strong', 90, 7800, 'rare', { kind: 'flinch', chance: 30 }, { anim: 'slam' }),
    m('Steel Beam', 'beam', 'strong', 200, 18000, 'epic', { kind: 'selfHurt', percent: 20 }),
    m('Make It Rain', 'rain', 'strong', 55, 9750, 'epic', { kind: 'gold', amount: 3 }, { anim: 'coin' })
  ],
  Fairy: [
    m('Fairy Wind', 'cone', 'weak', 30, 4500, 'common', { kind: 'knockback', distance: 40 }, { starter: true }),
    m('Disarming Voice', 'nova', 'weak', 30, 5400, 'common', { kind: 'inflict', type: 'Fairy', chance: 40 }),
    m('Draining Kiss', 'melee', 'medium', 60, 4500, 'uncommon', { kind: 'drain', share: 0.5 }, { anim: 'slam' }),
    m('Play Rough', 'melee', 'medium', 85, 5700, 'uncommon', { kind: 'foeDrop', stat: 'atk', percent: 25, ms: 4000 }, { anim: 'slam' }),
    m('Dazzling Gleam', 'nova', 'medium', 50, 7500, 'uncommon', { kind: 'wideRing', bonus: 20 }),
    m('Moonblast', 'blast', 'strong', 75, 9000, 'rare', { kind: 'foeDrop', stat: 'atk', percent: 30, ms: 5000 }),
    m('Strange Steam', 'orbit', 'medium', 30, 7200, 'rare', { kind: 'confuse', chance: 20, ms: 2000 }, { anim: 'steam' }),
    m('Light of Ruin', 'beam', 'strong', 120, 18000, 'epic', { kind: 'recoil', share: 0.15 })
  ]
}

/** A move's id: its name in lower case, letters and digits only ("Thunderbolt" is "thunderbolt"). */
export function hordeMoveIdOf(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** Every move, type by type, each type's starter first. */
export const HORDE_MOVE_DEFS: HordeMoveDef[] = Object.entries(BY_TYPE).flatMap(([type, defs]) => defs.map((d) => ({ ...d, type })))

const DEFS_BY_ID = new Map(HORDE_MOVE_DEFS.map((d) => [hordeMoveIdOf(d.name), d]))
// Moves since swapped for another (a run saved with Dig has High Horsepower).
const RENAMED: Record<string, string> = { dig: 'highhorsepower' }

/** A move by its id or name (undefined for one that isn't in the list). */
export function hordeFindMoveDef(idOrName: string): HordeMoveDef | undefined {
  const id = hordeMoveIdOf(idOrName)
  return DEFS_BY_ID.get(RENAMED[id] ?? id)
}

/** The types with moves, in the list's order. */
export const HORDE_MOVE_TYPES: string[] = Object.keys(BY_TYPE)
