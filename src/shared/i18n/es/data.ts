import type { data as en } from '../en/data'
import type { Message } from '../en'

export const data: Record<keyof typeof en, Message> = {
  'location.cave': 'Cueva',
  'location.mountain': 'Montaña',
  'location.forest': 'Bosque',
  'location.city': 'Ciudad',
  'location.industry': 'Industria',
  'location.cemetery': 'Cementerio',
  'location.ocean': 'Océano',
  'location.all': 'Todo',
  'location.lab': 'Laboratorio',
  'location.anywhere': 'Cualquier sitio',

  'weather.sunnyday': 'Sol',
  'weather.raindance': 'Lluvia',
  'weather.sandstorm': 'Tormenta de arena',
  'weather.snowscape': 'Nieve',
  'terrain.electricterrain': 'Eléctrico',
  'terrain.grassyterrain': 'Hierba',
  'terrain.mistyterrain': 'Niebla',
  'terrain.psychicterrain': 'Psíquico',

  'bossClass.gymLeader': 'Líder de gimnasio',
  'bossClass.eliteFour': 'Alto Mando',
  'bossClass.champion': 'Campeón',
  'bossClass.villainGrunt': 'Recluta villano',
  'bossClass.villainElite': 'Élite villana',
  'bossClass.gymLeaderAt': 'Líder de gimnasio {n}/{of}',
  'bossClass.eliteFourAt': 'Alto Mando {n}/{of}',

  'difficulty.easy.rules':
    'Una partida corta: 4 líderes de gimnasio y 2 del Alto Mando antes del Campeón. Entrenadores y jefes usan la IA Normal, empiezas con un Restaurar Todo, y las victorias contra entrenadores y jefes dan 1 gema extra.',
  'difficulty.easy.rewards': 'Por jefe: Caramelo Exp. S y 1.000 ₽. Vencer al Campeón: un Pokémon al azar.',
  'difficulty.normal.rules': 'Una partida más corta: 6 líderes de gimnasio y 3 del Alto Mando antes del Campeón.',
  'difficulty.normal.rewards':
    'Por jefe: Caramelo Exp. M y 5.000 ₽. Cada miembro del Alto Mando y el Campeón: un Pokémon al azar y un Cristal de Incursión.',
  'difficulty.hard.rules':
    'Entrenadores y jefes usan la IA Difícil, los Pokémon salvajes la Normal, y todos los equipos tienen un Pokémon más.',
  'difficulty.hard.rewards':
    'Por jefe: un Pokémon al azar, un Cristal de Incursión, Caramelo Exp. M y 10.000 ₽. Vencer al Campeón: un legendario al azar.',
  'difficulty.extreme.rules':
    'Todo lo de Difícil, pero los Pokémon salvajes también usan la IA Difícil, cada jefe trae 6 Pokémon y no hay ninguna curación.',
  'difficulty.extreme.rewards': 'Por jefe: un legendario al azar, 2 Cristales de Incursión, Caramelo Exp. L y 20.000 ₽.',

  'consumable.fullrestore': 'Restaurar Todo',
  'consumable.fullrestore.desc': 'Cura por completo a un Pokémon: todos sus PS y sin problemas de estado.',
  'consumable.revive': 'Revivir',
  'consumable.revive.desc': 'Reanima a un Pokémon debilitado en esta partida, con la mitad de sus PS y al nivel de los rivales de este piso.',
  'consumable.abilitycapsule': 'Cápsula Habilidad',
  'consumable.abilitycapsule.desc': 'Cambia la habilidad de un Pokémon por una de las habilidades normales u ocultas de su especie.',

  'rarity.common': 'Común',
  'rarity.uncommon': 'Poco común',
  'rarity.rare': 'Rara',
  'rarity.epic': 'Mítica',
  'rarity.legendary': 'Legendaria'
}
