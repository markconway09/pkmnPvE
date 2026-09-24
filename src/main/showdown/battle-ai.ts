import type { Streams } from 'pokemon-showdown'
import type { ChoiceRequest, PokemonMoveRequestData, PokemonSwitchRequestData } from 'pokemon-showdown/dist/sim/side.js'
import {
  ABILITY_FLAG_IMMUNITIES,
  ABILITY_TYPE_IMMUNITIES,
  BattlePlayer,
  getMoveCombatData,
  getMoveInfo,
  moveDoesNothing,
  type MoveCombatData,
  type MoveParty,
  getTypeEffectivenessMultiplier,
  parseCondition,
  speciesAbilityIds,
  speciesStatsAndTypes,
  speedStatFor,
  toID
} from './sim-access'
import type { AiDifficulty } from '../../shared/battle-types'

export type { AiDifficulty }

interface OpponentInfo {
  species: string
  types: string[]
  hpPercent: number
  fainted: boolean
  status: string | null
  // The one extra type it has picked up (Forest's Curse, Trick-or-Treat); a new one replaces it.
  addedType?: string | null
  // Its ability, once the battle has shown it (an -ability line, or an immunity
  // like "[from] ability: Levitate"). Until then only its species' options are known.
  ability?: string | null
  airBalloon?: boolean
  magnetRise?: boolean
  // Smack Down / Thousand Arrows pulled it to the ground.
  smackedDown?: boolean
  level: number
  // Its Speed stage (-6 to +6), as the battle has shown it.
  speBoost: number
}

type Chance = 'certain' | 'possible' | null

interface FoeShields {
  types: { certain: string[]; possible: string[] }
  flags: { certain: string[]; possible: string[] }
  wonderGuard: Chance
  // Statuses the terrain keeps off it (only while it's on the ground).
  statuses: { certain: string[]; possible: string[] }
}

// A Pokemon's Speed stage after a battle log line about it (already split on '|').
function nextSpeBoost(current: number, parts: string[]): number {
  const [cmd, , stat, amount] = parts
  const n = Number(amount) || 0
  if (cmd === '-boost' && stat === 'spe') return Math.min(6, current + n)
  if (cmd === '-unboost' && stat === 'spe') return Math.max(-6, current - n)
  if (cmd === '-setboost' && stat === 'spe') return n
  if (cmd === '-clearboost') return 0
  if (cmd === '-clearnegativeboost') return Math.max(0, current)
  if (cmd === '-invertboost') return -current
  return current
}

// A stat stage as a multiplier: +1 is x1.5, -1 is x2/3, and so on.
function boostMultiplier(stage: number): number {
  return stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage)
}

// Average hit count of a 2-5 hit move (35% / 35% / 15% / 15%).
const TWO_TO_FIVE_AVERAGE_HITS = 3.1
// Triple Axel and Triple Kick hit harder each time: 1x, 2x, 3x their power.
const ESCALATING_MULTIHIT = new Set(['tripleaxel', 'triplekick'])
// Rough worth of making the foe flinch with Fake Out on the turn it can be used.
const FAKE_OUT_FLINCH_BONUS = 40

// Weather, by the ids the battle log uses (lowercased).
const RAIN = new Set(['raindance', 'primordialsea'])
const SUN = new Set(['sunnyday', 'desolateland'])
const SNOW = new Set(['snowscape', 'hail'])
const SAND = new Set(['sandstorm'])
// Abilities that switch every weather effect off while their holder is out.
const WEATHER_SUPPRESSORS = new Set(['cloudnine', 'airlock'])
// Each terrain powers up moves of one type used by a grounded Pokemon (x1.3).
const TERRAIN_BOOSTED_TYPE: Record<string, string> = {
  electricterrain: 'Electric',
  grassyterrain: 'Grass',
  psychicterrain: 'Psychic'
}
const TERRAIN_BOOST = 1.3
// What Weather Ball and Terrain Pulse turn into.
const WEATHER_BALL_TYPES: [Set<string>, string][] = [
  [RAIN, 'Water'],
  [SUN, 'Fire'],
  [SNOW, 'Ice'],
  [SAND, 'Rock']
]
const TERRAIN_PULSE_TYPES: Record<string, string> = {
  electricterrain: 'Electric',
  grassyterrain: 'Grass',
  mistyterrain: 'Fairy',
  psychicterrain: 'Psychic'
}
// Always hit in rain (and Thunder / Hurricane drop to 50% accuracy in sun).
const RAIN_SURE_HIT = new Set(['thunder', 'hurricane', 'bleakwindstorm', 'wildboltstorm', 'sandsearstorm'])
// Grassy Terrain halves these against a grounded target.
const GRASSY_HALVED = new Set(['earthquake', 'bulldoze', 'magnitude'])
// Two-turn moves the weather lets fire straight away.
const INSTANT_IN_SUN = new Set(['solarbeam', 'solarblade'])
const INSTANT_IN_RAIN = new Set(['electroshot'])
// Everything Misty Terrain protects a grounded Pokemon from.
const MISTY_BLOCKED_STATUSES = ['slp', 'par', 'brn', 'psn', 'tox', 'frz', 'confusion']

/** A move's real power right now, as the AI scores it. */
export interface AiMovePower {
  // Its power against the foe(s) out (the lowest, with two); null when it has none to report.
  basePower: number | null
  // For fixed-damage moves: that damage as a percent of the foe's max HP.
  fixedDamagePercent: number | null
  // Certain to fail right now (Fake Out after the Pokemon's first turn out).
  fails?: boolean
}

// The coarse "power -> percent of the foe's HP" scale the scoring uses (no real
// stat calc): a 100-power hit counts as roughly 40%.
const DAMAGE_PERCENT_PER_POWER = 0.4
// Stand-in power for moves whose power is rolled each use (Magnitude averages 71).
const RANDOM_POWER_FALLBACK = 70

// Support moves meant for the partner whose target type would also let them be
// used on a foe - healing, boosting or hurrying the opponent instead is never the
// point. (Moves whose target type is ally-only - Helping Hand, Coaching, Aromatic
// Mist - can't go anywhere else anyway.)
const ALLY_AIMED_MOVES = new Set(['healpulse', 'floralhealing', 'decorate', 'instruct', 'afteryou'])
// The ones that heal the ally: only worth it when the ally is actually hurt.
const ALLY_HEAL_MOVES = new Set(['healpulse', 'floralhealing'])
// Ally HP (%) under which healing it is a priority rather than a maybe.
const ALLY_LOW_HP = 50

// Abilities that let an attack ignore the target's ability (Levitate included).
const MOLD_BREAKERS = new Set(['moldbreaker', 'teravolt', 'turboblaze'])

function speciesOf(entry: { details: string }): string {
  return entry.details.split(',')[0].trim()
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

// Move target types that need an explicit targetLoc once there's more than
// one active Pokemon per side (Showdown's own gate - see
// battle-actions.js's targetTypeChoices/CHOOSABLE_TARGETS). Everything else
// (self, spread moves, side-wide effects, ...) auto-resolves without one.
const CHOOSABLE_TARGETS = new Set(['normal', 'any', 'adjacentAlly', 'adjacentAllyOrSelf', 'adjacentFoe'])

function averageExposure(attackerTypes: string[], defenderTypes: string[], immuneTypes: string[] = []): number {
  if (attackerTypes.length === 0) return 1
  return (
    attackerTypes.reduce(
      (sum, t) => sum + (immuneTypes.includes(t) ? 0 : getTypeEffectivenessMultiplier(t, defenderTypes)),
      0
    ) / attackerTypes.length
  )
}

// What the AI's own Pokemon is immune to beyond its typing - it knows its own
// team's abilities and items outright.
function ownImmuneTypes(mon: PokemonSwitchRequestData): string[] {
  const immune: string[] = []
  const fromAbility = ABILITY_TYPE_IMMUNITIES[mon.ability ?? mon.baseAbility]
  if (fromAbility) immune.push(fromAbility)
  if (mon.item === 'airballoon' && !immune.includes('Ground')) immune.push('Ground')
  return immune
}

/**
 * A generic opponent AI, usable for both wild encounters (always 'easy') and
 * future trainer battles (which will pick their own difficulty). Higher
 * tiers reason about type effectiveness and matchups using only publicly
 * revealed information (its own team is fully known, the human's is only
 * known once each Pokemon has been seen in battle) - the same information a
 * human opponent would have.
 */
export class AIPlayer extends BattlePlayer {
  // Index 0 = the human's slot 'a', index 1 = slot 'b' - stays index-0-only
  // (slot 'b' never populates) in a singles battle.
  private opponents: (OpponentInfo | null)[] = [null, null]

  // Mega Evolution, Ultra Burst, Z-Moves and Terastallizing can each be used once
  // per turn by a side, so in doubles the second Pokemon has to go without.
  private gimmicksUsedThisTurn = new Set<string>()
  // Set once the AI has fallen back to the sim's default choice for this request.
  private fellBack = false
  // Gravity grounds everything, Levitate and Air Balloon included.
  private gravity = false
  // Whether the Pokemon currently choosing has Mold Breaker (or Teravolt /
  // Turboblaze), so the foe's ability immunities don't apply to its attacks.
  private moldBreaker = false
  private trickRoom = false
  // The partner of the Pokemon currently choosing (doubles), or null when it has
  // none - singles, or its ally has fainted. Set by chooseAction for scoreMove.
  private ally: { hpPercent: number } | null = null
  // The weather and terrain in play, as the battle log names them (lowercased ids).
  private weather: string | null = null
  private terrain: string | null = null
  // The AI's own active Pokemon's Speed stages, by slot - the request only
  // carries its raw stats, so these are followed from the battle log.
  private ownSpeBoost: number[] = [0, 0]

  constructor(
    stream: Streams.ObjectReadWriteStream<string>,
    private readonly mySide: 'p1' | 'p2',
    private readonly difficulty: AiDifficulty,
    // What a move of the AI's active Pokemon in `slot` would really hit for right
    // now, asked of the running battle (see WildBattle.aiMovePower). Optional so
    // the AI still works on printed power alone without one.
    private readonly livePower?: (slot: number, moveId: string) => AiMovePower | null
  ) {
    super(stream)
  }

  override receiveLine(line: string): void {
    this.trackOpponent(line)
    super.receiveLine(line)
  }

  private opponentIdentPrefix(): string {
    return this.mySide === 'p1' ? 'p2' : 'p1'
  }

  private ownSlotIndex(ident: string | undefined): number | null {
    if (!ident || !ident.startsWith(this.mySide)) return null
    const pos = ident[2]
    return pos === 'a' ? 0 : pos === 'b' ? 1 : null
  }

  private opponentSlotIndex(ident: string | undefined): number | null {
    if (!ident || !ident.startsWith(this.opponentIdentPrefix())) return null
    const pos = ident[2]
    return pos === 'a' ? 0 : pos === 'b' ? 1 : null
  }

  private trackOpponent(line: string): void {
    if (!line.startsWith('|')) return
    const parts = line.slice(1).split('|')
    const cmd = parts[0]
    if ((cmd === '-fieldstart' || cmd === '-fieldend') && parts[1] === 'move: Gravity') {
      this.gravity = cmd === '-fieldstart'
      return
    }
    if ((cmd === '-fieldstart' || cmd === '-fieldend') && parts[1] === 'move: Trick Room') {
      this.trickRoom = cmd === '-fieldstart'
      return
    }
    if ((cmd === '-fieldstart' || cmd === '-fieldend') && / Terrain$/.test(parts[1] ?? '')) {
      const terrain = toID(parts[1].replace(/^move: /, ''))
      if (cmd === '-fieldstart') this.terrain = terrain
      else if (this.terrain === terrain) this.terrain = null
      return
    }
    if (cmd === '-weather') {
      this.weather = !parts[1] || parts[1] === 'none' ? null : toID(parts[1])
      return
    }
    if (cmd === '-clearallboost') {
      this.ownSpeBoost = [0, 0]
      for (const o of this.opponents) if (o) o.speBoost = 0
      return
    }

    const ownSlot = this.ownSlotIndex(parts[1])
    if (ownSlot !== null) {
      if (cmd === 'switch' || cmd === 'drag') this.ownSpeBoost[ownSlot] = 0
      else this.ownSpeBoost[ownSlot] = nextSpeBoost(this.ownSpeBoost[ownSlot], parts)
      return
    }

    const slot = this.opponentSlotIndex(parts[1])
    if (slot === null) return

    if (cmd === 'switch' || cmd === 'drag') {
      const species = parts[2].split(',')[0].trim()
      const level = Number(/, L(\d+)/.exec(parts[2])?.[1] ?? 100)
      const { hpPercent, fainted, status } = parseCondition(parts[3])
      this.opponents[slot] = {
        species,
        types: speciesStatsAndTypes(species, null).types,
        hpPercent,
        fainted,
        status,
        level,
        speBoost: 0
      }
      return
    }
    const opponent = this.opponents[slot]
    if (!opponent) return

    // An ability shown outright, or an immunity ability showing itself as it
    // absorbs a hit ("-immune|p1a: Bronzong|[from] ability: Levitate", "-start|
    // p1a: Heatran|ability: Flash Fire"). Those always belong to the Pokemon the
    // line is about, even when an "[of] <attacker>" is tacked on.
    if (cmd === '-ability' && parts[2]) {
      opponent.ability = toID(parts[2])
    } else {
      const shown = parts.slice(2).find((p) => /^(\[from\] )?ability: /.test(p))
      const ability = shown ? toID(shown.replace(/^(\[from\] )?ability: /, '')) : ''
      if (ability in ABILITY_TYPE_IMMUNITIES || ability in ABILITY_FLAG_IMMUNITIES || ability === 'wonderguard') {
        opponent.ability = ability
      }
    }
    opponent.speBoost = nextSpeBoost(opponent.speBoost, parts)
    const effect = (parts[2] ?? '').replace(/^move: /, '')
    if (cmd === '-item' && effect === 'Air Balloon') opponent.airBalloon = true
    else if (cmd === '-enditem' && effect === 'Air Balloon') opponent.airBalloon = false
    else if (cmd === '-start' && effect === 'Magnet Rise') opponent.magnetRise = true
    else if (cmd === '-end' && effect === 'Magnet Rise') opponent.magnetRise = false
    else if (cmd === '-start' && effect === 'Smack Down') opponent.smackedDown = true

    if (cmd === 'replace' || cmd === 'detailschange' || cmd === '-formechange') {
      opponent.species = parts[2].split(',')[0].trim()
      opponent.types = speciesStatsAndTypes(opponent.species, null).types
      opponent.addedType = null
    } else if (cmd === '-damage' || cmd === '-heal') {
      const { hpPercent, fainted, status } = parseCondition(parts[2])
      opponent.hpPercent = hpPercent
      opponent.fainted = fainted
      opponent.status = status
    } else if (cmd === 'faint') {
      opponent.hpPercent = 0
      opponent.fainted = true
    } else if (cmd === '-status') {
      opponent.status = parts[2]
    } else if (cmd === '-curestatus') {
      opponent.status = null
    } else if (cmd === '-start' && parts[2] === 'typechange' && parts[3]) {
      opponent.types = parts[3].split('/')
      opponent.addedType = null
    } else if (cmd === '-start' && parts[2] === 'typeadd' && parts[3] && !opponent.types.includes(parts[3])) {
      opponent.types = [...opponent.types.filter((t) => t !== opponent.addedType), parts[3]]
      opponent.addedType = parts[3]
    } else if (cmd === '-terastallize' && parts[2] && parts[2] !== 'Stellar') {
      opponent.types = [parts[2]]
      opponent.addedType = null
    }
  }

  // The opponent used for matchup scoring - whichever tracked slot is alive
  // (in doubles, arbitrarily the first one found; good enough since scoring
  // is a coarse heuristic to begin with).
  private primaryOpponent(): OpponentInfo | null {
    return this.opponents.find((o) => o && !o.fainted) ?? null
  }

  private aliveOpponents(): OpponentInfo[] {
    return this.opponents.filter((o): o is OpponentInfo => !!o && !o.fainted)
  }

  /**
   * How sure the AI can be that a foe has an ability matching `test`: 'certain'
   * once the battle has shown its ability, or when every ability its species can
   * have matches (Hydreigon's only ability is Levitate, Shedinja's Wonder Guard);
   * 'possible' when only some of them do (Bronzong's Levitate); null otherwise.
   */
  private foeAbilityChance(foe: OpponentInfo, test: (ability: string) => boolean): Chance {
    if (foe.ability) return test(foe.ability) ? 'certain' : null
    const all = speciesAbilityIds(foe.species)
    const matching = all.filter(test)
    if (matching.length === 0) return null
    return matching.length === all.length ? 'certain' : 'possible'
  }

  /**
   * What a foe is protected by beyond its typing: attack types (Levitate, Flash
   * Fire, an Air Balloon, Magnet Rise), move flags (Soundproof, Bulletproof, the
   * priority blockers) and Wonder Guard - each `certain` or merely `possible` (see
   * foeAbilityChance). Mold Breaker (`ignoreAbility`) sees through the ability
   * part; Gravity and Smack Down ground it entirely.
   */
  private foeShields(foe: OpponentInfo, ignoreAbility: boolean): FoeShields {
    const shields: FoeShields = {
      types: { certain: [], possible: [] },
      flags: { certain: [], possible: [] },
      wonderGuard: null,
      statuses: { certain: [], possible: [] }
    }
    // A terrain only protects a Pokemon standing on the ground.
    const grounded = this.foeGrounded(foe)
    if (grounded && this.terrain === 'psychicterrain') shields.flags[grounded].push('priority')
    if (grounded && this.terrain === 'electricterrain') shields.statuses[grounded].push('slp')
    if (grounded && this.terrain === 'mistyterrain') shields.statuses[grounded].push(...MISTY_BLOCKED_STATUSES)
    if (!ignoreAbility) {
      for (const type of new Set(Object.values(ABILITY_TYPE_IMMUNITIES))) {
        const chance = this.foeAbilityChance(foe, (a) => ABILITY_TYPE_IMMUNITIES[a] === type)
        if (chance) shields.types[chance].push(type)
      }
      for (const flag of new Set(Object.values(ABILITY_FLAG_IMMUNITIES))) {
        const chance = this.foeAbilityChance(foe, (a) => ABILITY_FLAG_IMMUNITIES[a] === flag)
        if (chance) shields.flags[chance].push(flag)
      }
      shields.wonderGuard = this.foeAbilityChance(foe, (a) => a === 'wonderguard')
    }
    if ((foe.airBalloon || foe.magnetRise) && !shields.types.certain.includes('Ground')) {
      shields.types.certain.push('Ground')
      shields.types.possible = shields.types.possible.filter((t) => t !== 'Ground')
    }
    if (this.gravity || foe.smackedDown) {
      shields.types.certain = shields.types.certain.filter((t) => t !== 'Ground')
      shields.types.possible = shields.types.possible.filter((t) => t !== 'Ground')
    }
    return shields
  }

  // A foe as moveDoesNothing sees it - its typing plus whatever it's certainly protected by.
  private foeParty(foe: OpponentInfo, ignoreAbility: boolean): MoveParty {
    const shields = this.foeShields(foe, ignoreAbility)
    return {
      types: foe.types,
      hpPercent: foe.hpPercent,
      status: foe.status,
      immuneTypes: shields.types.certain,
      immuneFlags: shields.flags.certain,
      onlySuperEffective: shields.wonderGuard === 'certain',
      statusBlocked: shields.statuses.certain
    }
  }

  // Whether a foe is on the ground (so terrain applies to it): 'certain', 'possible'
  // when it might have Levitate, null when it's surely airborne - a Flying type,
  // Levitate for sure, an Air Balloon, Magnet Rise. Gravity and Smack Down pull
  // everything down.
  private foeGrounded(foe: OpponentInfo): Chance {
    if (this.gravity || foe.smackedDown) return 'certain'
    if (foe.types.includes('Flying') || foe.airBalloon || foe.magnetRise) return null
    const levitate = this.foeAbilityChance(foe, (a) => a === 'levitate')
    return levitate === 'certain' ? null : levitate === 'possible' ? 'possible' : 'certain'
  }

  private ownGrounded(ownActive: PokemonSwitchRequestData, ownTypes: string[]): boolean {
    if (this.gravity) return true
    return !(
      ownTypes.includes('Flying') ||
      (ownActive.ability ?? ownActive.baseAbility) === 'levitate' ||
      ownActive.item === 'airballoon'
    )
  }

  // The weather that's actually in effect - none while a Cloud Nine / Air Lock
  // Pokemon (the AI's own, or a foe whose ability has shown) is out.
  private activeWeather(ownActive: PokemonSwitchRequestData): string | null {
    if (!this.weather) return null
    if (WEATHER_SUPPRESSORS.has(ownActive.ability ?? ownActive.baseAbility)) return null
    if (this.aliveOpponents().some((o) => o.ability && WEATHER_SUPPRESSORS.has(o.ability))) return null
    return this.weather
  }

  // The foe's Speed as the AI can guess it from public info: its species and
  // level, assumed fully trained in Speed (31 IVs, 252 EVs, neutral nature) - on
  // the cautious side, so "probably faster" really means it. Then paralysis and
  // any Speed boosts the battle has shown.
  private estimatedFoeSpeed(foe: OpponentInfo): number {
    let speed = speedStatFor(foe.species, foe.level, 31, 252) * boostMultiplier(foe.speBoost)
    if (foe.status === 'par') speed /= 2
    return speed
  }

  // Whether the AI's Pokemon in `slot` is probably going to move before `foe`
  // this turn with a normal-priority move (Trick Room turns that around).
  private likelyMovesFirst(ownActive: PokemonSwitchRequestData, slot: number, foe: OpponentInfo): boolean {
    let own = ownActive.stats.spe * boostMultiplier(this.ownSpeBoost[slot] ?? 0)
    if (parseCondition(ownActive.condition).status === 'par') own /= 2
    const theirs = this.estimatedFoeSpeed(foe)
    return this.trickRoom ? own < theirs : own > theirs
  }

  // The sim refused a choice and is still waiting for a valid one; with nothing
  // handling that the whole battle would freeze. Ask for its own default choice
  // instead, which is always legal.
  override receiveError(error: Error): void {
    if (this.fellBack) throw error
    this.fellBack = true
    console.error("[battle-ai] the sim refused the AI's choice, using the default one instead:", error.message)
    this.choose('default')
  }

  override receiveRequest(request: ChoiceRequest): void {
    if (request.wait) return
    this.gimmicksUsedThisTurn.clear()
    this.fellBack = false

    if (request.teamPreview) {
      this.choose('default')
      return
    }

    if (request.forceSwitch) {
      const chosen = new Set<number>()
      const choices = request.forceSwitch.map((mustSwitch) => {
        if (!mustSwitch) return 'pass'
        const slot = this.pickSwitchIn(request.side.pokemon, chosen)
        if (slot === null) return 'pass'
        chosen.add(slot)
        return `switch ${slot + 1}`
      })
      this.choose(choices.join(', '))
      return
    }

    if (request.active) {
      const activeMons = request.side.pokemon.filter((p) => p.active)
      const numActive = request.active.length
      const choices = request.active.map((active, i) => {
        // In doubles a slot whose Pokemon fainted with nothing left to replace it
        // stays in the request but has no choice to make: it must be passed, or
        // the sim shifts every later choice onto the wrong Pokemon and rejects the turn.
        if (activeMons[i]?.condition.endsWith('fnt')) return 'pass'
        return this.chooseAction(active, activeMons[i] ?? activeMons[0], request.side.pokemon, i, numActive)
      })
      this.choose(choices.join(', '))
    }
  }

  // Picks a valid targetLoc for a move that needs one (see CHOOSABLE_TARGETS)
  // once there's more than one active Pokemon per side - 0 means "no target
  // needed", matching chooseMove's own convention.
  private pickTargetLoc(targetType: string, numActive: number, mySlotIndex: number, moveId = '', own?: MoveParty): number {
    if (numActive < 2 || !CHOOSABLE_TARGETS.has(targetType)) return 0
    // Moves meant for a partner (Heal Pulse, Decorate...) go to the ally even when
    // their target type would also let them hit a foe.
    if (targetType === 'adjacentAlly' || targetType === 'adjacentAllyOrSelf' || ALLY_AIMED_MOVES.has(moveId)) {
      const allySlot = mySlotIndex === 0 ? 1 : 0
      return -(allySlot + 1)
    }
    // normal / any / adjacentFoe - target whichever tracked foe slot is
    // alive and lowest on HP (kill priority); fall back to slot 1 if nothing
    // has been seen yet (shouldn't happen once the battle is underway).
    const alive = [0, 1].filter((i) => this.opponents[i] && !this.opponents[i]!.fainted)
    if (alive.length === 0) return 1
    // Aim at a foe the move can actually work on, if there is one.
    const workable = own
      ? alive.filter((i) => !moveDoesNothing(moveId, own, this.foeParty(this.opponents[i]!, this.moldBreaker)))
      : alive
    const aliveIndices = workable.length > 0 ? workable : alive
    const best = aliveIndices.reduce((a, b) => (this.opponents[a]!.hpPercent <= this.opponents[b]!.hpPercent ? a : b))
    return best + 1
  }

  private formatMoveChoice(
    slot: number,
    active: PokemonMoveRequestData,
    ownTypes: string[],
    numActive: number,
    mySlotIndex: number,
    own?: MoveParty
  ): string {
    const moveReq = active.moves[slot - 1]
    const targetLoc = this.pickTargetLoc(moveReq?.target ?? 'normal', numActive, mySlotIndex, moveReq?.id ?? '', own)
    const targetSuffix = targetLoc !== 0 ? ` ${targetLoc}` : ''
    return `move ${slot}${targetSuffix}${this.gimmickSuffix(active, slot, moveReq?.id ?? '', ownTypes)}`
  }

  private pickSwitchIn(pokemon: PokemonSwitchRequestData[], exclude: Set<number>): number | null {
    const available = pokemon
      .map((p, i) => ({ p, i }))
      .filter(({ p, i }) => !p.active && !p.condition.endsWith('fnt') && !exclude.has(i))
    if (available.length === 0) return null
    const opponent = this.primaryOpponent()
    if (this.difficulty === 'easy' || !opponent) return available[0].i

    // Prefer whichever bench Pokemon resists the opponent's typing best.
    let best = available[0]
    let bestScore = Infinity
    for (const candidate of available) {
      const types = speciesStatsAndTypes(speciesOf(candidate.p), null).types
      const incoming = averageExposure(opponent.types, types, ownImmuneTypes(candidate.p))
      if (incoming < bestScore) {
        bestScore = incoming
        best = candidate
      }
    }
    return best.i
  }

  private chooseAction(
    active: PokemonMoveRequestData,
    ownActive: PokemonSwitchRequestData,
    pokemon: PokemonSwitchRequestData[],
    mySlotIndex: number,
    numActive: number
  ): string {
    const legalMoves = active.moves.map((m, i) => ({ ...m, slot: i + 1 })).filter((m) => !m.disabled)
    if (legalMoves.length === 0) return this.formatMoveChoice(1, active, [], numActive, mySlotIndex)

    this.moldBreaker = MOLD_BREAKERS.has(ownActive.ability ?? ownActive.baseAbility)
    const allyMon = numActive >= 2 ? pokemon.filter((p) => p.active)[mySlotIndex === 0 ? 1 : 0] : undefined
    const allyCondition = allyMon ? parseCondition(allyMon.condition) : null
    this.ally = allyCondition && !allyCondition.fainted ? { hpPercent: allyCondition.hpPercent } : null
    const ownTypes = speciesStatsAndTypes(speciesOf(ownActive), null).types
    const { hpPercent: ownHp, status: ownStatus } = parseCondition(ownActive.condition)
    const own: MoveParty = { types: ownTypes, hpPercent: ownHp, status: ownStatus }

    if (this.difficulty === 'easy') {
      const pick = pickRandom(legalMoves)
      return this.formatMoveChoice(pick.slot, active, ownTypes, numActive, mySlotIndex, own)
    }

    if (this.difficulty === 'hard' && !active.trapped) {
      const switchSlot = this.considerSwitching(ownActive, pokemon)
      if (switchSlot !== null) return `switch ${switchSlot + 1}`
    }

    const scored = legalMoves.map((m) => ({ slot: m.slot, id: m.id, score: this.scoreMove(m.id, ownTypes, own, mySlotIndex, ownActive) }))
    scored.sort((a, b) => b.score - a.score)
    return this.formatMoveChoice(scored[0].slot, active, ownTypes, numActive, mySlotIndex, own)
  }

  // Mega Evolution/Ultra Burst/Z-Move are one-time, item-gated resources -
  // once available (i.e. the Pokemon is holding the matching stone/crystal),
  // there's essentially never a reason not to use them, so every difficulty
  // tier takes them as soon as they're offered. Terastallizing is different -
  // it's always available (not item-gated) and can be a bad idea depending
  // on the matchup, so only Hard reasons about when it's actually worth it.
  private gimmickSuffix(active: PokemonMoveRequestData, slot: number, moveId: string, ownTypes: string[]): string {
    const suffix = this.wantedGimmick(active, slot, moveId, ownTypes)
    if (!suffix) return ''
    const kind = suffix.trim().startsWith('mega') ? 'mega' : suffix.trim()
    if (this.gimmicksUsedThisTurn.has(kind)) return ''
    this.gimmicksUsedThisTurn.add(kind)
    return suffix
  }

  private wantedGimmick(active: PokemonMoveRequestData, slot: number, moveId: string, ownTypes: string[]): string {
    if (active.canMegaEvo || active.canMegaEvoX || active.canMegaEvoY) {
      if (!active.canMegaEvo && active.canMegaEvoY) return ' megay'
      if (!active.canMegaEvo) return ' megax'
      return ' mega'
    }
    if (active.canUltraBurst) return ' ultra'
    const zMoves = active.canZMove as ({ move: string; target: string } | null)[] | null | undefined
    if (zMoves?.[slot - 1]) return ' zmove'
    if (this.difficulty === 'hard' && active.canTerastallize) {
      const info = getMoveInfo(moveId)
      if (info && this.shouldTerastallize(info.type, ownTypes, active.canTerastallize)) return ' terastallize'
    }
    return ''
  }

  private shouldTerastallize(moveType: string, ownTypes: string[], teraType: string): boolean {
    // Terastallizing into the type of the move being used grants (or
    // upgrades) STAB on it - a clear offensive win regardless of matchup.
    const offensiveGain = moveType === teraType
    const opponent = this.primaryOpponent()
    if (!opponent) return offensiveGain
    // Defensively, Tera replaces the Pokemon's typing entirely, so compare
    // how exposed it currently is to the opponent's revealed types against
    // how exposed it would be as a pure tera-type instead.
    const currentExposure = averageExposure(opponent.types, ownTypes)
    const teraExposure = averageExposure(opponent.types, [teraType])
    const defensiveGain = currentExposure - teraExposure >= 0.5
    return offensiveGain || defensiveGain
  }

  private scoreMove(
    moveId: string,
    ownTypes: string[],
    own: MoveParty,
    mySlotIndex: number,
    ownActive: PokemonSwitchRequestData
  ): number {
    const info = getMoveInfo(moveId)
    const combat = getMoveCombatData(moveId)
    if (!info || !combat) return 0
    const weather = this.activeWeather(ownActive)
    const grounded = this.ownGrounded(ownActive, ownTypes)
    // Weather Ball and Terrain Pulse change type (and double in power) with the field.
    const moveType = this.fieldMoveType(moveId, info.type, weather, grounded)
    const typeChanged = moveType !== info.type
    // Grassy Glide jumps the queue on Grassy Terrain.
    const priority = moveId === 'grassyglide' && this.terrain === 'grassyterrain' && grounded ? 1 : combat.priority

    // A move that would certainly do nothing to any foe out is never worth a turn
    // (skipped when the field changed its type - the check below covers that case).
    const foes = this.aliveOpponents()
    if (!typeChanged && foes.length > 0 && foes.every((foe) => moveDoesNothing(moveId, own, this.foeParty(foe, this.moldBreaker)))) {
      return 0
    }
    // What the move actually hits for right now (Last Respects, Eruption, Low Kick,
    // Facade, Hex...), not its printed number - which is 0 for many of those.
    const live = this.livePower?.(mySlotIndex, moveId) ?? null
    // Fake Out and First Impression only work on a Pokemon's first turn out.
    if (live?.fails) return 0
    // Steel Roller fails with no terrain to roll over; the extreme weathers wash
    // out Fire (heavy rain) or evaporate Water (harsh sun) moves entirely.
    if (moveId === 'steelroller' && !this.terrain) return 0
    if (info.category !== 'Status') {
      if (weather === 'primordialsea' && moveType === 'Fire') return 0
      if (weather === 'desolateland' && moveType === 'Water') return 0
    }

    // Moves for the partner: useless with no partner (in singles they'd fail, or
    // land on the foe - Heal Pulse healing it), and a heal is only worth it when
    // the partner is actually hurt.
    if (combat.target === 'adjacentAlly' || ALLY_AIMED_MOVES.has(moveId)) {
      if (!this.ally) return 0
      if (ALLY_HEAL_MOVES.has(moveId)) {
        if (this.ally.hpPercent >= 100) return 0
        return this.ally.hpPercent < ALLY_LOW_HP ? 60 : 35
      }
      return 35
    }

    const opponent = this.primaryOpponent()
    if (info.category === 'Status') {
      // Worth less if the terrain might keep the status off (a foe that may or may not be grounded).
      const maybeBlocked =
        !!opponent && !!combat.inflicts && this.foeShields(opponent, this.moldBreaker).statuses.possible.includes(combat.inflicts)
      return maybeBlocked ? 17 : 35
    }

    const typeMultiplier = opponent ? getTypeEffectivenessMultiplier(moveType, opponent.types) : 1
    let multiplier = typeMultiplier
    if (opponent && !combat.selfTargeted) {
      const shields = this.foeShields(opponent, this.moldBreaker)
      const blockedBy = (list: string[]): boolean =>
        list.includes(moveType) ||
        combat.flags.some((f) => list.includes(f)) ||
        (priority > 0 && list.includes('priority'))
      if (blockedBy(shields.types.certain) || blockedBy(shields.flags.certain)) multiplier = 0
      // It might have the ability that blanks this (Bronzong's Levitate, a
      // Soundproof it may or may not have) - worth less than a move that's sure
      // to land, but not ruled out.
      else if (blockedBy(shields.types.possible) || blockedBy(shields.flags.possible)) multiplier *= 0.5
      // Wonder Guard: nothing short of super effective lands.
      if (typeMultiplier <= 1) {
        if (shields.wonderGuard === 'certain') multiplier = 0
        else if (shields.wonderGuard === 'possible') multiplier *= 0.5
      }
    }
    if (multiplier === 0) return 0

    const stab = ownTypes.includes(moveType) ? 1.5 : 1
    const accuracy = this.fieldAccuracy(moveId, info.accuracy, weather) / 100
    let score: number
    if (live?.fixedDamagePercent != null) {
      // Seismic Toss, Super Fang: a set chunk of HP that ignores typing and STAB -
      // expressed on the same scale as a power-based hit (see the kill check below).
      score = (live.fixedDamagePercent / DAMAGE_PERCENT_PER_POWER) * accuracy
    } else {
      // Moves that roll their power at random (Magnitude, Present) report none - use an average.
      let power = live?.basePower ?? (info.basePower || RANDOM_POWER_FALLBACK)
      if (typeChanged) power *= 2 // Weather Ball / Terrain Pulse: 50 -> 100
      // Every hit of a multi-hit move counts, not just the first (live power is per hit).
      score =
        this.expectedTotalPower(moveId, combat, power, accuracy, ownActive) *
        multiplier *
        stab *
        this.fieldPowerMultiplier(moveId, moveType, combat, weather, grounded, opponent)
    }
    if (moveId === 'fakeout') score += FAKE_OUT_FLINCH_BONUS

    if (this.difficulty === 'hard' && opponent) {
      // Coarse damage estimate (no real stat calc) - just enough to notice
      // "this probably finishes the target off" and prioritize it. A knockout only
      // counts in full if it lands before the foe gets to act: a priority move, or
      // an ordinary one when this Pokemon is probably the faster of the two - so
      // when it's slower, a priority move that finishes the job wins out.
      const estimatedDamagePercent = Math.min(100, score * DAMAGE_PERCENT_PER_POWER)
      if (estimatedDamagePercent >= opponent.hpPercent) {
        const movesFirst = priority > 0 || this.likelyMovesFirst(ownActive, mySlotIndex, opponent)
        score += movesFirst ? 1000 : 500
      }
    }

    return score
  }

  // The type a move really is with this weather / terrain: Weather Ball takes the
  // weather's type, Terrain Pulse the terrain's (if its user is on the ground).
  private fieldMoveType(moveId: string, printedType: string, weather: string | null, grounded: boolean): string {
    if (moveId === 'weatherball' && weather) {
      return WEATHER_BALL_TYPES.find(([set]) => set.has(weather))?.[1] ?? printedType
    }
    if (moveId === 'terrainpulse' && this.terrain && grounded) return TERRAIN_PULSE_TYPES[this.terrain] ?? printedType
    return printedType
  }

  // Accuracy (out of 100) with the weather's say: Thunder and Hurricane never miss
  // in rain but drop to 50 in sun; Blizzard never misses in snow.
  private fieldAccuracy(moveId: string, accuracy: number | true, weather: string | null): number {
    if (accuracy === true) return 100
    if (weather && RAIN.has(weather) && RAIN_SURE_HIT.has(moveId)) return 100
    if (weather && SUN.has(weather) && (moveId === 'thunder' || moveId === 'hurricane')) return 50
    if (weather && SNOW.has(weather) && moveId === 'blizzard') return 100
    return accuracy
  }

  // How the weather and terrain scale an attack's damage:
  // - rain: Water x1.5, Fire x0.5; sun: Fire x1.5, Water x0.5 (Hydro Steam x1.5)
  // - terrain: x1.3 to its type when the user is grounded; Grassy halves
  //   Earthquake / Bulldoze / Magnitude and Misty halves Dragon moves against a
  //   grounded target
  // - two-turn moves are worth half (a whole turn charging), unless the weather
  //   fires them at once (Solar Beam / Blade in sun, Electro Shot in rain)
  private fieldPowerMultiplier(
    moveId: string,
    moveType: string,
    combat: MoveCombatData,
    weather: string | null,
    grounded: boolean,
    target: OpponentInfo | null
  ): number {
    let mult = 1
    if (weather && RAIN.has(weather)) {
      if (moveType === 'Water') mult *= 1.5
      else if (moveType === 'Fire') mult *= 0.5
    } else if (weather && SUN.has(weather)) {
      if (moveType === 'Fire' || moveId === 'hydrosteam') mult *= 1.5
      else if (moveType === 'Water') mult *= 0.5
    }
    if (this.terrain) {
      if (grounded && TERRAIN_BOOSTED_TYPE[this.terrain] === moveType) mult *= TERRAIN_BOOST
      const targetGrounded = target ? this.foeGrounded(target) === 'certain' : false
      if (targetGrounded && this.terrain === 'grassyterrain' && GRASSY_HALVED.has(moveId)) mult *= 0.5
      if (targetGrounded && this.terrain === 'mistyterrain' && moveType === 'Dragon') mult *= 0.5
    }
    if (combat.flags.includes('charge')) {
      const instant =
        (weather !== null && SUN.has(weather) && INSTANT_IN_SUN.has(moveId)) ||
        (weather !== null && RAIN.has(weather) && INSTANT_IN_RAIN.has(moveId))
      if (!instant) mult *= 0.5
    }
    return mult
  }

  // A move's total power across all its hits, with accuracy folded in: 2-5 hit
  // moves average 3.1 hits (always 5 with Skill Link, 4-5 with Loaded Dice), and
  // moves that roll accuracy per hit (Triple Axel, Population Bomb) stop at the
  // first miss. Triple Axel / Triple Kick also grow stronger with each hit.
  private expectedTotalPower(
    moveId: string,
    combat: MoveCombatData,
    powerPerHit: number,
    accuracy: number,
    ownActive: PokemonSwitchRequestData
  ): number {
    const { multihit } = combat
    if (multihit === null) return powerPerHit * accuracy
    const skillLink = (ownActive.ability ?? ownActive.baseAbility) === 'skilllink'
    const loadedDice = ownActive.item === 'loadeddice'
    let hits: number
    if (Array.isArray(multihit)) {
      hits = skillLink ? multihit[1] : loadedDice && multihit[1] === 5 ? 4.5 : TWO_TO_FIVE_AVERAGE_HITS
    } else {
      hits = multihit
    }
    if (!combat.multiaccuracy || skillLink) {
      return powerPerHit * hits * (combat.multiaccuracy ? 1 : accuracy)
    }
    // Hit k only happens if every roll up to it succeeds.
    let total = 0
    for (let k = 1; k <= hits; k++) {
      const power = ESCALATING_MULTIHIT.has(moveId) ? powerPerHit * k : powerPerHit
      total += power * Math.pow(accuracy, k)
    }
    return total
  }

  private considerSwitching(ownActive: PokemonSwitchRequestData, pokemon: PokemonSwitchRequestData[]): number | null {
    const opponent = this.primaryOpponent()
    if (!opponent) return null
    const { hpPercent } = parseCondition(ownActive.condition)
    if (hpPercent > 35) return null

    const bench = pokemon
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => !p.active && !p.condition.endsWith('fnt'))
    if (bench.length === 0) return null

    const ownTypes = speciesStatsAndTypes(speciesOf(ownActive), null).types
    const currentExposure = averageExposure(opponent.types, ownTypes, ownImmuneTypes(ownActive))

    let best: { i: number } | null = null
    let bestExposure = currentExposure
    for (const candidate of bench) {
      const types = speciesStatsAndTypes(speciesOf(candidate.p), null).types
      const exposure = averageExposure(opponent.types, types, ownImmuneTypes(candidate.p))
      if (exposure < bestExposure) {
        bestExposure = exposure
        best = candidate
      }
    }
    return best?.i ?? null
  }
}
