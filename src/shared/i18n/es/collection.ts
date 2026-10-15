import type { collection as en } from '../en/collection'
import type { Message } from '../en'

export const collection: Record<keyof typeof en, Message> = {
  'merge.bonus': '{bonus} a todas las estadísticas salvo los PS',
  'merge.title': 'Fusionar en {name}',
  'merge.inClassic': '{bonus} en los combates clásicos',
  'merge.noBonus': 'Aún sin bonificación: dos copias dan ★1',
  'merge.help':
    'Cada estrella da {bonus} en Combates, no en partidas de la Torre ni en combates amistosos (no afecta a estadísticas con 0 IVs). Estrellas con 2, 4, 8, 16, 32 y 64 copias. También pueden entrar preevoluciones que ya podrían evolucionar. Los Pokémon fusionados salen de tu caja; se conservan variocolor, favorito, el nivel y la amistad más altos, y los objetos equipados vuelven a tu mochila.',
  'merge.full': '{name} tiene la fusión completa en ★{stars}.',
  'merge.noOthers': 'No hay ningún otro {name} que fusionar.',
  'merge.notYet': 'Aún no se puede fusionar: {reason}',
  'merge.lv': 'Nv. {level}',
  'merge.copiesTail': ' · {n} copias',
  'merge.evolvesIn': 'Evoluciona al entrar',
  'merge.usesA': 'Usa {item}',
  'merge.onTeam': 'En tu equipo',
  'merge.itemToBag': '{item} a la mochila',
  'merge.after': 'Después: {copies} copias · {stars}',
  'merge.afterLevel': ' · Nv. {from} → {to}',
  'merge.becomesShiny': ' · pasa a ser variocolor',
  'merge.becomesFavorite': ' · pasa a ser favorito',
  'merge.partial': {
    one: '{name} (Nv. {level}) da {given} y se queda {count} copia',
    other: '{name} (Nv. {level}) da {given} y se queda {count} copias'
  },
  'merge.needs': 'Necesita {count} {item}: tienes {owned}',
  'merge.uses': 'Usa {items} para las evoluciones',
  'merge.unused': {
    one: '{count} sobra: se llena antes de que entre',
    other: '{count} sobran: se llena antes de que entren'
  },
  'merge.deselectAll': 'Quitar todos',
  'merge.selectAll': 'Seleccionar todos',
  'merge.confirm': '¿Fusionar un favorito o un miembro del equipo? {click} otra vez',
  'merge.go': 'Fusionar',
  'merge.goCount': 'Fusionar {count}',

  'loadouts.monTitle': '{name} · Nv. {level}',
  'loadouts.gone': 'Ya no está en tu caja',
  'loadouts.empty': 'Vacío',
  'loadouts.needName': 'Ponle un nombre a este equipo',
  'loadouts.saved': 'Guardado "{name}"',
  'loadouts.title': 'Equipos guardados',
  'loadouts.count': '{n} guardados',
  'loadouts.current': 'Equipo actual',
  'loadouts.namePlaceholder': 'Nombre del equipo…',
  'loadouts.saveAs': 'Guardar equipo',
  'loadouts.savedHeading': 'Equipos guardados',
  'loadouts.none': 'Aún no hay equipos guardados: ponle nombre a tu equipo actual arriba para guardarlo.',
  'loadouts.rename': 'Pulsa para cambiar el nombre',
  'loadouts.inUse': 'En uso',
  'loadouts.load': 'Cargar',
  'loadouts.overwriteTip': 'Sustituir este equipo por tu equipo actual',
  'loadouts.overwrite': 'Sobrescribir',
  'loadouts.updated': 'Actualizado "{name}"',
  'loadouts.deleted': 'Borrado "{name}"',
  'loadouts.sure': '¿Seguro?',
  'loadouts.delete': 'Borrar',

  'starter.title': 'Elige tu inicial',
  'starter.random': 'Sin evolucionar al azar',

  'guide.welcome.title': 'Bienvenido a pkmnPvE',
  'guide.welcome.1':
    'Un juego de Pokémon hecho sobre el motor de combate de Pokémon Showdown: captura Pokémon, forma equipos y enfréntate a entrenadores, jefes, la Torre Batalla y el Casino.',
  'guide.welcome.2': 'Todo empieza en la pantalla de inicio. Primero, elige un inicial.',
  'guide.catch.title': 'Capturar y Caja',
  'guide.catch.1':
    'En Capturar encuentras Pokémon salvajes contra los que luchar. Vencerlos es la única forma de capturarlos, y la captura está garantizada.',
  'guide.catch.2': 'Todo lo que capturas va a tu Caja.',
  'guide.catch.3':
    'En la Caja eliges tu equipo de seis, cambias movimientos y objetos, haces evolucionar y fusionas duplicados para ganar estrellas.',
  'guide.battles.title': 'Combates',
  'guide.battles.1':
    'Lucha contra entrenadores por dinero y objetos, y después contra los jefes. Tus Pokémon no pueden pasar del nivel máximo, y vencer a ciertos jefes lo sube.',
  'guide.battles.2':
    'Vence a suficientes jefes y se abren las Incursiones Dinamax: Pokémon Dinamax gigantes que derrotar a cambio de premios raros.',
  'guide.tower.title': 'Torre Batalla y Draft',
  'guide.tower.1':
    'La Torre Batalla es una partida: empiezas con un Pokémon, subes piso a piso y vas ampliando tu equipo. Si pierdes un combate, se acaba la partida.',
  'guide.tower.2': 'El Draft forma un equipo completo con elecciones al azar y luego lo pone a prueba.',
  'guide.corner.title': 'Casino',
  'guide.corner.1': 'Tragaperras, blackjack, ruleta, Plinko, dados y cajas de Pokémon, con fichas que ganas jugando.',
  'guide.corner.2': 'Las fichas son solo para jugar: nunca se pueden comprar ni cambiar por dinero.',
  'guide.save.title': 'Tu partida',
  'guide.save.1': 'El juego guarda solo mientras juegas.',
  'guide.save.2':
    'Opciones → Partidas hace una copia de tu partida o la pasa a otro dispositivo. Exporta un archivo de partida de vez en cuando, sobre todo antes de reinstalar o cambiar de dispositivo.',
  'guide.save.tip': 'Truco: las teclas numéricas 1-7 van directas a las tarjetas de la pantalla de inicio.',
  'guide.skip': 'Saltar',
  'guide.back': 'Atrás',
  'guide.go': '¡Vamos!',
  'guide.next': 'Siguiente'
}
