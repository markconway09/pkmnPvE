import { createRequire } from 'node:module'
import { readFileSync, writeFileSync } from 'node:fs'
import { FIELD_START_TERRAINS, FIELD_START_WEATHERS, type AiDifficulty, type StatBlock } from '../../shared/battle-types'
import {
  CHAOS_BANNED_ABILITIES,
  CHAOS_FORTRESS,
  CHAOS_GLASS_CANNON,
  CHAOS_MAX_SPIKES,
  CHAOS_PICKS_PER_STAGE,
  CHAOS_STAT_BOOST,
  CHAOS_STAT_LABELS,
  draftBring,
  DRAFT_ENTRY_FEE,
  DRAFT_LEVEL,
  DRAFT_MAX_LOSSES,
  DRAFT_MAX_WINS,
  DRAFT_PACK_SIZE,
  DRAFT_ROUNDS,
  draftReward,
  type ChaosField,
  type ChaosModifier,
  type ChaosModifierTarget,
  type ChaosTutorMove,
  type DraftBattleResult,
  type DraftFormat,
  type DraftMonView,
  type DraftView
} from '../../shared/draft'
import smogonSets from './data/smogon-sets.json'
import {
  abilityInfo,
  buildPokemonSummary,
  getEditorOptions,
  getItemSpritenum,
  moveDescription,
  speciesRarityTier,
  type PokemonSet
} from './sim-access'
import { changeCoins } from './game-corner-store'
import { countAchievement, recordAchievementBest } from './achievement-progress'
import { hasTitle } from './title-perks'
import { GRAND_DRAFTER_FEE_MULTIPLIER } from '../../shared/titles'
import { listTrainers } from './trainer-store'
import { playerPathFor } from './save-paths'
import { onPlayerChange } from './player-session'

// pokemon-showdown is CommonJS - loaded the same way sim-access.ts does.
const require = createRequire(import.meta.url)
const { Dex } = require('pokemon-showdown') as typeof import('pokemon-showdown')

/**
 * Draft mode (see shared/draft.ts): the picks, the gauntlet's record and the next
 * opponent, kept in the player's draft.json. Every Pokemon - the player's and the
 * opponents' - comes with one of Smogon's sets for the draft's format, item included.
 */

// The Smogon sets each format drafts from (all already in data/smogon-sets.json).
// Doubles: Doubles OU, newest generations only - the older ones lean on moves and items
// this game's battles don't have.
const DOUBLES_SET_FORMATS = ['gen9doublesou', 'gen8doublesou', 'gen7doublesou']
// Singles: Gen 9's tiers, strongest first. Each singles draft quietly picks one tier at
// random and drafts from it and the tier below (ZU, the lowest, on its own - see rollSinglesTiers),
// so everyone's Pokemon - the player's and every opponent's - are of about the same
// strength. Little Cup is left out: its sets are for level 5 Pokemon.
const SINGLES_TIERS = ['gen9ubers', 'gen9ou', 'gen9uu', 'gen9ru', 'gen9nu', 'gen9pu', 'gen9zu']
// What singles drafts from before it picked tiers (a draft saved then still uses it).
const OLD_SINGLES_SET_FORMATS = ['gen9ou', 'gen9uu', 'gen9ru', 'gen9nu', 'gen9pu', 'gen9zu']

// ZU, having no tier below it, is drafted on its own when it has this many species with
// usable sets (packs stay varied) - otherwise with PU above it.
const MIN_SOLO_TIER_SPECIES = 60

function rollSinglesTiers(): string[] {
  const i = Math.floor(Math.random() * SINGLES_TIERS.length)
  if (i < SINGLES_TIERS.length - 1) return [SINGLES_TIERS[i], SINGLES_TIERS[i + 1]]
  const lowest = [SINGLES_TIERS[i]]
  return draftPool(lowest).length >= MIN_SOLO_TIER_SPECIES ? lowest : [SINGLES_TIERS[i - 1], SINGLES_TIERS[i]]
}

type OneOrMany = string | string[]
interface SmogonSet {
  format: string
  name: string
  moves: OneOrMany[]
  ability?: OneOrMany
  item?: OneOrMany
  nature?: OneOrMany
  evs?: Partial<StatBlock> | Partial<StatBlock>[]
  ivs?: Partial<StatBlock> | Partial<StatBlock>[]
  teratypes?: OneOrMany
}

interface DraftPick {
  set: PokemonSet
  setName: string
  // Chaos: how many +50% boosts each stat has had, and how many Glass Cannons.
  boosts?: Partial<Record<keyof StatBlock, number>>
  glassCannon?: number
  fortress?: number
}

interface StoredDraft {
  status: DraftView['status']
  // Drafts from before singles existed have none - they were all doubles.
  format?: DraftFormat
  // The Smogon formats every Pokemon in this draft comes from (see SINGLES_TIERS).
  setFormats?: string[]
  picks: DraftPick[]
  pack: DraftPick[]
  wins: number
  losses: number
  // Chaos: `field` is the opponent's own battle-start modifiers.
  opponent: { name: string; spriteId: string; team: DraftPick[]; field?: ChaosField } | null
  reward: number
  // A battle was started and hasn't come back yet - if the game closes mid-battle, it
  // counts as lost when the draft is next loaded (no quitting out of a losing fight).
  inBattle?: boolean
  // Chaos: the picks this drafting stretch ends at, and what comes after it.
  pickTarget?: number
  afterDraft?: 'modifier' | 'battling'
  // Chaos: this drafting stretch's pack reroll has been used.
  rerolled?: boolean
  // Chaos: the field modifiers taken, and the modifiers on offer.
  chaosField?: ChaosField
  modifierOffer?: ChaosModifier[]
}

function list<T>(value: T | T[] | undefined): T[] {
  return value === undefined ? [] : Array.isArray(value) ? value : [value]
}

function statBlock(fill: number, partial?: Partial<StatBlock>): StatBlock {
  const block = { hp: fill, atk: fill, def: fill, spa: fill, spd: fill, spe: fill }
  for (const key of Object.keys(block) as (keyof StatBlock)[]) {
    if (typeof partial?.[key] === 'number') block[key] = partial[key]!
  }
  return block
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

// A Smogon set made into a battle-ready one at the draft's level: each move slot takes
// its first option that works here (no Max moves, nor a Z-Move as a move of its own - those
// come from the move it powers up), the item its first option, Z-Crystals included (its
// Z-Move is there to use once a battle). Null when there aren't four usable moves.
function buildDraftSet(speciesId: string, smogon: SmogonSet): PokemonSet | null {
  const species = Dex.species.get(speciesId)
  if (!species.exists) return null
  const moves: string[] = []
  for (const slot of smogon.moves) {
    const pick = list(slot)
      .map((name) => Dex.moves.get(name))
      .find((move) => move.exists && !move.isZ && !move.isMax && !moves.includes(move.name))
    if (pick) moves.push(pick.name)
  }
  if (moves.length < 4) return null
  const abilities = Object.values(species.abilities) as string[]
  const ability = list(smogon.ability).find((name) => abilities.includes(name)) ?? abilities[0]
  const item =
    list(smogon.item)
      .map((name) => Dex.items.get(name))
      .find((it) => it.exists)?.name ?? 'Sitrus Berry'
  return {
    name: species.name,
    species: species.name,
    item,
    ability,
    moves: moves.slice(0, 4),
    nature: list(smogon.nature)[0] ?? 'Hardy',
    gender: species.gender ?? '',
    evs: statBlock(0, list(smogon.evs)[0]),
    ivs: statBlock(31, list(smogon.ivs)[0]),
    level: DRAFT_LEVEL,
    teraType: list(smogon.teratypes)[0] ?? species.types[0]
  } as PokemonSet
}

// For a list of Smogon formats, every species with at least one usable set from them,
// with those sets ready to go.
type DraftPool = { baseSpecies: string; picks: DraftPick[] }[]
const cachedPools = new Map<string, DraftPool>()

function draftPool(setFormats: string[]): DraftPool {
  const key = setFormats.join(',')
  let pool = cachedPools.get(key)
  if (!pool) {
    pool = []
    const wanted = new Set(setFormats)
    for (const [speciesId, sets] of Object.entries(smogonSets as unknown as Record<string, SmogonSet[]>)) {
      const picks = sets
        .filter((s) => wanted.has(s.format))
        .flatMap((s) => {
          const set = buildDraftSet(speciesId, s)
          return set ? [{ set, setName: s.name }] : []
        })
      if (picks.length > 0) pool.push({ baseSpecies: Dex.species.get(speciesId).baseSpecies, picks })
    }
    cachedPools.set(key, pool)
  }
  return pool
}

function formatOf(current: StoredDraft): DraftFormat {
  return current.format ?? 'doubles'
}

function setFormatsOf(current: StoredDraft): string[] {
  return current.setFormats ?? (formatOf(current) === 'singles' ? OLD_SINGLES_SET_FORMATS : DOUBLES_SET_FORMATS)
}

// `count` Pokemon of different species (none sharing a base species with `taken`), each
// with one of its sets from these Smogon formats at random.
function rollMons(setFormats: string[], count: number, taken: DraftPick[]): DraftPick[] {
  const used = new Set(taken.map((p) => Dex.species.get(p.set.species).baseSpecies))
  const options = draftPool(setFormats).filter((entry) => !used.has(entry.baseSpecies))
  const rolled: DraftPick[] = []
  while (rolled.length < count && options.length > 0) {
    const [entry] = options.splice(Math.floor(Math.random() * options.length), 1)
    const pick = pickRandom(entry.picks)
    rolled.push({ set: { ...pick.set, moves: [...pick.set.moves] }, setName: pick.setName })
  }
  return rolled
}

// The next opponent: a regular trainer's name and look, with a fresh drafted-style team.
function rollOpponent(setFormats: string[], size = DRAFT_ROUNDS): NonNullable<StoredDraft['opponent']> {
  const trainers = listTrainers().filter((t) => !t.isBoss && !t.rogueliteBoss && !t.teamRocket)
  const trainer = trainers.length > 0 ? pickRandom(trainers) : null
  return {
    name: trainer?.name ?? 'Draft Rival',
    spriteId: trainer?.spriteId ?? 'acetrainer',
    team: rollMons(setFormats, size, [])
  }
}

let draft: StoredDraft | null | undefined

onPlayerChange(() => {
  draft = undefined
})

function getDraft(): StoredDraft | null {
  if (draft === undefined) {
    try {
      draft = JSON.parse(readFileSync(playerPathFor('draft.json'), 'utf8')) as StoredDraft
    } catch {
      draft = null
    }
    if (draft?.inBattle) {
      draft.inBattle = false
      recordResult(draft, false)
      persist()
    }
  }
  return draft
}

function persist(): void {
  writeFileSync(playerPathFor('draft.json'), JSON.stringify(draft ?? null), 'utf8')
}

function activeDraft(status: DraftView['status']): StoredDraft {
  const current = getDraft()
  if (!current || current.status !== status) {
    throw new Error(status === 'drafting' ? "You're not drafting right now" : 'No draft gauntlet in progress')
  }
  return current
}

// The draft is over: it pays out by its wins (and counts for the Draft achievements).
function finish(current: StoredDraft): void {
  current.status = 'finished'
  current.pack = []
  current.opponent = null
  current.reward = draftReward(current.wins)
  if (current.reward > 0) changeCoins(current.reward)
  countAchievement('draftsFinished')
  // Chaos is just for fun: only the general Draft achievements count it.
  if (current.wins >= DRAFT_MAX_WINS && formatOf(current) === 'chaos') {
    if (current.losses === 0) countAchievement('perfectDrafts')
  } else if (current.wins >= DRAFT_MAX_WINS) {
    countAchievement(formatOf(current) === 'singles' ? 'perfectSinglesDrafts' : 'perfectDoublesDrafts')
    // The top tier of a singles draft's pool: Ubers (with OU), or ZU.
    const top = formatOf(current) === 'singles' ? setFormatsOf(current)[0] : null
    if (top === 'gen9ubers') countAchievement('ubersPerfectDrafts')
    if (top === 'gen9zu') countAchievement('zuPerfectDrafts')
    if (current.losses === 0) countAchievement('perfectDrafts')
  }
}

function recordResult(current: StoredDraft, won: boolean): void {
  if (won) {
    current.wins++
    countAchievement('draftBattlesWon')
    recordAchievementBest('draftBestWins', current.wins)
  } else {
    current.losses++
  }
  if (current.wins >= DRAFT_MAX_WINS || current.losses >= DRAFT_MAX_LOSSES) finish(current)
  else if (formatOf(current) === 'chaos') nextChaosStage(current)
  else current.opponent = rollOpponent(setFormatsOf(current))
}

// ---- Chaos (see shared/draft.ts) ----

// After a chaos battle: two more picks after the 1st, 3rd, 5th... battle while the team
// isn't full, otherwise a modifier.
function nextChaosStage(current: StoredDraft): void {
  current.opponent = null
  const played = current.wins + current.losses
  if (played % 2 === 1 && current.picks.length < DRAFT_ROUNDS) {
    current.status = 'drafting'
    current.pickTarget = Math.min(DRAFT_ROUNDS, current.picks.length + CHAOS_PICKS_PER_STAGE)
    current.afterDraft = 'battling'
    current.rerolled = false
    current.pack = offerPack(setFormatsOf(current), current.picks)
  } else {
    offerModifiers(current)
  }
}

// Every modifier, by type: each weather and terrain (not the one already up), the other
// battle-start ones not taken yet, then the Pokemon ones.
function offerModifiers(current: StoredDraft): void {
  const field = chaosFieldOf(current)
  const offer: ChaosModifier[] = [
    ...FIELD_START_WEATHERS.filter((o) => o.id !== field.weather).map((o) => ({ kind: 'weather' as const, id: o.id })),
    ...FIELD_START_TERRAINS.filter((o) => o.id !== field.terrain).map((o) => ({ kind: 'terrain' as const, id: o.id })),
    ...(field.trickRoom ? [] : [{ kind: 'trickroom' as const }]),
    ...(field.tailwind ? [] : [{ kind: 'tailwind' as const }]),
    ...(field.screens ? [] : [{ kind: 'screens' as const }]),
    ...(field.stealthRock ? [] : [{ kind: 'hazard' as const, id: 'stealthrock' as const }]),
    ...(field.stickyWeb ? [] : [{ kind: 'hazard' as const, id: 'stickyweb' as const }]),
    ...((field.spikes ?? 0) >= CHAOS_MAX_SPIKES ? [] : [{ kind: 'hazard' as const, id: 'spikes' as const }]),
    ...(field.intimidate ? [] : [{ kind: 'intimidate' as const }]),
    { kind: 'ability' },
    { kind: 'stat' },
    { kind: 'tutor' },
    { kind: 'glasscannon' },
    { kind: 'fortress' },
    { kind: 'wildcard' },
    { kind: 'item' }
  ]
  current.status = 'modifier'
  current.pack = []
  current.modifierOffer = offer
}

// On to the battle: a hard trainer bringing as many Pokemon as the player has.
function startChaosBattleStage(current: StoredDraft): void {
  current.status = 'battling'
  current.pack = []
  current.modifierOffer = []
  current.opponent = rollOpponent(setFormatsOf(current), current.picks.length)
  giveOpponentModifiers(current, current.opponent)
}

// A chaos opponent's modifiers: half the battle number (rounded down), each a battle-start
// one they don't have yet - a weather or terrain only when the player has none up - or a
// +50% boost to one of their Pokemon's best stat (not HP).
function giveOpponentModifiers(current: StoredDraft, opponent: NonNullable<StoredDraft['opponent']>): void {
  const mine = chaosFieldOf(current)
  const theirs: ChaosField = { weather: null, terrain: null, trickRoom: false }
  const count = Math.floor((current.wins + current.losses + 1) / 2)
  for (let n = 0; n < count; n++) {
    const options: (() => void)[] = [
      () => {
        const mon = pickRandom(opponent.team)
        const stats = buildPokemonSummary(mon.set.species, mon.set).stats
        const best = (['atk', 'def', 'spa', 'spd', 'spe'] as const).reduce((a, b) => (stats[b] > stats[a] ? b : a))
        mon.boosts = { ...mon.boosts, [best]: (mon.boosts?.[best] ?? 0) + 1 }
      }
    ]
    if (!mine.weather && !theirs.weather) options.push(() => (theirs.weather = pickRandom(FIELD_START_WEATHERS).id))
    if (!mine.terrain && !theirs.terrain) options.push(() => (theirs.terrain = pickRandom(FIELD_START_TERRAINS).id))
    if (!theirs.trickRoom) options.push(() => (theirs.trickRoom = true))
    if (!theirs.tailwind) options.push(() => (theirs.tailwind = true))
    if (!theirs.screens) options.push(() => (theirs.screens = true))
    if (!theirs.stealthRock) options.push(() => (theirs.stealthRock = true))
    if (!theirs.stickyWeb) options.push(() => (theirs.stickyWeb = true))
    if ((theirs.spikes ?? 0) < CHAOS_MAX_SPIKES) options.push(() => (theirs.spikes = (theirs.spikes ?? 0) + 1))
    if (!theirs.intimidate) options.push(() => (theirs.intimidate = true))
    pickRandom(options)()
  }
  opponent.field = theirs
}

function chaosFieldOf(current: StoredDraft): ChaosField {
  return current.chaosField ?? { weather: null, terrain: null, trickRoom: false }
}

/** The abilities an Ability modifier can give (every real one but CHAOS_BANNED_ABILITIES). */
export function chaosAbilityChoices(): { id: string; name: string; description: string }[] {
  const banned = new Set(CHAOS_BANNED_ABILITIES)
  return Dex.abilities
    .all()
    .filter((a) => a.exists && a.num > 0 && !a.isNonstandard && !banned.has(a.id))
    .flatMap((a) => {
      const info = abilityInfo(a.id)
      return info ? [info] : []
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

// Held items that do something in battle without a handler of their own (the sim checks
// for them elsewhere) - kept alongside the ones that have one.
const CHAOS_HANDLERLESS_ITEMS = new Set([
  'bindingband',
  'blunderpolicy',
  'damprock',
  'gripclaw',
  'heatrock',
  'heavydutyboots',
  'icyrock',
  'lightclay',
  'smoothrock',
  'terrainextender',
  'protectivepads'
])

// A held item that does something in battle: one with an effect of its own (berries,
// Choice items, Leftovers...), a Mega Stone, Z-Crystal or forme item, or one of the
// above - never a Poke Ball, fossil, evolution stone, TR or Mail.
function isUsefulHeldItem(id: string): boolean {
  const item = Dex.items.get(id)
  if (!item.exists || item.isPokeball || item.isNonstandard === 'CAP' || item.id === 'mail') return false
  if (CHAOS_HANDLERLESS_ITEMS.has(item.id) || item.megaStone || item.zMove || item.forcedForme || item.itemUser) return true
  return Object.keys(item).some((key) => /^on[A-Z]/.test(key) && (item as unknown as Record<string, unknown>)[key] !== undefined)
}

/** The useful held items (see isUsefulHeldItem), for the Held Item modifier. */
export function chaosItemChoices(): { id: string; name: string; description: string; spritenum: number }[] {
  return getEditorOptions().items.filter((i) => isUsefulHeldItem(i.id))
}

// A move the Move Tutor can teach: any real move but Z-Moves, Max Moves and Struggle.
function isTutorMove(id: string): boolean {
  const move = Dex.moves.get(id)
  return (
    move.exists &&
    move.num > 0 &&
    !move.isZ &&
    !move.isMax &&
    move.id !== 'struggle' &&
    move.isNonstandard !== 'CAP' &&
    move.isNonstandard !== 'LGPE' &&
    move.isNonstandard !== 'Gigantamax'
  )
}

/** Every move the Move Tutor can teach this Pokemon (any move in the game it doesn't know). */
export function chaosTutorMoves(pickIndex: number): ChaosTutorMove[] {
  const current = activeDraft('modifier')
  const pick = current.picks[pickIndex]
  if (!pick) throw new Error("That Pokémon isn't on your team")
  const known = new Set(pick.set.moves.map((m) => Dex.moves.get(m).id))
  return Dex.moves
    .all()
    .filter((move) => isTutorMove(move.id) && !known.has(move.id))
    .map((move) => ({ id: move.id, name: move.name, type: move.type, category: move.category, description: moveDescription(move) }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

// Wild Card: a random Pokemon from the tier above this draft's strongest (Ubers stays Ubers).
function wildCardTier(current: StoredDraft): string {
  const top = SINGLES_TIERS.indexOf(setFormatsOf(current)[0])
  return SINGLES_TIERS[Math.max(0, top < 0 ? 1 : top - 1)]
}

/** Chaos: a fresh pack in place of this one - once per drafting stretch. */
export function rerollDraftPack(): DraftView {
  const current = activeDraft('drafting')
  if (formatOf(current) !== 'chaos') throw new Error('Only chaos drafts can reroll')
  if (current.rerolled) throw new Error('Already rerolled this draft phase')
  current.rerolled = true
  current.pack = offerPack(setFormatsOf(current), current.picks)
  persist()
  return getDraftView()!
}

/** Takes one of the offered chaos modifiers (an Ability or Stat one on the chosen Pokemon). */
export function chooseChaosModifier(index: number, target?: ChaosModifierTarget): DraftView {
  const current = activeDraft('modifier')
  const modifier = current.modifierOffer?.[index]
  if (!modifier) throw new Error("That modifier isn't on offer")
  const field = chaosFieldOf(current)
  if (modifier.kind === 'weather') field.weather = modifier.id
  else if (modifier.kind === 'terrain') field.terrain = modifier.id
  else if (modifier.kind === 'trickroom') field.trickRoom = true
  else if (modifier.kind === 'tailwind') field.tailwind = true
  else if (modifier.kind === 'screens') field.screens = true
  else if (modifier.kind === 'intimidate') field.intimidate = true
  else if (modifier.kind === 'hazard' && modifier.id === 'stealthrock') field.stealthRock = true
  else if (modifier.kind === 'hazard' && modifier.id === 'stickyweb') field.stickyWeb = true
  else if (modifier.kind === 'hazard') field.spikes = Math.min(CHAOS_MAX_SPIKES, (field.spikes ?? 0) + 1)
  else {
    const pick = target ? current.picks[target.pick] : undefined
    if (!pick) throw new Error('Pick one of your Pokémon')
    if (modifier.kind === 'ability') {
      const ability = Dex.abilities.get(target?.ability ?? '')
      if (!ability.exists || !chaosAbilityChoices().some((a) => a.id === ability.id)) throw new Error("That ability can't be given")
      pick.set.ability = ability.name
    } else if (modifier.kind === 'stat') {
      const stat = target?.stat
      if (!stat || !(stat in CHAOS_STAT_LABELS)) throw new Error('Pick a stat to boost')
      pick.boosts = { ...pick.boosts, [stat]: (pick.boosts?.[stat] ?? 0) + 1 }
    } else if (modifier.kind === 'glasscannon') {
      pick.glassCannon = (pick.glassCannon ?? 0) + 1
    } else if (modifier.kind === 'fortress') {
      pick.fortress = (pick.fortress ?? 0) + 1
    } else if (modifier.kind === 'item') {
      const item = Dex.items.get(target?.item ?? '')
      if (!isUsefulHeldItem(item.id)) throw new Error('Pick an item')
      pick.set.item = item.name
    } else if (modifier.kind === 'tutor') {
      const slot = target?.moveSlot ?? -1
      const learned = Dex.moves.get(target?.newMove ?? '')
      if (!pick.set.moves[slot]) throw new Error('Pick a move to forget')
      if (!isTutorMove(learned.id) || pick.set.moves.some((m) => Dex.moves.get(m).id === learned.id)) throw new Error('Pick a move it can learn')
      pick.set.moves = pick.set.moves.map((m, i) => (i === slot ? learned.name : m))
    } else if (modifier.kind === 'wildcard') {
      // A new Pokemon in its place - the stat modifiers on that spot stay.
      const [replacement] = rollMons([wildCardTier(current)], 1, current.picks)
      if (!replacement) throw new Error('No Pokémon left to swap in')
      current.picks[target!.pick] = { ...replacement, boosts: pick.boosts, glassCannon: pick.glassCannon, fortress: pick.fortress }
    }
  }
  current.chaosField = field
  startChaosBattleStage(current)
  persist()
  return getDraftView()!
}

// A pick's stat multipliers from its chaos boosts and Glass Cannons (1 where there are none).
function boostMultipliers(pick: DraftPick): StatBlock {
  const block = statBlock(1)
  for (const [stat, count] of Object.entries(pick.boosts ?? {}) as [keyof StatBlock, number][]) {
    block[stat] = CHAOS_STAT_BOOST ** count
  }
  const cannons = pick.glassCannon ?? 0
  if (cannons > 0) {
    for (const stat of ['atk', 'spa', 'spe'] as const) block[stat] *= CHAOS_GLASS_CANNON.attack ** cannons
    for (const stat of ['def', 'spd'] as const) block[stat] *= CHAOS_GLASS_CANNON.defense ** cannons
  }
  const fortresses = pick.fortress ?? 0
  if (fortresses > 0) {
    for (const stat of ['hp', 'def', 'spd'] as const) block[stat] *= CHAOS_FORTRESS.defense ** fortresses
    for (const stat of ['atk', 'spa', 'spe'] as const) block[stat] *= CHAOS_FORTRESS.attack ** fortresses
  }
  return block
}

// Its stat modifiers in words, for the badge under its icon.
function chaosTags(pick: DraftPick): string[] | undefined {
  const tags = (Object.entries(pick.boosts ?? {}) as [keyof StatBlock, number][]).map(
    ([stat, count]) => `${CHAOS_STAT_LABELS[stat]}${count > 1 ? ` x${count}` : ''}`
  )
  if (pick.glassCannon) tags.push(`Glass Cannon${pick.glassCannon > 1 ? ` x${pick.glassCannon}` : ''}`)
  if (pick.fortress) tags.push(`Fortress${pick.fortress > 1 ? ` x${pick.fortress}` : ''}`)
  return tags.length > 0 ? tags : undefined
}

// The battle's starting field from the chaos modifiers (see ChaosField).
// Both sides' modifiers together: Tailwind and screens on their own side, hazards and the
// Attack drop on the other one. Trick Room from both cancels out.
function chaosStartField(
  mine: ChaosField,
  theirs: ChaosField = { weather: null, terrain: null, trickRoom: false }
): {
  weather: string | null
  terrain: string | null
  trickRoom: boolean
  sideConditions: { side: 0 | 1; id: string; layers?: number }[]
  leadAtkDrop: (0 | 1)[]
} {
  const sideConditions: { side: 0 | 1; id: string; layers?: number }[] = []
  const leadAtkDrop: (0 | 1)[] = []
  ;([
    [mine, 0],
    [theirs, 1]
  ] as const).forEach(([field, own]) => {
    const other = own === 0 ? 1 : 0
    if (field.tailwind) sideConditions.push({ side: own, id: 'tailwind' })
    if (field.screens) sideConditions.push({ side: own, id: 'reflect' }, { side: own, id: 'lightscreen' })
    if (field.stealthRock) sideConditions.push({ side: other, id: 'stealthrock' })
    if (field.stickyWeb) sideConditions.push({ side: other, id: 'stickyweb' })
    if (field.spikes) sideConditions.push({ side: other, id: 'spikes', layers: field.spikes })
    if (field.intimidate) leadAtkDrop.push(other)
  })
  return {
    weather: mine.weather ?? theirs.weather,
    terrain: mine.terrain ?? theirs.terrain,
    trickRoom: mine.trickRoom !== theirs.trickRoom,
    sideConditions,
    leadAtkDrop
  }
}

function toView(pick: DraftPick): DraftMonView {
  const summary = buildPokemonSummary(pick.set.species, pick.set)
  if (pick.boosts || pick.glassCannon || pick.fortress) {
    const multipliers = boostMultipliers(pick)
    const stats = { ...summary.stats }
    for (const key of Object.keys(stats) as (keyof StatBlock)[]) stats[key] = Math.floor(stats[key] * multipliers[key])
    summary.stats = stats
  }
  return {
    ...summary,
    chaosTags: chaosTags(pick),
    setName: pick.setName,
    itemSpritenum: pick.set.item ? getItemSpritenum(pick.set.item) : null,
    moveList: pick.set.moves.map((m) => {
      const move = Dex.moves.get(m)
      return { name: move.name, type: move.type }
    }),
    rarityTier: speciesRarityTier(pick.set.species)
  }
}

/** The player's draft, or null before their first one. */
export function getDraftView(): DraftView | null {
  const current = getDraft()
  if (!current) return null
  return {
    status: current.status,
    format: formatOf(current),
    tiers: formatOf(current) !== 'doubles' ? setFormatsOf(current).map(tierLabel) : null,
    picks: current.picks.map(toView),
    pack: current.pack.map(toView),
    round: current.picks.length + 1,
    wins: current.wins,
    losses: current.losses,
    opponent: current.opponent
      ? {
          name: current.opponent.name,
          spriteId: current.opponent.spriteId,
          team: current.opponent.team.map(toView),
          chaosField: current.opponent.field
        }
      : null,
    reward: current.reward,
    pickTarget: formatOf(current) === 'chaos' ? current.pickTarget : undefined,
    canReroll: formatOf(current) === 'chaos' && current.status === 'drafting' && !current.rerolled,
    chaosField: formatOf(current) === 'chaos' ? chaosFieldOf(current) : undefined,
    modifierOffer: current.status === 'modifier' ? current.modifierOffer : undefined
  }
}

// "gen9ubers" -> "Ubers", "gen9ou" -> "OU".
function tierLabel(setFormat: string): string {
  const tier = setFormat.replace(/^gen\d+/, '')
  return tier === 'ubers' ? 'Ubers' : tier.toUpperCase()
}

// A new pack for the player: one with a legendary-rarity card counts for Lucky Pack.
function offerPack(setFormats: string[], taken: DraftPick[]): DraftPick[] {
  const pack = rollMons(setFormats, DRAFT_PACK_SIZE, taken)
  if (pack.some((p) => speciesRarityTier(p.set.species) === 'legendary')) countAchievement('luckyPacks')
  return pack
}

/** What a draft costs to enter right now (the Grand Drafter title takes a quarter off). */
export function draftEntryFee(): number {
  return hasTitle('Grand Drafter') ? Math.round(DRAFT_ENTRY_FEE * GRAND_DRAFTER_FEE_MULTIPLIER) : DRAFT_ENTRY_FEE
}

/** Pays the entry fee and opens the first pack of a singles, doubles or chaos draft. */
export function startDraft(format: DraftFormat): DraftView {
  if (format !== 'singles' && format !== 'doubles' && format !== 'chaos') throw new Error('Pick singles, doubles or chaos')
  const current = getDraft()
  if (current && current.status !== 'finished') throw new Error('Finish (or abandon) your current draft first')
  changeCoins(-draftEntryFee())
  const setFormats = format === 'doubles' ? DOUBLES_SET_FORMATS : rollSinglesTiers()
  draft = {
    status: 'drafting',
    format,
    setFormats,
    picks: [],
    pack: offerPack(setFormats, []),
    wins: 0,
    losses: 0,
    opponent: null,
    reward: 0,
    // Chaos: two picks, then a modifier.
    ...(format === 'chaos'
      ? { pickTarget: CHAOS_PICKS_PER_STAGE, afterDraft: 'modifier' as const, chaosField: { weather: null, terrain: null, trickRoom: false } }
      : {})
  }
  persist()
  return getDraftView()!
}

/** Takes one Pokemon from the pack; the sixth pick starts the gauntlet. */
export function pickDraftMon(index: number): DraftView {
  const current = activeDraft('drafting')
  const pick = current.pack[index]
  if (!pick) throw new Error("That Pokémon isn't in the pack")
  current.picks.push(pick)
  recordAchievementBest(
    'draftBestLegendaries',
    current.picks.filter((p) => speciesRarityTier(p.set.species) === 'legendary').length
  )
  if (formatOf(current) === 'chaos') {
    if (current.picks.length >= (current.pickTarget ?? DRAFT_ROUNDS)) {
      if (current.afterDraft === 'modifier') offerModifiers(current)
      else startChaosBattleStage(current)
    } else {
      current.pack = offerPack(setFormatsOf(current), current.picks)
    }
  } else if (current.picks.length >= DRAFT_ROUNDS) {
    current.status = 'battling'
    current.pack = []
    current.opponent = rollOpponent(setFormatsOf(current))
  } else {
    current.pack = offerPack(setFormatsOf(current), current.picks)
  }
  persist()
  return getDraftView()!
}

/** Ends the draft now - paid for the wins it has (nothing while still drafting). */
export function abandonDraft(): DraftView {
  const current = getDraft()
  if (!current || current.status === 'finished') throw new Error('No draft in progress')
  current.modifierOffer = []
  finish(current)
  persist()
  return getDraftView()!
}

/**
 * The next battle, bringing these picks (by index, in order - the first one or two lead).
 * The opponent brings as many of its six too, chosen at random; it plays harder after
 * the first fight.
 */
export function beginDraftBattle(bring: number[]): {
  format: DraftFormat
  p1team: PokemonSet[]
  opponent: { name: string; spriteId: string; team: PokemonSet[]; difficulty: AiDifficulty }
  // Chaos: the starting field, and each side's Pokemon's stat multipliers (in team order).
  chaos?: { field: ReturnType<typeof chaosStartField>; boosts: StatBlock[]; foeBoosts: StatBlock[] }
} {
  const current = activeDraft('battling')
  if (!current.opponent) throw new Error('No opponent lined up')
  const format = formatOf(current)
  const count = draftBring(format, current.picks.length)
  if (bring.length !== count || new Set(bring).size !== count || bring.some((i) => !current.picks[i])) {
    throw new Error(`Pick ${count} different Pokémon to bring`)
  }
  const theirs = current.opponent.team.map((_, i) => i)
  const theirPicks: number[] = []
  while (theirPicks.length < count && theirs.length > 0) {
    theirPicks.push(theirs.splice(Math.floor(Math.random() * theirs.length), 1)[0])
  }
  current.inBattle = true
  persist()
  return {
    format,
    p1team: bring.map((i) => ({ ...current.picks[i].set })),
    opponent: {
      name: current.opponent.name,
      spriteId: current.opponent.spriteId,
      team: theirPicks.sort((a, b) => a - b).map((i) => ({ ...current.opponent!.team[i].set })),
      // Chaos always fights hard trainers.
      difficulty: current.wins === 0 && format !== 'chaos' ? 'normal' : 'hard'
    },
    chaos:
      format === 'chaos'
        ? {
            field: chaosStartField(chaosFieldOf(current), current.opponent.field),
            boosts: bring.map((i) => boostMultipliers(current.picks[i])),
            foeBoosts: theirPicks.map((i) => boostMultipliers(current.opponent!.team[i]))
          }
        : undefined
  }
}

/** A draft battle's end (a tie counts as a loss) - `flawless` when none of the player's Pokemon fainted. */
export function finishDraftBattle(won: boolean, flawless = false): DraftBattleResult {
  const current = activeDraft('battling')
  current.inBattle = false
  if (won && flawless) countAchievement('flawlessDraftWins')
  recordResult(current, won)
  persist()
  return { wins: current.wins, losses: current.losses, over: current.status === 'finished', reward: current.reward }
}

