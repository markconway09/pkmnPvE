import { randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import type {
  ExpGainResult,
  RunChoice,
  RunItemOffer,
  RunMonView,
  RunDifficulty,
  RunNodeKind,
  RunRewardLine,
  RunView
} from '../../shared/battle-types'
import {
  ROGUELITE_BOSS_COUNT,
  ROGUELITE_BOSS_EVERY,
  ROGUELITE_FINAL_FLOOR,
  ROGUELITE_MAX_TEAM,
  ROGUELITE_START_LEVEL,
  POKEMON_GENERATIONS,
  RANDOM_LEGENDARY_ITEM_ID,
  ROGUELITE_BOSS_CLASSES,
  RANDOM_POKEMON_ITEM_ID,
  rogueliteBossClassAt,
  rogueliteBossLabelAt,
  runDifficultyInfo,
  WILD_LOCATIONS
} from '../../shared/battle-types'
import {
  buildPokemonSummary,
  evolveSet,
  getEditorOptions,
  getItemSpritenum,
  levelUpMoveset,
  megaStonesFor,
  toID,
  runEvolutionOptions,
  type PokemonSet
} from './sim-access'
import { totalExpForSpeciesLevel, expProgressForLevel } from './exp'
import { copyBoxMonSet } from './box-store'
import { recordBestFloor } from './stats-store'
import { addItem } from './bag-store'
import { addMoney } from './money-store'
import { fillMoveset, recommendedLearnableMoves } from './auto-sets'
import { playerPathFor } from './save-paths'
import { onPlayerChange } from './player-session'
import { listTrainers } from './trainer-store'

/**
 * Roguelite mode: a run is a string of floors fought with copies of the player's
 * Pokemon, kept in its own file (save/players/<name>/run.json) so nothing in the
 * box, bag or progression is ever touched. It lasts until the whole team is beaten
 * (lost) or the last boss falls (won). Switching the menu between modes doesn't
 * affect it - it's only read and written here.
 */

interface RunMon {
  id: string
  set: PokemonSet
  exp: number
  // 0..1 of its max HP, and its status - carried from one battle into the next.
  hp: number
  status: string | null
}

interface StoredRun {
  status: RunView['status']
  floor: number
  bossesBeaten: number
  team: RunMon[]
  choices: RunChoice[]
  itemOffer: string[] | null
  // Why items are on offer: an item floor (worth a level too) or a trainer's reward.
  itemOfferReason?: 'floor' | 'reward'
  // An item floor's offer can be rerolled once - set once it has been.
  itemRerolled?: boolean
  // An item a new one pushed out, waiting for a new holder (or to be let go) before the
  // run moves on - fromMonId is who it was taken from.
  displacedItem?: { item: string; fromMonId: string } | null
  // Bosses this run has already fought, so the next boss floor picks someone new.
  usedBossIds: string[]
  starterSpecies: string
  // Chosen when the run starts (a run from before difficulties is Normal, any generation).
  difficulty?: RunDifficulty
  generation?: number | null
  // Paid out when the run ended - kept for the result banner.
  rewards?: RunRewardLine[]
}

// The run's level cap only goes up by beating a boss - a ceiling, not something to
// chase. It starts at FIRST_LEVEL_CAP and climbs evenly with each boss, to 100 for
// the Champion - about the level of each boss when you reach it.
const FIRST_LEVEL_CAP = 20

export function runLevelCap(bossesBeaten: number): number {
  const steps = ROGUELITE_BOSS_COUNT - 1
  return Math.round(FIRST_LEVEL_CAP + ((100 - FIRST_LEVEL_CAP) * Math.min(bossesBeaten, steps)) / steps)
}

// How strong this floor's opponents are: Lv 5 on the first floor, rising evenly to 98
// on the final one (the Champion, 2 above that, fights at 100). What the cap doesn't set.
const FIRST_OPPONENT_LEVEL = 5
const LAST_OPPONENT_LEVEL = 98

export function runOpponentLevel(floor: number): number {
  const progress = (Math.min(floor, ROGUELITE_FINAL_FLOOR) - 1) / (ROGUELITE_FINAL_FLOOR - 1)
  return Math.round(FIRST_OPPONENT_LEVEL + (LAST_OPPONENT_LEVEL - FIRST_OPPONENT_LEVEL) * progress)
}

// Levels every team member gains on each floor, up to the cap: a won battle (a boss
// is worth more), and a little for an item or rest floor too. Anyone below the
// team's strongest gains double, so a fresh catch catches up.
const LEVELS_PER_WILD_WIN = 3
const LEVELS_PER_TRAINER_WIN = 4
const LEVELS_PER_BOSS_WIN = 5
const LEVELS_PER_QUIET_FLOOR = 1

// How many Pokemon a regular trainer sends out: 1 for the first 9 floors, one more
// every 10 floors after, up to 6.
export function runTrainerTeamSize(floor: number): number {
  return Math.min(6, 1 + Math.floor(floor / 10))
}

// The bosses' team sizes, in the order they're met.
// Each boss's team size, in order: the Gym Leaders grow from 2 to 6; the Elite Four
// and the Champion bring a full 6.
const BOSS_TEAM_SIZES = [2, 3, 3, 4, 4, 5, 5, 6, 6, 6, 6, 6, 6]

export function runBossTeamSize(bossesBeaten: number): number {
  return BOSS_TEAM_SIZES[Math.min(bossesBeaten, BOSS_TEAM_SIZES.length - 1)]
}

// What an item floor can offer - held items that matter in a fight.
const HELD_ITEM_POOL = [
  'leftovers',
  'lifeorb',
  'choiceband',
  'choicespecs',
  'choicescarf',
  'focussash',
  'assaultvest',
  'rockyhelmet',
  'expertbelt',
  'eviolite',
  'heavydutyboots',
  'sitrusberry',
  'lumberry',
  'weaknesspolicy',
  'muscleband',
  'wiseglasses',
  'scopelens',
  'shellbell',
  'quickclaw',
  'kingsrock',
  'blackbelt',
  'charcoal',
  'mysticwater',
  'miracleseed',
  'magnet',
  'nevermeltice',
  'poisonbarb',
  'softsand',
  'sharpbeak',
  'twistedspoon',
  'silverpowder',
  'hardstone',
  'spelltag',
  'dragonfang',
  'blackglasses',
  'metalcoat',
  'silkscarf',
  'fairyfeather'
]
const ITEM_OFFER_SIZE = 3
// How often an offer includes a Mega Stone for a team member that can Mega Evolve with
// one (and isn't holding it yet): item floors often, trainer rewards now and then.
const MEGA_CHANCE_ITEM_FLOOR = 0.4
const MEGA_CHANCE_REWARD = 0.1

// Three held items to choose from - with a chance one of them is a Mega Stone that one
// of the team could actually use.
function rollItemOffer(current: StoredRun, megaChance: number): string[] {
  const offer = pickRandom(HELD_ITEM_POOL, ITEM_OFFER_SIZE)
  const held = new Set(current.team.map((m) => toID(m.set.item ?? '')))
  const stones = current.team.flatMap((m) => megaStonesFor(m.set.species)).filter((id) => !held.has(id))
  if (stones.length > 0 && Math.random() < megaChance) {
    offer[Math.floor(Math.random() * offer.length)] = pickRandom(stones, 1)[0]
  }
  return offer
}

function load(): StoredRun | null {
  const path = playerPathFor('run.json')
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as StoredRun
    if (!Array.isArray(parsed.team) || typeof parsed.floor !== 'number') return null
    // A run saved before floors had locations kept its choices as bare kinds.
    parsed.choices = (parsed.choices as (RunChoice | RunNodeKind)[]).map((c) => (typeof c === 'string' ? { kind: c } : c))
    return parsed
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code
    if (code !== 'ENOENT') console.error('[run-store] failed to load run.json:', e)
    return null
  }
}

// undefined = not read yet for this player; null = no run file.
let run: StoredRun | null | undefined

onPlayerChange(() => {
  run = undefined
})

function getRun(): StoredRun | null {
  if (run === undefined) run = load()
  return run
}

function activeRun(): StoredRun {
  const current = getRun()
  if (!current || current.status !== 'active') throw new Error('No run is in progress')
  return current
}

function persist(): void {
  writeFileSync(playerPathFor('run.json'), JSON.stringify(getRun()), 'utf8')
}

function pickRandom<T>(list: T[], count: number): T[] {
  const pool = [...list]
  const picked: T[] = []
  while (picked.length < count && pool.length > 0) picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0])
  return picked
}

function isBossFloor(floor: number): boolean {
  return floor % ROGUELITE_BOSS_EVERY === 0
}

// A regular floor's options, each rolled on its own from these weights: mostly wild
// Pokemon (the weight is shared out between the locations), then trainers, and rarely
// an item or a rest. A rest is only rolled once someone could use it.
const FLOOR_OPTIONS = 5
const CHOICE_WEIGHTS: Record<'wild' | 'trainer' | 'item' | 'heal', number> = { wild: 60, trainer: 25, item: 6, heal: 9 }
// The Professor's Lab takes the place of one wild option this often.
const LAB_CHANCE = 0.05
// The wild locations a floor can roll: all the regular ones, not "All" or the Lab.
const RUN_WILD_LOCATIONS = WILD_LOCATIONS.filter((l) => l.id !== 'all' && !l.requiresAllBosses).map((l) => l.id)

function rollChoice(hurt: boolean): RunChoice {
  const weights = { ...CHOICE_WEIGHTS, heal: hurt ? CHOICE_WEIGHTS.heal : 0 }
  let roll = Math.random() * Object.values(weights).reduce((a, b) => a + b, 0)
  for (const [kind, weight] of Object.entries(weights) as [keyof typeof weights, number][]) {
    roll -= weight
    if (roll >= 0) continue
    return kind === 'wild' ? { kind, location: pickRandom(RUN_WILD_LOCATIONS, 1)[0] } : { kind }
  }
  return { kind: 'trainer' }
}

const choiceKey = (c: RunChoice): string => `${c.kind}:${c.location ?? ''}`

// FLOOR_OPTIONS different options - an option already on the floor is rolled again,
// so there's at most one trainer, item and rest. A boss floor offers only the boss.
function rollChoices(current: StoredRun): RunChoice[] {
  if (isBossFloor(current.floor)) return [{ kind: 'boss' }]
  // No Rest floors at all on a no-healing difficulty.
  const hurt = !runDifficultyInfo(current.difficulty).noHealing && current.team.some((m) => m.hp < 1 || m.status)
  const choices: RunChoice[] = []
  for (let tries = 0; choices.length < FLOOR_OPTIONS && tries < 200; tries++) {
    const choice = rollChoice(hurt)
    if (!choices.some((c) => choiceKey(c) === choiceKey(choice))) choices.push(choice)
  }
  if (Math.random() < LAB_CHANCE) {
    const wildIndex = choices.findIndex((c) => c.kind === 'wild')
    choices[wildIndex >= 0 ? wildIndex : choices.length - 1] = { kind: 'wild', location: 'lab' }
  }
  return choices
}

function toView(mon: RunMon): RunMonView {
  const { percent } = expProgressForLevel(mon.set.species, mon.set.level, mon.exp)
  return {
    id: mon.id,
    exp: mon.exp,
    expPercent: percent,
    itemSpritenum: mon.set.item ? getItemSpritenum(mon.set.item) : null,
    eligibleEvolutions: runEvolutionOptions(mon.set),
    ...buildPokemonSummary(mon.set.species, mon.set),
    hpPercent: Math.round(mon.hp * 100),
    status: mon.status
  }
}

function itemOfferView(ids: string[]): RunItemOffer[] {
  const catalog = new Map(getEditorOptions().items.map((i) => [i.id, i]))
  return ids.flatMap((id) => {
    const item = catalog.get(id)
    return item ? [{ itemId: item.id, itemName: item.name, spritenum: item.spritenum }] : []
  })
}

/** The player's run, or null before their first one. */
export function getRunView(): RunView | null {
  const current = getRun()
  if (!current) return null
  return {
    status: current.status,
    floor: current.floor,
    bossesBeaten: current.bossesBeaten,
    levelCap: runLevelCap(current.bossesBeaten),
    opponentLevel: runOpponentLevel(current.floor),
    nextBossLabel: rogueliteBossLabelAt(current.bossesBeaten),
    team: current.team.map(toView),
    choices: current.status === 'active' ? current.choices : [],
    itemOffer: current.itemOffer ? itemOfferView(current.itemOffer) : null,
    itemOfferReason: current.itemOffer ? (current.itemOfferReason ?? 'floor') : null,
    canRerollItems: !!current.itemOffer && (current.itemOfferReason ?? 'floor') === 'floor' && !current.itemRerolled,
    displacedItem: current.displacedItem
      ? {
          itemName: current.displacedItem.item,
          spritenum: getItemSpritenum(current.displacedItem.item) ?? 0,
          fromMonId: current.displacedItem.fromMonId
        }
      : null,
    starterSpecies: current.starterSpecies,
    difficulty: current.difficulty ?? 'normal',
    generation: current.generation ?? null,
    rewards: current.rewards ?? []
  }
}

/**
 * The generations a run can be set to: those with at least one Roguelite boss of every
 * class (a Gym Leader, an Elite Four member and a Champion) - anything less and the run
 * would have to borrow bosses from other generations.
 */
export function completeRunGenerations(): number[] {
  const bosses = listTrainers().filter((t) => t.rogueliteBoss)
  return POKEMON_GENERATIONS.filter((generation) =>
    ROGUELITE_BOSS_CLASSES.every((c) =>
      bosses.some((t) => t.rogueliteGeneration === generation && t.rogueliteClass === c.id)
    )
  )
}

/** Starts a run with a Lv 5 copy of a box Pokemon - same species, moves and all, minus its held item. */
export function startRun(boxMonId: string, difficulty: RunDifficulty = 'normal', generation: number | null = null): RunView {
  if (getRun()?.status === 'active') throw new Error('A run is already in progress')
  if (generation !== null && !completeRunGenerations().includes(generation)) {
    throw new Error(`Generation ${generation} doesn't have a Gym Leader, an Elite Four member and a Champion yet`)
  }
  const source = copyBoxMonSet(boxMonId)
  const set: PokemonSet = { ...source, level: ROGUELITE_START_LEVEL, item: '' }
  run = {
    status: 'active',
    floor: 1,
    bossesBeaten: 0,
    team: [{ id: randomUUID(), set, exp: totalExpForSpeciesLevel(set.species, set.level), hp: 1, status: null }],
    choices: [],
    itemOffer: null,
    usedBossIds: [],
    starterSpecies: set.species,
    difficulty: runDifficultyInfo(difficulty).id,
    generation
  }
  run.choices = rollChoices(run)
  persist()
  return getRunView()!
}

/** Gives up on the run - it counts as lost. */
export function forfeitRun(): RunView {
  endRun(activeRun(), 'lost')
  return getRunView()!
}

function endRun(current: StoredRun, status: 'lost' | 'won'): void {
  current.status = status
  current.choices = []
  current.itemOffer = null
  current.rewards = payRunRewards(current)
  recordBestFloor(current.floor)
  persist()
}

// A run's rewards, paid when it ends however it ends: what each boss beaten is worth on
// its difficulty (see RUN_DIFFICULTIES), into the classic game's bag and money.
function payRunRewards(current: StoredRun): RunRewardLine[] {
  const reward = runDifficultyInfo(current.difficulty).reward
  const counts = new Map<string, number>()
  const give = (itemId: string): void => {
    counts.set(itemId, (counts.get(itemId) ?? 0) + 1)
  }
  const appliesTo = (who: typeof reward.randomPokemon, bossIndex: number): boolean =>
    who === 'all' || (!!who && who.includes(rogueliteBossClassAt(bossIndex)))
  let money = 0
  for (let i = 0; i < current.bossesBeaten; i++) {
    money += reward.money
    give(reward.expCandy)
    if (appliesTo(reward.randomPokemon, i)) give(RANDOM_POKEMON_ITEM_ID)
    if (appliesTo(reward.randomLegendary, i)) give(RANDOM_LEGENDARY_ITEM_ID)
  }
  const catalog = new Map(getEditorOptions().items.map((item) => [item.id, item]))
  const lines: RunRewardLine[] = []
  if (money > 0) {
    addMoney(money)
    lines.push({ itemId: null, label: `₽${money.toLocaleString('en-US')}`, spritenum: null, quantity: 1 })
  }
  for (const [itemId, quantity] of counts) {
    addItem(itemId, quantity)
    const item = catalog.get(itemId)
    lines.push({ itemId, label: item?.name ?? itemId, spritenum: item?.spritenum ?? null, quantity })
  }
  return lines
}

function nextFloor(current: StoredRun): void {
  current.floor += 1
  current.itemOffer = null
  current.itemRerolled = false
  current.choices = rollChoices(current)
}

/** One of this floor's options, by its place in the list (and nothing else may be pending). */
export function runChoiceAt(index: number): RunChoice {
  const current = activeRun()
  if (current.itemOffer) throw new Error('Pick an item first')
  if (current.displacedItem) throw new Error('Choose who gets the item that was replaced first')
  const choice = current.choices[index]
  if (!choice) throw new Error("This floor doesn't offer that")
  return { ...choice }
}

function levelUpTeam(current: StoredRun, levels: number): ExpGainResult[] {
  const cap = runLevelCap(current.bossesBeaten)
  const top = Math.max(...current.team.map((m) => m.set.level))
  return current.team.map((mon) => {
    const levelBefore = mon.set.level
    // Catching up never overtakes the leader - at most it draws level with it.
    const target = levelBefore < top ? Math.min(levelBefore + levels * 2, top + levels) : levelBefore + levels
    const levelAfter = Math.max(levelBefore, Math.min(cap, target))
    const expBefore = mon.exp
    if (levelAfter > levelBefore) {
      mon.set.level = levelAfter
      mon.exp = totalExpForSpeciesLevel(mon.set.species, levelAfter)
    }
    return { species: mon.set.species, gained: mon.exp - expBefore, levelBefore, levelAfter, cappedOut: levelBefore >= cap }
  })
}

/** A heal floor: everyone back to full HP, no status. */
export function takeHealNode(): RunView {
  const current = activeRun()
  for (const mon of current.team) {
    mon.hp = 1
    mon.status = null
  }
  levelUpTeam(current, LEVELS_PER_QUIET_FLOOR)
  nextFloor(current)
  persist()
  return getRunView()!
}

/** An item floor: offers a few held items to choose from. */
export function takeItemNode(): RunView {
  const current = activeRun()
  current.itemOffer = rollItemOffer(current, MEGA_CHANCE_ITEM_FLOOR)
  current.itemOfferReason = 'floor'
  persist()
  return getRunView()!
}

/** An item floor's offer, rolled again - once per floor (not for a trainer's reward). */
export function rerollRunItems(): RunView {
  const current = activeRun()
  if (!current.itemOffer || current.itemOfferReason !== 'floor') throw new Error('Only an item floor can be rerolled')
  if (current.itemRerolled) throw new Error('This floor has already been rerolled')
  current.itemOffer = rollItemOffer(current, MEGA_CHANCE_ITEM_FLOOR)
  current.itemRerolled = true
  persist()
  return getRunView()!
}

/** Turns down the items on offer and moves on (an item floor still gives its level). */
export function skipRunItem(): RunView {
  const current = activeRun()
  if (!current.itemOffer) throw new Error('No items are on offer')
  finishItemOffer(current)
  return getRunView()!
}

function finishItemOffer(current: StoredRun): void {
  if (current.itemOfferReason !== 'reward') levelUpTeam(current, LEVELS_PER_QUIET_FLOOR)
  current.itemOfferReason = undefined
  current.displacedItem = null
  nextFloor(current)
  persist()
}

/** Gives the chosen offered item to a team member (replacing what it held) and moves on. */
export function giveRunItem(itemId: string, runMonId: string): RunView {
  const current = activeRun()
  if (!current.itemOffer?.includes(itemId)) throw new Error("That item isn't on offer")
  const mon = current.team.find((m) => m.id === runMonId)
  if (!mon) throw new Error('That Pokemon is not on the run team')
  // Stored by name, the same as box Pokemon hold theirs.
  const previous = mon.set.item
  mon.set.item = itemOfferView([itemId])[0]?.itemName ?? itemId
  current.itemOffer = null
  if (previous) {
    // It already held something: that goes to whoever the player picks next (or is let go).
    current.displacedItem = { item: previous, fromMonId: mon.id }
    persist()
  } else {
    finishItemOffer(current)
  }
  return getRunView()!
}

/**
 * Hands the item a new one replaced to another team member - who, if it held one
 * too, now has that one waiting for a holder - or lets it go (runMonId null).
 */
export function placeDisplacedItem(runMonId: string | null): RunView {
  const current = activeRun()
  const displaced = current.displacedItem
  if (!displaced) throw new Error('No item is waiting for a holder')
  if (runMonId === null) {
    finishItemOffer(current)
    return getRunView()!
  }
  if (runMonId === displaced.fromMonId) throw new Error('That Pokemon just gave this item up')
  const mon = runMon(current, runMonId)
  const previous = mon.set.item
  mon.set.item = displaced.item
  if (previous) {
    current.displacedItem = { item: previous, fromMonId: mon.id }
    persist()
  } else {
    finishItemOffer(current)
  }
  return getRunView()!
}

/** Moves a run Pokemon's held item to another - swapping, if that one holds something too. */
export function moveRunItem(fromMonId: string, toMonId: string): RunView {
  const current = activeRun()
  if (fromMonId === toMonId) throw new Error('Pick a different Pokemon')
  const from = runMon(current, fromMonId)
  const to = runMon(current, toMonId)
  if (!from.set.item) throw new Error(`${from.set.species} isn't holding anything`)
  ;[from.set.item, to.set.item] = [to.set.item ?? '', from.set.item]
  persist()
  return getRunView()!
}

/** Puts the run's team in a new order - the first one leads every battle. */
export function reorderRunTeam(runMonIds: string[]): RunView {
  const current = activeRun()
  const byId = new Map(current.team.map((m) => [m.id, m]))
  if (runMonIds.length !== current.team.length || runMonIds.some((id) => !byId.has(id)) || new Set(runMonIds).size !== runMonIds.length) {
    throw new Error("That isn't the run's team")
  }
  current.team = runMonIds.map((id) => byId.get(id)!)
  persist()
  return getRunView()!
}

function runMon(current: StoredRun, runMonId: string): RunMon {
  const mon = current.team.find((m) => m.id === runMonId)
  if (!mon) throw new Error('That Pokemon is not on the run team')
  return mon
}

/** Evolves a run Pokemon (see runEvolutionOptions for when it's allowed). */
export function evolveRunMon(runMonId: string, targetSpecies: string): RunView {
  const current = activeRun()
  const mon = runMon(current, runMonId)
  if (!runEvolutionOptions(mon.set).includes(targetSpecies)) {
    throw new Error(`${mon.set.species} can't evolve into ${targetSpecies} yet`)
  }
  mon.set = evolveSet(mon.set, targetSpecies)
  mon.exp = totalExpForSpeciesLevel(mon.set.species, mon.set.level)
  persist()
  return getRunView()!
}

// Smogon's picks it can learn at its level, filled out with its newest level-up moves.
function bestRunMoveset(set: PokemonSet): string[] {
  return fillMoveset(recommendedLearnableMoves(set.species, set.level), levelUpMoveset(set.species, set.level))
}

/**
 * Gives a run Pokemon a fresh moveset for its level: moves from Smogon's sets for its
 * species first (those it can learn by now), then the newest ones it learns by
 * levelling up to fill the rest.
 */
export function relearnRunMoves(runMonId: string): RunView {
  const current = activeRun()
  const mon = runMon(current, runMonId)
  const moves = bestRunMoveset(mon.set)
  if (moves.length === 0) throw new Error(`${mon.set.species} has no moves it can learn yet`)
  mon.set.moves = moves
  persist()
  return getRunView()!
}

/** The run's team for a battle, with each Pokemon's carried-over HP and status. */
export function runBattleTeam(): { sets: PokemonSet[]; conditions: { hp: number; status: string | null }[] } {
  const current = activeRun()
  return {
    sets: current.team.map((m) => structuredClone(m.set)),
    conditions: current.team.map((m) => ({ hp: m.hp, status: m.status }))
  }
}

export function runFloorInfo(): {
  floor: number
  opponentLevel: number
  bossesBeaten: number
  usedBossIds: string[]
  difficulty: RunDifficulty
  generation: number | null
} {
  const current = activeRun()
  return {
    floor: current.floor,
    opponentLevel: runOpponentLevel(current.floor),
    bossesBeaten: current.bossesBeaten,
    usedBossIds: [...current.usedBossIds],
    difficulty: current.difficulty ?? 'normal',
    generation: current.generation ?? null
  }
}

export function markRunBossUsed(trainerId: string): void {
  const current = activeRun()
  if (!current.usedBossIds.includes(trainerId)) current.usedBossIds.push(trainerId)
  persist()
}

// The state each team member ended a battle in, in team order.
export interface RunBattleOutcome {
  hp: number
  status: string | null
  fainted: boolean
}

function applyOutcome(current: StoredRun, outcome: RunBattleOutcome[]): string[] {
  const fainted: string[] = []
  current.team = current.team.filter((mon, i) => {
    const result = outcome[i]
    if (!result) return true
    if (result.fainted) {
      fainted.push(mon.set.species)
      return false
    }
    mon.hp = result.hp
    mon.status = result.status
    return true
  })
  return fainted
}

/**
 * A won battle: the fainted leave the team, everyone left levels up, and the run
 * moves to the next floor - or ends, won, after the last boss. Beating a trainer or a
 * boss also pays out an item: the run waits on the next floor until one is picked.
 */
export function finishRunBattleWon(
  outcome: RunBattleOutcome[],
  kind: RunNodeKind
): { expGains: ExpGainResult[]; fainted: string[]; itemReward: boolean } {
  const wasBoss = kind === 'boss'
  const current = activeRun()
  const fainted = applyOutcome(current, outcome)
  // A beaten boss raises the cap first, so its levels count against the new one.
  if (wasBoss) current.bossesBeaten += 1
  const levels = wasBoss ? LEVELS_PER_BOSS_WIN : kind === 'trainer' ? LEVELS_PER_TRAINER_WIN : LEVELS_PER_WILD_WIN
  const expGains = levelUpTeam(current, levels)
  if (wasBoss && !runDifficultyInfo(current.difficulty).noHealing) {
    // A beaten boss patches the team up for the next stretch.
    for (const mon of current.team) {
      mon.hp = 1
      mon.status = null
    }
  }
  if (current.bossesBeaten >= ROGUELITE_BOSS_COUNT || current.floor >= ROGUELITE_FINAL_FLOOR) {
    endRun(current, 'won')
    return { expGains, fainted, itemReward: false }
  }
  if (kind === 'wild') {
    nextFloor(current)
    persist()
    return { expGains, fainted, itemReward: false }
  }
  current.itemOffer = rollItemOffer(current, MEGA_CHANCE_REWARD)
  current.itemOfferReason = 'reward'
  persist()
  return { expGains, fainted, itemReward: true }
}

/** A lost (or tied) battle: the whole team is down, so the run is over. */
export function finishRunBattleLost(): void {
  endRun(activeRun(), 'lost')
}

/** Ran from a wild Pokemon: no exp, but the floor still counts as cleared. */
export function finishRunBattleFled(outcome: RunBattleOutcome[]): void {
  const current = activeRun()
  applyOutcome(current, outcome)
  nextFloor(current)
  persist()
}

/** A wild Pokemon caught after a won run battle joins the run's team (never the box). */
export function addRunCatch(set: PokemonSet): void {
  const current = getRun()
  // The battle's win already moved the run on (or ended it, if that was the last floor).
  if (!current) throw new Error('No run is in progress')
  if (current.team.length >= ROGUELITE_MAX_TEAM) throw new Error(`Your run team is full (${ROGUELITE_MAX_TEAM})`)
  const caught: PokemonSet = { ...structuredClone(set), item: '' }
  // It arrives with the same moveset Update moves would give it (Smogon first).
  const moves = bestRunMoveset(caught)
  if (moves.length > 0) caught.moves = moves
  current.team.push({
    id: randomUUID(),
    set: caught,
    exp: totalExpForSpeciesLevel(caught.species, caught.level),
    hp: 1,
    status: null
  })
  persist()
}

export function runTeamIsFull(): boolean {
  return (getRun()?.team.length ?? 0) >= ROGUELITE_MAX_TEAM
}
