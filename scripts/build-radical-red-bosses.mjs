// Builds the Radical Red data files the in-game importers read:
//   src/main/showdown/data/radical-red-bosses.json    (gym leaders, Elite Four, champions, rivals, admins, bosses, Oak)
//   src/main/showdown/data/radical-red-trainers.json  (every other trainer)
// from the community Radical Red 4.1 trainer-data dumps (Rudo2204's gists,
// based on luckytyphlosion's v3.02 dump). Run with:
//   node scripts/build-radical-red-bosses.mjs
//
// The dumps are Showdown-import-style text, one block per trainer entry. Every
// Pokemon is converted to this game's set format (typo'd names fixed, Radical
// Red-only moves/items/abilities that Showdown has no entry for dropped), and
// each trainer is matched to a sprite from public/sprites/trainers.

import { createRequire } from 'node:module'
import { readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { Dex } = require('pokemon-showdown')
const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const SOURCES = {
  Hardcore: 'https://gist.githubusercontent.com/Rudo2204/ed23cfda024998b566128318963ea7a5/raw',
  Normal: 'https://gist.githubusercontent.com/Rudo2204/f4a06a37c2320e2b6094958e8dad785c/raw'
}

const toID = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '')
// Sprite names have no accents (Pokémon -> pokemon), unlike Showdown's own ids.
const spriteKey = (s) => toID(String(s).normalize('NFD').replace(/[̀-ͯ]/g, ''))

// ---------------------------------------------------------------- parsing

function parseDump(text) {
  const body = text.replace(/\r/g, '')
  const trainers = new Map()
  let cur = null
  for (const line of body.slice(body.indexOf('(id: 0x0)')).split('\n')) {
    const header = line.match(/^(.*?)\s*\(id: (0x[0-9a-f]+)\)\s*$/)
    if (header) {
      cur = { name: header[1].trim(), id: header[2], mons: [] }
      trainers.set(header[2], cur)
      continue
    }
    if (!cur || !line.trim() || /^=+$/.test(line)) continue
    const isDetail = line.startsWith('-') || /^(Ability|Level|IVs|EVs|Type|Shiny|Happiness|Tera Type):/.test(line) || / Nature$/.test(line)
    if (!isDetail) {
      const m = line.match(/^(.+?)(?: \((M|F|Gender unknown)\))?(?: @ (.+))?$/)
      cur.mons.push({
        species: m[1].replace(' (Gender unknown)', ''),
        gender: m[2] === 'M' || m[2] === 'F' ? m[2] : '',
        item: m[3] && m[3] !== 'None' ? m[3] : '',
        moves: [],
        fields: {}
      })
    } else if (cur.mons.length) {
      const mon = cur.mons[cur.mons.length - 1]
      if (line.startsWith('- ')) mon.moves.push(line.slice(2).trim())
      else if (/ Nature$/.test(line)) mon.nature = line.replace(' Nature', '')
      else {
        const [k, ...v] = line.split(': ')
        mon.fields[k] = v.join(': ')
      }
    }
  }
  return trainers
}

// ------------------------------------------------------ sanitising to Showdown

function editDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 0; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
  }
  return dp[a.length][b.length]
}

// Closest real entry by name, only if it's a genuine near-miss (a typo like
// "Blastoisnite"). One edit is always fine; two only between long names, since
// on short ones two edits is a different thing entirely ("Aqua Fang" is not
// "Aqua Ring", "Applite" is not "Zap Plate").
function nearest(dexAll, wanted) {
  const id = toID(wanted)
  let best = null
  let bestDistance = Infinity
  for (const entry of dexAll) {
    const d = editDistance(id, entry.id)
    const close = d <= 1 || (d === 2 && id.length >= 10 && entry.id.length >= 10)
    if (close && d < bestDistance) {
      best = entry
      bestDistance = d
    }
  }
  return best
}

const ITEMS = Dex.items.all().filter((i) => i.exists)
const MOVES = Dex.moves.all().filter((m) => m.exists)
const ABILITIES = Dex.abilities.all().filter((a) => a.exists)

const MOVE_ALIASES = { 'Drain Kiss': 'Draining Kiss', 'Dark Hole': 'Dark Void', 'Crafty Guard': 'Crafty Shield' }
const ABILITY_ALIASES = { 'Neutralize Gas': 'Neutralizing Gas' }
const ITEM_ALIASES = { 'Necrozium Z': 'Ultranecrozium Z', 'Leek Stick': 'Leek' }

function newStats() {
  return {
    monsKept: 0,
    monsDropped: new Map(),
    speciesFixed: new Map(),
    itemFixed: new Map(),
    itemDropped: new Map(),
    moveFixed: new Map(),
    moveDropped: new Map(),
    abilityFixed: new Map(),
    abilityDefaulted: new Map()
  }
}
let stats = newStats()
const bump = (map, key) => map.set(key, (map.get(key) ?? 0) + 1)

function resolveSpecies(raw) {
  const name = raw.replace(/-Sevii$/, '').replace(/^Pikachu-(Flying|Surfing)$/, 'Pikachu')
  const species = Dex.species.get(name)
  if (!species.exists) return null
  if (name !== raw) bump(stats.speciesFixed, `${raw} -> ${species.name}`)
  return species
}

function resolveItem(rawName) {
  if (!rawName) return ''
  const raw = ITEM_ALIASES[rawName] ?? rawName
  const exact = Dex.items.get(raw)
  if (exact.exists) return exact.name
  const near = nearest(ITEMS, raw)
  if (near) {
    bump(stats.itemFixed, `${raw} -> ${near.name}`)
    return near.name
  }
  bump(stats.itemDropped, raw)
  return ''
}

function resolveMove(raw) {
  const aliased = MOVE_ALIASES[raw] ?? raw
  const exact = Dex.moves.get(aliased)
  if (exact.exists) {
    if (aliased !== raw) bump(stats.moveFixed, `${raw} -> ${exact.name}`)
    return exact.id
  }
  const near = nearest(MOVES, raw)
  if (near) {
    bump(stats.moveFixed, `${raw} -> ${near.name}`)
    return near.id
  }
  bump(stats.moveDropped, raw)
  return null
}

function resolveAbility(raw, species) {
  if (raw === 'As One') raw = species.name === 'Calyrex-Shadow' ? 'As One (Spectrier)' : 'As One (Glastrier)'
  const aliased = ABILITY_ALIASES[raw] ?? raw
  const exact = Dex.abilities.get(aliased)
  if (exact.exists) {
    if (aliased !== raw) bump(stats.abilityFixed, `${raw} -> ${exact.name}`)
    return exact.name
  }
  const near = raw ? nearest(ABILITIES, raw) : null
  if (near) {
    bump(stats.abilityFixed, `${raw} -> ${near.name}`)
    return near.name
  }
  if (raw) bump(stats.abilityDefaulted, raw)
  return species.abilities[0]
}

// A number is a fixed level. "Max Level" / "Max Level - n" is Radical Red's way
// of saying "the level cap of this fight" (minus n), so it's stored as an
// offset from the cap (capOffset) and the game works the level out from the
// cap at fight time - level is just a placeholder for those.
function parseLevel(text) {
  // (A few joke stubs are level 250; the game's maximum is 100.)
  if (/^\d+$/.test(text)) return { level: Math.min(100, Number(text)) }
  const m = text.match(/^Max Level(?: - (\d+))?$/)
  return { level: 100, capOffset: Number(m?.[1] ?? 0) }
}

// Only what varies is stored; the importer fills in the rest (name, EVs, IVs,
// shiny, happiness, tera type are the same for every Radical Red trainer set).
function convertMon(mon) {
  const species = resolveSpecies(mon.species)
  if (!species) {
    bump(stats.monsDropped, mon.species)
    return null
  }
  const moves = mon.moves.map(resolveMove).filter(Boolean)
  stats.monsKept++
  return {
    species: species.name,
    item: resolveItem(mon.item),
    ability: resolveAbility(mon.fields.Ability ?? '', species),
    moves: moves.length > 0 ? moves : ['tackle'],
    nature: mon.nature ?? 'Hardy',
    gender: mon.gender,
    ...parseLevel(mon.fields.Level ?? 'Max Level')
  }
}

// ------------------------------------------------------------------ sprites

const spriteIds = new Set(
  readdirSync(join(root, 'src/renderer/public/sprites/trainers')).filter((f) => f.endsWith('.png')).map((f) => f.slice(0, -4))
)
const SPRITE_VARIANT_ORDER = ['gen3', 'gen3rs', 'gen1rb', 'gen1', 'lgpe', 'gen2', 'gen4', 'gen6']

// An exact id wins; otherwise the FireRed-era variant, then any other.
function findSprite(norm) {
  if (!norm) return null
  if (spriteIds.has(norm)) return { id: norm, how: 'exact' }
  for (const suffix of SPRITE_VARIANT_ORDER) if (spriteIds.has(`${norm}-${suffix}`)) return { id: `${norm}-${suffix}`, how: 'variant' }
  const any = [...spriteIds].filter((id) => id.startsWith(`${norm}-`) && !id.includes('masters')).sort()[0]
  return any ? { id: any, how: 'variant' } : null
}

// Classes with no same-named sprite.
const SPRITE_ALIASES = {
  thug: 'streetthug',
  teamrocket: 'rocketgrunt',
  teamrocketgrunt: 'rocketgrunt',
  crushgirl: 'crushgirl-gen3',
  coolcouple: 'youngcouple',
  friendlypokemaniac: 'pokemaniac',
  friendlythug: 'streetthug',
  teamrocketadmin: 'rocketexecutive-gen2',
  // "Player" would otherwise match the Pokemon GO player sprite.
  player: 'red'
}

// Fights that should look different from the same character's other fights -
// the Kanto gym leader rematches use their Pokemon Masters outfits, or another
// variant when there's no Masters sprite (Lt. Surge). Keyed by trainer key.
const SPRITE_OVERRIDES = {
  'rr41:0x38': 'brock-masters', // Brock (rematch)
  'rr41:0x30': 'misty-masters', // Misty (rematch)
  'rr41:0x33': 'ltsurge-gen3', // Lt. Surge (rematch)
  'rr41:0x41': 'erika-masters' // Erika (rematch)
}

// Boss-tier trainers are matched by character ("Brock" -> brock).
function resolveBossSprite(character) {
  const norm = spriteKey(character)
  const found = findSprite(norm)
  if (found) return found
  return SPRITE_ALIASES[norm] ? { id: SPRITE_ALIASES[norm], how: 'fallback' } : { id: 'youngster', how: 'none' }
}

// Ordinary trainers are matched by class ("Picnicker Diana" -> picnicker): try
// the whole name (some have no personal name), then progressively shorter
// prefixes (dropping the personal name, or a "Gia & Lea" couple), and finally
// the personal name itself for the named characters ("Pokemon Trainer Brendan").
function resolveClassSprite(name) {
  const words = name.replace(/[&]/g, ' ').split(/\s+/).filter(Boolean)
  const tries = [words.join(' ')]
  for (let n = words.length - 1; n >= 1; n--) tries.push(words.slice(0, n).join(' '))
  const normalise = (s) => spriteKey(s.replace(/♂/g, 'm').replace(/♀/g, 'f'))
  for (const t of tries) {
    const norm = normalise(t)
    if (SPRITE_ALIASES[norm]) return { id: SPRITE_ALIASES[norm], how: 'fallback' }
    const found = findSprite(norm)
    if (found) return found
  }
  const personal = findSprite(normalise(words[words.length - 1]))
  if (personal) return personal
  return { id: 'youngster', how: 'none' }
}

// ---------------------------------------------------------------- selection

const BOSS_CLASS = /^(Leader|Elite Four|Champion|Rival|Rocket Admin|Boss|Professor) (.+)$/

function classifyBoss(name) {
  const m = name.match(BOSS_CLASS)
  return m ? { className: m[1], character: m[2] } : null
}

// The dump writes the "Pokemon" text as a {PK}{MN} token, has a few typos, and
// uses "Terry" as a stand-in for the rival, who is Blue.
function cleanName(name) {
  return name
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(Rival|Champion) Terry\b/, '$1 Blue')
    .replace('{PK}{MN}Maniac', 'Pokémaniac')
    .replace(/\{PK\}\{MN\}/g, 'Pokémon')
    .replace('Ruin Mamoac', 'Ruin Maniac')
}

async function download(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`)
  return res.text()
}

const dumps = {}
for (const [mode, url] of Object.entries(SOURCES)) dumps[mode] = parseDump(await download(url))
const hardcore = dumps.Hardcore

const allEntries = [...hardcore.values()]
  .filter((t) => t.mons.length > 0)
  // "Elite Four LanceRe" is a single level-5 Ekans - a placeholder, not a fight.
  .filter((t) => !(t.mons.length === 1 && t.mons[0].species === 'Ekans' && t.name.includes('LanceRe')))
  .sort((a, b) => parseInt(a.id, 16) - parseInt(b.id, 16))

const fightShape = (t) => {
  const normal = dumps.Normal.get(t.id)
  return `${t.name}|${t.mons[0].fields.Level}|${t.mons.length}|${normal?.mons[0]?.fields.Level}|${normal?.mons.length}`
}

// Consecutive ids with the same name, level and team size (in both modes) are
// the same fight in variants (Rival Terry has one per starter, some trainers
// have a few) - one trainer with several teams, rather than a pile of
// identical-looking trainers. A change in any of those means a different
// stage of the story and starts a new trainer.
function groupVariants(entries) {
  const groups = []
  for (const entry of entries) {
    const last = groups[groups.length - 1]
    const prev = last?.[last.length - 1]
    if (prev && parseInt(prev.id, 16) + 1 === parseInt(entry.id, 16) && fightShape(prev) === fightShape(entry)) last.push(entry)
    else groups.push([entry])
  }
  return groups
}

const levelLabel = (entry) => (/^\d+$/.test(entry.mons[0].fields.Level) ? `Lv ${entry.mons[0].fields.Level}` : 'Lv Max')

function buildDataset(entries, resolveSprite) {
  stats = newStats()
  const groups = groupVariants(entries)
  const nameCounts = new Map()
  for (const g of groups) nameCounts.set(cleanName(g[0].name), (nameCounts.get(cleanName(g[0].name)) ?? 0) + 1)
  const usedNames = new Map()
  const trainers = []
  const spriteReport = { exact: [], variant: [], fallback: [], none: [] }

  for (const group of groups) {
    const first = group[0]
    const baseName = cleanName(first.name)
    let displayName = baseName
    // Several fights against the same trainer are told apart by level.
    if (nameCounts.get(baseName) > 1) {
      displayName = `${baseName} (${levelLabel(first)})`
      const seen = (usedNames.get(displayName) ?? 0) + 1
      usedNames.set(displayName, seen)
      if (seen > 1) displayName += ` #${seen}`
    }

    const teams = []
    for (const mode of ['Hardcore', 'Normal']) {
      group.forEach((entry, i) => {
        const source = dumps[mode].get(entry.id)
        if (!source) return
        const mons = source.mons.map(convertMon).filter(Boolean)
        if (mons.length === 0) return
        teams.push({ name: group.length > 1 ? `${mode} ${String.fromCharCode(65 + i)}` : mode, mons })
      })
    }
    if (teams.length === 0) continue

    const key = `rr41:${group.map((e) => e.id).join(',')}`
    const sprite = SPRITE_OVERRIDES[key] ? { id: SPRITE_OVERRIDES[key], how: 'exact' } : resolveSprite(first.name, baseName)
    spriteReport[sprite.how].push(`${baseName} -> ${sprite.id}`)
    trainers.push({ key, name: displayName, spriteId: sprite.id, teams })
  }
  return { trainers, spriteReport, stats }
}

const bossEntries = allEntries.filter((t) => classifyBoss(t.name))
const normalEntries = allEntries.filter((t) => !classifyBoss(t.name))

const bosses = buildDataset(bossEntries, (_raw, clean) => resolveBossSprite(classifyBoss(clean).character))
const bossStats = bosses.stats
const trainers = buildDataset(normalEntries, (_raw, clean) => resolveClassSprite(clean))

const dataDir = join(root, 'src/main/showdown/data')
mkdirSync(dataDir, { recursive: true })
const write = (file, source, dataset) =>
  writeFileSync(join(dataDir, file), JSON.stringify({ source, trainers: dataset.trainers }))
write('radical-red-bosses.json', 'Pokemon Radical Red 4.1 trainer data dumps by Rudo2204 (Hardcore, Normal/min-grind) - boss trainers', bosses)
write('radical-red-trainers.json', 'Pokemon Radical Red 4.1 trainer data dumps by Rudo2204 (Hardcore, Normal/min-grind) - other trainers', trainers)

// -------------------------------------------------------------------- report
const list = (map) => [...map.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} (${v})`).join(', ') || '(none)'
function report(title, dataset, s) {
  const teamCount = dataset.trainers.reduce((n, t) => n + t.teams.length, 0)
  console.log(`\n===== ${title}: ${dataset.trainers.length} trainers, ${teamCount} teams`)
  console.log(`pokemon kept ${s.monsKept}, dropped: ${list(s.monsDropped)}`)
  console.log(`species remapped: ${list(s.speciesFixed)}`)
  console.log(`items corrected: ${list(s.itemFixed)}`)
  console.log(`items removed: ${list(s.itemDropped)}`)
  console.log(`moves corrected: ${list(s.moveFixed)}`)
  console.log(`moves removed: ${list(s.moveDropped)}`)
  console.log(`abilities corrected: ${list(s.abilityFixed)}`)
  console.log(`abilities defaulted: ${list(s.abilityDefaulted)}`)
  const r = dataset.spriteReport
  console.log(`sprites: exact ${r.exact.length}, variant ${r.variant.length}, fallback ${r.fallback.length}, none ${r.none.length}`)
  const tally = (arr) => { const m = new Map(); for (const x of arr) bump(m, x.replace(/^.*-> /, '')); return list(m) }
  console.log(`  sprite usage (variant): ${tally(r.variant)}`)
  console.log(`  sprite usage (fallback): ${[...new Set(r.fallback)].join('; ')}`)
  if (r.none.length) console.log(`  NO MATCH (defaulted to youngster): ${[...new Set(r.none.map((x) => x.replace(/ ->.*/, '')))].join('; ')}`)
}
report('BOSSES', bosses, bossStats)
report('OTHER TRAINERS', trainers, trainers.stats)
