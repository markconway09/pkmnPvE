import { readFileSync, writeFileSync } from 'node:fs'
import { SCANNER_ITEM_ID, WILD_LOCATIONS, type RarityTier, type SpeciesEditInfo, type WildLocationId } from '../../shared/battle-types'
import {
  TM_COIN_ONLY_COUNT,
  TM_COIN_PRICES,
  TM_DAILY_COIN_OFFERS,
  TM_DUPLICATE_PAYOUT,
  TM_LAB_TIER_WEIGHTS,
  TM_PITY_SEARCHES,
  TM_QUICK_CHECK_CHANCE,
  TM_QUICK_CHECK_ITEM_CHANCE,
  TM_SCANNER_COINS,
  TM_SEARCH_CHARGES_PER_DAY,
  TM_SEARCH_DIFFICULTY,
  TM_SEARCH_MAX_MISSES,
  TM_TIERS,
  TM_TIER_WEIGHTS,
  type SkillCheckResult,
  type TmFind,
  type TmInfo,
  type TmQuickCheckResult,
  type TmSearchProgress,
  type TmSearchStart,
  type TmShopView,
  type TmState
} from '../../shared/tms'
import { playerPathFor } from './save-paths'
import { getSessionInfo, onPlayerChange } from './player-session'
import { getWildDropPool, tmMoveList, tmOnlyMoveIds } from './sim-access'
import { addMoney } from './money-store'
import { changeCoins, getCoins } from './game-corner-store'
import { recordMission } from './mission-store'
import { addItem, bagItemRarity, hasItem } from './bag-store'
import { countAchievement, recordAchievementBest } from './achievement-progress'
import { hasTitle } from './title-perks'
import type { RarityOdds } from '../../shared/rarity'
import {
  HEX_MASTER_SPARE_CHECKS,
  LIGHT_SLEEPER_EXTRA_MISSES,
  PROSPECTOR_LEGENDARY_WEIGHT_MULTIPLIER,
  SPECIALIST_REFUND_CHANCE,
  UNSTOPPABLE_QUICK_CHECK_MULTIPLIER,
  STEADY_HANDS_GREAT_MULTIPLIER,
  WALKING_DISC_PAYOUT_MULTIPLIER
} from '../../shared/titles'

/**
 * The player's TMs (see shared/tms.ts), kept per player in tms.json: the ones owned, the
 * day's searches used in each area, and each area's pity count. A search in progress lives only in memory - its charge is spent the moment
 * it starts, so walking away from one never gives it back.
 */

interface StoredTms {
  owned: string[]
  day: string
  used: Partial<Record<WildLocationId, number>>
  pity: Partial<Record<WildLocationId, number>>
  // Greats in a row right now, across every skill check (for On a Roll).
  greatStreak: number
  // The Coin Shop's TMs for `offersDay`, rolled once that day.
  offers?: string[]
  offersDay?: string
}

interface ActiveSearch {
  location: WildLocationId
  tier: RarityTier
  needed: number
  progress: number
  misses: number
  maxMisses: number
  allGreat: boolean
  // Checks that weren't a Great - Goods and misses alike.
  nonGreats: number
}

let state: StoredTms | null = null
let search: ActiveSearch | null = null
// The area of the wild battle just won, until its quick check is taken.
let quickCheckLocation: WildLocationId | null = null
// The area of a search that ended in an ambush, until that wild battle starts - the
// Pokemon it woke can't be run from.
let ambushLocation: WildLocationId | null = null

/** Takes the pending ambush if it's in this area: true means the battle can't be run from. */
export function takeTmAmbush(location: WildLocationId | null): boolean {
  const pending = ambushLocation
  ambushLocation = null
  return pending !== null && pending === location
}

onPlayerChange(() => {
  state = null
  search = null
  quickCheckLocation = null
})

// Today's local date, as the day's key.
function today(): string {
  const now = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function defaultState(): StoredTms {
  return { owned: [], day: today(), used: {}, pity: {}, greatStreak: 0 }
}

function load(): StoredTms {
  const path = playerPathFor('tms.json')
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<StoredTms>
    return {
      owned: Array.isArray(parsed.owned) ? parsed.owned : [],
      day: typeof parsed.day === 'string' ? parsed.day : today(),
      used: parsed.used ?? {},
      pity: parsed.pity ?? {},
      greatStreak: parsed.greatStreak ?? 0,
      offers: Array.isArray(parsed.offers) ? parsed.offers : undefined,
      offersDay: typeof parsed.offersDay === 'string' ? parsed.offersDay : undefined
    }
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') console.error('[tm-store] failed to load tms.json:', e)
    return defaultState()
  }
}

// The day's searches come back at midnight.
function getState(): StoredTms {
  if (!state) state = load()
  if (state.day !== today()) {
    state.day = today()
    state.used = {}
    persist()
  }
  return state
}

function persist(): void {
  writeFileSync(playerPathFor('tms.json'), JSON.stringify(state), 'utf8')
}

// A small seeded random number generator (mulberry32), seeded from a string.
function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let a = h >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

let catalog: TmInfo[] | null = null

/**
 * Every TM. Its rarity comes from how widely random battle sets run the move: the top 6%
 * gold, then 12% red, 22% purple, 30% blue, the rest (and anything no set runs) grey.
 * The Coin Shop's own set is fixed - the same TM_COIN_ONLY_COUNT moves every time, picked
 * by a hash of their names - and every other TM turns up in the areas whose types match
 * its move's type (Anywhere and the Lab: all of them).
 */
export function getTmCatalog(): TmInfo[] {
  if (catalog) return catalog
  const moves = tmMoveList().sort((a, b) => b.usage - a.usage || a.name.localeCompare(b.name))
  const coinOnly = new Set(
    [...moves]
      .sort((a, b) => seededRandom(a.id)() - seededRandom(b.id)())
      .slice(0, TM_COIN_ONLY_COUNT)
      .map((m) => m.id)
  )
  catalog = moves
    .map((m, i): TmInfo => {
      const rank = i / moves.length
      const tier: RarityTier =
        m.usage === 0
          ? 'common'
          : rank < 0.06
            ? 'legendary'
            : rank < 0.18
              ? 'epic'
              : rank < 0.4
                ? 'rare'
                : rank < 0.7
                  ? 'uncommon'
                  : 'common'
      const isCoinOnly = coinOnly.has(m.id)
      return {
        moveId: m.id,
        name: m.name,
        type: m.type,
        category: m.category,
        tier,
        coinOnly: isCoinOnly,
        locations: isCoinOnly ? [] : WILD_LOCATIONS.filter((l) => !l.types || l.types.includes(m.type)).map((l) => l.id)
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
  return catalog
}

/** Whether the player has this move's TM. */
export function hasTm(moveId: string): boolean {
  return getState().owned.includes(moveId)
}

/**
 * The moves this species could learn only from a TM the player doesn't own yet - locked
 * in the box's editor until they find it. Moves it already knows are left out: those
 * stay, TM or not.
 */
export function lockedTmMoves(speciesName: string, knownMoves: string[] = []): Set<string> {
  const tmIds = new Set(getTmCatalog().map((t) => t.moveId))
  const owned = new Set(getState().owned)
  // Saved sets hold move names ("Earthquake"), the TMs move ids.
  const known = new Set(knownMoves.map((m) => m.toLowerCase().replace(/[^a-z0-9]/g, '')))
  return new Set([...tmOnlyMoveIds(speciesName)].filter((id) => tmIds.has(id) && !owned.has(id) && !known.has(id)))
}

/** The editor's move list with each locked TM move marked - and moved to the bottom. */
export function withTmLocks(info: SpeciesEditInfo, speciesName: string, knownMoves: string[] = []): SpeciesEditInfo {
  const locked = lockedTmMoves(speciesName, knownMoves)
  if (locked.size === 0) return info
  const moves = info.moves.map((m) => (locked.has(m.id) ? { ...m, tmLocked: true } : m))
  return { ...info, moves: [...moves.filter((m) => !m.tmLocked), ...moves.filter((m) => m.tmLocked)] }
}

// The base areas - not Anywhere or the Lab - for Explorer.
const BASE_AREAS: WildLocationId[] = ['cave', 'mountain', 'forest', 'city', 'industry', 'cemetery', 'ocean']

/** The TM tallies achievements read: TMs owned, types with every TM owned, and base areas searched (any search there sets its pity). */
export function tmAchievementStats(): { tmsOwned: number; tmTypesCompleted: number; tmAreasSearched: number } {
  const s = getState()
  const owned = new Set(s.owned)
  const byType = new Map<string, boolean>()
  for (const tm of getTmCatalog()) byType.set(tm.type, (byType.get(tm.type) ?? true) && owned.has(tm.moveId))
  return {
    tmsOwned: s.owned.length,
    tmTypesCompleted: [...byType.values()].filter(Boolean).length,
    tmAreasSearched: BASE_AREAS.filter((l) => s.pity[l] !== undefined).length
  }
}

// Every skill check's result, for the achievements: Greats, the run of them, and a needle
// left to go all the way round.
function recordSkillCheck(result: SkillCheckResult, timedOut: boolean): void {
  const s = getState()
  if (result === 'great') {
    countAchievement('skillGreats')
    s.greatStreak++
    recordAchievementBest('bestGreatStreak', s.greatStreak)
  } else s.greatStreak = 0
  if (timedOut) countAchievement('skillTimeouts')
  persist()
}

export function getTmState(): TmState {
  const s = getState()
  const charges = {} as TmState['charges']
  const pity = {} as TmState['pity']
  for (const l of WILD_LOCATIONS) {
    charges[l.id] = Math.max(0, TM_SEARCH_CHARGES_PER_DAY - (s.used[l.id] ?? 0))
    pity[l.id] = s.pity[l.id] ?? 0
  }
  return { owned: [...s.owned], charges, pity }
}

// Each rarity's chance in a roll: nothing under minTier (the pity), and Prospector makes
// gold likelier.
function tierOdds(baseWeights: Record<RarityTier, number>, minTier: RarityTier = 'common'): RarityOdds {
  const weights = hasTitle('Prospector')
    ? { ...baseWeights, legendary: baseWeights.legendary * PROSPECTOR_LEGENDARY_WEIGHT_MULTIPLIER }
    : baseWeights
  const tiers = TM_TIERS.slice(TM_TIERS.indexOf(minTier))
  const total = tiers.reduce((sum, t) => sum + weights[t], 0)
  const odds: RarityOdds = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 }
  for (const t of tiers) odds[t] = weights[t] / total
  return odds
}

function rollTier(baseWeights: Record<RarityTier, number>, minTier: RarityTier = 'common'): RarityTier {
  const odds = tierOdds(baseWeights, minTier)
  let roll = Math.random()
  for (const t of TM_TIERS) {
    roll -= odds[t]
    if (roll < 0) return t
  }
  return 'legendary'
}

/** The next search in an area's odds of each rarity, pity included - for the search button's tooltip. */
export function tmSearchRarityOdds(location: WildLocationId): RarityOdds {
  const pityTriggered = (getState().pity[location] ?? 0) >= TM_PITY_SEARCHES
  return tierOdds(location === 'lab' ? TM_LAB_TIER_WEIGHTS : TM_TIER_WEIGHTS, pityTriggered ? 'rare' : 'common')
}

// A TM of this rarity from the area - or, if it has none of that rarity, the nearest one
// it does have (lower first).
function pickTm(location: WildLocationId, tier: RarityTier): TmInfo {
  const pool = getTmCatalog().filter((t) => t.locations.includes(location))
  const at = TM_TIERS.indexOf(tier)
  for (let step = 0; step < TM_TIERS.length; step++) {
    for (const i of [at - step, at + step]) {
      const matches = pool.filter((t) => t.tier === TM_TIERS[i])
      if (matches.length > 0) return matches[Math.floor(Math.random() * matches.length)]
    }
  }
  throw new Error('That area has no TMs')
}

// Into the player's TMs - or, if they already have it, its worth in Poke Dollars.
function grantTm(tm: TmInfo, upgraded: boolean): TmFind {
  const s = getState()
  const duplicate = s.owned.includes(tm.moveId)
  // Walking Disc doubles a duplicate's worth.
  const payout = duplicate ? TM_DUPLICATE_PAYOUT[tm.tier] * (hasTitle('Walking Disc') ? WALKING_DISC_PAYOUT_MULTIPLIER : 1) : 0
  if (duplicate) addMoney(payout)
  else s.owned.push(tm.moveId)
  persist()
  return { tm, duplicate, payout, upgraded }
}

/**
 * Starts a search in an area, spending one of its charges for the day. The TM's rarity is rolled now - it sets how many checks the search
 * takes and how hard each is - and the pity makes it at least purple after
 * TM_PITY_SEARCHES searches there without one.
 */
export function startTmSearch(location: WildLocationId, labOpen: boolean): TmSearchStart {
  const config = WILD_LOCATIONS.find((l) => l.id === location)
  if (!config) throw new Error('There is no such area')
  if (config.requiresAllBosses && !labOpen) throw new Error(`${config.label} opens once every boss is beaten`)
  const s = getState()
  const used = s.used[location] ?? 0
  if (used >= TM_SEARCH_CHARGES_PER_DAY) throw new Error(`No searches left in ${config.label} today`)
  s.used[location] = used + 1
  persist()
  recordMission('tmSearches')

  const pityTriggered = (s.pity[location] ?? 0) >= TM_PITY_SEARCHES
  const tier = rollTier(location === 'lab' ? TM_LAB_TIER_WEIGHTS : TM_TIER_WEIGHTS, pityTriggered ? 'rare' : 'common')
  const { checks, ...base } = TM_SEARCH_DIFFICULTY[tier]
  // Steady Hands widens the Great slice (never past the Good zone).
  const settings = {
    ...base,
    greatDeg: hasTitle('Steady Hands') ? Math.min(base.goodDeg, base.greatDeg * STEADY_HANDS_GREAT_MULTIPLIER) : base.greatDeg
  }
  const maxMisses = TM_SEARCH_MAX_MISSES + (hasTitle('Light Sleeper') ? LIGHT_SLEEPER_EXTRA_MISSES : 0)
  search = { location, tier, needed: checks, progress: 0, misses: 0, maxMisses, allGreat: true, nonGreats: 0 }
  return { location, tier, checks, settings, maxMisses, pityTriggered, state: getTmState() }
}

// A search that ended without a purple or better adds to the area's pity; one that gave
// one starts it over.
function settlePity(location: WildLocationId, tier: RarityTier | null): void {
  const s = getState()
  s.pity[location] = tier && TM_TIERS.indexOf(tier) >= TM_TIERS.indexOf('rare') ? 0 : (s.pity[location] ?? 0) + 1
  persist()
}

/**
 * One check of the search in progress: a Great or a Good moves it on a step, a miss knocks
 * it back one and makes noise - TM_SEARCH_MAX_MISSES of those and a wild Pokemon jumps out,
 * ending the search. Done with every check a Great, the TM is rolled one rarity higher -
 * Hex Master lets one check fall short of a Great.
 * `timedOut`: the needle went all the way round (a miss).
 */
export function reportTmSearchCheck(result: SkillCheckResult, timedOut = false): TmSearchProgress {
  const active = search
  if (!active) throw new Error('There is no search going on')
  recordSkillCheck(result, timedOut)
  if (result === 'miss') {
    // AFK: a miss still makes noise, but loses no ground.
    if (!hasTitle('AFK')) active.progress = Math.max(0, active.progress - 1)
    active.misses++
  } else active.progress++
  if (result !== 'great') {
    active.allGreat = false
    active.nonGreats++
  }

  const base = { progress: active.progress, needed: active.needed, misses: active.misses }
  if (active.misses >= active.maxMisses) {
    search = null
    settlePity(active.location, null)
    countAchievement('tmAmbushes')
    ambushLocation = active.location
    return { ...base, done: true, find: null, ambush: true, refunded: false, state: getTmState() }
  }
  if (active.progress < active.needed) return { ...base, done: false, find: null, ambush: false, refunded: false, state: getTmState() }

  search = null
  const spare = hasTitle('Hex Master') ? HEX_MASTER_SPARE_CHECKS : 0
  const upgraded = active.nonGreats <= spare && active.tier !== 'legendary'
  const tier = upgraded ? TM_TIERS[TM_TIERS.indexOf(active.tier) + 1] : active.tier
  const find = grantTm(pickTm(active.location, tier), upgraded)
  settlePity(active.location, find.tm.tier)
  countAchievement('tmSearches')
  if (active.location === 'lab') countAchievement('labSearches')
  if (find.tm.tier === 'legendary') countAchievement('legendaryTmsFound')
  if (active.allGreat) countAchievement('flawlessSearches')
  if (active.allGreat && active.tier === 'legendary') countAchievement('flawlessLegendarySearches')
  // Specialist: a search that found something may give the area's search back.
  const s = getState()
  const refunded = hasTitle('Specialist') && (s.used[active.location] ?? 0) > 0 && Math.random() < SPECIALIST_REFUND_CHANCE
  if (refunded) {
    s.used[active.location] = (s.used[active.location] ?? 0) - 1
    persist()
  }
  return { ...base, done: true, find, ambush: false, refunded, state: getTmState() }
}

/** Walking away from a search: its charge stays spent, and it counts toward the pity. */
export function abandonTmSearch(): void {
  if (!search) return
  settlePity(search.location, null)
  search = null
}

/** A beaten trainer's TMs: each one the player doesn't own yet joins their TMs. The ones given. */
export function grantRewardTms(moveIds: string[]): TmInfo[] {
  const s = getState()
  const given = getTmCatalog().filter((t) => moveIds.includes(t.moveId) && !s.owned.includes(t.moveId))
  if (given.length === 0) return []
  s.owned.push(...given.map((t) => t.moveId))
  persist()
  return given
}

/** Which of a trainer's TMs the player doesn't own yet - what a win would still give. */
export function unownedRewardTms(moveIds: string[]): TmInfo[] {
  const owned = new Set(getState().owned)
  return getTmCatalog().filter((t) => moveIds.includes(t.moveId) && !owned.has(t.moveId))
}

/**
 * A wild battle in this area was just won: with the Scanner, one quick check waits on the
 * result screen. Whether it does.
 */
export function armTmQuickCheck(location: WildLocationId): boolean {
  quickCheckLocation = hasItem(SCANNER_ITEM_ID) ? location : null
  return quickCheckLocation !== null
}

/** The quick check after a wild win: a Good or a Great has its TM_QUICK_CHECK_CHANCE to turn up a TM from the area. */
export function takeTmQuickCheck(result: SkillCheckResult, timedOut = false): TmQuickCheckResult {
  const location = quickCheckLocation
  if (!location) throw new Error('There is nothing to search for here')
  quickCheckLocation = null
  recordSkillCheck(result, timedOut)
  // Unstoppable doubles the chance.
  const chance = TM_QUICK_CHECK_CHANCE[result] * (hasTitle('Unstoppable') ? UNSTOPPABLE_QUICK_CHECK_MULTIPLIER : 1)
  if (Math.random() >= chance) {
    // A Good or a Great that found no TM may still turn up a random item.
    if (result === 'miss' || Math.random() >= TM_QUICK_CHECK_ITEM_CHANCE) return { find: null }
    const pool = getWildDropPool()
    const item = pool[Math.floor(Math.random() * pool.length)]
    if (!item) return { find: null }
    addItem(item.id, 1)
    return { find: null, item: { itemId: item.id, itemName: item.name, spritenum: item.spritenum, tier: bagItemRarity(item.id) } }
  }
  const weights = location === 'lab' ? TM_LAB_TIER_WEIGHTS : TM_TIER_WEIGHTS
  const find = grantTm(pickTm(location, rollTier(weights)), false)
  // A TM found this way counts as found by searching, like a full search's.
  countAchievement('tmSearches')
  if (location === 'lab') countAchievement('labSearches')
  if (find.tm.tier === 'legendary') countAchievement('legendaryTmsFound')
  return { find }
}

// Today's Coin Shop TMs - TM_DAILY_COIN_OFFERS of the ones the player doesn't own yet,
// rolled at the day's first look and kept for the whole day (one bought stays on the
// shelf as Owned until tomorrow's roll).
function todaysOffers(): TmInfo[] {
  const s = getState()
  const catalog = getTmCatalog()
  if (s.offersDay !== today() || !s.offers) {
    const random = seededRandom(`${getSessionInfo().username ?? ''}|tms|${today()}`)
    const pool = catalog.filter((t) => t.coinOnly && !s.owned.includes(t.moveId))
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))
      ;[pool[i], pool[j]] = [pool[j], pool[i]]
    }
    s.offers = pool.slice(0, TM_DAILY_COIN_OFFERS).map((t) => t.moveId)
    s.offersDay = today()
    persist()
  }
  const offers = new Set(s.offers)
  return catalog
    .filter((t) => offers.has(t.moveId))
    .sort((a, b) => TM_TIERS.indexOf(a.tier) - TM_TIERS.indexOf(b.tier) || a.name.localeCompare(b.name))
}

export function getTmShop(): TmShopView {
  const s = getState()
  return {
    offers: todaysOffers().map((tm) => ({ tm, coins: TM_COIN_PRICES[tm.tier], owned: s.owned.includes(tm.moveId) })),
    scannerCoins: TM_SCANNER_COINS,
    hasScanner: hasItem(SCANNER_ITEM_ID)
  }
}

/** Buys one of today's Coin Shop TMs. */
export function buyTmFromShop(moveId: string): { coins: number; shop: TmShopView } {
  const tm = todaysOffers().find((t) => t.moveId === moveId)
  if (!tm) throw new Error("That TM isn't on sale today")
  if (hasTm(moveId)) throw new Error(`You already have ${tm.name}`)
  const price = TM_COIN_PRICES[tm.tier]
  if (getCoins() < price) throw new Error(`That costs ${price.toLocaleString('en-US')} coins`)
  changeCoins(-price)
  grantTm(tm, false)
  return { coins: getCoins(), shop: getTmShop() }
}

/** Buys the Scanner - a key item, kept for good: it opens the quick check after wild wins. */
export function buyScanner(): { coins: number; shop: TmShopView } {
  if (hasItem(SCANNER_ITEM_ID)) throw new Error('You already have the Scanner')
  if (getCoins() < TM_SCANNER_COINS) throw new Error(`That costs ${TM_SCANNER_COINS.toLocaleString('en-US')} coins`)
  changeCoins(-TM_SCANNER_COINS)
  addItem(SCANNER_ITEM_ID, 1)
  return { coins: getCoins(), shop: getTmShop() }
}
