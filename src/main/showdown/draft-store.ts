import { createRequire } from 'node:module'
import { readFileSync, writeFileSync } from 'node:fs'
import type { AiDifficulty, StatBlock } from '../../shared/battle-types'
import {
  draftBring,
  DRAFT_ENTRY_FEE,
  DRAFT_LEVEL,
  DRAFT_MAX_LOSSES,
  DRAFT_MAX_WINS,
  DRAFT_PACK_SIZE,
  DRAFT_ROUNDS,
  draftReward,
  type DraftBattleResult,
  type DraftFormat,
  type DraftMonView,
  type DraftView
} from '../../shared/draft'
import smogonSets from './data/smogon-sets.json'
import { buildPokemonSummary, getItemSpritenum, speciesRarityTier, type PokemonSet } from './sim-access'
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
  opponent: { name: string; spriteId: string; team: DraftPick[] } | null
  reward: number
  // A battle was started and hasn't come back yet - if the game closes mid-battle, it
  // counts as lost when the draft is next loaded (no quitting out of a losing fight).
  inBattle?: boolean
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
function rollOpponent(setFormats: string[]): NonNullable<StoredDraft['opponent']> {
  const trainers = listTrainers().filter((t) => !t.isBoss && !t.rogueliteBoss && !t.teamRocket)
  const trainer = trainers.length > 0 ? pickRandom(trainers) : null
  return {
    name: trainer?.name ?? 'Draft Rival',
    spriteId: trainer?.spriteId ?? 'acetrainer',
    team: rollMons(setFormats, DRAFT_ROUNDS, [])
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
  if (current.wins >= DRAFT_MAX_WINS) {
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
  else current.opponent = rollOpponent(setFormatsOf(current))
}

function toView(pick: DraftPick): DraftMonView {
  return {
    ...buildPokemonSummary(pick.set.species, pick.set),
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
    tiers: formatOf(current) === 'singles' ? setFormatsOf(current).map(tierLabel) : null,
    picks: current.picks.map(toView),
    pack: current.pack.map(toView),
    round: current.picks.length + 1,
    wins: current.wins,
    losses: current.losses,
    opponent: current.opponent
      ? { name: current.opponent.name, spriteId: current.opponent.spriteId, team: current.opponent.team.map(toView) }
      : null,
    reward: current.reward
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

/** Pays the entry fee and opens the first pack of a singles or doubles draft. */
export function startDraft(format: DraftFormat): DraftView {
  if (format !== 'singles' && format !== 'doubles') throw new Error('Pick singles or doubles')
  const current = getDraft()
  if (current && current.status !== 'finished') throw new Error('Finish (or abandon) your current draft first')
  changeCoins(-draftEntryFee())
  const setFormats = format === 'singles' ? rollSinglesTiers() : DOUBLES_SET_FORMATS
  draft = {
    status: 'drafting',
    format,
    setFormats,
    picks: [],
    pack: offerPack(setFormats, []),
    wins: 0,
    losses: 0,
    opponent: null,
    reward: 0
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
  if (current.picks.length >= DRAFT_ROUNDS) {
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
} {
  const current = activeDraft('battling')
  if (!current.opponent) throw new Error('No opponent lined up')
  const format = formatOf(current)
  const count = draftBring(format)
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
      difficulty: current.wins === 0 ? 'normal' : 'hard'
    }
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

