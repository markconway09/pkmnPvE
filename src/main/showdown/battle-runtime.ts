import type { Streams } from 'pokemon-showdown'
import type { ChoiceRequest } from 'pokemon-showdown/dist/sim/side.js'
import './vendor/battle-text-data'
import { BattleTextParser } from './vendor/battle-text-parser'
import {
  BattlePlayer,
  BattleStream,
  abilityName,
  buildPokemonSummary,
  effectDisplayName,
  formeAbility,
  findRosterIndex,
  sameBaseSpecies,
  generateRandomSingle,
  getEditorOptions,
  getMoveInfo,
  getPlayerStreams,
  getTypeEffectivenessMultiplier,
  getWildDropPool,
  liveMovePower,
  liveMoveType,
  moveTypeEffectiveness,
  packTeam,
  getItemSpritenum,
  heldItemForme,
  gmaxLookOf,
  parseCondition,
  pokeballPrice,
  speciesStatsAndTypes,
  speciesRarityTier,
  mergeGrowthFor,
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
import type { Battle as SimBattle } from 'pokemon-showdown/dist/sim/battle.js'
import {
  LEECH_SEED_DRAIN_EVENT,
  RAID_ATTACKS_PER_TURN,
  RAID_HP_MULTIPLIER,
  mergeStatMultiplier,
  raidSoftCappedDamage
} from '../../shared/battle-types'
import type { OpponentModifiersView, RaidView, WildLocationId } from '../../shared/battle-types'
import { armTmQuickCheck, grantRewardTms, unownedRewardTms } from './tm-store'
import type { TmInfo } from '../../shared/tms'
import { RAID_PLACEHOLDER_NAME, raidPlaceholderSet } from './raid'
import { RAID_LEADER_EXTRA_COPIES } from '../../shared/titles'
import { countAchievement } from './achievement-progress'
import { recordMission } from './mission-store'
import { AIPlayer, type AiMovePower } from './battle-ai'

// Moves that only work on the user's first turn after coming out.
const FIRST_TURN_ONLY_MOVES = new Set(['fakeout', 'firstimpression', 'matblock'])
import { getProgression, recordTrainerWin } from './progression-store'
import { addCaughtMon, awardExpToTeam, awardFriendshipToTeam, hasRegisteredSpecies } from './box-store'
import { addItem, getItemQuantity, hasItem, removeItem } from './bag-store'
import { addMoney, getMoney, spendMoney } from './money-store'
import { countStat } from './stats-store'
import { expYieldFor } from './exp'
import {
  addRunCatch,
  finishRunBattleFled,
  finishRunBattleLost,
  finishRunBattleWon,
  type RunBattleOutcome
} from './run-store'
import { finishDraftBattle } from './draft-store'
import { breakDexNavChain, extendDexNavChain } from './dexnav-store'
import type { DraftBattleResult } from '../../shared/draft'
import {
  CATCHING_CHARM_FREE_CHANCE,
  CATCHING_CHARM_ITEM_ID,
  ITEM_CHARM_DROP_MULTIPLIER,
  ITEM_CHARM_ITEM_ID
} from '../../shared/battle-types'
import {
  DEFAULT_POKEBALL_ID,
  EXP_CHARM_ITEM_ID,
  EXP_CHARM_MULTIPLIER,
  RARE_CANDY_ITEM_ID,
  TRAINER_RUN_COST,
  prizeMoneyFor
} from '../../shared/battle-types'
import {
  ACE_TRAINER_MONEY_MULTIPLIER,
  BADGE_COLLECTOR_CANDY_CHANCE,
  COLLECTOR_FREE_CATCH_CHANCE,
  VETERAN_EXP_MULTIPLIER
} from '../../shared/titles'
import { hasTitle, shopPrice } from './title-perks'
import type {
  ActivePokemonView,
  AiDifficulty,
  BoostStat,
  StatBlock,
  BattleView,
  BattleRewardsView,
  CatchResult,
  ExpGainResult,
  AbilityEvent,
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
  RunNodeKind,
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
    return slot && { slot, label: 'Critical hit!', tone: 'bad', emphasis: 'crit' }
  }
  // "It hurt itself in its confusion!"
  if (cmd === '-damage' && parts.includes('[from] confusion')) {
    const slot = slotKeyFromIdent(parts[1])
    return slot && { slot, label: 'Hurt itself!', tone: 'bad', emphasis: 'confusion' }
  }
  // A burn or poison (bad poison too - the sim calls both "psn" here) hurting it at the end of the turn.
  if (cmd === '-damage' && parts.includes('[from] brn')) {
    const slot = slotKeyFromIdent(parts[1])
    return slot && { slot, label: 'Hurt by its burn', tone: 'bad', emphasis: 'burn' }
  }
  if (cmd === '-damage' && parts.includes('[from] psn')) {
    const slot = slotKeyFromIdent(parts[1])
    return slot && { slot, label: 'Hurt by poison', tone: 'bad', emphasis: 'poison' }
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
    if (slot && parts[2] === 'flinch') return { slot, label: 'Flinched!', tone: 'bad', emphasis: 'flinch' }
    // "It's paralyzed! It can't move!"
    if (slot && parts[2] === 'par') return { slot, label: 'Fully paralyzed!', tone: 'bad', emphasis: 'paralysis' }
    // "It's fast asleep." / "It's frozen solid!"
    if (slot && parts[2] === 'slp') return { slot, label: 'Fast asleep', tone: 'bad', emphasis: 'sleep' }
    if (slot && parts[2] === 'frz') return { slot, label: 'Frozen solid!', tone: 'bad', emphasis: 'freeze' }
  }
  if (cmd === '-activate') {
    const slot = slotKeyFromIdent(parts[1])
    if (!slot) return null
    const effect = parts[2] ?? ''
    if (effect === 'confusion') return { slot, label: 'Confused', tone: 'neutral', emphasis: 'confusion' }
    if (effect === 'item: Sturdy') return { slot, label: 'Endured', tone: 'good' }
    if (effect.startsWith('move: ')) {
      const moveId = toID(effect.slice('move: '.length))
      if (moveId === 'endure') return { slot, label: 'Endured', tone: 'good' }
      if (PROTECT_MOVE_IDS.has(moveId)) return { slot, label: 'Protected', tone: 'good' }
    }
  }
  return null
}

// Which Pokemon's ability this line shows working, like Showdown's ability pop-up: a
// -ability line, an -activate/-block/-immune naming "ability: X", or anything
// "[from] ability: X". The one with the ability is the [of] Pokemon when there is one
// (Rough Skin, Static and Drizzle name the Pokemon they hit or come from) - except a
// heal, where [of] is who it absorbed the move from (Volt Absorb, Water Absorb).
function computeAbilityEvent(line: string): AbilityEvent | null {
  if (!line.startsWith('|')) return null
  const parts = line.slice(1).split('|')
  const cmd = parts[0]
  if (parts.includes('[silent]')) return null
  const withAbility = (ident: string | undefined, ability: string): AbilityEvent | null => {
    const slot = slotKeyFromIdent(ident)
    const pokemon = ident?.split(': ')[1]
    return slot && pokemon && ability ? { slot, pokemon, ability } : null
  }
  if (cmd === '-ability') return withAbility(parts[1], parts[2])
  const named = parts.slice(2).find((p) => p.startsWith('ability: '))
  if (named && (cmd === '-activate' || cmd === '-block' || cmd === '-immune')) {
    return withAbility(parts[1], named.slice('ability: '.length))
  }
  const from = parts.find((p) => p.startsWith('[from] ability: '))
  if (!from) return null
  const of = parts.find((p) => p.startsWith('[of] '))?.slice('[of] '.length)
  const holder = cmd === '-heal' || !of ? parts[1] : of
  return withAbility(holder, from.slice('[from] ability: '.length))
}

// A held item doing something on this line, for the same banner as an ability (with the
// item's icon): anything "[from] item: X" (Leftovers, Life Orb, Rocky Helmet - whose
// holder is the [of] Pokemon - Black Sludge, Flame Orb...), an item used up or eaten
// (-enditem: Focus Sash, a berry, a popped Air Balloon, Weakness Policy), one announcing
// itself (-item: Air Balloon) or an -activate naming "item: X" (Quick Claw). Not an item
// taken by a move (Knock Off, Thief, Trick) or revealed by an ability (Frisk - that's the
// ability's own banner).
function computeItemEvent(line: string): AbilityEvent | null {
  if (!line.startsWith('|')) return null
  const parts = line.slice(1).split('|')
  const cmd = parts[0]
  if (parts.includes('[silent]')) return null
  const withItem = (ident: string | undefined, item: string | undefined): AbilityEvent | null => {
    const slot = slotKeyFromIdent(ident)
    const pokemon = ident?.split(': ')[1]
    if (!slot || !pokemon || !item) return null
    return { slot, pokemon, ability: item, itemSpritenum: getItemSpritenum(item) ?? undefined }
  }
  const fromMoveOrAbility = parts.some((p) => p.startsWith('[from] move:') || p.startsWith('[from] ability:'))
  if (cmd === '-enditem' || cmd === '-item') {
    if (fromMoveOrAbility || parts.includes('[from] stealeat')) return null
    return withItem(parts[1], parts[2])
  }
  if (cmd === '-activate') {
    const named = parts.slice(2).find((p) => p.startsWith('item: '))
    if (named) return withItem(parts[1], named.slice('item: '.length))
  }
  const from = parts.find((p) => p.startsWith('[from] item: '))
  if (!from) return null
  // A healing item is the healed Pokemon's own - Shell Bell's [of] names the Pokemon it hit,
  // not its holder. Otherwise [of] is the holder (Rocky Helmet hurting the attacker).
  const of = parts.find((p) => p.startsWith('[of] '))?.slice('[of] '.length)
  return withItem(cmd === '-heal' || !of ? parts[1] : of, from.slice('[from] item: '.length))
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
  // A boss rematch (the menu once every boss is beaten): exp and drops, but no prize money.
  noPrizeMoney?: boolean
  // Percent chance of one extra drop picked at random from the whole item pool.
  randomDropChance?: number
  // A wild Pokemon woken by a noisy TM search: no running from it.
  noRun?: boolean
  // The DexNav's hunted Pokemon: beating it grows the chain, running or losing breaks it.
  dexNavHunt?: boolean
  // A friendly match (another player's saved team): winning gives no exp, money,
  // friendship, item drops or boss progress.
  noRewards?: boolean
  // A Roguelite run's battle (see run-store): the run's team goes in with the HP and
  // status it had (one entry per team member, in order), and how it ends goes back
  // to the run - never to the box, bag, money, stats or boss progress.
  run?: { conditions: { hp: number; status: string | null }[]; kind: RunNodeKind }
  // A Draft mode battle (see draft-store): no running, and the win or loss goes to the
  // draft's record - never to exp, money, drops or boss progress.
  draft?: boolean
  // A Max Raid: the one opponent is Dynamaxed all battle (Gigantamax if it can) and
  // joins the box when beaten - no Poke Ball needed.
  raid?: { gigantamax: boolean; stars: number }
  // A Classic wild battle's area: winning it offers a quick check for a TM from there
  // (with the Scanner).
  location?: WildLocationId
  // A trainer's TMs, given on a win (only the ones not owned yet).
  tmRewards?: string[]
  // Weather and terrain up from the first turn (a boss's Field setting, or a wild
  // area's chance of weather) - lasting until a move or ability replaces them.
  // Trick Room lasts until someone uses Trick Room. Chaos drafts can add side conditions
  // to either side (Tailwind, screens, hazards - their usual turn counts), and drop a
  // side's lead's Attack by one stage (0 = the player's side, 1 = the opponent's).
  startField?: {
    weather?: string | null
    terrain?: string | null
    trickRoom?: boolean
    sideConditions?: { side: 0 | 1; id: string; layers?: number }[]
    leadAtkDrop?: (0 | 1)[]
  }
  // Chaos drafts: each side's Pokemon's stat multipliers, in team order.
  statMultipliers?: { p1?: StatBlock[]; p2?: StatBlock[] }
  // Chaos drafts: the opponent's modifiers in words, for the tooltip on them.
  chaosModifiers?: OpponentModifiersView
  // An online match with a friend: they play the other side from their own copy of the
  // game (see online.ts in the renderer), so no AI drives it - this copy just runs the
  // battle for both. `name`/`spriteId` above are the friend's; these are the host's own.
  online?: { hostName: string; hostSpriteId: string }
}

// The friend's own copy of the battle log in an online match: the same lines told from
// their side (their Pokemon are theirs, the host's are "the opposing" ones), with every
// snapshot and slot flipped so their side is the one drawn at the bottom of their screen.
interface MirroredLog {
  parser: BattleTextParser
  log: string[]
  logStates: FieldSnapshot[]
  feedback: (FeedbackEvent | null)[]
  moveEvents: (MoveEvent | null)[]
  gimmickEvents: (GimmickEvent | null)[]
  abilityEvents: (AbilityEvent | null)[]
}

// The same slot seen from the other side: p1a <-> p2a, p1b <-> p2b.
function flipSlot(slot: SlotKey): SlotKey {
  return `${slot.startsWith('p1') ? 'p2' : 'p1'}${slot[2]}` as SlotKey
}

function flipSnapshot(snapshot: FieldSnapshot): FieldSnapshot {
  return {
    p1: snapshot.p2,
    p2: snapshot.p1,
    effects: snapshot.effects.map((e) => (e.side ? { ...e, side: e.side === 'p1' ? 'p2' : 'p1' } : e))
  }
}

// An Everstone-locked Pokemon counts as fully evolved, so the sim's Eviolite skips any
// Pokemon marked with m.everstone (see applyEverstones). The Dex's items are frozen, so a
// wrapped copy goes into its item cache in place of the original - once per Dex.
const wrappedEviolites = new WeakSet<object>()
function wrapEviolite(battle: SimBattle): void {
  const items = battle.dex.items as unknown as { itemCache: Map<string, object>; get(name: string): object }
  if (wrappedEviolites.has(items)) return
  wrappedEviolites.add(items)
  const original = items.get('eviolite') as Record<string, unknown>
  const wrapped = Object.assign(Object.create(Object.getPrototypeOf(original)), original) as Record<string, unknown>
  for (const key of ['onModifyDef', 'onModifySpD']) {
    const handler = original[key]
    if (typeof handler !== 'function') continue
    wrapped[key] = function (this: SimBattle, value: number, pokemon: SimPokemon | null, ...rest: unknown[]): unknown {
      return pokemon?.m?.everstone ? undefined : handler.call(this, value, pokemon, ...rest)
    }
  }
  items.itemCache.set('eviolite', wrapped)
}

class HumanPlayer extends BattlePlayer {
  latestRequest: ChoiceRequest | null = null
  version = 0
  // Counts every request, waiting ones too - an online screen keeps its half-made choices
  // while this stays the same.
  requestSeq = 0
  // Set when the sim refuses a choice (it stays waiting for a valid one).
  lastError: Error | null = null

  constructor(
    stream: Streams.ObjectReadWriteStream<string>,
    private readonly onUpdate: () => void,
    // Online matches skip team preview: everyone leads with their first Pokemon.
    private readonly autoTeamPreview = false
  ) {
    super(stream)
  }

  override receiveError(error: Error): void {
    this.lastError = error
    this.onUpdate()
  }

  override receiveRequest(request: ChoiceRequest): void {
    if (this.autoTeamPreview && request.teamPreview) {
      this.choose('default')
      return
    }
    this.requestSeq++
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
  private readonly ai: AIPlayer | null
  // Online: the friend playing p2, their own name for p1 (the host's), and their copy of the log.
  private readonly remote: HumanPlayer | null
  private readonly p1Name: string
  private readonly guestLog: MirroredLog | null
  // Online: called whenever either player's screen should catch up (see index.ts).
  onChange: (() => void) | null = null
  private readonly displayLog: string[] = []
  private readonly logStates: FieldSnapshot[] = []
  // Parallel to displayLog/logStates - see computeFeedbackEvent.
  private readonly feedback: (FeedbackEvent | null)[] = []
  // Parallel to displayLog/logStates - see computeMoveEvent.
  private readonly moveEvents: (MoveEvent | null)[] = []
  private readonly gimmickEvents: (GimmickEvent | null)[] = []
  private readonly abilityEvents: (AbilityEvent | null)[] = []
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
  private tmQuickCheck = false
  private tmRewards: TmInfo[] = []
  private moneyGained = 0
  private caught = false
  // Roguelite: the run Pokemon that fainted in this battle, and so left the run's team.
  private runFainted: string[] = []
  // Roguelite: a won trainer or boss battle left an item to pick back on the run menu.
  private runItemReward = false
  // Draft mode: the draft's record once this battle has counted.
  private draftResult: DraftBattleResult | null = null

  constructor(
    p1team: PokemonSet[],
    formatId = 'gen9customgame',
    generationFormat = 'gen9randombattle',
    opponent?: OpponentConfig,
    // Each team member's merge stars, in team order (classic battles and friendly
    // matches only): +10% to all its stats per star. "everstone": which are Everstone-locked
    // (they count as fully evolved, so an Eviolite does nothing for them).
    mergeStars: { p1?: number[]; p2?: number[]; everstone?: { p1?: boolean[]; p2?: boolean[] } } = {}
  ) {
    if (p1team.length === 0) throw new Error('Cannot start a battle with an empty team')
    this.opponent = opponent
    this.mergeStars = { p1: mergeStars.p1 ?? [], p2: mergeStars.p2 ?? [] }
    this.everstone = { p1: mergeStars.everstone?.p1 ?? [], p2: mergeStars.everstone?.p2 ?? [] }
    const online = opponent?.online
    this.p1Name = online?.hostName ?? 'You'
    this.human = new HumanPlayer(
      this.streams.p1,
      () => {
        this.wake()
        this.changed()
      },
      !!online
    )
    if (online) {
      this.remote = new HumanPlayer(this.streams.p2, () => this.changed(), true)
      this.ai = null
      this.guestLog = {
        parser: new BattleTextParser('p2'),
        log: [],
        logStates: [],
        feedback: [],
        moveEvents: [],
        gimmickEvents: [],
        abilityEvents: []
      }
    } else {
      this.remote = null
      this.guestLog = null
      this.ai = new AIPlayer(this.streams.p2, 'p2', opponent?.difficulty ?? 'easy', (slot, moveId) =>
        this.aiMovePower(slot, moveId)
      )
    }
    // Each in the form its held item gives it (a plated Arceus, an Origin Forme Giratina...).
    this.p1team = p1team.map(heldItemForme)
    this.p2team = (opponent?.team ?? [generateRandomSingle(generationFormat)]).map(heldItemForme)

    void this.human.start()
    void (this.remote ?? this.ai)?.start()
    void this.drainOmniscient()

    const spec = { formatid: formatId }
    const p1spec = { name: this.p1Name, team: packTeam(this.p1team) }
    // A raid's side also brings the placeholder that keeps the doubles battle running (see raid.ts).
    const p2spec = {
      name: opponent?.name ?? 'Wild',
      team: packTeam(opponent?.raid ? [...this.p2team, raidPlaceholderSet()] : this.p2team)
    }

    // Straight to the battle stream, which handles each write as it comes: with only
    // p1 in, their Pokemon exist but the battle hasn't started, so a run's carried-over
    // HP and status can be set before anyone is sent out.
    void this.battleStream.write(`>start ${JSON.stringify(spec)}\n>player p1 ${JSON.stringify(p1spec)}`)
    if (opponent?.run) this.applyRunConditions(opponent.run.conditions)
    if (opponent?.startField) this.installStartField(opponent.startField)
    this.applyEverstones(0, this.everstone.p1)
    this.installMergeBoosts()
    this.applyMergeBoosts(0, this.mergeStars.p1)
    if (opponent?.statMultipliers) {
      this.installStatMultipliers()
      this.applyStatMultipliers(0, opponent.statMultipliers.p1 ?? [])
    }
    void this.battleStream.write(`>player p2 ${JSON.stringify(p2spec)}`)
    if (opponent?.statMultipliers) this.applyStatMultipliers(1, opponent.statMultipliers.p2 ?? [])
    // p2's Pokemon only exist once they've joined (and the battle has begun) - at full
    // HP, so a bigger max HP is simply full too.
    this.applyEverstones(1, this.everstone.p2)
    this.applyMergeBoosts(1, this.mergeStars.p2)
    if (opponent?.raid) this.setUpRaid(opponent.raid)
  }

  // Weather and terrain put on the field as the battle starts, before anyone is sent out
  // (so a lead's Drizzle or Sand Stream can still replace it). Set straight onto the field
  // rather than through setWeather, which needs a Pokemon as the source: with no turn count
  // they never run out - only a new weather or terrain ends them. This battle's own copy of
  // the format runs it, so no other battle is touched.
  private installStartField(field: NonNullable<OpponentConfig['startField']>): void {
    const battle = this.battleStream.battle
    if (!battle) return
    for (const sideIndex of field.leadAtkDrop ?? []) {
      // That side's first Pokemon out starts at -1 Attack.
      let dropped = false
      const onSwitchIn = function (this: SimBattle, pokemon: SimPokemon): void {
        if (dropped || pokemon.side !== this.sides[sideIndex]) return
        dropped = true
        this.boost({ atk: -1 }, pokemon, null, null)
      }
      battle.onEvent('SwitchIn', battle.format, onSwitchIn as never)
    }
    if (!field.weather && !field.terrain && !field.trickRoom && !field.sideConditions?.length) return
    const format = battle.format
    const ownFormat = Object.create(format) as typeof format
    ownFormat.onBattleStart = function (this: SimBattle): void {
      format.onBattleStart?.call(this)
      if (field.weather) {
        const weather = this.dex.conditions.get(field.weather)
        if (weather.exists) {
          this.field.weather = weather.id
          this.field.weatherState = this.initEffectState({ id: weather.id })
          // Its start message ("It started to rain!").
          this.singleEvent('FieldStart', weather, this.field.weatherState, this.field)
        }
      }
      if (field.terrain) {
        const terrain = this.dex.conditions.get(field.terrain)
        if (terrain.exists) {
          this.field.terrain = terrain.id
          this.field.terrainState = this.initEffectState({ id: terrain.id })
          this.singleEvent('FieldStart', terrain, this.field.terrainState, this.field)
        }
      }
      // Trick Room with no turn count, so it never runs out.
      if (field.trickRoom) {
        this.field.pseudoWeather['trickroom'] = this.initEffectState({ id: 'trickroom', duration: 0 })
        this.add('-fieldstart', 'move: Trick Room')
      }
      // Side conditions set straight on (they need no Pokemon as their source), with
      // their usual turn counts.
      const startSide = (side: (typeof this.sides)[number], id: string, layers?: number): void => {
        const condition = this.dex.conditions.get(id)
        if (!condition.exists) return
        const state = this.initEffectState({ id: condition.id, target: side, duration: condition.duration })
        if (layers) state.layers = layers
        side.sideConditions[condition.id] = state
        this.add('-sidestart', side, `move: ${condition.name}`)
        // Spikes show once per layer.
        for (let i = 1; i < (layers ?? 1); i++) this.add('-sidestart', side, `move: ${condition.name}`)
      }
      for (const condition of field.sideConditions ?? []) startSide(this.sides[condition.side], condition.id, condition.layers)
    }
    ;(battle as { format: typeof format }).format = ownFormat
  }

  // A raid's boss Dynamaxes as it's sent out, for the whole battle (Dynamax ends when its
  // turn count reaches 3 - this one's never will), and the placeholder faints the moment
  // it arrives, leaving the boss alone on its side.
  private setUpRaid(raid: NonNullable<OpponentConfig['raid']>): void {
    const battle = this.battleStream.battle
    const side = battle?.sides[1]
    if (!battle || !side) return
    const boss = side.pokemon[0]
    if (!boss) return
    // Showdown only keeps a set's Gigantamax flag in Gen 8.
    if (raid.gigantamax) (boss as { gigantamax: boolean }).gigantamax = true
    // Extra HP before it's sent out - Dynamaxing doubles it again on top.
    boss.baseMaxhp = Math.floor(boss.baseMaxhp * RAID_HP_MULTIPLIER)
    boss.maxhp = Math.floor(boss.maxhp * RAID_HP_MULTIPLIER)
    boss.hp = boss.maxhp
    const onSwitchIn = function (this: SimBattle, pokemon: SimPokemon): void {
      if (pokemon.side !== side) return
      if (pokemon.name === RAID_PLACEHOLDER_NAME) {
        pokemon.faint()
        return
      }
      if (!pokemon.volatiles['dynamax']) {
        pokemon.addVolatile('dynamax')
        ;(pokemon.volatiles['dynamax'] as { turns?: number }).turns = -1e9
      }
    }
    battle.onEvent('SwitchIn', battle.format, onSwitchIn as never)

    // It attacks more than once a turn: after each of its moves (up to its count for the
    // turn) it goes again straight away, with its best attack (a Max Move, as it's
    // Dynamaxed) at whichever foe that hurts most - never one immune to it.
    let turnSeen = -1
    let attacksThisTurn = 0
    const onAfterMove = function (this: SimBattle, source: SimPokemon): void {
      if (source !== boss || source.fainted) return
      if (turnSeen !== this.turn) {
        turnSeen = this.turn
        attacksThisTurn = 0
      }
      attacksThisTurn++
      if (attacksThisTurn >= RAID_ATTACKS_PER_TURN) return
      const foes = source.foes()
      const attacks = source.moveSlots.filter((slot) => slot.pp > 0 && this.dex.moves.get(slot.id).category !== 'Status')
      if (foes.length === 0 || attacks.length === 0) return
      // Each attack against each foe: its power, times how well its type lands (with the
      // boss's own STAB) - the best pairing wins, ties at random.
      const ownTypes = source.getTypes()
      let best: { slotId: string; foe: SimPokemon; score: number } | null = null
      for (const slot of attacks) {
        const move = this.dex.moves.get(slot.id)
        for (const foe of foes) {
          const hits = this.dex.getImmunity(move.type, foe) ? 2 ** this.dex.getEffectiveness(move.type, foe) : 0
          const score = (move.basePower || 60) * hits * (ownTypes.includes(move.type) ? 1.5 : 1) * (1 + this.random(10) / 100)
          if (!best || score > best.score) best = { slotId: slot.id, foe, score }
        }
      }
      if (!best || best.score <= 0) return
      const maxMove = this.actions.getMaxMove(this.dex.moves.get(best.slotId), source)
      const [action] = this.queue.resolveAction({
        choice: 'move',
        pokemon: source,
        moveid: best.slotId,
        targetLoc: source.getLocOf(best.foe),
        maxMove: maxMove ? maxMove.id : undefined
      } as never)
      if (action) this.queue.prioritizeAction(action as never)
    }
    battle.onEvent('AfterMove', battle.format, onAfterMove as never)

    // The soft cap: past a quarter of the boss's (Dynamaxed) max HP, a hit only does half
    // as much more (see raidSoftCappedDamage). Moves only - not burns, weather or recoil.
    const onDamage = function (this: SimBattle, damage: number, target: SimPokemon, _source: SimPokemon, effect: { effectType?: string }): number | void {
      if (target !== boss || effect?.effectType !== 'Move') return
      return raidSoftCappedDamage(damage, boss.maxhp)
    }
    battle.onEvent('Damage', battle.format, onDamage as never)
  }

  private raidCatch: RaidView['caught'] = null
  // The weather in play, for naming it in the log when it ends.
  private textWeather: string | null = null

  private readonly mergeStars: { p1: number[]; p2: number[] }
  // Each boosted Pokemon's multiplier (by its place in the team), as set at the start.
  private readonly mergeMultipliers: { p1: number[]; p2: number[] } = { p1: [], p2: [] }

  // Merge stars: every Attack, Defense, Sp. Atk, Sp. Def and Speed the sim works out goes
  // through these (the same hooks items and abilities use, so it lasts through Mega
  // Evolution and form changes), for any Pokemon given a boost below.
  private installMergeBoosts(): void {
    const battle = this.battleStream.battle
    if (!battle || ![...this.mergeStars.p1, ...this.mergeStars.p2].some((s) => s > 0)) return
    const boost = function (this: SimBattle, _value: number, pokemon: SimPokemon | null): void {
      const multiplier = pokemon?.m?.mergeBoost as number | undefined
      if (multiplier) this.chainModify(multiplier)
    }
    for (const stat of ['Atk', 'Def', 'SpA', 'SpD', 'Spe']) battle.onEvent(`Modify${stat}`, battle.format, boost as never)
  }

  private readonly everstone: { p1: boolean[]; p2: boolean[] }

  // Marks each Everstone-locked Pokemon on this side (by its place in the team): it counts as
  // fully evolved, so the sim's Eviolite skips it (see wrapEviolite).
  private applyEverstones(sideIndex: 0 | 1, locked: boolean[]): void {
    const battle = this.battleStream.battle
    const side = battle?.sides[sideIndex]
    if (!battle || !side || !locked.some(Boolean)) return
    wrapEviolite(battle)
    for (const mon of side.pokemon) if (locked[side.team.indexOf(mon.set)]) mon.m.everstone = true
  }

  // Marks each boosted Pokemon on this side (by its place in the team, which the sim keeps
  // on its set) and raises its max HP the same way.
  private applyMergeBoosts(sideIndex: 0 | 1, stars: number[]): void {
    const side = this.battleStream.battle?.sides[sideIndex]
    if (!side || !stars.some((s) => s > 0)) return
    for (const mon of side.pokemon) {
      const count = stars[side.team.indexOf(mon.set)] ?? 0
      if (!count) continue
      // An Everstone-locked one keeps its growth whatever it holds (its Eviolite does nothing).
      const growth = mergeGrowthFor(mon.species.name, mon.m.everstone ? undefined : mon.set.item)
      const multiplier = mergeStatMultiplier(count, speciesRarityTier(mon.species.name), growth)
      this.mergeMultipliers[sideIndex === 0 ? 'p1' : 'p2'][side.team.indexOf(mon.set)] = multiplier
      const ratio = mon.maxhp > 0 ? mon.hp / mon.maxhp : 1
      mon.m.mergeBoost = multiplier
      mon.baseMaxhp = Math.floor(mon.baseMaxhp * multiplier)
      mon.maxhp = Math.floor(mon.maxhp * multiplier)
      mon.hp = ratio >= 1 ? mon.maxhp : Math.max(1, Math.round(ratio * mon.maxhp))
    }
  }

  // Chaos stat boosts: each stat of the player's Pokemon multiplied by its own amount
  // (through the same hooks as merge stars), HP by raising max HP.
  private installStatMultipliers(): void {
    const battle = this.battleStream.battle
    if (!battle) return
    for (const [stat, key] of [['Atk', 'atk'], ['Def', 'def'], ['SpA', 'spa'], ['SpD', 'spd'], ['Spe', 'spe']] as const) {
      const boost = function (
        this: SimBattle,
        _value: number,
        pokemon: SimPokemon | null,
        target: SimPokemon | null,
        move: { overrideOffensiveStat?: string; overrideOffensivePokemon?: string } | null
      ): void {
        // The sim runs a move's attack through the Attack/Sp. Atk hook even when it hits with
        // another stat (Body Press uses Defense, Foul Play the target's Attack), so take the
        // multiplier of the stat (and Pokemon) the move really uses.
        let owner = pokemon
        let used: keyof StatBlock = key
        if ((key === 'atk' || key === 'spa') && move) {
          if (move.overrideOffensivePokemon === 'target') owner = target
          if (move.overrideOffensiveStat) used = move.overrideOffensiveStat as keyof StatBlock
        }
        const multiplier = (owner?.m?.chaosBoost as StatBlock | undefined)?.[used]
        if (multiplier && multiplier !== 1) this.chainModify([Math.round(multiplier * 4096), 4096])
      }
      battle.onEvent(`Modify${stat}`, battle.format, boost as never)
    }
  }

  // Marks each of this side's Pokemon with its multipliers (by its place in the team), HP
  // straight onto its max HP.
  private applyStatMultipliers(sideIndex: 0 | 1, multipliers: StatBlock[]): void {
    const side = this.battleStream.battle?.sides[sideIndex]
    if (!side) return
    for (const mon of side.pokemon) {
      const multiplier = multipliers[side.team.indexOf(mon.set)]
      if (!multiplier) continue
      mon.m.chaosBoost = multiplier
      if (multiplier.hp !== 1) {
        mon.baseMaxhp = Math.floor(mon.baseMaxhp * multiplier.hp)
        mon.maxhp = Math.floor(mon.maxhp * multiplier.hp)
        mon.hp = mon.maxhp
      }
    }
  }

  // The battle screen's stats for a boosted Pokemon (its tooltip and effective stats).
  private withMergeStats(view: ActivePokemonView, side: 'p1' | 'p2'): ActivePokemonView {
    const chaos = view.rosterIndex !== undefined ? this.opponent?.statMultipliers?.[side]?.[view.rosterIndex] : undefined
    if (chaos) {
      const stats = { ...view.stats }
      for (const key of Object.keys(stats) as (keyof typeof stats)[]) stats[key] = Math.floor(stats[key] * chaos[key])
      view.stats = stats
    }
    const multiplier = view.rosterIndex !== undefined ? this.mergeMultipliers[side][view.rosterIndex] : undefined
    if (!multiplier) return view
    const stats = { ...view.stats }
    for (const key of Object.keys(stats) as (keyof typeof stats)[]) stats[key] = Math.floor(stats[key] * multiplier)
    view.stats = stats
    return view
  }

  private applyRunConditions(conditions: { hp: number; status: string | null }[]): void {
    const battle = this.battleStream.battle
    const side = battle?.sides[0]
    if (!battle || !side) return
    side.pokemon.forEach((mon, i) => {
      const condition = conditions[i]
      if (!condition) return
      mon.hp = Math.max(1, Math.min(mon.maxhp, Math.round(condition.hp * mon.maxhp)))
      if (condition.status) {
        mon.status = condition.status as typeof mon.status
        mon.statusState = battle.initEffectState({ id: condition.status, target: mon })
        // Asleep: a couple of turns left, rather than a fresh roll.
        if (condition.status === 'slp') {
          mon.statusState.startTime = 2
          mon.statusState.time = 2
        }
      }
    })
  }

  // How each of the player's Pokemon ended up, in team order (the sim reorders its
  // own list as Pokemon switch, but each keeps the set it was built from).
  private p1Outcome(): RunBattleOutcome[] {
    const side = this.battleStream.battle?.sides[0]
    if (!side) return []
    return side.team.map((set) => {
      const mon = side.pokemon.find((p) => p.set === set)
      if (!mon) return { hp: 1, status: null, fainted: false }
      return {
        hp: mon.maxhp > 0 ? mon.hp / mon.maxhp : 0,
        status: mon.status || null,
        fainted: mon.fainted || mon.hp <= 0
      }
    })
  }

  // A run battle's end goes to the run instead of the regular rewards.
  private finishRunBattle(): void {
    if (this.winner === this.p1Name) {
      const { expGains, fainted, itemReward } = finishRunBattleWon(this.p1Outcome(), this.opponent!.run!.kind)
      this.expGains = expGains
      this.runFainted = fainted
      this.runItemReward = itemReward
    } else {
      this.runFainted = this.p1team.map((mon) => mon.species)
      finishRunBattleLost()
    }
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
        // A raid's placeholder never shows: not sent out, not fainting, not in the log.
        if (this.opponent?.raid && line.includes(`: ${RAID_PLACEHOLDER_NAME}`)) continue
        const hpBefore: Record<SlotKey, number | null> = {
          p1a: this.active.p1a?.hpPercent ?? null,
          p1b: this.active.p1b?.hpPercent ?? null,
          p2a: this.active.p2a?.hpPercent ?? null,
          p2b: this.active.p2b?.hpPercent ?? null
        }
        this.applyStateLine(line)
        this.applyFieldEffectLine(line, liveEffects, index < lastUpkeepIndex ? 1 : 0)

        const { args, kwArgs } = BattleTextParser.parseBattleLine(line)
        // Weather ending is just "-weather|none": the parser names what ended from [from],
        // which Showdown's own client fills in from its state - so this does the same.
        if (args[0] === '-weather') {
          if (args[1] && args[1] !== 'none') this.textWeather = args[1]
          else {
            if (!kwArgs.from && this.textWeather) kwArgs.from = this.textWeather
            this.textWeather = null
          }
        }
        // The parser would say "Wild won the battle!" - a wild encounter has no
        // trainer to name, so phrase the loss from the player's side instead.
        // A raid boss Dynamaxing reads as such (the parser has no line for it), and the silent
        // HP top-up that comes with it stays silent.
        const dynamaxStart = /^\|-start\|p2[ab]: ([^|]+)\|Dynamax(\|Gmax)?/.exec(line)
        const rendered =
          line.startsWith('|win|') && !this.opponent?.trainerId && line !== '|win|You'
            ? this.opponent?.raid
              ? 'You lost the raid!'
              : 'You lost to the wild pokemon!'
            : dynamaxStart
              ? `The raid boss ${dynamaxStart[1]} ${dynamaxStart[2] ? 'Gigantamaxed' : 'Dynamaxed'}!`
              : this.opponent?.raid && line.startsWith('|-heal|') && line.includes('[silent]')
                ? ''
                : this.textParser.parseArgs(args, kwArgs) || ''
        const event = computeFeedbackEvent(line)
        const moveEvent = this.computeMoveEvent(line, lines.slice(index + 1))
        const gimmickEvent = computeGimmickEvent(line)
        // An ability's banner, or else a held item's (they share the banner).
        const abilityEvent = computeAbilityEvent(line) ?? computeItemEvent(line)
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
          this.abilityEvents.push(eventUsed ? null : abilityEvent)
          eventUsed = true
        }
        // The friend's copy: parsed afresh (the parser tidies the args it's given in place).
        if (this.guestLog) {
          const guest = BattleTextParser.parseBattleLine(line)
          if (args[0] === '-weather' && kwArgs.from) guest.kwArgs.from = kwArgs.from
          let guestEventUsed = false
          for (const textLine of (this.guestLog.parser.parseArgs(guest.args, guest.kwArgs) || '').split('\n')) {
            if (!textLine.trim()) continue
            this.pushGuestLine(textLine, guestEventUsed ? {} : { event, moveEvent, gimmickEvent, abilityEvent })
            guestEventUsed = true
          }
        }

        this.pushHpDeltaLine(line, hpBefore)

        if (line.startsWith('|win|')) {
          this.ended = true
          this.winner = line.slice('|win|'.length)
          if (this.opponent?.dexNavHunt && this.winner !== this.p1Name) breakDexNavChain()
          if (this.opponent?.run) {
            this.finishRunBattle()
          } else if (this.opponent?.draft) {
            this.draftResult = finishDraftBattle(
              this.winner === this.p1Name,
              this.p1Outcome().every((mon) => !mon.fainted)
            )
          } else if (this.winner === this.p1Name && !this.opponent?.noRewards) {
            if (this.opponent?.trainerId) {
              // The cap the fight was held under - read before a boss win raises it.
              const levelCap = getProgression().levelCap
              recordTrainerWin(this.opponent.trainerId, !!this.opponent.isBoss)
              // Bosses are tallied by the progression's own list of beaten bosses.
              if (!this.opponent.isBoss) countStat('trainersDefeated')
              else recordMission('bossWins')
              // Per Pokemon on the team they actually sent out, or a flat sum for a
              // boss - either way plus the level cap as a percentage on top.
              this.moneyGained = this.opponent.noPrizeMoney ? 0 : this.prizeMoney(levelCap)
              if (this.moneyGained > 0) addMoney(this.moneyGained)
              if (this.opponent.tmRewards?.length) this.tmRewards = grantRewardTms(this.opponent.tmRewards)
            } else if (!this.opponent?.raid) {
              // A Max Raid isn't a wild battle - it has its own mission and achievements.
              countStat('wildDefeated')
              if (this.opponent?.location) this.tmQuickCheck = armTmQuickCheck(this.opponent.location)
              if (this.opponent?.dexNavHunt) extendDexNavChain()
            }
            if (this.opponent?.raid) this.catchRaidBoss(this.opponent.raid)
            const baseExp = this.p2team.reduce((sum, mon) => sum + expYieldFor(mon.species, mon.level), 0)
            // The Exp. Charm (1.5x) and the Veteran title (+10%) - they stack.
            let totalExp = baseExp
            if (hasItem(EXP_CHARM_ITEM_ID)) totalExp *= EXP_CHARM_MULTIPLIER
            if (hasTitle('Veteran')) totalExp *= VETERAN_EXP_MULTIPLIER
            this.expGains = awardExpToTeam(Math.floor(totalExp))
            awardFriendshipToTeam()
            this.itemDrops = this.rollItemDrops()
            // Badge Collector: now and then, a bonus Rare Candy after any battle won.
            if (hasTitle('Badge Collector') && Math.random() < BADGE_COLLECTOR_CANDY_CHANCE) {
              const candy = getEditorOptions().items.find((i) => i.id === RARE_CANDY_ITEM_ID)
              addItem(RARE_CANDY_ITEM_ID, 1)
              if (candy) this.itemDrops.push({ itemId: candy.id, itemName: candy.name, spritenum: candy.spritenum })
            }
          }
          this.wake()
        } else if (line === '|tie') {
          this.ended = true
          this.winner = null
          if (this.opponent?.dexNavHunt) breakDexNavChain()
          // Both sides down at once: the run's whole team is gone too.
          if (this.opponent?.run) this.finishRunBattle()
          // A tie counts as a loss for a draft.
          if (this.opponent?.draft) this.draftResult = finishDraftBattle(false)
          this.wake()
        }
      }
      this.reconcileFieldEffects(liveEffects)
      this.changed()
    }
  }

  private changed(): void {
    this.onChange?.()
  }

  // One line of the friend's log, with its moment's field and events flipped to their side.
  private pushGuestLine(
    text: string,
    events: { event?: FeedbackEvent | null; moveEvent?: MoveEvent | null; gimmickEvent?: GimmickEvent | null; abilityEvent?: AbilityEvent | null }
  ): void {
    const guest = this.guestLog
    if (!guest) return
    const { event, moveEvent, gimmickEvent, abilityEvent } = events
    guest.log.push(text)
    guest.logStates.push(flipSnapshot(this.snapshotField()))
    guest.feedback.push(event ? { ...event, slot: flipSlot(event.slot) } : null)
    guest.moveEvents.push(
      moveEvent
        ? {
            ...moveEvent,
            attackerSlot: flipSlot(moveEvent.attackerSlot),
            targetSlots: moveEvent.targetSlots.map(flipSlot),
            missedSlots: moveEvent.missedSlots.map(flipSlot)
          }
        : null
    )
    guest.gimmickEvents.push(gimmickEvent ? { ...gimmickEvent, slot: flipSlot(gimmickEvent.slot) } : null)
    guest.abilityEvents.push(abilityEvent ? { ...abilityEvent, slot: flipSlot(abilityEvent.slot) } : null)
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
    // -sethp: HP set outright (Pain Split, for both Pokemon).
    if (!line.startsWith('|-damage|') && !line.startsWith('|-heal|') && !line.startsWith('|-sethp|')) return
    const parts = line.slice(1).split('|')
    const slotKey = slotKeyFromIdent(parts[1])
    if (!slotKey) return

    const before = hpBefore[slotKey]
    const after = this.active[slotKey]?.hpPercent
    if (before == null || after == null || before === after) return

    const delta = after - before
    const say = (name: string): string => (delta > 0 ? `  ${name} restored ${delta}% HP.` : `  ${name} lost ${-delta}% HP.`)
    this.displayLog.push(say(this.textParser.pokemon(parts[1])))
    this.logStates.push(this.snapshotField())
    this.feedback.push(null)
    this.moveEvents.push(null)
    this.gimmickEvents.push(null)
    this.abilityEvents.push(null)
    if (this.guestLog) this.pushGuestLine(say(this.guestLog.parser.pokemon(parts[1])), {})
  }

  private snapshotField(): FieldSnapshot {
    // Each Pokemon's current stats are worked out here, at the moment of the
    // snapshot, so they match that log line's boosts, status, item and field.
    const clone = (v: ActivePokemonView | null, side: 'p1' | 'p2'): ActivePokemonView | null =>
      v ? { ...v, boosts: { ...v.boosts }, volatiles: [...v.volatiles], effectiveStats: effectiveStatsFor(v, side, this.effects, !!this.everstone[side][v.rosterIndex ?? -1]) } : null
    const withMatchups = (v: ActivePokemonView | null, side: 0 | 1, i: number): ActivePokemonView | null =>
      v ? { ...v, moveMatchups: this.moveMatchupsFor(v, side, this.battleStream.battle?.sides[side].active[i] ?? null) } : null
    return {
      p1: [withMatchups(clone(this.active.p1a, 'p1'), 0, 0), withMatchups(clone(this.active.p1b, 'p1'), 0, 1)],
      p2: [withMatchups(clone(this.active.p2a, 'p2'), 1, 0), withMatchups(clone(this.active.p2b, 'p2'), 1, 1)],
      effects: this.effects.map((e) => ({ ...e }))
    }
  }

  // For a Pokemon's tooltip: how each of its moves' types hit each Pokemon out on the
  // other side, left to right as on screen (the foe's two are drawn p2b then p2a, the
  // player's p1a then p1b). The sim can be a little ahead of the log line being shown,
  // so a slot whose Pokemon isn't the one on screen is left out.
  private moveMatchupsFor(view: ActivePokemonView, side: 0 | 1, source: SimPokemon | null): ActivePokemonView['moveMatchups'] {
    const battle = this.battleStream.battle
    if (!battle || !source || source.fainted || !sameBaseSpecies(source.species.name, view.species)) return undefined
    const foeSide = side === 0 ? 1 : 0
    const foeViews = side === 0 ? [this.active.p2b, this.active.p2a] : [this.active.p1a, this.active.p1b]
    const foeIndexes = side === 0 ? [1, 0] : [0, 1]
    const foes = foeIndexes.flatMap((index, n) => {
      const foe = battle.sides[foeSide].active[index]
      const foeView = foeViews[n]
      return foe && !foe.fainted && foeView && !foeView.fainted && sameBaseSpecies(foe.species.name, foeView.species)
        ? [{ foe, name: foeView.species }]
        : []
    })
    if (foes.length === 0) return undefined
    const matchups: NonNullable<ActivePokemonView['moveMatchups']> = {}
    for (const moveId of view.moveIds) {
      const chips = foes.flatMap(({ foe, name }) => {
        const multiplier = moveTypeEffectiveness(battle, source, foe, moveId)
        return multiplier === null ? [] : [{ foeName: name, multiplier }]
      })
      if (chips.length > 0) matchups[moveId] = chips
    }
    return matchups
  }

  private buildActiveView(
    species: string,
    hpPercent: number,
    fainted: boolean,
    status: string | null,
    set: PokemonSet | null,
    switchSeq = 0,
    rosterIndex?: number
  ): ActivePokemonView {
    const summary = buildPokemonSummary(species, set)
    return {
      ...summary,
      rarityTier: speciesRarityTier(species),
      rosterIndex: rosterIndex !== undefined && rosterIndex >= 0 ? rosterIndex : undefined,
      // Checked against the species it is now - a Mega or other form drops the look.
      gmaxLook: gmaxLookOf(set, species) || undefined,
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

  // The player on this side (online, side 1 is the friend; otherwise there's only p1's).
  private playerOn(side: 0 | 1): HumanPlayer | null {
    return side === 0 ? this.human : this.remote
  }

  private buildTeamView(side: 0 | 1 = 0): ActivePokemonView[] {
    const request = this.playerOn(side)?.latestRequest
    if (!request) return []
    const simSide = this.battleStream.battle?.sides[side]
    const team = side === 0 ? this.p1team : this.p2team
    return request.side.pokemon.map((mon, i) => {
      // side.pokemon isn't in fixed roster order - it's reordered so the currently
      // active Pokemon comes first. The sim's own list is in that same order, and each
      // of its Pokemon keeps the set it was built from, which says where it is in the
      // roster - so two of the same species are still told apart. (By species otherwise.)
      const species = mon.details.split(',')[0].trim()
      const { hpPercent, fainted, status } = parseCondition(mon.condition)
      const live = simSide?.pokemon[i]
      let rosterIndex = live ? simSide.team.indexOf(live.set) : -1
      if (rosterIndex < 0 || !sameBaseSpecies(team[rosterIndex].species, species)) {
        rosterIndex = findRosterIndex(team, species)
      }
      const set = rosterIndex >= 0 ? team[rosterIndex] : null
      const view = this.buildActiveView(species, hpPercent, fainted, status, set, 0, rosterIndex)
      // The request reports its ability as it is now - a Mega's new one included.
      if (mon.baseAbility) view.ability = abilityName(mon.baseAbility)
      view.moveMatchups = this.moveMatchupsFor(view, side, live ?? null)
      return this.withMergeStats(view, side === 0 ? 'p1' : 'p2')
    })
  }

  // Which roster member just came into this slot. The switch line only names the
  // species, so with two of the same one on a team the sim is asked which of them is
  // in the slot (each of its Pokemon keeps the set it was built from, in roster order).
  private switchedInRosterIndex(slotKey: SlotKey, team: PokemonSet[], species: string): number {
    const candidates = team.flatMap((set, i) => (sameBaseSpecies(set.species, species) ? [i] : []))
    if (candidates.length <= 1) return candidates[0] ?? findRosterIndex(team, species)
    const simSide = this.battleStream.battle?.sides[slotKey.startsWith('p1') ? 0 : 1]
    const live = simSide?.active[slotKey.charCodeAt(2) - 'a'.charCodeAt(0)]
    const index = live ? simSide.team.indexOf(live.set) : -1
    return candidates.includes(index) ? index : candidates[0]
  }

  // Unlike p1, the opponent has no per-turn "request" to read fainted/status
  // off of, so this reads the live sim object's side.pokemon directly - which
  // reorders exactly like request.side.pokemon does (the currently active
  // Pokemon is kept at the front, swapping position with whoever switches in),
  // so each entry's own species is read off itself rather than matched
  // positionally against p2team, same as buildTeamView does for the player's
  // own team.
  private opponentRoster(foeSide: 0 | 1 = 1): RosterSlotView[] {
    const side = this.battleStream.battle?.sides[foeSide]
    const team = foeSide === 0 ? this.p1team : this.p2team
    if (!side) return team.map((mon) => ({ species: mon.species, fainted: false, status: null }))
    return side.pokemon.filter((mon) => !(this.opponent?.raid && mon.name === RAID_PLACEHOLDER_NAME)).map((mon) => ({
      species: mon.species?.name ?? mon.name,
      fainted: mon.fainted,
      status: mon.status || null,
      rosterIndex: side.team.indexOf(mon.set)
    }))
  }

  // Independent rolls, each all-or-nothing against its own chance: any configured
  // drops (a trainer's own, their current team's, or a wild species' one), then
  // the optional random-item roll.
  private rollItemDrops(): ItemDropResult[] {
    const catalog = new Map(getEditorOptions().items.map((i) => [i.id, i]))
    const results: ItemDropResult[] = []
    const teamDrop = this.opponent?.teamDrop
    // The Item Charm: a wild Pokemon's drops are 1.5x as likely.
    const dropBoost = !this.opponent?.trainerId && hasItem(ITEM_CHARM_ITEM_ID) ? ITEM_CHARM_DROP_MULTIPLIER : 1
    for (const drop of [...(this.opponent?.drops ?? []), ...(teamDrop ? [teamDrop] : [])]) {
      if (!drop.itemId || drop.chance <= 0) continue
      if (Math.random() * 100 >= drop.chance * dropBoost) continue
      const item = catalog.get(drop.itemId)
      if (!item) continue
      addItem(item.id, 1)
      results.push({ itemId: item.id, itemName: item.name, spritenum: item.spritenum })
    }
    const randomChance = this.opponent?.randomDropChance ?? 0
    if (randomChance > 0 && Math.random() * 100 < randomChance * dropBoost) {
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
  // A beaten raid boss always joins the box: its stars as copies, and its Gigantamax form.
  /**
   * The player's request, with every trap they're under marked: a trap from an ability
   * nobody has seen yet (Shadow Tag, Arena Trap, Magnet Pull) is left off it by the sim -
   * hidden from a player who couldn't know - but here the switch list should just say so.
   */
  private requestWithTraps(side: 0 | 1 = 0): ChoiceRequest | null {
    const request = this.playerOn(side)?.latestRequest ?? null
    if (!request || !('active' in request) || !request.active) return request
    const active = this.battleStream.battle?.sides[side].active ?? []
    return {
      ...request,
      active: request.active.map((slot, i) => (active[i]?.trapped && !slot.trapped ? { ...slot, trapped: true } : slot))
    }
  }

  private catchRaidBoss(raid: NonNullable<OpponentConfig['raid']>): void {
    const boss = this.p2team[0]
    // Raid Leader: a couple of extra copies on top of the boss's stars.
    const copies = 2 ** raid.stars + (hasTitle('Raid Leader') ? RAID_LEADER_EXTRA_COPIES : 0)
    addCaughtMon(boss, { copies, gigantamax: raid.gigantamax })
    this.raidCatch = { species: boss.species, shiny: !!boss.shiny }
    this.caught = true
    // Not a wild catch (the catch missions and achievements) - raids count on their own.
    countAchievement('raidsWon')
    if (speciesRarityTier(boss.species) === 'legendary') countAchievement('goldRaidsWon')
    if (boss.shiny) countAchievement('shinyRaidCatches')
    // None of the player's Pokemon fainted.
    if (!this.battleStream.battle?.sides[0].pokemon.some((p) => p.fainted)) countAchievement('flawlessRaids')
  }

  catchWildPokemon(replaceRunMonId?: string): CatchResult {
    if (!this.ended || this.winner !== this.p1Name) throw new Error('You have not won this battle yet')
    if (this.opponent?.raid) throw new Error('A raid boss is caught as soon as it is beaten')
    if (this.opponent?.trainerId) throw new Error('Only a wild Pokemon can be caught')
    if (this.caught) throw new Error('This Pokemon has already been caught')
    if (this.opponent?.run) {
      // A run catch is free and joins the run's team, not the box.
      addRunCatch(this.p2team[0], replaceRunMonId)
      this.caught = true
      return { money: getMoney(), pokeballs: getItemQuantity(DEFAULT_POKEBALL_ID) }
    }
    // The Catching Charm (half the time) and the Collector title (10%) each give a
    // chance of the catch being free - no Poke Ball and nothing paid.
    const free =
      (hasItem(CATCHING_CHARM_ITEM_ID) && Math.random() < CATCHING_CHARM_FREE_CHANCE) ||
      (hasTitle('Collector') && Math.random() < COLLECTOR_FREE_CATCH_CHANCE)
    if (free) {
      // Nothing spent.
    } else if (hasItem(DEFAULT_POKEBALL_ID)) {
      removeItem(DEFAULT_POKEBALL_ID, 1)
    } else {
      // Bought at the Shop's price - with Tycoon's discount.
      const price = shopPrice(pokeballPrice())
      if (!spendMoney(price)) throw new Error(`Not enough money to buy a Poke Ball (need ${price})`)
    }
    addCaughtMon(this.p2team[0])
    this.caught = true
    countStat('wildCaught')
    return { money: getMoney(), pokeballs: getItemQuantity(DEFAULT_POKEBALL_ID), free }
  }

  // What running costs here, or null if it isn't allowed: a wild encounter is free, an
  // ordinary trainer battle costs TRAINER_RUN_COST, and there's no running from a boss
  // or from a Roguelite run's trainers. There's no reward, exp or catch for a battle
  // you walked away from - it's simply abandoned. A wild Pokemon an ambush woke can't
  // be run from either.
  private runCost(): number | null {
    if (this.opponent?.noRun || this.opponent?.online) return null
    if (!this.opponent?.trainerId) return 0
    if (this.opponent.isBoss || this.opponent.run || this.opponent.draft) return null
    // A friendly match (another player's team) has nothing riding on it, and the
    // Champion title runs from any trainer for free.
    if (this.opponent.noRewards || hasTitle('Champion')) return 0
    return TRAINER_RUN_COST
  }

  // A trainer's or boss's prize money - with the Ace Trainer title's 10% on top.
  private prizeMoney(levelCap: number): number {
    const base = prizeMoneyFor(!!this.opponent?.isBoss, this.p2team.length, levelCap)
    return hasTitle('Ace Trainer') ? Math.round(base * ACE_TRAINER_MONEY_MULTIPLIER) : base
  }

  assertCanRun(): void {
    if (this.runCost() === null) throw new Error("You can't run from this battle")
  }

  /** Runs away (paying for it, from a trainer). In a run, the floor still counts as cleared, and the team keeps the damage it took. */
  runAway(): void {
    const cost = this.runCost()
    if (cost === null) throw new Error("You can't run from this battle")
    if (cost > 0 && !this.ended && !spendMoney(cost)) {
      throw new Error(`Running from a trainer costs ₽${cost.toLocaleString('en-US')} - you don't have enough`)
    }
    if (this.opponent?.run && !this.ended) finishRunBattleFled(this.p1Outcome())
    // Fleeing the DexNav's hunted Pokemon loses the chain.
    if (this.opponent?.dexNavHunt && !this.ended) breakDexNavChain()
  }

  // A draft match or a Roguelite fight can't be run from, but it can be given up: the
  // player simply loses, so a draft match counts as lost and a run is over.
  private canForfeit(): boolean {
    return !!(this.opponent?.run || this.opponent?.draft || this.opponent?.online)
  }

  // Online: either player giving up (or the friend's connection dropping) - the sim
  // declares that side beaten, and both screens catch up through onChange.
  forfeitSide(side: 0 | 1): void {
    if (!this.ended) void this.streams.omniscient.write(`>forcelose p${side + 1}`)
  }

  /**
   * Online: one player's choice for the turn. The sim only answers when it refuses one, so
   * this gives it a moment to - otherwise the choice stands and both screens move on
   * through onChange once the other player has chosen too.
   */
  async chooseFor(side: 0 | 1, choice: string): Promise<void> {
    const player = this.playerOn(side)
    if (!player || this.ended) return
    player.lastError = null
    const seq = player.requestSeq
    player.choose(choice)
    for (let waited = 0; waited < 300 && !player.lastError && player.requestSeq === seq && !this.ended; waited += 20) {
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
    const refused = player.lastError as Error | null
    if (refused) {
      player.lastError = null
      throw new Error(refused.message.replace(/^\[[^\]]*\]\s*/, ''))
    }
  }

  /** Gives up the battle: the sim declares the player beaten, and the usual loss follows. */
  async forfeit(): Promise<BattleView> {
    if (!this.canForfeit()) throw new Error("You can't forfeit this battle")
    if (!this.ended) {
      void this.streams.omniscient.write('>forcelose p1')
      while (!this.ended) await this.waitForUpdate(this.human.version)
    }
    return this.view()
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
    // Leech Seed sapping HP: "-damage|<seeded>|hp|[from] Leech Seed|[of] <seeder>" - the
    // orbs fly from the seeded Pokemon to whoever's in the seeder's slot.
    if (line.startsWith('|-damage|') && line.includes('|[from] Leech Seed')) {
      const parts = line.slice(1).split('|')
      const seeded = slotKeyFromIdent(parts[1])
      const of = parts.find((p) => p.startsWith('[of] '))
      const healer = of ? slotKeyFromIdent(of.slice('[of] '.length)) : null
      if (!seeded || !healer) return null
      return { moveId: LEECH_SEED_DRAIN_EVENT, attackerSlot: seeded, targetSlots: [healer], missedSlots: [] }
    }
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
      '-sethp',
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
      const rosterIndex = this.switchedInRosterIndex(slotKey, team, species)
      const set = rosterIndex >= 0 ? team[rosterIndex] : null
      this.switchSeq[slotKey]++
      this.addedType[slotKey] = null
      this.active[slotKey] = this.withMergeStats(
        this.buildActiveView(species, hpPercent, fainted, status, set, this.switchSeq[slotKey], rosterIndex),
        side
      )
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
      // A lasting change (Mega, Primal, Ultra Burst - "detailschange") brings the new
      // forme's ability with it; a temporary one (Zen Mode, Disguise) keeps the old one.
      if (cmd === 'detailschange') current.ability = formeAbility(current.species, current.ability)
      this.withMergeStats(current, side)
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
    } else if (cmd === '-damage' || cmd === '-heal' || cmd === '-sethp') {
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
      } else if (parts[2] === 'Dynamax') {
        current.dynamaxed = true
        current.gigantamax = parts[3] === 'Gmax'
      } else {
        const badge = badgeFor(parts[2], parts[3])
        if (badge) current.volatiles = withBadge(current.volatiles, badge)
      }
    } else if (cmd === '-end') {
      if (parts[2] === 'Substitute') current.substituted = false
      if (parts[2] === 'Dynamax') {
        current.dynamaxed = false
        current.gigantamax = false
      }
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
    // Last Resort only works once every other move it knows has been used since it
    // came out (and it needs at least one other move).
    if (moveId === 'lastresort') {
      const others = source.moveSlots.filter((m) => m.id !== 'lastresort')
      if (others.length === 0 || others.some((m) => !m.used)) {
        return { basePower: null, fixedDamagePercent: null, fails: true }
      }
    }
    const foes = battle.sides[0].active.filter((p): p is SimPokemon => !!p && !p.fainted)
    const live = liveMovePower(battle, source, foes, moveId)
    // Its type as this Pokemon would use it (Judgment's plate, Tera Blast, Pixilate...).
    const type = liveMoveType(battle, source, foes[0] ?? null, moveId)
    if (live.fixedDamage !== null && foes[0]) {
      return { basePower: null, fixedDamagePercent: Math.min(100, (live.fixedDamage / foes[0].maxhp) * 100), type }
    }
    // A damage rule that can't be worked out ahead of time (Counter, Mirror Coat,
    // Metal Burst) - nothing to count on, same as its printed 0 power.
    if (live.dynamic && !live.varies && live.basePower === null) return { basePower: 0, fixedDamagePercent: null, type }
    return { basePower: live.basePower, fixedDamagePercent: null, type }
  }

  // For the switch list: the best multiplier each team member's own types get against
  // each foe out right now (its current types - Tera and the like included).
  private teamMatchups(team: ActivePokemonView[], side: 0 | 1 = 0): (number | null)[][] {
    const foes = side === 0 ? [this.active.p2a, this.active.p2b] : [this.active.p1a, this.active.p1b]
    return team.map((member) =>
      foes.map((foe) =>
        member.fainted || !foe || foe.fainted
          ? null
          : Math.max(...member.types.map((type) => getTypeEffectivenessMultiplier(type, foe.types)))
      )
    )
  }

  // The other way round: the worst multiplier each foe's types get against each team
  // member - by type alone (the move buttons are where abilities like Levitate count).
  private teamDefense(team: ActivePokemonView[], side: 0 | 1 = 0): (number | null)[][] {
    const foes = side === 0 ? [this.active.p2a, this.active.p2b] : [this.active.p1a, this.active.p1b]
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
  private moveEffectivenessView(side: 0 | 1 = 0): (Record<string, (number | null)[]> | null)[] {
    const battle = this.battleStream.battle
    const request = this.playerOn(side)?.latestRequest
    if (this.ended || !battle || !request || !('active' in request) || !request.active) return []
    const foeSlots = [0, 1].map((i) => battle.sides[1 - side].active[i] ?? null)
    return request.active.map((activeData, i) => {
      const source = battle.sides[side].active[i]
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
  private liveMovePowers(side: 0 | 1 = 0): (Record<string, LiveMovePower> | null)[] {
    const battle = this.battleStream.battle
    const request = this.playerOn(side)?.latestRequest
    if (this.ended || !battle || !request || !('active' in request) || !request.active) return []
    const foes = battle.sides[1 - side].active.filter((p): p is SimPokemon => !!p && !p.fainted)
    return request.active.map((activeData, i) => {
      const source = battle.sides[side].active[i]
      if (!source || source.fainted) return null
      const powers: Record<string, LiveMovePower> = {}
      for (const move of activeData.moves) {
        const power = liveMovePower(battle, source, foes, move.id)
        // Its type right now, when that isn't its printed one (see liveMoveType).
        const type = liveMoveType(battle, source, foes[0] ?? null, move.id)
        powers[move.id] = type !== battle.dex.moves.get(move.id).type ? { ...power, type } : power
      }
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
      abilityEvents: [...this.abilityEvents],
      request: this.ended ? null : this.requestWithTraps(),
      requestSeq: this.human.requestSeq,
      ended: this.ended,
      // The screen knows its own player as "You" (online, p1 goes by the host's real name).
      winner: this.winner === this.p1Name ? 'You' : this.winner,
      expGains: this.expGains,
      itemDrops: this.itemDrops,
      tmQuickCheck: this.tmQuickCheck,
      tmRewards: this.tmRewards,
      moneyGained: this.moneyGained,
      p1: field.p1,
      p2: field.p2,
      team,
      teamMatchups: this.teamMatchups(team),
      teamDefense: this.teamDefense(team),
      movePowers: this.liveMovePowers(),
      moveEffectiveness: this.moveEffectivenessView(),
      opponentTrainer,
      runCost: this.runCost(),
      canAffordRun: getMoney() >= (this.runCost() ?? 0),
      canForfeit: this.canForfeit(),
      opponentRoster: this.opponentRoster(),
      rewards: this.rewardsView(),
      chaosModifiers: this.opponent?.chaosModifiers ?? null,
      runBattle: !!this.opponent?.run,
      runFainted: this.runFainted,
      runItemReward: this.runItemReward,
      draftResult: this.draftResult,
      bossBattle: !!this.opponent?.isBoss,
      raid: this.opponent?.raid
        ? { gigantamax: this.opponent.raid.gigantamax, stars: this.opponent.raid.stars, caught: this.raidCatch }
        : null
    }
  }

  /** Online: the battle as one of the two players sees it (side 1, the friend's, flipped round). */
  onlineView(side: 0 | 1): BattleView {
    const guest = this.guestLog
    if (side === 0 || !guest) return this.view()
    const team = this.buildTeamView(1)
    const field = flipSnapshot(this.snapshotField())
    return {
      log: [...guest.log],
      logStates: [...guest.logStates],
      feedback: [...guest.feedback],
      moveEvents: [...guest.moveEvents],
      gimmickEvents: [...guest.gimmickEvents],
      abilityEvents: [...guest.abilityEvents],
      request: this.ended ? null : this.requestWithTraps(1),
      requestSeq: this.remote?.requestSeq,
      ended: this.ended,
      winner: this.winner !== null && this.winner === this.opponent?.name ? 'You' : this.winner,
      expGains: [],
      itemDrops: [],
      tmQuickCheck: false,
      tmRewards: [],
      moneyGained: 0,
      p1: field.p1,
      p2: field.p2,
      team,
      teamMatchups: this.teamMatchups(team, 1),
      teamDefense: this.teamDefense(team, 1),
      movePowers: this.liveMovePowers(1),
      moveEffectiveness: this.moveEffectivenessView(1),
      opponentTrainer: { name: this.p1Name, spriteId: this.opponent?.online?.hostSpriteId ?? '' },
      runCost: null,
      canAffordRun: true,
      canForfeit: true,
      opponentRoster: this.opponentRoster(0),
      rewards: null,
      chaosModifiers: null,
      runBattle: false,
      runFainted: [],
      runItemReward: false,
      draftResult: null,
      bossBattle: false,
      raid: null
    }
  }

  // Everything rollItemDrops (and the prize money) could pay out for winning,
  // with each chance - shown when hovering the opponent.
  private rewardsView(): BattleRewardsView | null {
    const opponent = this.opponent
    if (opponent?.noRewards || opponent?.run || opponent?.draft) return null
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
      money: opponent?.trainerId && !opponent.noPrizeMoney ? this.prizeMoney(getProgression().levelCap) : null,
      items,
      randomDropChance: opponent?.randomDropChance ?? 0,
      tms: opponent?.tmRewards?.length ? unownedRewardTms(opponent.tmRewards) : []
    }
  }
}
