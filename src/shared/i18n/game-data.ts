// The game data's own text in other languages: achievements (by id), their categories,
// titles and their perks (by title), and daily missions (by id). The English stays in the
// data files (achievements.ts, titles.ts, missions.ts), which also keep using it as the
// ids - these only change what's shown. Anything missing shows the English.

import type { Locale } from './index'
import type { AchievementCategory } from '../achievements'
import type { Title } from '../titles'

interface GameDataText {
  // [name, description]
  achievements: Record<string, [string, string]>
  categories: Record<AchievementCategory, string>
  titles: Record<Title, string>
  perks: Record<Title, string>
  missions: Record<string, string>
}

const es: GameDataText = {
  achievements: {
    win1: ['Primera victoria', 'Gana un combate'],
    win50: ['Cada vez más fuerte', 'Gana 50 combates'],
    win250: ['Combatiente curtido', 'Gana 250 combates'],
    win1000: ['Leyenda del combate', 'Gana 1.000 combates'],
    trainers25: ['Domador de entrenadores', 'Derrota a 25 entrenadores'],
    trainers100: ['Entrenador guay', 'Derrota a 100 entrenadores'],
    badge1: ['Primera medalla', 'Vence a tu primer líder de gimnasio'],
    badge8: ['Coleccionista de medallas', 'Vence a los ocho líderes de gimnasio'],
    elitefour: ['Aspirante al Alto Mando', 'Derrota a los cuatro miembros del Alto Mando'],
    champion: ['Campeón', 'Derrota al Campeón'],
    catch1: ['¡Te tengo!', 'Captura un Pokémon salvaje'],
    catch50: ['Capturador Pokémon', 'Captura 50 Pokémon salvajes'],
    catch250: ['Cazador Pokémon', 'Captura 250 Pokémon salvajes'],
    catch1000: ['Hazte con todos', 'Captura 1.000 Pokémon salvajes'],
    dex50: ['Investigador en ciernes', 'Registra 50 Pokémon en la Pokédex'],
    dex151: ['¿Kanto completo?', 'Registra 151 Pokémon en la Pokédex'],
    dex400: ['Erudito de la Pokédex', 'Registra 400 Pokémon en la Pokédex'],
    dex800: ['Profesor', 'Registra 800 Pokémon en la Pokédex'],
    dexcomplete: ['Pokédex completa', 'Registra todos los Pokémon de la Pokédex Nacional (las formas no cuentan)'],
    forms25: ['Cambiaformas', 'Registra 25 formas alternativas en la Pokédex'],
    shiny1: ['Algo que brilla', 'Ten un Pokémon variocolor'],
    shiny10: ['Cazador de variocolores', 'Ten 10 Pokémon variocolor a la vez'],
    legendary1: ['Mito o leyenda', 'Ten un Pokémon legendario, singular, Ultraente o paradójico'],
    restricted1: ['Guardián de leyendas', 'Ten un legendario de portada (Mewtwo, Kyogre, Koraidon...)'],
    rotom: ['Enchufado', 'Ten un Rotom (cualquier forma)'],
    necrozma: ['Poder prismático', 'Ten un Necrozma (cualquier forma)'],
    kyurem: ['Rompelímites', 'Ten un Kyurem (cualquier forma)'],
    calyrex: ['Cosecha abundante', 'Ten un Calyrex (cualquier forma)'],
    hoopa: ['Travesura desatada', 'Ten un Hoopa (cualquier forma)'],
    forces: ['Fuerzas de la naturaleza', 'Ten un Tornadus, Thundurus, Landorus o Enamorus'],
    shaymin: ['Gratitud en flor', 'Ten un Shaymin (cualquier forma)'],
    deoxys: ['Visitante del espacio', 'Ten un Deoxys (cualquier forma)'],
    bestfriend: ['Mejores amigos', 'Lleva al máximo la amistad de un Pokémon: desbloquea un hueco de acompañante junto a tu equipo'],
    alcremie: ['Goloso', 'Registra todas las formas de Alcremie en la Pokédex'],
    minior: ['Estrellas fugaces', 'Consigue todos los colores de núcleo de Minior'],
    pikachu: ['Fiesta de disfraces', 'Ten 3 formas distintas de Pikachu a la vez (un Pikachu normal cuenta como una)'],
    zygarde: ['Guardián del orden', 'Ten un Zygarde (cualquier forma)'],
    swordsofjustice: ['Espadas de la justicia', 'Registra a Cobalion, Terrakion y Virizion en la Pokédex'],
    shinycelebi: ['Viajero del tiempo', 'Ten un Celebi variocolor'],
    evolve1: ['¿Qué?', 'Haz evolucionar a un Pokémon'],
    evolve50: ['Experto en evolución', 'Haz evolucionar a 50 Pokémon'],
    money100k: ['Acomodado', 'Ten 100.000 ₽ a la vez'],
    money1m: ['Magnate', 'Ten 1.000.000 ₽ a la vez'],
    floor10: ['Explorador de pisos', 'Llega al piso 10 en una partida de la Torre Batalla'],
    runwin1: ['Partida superada', 'Supera una partida de la Torre Batalla'],
    runwin5: ['Speedrunner', 'Supera 5 partidas de la Torre Batalla'],
    hardrun: ['Temerario', 'Supera una partida de la Torre Batalla en Difícil o Extremo'],
    draft1: ['Primera elección', 'Termina un draft'],
    draftbest4: ['A medio camino', 'Llega a 4 victorias en un mismo draft'],
    draftwins25: ['Corredor del desafío', 'Gana 25 combates de draft'],
    draftflawless: ['Impecable', 'Gana un combate de draft sin que se debilite ninguno de tus Pokémon'],
    draftperfect: ['Draft perfecto', 'Termina un draft 7-0'],
    draftformats: ['Dos formatos', 'Gana 7 combates en un draft individual y en uno de dobles'],
    draftluckypack: ['Sobre de la suerte', 'Abre un sobre de draft con una carta de rareza legendaria'],
    draftgoldenhand: ['Mano dorada', 'Elige 3 Pokémon de rareza legendaria en un mismo draft'],
    draftubers: ['Campeón de Ubers', 'Gana 7 combates en un draft individual con Ubers y OU'],
    draftunderdog: ['Contra todo pronóstico', 'Gana 7 combates en un draft individual con ZU'],
    spins100: ['Habitual', 'Gira las tragaperras 100 veces'],
    spins1000: ['Adicto a las tragaperras', 'Gira las tragaperras 1.000 veces'],
    jackpot: ['Toque dorado', 'Consigue el premio gordo de Gholdengo'],
    slotwins10k: ['Ludópata', 'Gana 10.000 fichas en total en las tragaperras'],
    bjwin25: ['Tahúr', 'Gana 25 manos de blackjack'],
    natural: ['Veintiuno', 'Consigue un blackjack'],
    roulette100: ['Vueltas y vueltas', 'Gira la ruleta 100 veces'],
    luckynumber: ['Número de la suerte', 'Gana una apuesta de la ruleta a un solo número'],
    plinko500: ['Lanzabolas', 'Lanza 500 bolas en el Plinko'],
    plinkoedge: ['Caso límite', 'Mete una bola de Plinko en una de las casillas de los bordes'],
    dicelongshot: ['Contra las probabilidades', 'Gana una tirada de dados con un 5 % de probabilidad de ganar o menos'],
    merge1: ['Mejor juntos', 'Fusiona un Pokémon'],
    star3: ['Estrella en ascenso', 'Fusiona un Pokémon hasta ★3'],
    star5: ['Superestrella', 'Fusiona un Pokémon hasta ★5'],
    magearna5: ['Corazón artificial', 'Ten un Magearna ★5'],
    merge50: ['Laboratorio de fusión', 'Fusiona 50 duplicados'],
    merge250: ['Alquimista', 'Fusiona 250 duplicados'],
    raid1: ['Pide un deseo', 'Gana una Incursión Dinamax'],
    raid10: ['Habitual de las incursiones', 'Gana 10 Incursiones Dinamax'],
    raid50: ['Líder de incursión', 'Gana 50 Incursiones Dinamax'],
    gmax1: ['¡Gigantesco!', 'Ten un Pokémon Gigamax'],
    gmax10: ['Coleccionista Gigamax', 'Ten 10 especies Gigamax distintas'],
    goldraid: ['Leyenda de la guarida', 'Gana una Incursión Dinamax contra un jefe dorado'],
    daily7: ['Rutina diaria', 'Termina las tres misiones diarias 7 días'],
    tmsearch1: ['Rebuscador', 'Encuentra una MT buscando'],
    tmsearch100: ['Cazatesoros', 'Encuentra 100 MT buscando'],
    tmgold: ['Hallazgo dorado', 'Encuentra una MT dorada'],
    tmareas: ['Explorador', 'Busca MT en las 7 zonas'],
    labsearch25: ['Rata de laboratorio', 'Encuentra 25 MT buscando en el Laboratorio'],
    tmowned50: ['Tutor de movimientos', 'Ten 50 MT'],
    tmowned250: ['Máquina técnica', 'Ten 250 MT'],
    tmtype: ['Colección completa', 'Ten todas las MT de un tipo'],
    greats500: ['Pulso firme', 'Consigue 500 Genial en las pruebas de habilidad'],
    flawlesssearch: ['Búsqueda impecable', 'Termina una búsqueda de MT con todas las pruebas en Genial'],
    flawlessgold: ['Perfeccionista', 'Termina una búsqueda de MT morada o superior con todas las pruebas en Genial'],
    greatstreak: ['En racha', 'Consigue 10 Genial seguidos en las pruebas de habilidad'],
    mergeshiny: ['No es oro todo lo que reluce', 'Haz variocolor a un Pokémon fusionándole uno variocolor'],
    flawlessraid: ['Incursión impecable', 'Gana una Incursión Dinamax sin que se debilite ninguno de tus Pokémon'],
    shinyraid: ['Deseo cumplido', 'Captura un jefe de incursión variocolor'],
    sellshiny: ['Sin corazón', 'Vende un Pokémon variocolor'],
    sell100: ['Comerciante Pokémon', 'Vende 100 Pokémon'],
    earlyloss: ['Inténtalo de nuevo', 'Pierde una partida de la Torre Batalla antes del piso 5'],
    tmambush: ['Mal despertar', 'Despierta a un Pokémon salvaje mientras buscas una MT'],
    afk: ['Dormido al volante', 'Deja que se agote el tiempo de una prueba de habilidad 10 veces'],
    hordewin: ['Rompehordas', 'Sobrevive a una partida de Hordas completa'],
    hordelevel100: ['Centurión', 'Sube un Pokémon al nivel 100 en una partida de Hordas'],
    hordeshiny: ['Horda variocolor', 'Sobrevive a una partida de Hordas completa con un Pokémon variocolor'],
    hordeendless: ['Sin fin', 'Aguanta 20 minutos en una partida de Hordas'],
    hordemega: ['Megaimpulso', 'Megaevoluciona y aguanta 20 minutos (+10 en modo sin fin) en una partida de Hordas'],
    hordeditto: ['Cambiaformas', 'Sobrevive a una partida de Hordas completa con Ditto'],
    hordewishiwashi: ['La unión hace la fuerza', 'Sobrevive a una partida de Hordas completa con Wishiwashi']
  },
  categories: {
    Battle: 'Combate',
    Collection: 'Colección',
    'Merges & Raids': 'Fusiones e incursiones',
    'Battle Tower': 'Torre Batalla',
    Draft: 'Draft',
    TMs: 'MT',
    'Game Corner': 'Casino',
    Horde: 'Hordas',
    Secret: 'Secreto'
  },
  titles: {
    Veteran: 'Veterano',
    'Ace Trainer': 'Entrenador guay',
    'Badge Collector': 'Coleccionista de medallas',
    Champion: 'Campeón',
    Collector: 'Coleccionista',
    Professor: 'Profesor',
    'Shiny Hunter': 'Cazador de variocolores',
    'Legend Keeper': 'Guardián de leyendas',
    Tycoon: 'Magnate',
    Survivor: 'Superviviente',
    Daredevil: 'Temerario',
    'Golden Touch': 'Toque dorado',
    'High Roller': 'Ludópata',
    'Edge Lord': 'Señor del borde',
    Heartless: 'Sin corazón',
    Broker: 'Comerciante',
    '9+10': '9+10',
    'Five-Star': 'Cinco estrellas',
    Alchemist: 'Alquimista',
    'Raid Leader': 'Líder de incursión',
    'Gigantamax Hunter': 'Cazador Gigamax',
    Starlight: 'Luz estelar',
    Diligent: 'Diligente',
    Croupier: 'Crupier',
    'Long Shot': 'Golpe de suerte',
    'Grand Drafter': 'Gran drafter',
    Prospector: 'Buscador de oro',
    'Light Sleeper': 'Sueño ligero',
    'Walking Disc': 'Disco andante',
    Specialist: 'Especialista',
    'Steady Hands': 'Pulso firme',
    'Hex Master': 'Maestro maldito',
    Unstoppable: 'Imparable',
    AFK: 'AFK',
    Centurion: 'Centurión',
    Shapeshifter: 'Cambiaformas',
    Schooling: 'Banco de peces'
  },
  perks: {
    Veteran: 'Doble de experiencia en los combates',
    'Ace Trainer': '+50 % de dinero de premio de entrenadores y jefes',
    'Badge Collector': '50 % de probabilidad de un Caramelo Raro extra tras cualquier combate ganado',
    Champion: 'Huir de los entrenadores es gratis',
    Collector: '25 % de probabilidad de que una captura sea gratis',
    Professor:
      'Los Pokémon que no has registrado aparecen más a menudo en estado salvaje, y la cadena del DexNav llega al máximo en 20 en vez de 30',
    'Shiny Hunter': 'Probabilidad de variocolor salvaje de 1 entre 384 en vez de 1 entre 512 (no en jefes de incursión)',
    'Legend Keeper': 'Legendario al azar da un legendario de portada con más frecuencia',
    Tycoon: '25 % de descuento al comprar 5 o más unidades de un objeto a la vez en la Tienda',
    Survivor: 'Las partidas de la Torre Batalla empiezan con una elección de objeto gratis',
    Daredevil: 'Las partidas de la Torre Batalla empiezan con una elección de movimiento y de habilidad gratis',
    'Golden Touch': 'El premio gordo de las tragaperras paga ×75 en vez de ×50, y cada premio de las tragaperras un 10 % más',
    'High Roller': 'Apuesta hasta 10.000 fichas en el Casino',
    'Edge Lord': 'Las casillas de los bordes del Plinko pagan el doble y las de al lado un 25 % más, con cualquier riesgo',
    Heartless: 'Los Pokémon se venden por un 15 % más',
    Broker: 'Los Pokémon grises, azules y morados se venden por el doble',
    '9+10': 'El blackjack paga 4:1 en vez de 3:2, y una victoria normal 3:2 en vez de 1:1',
    'Five-Star': 'Los legendarios dorados aparecen el doble como jefes de incursión',
    Alchemist: '10 % de probabilidad de encontrar un objeto evolutivo al azar al vender un Pokémon',
    'Raid Leader': 'Los jefes de incursión se capturan con 2 copias extra',
    'Gigantamax Hunter': 'Los jefes de incursión se gigamaxizan más a menudo (65 % en vez de 50 %)',
    Starlight: 'Los jefes de incursión tienen el triple de probabilidad de ser variocolor (×5 con el Amuleto Iris)',
    Diligent: 'Un cambio extra de misión diaria',
    Croupier:
      'Una tirada perdedora de la ruleta tiene un 10 % de probabilidad de devolver todas las apuestas, y una ganadora un 10 % de pagar el doble',
    'Long Shot':
      'Una tirada perdedora de los dados tiene un 10 % de probabilidad de devolver la apuesta, y una ganadora un 10 % de pagar el doble',
    'Grand Drafter': 'Entrar en un draft cuesta un 25 % menos',
    Prospector: 'Las búsquedas de MT encuentran MT doradas el doble de a menudo',
    'Light Sleeper': 'Una búsqueda de MT aguanta un fallo más antes de que despierte un Pokémon salvaje',
    'Walking Disc': 'Una MT que ya tienes paga el doble, y las MT nuevas aparecen más a menudo',
    Specialist: 'Una búsqueda de MT que encuentra una MT tiene un 50 % de probabilidad de devolver la búsqueda de la zona',
    'Steady Hands': 'La franja Genial de una búsqueda de MT es un 50 % más ancha',
    'Hex Master': 'Una búsqueda de MT necesita un Genial menos para subir de rareza',
    Unstoppable: 'La comprobación rápida del Escáner tiene el doble de probabilidad de encontrar una MT',
    AFK: 'Una prueba fallada no hace retroceder un paso la búsqueda de MT',
    Centurion: '10 % más de dinero en las partidas de Hordas',
    Shapeshifter: 'El Quitamovimientos se puede usar dos veces por partida de Hordas',
    Schooling: 'Las partidas de Hordas empiezan con 2 tiradas extra'
  },
  missions: {
    wild5: 'Gana 5 combates contra Pokémon salvajes',
    catch3: 'Captura 3 Pokémon salvajes',
    slots20: 'Gira las tragaperras 20 veces',
    roulette10: 'Gira la ruleta 10 veces',
    plinko25: 'Lanza 25 bolas de Plinko',
    tmsearch5: 'Busca MT 5 veces',
    runfloors5: 'Supera 5 pisos de la Torre Batalla',
    trainers3: 'Vence a 3 entrenadores',
    blackjack3: 'Gana 3 manos de blackjack',
    evolve1: 'Haz evolucionar a un Pokémon',
    merge1: 'Fusiona un Pokémon',
    wild15: 'Gana 15 combates contra Pokémon salvajes',
    greats3: 'Consigue 3 Genial en pruebas de habilidad (en una búsqueda o una comprobación rápida)',
    runtrainers3: 'Vence a 3 entrenadores en partidas de la Torre Batalla',
    boss1: 'Vence a un jefe de la Torre Batalla',
    raid1: 'Gana una Incursión Dinamax',
    trainers10: 'Vence a 10 entrenadores',
    draft1: 'Gana un combate en el modo Draft',
    runfloors15: 'Supera 15 pisos de la Torre Batalla',
    hordekos100: 'Derrota a 100 Pokémon en una sola partida de Hordas',
    hordewin1: 'Resiste una partida de Hordas completa (10 minutos)'
  }
}

const TABLES: Partial<Record<Locale, GameDataText>> = { es }

export function achievementName(locale: Locale, id: string, english: string): string {
  return TABLES[locale]?.achievements[id]?.[0] ?? english
}

export function achievementDescription(locale: Locale, id: string, english: string): string {
  return TABLES[locale]?.achievements[id]?.[1] ?? english
}

export function achievementCategoryName(locale: Locale, category: AchievementCategory): string {
  return TABLES[locale]?.categories[category] ?? category
}

/** A title's name (titles are kept by their English name). */
export function titleName(locale: Locale, title: string): string {
  return TABLES[locale]?.titles[title as Title] ?? title
}

export function titlePerkText(locale: Locale, title: Title, english: string): string {
  return TABLES[locale]?.perks[title] ?? english
}

export function missionText(locale: Locale, templateId: string, english: string): string {
  return TABLES[locale]?.missions[templateId] ?? english
}
