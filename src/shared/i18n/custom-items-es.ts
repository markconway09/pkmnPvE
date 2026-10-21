// The game's own items (not in the Pokémon games' data, or not in this Showdown's Dex) in
// Spanish: their names and what they do, by id - and by their English name's id where
// that's different (the Raid Crystal is the wishingpiece).

export const CUSTOM_ITEM_NAMES_ES: Record<string, string> = {
  linkcable: 'Cable Conexión',
  rarecandy: 'Caramelo Raro',
  // Horde mode's held items with no Showdown entry.
  reliccrown: 'Corona Antigua',
  luckincense: 'Incienso Duplo',
  cardkey: 'Llave Magnética',
  pearlstring: 'Ristra de Perlas',
  blackaugurite: 'Mineral Negro',
  peatblock: 'Bloque de Turba',
  randompokemon: 'Pokémon al azar',
  randomlegendary: 'Legendario al azar',
  wishingpiece: 'Cristal de Incursión',
  raidcrystal: 'Cristal de Incursión',
  lockcapsule: 'Cápsula Candado',
  expcandys: 'Caramelo Exp. S',
  expcandym: 'Caramelo Exp. M',
  expcandyl: 'Caramelo Exp. L',
  shinypatch: 'Parche Variocolor',
  friendshippetal: 'Pétalo de Amistad',
  expcharm: 'Amuleto Exp',
  shinycharm: 'Amuleto Iris',
  friendshipcharm: 'Amuleto Amistad',
  catchingcharm: 'Amuleto Captura',
  itemcharm: 'Amuleto Objeto',
  prisonbottle: 'Vasija Castigo',
  revealglass: 'Espejo Veraz',
  gracidea: 'Gracídea',
  meteorite: 'Meteorito',
  zygardecube: 'Arca de Zygarde',
  decorationbox: 'Caja de Adornos',
  fashioncase: 'Caja de Moda',
  nsolarizer: 'Necrosol',
  nlunarizer: 'Necroluna',
  dnasplicers: 'Punta ADN',
  reinsofunity: 'Riendas Unión',
  scanner: 'Escáner',
  dexnav: 'DexNav',
  pokedexdiploma: 'Diploma Pokédex',
  rotomcatalog: 'Catálogo Rotom'
}

export const CUSTOM_ITEM_TEXTS_ES: Record<string, string> = {
  linkcable: 'Sustituye a un compañero de intercambio: permite evolucionar sin él a un Pokémon que evoluciona por intercambio.',
  rarecandy: 'Un caramelo lleno de energía. Se vende en la tienda.',
  blackaugurite: 'Un cristal negro con un extraño poder. Hace evolucionar a Scyther en Kleavor.',
  peatblock: 'Un bloque de turba con una energía extraña. Hace evolucionar a Ursaring en Ursaluna.',
  randompokemon: 'Ábrelo desde la mochila para recibir en tu caja un Pokémon sin evolucionar al azar; puede tocar un legendario.',
  randomlegendary: 'Ábrelo desde la mochila para recibir en tu caja un Pokémon legendario, singular, Ultraente o paradójico al azar.',
  wishingpiece: 'Inicia una Incursión Dinamax desde el menú Clásico; se gasta al empezar la incursión.',
  lockcapsule: 'Ábrela desde la mochila para recibir un objeto de la tienda al azar: cuanto más caro, más raro.',
  expcandys: 'Úsalo desde la mochila para dar 10.000 de experiencia a cada Pokémon de tu equipo.',
  expcandym: 'Úsalo desde la mochila para dar 50.000 de experiencia a cada Pokémon de tu equipo.',
  expcandyl: 'Úsalo desde la mochila para dar 100.000 de experiencia a cada Pokémon de tu equipo.',
  shinypatch: 'Haz clic derecho en un Pokémon de tu caja o equipo y úsalo para hacer variocolor a ese Pokémon.',
  friendshippetal:
    'Haz clic derecho en un Pokémon de tu caja o equipo y úsalo para llevar su amistad al máximo. La fusión de la caja también puede gastarlos en evoluciones por amistad.',
  expcharm: 'Tu equipo gana 1,5× experiencia en cada combate ganado.',
  shinycharm: 'Los Pokémon salvajes tienen el triple de probabilidad de ser variocolor.',
  friendshipcharm: 'Tu equipo gana el doble de amistad contigo en cada combate ganado.',
  catchingcharm: 'La mitad de las capturas son gratis: no se gasta Poké Ball ni se paga nada.',
  itemcharm: 'Cada objeto que suelta un Pokémon salvaje es un 15 % más probable (75 % pasa a 90 %).',
  prisonbottle: 'Haz clic derecho en un Hoopa para cambiarlo entre su forma Contenida y Desatada.',
  revealglass: 'Haz clic derecho en Tornadus, Thundurus, Landorus o Enamorus para cambiarlo entre su forma Avatar y Tótem.',
  gracidea: 'Haz clic derecho en un Shaymin para cambiarlo entre su forma Tierra y Cielo.',
  meteorite: 'Haz clic derecho en un Deoxys para cambiarlo entre su forma Normal, Ataque, Defensa y Velocidad.',
  zygardecube: 'Haz clic derecho en un Zygarde para cambiarlo entre su forma 50 % y 10 %.',
  decorationbox: 'Haz clic derecho en un Alcremie para cambiar su crema a cualquiera de sus nueve formas.',
  fashioncase: 'Haz clic derecho en un Pikachu para cambiar su atuendo: una gorra, un traje Cosplay, Compañero o Mundial.',
  nsolarizer: 'Haz clic derecho en un Necrozma para fusionarlo con un Solgaleo de tu caja, o para separarlos.',
  nlunarizer: 'Haz clic derecho en un Necrozma para fusionarlo con un Lunala de tu caja, o para separarlos.',
  dnasplicers: 'Haz clic derecho en un Kyurem para fusionarlo con un Zekrom o Reshiram de tu caja, o para separarlos.',
  reinsofunity: 'Haz clic derecho en un Calyrex para fusionarlo con un Glastrier o Spectrier de tu caja, o para separarlos.',
  scanner:
    'Tras una victoria salvaje, una prueba de habilidad rápida puede encontrar una MT de la zona: 5 % con un Bien, 15 % con un Genial.',
  dexnav:
    'Busca un Pokémon que tengas registrado: aparece más a menudo cuanto más larga es tu cadena (hasta un 75 %), y con la cadena completa tiene el doble de probabilidad de ser variocolor.',
  pokedexdiploma:
    'Prueba de una Pokédex completa. El DexNav puede buscar cualquier Pokémon, formas incluidas; los que nunca se ven en estado salvaje solo aparecen en el Laboratorio.',
  rotomcatalog: 'Haz clic derecho en un Rotom para cambiar su forma; recibe un set de Smogon para la nueva.'
}
CUSTOM_ITEM_TEXTS_ES.raidcrystal = CUSTOM_ITEM_TEXTS_ES.wishingpiece
