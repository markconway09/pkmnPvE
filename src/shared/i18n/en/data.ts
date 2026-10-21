// The labels in the shared game data (battle-types.ts): wild areas, weather and terrain,
// the Battle Tower's difficulties, boss classes and consumables.
export const data = {
  'location.cave': 'Cave',
  'location.mountain': 'Mountain',
  'location.volcano': 'Volcano',
  'location.desert': 'Desert',
  'location.forest': 'Forest',
  'location.city': 'City',
  'location.industry': 'Industry',
  'location.cemetery': 'Graveyard',
  'location.ocean': 'Ocean',
  'location.all': 'All',
  'location.lab': 'Lab',
  'location.anywhere': 'Anywhere',

  'weather.sunnyday': 'Sun',
  'weather.raindance': 'Rain',
  'weather.sandstorm': 'Sandstorm',
  'weather.snowscape': 'Snow',
  'terrain.electricterrain': 'Electric',
  'terrain.grassyterrain': 'Grassy',
  'terrain.mistyterrain': 'Misty',
  'terrain.psychicterrain': 'Psychic',

  'bossClass.gymLeader': 'Gym Leader',
  'bossClass.eliteFour': 'Elite Four',
  'bossClass.champion': 'Champion',
  'bossClass.villainGrunt': 'Villain Grunt',
  'bossClass.villainElite': 'Villain Elite',
  'bossClass.gymLeaderAt': 'Gym Leader {n}/{of}',
  'bossClass.eliteFourAt': 'Elite Four {n}/{of}',

  'difficulty.easy.rules':
    'A short run: 4 Gym Leaders and 2 Elite Four before the Champion. Trainers and bosses use the Normal AI, you start with a Full Restore, and trainer and boss wins pay 1 extra gem.',
  'difficulty.easy.rewards': 'Per boss: Exp. Candy S and ₽1,000. Beating the Champion: a Random Pokémon.',
  'difficulty.normal.rules': 'A shorter run: 6 Gym Leaders and 3 Elite Four before the Champion.',
  'difficulty.normal.rewards':
    'Per boss: Exp. Candy M and ₽5,000. Each Elite Four member and the Champion: a Random Pokémon and a Raid Crystal.',
  'difficulty.hard.rules':
    'Trainers and bosses use the Hard AI, wild Pokémon the Normal AI, and every team has one more Pokémon.',
  'difficulty.hard.rewards':
    'Per boss: a Random Pokémon, a Raid Crystal, Exp. Candy M and ₽10,000. Beating the Champion: a Random Legendary.',
  'difficulty.extreme.rules':
    'Everything in Hard, but wild Pokémon use the Hard AI too, every boss brings 6 Pokémon, and there is no healing at all.',
  'difficulty.extreme.rewards': 'Per boss: a Random Legendary, 2 Raid Crystals, Exp. Candy L and ₽20,000.',

  'consumable.fullrestore': 'Full Restore',
  'consumable.fullrestore.desc': 'Fully heals one Pokémon: all its HP back and no status.',
  'consumable.revive': 'Revive',
  'consumable.revive.desc': "Brings back a Pokémon that fainted this run, at half HP and this floor's opponent level.",
  'consumable.abilitycapsule': 'Ability Capsule',
  'consumable.abilitycapsule.desc': "Changes a Pokémon's ability to one of its species' normal or hidden abilities.",

  'rarity.common': 'Common',
  'rarity.uncommon': 'Uncommon',
  'rarity.rare': 'Rare',
  'rarity.epic': 'Mythical',
  'rarity.legendary': 'Legendary'
}
