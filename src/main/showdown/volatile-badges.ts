import type { VolatileBadge } from '../../shared/battle-types'

/**
 * The badges shown under a battler's HP bar for the temporary conditions on it -
 * Confused, Taunted, Leech Seed, Perish 2, ... - the same set Showdown's own battle
 * screen shows. They're read off the battle log: most start with a -start line and
 * stop with a matching -end; the -singleturn ones last until the next turn and the
 * -singlemove ones until that Pokemon moves again.
 */

type Kind = VolatileBadge['kind']

// Keyed by the effect's id as it appears in the log ("move: Taunt" -> "taunt").
const BADGES: Record<string, [label: string, kind: Kind]> = {
  confusion: ['Confused', 'bad'],
  attract: ['Attracted', 'bad'],
  taunt: ['Taunted', 'bad'],
  torment: ['Tormented', 'bad'],
  encore: ['Encored', 'bad'],
  disable: ['Disabled', 'bad'],
  leechseed: ['Leech Seed', 'bad'],
  yawn: ['Drowsy', 'bad'],
  curse: ['Cursed', 'bad'],
  nightmare: ['Nightmare', 'bad'],
  embargo: ['Embargo', 'bad'],
  healblock: ['Heal Block', 'bad'],
  smackdown: ['Smacked Down', 'bad'],
  throatchop: ['Throat Chop', 'bad'],
  tarshot: ['Tar Shot', 'bad'],
  octolock: ['Octolocked', 'bad'],
  foresight: ['Identified', 'bad'],
  miracleeye: ['Identified', 'bad'],
  slowstart: ['Slow Start', 'bad'],
  saltcure: ['Salt Cure', 'bad'],
  syrupbomb: ['Syrup Bomb', 'bad'],
  partiallytrapped: ['Partially Trapped', 'bad'],
  trapped: ['Trapped', 'bad'],
  mustrecharge: ['Must Recharge', 'bad'],
  focusenergy: ['Critical Hit Boost', 'good'],
  dragoncheer: ['Critical Hit Boost', 'good'],
  gmaxchistrike: ['Critical Hit Boost', 'good'],
  laserfocus: ['Laser Focus', 'good'],
  magnetrise: ['Magnet Rise', 'good'],
  ingrain: ['Ingrained', 'good'],
  aquaring: ['Aqua Ring', 'good'],
  charge: ['Charged', 'good'],
  noretreat: ['No Retreat', 'good'],
  imprison: ['Imprisoning', 'good'],
  flashfire: ['Flash Fire', 'good'],
  autotomize: ['Lightened', 'good'],
  telekinesis: ['Telekinesis', 'neutral'],
  powertrick: ['Power Trick', 'neutral'],
  powershift: ['Power Shift', 'neutral'],
  uproar: ['Uproar', 'neutral'],
  bide: ['Bide', 'neutral'],
  // -singlemove: until its next move.
  destinybond: ['Destiny Bond', 'good'],
  grudge: ['Grudge', 'good'],
  rage: ['Rage', 'neutral'],
  glaiverush: ['Glaive Rush', 'bad'],
  // -singleturn: for the rest of this turn.
  endure: ['Endure', 'good'],
  helpinghand: ['Helping Hand', 'good'],
  magiccoat: ['Magic Coat', 'good'],
  snatch: ['Snatch', 'good'],
  focuspunch: ['Focusing', 'good'],
  shelltrap: ['Trap Set', 'good'],
  beakblast: ['Beak Blast', 'neutral'],
  roost: ['Landed', 'neutral'],
  followme: ['Center of Attention', 'neutral'],
  ragepowder: ['Center of Attention', 'neutral'],
  spotlight: ['Center of Attention', 'neutral'],
  electrify: ['Electrified', 'bad'],
  powder: ['Powder', 'bad']
}

// Counted conditions are logged with the count in the id ("perish2", "stockpile3") and
// ended by their bare name - they're kept as one badge under the prefix.
const COUNTED: Record<string, [label: string, kind: Kind]> = {
  perish: ['Perish', 'bad'],
  stockpile: ['Stockpile', 'good']
}

// Protosynthesis / Quark Drive name the boosted stat ("protosynthesisspe").
const STAT_BOOSTING: Record<string, string> = { protosynthesis: 'Protosynthesis', quarkdrive: 'Quark Drive' }
const STAT_LABELS: Record<string, string> = { atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe' }

// The moves whose trap is announced by a -activate line (Wrap, Fire Spin, ...).
export const PARTIAL_TRAP_MOVES = new Set([
  'bind',
  'wrap',
  'firespin',
  'whirlpool',
  'sandtomb',
  'clamp',
  'magmastorm',
  'infestation',
  'snaptrap',
  'thundercage'
])

/** "move: Taunt" / "ability: Flash Fire" / "Leech Seed" -> "taunt" / "flashfire" / "leechseed". */
export function effectId(raw: string | undefined): string {
  return (raw ?? '')
    .replace(/^(move|ability|item): /i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/** The badge for an effect starting, or null for one that has no badge (or is shown elsewhere). */
export function badgeFor(rawEffect: string, detail?: string): VolatileBadge | null {
  const id = effectId(rawEffect)
  const known = BADGES[id]
  if (known) {
    // Disable names the move it disabled.
    const label = id === 'disable' && detail && !detail.startsWith('[') ? `Disabled: ${detail.replace(/^move: /, '')}` : known[0]
    return { id, label, kind: known[1] }
  }
  for (const [prefix, [label, kind]] of Object.entries(COUNTED)) {
    const count = id.startsWith(prefix) ? id.slice(prefix.length) : null
    if (count !== null && /^\d$/.test(count)) return { id: prefix, label: `${label} ${count}`, kind }
  }
  for (const [prefix, label] of Object.entries(STAT_BOOSTING)) {
    if (id.startsWith(prefix)) {
      const stat = STAT_LABELS[id.slice(prefix.length)]
      return { id: prefix, label: stat ? `${label}: ${stat}` : label, kind: 'good' }
    }
  }
  return null
}

// -singleturn badges drop off when the next turn starts; -singlemove ones when it moves.
export const SINGLE_TURN_IDS = new Set([
  'endure',
  'helpinghand',
  'magiccoat',
  'snatch',
  'focuspunch',
  'shelltrap',
  'beakblast',
  'roost',
  'followme',
  'ragepowder',
  'spotlight',
  'electrify',
  'powder'
])
export const SINGLE_MOVE_IDS = new Set(['destinybond', 'grudge', 'rage', 'glaiverush'])

/** The list with this badge added (replacing an older one of the same id - "Perish 3" -> "Perish 2"). */
export function withBadge(list: VolatileBadge[], badge: VolatileBadge): VolatileBadge[] {
  return [...list.filter((b) => b.id !== badge.id), badge]
}

/** The list with the badge for this ended effect taken off. */
export function withoutBadge(list: VolatileBadge[], rawEffect: string): VolatileBadge[] {
  const id = effectId(rawEffect)
  return list.filter((b) => b.id !== id)
}
