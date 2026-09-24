import { createRequire } from 'node:module'
import type { AutoSetOption, AutoSetResult, StatBlock } from '../../shared/battle-types'
import smogonSets from './data/smogon-sets.json'
import { learnableMoveIds } from './sim-access'
import { hasItem } from './bag-store'

// pokemon-showdown is CommonJS - loaded the same way sim-access.ts does.
const require = createRequire(import.meta.url)
const { Dex, toID } = require('pokemon-showdown') as typeof import('pokemon-showdown')
const randomSets = require('pokemon-showdown/dist/data/random-battles/gen9/sets.json') as Record<
  string,
  { sets: { role: string; movepool: string[]; abilities: string[]; teraTypes?: string[] }[] }
>

/**
 * The Pokemon editor's Auto-fill: a whole set - moves, ability, item, nature,
 * EVs, IVs and Tera type - from Smogon's published sets (built into
 * data/smogon-sets.json by scripts/build-smogon-sets.mjs), from Showdown's Random
 * Battle roles for the few Pokemon Smogon has none for, or worked out from its
 * stats and movepool as a last resort. Fitted to this game's rules: outside
 * admin editing only moves learnable at its level and items in the bag.
 */

// One Smogon set as the data file has it: any field can offer alternatives.
type OneOrMany = string | string[]
interface SmogonSet {
  format: string
  formatName: string
  name: string
  moves: OneOrMany[]
  ability?: OneOrMany
  item?: OneOrMany
  nature?: OneOrMany
  evs?: Partial<StatBlock> | Partial<StatBlock>[]
  ivs?: Partial<StatBlock> | Partial<StatBlock>[]
  teratypes?: OneOrMany
}

const SMOGON = smogonSets as unknown as Record<string, SmogonSet[]>
const STAT_KEYS: (keyof StatBlock)[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe']
const GENERATED_ID = 'generated'

function list<T>(value: T | T[] | undefined): T[] {
  return value === undefined ? [] : Array.isArray(value) ? value : [value]
}

function statBlock(fill: number, partial?: Partial<StatBlock>): StatBlock {
  const block = { hp: fill, atk: fill, def: fill, spa: fill, spd: fill, spe: fill }
  for (const key of STAT_KEYS) if (typeof partial?.[key] === 'number') block[key] = partial[key]!
  return block
}

/** Every set on offer for a species, best first (the first is pre-selected). */
export function listAutoSets(speciesName: string): AutoSetOption[] {
  const species = Dex.species.get(speciesName)
  const options: AutoSetOption[] = (SMOGON[species.id] ?? []).map((set, i) => ({
    id: `smogon:${i}`,
    label: `${set.name} · ${set.formatName}`
  }))
  for (const [i, set] of (randomSets[species.id]?.sets ?? []).entries()) {
    options.push({ id: `random:${i}`, label: `${set.role} · Random Battle` })
  }
  options.push({ id: GENERATED_ID, label: 'Auto-generated from its stats' })
  return options
}

// How good an attacking move is for this Pokemon, roughly: power, accuracy, STAB,
// and whether it uses its better attacking stat. Null for moves not worth picking
// automatically (status moves, fixed damage, recharging, charging, self-KO, removed
// moves). A move whose power depends on the situation (Reversal, Fling) counts as 50.
function attackScore(moveId: string, types: string[], physicalAttacker: boolean): number | null {
  const move = Dex.moves.get(moveId)
  if (!move.exists || move.category === 'Status' || move.isNonstandard) return null
  if (move.flags.recharge || move.flags.charge || move.selfdestruct) return null
  if (move.damage !== undefined || move.damageCallback) return null
  const power = move.basePower || 50
  const accuracy = move.accuracy === true ? 1 : move.accuracy / 100
  const stab = types.includes(move.type) ? 1.5 : 1
  const fitsStat = (move.category === 'Physical') === physicalAttacker ? 1 : 0.6
  return power * accuracy * stab * fitsStat
}

// The best attacking moves out of a pool, preferring a spread of types.
function bestAttacks(pool: string[], count: number, types: string[], physical: boolean, exclude: Set<string>): string[] {
  const scored = pool
    .filter((id) => !exclude.has(id))
    .map((id) => ({ id, type: Dex.moves.get(id).type, score: attackScore(id, types, physical) }))
    .filter((m): m is { id: string; type: string; score: number } => m.score !== null)
  const picked: string[] = []
  const usedTypes = new Set<string>()
  while (picked.length < count && scored.length > 0) {
    scored.sort((a, b) => (usedTypes.has(b.type) ? b.score / 2 : b.score) - (usedTypes.has(a.type) ? a.score / 2 : a.score))
    const next = scored.shift()!
    picked.push(next.id)
    usedTypes.add(next.type)
  }
  return picked
}

/**
 * Builds the chosen set for a Pokemon at a level. `admin` lifts the game's limits
 * (any move it can ever learn, any item) - otherwise moves must be learnable at
 * its level, and an item it doesn't have in the bag is left off. What had to
 * change to fit comes back in `notes`.
 */
export function buildAutoSet(speciesName: string, level: number, optionId: string, admin: boolean): AutoSetResult {
  const species = Dex.species.get(speciesName)
  const types = [...species.types]
  const physical = species.baseStats.atk >= species.baseStats.spa
  const learnablePool = learnableMoveIds(species.id, admin ? 100 : level)
  const learnable = new Set(learnablePool)
  const canUse = (moveId: string): boolean => admin || learnable.has(moveId)
  const speciesAbilities = Object.values(species.abilities) as string[]
  const notes: string[] = []

  const moves: string[] = []
  let abilityChoices: string[] = []
  let itemChoices: string[] = []
  let nature: string
  let evs: StatBlock
  let ivs = statBlock(31)
  let teraType: string | null = types[0] ?? null

  const [kind, indexText] = optionId.split(':')
  const index = Number(indexText)
  const smogon = kind === 'smogon' ? SMOGON[species.id]?.[index] : undefined
  const random = kind === 'random' ? randomSets[species.id]?.sets[index] : undefined

  if (smogon) {
    // Each slot takes its first option this Pokemon can use; a slot none of whose
    // options it can is filled below with the best move it does have.
    const missed: string[] = []
    for (const slot of smogon.moves) {
      const options = list(slot).map((name) => toID(name))
      const pick = options.find((id) => canUse(id) && !moves.includes(id))
      if (pick) moves.push(pick)
      else missed.push(Dex.moves.get(options[0]).name)
    }
    for (const name of missed) {
      // Same type as the move it replaces if there's one, else the best attack left.
      const missedType = Dex.moves.get(name).type
      const taken = new Set(moves)
      const sameType = learnablePool.filter((id) => Dex.moves.get(id).type === missedType)
      const pick =
        bestAttacks(sameType, 1, types, physical, taken)[0] ?? bestAttacks(learnablePool, 1, types, physical, taken)[0]
      if (pick) {
        moves.push(pick)
        notes.push(`${name} isn't learnable at Lv ${level} - used ${Dex.moves.get(pick).name} instead`)
      } else {
        notes.push(`${name} isn't learnable at Lv ${level}, and there was nothing to replace it with`)
      }
    }
    abilityChoices = list(smogon.ability)
    itemChoices = list(smogon.item)
    nature = list(smogon.nature)[0] ?? (physical ? 'Adamant' : 'Modest')
    evs = statBlock(0, list(smogon.evs)[0])
    ivs = statBlock(31, list(smogon.ivs)[0])
    teraType = list(smogon.teratypes)[0] ?? teraType
  } else {
    // A Random Battle role narrows the moves to its movepool; otherwise it's
    // everything this Pokemon can learn. Attacks first, a status move to round out.
    const pool = random ? random.movepool.map((name) => toID(name)).filter(canUse) : learnablePool
    moves.push(...bestAttacks(pool, 4, types, physical, new Set()))
    if (random) {
      for (const id of pool) if (moves.length < 4 && !moves.includes(id)) moves.push(id)
      abilityChoices = random.abilities
      teraType = random.teraTypes?.[0] ?? teraType
    } else {
      abilityChoices = speciesAbilities
    }
    // Its better attacking stat and Speed maxed, with a nature for the attack.
    nature = physical ? 'Adamant' : 'Modest'
    evs = statBlock(0, { hp: 4, [physical ? 'atk' : 'spa']: 252, spe: 252 })
  }

  // Still short of four (a low level, or a role whose moves it can't learn yet)? Top
  // up with the best attacks it can learn, then any status moves it knows.
  if (moves.length < 4) {
    const before = moves.length
    moves.push(...bestAttacks(learnablePool, 4 - moves.length, types, physical, new Set(moves)))
    for (const id of learnablePool) {
      if (moves.length >= 4) break
      if (!moves.includes(id) && !Dex.moves.get(id).isNonstandard) moves.push(id)
    }
    if (moves.length > before && (smogon || random)) {
      notes.push(`Filled ${moves.length - before} more slot(s) with moves it can learn at Lv ${level}`)
    }
  }

  const ability = abilityChoices.find((name) => speciesAbilities.includes(name)) ?? null
  if (!ability && abilityChoices.length > 0) notes.push(`It can't have ${abilityChoices[0]} - kept its current ability`)

  // Admin editing can hand out any item; otherwise the set's item only goes on if
  // it's in the bag (any one of its options will do).
  let item: string | null = null
  if (itemChoices.length > 0) {
    const owned = admin ? itemChoices[0] : itemChoices.find((name) => hasItem(toID(name)))
    if (owned) item = Dex.items.get(owned).name
    else notes.push(`The set uses ${itemChoices.join(' or ')} - not in your bag, so its current item stays`)
  }

  return { moves: moves.slice(0, 4), ability, item, nature, evs, ivs, teraType, notes }
}
