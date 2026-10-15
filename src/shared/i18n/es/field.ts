import type { field as en } from '../en/field'
import type { Message } from '../en'

export const field: Record<keyof typeof en, Message> = {
  'status.par': 'PAR',
  'status.brn': 'QUE',
  'status.psn': 'ENV',
  'status.slp': 'DOR',
  'status.frz': 'CON',
  'boost.atk': 'ATA',
  'boost.def': 'DEF',
  'boost.spa': 'AtE',
  'boost.spd': 'DfE',
  'boost.spe': 'VEL',
  'boost.accuracy': 'PRE',
  'boost.evasion': 'EVA',

  'team.partnerTip': 'Pokémon de {name}: elige por él',
  'team.noItem': 'Sin objeto',
  'team.offenseTip': 'Cuánto daño hacen sus propios tipos a cada rival',
  'team.offenseChip': 'Sus tipos contra {name}: como mucho {mult}',
  'team.defenseTip': 'Cuánto daño le hacen los tipos de cada rival',
  'team.defenseChip': 'Los tipos de {name} contra él: como mucho {mult}',
  'team.empty': 'Vacío',

  'hud.chaosModifiers': 'Modificadores del Caos',
  'hud.noModifiers': 'Sin modificadores en este combate',
  'hud.fainted': '{name} (debilitado)',
  'hud.the': 'el',

  'sprite.leechSeed': 'Drenadoras',
  'sprite.caughtBefore': 'Capturado antes',
  'sprite.lv': 'Nv{level}',
  'sprite.mergeStars': '{n} estrellas de fusión: sus estadísticas suben',
  'sprite.gigantamaxed': 'Gigamaxizado',
  'sprite.dynamaxed': 'Dinamaxizado',
  'sprite.gmax': 'Gigamax',
  'sprite.dynamax': 'Dinamax',
  'sprite.megaEvolved': 'Megaevolucionado',
  'sprite.mega': 'Mega',
  'sprite.terastallized': 'Teracristalizado en el tipo {type}',
  'sprite.typeChanged': 'Su tipo ha cambiado',
  'sprite.abilityOf': 'De {name}:',

  'field.layers': { one: '{name} ({count} capa)', other: '{name} ({count} capas)' },
  'field.turns': { one: '({count} turno)', other: '({count} turnos)' },
  'field.foes': '{name} del rival',

  'rewards.title': 'Recompensas',
  'rewards.friendly': 'Combate amistoso: sin recompensas',
  'rewards.forWinning': 'Recompensas por ganar',
  'rewards.trainer': 'Entrenador',
  'rewards.team': 'Este equipo',
  'rewards.wild': 'Salvaje',
  'rewards.tm': 'MT {name}',
  'rewards.firstWin': 'Primera victoria',
  'rewards.randomItem': 'Un objeto al azar',
  'rewards.noDrops': 'No suelta objetos'
}
