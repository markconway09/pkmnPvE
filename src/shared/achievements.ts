// Achievements: one-off goals, each measured by one of the player's tallies (see
// AchievementStat) reaching its goal. Reaching it unlocks the achievement; its reward is
// handed over when the player claims it. Shared by the main process (which tracks and
// pays them - see achievement-store.ts) and the renderer (which lists them).

export type AchievementStat =
  // Battles won of every kind: wild, trainer and boss.
  | 'battlesWon'
  | 'trainersDefeated'
  | 'wildCaught'
  // Kanto's gym leaders, the Elite Four and the Champion beaten (see trainer-profile.ts).
  | 'gymBadges'
  | 'eliteFour'
  | 'champion'
  // Pokedex entries registered: species, and alternate forms on top of those.
  | 'dexSpecies'
  | 'dexForms'
  // What the box holds right now.
  | 'shinyOwned'
  | 'legendaryOwned'
  | 'restrictedOwned'
  | 'rotomOwned'
  | 'necrozmaOwned'
  | 'kyuremOwned'
  | 'calyrexOwned'
  | 'hoopaOwned'
  | 'forcesOwned'
  | 'shayminOwned'
  | 'deoxysOwned'
  | 'zygardeOwned'
  // Pokemon owned (the companion too) at max friendship.
  | 'maxFriendship'
  // Alcremie's creams in the Pokedex (all nine - see ALCREMIE_FORMS).
  | 'alcremieForms'
  // Minior's cores ever owned (all seven - see MINIOR_COLORS).
  | 'miniorColors'
  // Different Pikachu forms owned at once (see PIKACHU_FORMS).
  | 'pikachuForms'
  | 'money'
  | 'evolutions'
  | 'pokemonSold'
  | 'shinySold'
  // Merging and Max Raids.
  | 'pokemonMerged'
  // The most stars a Pokemon has reached by merging (a raid catch's own stars don't count).
  | 'mergedStars'
  | 'mergeShinied'
  | 'raidsWon'
  | 'gmaxSpecies'
  | 'goldRaidsWon'
  | 'flawlessRaids'
  | 'shinyRaidCatches'
  // Days all three daily missions were finished (and the bonus claimed).
  | 'dailySetsCompleted'
  // Roguelite.
  | 'bestFloor'
  | 'runsWon'
  | 'hardRunsWon'
  | 'earlyRunLosses'
  // Draft mode: drafts ended (any result, abandoned too), battles won, the most wins in
  // one draft, 7-0 drafts, 7-win drafts per format (and how many formats have one), and
  // battles won without a Pokemon fainting.
  | 'draftsFinished'
  | 'draftBattlesWon'
  | 'draftBestWins'
  | 'perfectDrafts'
  | 'perfectSinglesDrafts'
  | 'perfectDoublesDrafts'
  | 'draftFormatsPerfected'
  | 'flawlessDraftWins'
  // Packs offered with a legendary-rarity card in them, the most legendary-rarity
  // Pokemon picked in one draft, and 7-win singles drafts in the top (Ubers + OU) and
  // bottom (ZU) tiers.
  | 'luckyPacks'
  | 'draftBestLegendaries'
  | 'ubersPerfectDrafts'
  | 'zuPerfectDrafts'
  // Game Corner.
  | 'slotSpins'
  | 'jackpots'
  | 'slotCoinsWon'
  | 'blackjackWins'
  | 'naturalBlackjacks'
  | 'rouletteSpins'
  | 'rouletteNumberWins'
  | 'plinkoDrops'
  | 'plinkoEdges'
  // TMs: searches that found a TM, gold TMs found (searches and quick checks), searches
  // ended by a wild Pokemon, the base areas (not Anywhere or the Lab) searched, Lab
  // searches that found a TM, TMs owned, and types whose every TM is owned.
  | 'tmSearches'
  | 'legendaryTmsFound'
  | 'tmAmbushes'
  | 'tmAreasSearched'
  | 'labSearches'
  | 'tmsOwned'
  | 'tmTypesCompleted'
  // Skill checks: Greats hit, searches done with every check a Great (and gold ones), the
  // longest run of Greats in a row, and needles left to go all the way round.
  | 'skillGreats'
  | 'flawlessSearches'
  | 'flawlessLegendarySearches'
  | 'bestGreatStreak'
  | 'skillTimeouts'

export type AchievementCategory = 'Battle' | 'Collection' | 'Merges & Raids' | 'Roguelite' | 'Draft' | 'TMs' | 'Game Corner' | 'Secret'
export const ACHIEVEMENT_CATEGORIES: AchievementCategory[] = [
  'Battle',
  'Collection',
  'Merges & Raids',
  'Roguelite',
  'Draft',
  'TMs',
  'Game Corner',
  'Secret'
]

export interface AchievementReward {
  // Key items (see KEY_ITEM_IDS) it unlocks.
  keyItems?: string[]
  money?: number
  coins?: number
  items?: { itemId: string; count: number }[]
  // A title the player can show beside their name.
  title?: string
}

export interface AchievementDef {
  id: string
  name: string
  description: string
  category: AchievementCategory
  stat: AchievementStat
  goal: number
  reward: AchievementReward
}

const item = (itemId: string, count = 1): { itemId: string; count: number } => ({ itemId, count })

export const ACHIEVEMENTS: AchievementDef[] = [
  // Battle
  {
    id: 'win1',
    name: 'First Victory',
    description: 'Win a battle',
    category: 'Battle',
    stat: 'battlesWon',
    goal: 1,
    reward: { money: 500 }
  },
  {
    id: 'win50',
    name: 'Getting Stronger',
    description: 'Win 50 battles',
    category: 'Battle',
    stat: 'battlesWon',
    goal: 50,
    reward: { items: [item('rarecandy', 3)] }
  },
  {
    id: 'win250',
    name: 'Seasoned Battler',
    description: 'Win 250 battles',
    category: 'Battle',
    stat: 'battlesWon',
    goal: 250,
    reward: { items: [item('expcandym', 2)], keyItems: ['expcharm'] }
  },
  {
    id: 'win1000',
    name: 'Battle Legend',
    description: 'Win 1,000 battles',
    category: 'Battle',
    stat: 'battlesWon',
    goal: 1000,
    reward: { items: [item('expcandyl', 2)], title: 'Veteran' }
  },
  {
    id: 'trainers25',
    name: 'Trainer Tamer',
    description: 'Defeat 25 trainers',
    category: 'Battle',
    stat: 'trainersDefeated',
    goal: 25,
    reward: { items: [item('lockcapsule', 2)] }
  },
  {
    id: 'trainers100',
    name: 'Ace Trainer',
    description: 'Defeat 100 trainers',
    category: 'Battle',
    stat: 'trainersDefeated',
    goal: 100,
    reward: { items: [item('randompokemon')], title: 'Ace Trainer' }
  },
  {
    id: 'badge1',
    name: 'First Badge',
    description: 'Beat your first gym leader',
    category: 'Battle',
    stat: 'gymBadges',
    goal: 1,
    reward: { items: [item('rarecandy', 5)] }
  },
  {
    id: 'badge8',
    name: 'Badge Collector',
    description: 'Beat all eight gym leaders',
    category: 'Battle',
    stat: 'gymBadges',
    goal: 8,
    reward: { items: [item('randompokemon', 2)], title: 'Badge Collector' }
  },
  {
    id: 'elitefour',
    name: 'Elite Challenger',
    description: 'Defeat all four of the Elite Four',
    category: 'Battle',
    stat: 'eliteFour',
    goal: 4,
    reward: { items: [item('shinypatch')], keyItems: ['itemcharm'] }
  },
  {
    id: 'champion',
    name: 'Champion',
    description: 'Defeat the Champion',
    category: 'Battle',
    stat: 'champion',
    goal: 1,
    reward: { items: [item('randomlegendary')], title: 'Champion' }
  },

  // Collection
  {
    id: 'catch1',
    name: 'Gotcha!',
    description: 'Catch a wild Pokémon',
    category: 'Collection',
    stat: 'wildCaught',
    goal: 1,
    reward: { items: [item('pokeball', 10)] }
  },
  {
    id: 'catch50',
    name: 'Pokémon Catcher',
    description: 'Catch 50 wild Pokémon',
    category: 'Collection',
    stat: 'wildCaught',
    goal: 50,
    reward: { items: [item('lockcapsule', 2)] }
  },
  {
    id: 'catch250',
    name: 'Pokémon Hunter',
    description: 'Catch 250 wild Pokémon',
    category: 'Collection',
    stat: 'wildCaught',
    goal: 250,
    reward: { items: [item('randompokemon')], keyItems: ['catchingcharm'] }
  },
  {
    id: 'catch1000',
    name: 'Gotta Catch Em All',
    description: 'Catch 1,000 wild Pokémon',
    category: 'Collection',
    stat: 'wildCaught',
    goal: 1000,
    reward: { items: [item('randomlegendary')], title: 'Collector' }
  },
  {
    id: 'dex50',
    name: 'Budding Researcher',
    description: 'Register 50 Pokémon in the Pokédex',
    category: 'Collection',
    stat: 'dexSpecies',
    goal: 50,
    reward: { items: [item('rarecandy', 5)] }
  },
  {
    id: 'dex151',
    name: 'Kanto Complete?',
    description: 'Register 151 Pokémon in the Pokédex',
    category: 'Collection',
    stat: 'dexSpecies',
    goal: 151,
    reward: { items: [item('randompokemon')] }
  },
  {
    id: 'dex400',
    name: 'Pokédex Scholar',
    description: 'Register 400 Pokémon in the Pokédex',
    category: 'Collection',
    stat: 'dexSpecies',
    goal: 400,
    reward: { items: [item('shinypatch')] }
  },
  {
    id: 'dex800',
    name: 'Professor',
    description: 'Register 800 Pokémon in the Pokédex',
    category: 'Collection',
    stat: 'dexSpecies',
    goal: 800,
    reward: { items: [item('randomlegendary')], title: 'Professor', keyItems: ['shinycharm'] }
  },
  {
    id: 'forms25',
    name: 'Shape Shifter',
    description: 'Register 25 alternate forms in the Pokédex',
    category: 'Collection',
    stat: 'dexForms',
    goal: 25,
    reward: { items: [item('lockcapsule', 3)] }
  },
  {
    id: 'shiny1',
    name: 'Something Sparkly',
    description: 'Own a shiny Pokémon',
    category: 'Collection',
    stat: 'shinyOwned',
    goal: 1,
    reward: { items: [item('lockcapsule')] }
  },
  {
    id: 'shiny10',
    name: 'Shiny Hunter',
    description: 'Own 10 shiny Pokémon at once',
    category: 'Collection',
    stat: 'shinyOwned',
    goal: 10,
    reward: { items: [item('shinypatch')], title: 'Shiny Hunter' }
  },
  {
    id: 'legendary1',
    name: 'Myth or Legend',
    description: 'Own a legendary, mythical, Ultra Beast or Paradox Pokémon',
    category: 'Collection',
    stat: 'legendaryOwned',
    goal: 1,
    reward: { items: [item('rarecandy', 5)] }
  },
  {
    id: 'restricted1',
    name: 'Legend Keeper',
    description: 'Own a box legendary (Mewtwo, Kyogre, Koraidon...)',
    category: 'Collection',
    stat: 'restrictedOwned',
    goal: 1,
    reward: { coins: 500, title: 'Legend Keeper' }
  },
  {
    id: 'rotom',
    name: 'Plugged In',
    description: 'Own a Rotom (any form)',
    category: 'Collection',
    stat: 'rotomOwned',
    goal: 1,
    reward: { keyItems: ['rotomcatalog'] }
  },
  {
    id: 'necrozma',
    name: 'Prism Power',
    description: 'Own a Necrozma (any form)',
    category: 'Collection',
    stat: 'necrozmaOwned',
    goal: 1,
    reward: { keyItems: ['nsolarizer', 'nlunarizer'] }
  },
  {
    id: 'kyurem',
    name: 'Boundary Breaker',
    description: 'Own a Kyurem (any form)',
    category: 'Collection',
    stat: 'kyuremOwned',
    goal: 1,
    reward: { keyItems: ['dnasplicers'] }
  },
  {
    id: 'calyrex',
    name: 'Bountiful Harvest',
    description: 'Own a Calyrex (any form)',
    category: 'Collection',
    stat: 'calyrexOwned',
    goal: 1,
    reward: { keyItems: ['reinsofunity'] }
  },
  {
    id: 'hoopa',
    name: 'Mischief Unbound',
    description: 'Own a Hoopa (any form)',
    category: 'Collection',
    stat: 'hoopaOwned',
    goal: 1,
    reward: { keyItems: ['prisonbottle'] }
  },
  {
    id: 'forces',
    name: 'Forces of Nature',
    description: 'Own a Tornadus, Thundurus, Landorus or Enamorus',
    category: 'Collection',
    stat: 'forcesOwned',
    goal: 1,
    reward: { keyItems: ['revealglass'] }
  },
  {
    id: 'shaymin',
    name: 'Gratitude in Bloom',
    description: 'Own a Shaymin (any form)',
    category: 'Collection',
    stat: 'shayminOwned',
    goal: 1,
    reward: { keyItems: ['gracidea'] }
  },
  {
    id: 'deoxys',
    name: 'Visitor from Space',
    description: 'Own a Deoxys (any form)',
    category: 'Collection',
    stat: 'deoxysOwned',
    goal: 1,
    reward: { keyItems: ['meteorite'] }
  },
  {
    id: 'bestfriend',
    name: 'Best Friends',
    description: "Max out a Pokémon's friendship - unlocks a companion slot beside your team",
    category: 'Collection',
    stat: 'maxFriendship',
    goal: 1,
    reward: { money: 5000 }
  },
  {
    id: 'alcremie',
    name: 'Sweet Tooth',
    description: 'Register every Alcremie form in the Pokédex',
    category: 'Collection',
    stat: 'alcremieForms',
    goal: 9,
    reward: { keyItems: ['decorationbox'] }
  },
  {
    id: 'minior',
    name: 'Shooting Stars',
    description: 'Collect every Minior core color',
    category: 'Collection',
    stat: 'miniorColors',
    goal: 7,
    reward: { money: 10000 }
  },
  {
    id: 'pikachu',
    name: 'Dress-Up Party',
    description: 'Own 3 different Pikachu forms at once (a plain Pikachu counts as one)',
    category: 'Collection',
    stat: 'pikachuForms',
    goal: 3,
    reward: { keyItems: ['fashioncase'] }
  },
  {
    id: 'zygarde',
    name: 'Order Keeper',
    description: 'Own a Zygarde (any form)',
    category: 'Collection',
    stat: 'zygardeOwned',
    goal: 1,
    reward: { keyItems: ['zygardecube'] }
  },
  {
    id: 'evolve1',
    name: 'What?',
    description: 'Evolve a Pokémon',
    category: 'Collection',
    stat: 'evolutions',
    goal: 1,
    reward: { money: 1000 }
  },
  {
    id: 'evolve50',
    name: 'Evolution Expert',
    description: 'Evolve 50 Pokémon',
    category: 'Collection',
    stat: 'evolutions',
    goal: 50,
    reward: { items: [item('expcandym', 2)], keyItems: ['friendshipcharm'] }
  },
  {
    id: 'money100k',
    name: 'Well Off',
    description: 'Hold ₽100,000 at once',
    category: 'Collection',
    stat: 'money',
    goal: 100000,
    reward: { items: [item('lockcapsule', 3)] }
  },
  {
    id: 'money1m',
    name: 'Tycoon',
    description: 'Hold ₽1,000,000 at once',
    category: 'Collection',
    stat: 'money',
    goal: 1000000,
    reward: { title: 'Tycoon' }
  },

  // Roguelite
  {
    id: 'floor10',
    name: 'Delver',
    description: 'Reach floor 10 in a Roguelite run',
    category: 'Roguelite',
    stat: 'bestFloor',
    goal: 10,
    reward: { items: [item('rarecandy', 3)] }
  },
  {
    id: 'runwin1',
    name: 'Run Cleared',
    description: 'Clear a Roguelite run',
    category: 'Roguelite',
    stat: 'runsWon',
    goal: 1,
    reward: { items: [item('randompokemon')], title: 'Survivor' }
  },
  {
    id: 'runwin5',
    name: 'Speedrunner',
    description: 'Clear 5 Roguelite runs',
    category: 'Roguelite',
    stat: 'runsWon',
    goal: 5,
    reward: { items: [item('randomlegendary')] }
  },
  {
    id: 'hardrun',
    name: 'Daredevil',
    description: 'Clear a Roguelite run on Hard or Extreme',
    category: 'Roguelite',
    stat: 'hardRunsWon',
    goal: 1,
    reward: { items: [item('shinypatch')], title: 'Daredevil' }
  },

  // Draft
  {
    id: 'draft1',
    name: 'First Pick',
    description: 'Finish a draft',
    category: 'Draft',
    stat: 'draftsFinished',
    goal: 1,
    reward: { items: [item('rarecandy', 3)] }
  },
  {
    id: 'draftbest4',
    name: 'Halfway There',
    description: 'Reach 4 wins in a single draft',
    category: 'Draft',
    stat: 'draftBestWins',
    goal: 4,
    reward: { items: [item('expcandyl', 2)] }
  },
  {
    id: 'draftwins25',
    name: 'Gauntlet Runner',
    description: 'Win 25 draft battles',
    category: 'Draft',
    stat: 'draftBattlesWon',
    goal: 25,
    reward: { items: [item('randompokemon')] }
  },
  {
    id: 'draftflawless',
    name: 'Flawless',
    description: 'Win a draft battle without any of your Pokémon fainting',
    category: 'Draft',
    stat: 'flawlessDraftWins',
    goal: 1,
    reward: { items: [item('rarecandy', 5)] }
  },
  {
    id: 'draftperfect',
    name: 'Perfect Draft',
    description: 'Finish a draft 7-0',
    category: 'Draft',
    stat: 'perfectDrafts',
    goal: 1,
    reward: { items: [item('randomlegendary')], title: 'Grand Drafter' }
  },
  {
    id: 'draftformats',
    name: 'Two Formats',
    description: 'Win 7 battles in a singles draft and in a doubles draft',
    category: 'Draft',
    stat: 'draftFormatsPerfected',
    goal: 2,
    reward: { items: [item('randomlegendary')] }
  },
  {
    id: 'draftluckypack',
    name: 'Lucky Pack',
    description: 'Open a draft pack with a legendary-rarity card in it',
    category: 'Draft',
    stat: 'luckyPacks',
    goal: 1,
    reward: { items: [item('randompokemon')] }
  },
  {
    id: 'draftgoldenhand',
    name: 'Golden Hand',
    description: 'Draft 3 legendary-rarity Pokémon in one draft',
    category: 'Draft',
    stat: 'draftBestLegendaries',
    goal: 3,
    reward: { items: [item('randomlegendary')] }
  },
  {
    id: 'draftubers',
    name: 'Ubers Champion',
    description: 'Win 7 battles in a singles draft with Ubers and OU',
    category: 'Draft',
    stat: 'ubersPerfectDrafts',
    goal: 1,
    reward: { items: [item('wishingpiece')] }
  },
  {
    id: 'draftunderdog',
    name: 'Underdog',
    description: 'Win 7 battles in a singles draft with ZU',
    category: 'Draft',
    stat: 'zuPerfectDrafts',
    goal: 1,
    reward: { items: [item('shinypatch')] }
  },

  // Game Corner
  {
    id: 'spins100',
    name: 'Regular',
    description: 'Spin the slots 100 times',
    category: 'Game Corner',
    stat: 'slotSpins',
    goal: 100,
    reward: { coins: 100 }
  },
  {
    id: 'spins1000',
    name: 'Slot Addict',
    description: 'Spin the slots 1,000 times',
    category: 'Game Corner',
    stat: 'slotSpins',
    goal: 1000,
    reward: { coins: 500 }
  },
  {
    id: 'jackpot',
    name: 'Golden Touch',
    description: 'Hit the Gholdengo jackpot',
    category: 'Game Corner',
    stat: 'jackpots',
    goal: 1,
    reward: { coins: 1000, title: 'Golden Touch' }
  },
  {
    id: 'slotwins10k',
    name: 'High Roller',
    description: 'Win 10,000 coins from the slots in total',
    category: 'Game Corner',
    stat: 'slotCoinsWon',
    goal: 10000,
    reward: { title: 'High Roller' }
  },
  {
    id: 'bjwin25',
    name: 'Card Shark',
    description: 'Win 25 hands of blackjack',
    category: 'Game Corner',
    stat: 'blackjackWins',
    goal: 25,
    reward: { coins: 250 }
  },
  {
    id: 'natural',
    name: 'Twenty-One',
    description: 'Get a blackjack',
    category: 'Game Corner',
    stat: 'naturalBlackjacks',
    goal: 1,
    reward: { coins: 100, title: '9+10' }
  },
  {
    id: 'roulette100',
    name: 'Round and Round',
    description: 'Spin the roulette wheel 100 times',
    category: 'Game Corner',
    stat: 'rouletteSpins',
    goal: 100,
    reward: { coins: 100, title: 'Croupier' }
  },
  {
    id: 'luckynumber',
    name: 'Lucky Number',
    description: 'Win a roulette bet on a single number',
    category: 'Game Corner',
    stat: 'rouletteNumberWins',
    goal: 1,
    reward: { coins: 250 }
  },
  {
    id: 'plinko500',
    name: 'Ball Dropper',
    description: 'Drop 500 balls in Plinko',
    category: 'Game Corner',
    stat: 'plinkoDrops',
    goal: 500,
    reward: { coins: 250 }
  },
  {
    id: 'plinkoedge',
    name: 'Edge Case',
    description: "Land a Plinko ball in one of the edge slots",
    category: 'Game Corner',
    stat: 'plinkoEdges',
    goal: 1,
    reward: { coins: 500, title: 'Edge Lord' }
  },

  // Merges & Raids
  {
    id: 'merge1',
    name: 'Better Together',
    description: 'Merge a Pokémon',
    category: 'Merges & Raids',
    stat: 'pokemonMerged',
    goal: 1,
    reward: { money: 1000 }
  },
  {
    id: 'star3',
    name: 'Rising Star',
    description: 'Merge a Pokémon up to ★3',
    category: 'Merges & Raids',
    stat: 'mergedStars',
    goal: 3,
    reward: { items: [item('wishingpiece', 2)] }
  },
  {
    id: 'star5',
    name: 'Superstar',
    description: 'Merge a Pokémon up to ★5',
    category: 'Merges & Raids',
    stat: 'mergedStars',
    goal: 5,
    reward: { title: 'Five-Star' }
  },
  {
    id: 'merge50',
    name: 'Fusion Lab',
    description: 'Merge 50 duplicates',
    category: 'Merges & Raids',
    stat: 'pokemonMerged',
    goal: 50,
    reward: { money: 10000, items: [item('randompokemon')] }
  },
  {
    id: 'merge250',
    name: 'Alchemist',
    description: 'Merge 250 duplicates',
    category: 'Merges & Raids',
    stat: 'pokemonMerged',
    goal: 250,
    reward: { title: 'Alchemist' }
  },
  {
    id: 'raid1',
    name: 'Wish Upon a Star',
    description: 'Win a Max Raid',
    category: 'Merges & Raids',
    stat: 'raidsWon',
    goal: 1,
    reward: { items: [item('wishingpiece')] }
  },
  {
    id: 'raid10',
    name: 'Raid Regular',
    description: 'Win 10 Max Raids',
    category: 'Merges & Raids',
    stat: 'raidsWon',
    goal: 10,
    reward: { items: [item('wishingpiece', 3)] }
  },
  {
    id: 'raid50',
    name: 'Raid Leader',
    description: 'Win 50 Max Raids',
    category: 'Merges & Raids',
    stat: 'raidsWon',
    goal: 50,
    reward: { title: 'Raid Leader' }
  },
  {
    id: 'gmax1',
    name: 'Gigantic!',
    description: 'Own a Gigantamax Pokémon',
    category: 'Merges & Raids',
    stat: 'gmaxSpecies',
    goal: 1,
    reward: { items: [item('wishingpiece', 2)] }
  },
  {
    id: 'gmax10',
    name: 'G-Max Collector',
    description: 'Own 10 different Gigantamax species',
    category: 'Merges & Raids',
    stat: 'gmaxSpecies',
    goal: 10,
    reward: { title: 'Gigantamax Hunter' }
  },
  {
    id: 'goldraid',
    name: 'Legend of the Den',
    description: 'Win a Max Raid against a gold boss',
    category: 'Merges & Raids',
    stat: 'goldRaidsWon',
    goal: 1,
    reward: { items: [item('randomlegendary')] }
  },

  {
    id: 'daily7',
    name: 'Daily Grind',
    description: 'Finish all three daily missions on 7 days',
    category: 'Collection',
    stat: 'dailySetsCompleted',
    goal: 7,
    reward: { title: 'Diligent' }
  },

  // TMs
  {
    id: 'tmsearch1',
    name: 'Rummager',
    description: 'Find a TM by searching',
    category: 'TMs',
    stat: 'tmSearches',
    goal: 1,
    reward: { money: 1000 }
  },
  {
    id: 'tmsearch100',
    name: 'Treasure Hunter',
    description: 'Find 100 TMs by searching',
    category: 'TMs',
    stat: 'tmSearches',
    goal: 100,
    reward: { money: 10000 }
  },
  {
    id: 'tmgold',
    name: 'Golden Find',
    description: 'Find a gold TM',
    category: 'TMs',
    stat: 'legendaryTmsFound',
    goal: 1,
    reward: { title: 'Prospector' }
  },
  {
    id: 'tmareas',
    name: 'Explorer',
    description: 'Search for TMs in all 7 areas',
    category: 'TMs',
    stat: 'tmAreasSearched',
    goal: 7,
    reward: { money: 5000 }
  },
  {
    id: 'labsearch25',
    name: 'Lab Rat',
    description: 'Find 25 TMs by searching the Lab',
    category: 'TMs',
    stat: 'labSearches',
    goal: 25,
    reward: { items: [item('randomlegendary')] }
  },
  {
    id: 'tmowned50',
    name: 'Move Tutor',
    description: 'Own 50 TMs',
    category: 'TMs',
    stat: 'tmsOwned',
    goal: 50,
    reward: { money: 5000 }
  },
  {
    id: 'tmowned250',
    name: 'Technical Machine',
    description: 'Own 250 TMs',
    category: 'TMs',
    stat: 'tmsOwned',
    goal: 250,
    reward: { title: 'Walking Disc' }
  },
  {
    id: 'tmtype',
    name: 'Complete Set',
    description: 'Own every TM of one type',
    category: 'TMs',
    stat: 'tmTypesCompleted',
    goal: 1,
    reward: { title: 'Specialist' }
  },
  {
    id: 'greats500',
    name: 'Steady Hands',
    description: 'Hit 500 Greats in skill checks',
    category: 'TMs',
    stat: 'skillGreats',
    goal: 500,
    reward: { title: 'Steady Hands' }
  },
  {
    id: 'flawlesssearch',
    name: 'Flawless Search',
    description: 'Finish a TM search with every check a Great',
    category: 'TMs',
    stat: 'flawlessSearches',
    goal: 1,
    reward: { money: 3000 }
  },
  {
    id: 'flawlessgold',
    name: 'Perfectionist',
    description: 'Finish a gold TM search with every check a Great',
    category: 'TMs',
    stat: 'flawlessLegendarySearches',
    goal: 1,
    reward: { title: 'Hex Master' }
  },
  {
    id: 'greatstreak',
    name: 'On a Roll',
    description: 'Hit 10 Greats in a row in skill checks',
    category: 'TMs',
    stat: 'bestGreatStreak',
    goal: 10,
    reward: { title: 'Unstoppable' }
  },

  // Secret: shown as ??? until unlocked.
  {
    id: 'mergeshiny',
    name: 'All That Glitters',
    description: 'Make a Pokémon shiny by merging a shiny into it',
    category: 'Secret',
    stat: 'mergeShinied',
    goal: 1,
    reward: { items: [item('shinypatch')] }
  },
  {
    id: 'flawlessraid',
    name: 'Flawless Raid',
    description: 'Win a Max Raid without any of your Pokémon fainting',
    category: 'Secret',
    stat: 'flawlessRaids',
    goal: 1,
    reward: { coins: 5000 }
  },
  {
    id: 'shinyraid',
    name: 'Wish Come True',
    description: 'Catch a shiny raid boss',
    category: 'Secret',
    stat: 'shinyRaidCatches',
    goal: 1,
    reward: { title: 'Starlight' }
  },
  {
    id: 'sellshiny',
    name: 'Heartless',
    description: 'Sell a shiny Pokémon',
    category: 'Secret',
    stat: 'shinySold',
    goal: 1,
    reward: { title: 'Heartless' }
  },
  {
    id: 'sell100',
    name: 'Pokémon Broker',
    description: 'Sell 100 Pokémon',
    category: 'Secret',
    stat: 'pokemonSold',
    goal: 100,
    reward: { money: 5000, title: 'Broker' }
  },
  {
    id: 'earlyloss',
    name: 'Try Again',
    description: 'Lose a Roguelite run before floor 5',
    category: 'Secret',
    stat: 'earlyRunLosses',
    goal: 1,
    reward: { items: [item('rarecandy')] }
  },
  {
    id: 'tmambush',
    name: 'Rude Awakening',
    description: 'Wake a wild Pokémon while searching for a TM',
    category: 'Secret',
    stat: 'tmAmbushes',
    goal: 1,
    reward: { title: 'Light Sleeper' }
  },
  {
    id: 'afk',
    name: 'Asleep at the Wheel',
    description: 'Let a skill check run out 10 times',
    category: 'Secret',
    stat: 'skillTimeouts',
    goal: 10,
    reward: { title: 'AFK' }
  }
]

export interface AchievementView extends AchievementDef {
  progress: number
  unlocked: boolean
  claimed: boolean
}

export interface AchievementsState {
  achievements: AchievementView[]
  // The title shown beside the player's name, if they've picked one - just for show.
  title: string | null
  // The claimed titles turned off - every other claimed title's perk works.
  disabled: string[]
  // Every title they've claimed.
  titles: string[]
}

export interface AchievementClaimResult {
  state: AchievementsState
  // The reward as a line of text ("3× Rare Candy, ₽500").
  rewardText: string
  money: number
}
