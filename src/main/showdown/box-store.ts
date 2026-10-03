import { randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type {
  BoxPokemonView,
  BoxState,
  EditablePokemonSet,
  EvolutionItemUse,
  ExpGainResult,
  MergeCandidateView,
  CompanionSize,
  CompanionSizeChoice,
  PokedexEntry,
  RaidBossPreview
} from '../../shared/battle-types'
import {
  EXP_CANDY_EXP,
  FRIENDSHIP_PER_BATTLE,
  MAX_HAPPINESS,
  FRIENDSHIP_CHARM_ITEM_ID,
  FRIENDSHIP_CHARM_MULTIPLIER,
  FUSIONS,
  MERGE_MAX_COPIES,
  ALCREMIE_FORMS,
  MINIOR_COLORS,
  COMPANION_ACHIEVEMENT_ID,
  DECORATION_BOX_ITEM_ID,
  FASHION_CASE_ITEM_ID,
  PIKACHU_FORMS,
  COMPANION_SIZES,
  autoCompanionSize,
  MERGE_MAX_STARS,
  mergeStarsFor,
  planMerge,
  RARE_CANDY_ITEM_ID,
  ROTOM_CATALOG_ITEM_ID,
  SHINY_PATCH_ITEM_ID
} from '../../shared/battle-types'
import {
  applyEditableSet,
  baseSpeciesOf,
  buildBasicSet,
  rollGiftShiny,
  buildPokemonSummary,
  dexBaseSpecies,
  dexFormOf,
  canMergeInto,
  isFullyEvolved,
  randomEvolutionItemId,
  cosmeticLookOf,
  mergeLineOf,
  unretiredHeldItem,
  speciesRarityTier,
  speciesDexNum,
  bstOf,
  speciesHeightM,
  rollMilceryCream,
  nationalDexSpecies,
  nationalDexForms,
  pokedexLocationHints,
  raidBossCandidates,
  evolutionOptionsFor,
  evolutionPathsFor,
  evolveSet,
  formChangedSet,
  formChangeFor,
  getItemSpritenumById,
  heldItemForme,
  gmaxLookOf,
  generateRandomSingle,
  getEditorOptions,
  getItemSpritenum,
  pickRandomUnevolvedSpecies,
  toEditableSet,
  toID,
  type PokemonSet
} from './sim-access'
import { expProgressForLevel, getExpInfo, levelForExp, totalExpForSpeciesLevel } from './exp'
import { getProgression } from './progression-store'
import { addItem, bagItemUse, getItemQuantity, hasItem, removeItem } from './bag-store'
import { playerDirFor, playerPathFor } from './save-paths'
import { onPlayerChange } from './player-session'
import { addMoney } from './money-store'
import { countAchievement, getAchievementProgress, recordAchievementBest } from './achievement-progress'
import { hasTitle, monSellPrice } from './title-perks'
import { ALCHEMIST_ITEM_CHANCE } from '../../shared/titles'
import { buildAutoSet, listAutoSets } from './auto-sets'
import { getTmCatalog, lockedTmMoves } from './tm-store'

interface StoredMon {
  id: string
  set: PokemonSet
  exp: number
  favorite?: boolean
  // A fused Necrozma, Kyurem or Calyrex: the partner inside it, handed back on unfusing.
  fusedWith?: StoredMon
  // Copies merged into it, itself included (see mergeStarsFor) - 1 when left out.
  copies?: number
}

interface StoredBox {
  mons: StoredMon[]
  team: (string | null)[]
  // Every species (as the Pokedex counts them - forms together) this player has
  // ever had in their box, kept even after that Pokemon evolves or is released.
  // A wild one of these gets a Poke Ball by its name in battle.
  registered?: string[]
  // The same, form by form (see dexFormOf): Alolan Ninetales apart from Ninetales. A
  // save from before forms were tracked starts with its species as their base forms.
  registeredForms?: string[]
  // Every cosmetic look ever owned (Minior's cores, Vivillon's patterns - see cosmeticLookOf),
  // kept like the registered species.
  registeredLooks?: string[]
  // The companion beside the team: one of the box's own Pokemon, which stays in the box
  // (and on the team) while it's the companion (see setCompanion).
  companionId?: string | null
  // Saved before that: the companion itself, taken out of the box (moved back on load).
  companion?: StoredMon | null
  // Unset: by its height (see autoCompanionSize).
  companionSize?: CompanionSizeChoice
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
    // Saved before companions had that name: the same Pokemon and size under the old fields.
    const legacy = parsed as StoredBox & { pet?: StoredMon | null; petSize?: CompanionSizeChoice }
    if (legacy.pet && !parsed.companion) parsed.companion = legacy.pet
    if (legacy.petSize && !parsed.companionSize) parsed.companionSize = legacy.petSize
    delete legacy.pet
    delete legacy.petSize
    // A companion that was taken out of the box goes back in, still the companion.
    if (parsed.companion) {
      if (!parsed.mons.some((m) => m.id === parsed.companion!.id)) parsed.mons.push(parsed.companion)
      parsed.companionId = parsed.companion.id
      delete parsed.companion
    }
    // Saves from before exp tracking existed have no `exp` field - treat
    // those Pokemon as freshly arrived at whatever level they're already at.
    for (const mon of parsed.mons) {
      // A held item taken out of the game becomes its modern twin (or goes).
      if (mon.set.item) mon.set.item = unretiredHeldItem(mon.set.item)
      // In the form its held item gives it (see heldItemForme).
      mon.set = heldItemForme(mon.set)
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
// Every Pokemon the player has (the companion is one of the box's own).
function ownedMons(): StoredMon[] {
  return getState().mons
}

// The companion, if it's still in the box (it's gone once sold).
function companionMon(): StoredMon | null {
  const { companionId, mons } = getState()
  return (companionId && mons.find((m) => m.id === companionId)) || null
}

function registerOwnedSpecies(): void {
  const box = getState()
  const registered = new Set(box.registered ?? [])
  const forms = new Set(box.registeredForms ?? box.registered ?? [])
  const looks = new Set(box.registeredLooks ?? [])
  for (const mon of ownedMons()) {
    registered.add(dexBaseSpecies(mon.set.species))
    forms.add(dexFormOf(mon.set.species))
    const look = cosmeticLookOf(mon.set.species)
    if (look) looks.add(look)
  }
  box.registered = [...registered].sort()
  box.registeredForms = [...forms].sort()
  box.registeredLooks = [...looks].sort()
}

/**
 * Whether the player has ever had this Pokemon in their box - in this form: an Alolan
 * Ninetales isn't registered by having had a Kantonian one, or the other way round.
 */
export function hasRegisteredSpecies(speciesName: string): boolean {
  const box = getState()
  if (!box.registeredForms) registerOwnedSpecies()
  return box.registeredForms!.includes(dexFormOf(speciesName))
}

/** Whether any Pokemon in the box (team included) is this species, in any of its formes. */
export function ownsSpecies(baseSpecies: string): boolean {
  return getState().mons.some((m) => baseSpeciesOf(m.set.species) === baseSpecies)
}

/**
 * The trainer profile's Pokedex: every species in National Dex order, each followed by
 * its alternate forms, marked if that exact form has been registered.
 */
/** The Max Raid page's carousel: every possible raid boss, and whether it's registered. */
export function getRaidBossPreviews(): RaidBossPreview[] {
  const box = getState()
  if (!box.registeredForms) registerOwnedSpecies()
  const registered = new Set(box.registeredForms)
  return raidBossCandidates().map((c) => ({
    ...c,
    registered: registered.has(c.species),
    rarityTier: speciesRarityTier(c.species)
  }))
}

export function getPokedex(): PokedexEntry[] {
  const box = getState()
  if (!box.registeredForms) registerOwnedSpecies()
  const registered = new Set(box.registeredForms)
  const forms = nationalDexForms()
  return nationalDexSpecies().flatMap(({ num, species }) => [
    {
      num,
      species,
      registered: registered.has(species),
      form: false,
      hints: pokedexLocationHints(species),
      rarityTier: speciesRarityTier(species)
    },
    ...(forms.get(num) ?? []).map((form) => ({
      num,
      species: form,
      registered: registered.has(form),
      form: true,
      hints: pokedexLocationHints(form),
      rarityTier: speciesRarityTier(form)
    }))
  ])
}

// The box's Pokemon by evolution line (see mergeLineOf: Alolan Vulpix's line apart from
// Vulpix's, a Mega or a plated Arceus with its base), for who can merge into whom - the
// same form, or a pre-evolution into its evolution (Charmander into Charizard, Eevee into
// Vaporeon - never the other way, see canMergeInto). A fused one can take in a duplicate
// but can't be merged away (its partner would go with it).
// At 5 stars (MERGE_MAX_COPIES): never merged into, nor merged away into another.
function isMergeMaxed(mon: StoredMon): boolean {
  return (mon.copies ?? 1) >= MERGE_MAX_COPIES
}

function mergeGroups(mons: StoredMon[]): Map<string, StoredMon[]> {
  const groups = new Map<string, StoredMon[]>()
  for (const mon of mons) {
    const key = mergeLineOf(mon.set.species).root
    groups.set(key, [...(groups.get(key) ?? []), mon])
  }
  return groups
}

function mergeCandidatesFor(mon: StoredMon, groups: Map<string, StoredMon[]>): MergeCandidateView[] {
  // Only a fully evolved Pokemon takes merges.
  if (!isFullyEvolved(mon.set.species)) return []
  // A 5-star one is done: it takes nothing more in and is never merged away, so it
  // doesn't count as anyone's duplicate either.
  if (isMergeMaxed(mon)) return []
  const { team: teamSlots, companionId } = getState()
  const team = new Set(teamSlots)
  return (groups.get(mergeLineOf(mon.set.species).root) ?? [])
    .filter(
      (other) => other.id !== mon.id && !other.fusedWith && !isMergeMaxed(other) && canMergeInto(mon.set.species, other.set.species)
    )
    .map((other) => {
      const evolution = mergeEvolutionFor(other.set, mon.set.species, new Map())
      const used = new Map<string, number>()
      for (const id of evolution.items) used.set(id, (used.get(id) ?? 0) + 1)
      return {
        id: other.id,
        species: other.set.species,
        level: other.set.level,
        shiny: !!other.set.shiny,
        favorite: !!other.favorite,
        copies: other.copies ?? 1,
        onTeam: team.has(other.id),
        item: other.set.item ?? '',
        evolveItems: [...used.keys()].map((id) => ({
          itemId: id,
          name: itemName(id),
          spritenum: getItemSpritenumById(id),
          owned: getItemQuantity(id)
        })),
        // The companion stays itself - it can't be merged away while it's in the slot.
        notReady:
          other.id === companionId
            ? "It's your companion - take it out of the companion slot first"
            : evolution.ready
              ? undefined
              : evolution.reason
      }
    })
}

/**
 * What merging this Pokemon into a keeper of that species takes: the same form goes in as it
 * is; a pre-evolution evolves on its way in, every step to the keeper's species possible
 * right now - its level, its friendship, and an evolution item for each step that needs one
 * (Swirlix into Slurpuff takes a Whipped Dream; Charmander into Charizard, two level steps,
 * only the level for both). `stock` holds what's left of each item after the others being
 * merged with it (it's taken from as items are counted in).
 */
function mergeEvolutionFor(
  set: PokemonSet,
  keeperSpecies: string,
  stock: Map<string, number>
): { ready: boolean; items: string[]; reason?: string } {
  const line = mergeLineOf(keeperSpecies)
  const from = dexFormOf(set.species)
  if (from === line.form) return { ready: true, items: [] }
  const index = line.ancestors.indexOf(from)
  if (index < 0) return { ready: false, items: [], reason: `It isn't in ${keeperSpecies}'s line` }
  const steps = [...line.ancestors.slice(0, index).reverse(), line.form]
  const reserved = new Map<string, number>()
  const left = (id: string): number => (stock.get(id) ?? getItemQuantity(id)) - (reserved.get(id) ?? 0)
  let current: PokemonSet = { ...set }
  const items: string[] = []
  for (const step of steps) {
    const option = evolutionOptionsFor(current).find((o) => dexFormOf(o.species) === step)
    if (!option) {
      const path = evolutionPathsFor(current).find((p) => dexFormOf(p.species) === step)
      return { ready: false, items: [], reason: path ? `${current.species}: ${path.method}` : `${current.species} can't evolve into ${step}` }
    }
    if (option.requiredItems) {
      const item = option.requiredItems.find((id) => left(id) > 0)
      if (!item) return { ready: false, items: [], reason: `Needs a ${itemName(option.requiredItems[0])}` }
      reserved.set(item, (reserved.get(item) ?? 0) + 1)
      items.push(item)
    }
    current = evolveSet(current, option.species)
  }
  for (const [id, n] of reserved) stock.set(id, (stock.get(id) ?? getItemQuantity(id)) - n)
  return { ready: true, items }
}

function toView(mon: StoredMon, arrival: number, groups?: Map<string, StoredMon[]>): BoxPokemonView {
  const { percent } = expProgressForLevel(mon.set.species, mon.set.level, mon.exp)
  const usable = evolutionOptionsFor(mon.set).filter((o) => o.requiredItems === null || o.requiredItems.some(hasItem))
  const eligibleEvolutions = usable.map((o) => o.species)
  // The same item evolveMon spends: the first accepted one the bag has.
  const evolutionItems: Record<string, EvolutionItemUse> = {}
  for (const o of usable) {
    const owned = o.requiredItems?.find(hasItem)
    const use = owned ? bagItemUse(owned) : null
    if (use) evolutionItems[o.species] = use
  }
  const canLevelUpWithCandy = mon.set.level < getProgression().levelCap && hasItem(RARE_CANDY_ITEM_ID)
  const canUseShinyPatch = !mon.set.shiny && hasItem(SHINY_PATCH_ITEM_ID)
  const formChange = formChangeFor(mon.set.species)
  // Listed whether or not the item's been unlocked yet (the edit window shows them greyed out).
  const formChanges = formChange
    ? {
        forms: formChange.forms,
        itemName: itemName(formChange.itemId),
        spritenum: getItemSpritenumById(formChange.itemId),
        ready: hasItem(formChange.itemId)
      }
    : undefined
  const fusion = fusionOptionsFor(mon)
  const itemSpritenum = mon.set.item ? getItemSpritenum(mon.set.item) : null
  return {
    id: mon.id,
    exp: mon.exp,
    expPercent: percent,
    eligibleEvolutions,
    evolutionItems,
    registeredEvolutions: eligibleEvolutions.filter(hasRegisteredSpecies),
    evolutionPaths: evolutionPathsFor(mon.set).map((path) => ({
      ...path,
      ready: eligibleEvolutions.includes(path.species),
      registered: hasRegisteredSpecies(path.species)
    })),
    canLevelUpWithCandy,
    canUseShinyPatch,
    shinyPatches: canUseShinyPatch ? getItemQuantity(SHINY_PATCH_ITEM_ID) : undefined,
    formChanges,
    fusions: fusion.fusions,
    unfuse: fusion.unfuse,
    itemSpritenum,
    favorite: !!mon.favorite,
    maxFriendship: atMaxFriendship(mon),
    companion: getState().companionId === mon.id || undefined,
    copies: mon.copies ?? 1,
    mergeStars: mergeStarsFor(mon.copies),
    gigantamax: !!mon.set.gigantamax,
    gmaxLook: gmaxLookOf(mon.set) || undefined,
    mergeCandidates: groups ? mergeCandidatesFor(mon, groups) : undefined,
    rarityTier: speciesRarityTier(mon.set.species),
    sellPrice: monSellPrice(speciesRarityTier(mon.set.species), !!mon.set.shiny, mon.copies),
    dexNum: speciesDexNum(mon.set.species),
    bst: bstOf(mon.set.species),
    arrival,
    ...buildPokemonSummary(mon.set.species, mon.set)
  }
}

// The Reveal Glass's four: any one of them unlocks it.
const FORCES_OF_NATURE = new Set(['Tornadus', 'Thundurus', 'Landorus', 'Enamorus'])

/** What the box holds, for achievements: its shiny and legendary Pokemon, and the Pokedex. */
export function boxAchievementStats(): {
  rotom: number
  necrozma: number
  kyurem: number
  calyrex: number
  hoopa: number
  forces: number
  shaymin: number
  deoxys: number
  zygarde: number
  shiny: number
  // How many Gigantamax species it holds.
  gmaxSpecies: number
  legendaryClass: number
  restricted: number
  dexSpecies: number
  dexForms: number
  maxFriendship: number
  alcremieForms: number
  miniorColors: number
  pikachuForms: number
} {
  const box = getState()
  if (!box.registeredForms || !box.registered || !box.registeredLooks) registerOwnedSpecies()
  const mons = ownedMons()
  const tiers = mons.map((m) => speciesRarityTier(m.set.species))
  const species = box.registered!.length
  return {
    rotom: mons.filter((m) => baseSpeciesOf(m.set.species) === 'Rotom').length,
    necrozma: mons.filter((m) => baseSpeciesOf(m.set.species) === 'Necrozma').length,
    kyurem: mons.filter((m) => baseSpeciesOf(m.set.species) === 'Kyurem').length,
    calyrex: mons.filter((m) => baseSpeciesOf(m.set.species) === 'Calyrex').length,
    hoopa: mons.filter((m) => baseSpeciesOf(m.set.species) === 'Hoopa').length,
    forces: mons.filter((m) => FORCES_OF_NATURE.has(baseSpeciesOf(m.set.species))).length,
    shaymin: mons.filter((m) => baseSpeciesOf(m.set.species) === 'Shaymin').length,
    deoxys: mons.filter((m) => baseSpeciesOf(m.set.species) === 'Deoxys').length,
    zygarde: mons.filter((m) => baseSpeciesOf(m.set.species) === 'Zygarde').length,
    shiny: mons.filter((m) => m.set.shiny).length,
    gmaxSpecies: new Set(mons.filter((m) => m.set.gigantamax).map((m) => dexFormOf(m.set.species))).size,
    legendaryClass: tiers.filter((t) => t === 'epic' || t === 'legendary').length,
    restricted: tiers.filter((t) => t === 'legendary').length,
    dexSpecies: species,
    // Every registered form past each species' own entry.
    dexForms: Math.max(0, box.registeredForms!.length - species),
    maxFriendship: mons.filter(atMaxFriendship).length,
    alcremieForms: box.registeredForms!.filter((f) => ALCREMIE_FORMS.includes(f)).length,
    miniorColors: (box.registeredLooks ?? []).filter((f) => MINIOR_COLORS.includes(f)).length,
    pikachuForms: new Set(mons.map((m) => dexFormOf(m.set.species)).filter((f) => PIKACHU_FORMS.includes(f))).size
  }
}

// A set with no happiness recorded predates friendship being tracked and counts as maxed.
function atMaxFriendship(mon: StoredMon): boolean {
  return (mon.set.happiness ?? MAX_HAPPINESS) >= MAX_HAPPINESS
}

function companionUnlocked(): boolean {
  return getAchievementProgress().unlocked.includes(COMPANION_ACHIEVEMENT_ID)
}

/**
 * Makes any Pokemon the companion, shown in the slot beside the team. It stays in the box -
 * and on the team, if it's there - to be used as ever, and grows closer battling at your side
 * (see awardFriendshipToTeam).
 */
export function setCompanion(id: string): BoxState {
  if (!companionUnlocked()) throw new Error('The companion slot unlocks with the Best Friends achievement')
  const box = getState()
  const mon = box.mons.find((m) => m.id === id)
  if (!mon) throw new Error(`Unknown Pokemon id: ${id}`)
  box.companionId = mon.id
  // A new companion starts at the size its height gives it.
  box.companionSize = undefined
  persist()
  return getBoxState()
}

/** How big the companion is drawn: S, M, L or XL, or 'auto' - by its height. */
export function setCompanionSize(size: CompanionSizeChoice): BoxState {
  if (size !== 'auto' && !COMPANION_SIZES.includes(size)) throw new Error('Pick a size: Auto, S, M, L or XL')
  getState().companionSize = size === 'auto' ? undefined : size
  persist()
  return getBoxState()
}

function companionSizeNow(): CompanionSize {
  const { companionSize } = getState()
  if (companionSize && companionSize !== 'auto') return companionSize
  const companion = companionMon()
  return companion ? autoCompanionSize(speciesHeightM(companion.set.species), gmaxLookOf(companion.set)) : 'S'
}

/** No companion any more (the Pokemon itself was in the box all along). */
export function returnCompanion(): BoxState {
  const box = getState()
  if (!box.companionId) throw new Error('There is no companion')
  box.companionId = null
  persist()
  return getBoxState()
}

export function getBoxState(): BoxState {
  const groups = mergeGroups(getState().mons)
  const companion = companionMon()
  return {
    mons: getState().mons.map((mon, i) => toView(mon, i, groups)),
    team: [...getState().team],
    companion: companion ? toView(companion, -1, groups) : null,
    companionId: companion?.id ?? null,
    companionUnlocked: companionUnlocked(),
    companionSize: companionSizeNow(),
    companionSizeChoice: getState().companionSize ?? 'auto'
  }
}

export function addRandomMon(): BoxState {
  const set = generateRandomSingle('gen9randombattle')
  const exp = totalExpForSpeciesLevel(set.species, set.level)
  getState().mons.push({ id: randomUUID(), set, exp })
  persist()
  return getBoxState()
}

// Debug: a Pokemon of the admin's choosing, straight into the box - a basic set of that
// species at the level asked (1-100), shiny if asked.
export function addMonOfSpecies(species: string, level: number, shiny: boolean): BoxState {
  const set = { ...buildBasicSet(species, Math.max(1, Math.min(100, Math.round(level) || 1))), happiness: 0, shiny }
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
export function addCaughtMon(set: PokemonSet, extras: { copies?: number; gigantamax?: boolean } = {}): BoxState {
  const caught: PokemonSet = {
    ...set,
    item: '',
    happiness: 0,
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }
  }
  // A Max Raid's boss: its Gigantamax form, and its merge stars as copies.
  if (extras.gigantamax) caught.gigantamax = true
  const exp = totalExpForSpeciesLevel(caught.species, caught.level)
  getState().mons.push({ id: randomUUID(), set: caught, exp, ...(extras.copies && extras.copies > 1 ? { copies: extras.copies } : {}) })
  persist()
  return getBoxState()
}

/** The id of the Pokemon most recently added to the box. */
export function lastAddedMonId(): string | null {
  const mons = getState().mons
  return mons.length > 0 ? mons[mons.length - 1].id : null
}

/**
 * Sells a Pokemon from the box (off the team too) for its rarity's price (see
 * POKEMON_SELL_PRICES). The last Pokemon can't be sold - there'd be nobody left to battle.
 */
// Alchemist: each Pokemon sold has a chance to turn up a random evolution item - into the
// bag; their names (one per item found).
function alchemistFinds(count: number): string[] {
  if (!hasTitle('Alchemist')) return []
  const found: string[] = []
  for (let i = 0; i < count; i++) {
    if (Math.random() >= ALCHEMIST_ITEM_CHANCE) continue
    const itemId = randomEvolutionItemId()
    if (!itemId) continue
    addItem(itemId, 1)
    found.push(itemName(itemId))
  }
  return found
}

export function sellMon(id: string): { sold: number; species: string; money: number; box: BoxState; found: string[] } {
  const box = getState()
  const index = box.mons.findIndex((m) => m.id === id)
  if (index === -1) throw new Error(`Unknown Pokemon id: ${id}`)
  if (box.mons.length <= 1) throw new Error("That's your last Pokemon - it can't be sold")
  if (box.mons[index].fusedWith) throw new Error('Unfuse it first - its partner would be sold with it')
  const [mon] = box.mons.splice(index, 1)
  box.team = box.team.map((slot) => (slot === id ? null : slot))
  const sold = monSellPrice(speciesRarityTier(mon.set.species), !!mon.set.shiny, mon.copies)
  const money = addMoney(sold)
  persist()
  countAchievement('pokemonSold')
  if (mon.set.shiny) countAchievement('shinySold')
  const found = alchemistFinds(1)
  return { sold, species: mon.set.species, money, box: getBoxState(), found }
}

/**
 * Sells several Pokemon at once (the expanded box's multi-select) - all or nothing: every
 * one is checked first, and at least one Pokemon always stays behind.
 */
export function sellMons(ids: string[]): { sold: number; count: number; money: number; box: BoxState; found: string[] } {
  const box = getState()
  const wanted = new Set(ids)
  const selling = box.mons.filter((m) => wanted.has(m.id))
  if (selling.length === 0) throw new Error('Nothing to sell')
  if (selling.length !== wanted.size) throw new Error('One of those Pokemon is no longer in the box')
  if (selling.some((m) => m.fusedWith)) throw new Error('Unfuse it first - its partner would be sold with it')
  if (box.mons.length - selling.length < 1) throw new Error("You can't sell every Pokemon - keep at least one")
  box.mons = box.mons.filter((m) => !wanted.has(m.id))
  box.team = box.team.map((slot) => (slot && wanted.has(slot) ? null : slot))
  const sold = selling.reduce((sum, m) => sum + monSellPrice(speciesRarityTier(m.set.species), !!m.set.shiny, m.copies), 0)
  const money = addMoney(sold)
  persist()
  countAchievement('pokemonSold', selling.length)
  countAchievement('shinySold', selling.filter((m) => m.set.shiny).length)
  const found = alchemistFinds(selling.length)
  return { sold, count: selling.length, money, box: getBoxState(), found }
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
  // A move it learns only by TM needs that TM - unless it already knows it.
  if (!admin) {
    const locked = lockedTmMoves(input.species, mon.set.moves)
    const blocked = input.moves.find((m) => locked.has(toID(m)))
    if (blocked) {
      const name = getTmCatalog().find((t) => t.moveId === toID(blocked))?.name ?? blocked
      throw new Error(`${name} needs its TM - find it first`)
    }
  }
  if (!admin && newItem !== previousItem) {
    // Check the new item before touching anything else, so a failed equip
    // (item not actually in the bag) leaves the mon and bag both untouched.
    if (newItem && !removeItem(toID(newItem), 1)) {
      throw new Error(`You don't have a ${newItem} in your bag`)
    }
    if (previousItem) addItem(toID(previousItem), 1)
  }
  // In the form its (possibly new) held item gives it - see heldItemForme.
  mon.set = heldItemForme(applyEditableSet(mon.set, input))
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

/**
 * Merges duplicates into a Pokemon: their copies add to its own (see mergeStarsFor), a
 * shiny one makes it shiny, it keeps the higher friendship and the higher level (exp and
 * all), and their held items go back to the bag. They leave the box (and the team). All or nothing - every one is checked first.
 */
export function mergeMons(keeperId: string, fodderIds: string[]): BoxState {
  mergeInto(keeperId, fodderIds)
  return getBoxState()
}

/**
 * Merges the picked Pokemon into the keeper, up to the top (see planMerge): past it, the
 * last one only gives what fits and keeps the rest. Only those merged in whole leave the
 * box and pass on their shininess, heart, level and friendship. How many went in.
 */
function mergeInto(keeperId: string, fodderIds: string[]): number {
  const box = getState()
  const keeper = box.mons.find((m) => m.id === keeperId)
  if (!keeper) throw new Error(`Unknown Pokemon id: ${keeperId}`)
  const wanted = new Set(fodderIds)
  if (wanted.size === 0) throw new Error('Pick at least one Pokemon to merge in')
  if (wanted.has(keeperId)) throw new Error("A Pokemon can't be merged into itself")
  const fodder = box.mons.filter((m) => wanted.has(m.id))
  if (fodder.length !== wanted.size) throw new Error('One of those Pokemon is no longer in the box')
  // Only the same form: an alternate form (Alolan, Therian, a Rotom appliance) is its own species here.
  const species = dexFormOf(keeper.set.species)
  if (fodder.some((m) => !canMergeInto(keeper.set.species, m.set.species))) {
    throw new Error(`Only another ${species}, or one of its pre-evolutions, can be merged in`)
  }
  if (fodder.some((m) => m.fusedWith)) throw new Error('Unfuse it first - its partner would be merged away with it')
  if (fodder.some(isMergeMaxed)) throw new Error(`A ${MERGE_MAX_STARS}-star Pokemon can't be merged into another`)
  if (fodder.some((m) => m.id === box.companionId)) {
    throw new Error("Your companion can't be merged into anything - take it out of the companion slot first")
  }
  if ((keeper.copies ?? 1) >= MERGE_MAX_COPIES) throw new Error(`${keeper.set.species} is already at ${MERGE_MAX_STARS} stars`)
  if (!isFullyEvolved(keeper.set.species)) throw new Error(`${keeper.set.species} has to be fully evolved to take merges`)
  // A pre-evolution evolves on its way in - everything it needs for that, with the bag's
  // items shared out among them in turn.
  const stock = new Map<string, number>()
  const evolveItems = new Map<string, string[]>()
  for (const m of fodder) {
    const evolution = mergeEvolutionFor(m.set, keeper.set.species, stock)
    if (!evolution.ready) throw new Error(`${m.set.species} can't merge in yet - ${evolution.reason}`)
    evolveItems.set(m.id, evolution.items)
  }
  const plan = planMerge(
    keeper.copies ?? 1,
    fodder.map((m) => ({ id: m.id, copies: m.copies ?? 1 }))
  )
  let copies = plan.copiesAfter
  const whole = new Set(plan.whole)
  const wasShiny = !!keeper.set.shiny
  // The overflow stays with the one merged in part.
  if (plan.partial) {
    const partial = fodder.find((m) => m.id === plan.partial!.id)!
    partial.copies = plan.partial.left
  }
  for (const mon of fodder.filter((m) => whole.has(m.id))) {
    // The evolution items it used on its way in (not counted as an evolution).
    for (const itemId of evolveItems.get(mon.id) ?? []) removeItem(itemId, 1)
    if (mon.set.item) addItem(toID(mon.set.item), 1)
    if (mon.set.shiny) keeper.set.shiny = true
    if (mon.set.gigantamax) keeper.set.gigantamax = true
    // A favorite merged in keeps its heart - on the one it went into.
    if (mon.favorite) keeper.favorite = true
    keeper.set.happiness = Math.max(keeper.set.happiness ?? 0, mon.set.happiness ?? 0)
    // A higher-level one brings its level up with it, exp and all.
    if (mon.set.level > keeper.set.level || (mon.set.level === keeper.set.level && mon.exp > keeper.exp)) {
      keeper.set.level = mon.set.level
      keeper.exp = mon.exp
    }
  }
  keeper.copies = copies
  box.mons = box.mons.filter((m) => !whole.has(m.id))
  box.team = box.team.map((slot) => (slot && whole.has(slot) ? null : slot))
  persist()
  const merged = whole.size + (plan.partial ? 1 : 0)
  countAchievement('pokemonMerged', merged)
  if (!wasShiny && keeper.set.shiny) countAchievement('mergeShinied')
  recordAchievementBest('mergedStars', mergeStarsFor(copies))
  return merged
}

/**
 * The expanded box's "select to merge": the picked Pokemon, evolution line by line,
 * each merged into the best of them - the most evolved, then the most copies, then the highest level, then a
 * shiny, then a favorite. Past the 32-copy top the rest stays in the box (see planMerge),
 * one already at the top is left out, and a Pokemon with no other of its species picked
 * is left alone.
 */
export function mergeSelectedMons(ids: string[]): { box: BoxState; merged: number; results: { species: string; stars: number }[] } {
  const box = getState()
  const wanted = new Set(ids)
  const picked = box.mons.filter((m) => wanted.has(m.id) && !m.fusedWith && (m.copies ?? 1) < MERGE_MAX_COPIES)
  const groups = new Map<string, StoredMon[]>()
  for (const mon of picked) {
    const key = mergeLineOf(mon.set.species).root
    groups.set(key, [...(groups.get(key) ?? []), mon])
  }
  const results: { species: string; stars: number }[] = []
  let merged = 0
  for (const group of groups.values()) {
    if (group.length < 2) continue
    // The keeper is fully evolved (only that takes merges) - the most copies first...
    // (the companion before the rest, as it can't go into another)...
    const ranked = [...group].sort(
      (a, b) =>
        Number(isFullyEvolved(b.set.species)) - Number(isFullyEvolved(a.set.species)) ||
        Number(b.id === box.companionId) - Number(a.id === box.companionId) ||
        (b.copies ?? 1) - (a.copies ?? 1) ||
        b.set.level - a.set.level ||
        Number(!!b.set.shiny) - Number(!!a.set.shiny) ||
        Number(!!b.favorite) - Number(!!a.favorite)
    )
    const [keeper, ...rest] = ranked
    if (!isFullyEvolved(keeper.set.species)) continue
    // Only its own form and the pre-evolutions that can evolve into it now (the bag's items
    // shared out in turn) - a sibling branch (Jolteon beside a Vaporeon keeper), or one
    // not ready, is left for another time.
    const stock = new Map<string, number>()
    const fodder = rest.filter(
      (m) =>
        m.id !== box.companionId &&
        canMergeInto(keeper.set.species, m.set.species) &&
        mergeEvolutionFor(m.set, keeper.set.species, stock).ready
    )
    if (fodder.length === 0) continue
    merged += mergeInto(
      keeper.id,
      fodder.map((m) => m.id)
    )
    results.push({ species: keeper.set.species, stars: mergeStarsFor(keeper.copies) })
  }
  if (merged === 0) throw new Error('Pick at least two of the same Pokemon to merge')
  return { box: getBoxState(), merged, results }
}

// The box Pokemon this one would best merge into: one that can take it in (its own form or
// an evolution of it - see canMergeInto) and isn't at the top yet - the most copies first,
// then the most evolved, the highest level, a shiny, a favorite.
function bestMergeKeeperFor(monId: string): StoredMon | null {
  const box = getState()
  const mon = box.mons.find((m) => m.id === monId)
  if (!mon || mon.fusedWith || isMergeMaxed(mon)) return null
  const keepers = box.mons.filter(
    (k) =>
      k.id !== monId &&
      (k.copies ?? 1) < MERGE_MAX_COPIES &&
      isFullyEvolved(k.set.species) &&
      canMergeInto(k.set.species, mon.set.species) &&
      mergeEvolutionFor(mon.set, k.set.species, new Map()).ready
  )
  keepers.sort(
    (a, b) =>
      (b.copies ?? 1) - (a.copies ?? 1) ||
      b.set.level - a.set.level ||
      Number(!!b.set.shiny) - Number(!!a.set.shiny) ||
      Number(!!b.favorite) - Number(!!a.favorite)
  )
  return keepers[0] ?? null
}

/** Which box Pokemon a Pokemon would auto-merge into, and its stars now (null: none). */
export function mergeKeeperPreview(monId: string): { species: string; stars: number; uses: string[] } | null {
  const keeper = bestMergeKeeperFor(monId)
  const mon = getState().mons.find((m) => m.id === monId)
  if (!keeper || !mon) return null
  const uses = mergeEvolutionFor(mon.set, keeper.set.species, new Map()).items.map(itemName)
  return { species: keeper.set.species, stars: mergeStarsFor(keeper.copies), uses }
}

/** Merges a Pokemon straight into its best keeper (a Random Pokemon's "Auto merge"). */
export function autoMergeMon(monId: string): { box: BoxState; species: string; stars: number } {
  const keeper = bestMergeKeeperFor(monId)
  if (!keeper) throw new Error('There is nothing in the box for it to merge into')
  mergeInto(keeper.id, [monId])
  return { box: getBoxState(), species: keeper.set.species, stars: mergeStarsFor(keeper.copies) }
}

/** Each team member's merge stars, in the same order as getTeamPokemonSets. */
export function getTeamMergeStars(): number[] {
  const byId = new Map(getState().mons.map((m) => [m.id, m]))
  return getState()
    .team.flatMap((id) => (id !== null && byId.has(id) ? [mergeStarsFor(byId.get(id)!.copies)] : []))
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
  return readSavedTeamMons(playerSlug).map((m) => structuredClone(m.set))
}

/** That player's team members' merge stars, in the same order as readSavedTeamOf. */
export function readSavedTeamStarsOf(playerSlug: string): number[] {
  return readSavedTeamMons(playerSlug).map((m) => mergeStarsFor(m.copies))
}

function readSavedTeamMons(playerSlug: string): StoredMon[] {
  let saved: StoredBox
  try {
    saved = JSON.parse(readFileSync(join(playerDirFor(playerSlug), 'box.json'), 'utf8')) as StoredBox
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw new Error("That player's save couldn't be read")
  }
  if (!Array.isArray(saved.mons) || !Array.isArray(saved.team)) return []
  const byId = new Map(saved.mons.map((m) => [m.id, m]))
  return saved.team.flatMap((id) => {
    const mon = id ? byId.get(id) : undefined
    return mon ? [mon] : []
  })
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

/**
 * Uses Exp. Candies one after another until the whole team is at the level cap or the
 * candies run out. Each team member's results are added up across the candies used.
 */
export function useExpCandiesUntilCap(itemId: string): { used: number; results: ExpGainResult[]; allCapped: boolean } {
  const teamAtCap = (): boolean => {
    const levelCap = getProgression().levelCap
    const byId = new Map(getState().mons.map((m) => [m.id, m]))
    return getState().team.every((id) => !id || !byId.get(id) || byId.get(id)!.set.level >= levelCap)
  }
  let used = 0
  let merged: ExpGainResult[] = []
  // useExpCandy refuses (with the reason) when the team's already capped or there's none.
  do {
    const results = useExpCandy(itemId)
    used++
    merged =
      merged.length === 0
        ? results
        : results.map((r, i) => ({
            ...r,
            gained: merged[i].gained + r.gained,
            levelBefore: merged[i].levelBefore,
            cappedOut: merged[i].cappedOut && r.cappedOut
          }))
  } while (hasItem(itemId) && !teamAtCap())
  return { used, results: merged, allCapped: teamAtCap() }
}

// Every Pokemon on the team - the same ones awardExpToTeam pays out to - grows
// closer to its trainer after a battle won, whether or not it had exp to
// gain, and so does the companion, as if it were on the team - twice over when
// it's on the team as well. Capped at MAX_HAPPINESS. Deliberately not part of ExpGainResult: it's
// never shown on the battle result screen.
export function awardFriendshipToTeam(baseAmount = FRIENDSHIP_PER_BATTLE): void {
  // The Friendship Charm: twice as much.
  const amount = hasItem(FRIENDSHIP_CHARM_ITEM_ID) ? baseAmount * FRIENDSHIP_CHARM_MULTIPLIER : baseAmount
  const byId = new Map(getState().mons.map((m) => [m.id, m]))
  for (const id of [...getState().team, getState().companionId]) {
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
  // A Sweet's cream - or, now and then, a rare one (see rollMilceryCream).
  mon.set = evolveSet(mon.set, rollMilceryCream(targetSpecies))
  persist()
  countAchievement('evolutions')
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

/**
 * The Rotom Catalog: changes a Rotom into another of its forms (the catalog isn't used
 * up), with the new form's best Smogon set - moves, ability, nature, EVs and IVs - fitted
 * to its level. Its held item stays.
 */
function itemName(itemId: string): string {
  return getEditorOptions().items.find((i) => i.id === itemId)?.name ?? itemId
}

// The fusion menu entries for a Pokemon: the partners in the box a plain Necrozma, Kyurem
// or Calyrex can fuse with (fusion item in the bag), or who a fused one would hand back.
function fusionOptionsFor(mon: StoredMon): Pick<BoxPokemonView, 'fusions' | 'unfuse'> {
  if (mon.fusedWith) {
    const rule = FUSIONS.find((f) => f.result === mon.set.species)
    if (!rule || !hasItem(rule.itemId)) return {}
    return { unfuse: { partnerSpecies: mon.fusedWith.set.species, itemName: itemName(rule.itemId) } }
  }
  const rules = FUSIONS.filter((f) => f.base === mon.set.species && hasItem(f.itemId))
  if (rules.length === 0) return {}
  const fusions = rules.flatMap((rule) =>
    getState()
      .mons.filter((m) => m.id !== mon.id && !m.fusedWith && baseSpeciesOf(m.set.species) === rule.partner)
      .map((m) => ({
        partnerId: m.id,
        partnerSpecies: m.set.species,
        partnerLevel: m.set.level,
        partnerFavorite: !!m.favorite,
        result: rule.result,
        itemName: itemName(rule.itemId)
      }))
  )
  return fusions.length > 0 ? { fusions } : {}
}

// A Pokemon taking a new form, with the new form's best Smogon set fitted to its level.
function withSmogonSet(set: PokemonSet, form: string): PokemonSet {
  const [best] = listAutoSets(form)
  return formChangedSet(set, form, buildAutoSet(form, set.level, best.id, false, set.moves))
}

/**
 * Fuses a plain Necrozma, Kyurem or Calyrex with a partner from the box (with the right
 * fusion item - never used up): the partner leaves the box (and team) and waits inside
 * until unfused, and the fused Pokemon takes a Smogon set for its new form.
 */
export function fuseMon(id: string, partnerId: string): BoxState {
  const box = getState()
  const mon = box.mons.find((m) => m.id === id)
  const partner = box.mons.find((m) => m.id === partnerId)
  if (!mon || !partner || mon === partner) throw new Error('Unknown Pokemon')
  if (mon.fusedWith || partner.fusedWith) throw new Error('One of those is already fused')
  const rule = FUSIONS.find((f) => f.base === mon.set.species && f.partner === baseSpeciesOf(partner.set.species))
  if (!rule) throw new Error(`${mon.set.species} can't fuse with ${partner.set.species}`)
  if (!hasItem(rule.itemId)) throw new Error(`You don't have the ${itemName(rule.itemId)}`)
  box.mons = box.mons.filter((m) => m !== partner)
  box.team = box.team.map((slot) => (slot === partner.id ? null : slot))
  mon.fusedWith = partner
  mon.set = withSmogonSet(mon.set, rule.result)
  persist()
  return getBoxState()
}

/** Splits a fused Pokemon back up: it returns to its plain form (with a set for it), and its partner rejoins the box. */
export function unfuseMon(id: string): BoxState {
  const box = getState()
  const mon = box.mons.find((m) => m.id === id)
  if (!mon?.fusedWith) throw new Error("That Pokemon isn't fused")
  const rule = FUSIONS.find((f) => f.result === mon.set.species)
  if (!rule) throw new Error(`${mon.set.species} can't be unfused`)
  if (!hasItem(rule.itemId)) throw new Error(`You don't have the ${itemName(rule.itemId)}`)
  const partner = mon.fusedWith
  delete mon.fusedWith
  mon.set = withSmogonSet(mon.set, rule.base)
  box.mons.push(partner)
  persist()
  return getBoxState()
}

/**
 * A form-change key item (the Rotom Catalog, Prison Bottle, Reveal Glass, Gracidea or
 * Meteorite - never used up): changes a Pokemon into another of its forms, with the new
 * form's best Smogon set - moves, ability, nature, EVs and IVs - fitted to its level. Its
 * held item stays.
 */
export function changeForm(id: string, form: string): BoxState {
  const mon = getState().mons.find((m) => m.id === id)
  if (!mon) throw new Error(`Unknown Pokemon id: ${id}`)
  const change = formChangeFor(mon.set.species)
  if (!change || !change.forms.includes(form)) throw new Error(`${mon.set.species} can't change into ${form}`)
  if (!hasItem(change.itemId)) throw new Error(`You don't have the ${itemName(change.itemId)}`)
  // Alcremie's creams and Pikachu's outfits are the same Pokemon otherwise: it keeps its whole set.
  const lookOnly = change.itemId === DECORATION_BOX_ITEM_ID || change.itemId === FASHION_CASE_ITEM_ID
  mon.set = lookOnly ? { ...mon.set, species: form } : withSmogonSet(mon.set, form)
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
