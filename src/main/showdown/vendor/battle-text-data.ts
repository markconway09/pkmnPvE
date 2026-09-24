/**
 * Loads the vendored Showdown client text data (resources/showdown/battle-text-en.cjs,
 * itself a straight copy of play.pokemonshowdown.com/data/text/en.js) and exposes it as
 * the `BattleText` global that battle-text-parser.ts expects.
 */
import { createRequire } from 'node:module'
import { app } from 'electron'
import { join } from 'node:path'

type BattleTextEntry = { [templateName: string]: string | null | BattleTextEntry }
type BattleTextTable = { [id: string]: BattleTextEntry }
type BattleTextData = {
  Default: BattleTextTable
  Pokedex: { [id: string]: { name: string; baseSpecies: string; forme?: string; grammar?: string } }
  Moves: BattleTextTable
  Abilities: BattleTextTable
  Items: BattleTextTable
  Tags: { [id: string]: { name?: string; hint?: string; desc?: string } }
  TypeNames: { [id: string]: string }
  NatureNames: { [id: string]: string }
  GenderNames: { [id: string]: string }
  EggGroupNames: { [id: string]: string }
  ColorNames: { [id: string]: string }
  StatusNames: { [id: string]: string }
  TargetNames: { [id: string]: string }
  StatNames: { [id: string]: string }
  StatMediumNames: { [id: string]: string }
  StatShortNames: { [id: string]: string }
}

declare global {
  // eslint-disable-next-line no-var
  var BattleText: { [lang: string]: BattleTextData }
}

const require = createRequire(import.meta.url)
const dataPath = join(app.getAppPath(), 'resources', 'showdown', 'battle-text-en.cjs')
const { BattleText } = require(dataPath) as { BattleText: { [lang: string]: BattleTextData } }

globalThis.BattleText = BattleText

export {}
