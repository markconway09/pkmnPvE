import type { Streams } from 'pokemon-showdown'
import type { ChoiceRequest } from 'pokemon-showdown/dist/sim/side.js'
import './vendor/battle-text-data'
import { BattleTextParser } from './vendor/battle-text-parser'
import {
  BattlePlayer,
  BattleStream,
  buildPokemonSummary,
  effectDisplayName,
  findRosterIndex,
  generateRandomSingle,
  getEditorOptions,
  getMoveInfo,
  getPlayerStreams,
  getTypeEffectivenessMultiplier,
  getWildDropPool,
  liveMovePower,
  moveTypeEffectiveness,
  packTeam,
  parseCondition,
  pokeballPrice,
  speciesStatsAndTypes,
  toID,
  type PokemonSet
} from './sim-access'
import { effectiveStatsFor } from './effective-stats'
import {
  PARTIAL_TRAP_MOVES,
  SINGLE_MOVE_IDS,
  SINGLE_TURN_IDS,
  badgeFor,
  effectId,
  withBadge,
  withoutBadge
} from './volatile-badges'
import type { Pokemon as SimPokemon } from 'pokemon-showdown/dist/sim/pokemon.js'
import { AIPlayer, type AiMovePower } from './battle-ai'

// Moves that only work on the user's first turn after coming out.
const FIRST_TURN_ONLY_MOVES = new Set(['fakeout', 'firstimpression', 'matblock'])
import { getProgression, recordTrainerWin } from './progression-store'
import { addCaughtMon, awardExpToTeam, awardFriendshipToTeam, hasRegisteredSpecies } from './box-store'
import { addItem, getItemQuantity, hasItem, removeItem } from './bag-store'
import { addMoney, getMoney, spendMoney } from './money-store'
import { countStat } from './stats-store'
import { expYieldFor } from './exp'
import { DEFAULT_POKEBALL_ID, prizeMoneyFor } from '../../shared/battle-types'
import type {
  ActivePokemonView,
  AiDifficulty,
  BoostStat,
  BattleView,
  BattleRewardsView,
  CatchResult,
  ExpGainResult,
  FeedbackEvent,
  FieldEffectView,
  FieldSnapshot,
  GimmickEvent,
  ItemDropConfig,
  ItemDropResult,
  RewardItemView,
  LiveMovePower,
  MoveEvent,
  RosterSlotView,
  TrainerBattleInfo
} from '../../shared/battle-types'

export type { BattleView }
export { getMoveInfo } from './sim-access'

const BOOST_STATS: BoostStat[] = ['atk', 'def', 'spa', 'spd', 'spe', 'accuracy', 'evasion']

// Position-aware side identifiers - Showdown protocol idents are always
// "<side><position>: Name" (e.g. "p1a: Pikachu", "p2b: Charizard"), even in
// singles (always position 'a' there). Tracking state per slot instead of
// per side is what actually makes doubles work - two Pokemon on the same
// side no longer overwrite each other's state.
type SlotKey = 'p1a' | 'p1b' | 'p2a' | 'p2b'
const SLOT_KEYS: SlotKey[] = ['p1a', 'p1b', 'p2a', 'p2b']

function slotKeyFromIdent(ident: string | undefined): SlotKey | null {
  const prefix = ident?.slice(0, 3)
  return prefix && (SLOT_KEYS as string[]).includes(prefix) ? (prefix as SlotKey) : null
}

// `[from] ...` effects on a `-item` line where the `[of]` Pokemon is the one who
// lost the item. Thief also announces this with its own `-enditem`, but Covet
// (and the ability/Bestow cases) only ever report the receiving side.
const ITEM_TAKEN_FROM_OF = new Set([
  '[from] move: Thief',
  '[from] move: Covet',
  '[from] move: Bestow',
  '[from] ability: Magician',
  '[from] ability: Pickpocket'
])

// The moves that block an attack like Protect - an -activate line naming one of
// these is that Pokemon's protection working, not some other ability/item quirk.
const PROTECT_MOVE_IDS = new Set([
  'protect',
  'detect',
  'spikyshield',
  'banefulbunker',
  'kingsshield',
  'obstruct',
  'silktrap',
  'burningbulwark',
  'matblock',
  'quickguard',
  'wideguard',
  'craftyshield'
])

// The floating "Missed"/"Immune"/"Protected"-style label for one protocol line, or
// null if it's not one of the handful the game flashes over a sprite (see Showdown's
// own client, which does the same for these commands via resultAnim). Kept as a plain
// function of the line, rather than battle state, since none of these need more context
// than the line itself provides.
function computeFeedbackEvent(line: string): FeedbackEvent | null {
  if (!line.startsWith('|')) return null
  const parts = line.slice(1).split('|')
  const cmd = parts[0]
  if (cmd === '-miss') {
    // No target listed means the move never picked one to begin with (e.g. it
    // just fizzled) - nothing to flash.
    const slot = slotKeyFromIdent(parts[2])
    return slot && { slot, label: 'Missed', tone: 'neutral' }
  }
  if (cmd === '-immune') {
    const slot = slotKeyFromIdent(parts[1])
    return slot && { slot, label: 'Immune', tone: 'neutral' }
  }
  if (cmd === '-crit') {
    const slot = slotKeyFromIdent(parts[1])
    return slot && { slot, label: 'Critical hit', tone: 'bad' }
  }
  if (cmd === '-supereffective') {
    const slot = slotKeyFromIdent(parts[1])
    return slot && { slot, label: 'Super-effective', tone: 'bad' }
  }
  if (cmd === '-resisted') {
    const slot = slotKeyFromIdent(parts[1])
    return slot && { slot, label: 'Resisted', tone: 'neutral' }
  }
  if (cmd === '-fail') {
    const slot = slotKeyFromIdent(parts[1])
    return slot && { slot, label: 'Failed', tone: 'neutral' }
  }
  if (cmd === '-block') {
    const slot = slotKeyFromIdent(parts[1])
    return slot && { slot, label: 'Blocked', tone: 'neutral' }
  }
  if (cmd === 'cant') {
    const slot = slotKeyFromIdent(parts[1])
    if (slot && parts[2] === 'flinch') return { slot, label: 'Flinched', tone: 'bad' }
  }
  if (cmd === '-activate') {
    const slot = slotKeyFromIdent(parts[1])
    if (!slot) return null
    const effect = parts[2] ?? ''
    if (effect === 'item: Sturdy') return { slot, label: 'Endured', tone: 'good' }
    if (effect.startsWith('move: ')) {
      const moveId = toID(effect.slice('move: '.length))
      if (moveId === 'endure') return { slot, label: 'Endured', tone: 'good' }
      if (PROTECT_MOVE_IDS.has(moveId)) return { slot, label: 'Protected', tone: 'good' }
    }
  }
  return null
}

// A Pokemon Terastallizing or Mega Evolving on this line (Primal Reversion and Ultra
// Burst count as a Mega), for the battle screen's short animation over it.
function computeGimmickEvent(line: string): GimmickEvent | null {
  if (!line.startsWith('|')) return null
  const parts = line.slice(1).split('|')
  const slot = slotKeyFromIdent(parts[1])
  if (!slot) return null
  if (parts[0] === '-terastallize') return { slot, kind: 'tera', teraType: parts[2] }
  if (parts[0] === '-mega' || parts[0] === '-burst' || parts[0] === '-primal') return { slot, kind: 'mega' }
  return null
}

// A Mega Evolved, Primal or Ultra Burst forme, by species name (Charizard-Mega-X,
// Groudon-Primal, Necrozma-Ultra).
const MEGA_FORME = /-(Mega(-[XY])?|Primal|Ultra)$/

// Entry hazards drawn on the ground, mapped to how many layers they stack to.
const HAZARD_MAX_LAYERS: Record<string, number> = {
  stealthrock: 1,
  spikes: 3,
  toxicspikes: 2,
  stickyweb: 1
}

export interface OpponentConfig {
  team: PokemonSet[]
  name: string
  difficulty: AiDifficulty
  trainerId?: string
  spriteId?: string
  isBoss?: boolean
  drops?: ItemDropConfig[]
  // The drop set on the premade team the trainer chose - rolled with `drops`, kept
  // apart only so the rewards tooltip can say where it comes from.
  teamDrop?: ItemDropConfig
  // Percent chance of one extra drop picked at random from the whole item pool.
  randomDropChance?: number
  // A friendly match (another player's saved team): winning gives no exp, money,
  // friendship, item drops or boss progress.
  noRewards?: boolean
}

class HumanPlayer extends BattlePlayer {
  latestRequest: ChoiceRequest | null = null
  version = 0
  // Set when the sim refuses a choice (it stays waiting for a valid one).
  lastError: Error | null = null

  constructor(
    stream: Streams.ObjectReadWriteStream<string>,
    private readonly onUpdate: () => void
  ) {
    super(stream)
  }

  override receiveError(error: Error): void {
    this.lastError = error
    this.onUpdate()
  }

  override receiveRequest(request: ChoiceRequest): void {
    this.latestRequest = request
    if (!request.wait) {
      this.version++
      this.onUpdate()
    }
  }
}

export class WildBattle {
  // Kept separately from `streams` (which wraps it) so the live sim state
  // can be read directly for the opponent's roster - unlike p1's team
  // status, there's no per-turn "request" object for p2 to derive it from.
  private readonly battleStream = new BattleStream()
  private readonly streams = getPlayerStreams(this.battleStream)
  private readonly human: HumanPlayer
  private readonly ai: AIPlayer
  private readonly displayLog: string[] = []
  private readonly logStates: FieldSnapshot[] = []
  // Parallel to displayLog/logStates - see computeFeedbackEvent.
  private readonly feedback: (FeedbackEvent | null)[] = []
  // Parallel to displayLog/logStates - see computeMoveEvent.
  private readonly moveEvents: (MoveEvent | null)[] = []
  private readonly gimmickEvents: (GimmickEvent | null)[] = []
  private readonly textParser = new BattleTextParser('p1')
  private readonly p1team: PokemonSet[]
  private readonly p2team: PokemonSet[]
  private ended = false
  private winner: string | null = null
  private waiter: (() => void) | null = null
  private active: Record<SlotKey, ActivePokemonView | null> = { p1a: null, p1b: null, p2a: null, p2b: null }
  private activeSet: Record<SlotKey, PokemonSet | null> = { p1a: null, p1b: null, p2a: null, p2b: null }
  private switchSeq: Record<SlotKey, number> = { p1a: 0, p1b: 0, p2a: 0, p2b: 0 }
  // The one extra type each Pokemon has picked up (Forest's Curse, Trick-or-Treat).
  // There is only ever one: adding another replaces it.
  private addedType: Record<SlotKey, string | null> = { p1a: null, p1b: null, p2a: null, p2b: null }
  // Held items as they currently stand mid-battle (Knock Off, Thief, Covet,
  // Trick, eaten berries...), keyed by the roster's set. The sets themselves
  // are never touched - the sim only ever sees a packed copy - so every item
  // is back to what it was the moment the battle ends.
  private readonly heldItems = new Map<PokemonSet, string>()
  // Weather, terrain, rooms and timed side conditions currently in play,
  // tracked line by line (see applyFieldEffectLine) so each log line's
  // snapshot shows the right set of them at that moment.
  private effects: FieldEffectView[] = []
  private readonly opponent?: OpponentConfig
  private expGains: ExpGainResult[] = []
  private itemDrops: ItemDropResult[] = []
  private moneyGained = 0
  private caught = false

  constructor(
    p1team: PokemonSet[],
    formatId = 'gen9customgame',
    generationFormat = 'gen9randombattle',
    opponent?: OpponentConfig
  ) {
    if (p1team.length === 0) throw new Error('Cannot start a battle with an empty team')
    this.opponent = opponent
    this.human = new HumanPlayer(this.streams.p1, () => this.wake())
    this.ai = new AIPlayer(this.streams.p2, 'p2', opponent?.difficulty ?? 'easy', (slot, moveId) =>
      this.aiMovePower(slot, moveId)
    )
    this.p1team = p1team
    this.p2team = opponent?.team ?? [generateRandomSingle(generationFormat)]

    void this.human.start()
    void this.ai.start()
    void this.drainOmniscient()

    const spec = { formatid: formatId }
    const p1spec = { name: 'You', team: packTeam(this.p1team) }
    const p2spec = { name: opponent?.name ?? 'Wild', team: packTeam(this.p2team) }

    void this.streams.omniscient.write(
      `>start ${JSON.stringify(spec)}\n` +
        `>player p1 ${JSON.stringify(p1spec)}\n` +
        `>player p2 ${JSON.stringify(p2spec)}`
    )
  }

  private async drainOmniscient(): Promise<void> {
    for await (const chunk of this.streams.omniscient) {
      const lines = chunk.split('\n')
      // The live sim is already at the end of this chunk, so its durations
      // are what's left *after* this chunk's end-of-turn countdown. Anything
      // that starts earlier in the chunk than that countdown is shown with the
      // countdown added back.
      const liveEffects = this.readLiveEffects()
      const lastUpkeepIndex = lines.lastIndexOf('|upkeep')
      for (const [index, line] of lines.entries()) {
        const hpBefore: Record<SlotKey, number | null> = {
          p1a: this.active.p1a?.hpPercent ?? null,
          p1b: this.active.p1b?.hpPercent ?? null,
          p2a: this.active.p2a?.hpPercent ?? null,
          p2b: this.active.p2b?.hpPercent ?? null
        }
        this.applyStateLine(line)
        this.applyFieldEffectLine(line, liveEffects, index < lastUpkeepIndex ? 1 : 0)

        const { args, kwArgs } = BattleTextParser.parseBattleLine(line)
        // The parser would say "Wild won the battle!" - a wild encounter has no
        // trainer to name, so phrase the loss from the player's side instead.
        const rendered =
          line.startsWith('|win|') && !this.opponent?.trainerId && line !== '|win|You'
            ? 'You lost to the wild pokemon!'
            : this.textParser.parseArgs(args, kwArgs) || ''
        const event = computeFeedbackEvent(line)
        const moveEvent = this.computeMoveEvent(line, lines.slice(index + 1))
        const gimmickEvent = computeGimmickEvent(line)
        let eventUsed = false
        for (const textLine of rendered.split('\n')) {
          if (!textLine.trim()) continue
          this.displayLog.push(textLine)
          this.logStates.push(this.snapshotField())
          // A line only ever renders to more than one piece of text when the
          // event itself doesn't apply to a specific line (there isn't one
          // here), so it's attached to the first and left off the rest.
          this.feedback.push(eventUsed ? null : event)
          this.moveEvents.push(eventUsed ? null : moveEvent)
          this.gimmickEvents.push(eventUsed ? null : gimmickEvent)
          eventUsed = true
        }

        this.pushHpDeltaLine(line, hpBefore)

        if (line.startsWith('|win|')) {
          this.ended = true
          this.winner = line.slice('|win|'.length)
          if (this.winner === 'You' && !this.opponent?.noRewards) {
            if (this.opponent?.trainerId) {
              // The cap the fight was held under - read before a boss win raises it.
              const levelCap = getProgression().levelCap
              recordTrainerWin(this.opponent.trainerId, !!this.opponent.isBoss)
              // Bosses are tallied by the progression's own list of beaten bosses.
              if (!this.opponent.isBoss) countStat('trainersDefeated')
              // Per Pokemon on the team they actually sent out, or a flat sum for a
              // boss - either way plus the level cap as a percentage on top.
              this.moneyGained = prizeMoneyFor(!!this.opponent.isBoss, this.p2team.length, levelCap)
              addMoney(this.moneyGained)
            } else {
              countStat('wildDefeated')
            }
            const totalExp = this.p2team.reduce((sum, mon) => sum + expYieldFor(mon.species, mon.level), 0)
            this.expGains = awardExpToTeam(totalExp)
            awardFriendshipToTeam()
            this.itemDrops = this.rollItemDrops()
          }
          this.wake()
        } else if (line === '|tie') {
          this.ended = true
          this.winner = null
          this.wake()
        }
      }
      this.reconcileFieldEffects(liveEffects)
    }
  }

  // The sim's own record of every field effect that has a countdown - the
  // source of truth for durations, since the protocol only says when an effect
  // starts and ends, never how long it has left.
  private readLiveEffects(): FieldEffectView[] {
    const battle = this.battleStream.battle
    if (!battle) return []
    const effects: FieldEffectView[] = []
    const { field } = battle
    if (field.weather) {
      effects.push({
        id: field.weather,
        name: effectDisplayName(field.weather),
        kind: 'weather',
        turnsLeft: field.weatherState.duration || null
      })
    }
    if (field.terrain) {
      effects.push({
        id: field.terrain,
        name: effectDisplayName(field.terrain),
        kind: 'terrain',
        turnsLeft: field.terrainState.duration || null
      })
    }
    for (const [id, state] of Object.entries(field.pseudoWeather)) {
      effects.push({ id, name: effectDisplayName(id), kind: 'field', turnsLeft: state.duration || null })
    }
    battle.sides.forEach((side, i) => {
      for (const [id, state] of Object.entries(side.sideConditions)) {
        if (id in HAZARD_MAX_LAYERS) {
          effects.push({
            id,
            name: effectDisplayName(id),
            kind: 'hazard',
            side: i === 0 ? 'p1' : 'p2',
            turnsLeft: null,
            layers: HAZARD_MAX_LAYERS[id] > 1 ? state.layers : undefined
          })
          continue
        }
        if (!state.duration) continue
        effects.push({
          id,
          name: effectDisplayName(id),
          kind: 'side',
          side: i === 0 ? 'p1' : 'p2',
          turnsLeft: state.duration
        })
      }
    })
    return effects
  }

  private static sameEffect(a: FieldEffectView, b: FieldEffectView): boolean {
    return a.kind === b.kind && a.id === b.id && a.side === b.side
  }

  private startEffect(
    kind: FieldEffectView['kind'],
    id: string,
    liveEffects: FieldEffectView[],
    pendingCountdown: number,
    side?: 'p1' | 'p2'
  ): void {
    const wanted: FieldEffectView = { id, name: effectDisplayName(id), kind, side, turnsLeft: null }
    const live = liveEffects.find((e) => WildBattle.sameEffect(e, wanted))
    // Side conditions are only worth showing while they're counting down -
    // hazards and one-turn guards never are.
    if (kind === 'side' && !live?.turnsLeft) return
    wanted.turnsLeft = live?.turnsLeft != null ? live.turnsLeft + pendingCountdown : null
    this.effects = this.effects.filter((e) => !WildBattle.sameEffect(e, wanted) && !(kind === 'terrain' && e.kind === 'terrain'))
    this.effects.push(wanted)
  }

  private endEffect(kind: FieldEffectView['kind'], id: string, side?: 'p1' | 'p2'): void {
    this.effects = this.effects.filter((e) => !(e.kind === kind && e.id === id && e.side === side))
  }

  // Each layer of a stacking hazard arrives as its own -sidestart, so the
  // count is just how many have been announced (capped at the real maximum).
  private addHazardLayer(id: string, side: 'p1' | 'p2'): void {
    const max = HAZARD_MAX_LAYERS[id]
    const existing = this.effects.find((e) => e.kind === 'hazard' && e.id === id && e.side === side)
    if (existing) {
      if (existing.layers != null) existing.layers = Math.min(max, existing.layers + 1)
      return
    }
    this.effects.push({
      id,
      name: effectDisplayName(id),
      kind: 'hazard',
      side,
      turnsLeft: null,
      layers: max > 1 ? 1 : undefined
    })
  }

  private applyFieldEffectLine(line: string, liveEffects: FieldEffectView[], pendingCountdown: number): void {
    if (!line.startsWith('|')) return
    const parts = line.slice(1).split('|')
    const cmd = parts[0]
    const effectId = (raw: string | undefined): string => toID((raw ?? '').replace(/^move: /, ''))

    if (cmd === '-weather') {
      // "[upkeep]" is just the weather ticking on a turn - already tracked.
      if (parts.includes('[upkeep]')) return
      this.effects = this.effects.filter((e) => e.kind !== 'weather')
      const id = toID(parts[1])
      if (id && id !== 'none') this.startEffect('weather', id, liveEffects, pendingCountdown)
    } else if (cmd === '-fieldstart') {
      const id = effectId(parts[1])
      if (id) this.startEffect(id.endsWith('terrain') ? 'terrain' : 'field', id, liveEffects, pendingCountdown)
    } else if (cmd === '-fieldend') {
      const id = effectId(parts[1])
      this.endEffect(id.endsWith('terrain') ? 'terrain' : 'field', id)
    } else if (cmd === '-sidestart') {
      const side = parts[1]?.startsWith('p2') ? 'p2' : 'p1'
      const id = effectId(parts[2])
      if (id in HAZARD_MAX_LAYERS) this.addHazardLayer(id, side)
      else this.startEffect('side', id, liveEffects, pendingCountdown, side)
    } else if (cmd === '-sideend') {
      const side = parts[1]?.startsWith('p2') ? 'p2' : 'p1'
      const id = effectId(parts[2])
      this.endEffect(id in HAZARD_MAX_LAYERS ? 'hazard' : 'side', id, side)
    } else if (cmd === 'upkeep') {
      this.effects = this.effects.map((e) =>
        e.turnsLeft != null ? { ...e, turnsLeft: Math.max(1, e.turnsLeft - 1) } : e
      )
    }
  }

  // Once a whole chunk has been applied the sim's own numbers are exact again,
  // so anything the line-by-line countdown drifted on is corrected here, and
  // anything that's no longer actually in play is dropped.
  private reconcileFieldEffects(liveEffects: FieldEffectView[]): void {
    this.effects = this.effects.flatMap((e) => {
      const live = liveEffects.find((l) => WildBattle.sameEffect(l, e))
      return live ? [{ ...e, turnsLeft: live.turnsLeft, layers: live.layers }] : []
    })
  }

  private pushHpDeltaLine(line: string, hpBefore: Record<SlotKey, number | null>): void {
    if (!line.startsWith('|-damage|') && !line.startsWith('|-heal|')) return
    const parts = line.slice(1).split('|')
    const slotKey = slotKeyFromIdent(parts[1])
    if (!slotKey) return

    const before = hpBefore[slotKey]
    const after = this.active[slotKey]?.hpPercent
    if (before == null || after == null || before === after) return

    const delta = after - before
    const name = this.textParser.pokemon(parts[1])
    const text = delta > 0 ? `  ${name} restored ${delta}% HP.` : `  ${name} lost ${-delta}% HP.`
    this.displayLog.push(text)
    this.logStates.push(this.snapshotField())
    this.feedback.push(null)
    this.moveEvents.push(null)
    this.gimmickEvents.push(null)
  }

  private snapshotField(): FieldSnapshot {
    // Each Pokemon's current stats are worked out here, at the moment of the
    // snapshot, so they match that log line's boosts, status, item and field.
    const clone = (v: ActivePokemonView | null, side: 'p1' | 'p2'): ActivePokemonView | null =>
      v ? { ...v, boosts: { ...v.boosts }, volatiles: [...v.volatiles], effectiveStats: effectiveStatsFor(v, side, this.effects) } : null
    return {
      p1: [clone(this.active.p1a, 'p1'), clone(this.active.p1b, 'p1')],
      p2: [clone(this.active.p2a, 'p2'), clone(this.active.p2b, 'p2')],
      effects: this.effects.map((e) => ({ ...e }))
    }
  }

  private buildActiveView(
    species: string,
    hpPercent: number,
    fainted: boolean,
    status: string | null,
    set: PokemonSet | null,
    switchSeq = 0
  ): ActivePokemonView {
    const summary = buildPokemonSummary(species, set)
    return {
      ...summary,
      baseTypes: [...summary.types],
      item: set ? (this.heldItems.get(set) ?? set.item) : '',
      hpPercent,
      fainted,
      status,
      substituted: false,
      protecting: false,
      terastallized: null,
      // A Mega that switches back in is already one - its species name says so.
      megaEvolved: MEGA_FORME.test(species),
      boosts: {},
      volatiles: [],
      switchSeq
    }
  }

  private buildTeamView(): ActivePokemonView[] {
    const request = this.human.latestRequest
    if (!request) return []
    return request.side.pokemon.map((mon) => {
      // side.pokemon isn't in fixed roster order - it's reordered so the
      // currently active Pokemon comes first - so match by species instead
      // of position, same as switch/drag tracking does.
      const species = mon.details.split(',')[0].trim()
      const { hpPercent, fainted, status } = parseCondition(mon.condition)
      const rosterIndex = findRosterIndex(this.p1team, species)
      const set = rosterIndex >= 0 ? this.p1team[rosterIndex] : null
      return this.buildActiveView(species, hpPercent, fainted, status, set)
    })
  }

  // Unlike p1, the opponent has no per-turn "request" to read fainted/status
  // off of, so this reads the live sim object's side.pokemon directly - which
  // reorders exactly like request.side.pokemon does (the currently active
  // Pokemon is kept at the front, swapping position with whoever switches in),
  // so each entry's own species is read off itself rather than matched
  // positionally against p2team, same as buildTeamView does for the player's
  // own team.
  private opponentRoster(): RosterSlotView[] {
    const side = this.battleStream.battle?.sides[1]
    if (!side) return this.p2team.map((mon) => ({ species: mon.species, fainted: false, status: null }))
    return side.pokemon.map((mon) => ({
      species: mon.species?.name ?? mon.name,
      fainted: mon.fainted,
      status: mon.status || null
    }))
  }

  // Independent rolls, each all-or-nothing against its own chance: any configured
  // drops (a trainer's own, their current team's, or a wild species' one), then
  // the optional random-item roll.
  private rollItemDrops(): ItemDropResult[] {
    const catalog = new Map(getEditorOptions().items.map((i) => [i.id, i]))
    const results: ItemDropResult[] = []
    const teamDrop = this.opponent?.teamDrop
    for (const drop of [...(this.opponent?.drops ?? []), ...(teamDrop ? [teamDrop] : [])]) {
      if (!drop.itemId || drop.chance <= 0) continue
      if (Math.random() * 100 >= drop.chance) continue
      const item = catalog.get(drop.itemId)
      if (!item) continue
      addItem(item.id, 1)
      results.push({ itemId: item.id, itemName: item.name, spritenum: item.spritenum })
    }
    const randomChance = this.opponent?.randomDropChance ?? 0
    if (randomChance > 0 && Math.random() * 100 < randomChance) {
      const pool = getWildDropPool()
      const item = pool[Math.floor(Math.random() * pool.length)]
      addItem(item.id, 1)
      results.push({ itemId: item.id, itemName: item.name, spritenum: item.spritenum })
    }
    return results
  }

  // Spends a Poke Ball if the bag has one, otherwise pays its price directly
  // (no need to visit the shop first) - either way an exact copy of the
  // defeated wild Pokemon (no held item) joins the box. Only a genuine wild
  // encounter (no trainerId) that the player just won can be caught, and
  // only once per battle.
  catchWildPokemon(): CatchResult {
    if (!this.ended || this.winner !== 'You') throw new Error('You have not won this battle yet')
    if (this.opponent?.trainerId) throw new Error('Only a wild Pokemon can be caught')
    if (this.caught) throw new Error('This Pokemon has already been caught')
    if (hasItem(DEFAULT_POKEBALL_ID)) {
      removeItem(DEFAULT_POKEBALL_ID, 1)
    } else {
      const price = pokeballPrice()
      if (!spendMoney(price)) throw new Error(`Not enough money to buy a Poke Ball (need ${price})`)
    }
    addCaughtMon(this.p2team[0])
    this.caught = true
    countStat('wildCaught')
    return { money: getMoney(), pokeballs: getItemQuantity(DEFAULT_POKEBALL_ID) }
  }

  // Only a wild encounter can be fled - there's no reward, exp or catch for a
  // battle you walked away from, and the battle is simply abandoned.
  assertCanRun(): void {
    if (this.opponent?.trainerId) throw new Error("You can't run from a trainer battle")
  }

  // Which slot(s) a spread move hits, given who's actually out and alive right
  // now - the protocol's own |move| line only ever names one "chosen" target,
  // even for a move that hits everyone adjacent, so this reads the move's own
  // target type to fill in the rest (mirrors the renderer's targetOptionsFor,
  // which does the same for the player's own target-picker).
  private spreadTargetSlots(attackerSlot: SlotKey, targetType: string): SlotKey[] {
    const side = attackerSlot.startsWith('p1') ? 'p1' : 'p2'
    const foeSide = side === 'p1' ? 'p2' : 'p1'
    const allySlot = (attackerSlot === `${side}a` ? `${side}b` : `${side}a`) as SlotKey
    const foeSlots = [`${foeSide}a`, `${foeSide}b`] as SlotKey[]
    const alive = (s: SlotKey): boolean => !!this.active[s] && !this.active[s]!.fainted
    if (targetType === 'allAdjacentFoes') return foeSlots.filter(alive)
    if (targetType === 'allAdjacent') return [...foeSlots, allySlot].filter(alive)
    return []
  }

  // The move-animation layer's cue for one |move| line, or null for anything
  // else (including a move with no known animation - see moveAnimations.ts on
  // the renderer side, which the id alone lets it look up lazily).
  private computeMoveEvent(line: string, following: string[]): MoveEvent | null {
    if (!line.startsWith('|move|')) return null
    const parts = line.slice(1).split('|')
    const attackerSlot = slotKeyFromIdent(parts[1])
    if (!attackerSlot) return null
    const moveId = toID(parts[2])
    const targetType = getMoveInfo(moveId)?.target ?? 'normal'
    const spread = this.spreadTargetSlots(attackerSlot, targetType)
    const namedTarget = slotKeyFromIdent(parts[3])
    const targetSlots = spread.length > 0 ? spread : namedTarget ? [namedTarget] : targetType === 'self' ? [attackerSlot] : []
    // Who it missed: the sim reports each as a -miss line after the move (one per
    // target, for a spread move), and a single-target miss also tags the move line.
    const missedSlots = new Set<SlotKey>()
    if (parts.includes('[miss]') && namedTarget) missedSlots.add(namedTarget)
    for (const next of following) {
      if (next.startsWith('|move|') || next.startsWith('|turn|') || next === '|upkeep') break
      if (!next.startsWith('|-miss|')) continue
      const missed = slotKeyFromIdent(next.slice(1).split('|')[2])
      if (missed) missedSlots.add(missed)
    }
    return { moveId, attackerSlot, targetSlots, missedSlots: [...missedSlots] }
  }

  private applyStateLine(line: string): void {
    if (!line.startsWith('|')) return
    const parts = line.slice(1).split('|')
    const cmd = parts[0]

    // A new turn - not about any one slot, so it's handled before the
    // slot-based dispatch below. A Protect-family move only ever shields for
    // the rest of the turn it was used on, same as the "singleturn" volatile
    // it mirrors, so this is also where that shield comes back down.
    if (cmd === 'turn') {
      for (const key of ['p1a', 'p1b', 'p2a', 'p2b'] as SlotKey[]) {
        const mon = this.active[key]
        if (!mon) continue
        mon.protecting = false
        mon.volatiles = mon.volatiles.filter((b) => !SINGLE_TURN_IDS.has(b.id))
      }
      return
    }

    const handled = [
      'switch',
      'drag',
      'replace',
      'detailschange',
      '-formechange',
      '-transform',
      '-damage',
      '-heal',
      'faint',
      '-status',
      '-curestatus',
      '-boost',
      '-unboost',
      '-setboost',
      '-clearboost',
      '-clearallboost',
      '-clearpositiveboost',
      '-clearnegativeboost',
      '-item',
      '-enditem',
      '-start',
      '-end',
      '-singleturn',
      '-singlemove',
      '-activate',
      '-mustrecharge',
      'move',
      'cant',
      '-terastallize',
      '-mega',
      '-burst',
      '-primal'
    ]
    if (!handled.includes(cmd)) return

    const slotKey = slotKeyFromIdent(parts[1])
    if (!slotKey) return
    const side = slotKey.startsWith('p1') ? 'p1' : 'p2'

    if (cmd === 'switch' || cmd === 'drag') {
      const species = parts[2].split(',')[0].trim()
      const { hpPercent, fainted, status } = parseCondition(parts[3])
      const team = side === 'p1' ? this.p1team : this.p2team
      const rosterIndex = findRosterIndex(team, species)
      const set = rosterIndex >= 0 ? team[rosterIndex] : null
      this.switchSeq[slotKey]++
      this.addedType[slotKey] = null
      this.active[slotKey] = this.buildActiveView(species, hpPercent, fainted, status, set, this.switchSeq[slotKey])
      // A wild battle is the one with no trainer (trainerId) on the other side.
      if (side === 'p2' && !this.opponent?.trainerId) this.active[slotKey]!.caughtBefore = hasRegisteredSpecies(species)
      // Terastallizing lasts the whole battle: one that switches back in says so in its details.
      const tera = /(?:^|, )tera:([A-Za-z]+)/.exec(parts[2])?.[1]
      if (tera) {
        this.active[slotKey]!.terastallized = tera
        if (tera !== 'Stellar') this.active[slotKey]!.types = [tera]
      }
      this.activeSet[slotKey] = set
      return
    }

    const current = this.active[slotKey]
    if (!current) return

    if (cmd === 'replace' || cmd === 'detailschange' || cmd === '-formechange') {
      // Illusion revealing the real Pokemon, a permanent forme change (Mega/Primal/
      // Ultra Burst), or a temporary one (Mimikyu's Disguise breaking, Zen Mode, Shields
      // Down, etc.) - the battler itself doesn't change, just its displayed species.
      const set = this.activeSet[slotKey]
      current.species = parts[2].split(',')[0].trim()
      const { types, stats } = speciesStatsAndTypes(current.species, set)
      current.types = types
      current.baseTypes = [...types]
      this.addedType[slotKey] = null
      current.stats = stats
    } else if (cmd === '-transform') {
      // The target's ident (e.g. "p2a: Ditto"), not a species name - look up what
      // that slot's Pokemon currently looks like and copy its appearance.
      const targetSlotKey = slotKeyFromIdent(parts[2])
      const target = targetSlotKey ? this.active[targetSlotKey] : null
      if (target) {
        current.species = target.species
        current.types = target.types
        current.baseTypes = [...target.types]
        this.addedType[slotKey] = null
        current.stats = { ...target.stats, hp: current.stats.hp }
      }
    } else if (cmd === '-damage' || cmd === '-heal') {
      const { hpPercent, fainted, status } = parseCondition(parts[2])
      current.hpPercent = hpPercent
      current.fainted = fainted
      current.status = status
    } else if (cmd === 'faint') {
      current.hpPercent = 0
      current.fainted = true
      current.volatiles = []
    } else if (cmd === '-status') {
      current.status = parts[2]
    } else if (cmd === '-curestatus') {
      current.status = null
    } else if (cmd === '-boost' || cmd === '-unboost') {
      const stat = parts[2] as BoostStat
      if (!BOOST_STATS.includes(stat)) return
      const amount = Number(parts[3]) * (cmd === '-unboost' ? -1 : 1)
      current.boosts[stat] = (current.boosts[stat] ?? 0) + amount
    } else if (cmd === '-setboost') {
      const stat = parts[2] as BoostStat
      if (!BOOST_STATS.includes(stat)) return
      current.boosts[stat] = Number(parts[3])
    } else if (cmd === '-clearboost' || cmd === '-clearallboost') {
      current.boosts = {}
    } else if (cmd === '-clearpositiveboost') {
      for (const stat of BOOST_STATS) {
        if ((current.boosts[stat] ?? 0) > 0) delete current.boosts[stat]
      }
    } else if (cmd === '-clearnegativeboost') {
      for (const stat of BOOST_STATS) {
        if ((current.boosts[stat] ?? 0) < 0) delete current.boosts[stat]
      }
    } else if (cmd === '-item') {
      this.setHeldItem(slotKey, parts[2])
      const from = parts.find((p) => p.startsWith('[from] '))
      const of = parts.find((p) => p.startsWith('[of] '))
      if (from && of && ITEM_TAKEN_FROM_OF.has(from)) {
        const victim = slotKeyFromIdent(of.slice('[of] '.length))
        if (victim) this.setHeldItem(victim, '')
      }
    } else if (cmd === '-enditem') {
      this.setHeldItem(slotKey, '')
    } else if (cmd === '-start') {
      // Most -start lines are other things (confusion, ...); a change of type
      // matters here (Soak, Reflect Type and Color Change replace the types,
      // Forest's Curse and Trick-or-Treat add one), and so does Substitute.
      if (parts[2] === 'typechange' && parts[3]) {
        current.types = parts[3].split('/')
        this.addedType[slotKey] = null
      } else if (parts[2] === 'typeadd' && parts[3] && !current.types.includes(parts[3])) {
        const previous = this.addedType[slotKey]
        current.types = [...current.types.filter((t) => t !== previous), parts[3]]
        this.addedType[slotKey] = parts[3]
      } else if (parts[2] === 'Substitute') {
        current.substituted = true
      } else {
        const badge = badgeFor(parts[2], parts[3])
        if (badge) current.volatiles = withBadge(current.volatiles, badge)
      }
    } else if (cmd === '-end') {
      if (parts[2] === 'Substitute') current.substituted = false
      // A trap ends under the move's name ("Wrap"), tagged [partiallytrapped].
      current.volatiles = parts.includes('[partiallytrapped]')
        ? withoutBadge(current.volatiles, 'partiallytrapped')
        : withoutBadge(current.volatiles, parts[2])
    } else if (cmd === '-singlemove') {
      const badge = badgeFor(parts[2])
      if (badge) current.volatiles = withBadge(current.volatiles, badge)
    } else if (cmd === '-activate') {
      // Wrap, Fire Spin and the like announce their trap this way; Mean Look & co. as "trapped".
      const id = effectId(parts[2])
      const badge = PARTIAL_TRAP_MOVES.has(id) ? badgeFor('partiallytrapped') : id === 'trapped' ? badgeFor('trapped') : null
      if (badge) current.volatiles = withBadge(current.volatiles, badge)
    } else if (cmd === '-mustrecharge') {
      current.volatiles = withBadge(current.volatiles, badgeFor('mustrecharge')!)
    } else if (cmd === 'cant') {
      if (parts[2] === 'recharge') current.volatiles = withoutBadge(current.volatiles, 'mustrecharge')
    } else if (cmd === 'move') {
      // Destiny Bond, Grudge and the like only last until its next move.
      current.volatiles = current.volatiles.filter((b) => !SINGLE_MOVE_IDS.has(b.id))
    } else if (cmd === '-singleturn') {
      // Every Protect-family move announces this the same way, whichever one
      // it actually was - either "Protect" (Spiky Shield, King's Shield, ...)
      // or "move: Protect" (Protect/Detect themselves).
      if (parts[2] === 'Protect' || parts[2] === 'move: Protect') current.protecting = true
      else {
        const badge = badgeFor(parts[2])
        if (badge) current.volatiles = withBadge(current.volatiles, badge)
      }
    } else if (cmd === '-mega' || cmd === '-burst' || cmd === '-primal') {
      current.megaEvolved = true
    } else if (cmd === '-terastallize') {
      current.terastallized = parts[2] || null
      // Stellar keeps the Pokemon's own types; any other Tera type replaces them.
      if (parts[2] && parts[2] !== 'Stellar') {
        current.types = [parts[2]]
        this.addedType[slotKey] = null
      }
    }
  }

  private setHeldItem(slotKey: SlotKey, item: string): void {
    const set = this.activeSet[slotKey]
    if (set) this.heldItems.set(set, item)
    const view = this.active[slotKey]
    if (view) view.item = item
  }

  private wake(): void {
    const waiter = this.waiter
    this.waiter = null
    waiter?.()
  }

  private waitForUpdate(sinceVersion: number): Promise<void> {
    if (this.ended || this.human.version !== sinceVersion || this.human.lastError) return Promise.resolve()
    return new Promise((resolve) => {
      this.waiter = resolve
    })
  }

  async getInitialView(): Promise<BattleView> {
    await this.waitForUpdate(0)
    return this.view()
  }

  async submitChoice(choice: string): Promise<BattleView> {
    const versionBeforeChoice = this.human.version
    this.human.lastError = null
    this.human.choose(choice)
    await this.waitForUpdate(versionBeforeChoice)
    // (Read through a cast: the compiler still thinks it is the null assigned above.)
    const refused = this.human.lastError as Error | null
    if (refused) {
      // The sim rejected it and is still waiting, so the same turn can simply be chosen again.
      this.human.lastError = null
      throw new Error(refused.message.replace(/^\[[^\]]*\]\s*/, ''))
    }
    return this.view()
  }

  // The AI's side of liveMovePowers: what one of its active Pokemon's moves would
  // really hit for against the player's Pokemon out right now. Nearly everything
  // these power rules look at is on the field for both players to see (HP, status,
  // fainted teammates, weight); the exceptions are small - Knock Off knows whether
  // the foe holds an item, Gyro Ball / Electro Ball use the real Speed stats.
  private aiMovePower(slot: number, moveId: string): AiMovePower | null {
    const battle = this.battleStream.battle
    const source = battle?.sides[1].active[slot]
    if (!battle || !source || source.fainted) return null
    // Fake Out and friends fail once the Pokemon has already used a move since it
    // came out (the sim counts this one too when it runs, hence > 1 there, > 0 here).
    if (FIRST_TURN_ONLY_MOVES.has(moveId) && source.activeMoveActions > 0) {
      return { basePower: null, fixedDamagePercent: null, fails: true }
    }
    const foes = battle.sides[0].active.filter((p): p is SimPokemon => !!p && !p.fainted)
    const live = liveMovePower(battle, source, foes, moveId)
    if (live.fixedDamage !== null && foes[0]) {
      return { basePower: null, fixedDamagePercent: Math.min(100, (live.fixedDamage / foes[0].maxhp) * 100) }
    }
    // A damage rule that can't be worked out ahead of time (Counter, Mirror Coat,
    // Metal Burst) - nothing to count on, same as its printed 0 power.
    if (live.dynamic && !live.varies && live.basePower === null) return { basePower: 0, fixedDamagePercent: null }
    return { basePower: live.basePower, fixedDamagePercent: null }
  }

  // For the switch list: the best multiplier each team member's own types get against
  // each foe out right now (its current types - Tera and the like included).
  private teamMatchups(team: ActivePokemonView[]): (number | null)[][] {
    const foes = [this.active.p2a, this.active.p2b]
    return team.map((member) =>
      foes.map((foe) =>
        member.fainted || !foe || foe.fainted
          ? null
          : Math.max(...member.types.map((type) => getTypeEffectivenessMultiplier(type, foe.types)))
      )
    )
  }

  // The other way round: the worst multiplier each foe's types get against each team
  // member - by type alone, like everything else here (no Levitate and such).
  private teamDefense(team: ActivePokemonView[]): (number | null)[][] {
    const foes = [this.active.p2a, this.active.p2b]
    return team.map((member) =>
      foes.map((foe) =>
        member.fainted || !foe || foe.fainted
          ? null
          : Math.max(...foe.types.map((type) => getTypeEffectivenessMultiplier(type, member.types)))
      )
    )
  }

  // Each of the player's moves' type effectiveness against each foe slot, for the
  // move buttons and the doubles target picker - same shape as liveMovePowers.
  private moveEffectivenessView(): (Record<string, (number | null)[]> | null)[] {
    const battle = this.battleStream.battle
    const request = this.human.latestRequest
    if (this.ended || !battle || !request || !('active' in request) || !request.active) return []
    const foeSlots = [0, 1].map((i) => battle.sides[1].active[i] ?? null)
    return request.active.map((activeData, i) => {
      const source = battle.sides[0].active[i]
      if (!source || source.fainted) return null
      const byMove: Record<string, (number | null)[]> = {}
      for (const move of activeData.moves) {
        byMove[move.id] = foeSlots.map((foe) =>
          foe && !foe.fainted ? moveTypeEffectiveness(battle, source, foe, move.id) : null
        )
      }
      return byMove
    })
  }

  // What each of the player's moves would hit for right now, asked of the battle
  // itself while a choice is being made.
  private liveMovePowers(): (Record<string, LiveMovePower> | null)[] {
    const battle = this.battleStream.battle
    const request = this.human.latestRequest
    if (this.ended || !battle || !request || !('active' in request) || !request.active) return []
    const foes = battle.sides[1].active.filter((p): p is SimPokemon => !!p && !p.fainted)
    return request.active.map((activeData, i) => {
      const source = battle.sides[0].active[i]
      if (!source || source.fainted) return null
      const powers: Record<string, LiveMovePower> = {}
      for (const move of activeData.moves) powers[move.id] = liveMovePower(battle, source, foes, move.id)
      return powers
    })
  }

  private view(): BattleView {
    const team = this.buildTeamView()
    const field = this.snapshotField()
    const opponentTrainer: TrainerBattleInfo | null = this.opponent?.trainerId
      ? { name: this.opponent.name, spriteId: this.opponent.spriteId ?? '' }
      : null
    return {
      log: [...this.displayLog],
      logStates: [...this.logStates],
      feedback: [...this.feedback],
      moveEvents: [...this.moveEvents],
      gimmickEvents: [...this.gimmickEvents],
      request: this.ended ? null : this.human.latestRequest,
      ended: this.ended,
      winner: this.winner,
      expGains: this.expGains,
      itemDrops: this.itemDrops,
      moneyGained: this.moneyGained,
      p1: field.p1,
      p2: field.p2,
      team,
      teamMatchups: this.teamMatchups(team),
      teamDefense: this.teamDefense(team),
      movePowers: this.liveMovePowers(),
      moveEffectiveness: this.moveEffectivenessView(),
      opponentTrainer,
      opponentRoster: this.opponentRoster(),
      rewards: this.rewardsView()
    }
  }

  // Everything rollItemDrops (and the prize money) could pay out for winning,
  // with each chance - shown when hovering the opponent.
  private rewardsView(): BattleRewardsView | null {
    const opponent = this.opponent
    if (opponent?.noRewards) return null
    const catalog = new Map(getEditorOptions().items.map((i) => [i.id, i]))
    const items: RewardItemView[] = []
    const add = (drop: ItemDropConfig | undefined, source: RewardItemView['source']): void => {
      const item = drop?.itemId ? catalog.get(drop.itemId) : undefined
      if (!item || !drop || drop.chance <= 0) return
      items.push({ itemId: item.id, itemName: item.name, spritenum: item.spritenum, chance: drop.chance, source })
    }
    for (const drop of opponent?.drops ?? []) add(drop, opponent?.trainerId ? 'trainer' : 'wild')
    add(opponent?.teamDrop, 'team')
    return {
      money: opponent?.trainerId
        ? prizeMoneyFor(!!opponent.isBoss, this.p2team.length, getProgression().levelCap)
        : null,
      items,
      randomDropChance: opponent?.randomDropChance ?? 0
    }
  }
}
