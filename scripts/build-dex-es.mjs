// Builds src/shared/i18n/dex-es.json: the Spanish names (and the games' Spanish
// descriptions) of every move, item and ability Showdown knows, plus the types, natures
// and stats - keyed by Showdown id. The source is PokéAPI's data tables
// (github.com/PokeAPI/pokeapi, data/v2/csv); download these into a folder first:
//   move_names, ability_names, item_names, type_names, nature_names, stat_names,
//   move_flavor_text, ability_flavor_text, item_flavor_text, version_groups,
//   moves, items, abilities, natures, types, stats
// then run: node scripts/build-dex-es.mjs <that folder>
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { Dex } = require('pokemon-showdown')

const SPANISH = '7'
const ENGLISH = '9'
const dir = process.argv[2]
if (!dir) throw new Error('Usage: node scripts/build-dex-es.mjs <folder of PokéAPI csv files>')

/** A CSV file as rows of named fields (quoted fields may hold commas and line breaks). */
function readCsv(name) {
  const text = fs.readFileSync(path.join(dir, `${name}.csv`), 'utf8').replace(/^﻿/, '')
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  const [head, ...body] = rows
  return body.filter((r) => r.length === head.length).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])))
}

const toID = (s) => s.normalize('NFD').toLowerCase().replace(/[^a-z0-9]+/g, '')

/** Game text tidied: the line breaks and soft hyphens of the in-game text boxes removed. */
function tidy(text) {
  return text
    .replace(/­\s*/g, '')
    .replace(/-\n(?=[a-záéíóúñ])/g, '')
    .replace(/[\s\u000c]+/g, ' ')
    .trim()
}

/** PokéAPI id -> Showdown id, through each entry's English name. */
function showdownIds(namesFile, idField) {
  const ids = new Map()
  for (const r of readCsv(namesFile)) if (r.local_language_id === ENGLISH) ids.set(r[idField], toID(r.name))
  return ids
}

function spanishNames(namesFile, idField, nameField = 'name') {
  const ids = showdownIds(namesFile, idField)
  const names = {}
  for (const r of readCsv(namesFile)) {
    const id = ids.get(r[idField])
    if (r.local_language_id === SPANISH && id && r[nameField]) names[id] = r[nameField]
  }
  return names
}

const versionOrder = new Map(readCsv('version_groups').map((r) => [r.id, Number(r.generation_id) * 100 + Number(r.order)]))

const PLACEHOLDER_TEXT = /no se puede usar, por lo que sería mejor olvidarlo/

/** Each entry's newest Spanish game text. */
function spanishTexts(file, idField, namesFile, languageField = 'language_id') {
  const ids = showdownIds(namesFile, idField)
  const best = {}
  for (const r of readCsv(file)) {
    const id = ids.get(r[idField])
    if (r[languageField] !== SPANISH || !id) continue
    const order = versionOrder.get(r.version_group_id) ?? 0
    const text = tidy(r.flavor_text)
    // Sword/Shield's stand-in for moves it cut ("can't be used, best forgotten") isn't a
    // description - an older game's text is used instead, or the English one.
    if (PLACEHOLDER_TEXT.test(text)) continue
    if (!best[id] || order > best[id].order) best[id] = { order, text }
  }
  return Object.fromEntries(Object.entries(best).map(([id, v]) => [id, v.text]))
}

// Only what Showdown has, so the file stays small.
function only(entries, known) {
  return Object.fromEntries(Object.entries(entries).filter(([id]) => known.has(id)).sort(([a], [b]) => a.localeCompare(b)))
}

const moveIds = new Set(Dex.moves.all().map((m) => m.id))
const itemIds = new Set(Dex.items.all().map((i) => i.id))
const abilityIds = new Set(Dex.abilities.all().map((a) => a.id))

// Hidden Power's typed versions share its name.
const moves = only(spanishNames('move_names', 'move_id'), moveIds)
for (const id of moveIds) if (id.startsWith('hiddenpower') && moves.hiddenpower && !moves[id]) {
  const type = Dex.moves.get(id).type
  moves[id] = `${moves.hiddenpower} ${type}`
}

const out = {
  moves,
  items: only(spanishNames('item_names', 'item_id'), itemIds),
  abilities: only(spanishNames('ability_names', 'ability_id'), abilityIds),
  types: spanishNames('type_names', 'type_id'),
  natures: spanishNames('nature_names', 'nature_id'),
  stats: spanishNames('stat_names', 'stat_id'),
  moveTexts: only(spanishTexts('move_flavor_text', 'move_id', 'move_names'), moveIds),
  itemTexts: only(spanishTexts('item_flavor_text', 'item_id', 'item_names'), itemIds),
  abilityTexts: only(spanishTexts('ability_flavor_text', 'ability_id', 'ability_names'), abilityIds)
}

const missing = (kind, ids) => [...ids].filter((id) => !out[kind][id])
for (const [kind, ids] of [['moves', moveIds], ['items', itemIds], ['abilities', abilityIds]]) {
  const gaps = missing(kind, ids)
  console.log(`${kind}: ${ids.size - gaps.length}/${ids.size}`, gaps.length ? `missing e.g. ${gaps.slice(0, 12).join(', ')}` : '')
}
for (const kind of ['moveTexts', 'itemTexts', 'abilityTexts']) console.log(`${kind}: ${Object.keys(out[kind]).length}`)

fs.writeFileSync('src/shared/i18n/dex-es.json', JSON.stringify(out, null, 0) + '\n')
console.log('wrote src/shared/i18n/dex-es.json', fs.statSync('src/shared/i18n/dex-es.json').size, 'bytes')
