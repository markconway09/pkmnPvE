import type { AiDifficulty, BossStep, ProgressionState, RadicalRedImportResult } from '../../shared/battle-types'
import bossData from './data/radical-red-bosses.json'
import trainerData from './data/radical-red-trainers.json'
import { addTrainer, listTrainers } from './trainer-store'
import { addImportedPremadeTeam } from './premade-teams-store'
import { setBossOrder } from './progression-store'
import { speciesStatsAndTypes } from './sim-access'
import type { TeamSet } from './premade-teams-store'

// Shape of the data/radical-red-*.json files, produced by
// scripts/build-radical-red-bosses.mjs (which also documents where the data
// comes from and what was cleaned up on the way in). Only what differs between
// Pokemon is stored; expandMon fills in the rest.
interface CompactMon {
  species: string
  item: string
  ability: string
  moves: string[]
  nature: string
  gender: string
  level: number
  // Present for Radical Red's "Max Level - n": the level is the level cap minus n.
  capOffset?: number
}

interface DatasetFile {
  trainers: {
    key: string
    name: string
    spriteId: string
    teams: { name: string; mons: CompactMon[] }[]
  }[]
}

interface ImportSettings {
  isBoss: boolean
  difficulty: AiDifficulty
}

// Radical Red trainers all share the same training: perfect IVs, no EVs.
function expandMon(mon: CompactMon): TeamSet {
  return {
    name: mon.species,
    species: mon.species,
    item: mon.item,
    ability: mon.ability,
    moves: mon.moves,
    nature: mon.nature,
    gender: mon.gender,
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    level: Math.min(100, mon.level),
    ...(mon.capOffset !== undefined ? { capOffset: mon.capOffset } : {}),
    shiny: false,
    happiness: 255,
    teraType: speciesStatsAndTypes(mon.species, null).types[0]
  }
}

/**
 * Adds every trainer in a dataset as a custom-team trainer with one team per
 * mode (Hardcore/Normal, plus a letter for variants). Safe to run repeatedly:
 * a trainer whose importKey already exists is left exactly as it is, so edits
 * made to imported trainers aren't overwritten.
 */
function importDataset(data: DatasetFile, settings: ImportSettings): RadicalRedImportResult {
  const existing = new Set(listTrainers().map((t) => t.importKey).filter(Boolean))
  const result: RadicalRedImportResult = { trainersAdded: 0, trainersSkipped: 0, teamsAdded: 0 }

  for (const entry of data.trainers) {
    if (existing.has(entry.key)) {
      result.trainersSkipped++
      continue
    }
    const trainer = addTrainer({
      name: entry.name,
      spriteId: entry.spriteId,
      difficulty: settings.difficulty,
      teamMode: 'custom',
      monotype: null,
      isBoss: settings.isBoss,
      drops: [],
      importKey: entry.key
    })
    for (const team of entry.teams) {
      addImportedPremadeTeam(trainer.id, team.name, team.mons.map(expandMon))
      result.teamsAdded++
    }
    result.trainersAdded++
  }
  return result
}

export function importRadicalRedBosses(): RadicalRedImportResult {
  return importDataset(bossData as DatasetFile, { isBoss: true, difficulty: 'hard' })
}

export function importRadicalRedTrainers(): RadicalRedImportResult {
  return importDataset(trainerData as DatasetFile, { isBoss: false, difficulty: 'normal' })
}

// ---------------------------------------------------------------- boss order

interface StoryBoss {
  // The importKey of the imported boss trainer (see data/radical-red-bosses.json).
  key: string
  label: string
  // The level cap while this boss is being fought. Radical Red's own cap
  // for that checkpoint (Normal mode; Hardcore differs only for the first four
  // - 16, 23, 28 and 36 instead of 15, 22, 27 and 34).
  cap: number
  requiredTrainerWins: number
  unlocksLateItems?: boolean
}

const GYM = 3 // a gym leader makes you earn the fight with a few trainer wins first

/**
 * Radical Red's main story bosses in the order they're fought, with the level
 * cap of each fight (published in the community boss/level-cap guides). Each
 * trainer is picked from the imported bosses by matching the level of its
 * authored team to that cap - Brock's ace is 14/16 for cap 15, Misty's 27/28
 * for 27, Sabrina's 59 for 59, and so on. Blue's fights are placed the same
 * way, plus by how strong each stage's team is (they get steadily stronger):
 * Cerulean (27), the late routes (73) and Route 22 (82) are checkpoints the
 * guides name outright, and the two before Falkner are the first two teams. The
 * S.S. Anne, Pokemon Tower and Silph Co. fights aren't in the guides, so those
 * three are best guesses from each team's level and strength. Left out on
 * purpose: the mini-bosses the guides give no cap for.
 */
const STORY_BOSSES: StoryBoss[] = [
  { key: 'rr41:0x146,0x147,0x148', label: 'Blue (Oak\'s Lab)', cap: 15, requiredTrainerWins: 0 },
  { key: 'rr41:0x149,0x14a,0x14b', label: 'Blue (Route 22)', cap: 15, requiredTrainerWins: 0 },
  { key: 'rr41:0x2d', label: 'Falkner', cap: 15, requiredTrainerWins: 0 },
  { key: 'rr41:0x19e', label: 'Brock', cap: 15, requiredTrainerWins: GYM },
  { key: 'rr41:0x2e', label: 'Archer (Mt. Moon)', cap: 22, requiredTrainerWins: 2 },
  { key: 'rr41:0x14c,0x14d,0x14e', label: 'Blue (Cerulean)', cap: 27, requiredTrainerWins: 0 },
  { key: 'rr41:0x8', label: 'Bugsy', cap: 27, requiredTrainerWins: 0 },
  { key: 'rr41:0x19f', label: 'Misty', cap: 27, requiredTrainerWins: GYM },
  { key: 'rr41:0x1ad,0x1ae,0x1af', label: 'Blue (S.S. Anne)', cap: 34, requiredTrainerWins: 0 },
  { key: 'rr41:0x1ab,0x1ac', label: 'Blue (Pokemon Tower)', cap: 34, requiredTrainerWins: 0 },
  { key: 'rr41:0x31', label: 'Whitney', cap: 34, requiredTrainerWins: 0 },
  { key: 'rr41:0x1a0', label: 'Lt. Surge', cap: 34, requiredTrainerWins: GYM },
  { key: 'rr41:0x1a1', label: 'Erika', cap: 44, requiredTrainerWins: GYM },
  { key: 'rr41:0x15c', label: 'Giovanni (Game Corner)', cap: 47, requiredTrainerWins: 4 },
  { key: 'rr41:0x35', label: 'Archer (Silph Co.)', cap: 56, requiredTrainerWins: 2 },
  { key: 'rr41:0x36', label: 'Ariana (Silph Co.)', cap: 56, requiredTrainerWins: 2 },
  { key: 'rr41:0x1b0,0x1b1,0x1b2', label: 'Blue (Silph Co.)', cap: 56, requiredTrainerWins: 0 },
  { key: 'rr41:0x15d', label: 'Giovanni (Silph Co.)', cap: 57, requiredTrainerWins: GYM },
  { key: 'rr41:0x1a4', label: 'Sabrina', cap: 59, requiredTrainerWins: GYM },
  { key: 'rr41:0x38', label: 'Brock (rematch)', cap: 68, requiredTrainerWins: 0 },
  { key: 'rr41:0x30', label: 'Misty (rematch)', cap: 68, requiredTrainerWins: 0 },
  { key: 'rr41:0x33', label: 'Lt. Surge (rematch)', cap: 68, requiredTrainerWins: 0 },
  { key: 'rr41:0x41', label: 'Erika (rematch)', cap: 68, requiredTrainerWins: 0 },
  { key: 'rr41:0x1a2', label: 'Koga', cap: 68, requiredTrainerWins: GYM },
  { key: 'rr41:0x2e4,0x2e5', label: 'Blue (late routes)', cap: 73, requiredTrainerWins: 0 },
  { key: 'rr41:0x1a3', label: 'Blaine', cap: 76, requiredTrainerWins: GYM },
  { key: 'rr41:0x43', label: 'Archer (Cerulean Cave)', cap: 79, requiredTrainerWins: 2 },
  { key: 'rr41:0x44', label: 'Ariana (Cerulean Cave)', cap: 79, requiredTrainerWins: 2 },
  { key: 'rr41:0x45', label: 'Giovanni (Cerulean Cave)', cap: 80, requiredTrainerWins: GYM, unlocksLateItems: true },
  { key: 'rr41:0x4a', label: 'Clair', cap: 81, requiredTrainerWins: GYM },
  { key: 'rr41:0x1b3,0x1b4,0x1b5', label: 'Blue (Route 22)', cap: 82, requiredTrainerWins: 0 },
  { key: 'rr41:0x4e', label: 'Lorelei', cap: 85, requiredTrainerWins: GYM },
  { key: 'rr41:0x50,0x51', label: 'Bruno', cap: 85, requiredTrainerWins: 0 },
  { key: 'rr41:0x53,0x54', label: 'Agatha', cap: 85, requiredTrainerWins: 0 },
  { key: 'rr41:0x56,0x57', label: 'Lance', cap: 85, requiredTrainerWins: 0 },
  { key: 'rr41:0x1b6,0x1b7,0x1b8', label: 'Champion', cap: 85, requiredTrainerWins: 0 }
]

// Once the Champion is beaten there's nothing left to hold the level cap back.
const POST_GAME_CAP = 100

/** The steps a Radical Red boss order is made of, given a lookup from importKey to trainer id. */
export function buildRadicalRedBossOrder(trainerIdForKey: (key: string) => string | undefined): Omit<BossStep, 'id'>[] {
  return STORY_BOSSES.map((boss, i) => {
    const trainerId = trainerIdForKey(boss.key)
    if (!trainerId) throw new Error(`${boss.label} hasn't been imported (${boss.key})`)
    return {
      trainerId,
      requiredTrainerWins: boss.requiredTrainerWins,
      // Beating a boss lifts the cap to whatever the next one's fight is at.
      levelCapAfterWin: STORY_BOSSES[i + 1]?.cap ?? POST_GAME_CAP,
      ...(boss.unlocksLateItems ? { unlocksLateItems: true } : {})
    }
  })
}

/**
 * Replaces the progression's boss order with Radical Red's story order (see
 * STORY_BOSSES), importing the bosses first if they aren't already there.
 */
export function applyRadicalRedBossOrder(): ProgressionState {
  importRadicalRedBosses()
  const idByKey = new Map(listTrainers().map((t) => [t.importKey, t.id]))
  return setBossOrder(buildRadicalRedBossOrder((key) => idByKey.get(key)))
}
