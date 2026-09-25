import { randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { BoxPokemonView, BoxState, EditablePokemonSet, ExpGainResult, PokedexEntry } from '../../shared/battle-types'
import {
  EXP_CANDY_EXP,
  FRIENDSHIP_PER_BATTLE,
  MAX_HAPPINESS,
  RARE_CANDY_ITEM_ID,
  SHINY_PATCH_ITEM_ID
} from '../../shared/battle-types'
import {
  applyEditableSet,
  buildBasicSet,
  rollGiftShiny,
  buildPokemonSummary,
  dexBaseSpecies,
  unretiredHeldItem,
  speciesRarityTier,
  nationalDexSpecies,
  evolutionOptionsFor,
  evolveSet,
  generateRandomSingle,
  getItemSpritenum,
  pickRandomUnevolvedSpecies,
  toEditableSet,
  toID,
  type PokemonSet
} from './sim-access'
import { expProgressForLevel, getExpInfo, levelForExp, totalExpForSpeciesLevel } from './exp'
import { getProgression } from './progression-store'
import { addItem, hasItem, removeItem } from './bag-store'
import { playerDirFor, playerPathFor } from './save-paths'
import { onPlayerChange } from './player-session'

interface StoredMon {
  id: string
  set: PokemonSet
  exp: number
  favorite?: boolean
}

interface StoredBox {
  mons: StoredMon[]
  team: (string | null)[]
  // Every species (as the Pokedex counts them - forms together) this player has
  // ever had in their box, kept even after that Pokemon evolves or is released.
  // A wild one of these gets a Poke Ball by its name in battle.
  registered?: string[]
}

function emptyBox(): StoredBox {
  return { mons: [], team: [null, null, null, null, null, null] }
}

function load(): StoredBox {
  // Outside the try: not being logged in is a bug to surface, not an empty save.
  const path = playerPathFor('box.json')
  try {
    const raw = readFileSync(path, 'utf8')
    const parsed = JSON.parse(raw) as StoredBox
    if (!Array.isArray(parsed.mons) || !Array.isArray(parsed.team)) return emptyBox()
    // Saves from before exp tracking existed have no `exp` field - treat
    // those Pokemon as freshly arrived at whatever level they're already at.
    for (const mon of parsed.mons) {
      // A held item taken out of the game becomes its modern twin (or goes).
      if (mon.set.item) mon.set.item = unretiredHeldItem(mon.set.item)
      if (typeof mon.exp !== 'number') mon.exp = totalExpForSpeciesLevel(mon.set.species, mon.set.level)
      // Exp once kept piling up past the level cap (the level stopped, the exp
      // didn't). Anything beyond the Pokemon's current level is trimmed back to
      // the start of that level, so it doesn't leap ahead when the cap rises.
      if (mon.set.level < 100 && mon.exp >= totalExpForSpeciesLevel(mon.set.species, mon.set.level + 1)) {
        mon.exp = totalExpForSpeciesLevel(mon.set.species, mon.set.level)
      }
    }
    return parsed
  } catch (e) {
    // ENOENT is expected the very first time the app runs. Anything else
    // (a corrupt file, a transient read failure) is worth knowing about
    // rather than silently discarding the player's saved box.
    const code = (e as NodeJS.ErrnoException).code
    if (code !== 'ENOENT') console.error('[box-store] failed to load box.json:', e)
    return emptyBox()
  }
}

// Reading box.json happens lazily on first access rather than at module
// import time - import time is before app.whenReady(), and on a cold process
// start the userData directory isn't reliably ready for reads that early
// (observed as a spurious ENOENT on some launches).
let state: StoredBox | null = null

// Each player has their own box: forget the cached one when the player changes.
onPlayerChange(() => {
  state = null
})

function getState(): StoredBox {
  if (!state) state = load()
  return state
}

function persist(): void {
  registerOwnedSpecies()
  writeFileSync(playerPathFor('box.json'), JSON.stringify(getState()), 'utf8')
}

// Adds everything currently in the box to the registered species. Run on every
// save - which covers catches, gifts, starters and evolutions alike - and on first
// load, so boxes from before this was tracked count what they already hold.
function registerOwnedSpecies(): void {
  const box = getState()
  const registered = new Set(box.registered ?? [])
  for (const mon of box.mons) registered.add(dexBaseSpecies(mon.set.species))
  box.registered = [...registered].sort()
}

/** Whether the player has ever had this species (any form of it) in their box. */
export function hasRegisteredSpecies(speciesName: string): boolean {
  const box = getState()
  if (!box.registered) registerOwnedSpecies()
  return box.registered!.includes(dexBaseSpecies(speciesName))
}

/** The trainer profile's Pokedex: every species in National Dex order, marked if registered. */
export function getPokedex(): PokedexEntry[] {
  const box = getState()
  if (!box.registered) registerOwnedSpecies()
  const registered = new Set(box.registered)
  return nationalDexSpecies().map(({ num, species }) => ({ num, species, registered: registered.has(species) }))
}

function toView(mon: StoredMon): BoxPokemonView {
  const { percent } = expProgressForLevel(mon.set.species, mon.set.level, mon.exp)
  const eligibleEvolutions = evolutionOptionsFor(mon.set)
    .filter((o) => o.requiredItems === null || o.requiredItems.some(hasItem))
    .map((o) => o.species)
  const canLevelUpWithCandy = mon.set.level < getProgression().levelCap && hasItem(RARE_CANDY_ITEM_ID)
  const canUseShinyPatch = !mon.set.shiny && hasItem(SHINY_PATCH_ITEM_ID)
  const itemSpritenum = mon.set.item ? getItemSpritenum(mon.set.item) : null
  return {
    id: mon.id,
    exp: mon.exp,
    expPercent: percent,
    eligibleEvolutions,
    canLevelUpWithCandy,
    canUseShinyPatch,
    itemSpritenum,
    favorite: !!mon.favorite,
    rarityTier: speciesRarityTier(mon.set.species),
    ...buildPokemonSummary(mon.set.species, mon.set)
  }
}

export function getBoxState(): BoxState {
  return { mons: getState().mons.map(toView), team: [...getState().team] }
}

export function addRandomMon(): BoxState {
  const set = generateRandomSingle('gen9randombattle')
  const exp = totalExpForSpeciesLevel(set.species, set.level)
  getState().mons.push({ id: randomUUID(), set, exp })
  persist()
  return getBoxState()
}

// Adds a copy of a defeated wild Pokemon's set to the box, minus what only
// made sense in the wild: its held item (if any) isn't part of what catching
// it hands over, its EVs (random-battle sets come with 85 in every stat) are
// wiped so it starts untrained, and it joins with no friendship - that's
// earned by battling alongside it (see awardFriendshipToTeam).
export function addCaughtMon(set: PokemonSet): BoxState {
  const caught: PokemonSet = {
    ...set,
    item: '',
    happiness: 0,
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }
  }
  const exp = totalExpForSpeciesLevel(caught.species, caught.level)
  getState().mons.push({ id: randomUUID(), set: caught, exp })
  persist()
  return getBoxState()
}

export function setTeam(team: (string | null)[]): BoxState {
  if (team.length !== 6) throw new Error('Team must have exactly 6 slots')
  const knownIds = new Set(getState().mons.map((m) => m.id))
  const seen = new Set<string>()
  for (const id of team) {
    if (id === null) continue
    if (!knownIds.has(id)) throw new Error(`Unknown Pokemon id: ${id}`)
    if (seen.has(id)) throw new Error(`Pokemon ${id} assigned to multiple team slots`)
    seen.add(id)
  }
  getState().team = [...team]
  persist()
  return getBoxState()
}

/** A detached copy of a box Pokemon's set - for a Roguelite run, which must never change the original. */
export function copyBoxMonSet(id: string): PokemonSet {
  const mon = getState().mons.find((m) => m.id === id)
  if (!mon) throw new Error(`Unknown Pokemon id: ${id}`)
  return structuredClone(mon.set)
}

export function getMonSet(id: string): EditablePokemonSet {
  const mon = getState().mons.find((m) => m.id === id)
  if (!mon) throw new Error(`Unknown Pokemon id: ${id}`)
  return toEditableSet(mon.set)
}

// Admin edits (trainer roster mons edited through the same box path, see
// PokemonEditor's admin override) skip the bag entirely, same as every other
// admin bypass - only a genuine player edit reconciles held items against it.
export function updateMon(id: string, input: EditablePokemonSet, admin = false): BoxState {
  const mon = getState().mons.find((m) => m.id === id)
  if (!mon) throw new Error(`Unknown Pokemon id: ${id}`)
  const previousSpecies = mon.set.species
  const previousLevel = mon.set.level
  const previousItem = mon.set.item
  const newItem = input.item
  if (!admin && newItem !== previousItem) {
    // Check the new item before touching anything else, so a failed equip
    // (item not actually in the bag) leaves the mon and bag both untouched.
    if (newItem && !removeItem(toID(newItem), 1)) {
      throw new Error(`You don't have a ${newItem} in your bag`)
    }
    if (previousItem) addItem(toID(previousItem), 1)
  }
  mon.set = applyEditableSet(mon.set, input)
  // Exp progress only depends on species/level, and only a manual change to
  // one of those is an absolute override (reset to exactly the start of
  // whatever level/species was set, same as a freshly caught Pokemon) -
  // editing anything else (moves, item, nature, ...) shouldn't wipe out exp
  // actually earned from battling.
  if (mon.set.species !== previousSpecies || mon.set.level !== previousLevel) {
    mon.exp = totalExpForSpeciesLevel(mon.set.species, mon.set.level)
  }
  persist()
  return getBoxState()
}

export function getTeamPokemonSets(): PokemonSet[] {
  const byId = new Map(getState().mons.map((m) => [m.id, m.set]))
  const sets: PokemonSet[] = []
  for (const id of getState().team) {
    if (id === null) continue
    const set = byId.get(id)
    if (set) sets.push(set)
  }
  return sets
}

/**
 * The team another player last saved, read straight from their save file - it
 * never touches the logged-in player's cached box, and returns fresh copies, so
 * a fight can't change anything of theirs. Empty if they have no team yet.
 */
export function readSavedTeamOf(playerSlug: string): PokemonSet[] {
  let saved: StoredBox
  try {
    saved = JSON.parse(readFileSync(join(playerDirFor(playerSlug), 'box.json'), 'utf8')) as StoredBox
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw new Error("That player's save couldn't be read")
  }
  if (!Array.isArray(saved.mons) || !Array.isArray(saved.team)) return []
  const byId = new Map(saved.mons.map((m) => [m.id, m.set]))
  const sets: PokemonSet[] = []
  for (const id of saved.team) {
    const set = id ? byId.get(id) : undefined
    if (set) sets.push(structuredClone(set))
  }
  return sets
}

/** The highest level on a team (0 for an empty one). */
export function highestLevelOf(team: PokemonSet[]): number {
  return team.reduce((top, mon) => Math.max(top, mon.level), 0)
}

/**
 * A copy of the team with every Pokemon set to one level, up or down. Only the
 * level changes - moves, item, ability, nature, EVs and IVs stay as saved, and
 * the stats follow the new level when the battle builds them.
 */
export function scaleTeamToLevel(team: PokemonSet[], level: number): PokemonSet[] {
  return team.map((mon) => ({ ...mon, level }))
}

const STARTER_LEVEL = 5

export function addStarter(species: string): BoxState {
  if (getState().mons.length > 0) throw new Error('The box is not empty')
  const speciesName = species === 'random' ? pickRandomUnevolvedSpecies() : species
  const set = { ...buildBasicSet(speciesName, STARTER_LEVEL), happiness: 0, shiny: rollGiftShiny() }
  const id = randomUUID()
  const exp = totalExpForSpeciesLevel(set.species, set.level)
  getState().mons.push({ id, set, exp })
  getState().team[0] = id
  persist()
  return getBoxState()
}

// Awards the same flat amount of exp to every Pokemon on the current team
// (fainted or not) - simpler than mainline's per-participant split. A
// Pokemon already at the current progression level cap gets nothing at all
// - no exp banked for later, so grinding at the cap is a true no-op rather
// than a stealth stockpile.
export function awardExpToTeam(totalExp: number): ExpGainResult[] {
  const results: ExpGainResult[] = []
  if (totalExp <= 0) return results
  const levelCap = getProgression().levelCap
  const byId = new Map(getState().mons.map((m) => [m.id, m]))
  for (const id of getState().team) {
    if (!id) continue
    const mon = byId.get(id)
    if (!mon) continue
    const levelBefore = mon.set.level
    if (levelBefore >= levelCap) {
      results.push({ species: mon.set.species, gained: 0, levelBefore, levelAfter: levelBefore, cappedOut: true })
      continue
    }
    // Exp stops flowing the moment the level cap is reached - it sits at the very
    // start of the cap level, with nothing extra carried over to spill into later
    // levels once the cap goes up.
    const expBefore = mon.exp
    mon.exp = Math.min(mon.exp + totalExp, totalExpForSpeciesLevel(mon.set.species, levelCap))
    const { growthRate } = getExpInfo(mon.set.species)
    const levelAfter = Math.min(levelForExp(growthRate, mon.exp), levelCap)
    mon.set.level = levelAfter
    results.push({ species: mon.set.species, gained: mon.exp - expBefore, levelBefore, levelAfter, cappedOut: false })
  }
  persist()
  return results
}

// Spends one Exp. Candy from the bag on the whole team. Refused (and nothing
// spent) if every team member is already at the level cap, since the candy
// would do nothing.
export function useExpCandy(itemId: string): ExpGainResult[] {
  const amount = EXP_CANDY_EXP[itemId]
  if (!amount) throw new Error("That isn't an Exp. Candy")
  const levelCap = getProgression().levelCap
  const byId = new Map(getState().mons.map((m) => [m.id, m]))
  const team = getState().team.flatMap((id) => (id && byId.get(id) ? [byId.get(id)!] : []))
  if (team.length === 0) throw new Error('Your team is empty')
  if (team.every((m) => m.set.level >= levelCap)) throw new Error('Your whole team is already at the level cap')
  if (!removeItem(itemId, 1)) throw new Error("You don't have that item")
  return awardExpToTeam(amount)
}

// Every Pokemon on the team - the same ones awardExpToTeam pays out to - grows
// closer to its trainer after a battle won, whether or not it had exp to
// gain. Capped at MAX_HAPPINESS. Deliberately not part of ExpGainResult: it's
// never shown on the battle result screen.
export function awardFriendshipToTeam(amount = FRIENDSHIP_PER_BATTLE): void {
  const byId = new Map(getState().mons.map((m) => [m.id, m]))
  for (const id of getState().team) {
    const mon = id ? byId.get(id) : undefined
    if (!mon) continue
    // A set with no happiness recorded predates friendship being tracked and
    // counts as already maxed.
    mon.set.happiness = Math.min(MAX_HAPPINESS, (mon.set.happiness ?? MAX_HAPPINESS) + amount)
  }
  persist()
}

export function evolveMon(id: string, targetSpecies: string): BoxState {
  const mon = getState().mons.find((m) => m.id === id)
  if (!mon) throw new Error(`Unknown Pokemon id: ${id}`)
  const chosen = evolutionOptionsFor(mon.set).find((o) => o.species === targetSpecies)
  if (!chosen) throw new Error(`${mon.set.species} cannot evolve into ${targetSpecies} right now`)
  if (chosen.requiredItems) {
    // Any one of the accepted items will do (Milcery takes any Sweet) - spend
    // whichever the player actually has.
    const owned = chosen.requiredItems.find(hasItem)
    if (!owned || !removeItem(owned, 1)) {
      throw new Error(`You don't have the item needed for this evolution`)
    }
  }
  mon.set = evolveSet(mon.set, targetSpecies)
  persist()
  return getBoxState()
}

// A Rare Candy sets exp to exactly the floor of the new level (same as real
// games - any partial progress already made towards the next level is
// subsumed into it, not stacked on top), and is gated by the level cap same
// as battle exp so it can't be used to skip past current progression.
export function levelUpMon(id: string): BoxState {
  const mon = getState().mons.find((m) => m.id === id)
  if (!mon) throw new Error(`Unknown Pokemon id: ${id}`)
  if (mon.set.level >= getProgression().levelCap) throw new Error(`${mon.set.species} is already at the level cap`)
  if (!removeItem(RARE_CANDY_ITEM_ID, 1)) throw new Error(`You don't have a Rare Candy`)
  mon.set.level += 1
  mon.exp = totalExpForSpeciesLevel(mon.set.species, mon.set.level)
  persist()
  return getBoxState()
}

// Spends a Shiny Patch from the bag to make one Pokemon shiny for good.
export function useShinyPatch(id: string): BoxState {
  const mon = getState().mons.find((m) => m.id === id)
  if (!mon) throw new Error(`Unknown Pokemon id: ${id}`)
  if (mon.set.shiny) throw new Error(`${mon.set.species} is already shiny`)
  if (!removeItem(SHINY_PATCH_ITEM_ID, 1)) throw new Error(`You don't have a Shiny Patch`)
  mon.set.shiny = true
  persist()
  return getBoxState()
}

// Favorites are listed first in the box and carry a star badge.
export function toggleFavorite(id: string): BoxState {
  const mon = getState().mons.find((m) => m.id === id)
  if (!mon) throw new Error(`Unknown Pokemon id: ${id}`)
  if (mon.favorite) delete mon.favorite
  else mon.favorite = true
  persist()
  return getBoxState()
}

export function resetBox(): void {
  state = emptyBox()
  persist()
}
