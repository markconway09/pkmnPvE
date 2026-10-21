// Every line of the game's text in Spanish - the same keys as en.ts. Names follow the
// Spanish games (Torre Batalla, Casino, fichas, Incursión Dinamax).

import type { Message } from './en'
import type { MessageKey } from './index'
import { areas } from './es/all'

export const es: Record<MessageKey, Message> = {
  ...areas,

  'common.cancel': 'Cancelar',
  'common.click': 'Pulsa',
  'common.tap': 'Toca',
  'common.clickLc': 'pulsa',
  'common.tapLc': 'toca',
  'common.close': 'Cerrar',
  'common.done': 'Hecho',
  'common.on': 'Sí',
  'common.off': 'No',
  'common.muted': 'Silencio',
  'common.open': 'Abrir ▸',
  'common.continue': 'Continuar ▸',

  'about.fanNotice':
    'pkmnPvE es un proyecto de fans gratuito y sin ánimo de lucro, y no está afiliado a Nintendo, Game Freak, Creatures ni The Pokémon Company. Pokémon y sus nombres son marcas registradas de sus respectivos propietarios.',

  'nav.home': 'Inicio',
  'nav.catch': 'Capturar',
  'nav.box': 'Caja',
  'nav.battles': 'Combates',
  'nav.tower': 'Torre Batalla',
  'nav.draft': 'Draft',
  'nav.modes': 'Modos',
  'nav.raid': 'Incursión Dinamax',
  'nav.corner': 'Casino',
  'nav.items': 'Objetos',
  'nav.pokedex': 'Pokédex',
  'nav.rewards': 'Recompensas',
  'nav.achievements': 'Logros',
  'nav.options': 'Opciones',
  'nav.locked': 'Termina primero la partida en curso',

  'difficulty.easy': 'Fácil',
  'difficulty.normal': 'Normal',
  'difficulty.hard': 'Difícil',
  'difficulty.extreme': 'Extremo',

  'draftFormat.singles': 'Individual',
  'draftFormat.doubles': 'Dobles',
  'draftFormat.chaos': 'Caos',

  'home.draftPicking': 'elección {round}/{rounds}',
  'home.draftModifier': 'eligiendo un modificador',
  'home.draftRecord': '{wins}V {losses}D',
  'home.draftRecordNext': '{wins}V {losses}D · siguiente: {name}',
  'home.continueRun': 'Continúa tu partida',
  'home.runLine': 'Piso {floor} · {count} Pokémon · siguiente: {boss}',
  'home.continueDraft': 'Continúa tu draft',
  'home.levelCap': 'Nivel máximo {cap}',
  'home.runInProgress': 'Partida en curso · piso {floor}',
  'home.bestFloor': 'Récord: piso {floor}',
  'home.bestFloorDifficulty': 'Récord: piso {floor} ({difficulty})',
  'home.towerPitch': 'Sube piso a piso con un solo inicial',
  'home.draftInProgress': 'Draft en curso · {progress}',
  'home.draftPitch': 'Forma un equipo con elecciones al azar',
  'home.raidCrystals': { one: '{count} Cristal de Incursión', other: '{count} Cristales de Incursión' },
  'home.raidLocked': 'Vence a {boss} para desbloquear',
  'home.moreBosses': 'más jefes',
  'home.coins': { one: '{count} ficha', other: '{count} fichas' },
  'home.dexNavHunting': 'DexNav: buscando a {species}',
  'home.chain': 'Cadena {chain}',
  'home.catchPitch': 'Encuentra y captura Pokémon salvajes',
  'home.boxPitch': 'Tus Pokémon y tu equipo',
  'home.boxCount': '{count} Pokémon',
  'home.missions': 'Misiones de hoy',

  'login.title': 'Iniciar sesión',
  'login.hint': 'Escribe un nombre de usuario para cargar su partida. Un nombre que aún no existe empieza una nueva.',
  'login.username': 'Nombre de usuario',
  'login.remember': 'Recordarme en este equipo',
  'login.existing': 'Carga la partida guardada de este nombre.',
  'login.new': 'Jugador nuevo: empieza una partida desde cero.',
  'login.logIn': 'Entrar',
  'login.create': 'Crear y entrar',
  'login.players': 'Jugadores en este equipo',

  'options.title': 'Opciones',
  'options.closeEsc': 'Cerrar (Esc)',
  'options.language': 'Idioma',
  'options.languageHint':
    'Los nombres de Pokémon, movimientos y objetos, y el texto de los combates, siguen en inglés por ahora.',

  'sound.title': 'Sonido',
  'sound.menus': 'Menús',
  'sound.cries': 'Gritos',
  'sound.music': 'Música',
  'sound.gameCorner': 'Casino',
  'sound.hitBattle': 'Sonidos de golpe en combates',
  'sound.switch': 'Sonido: {name}',
  'sound.turnOn': 'Activar {name}',
  'sound.turnOff': 'Desactivar {name}',
  'sound.volume': 'Volumen: {name}',

  'music.tracks': { one: '{count} canción', other: '{count} canciones' },
  'music.source.freetouse': 'Lofi de Free To Use',
  'music.source.links': 'Mis enlaces',
  'music.source.folder': 'Mi carpeta',
  'music.freetouseHint': '{tracks} de lofi gratis de freetouse.com, en streaming: sin conexión no hay música.',
  'music.linksHint':
    'Un enlace por línea: archivos de audio directos (.mp3, .ogg...) o emisoras de radio por internet, en orden. Páginas como YouTube o Spotify no funcionan: el enlace tiene que ser el propio audio.',
  'music.useLinks': 'Usar estos enlaces',
  'music.folderHint':
    'Reproduce en orden aleatorio los archivos de música de una carpeta de este equipo (y sus subcarpetas). Funciona sin conexión.',
  'music.chooseFolder': 'Elegir carpeta…',
  'music.lookAgain': 'Volver a buscar',
  'music.noFolder': 'Aún no has elegido ninguna carpeta.',
  'music.scanning': 'Buscando en {folder}…',
  'music.noFiles': 'no hay archivos de música',

  'screen.title': 'Tamaño de pantalla',
  'screen.auto': 'Auto',
  'screen.mobile': 'Móvil',
  'screen.autoHint': 'Ajusta el juego a esta pantalla: aquí, {percent}%.',
  'screen.mobileHint':
    'El diseño del móvil, en una ventana con forma de teléfono ajustada a esta pantalla. Al cambiar, el juego se recarga.',
  'screen.fixedHint': 'El juego siempre se dibuja a este tamaño; la ventana nunca es más grande que la pantalla.',

  'anim.title': 'Animaciones de movimientos',
  'anim.normal': 'Normal',
  'anim.fast': 'Rápidas',
  'anim.off': 'No',

  'sprites.title': 'Estilo de sprites',
  'sprites.2d-static': '2D',
  'sprites.2d-animated': '2D animados',
  'sprites.3d-static': '3D',
  'sprites.3d-animated': '3D animados',

  'background.title': 'Fondo',
  'background.default': 'Predeterminado',
  'background.gallery': 'Elegir de la galería…',
  'background.chooseImage': 'Elegir imagen…',
  'background.reset': 'Restablecer',
  'background.cantOpen': 'No se pudo abrir esa imagen',

  'saves.title': 'Partidas',
  'saves.hint': 'Pasa esta partida a otro dispositivo o haz una copia de seguridad.',
  'saves.warning':
    'Tu partida solo está en este dispositivo. Exporta un archivo de partida de vez en cuando, y siempre antes de reinstalar el juego o cambiar de dispositivo: es la única forma de recuperarla.',
  'saves.button': 'Partidas…',

  'about.title': 'Acerca de',
  'about.showdown':
    'Los combates usan Pokémon Showdown (licencia MIT, © Guangcong Luo y colaboradores). Los avisos completos están en THIRD_PARTY_NOTICES.md, en la página de GitHub del juego.',
  'about.guide': 'Guía de bienvenida…',
  'about.credits': 'Créditos de sprites…',
  'about.bug': '¿Has encontrado un error? Avísanos en GitHub.',
  'about.bugWithLog':
    '¿Has encontrado un error? Avísanos en GitHub y adjunta errors.log de la carpeta de registros: muestra qué falló.',
  'about.reportBug': 'Informar de un error',
  'about.openLogs': 'Abrir carpeta de registros',

  'account.title': 'Cuenta',
  'account.loggedInAs': 'Has entrado como {name}',
  'account.logOut': 'Cerrar sesión',

  'updates.title': 'Actualizaciones',
  'updates.version':
    'Versión {version}. Al actualizar se conservan tus partidas; los entrenadores y demás datos del juego vienen con la nueva versión.',
  'updates.checking': 'Buscando…',
  'updates.check': 'Buscar actualizaciones',
  'updates.upToDate': 'Al día (la última es la {version})',
  'updates.noReleases': 'Aún no se ha publicado ninguna versión',
  'updates.available': 'Ya está disponible la versión {version} ({size}).',
  'updates.download': 'Descargar actualización',
  'updates.downloadHint':
    'El navegador descarga la nueva versión. Cuando termine, abre el archivo y toca Actualizar para instalarla encima de esta.',
  'updates.updating': 'Actualizando…',
  'updates.now': 'Actualizar ahora',
  'updates.browserCopy': 'Esta copia funciona en un navegador, no en la app del móvil: instala el nuevo APK en un teléfono.',
  'updates.devCopy': 'Esta es la copia de desarrollo: actualízala con git.',
  'updates.downloading': 'Descargando… {received} de {total}',
  'updates.unpacking': 'Descomprimiendo…',
  'updates.restarting': 'Instalando: el juego se cerrará y volverá a abrirse en un momento…'
}
