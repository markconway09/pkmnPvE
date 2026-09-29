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
  | 'money'
  | 'evolutions'
  | 'pokemonSold'
  | 'shinySold'
  // Roguelite.
  | 'bestFloor'
  | 'runsWon'
  | 'hardRunsWon'
  | 'earlyRunLosses'
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

export type AchievementCategory = 'Battle' | 'Collection' | 'Roguelite' | 'Game Corner' | 'Secret'
export const ACHIEVEMENT_CATEGORIES: AchievementCategory[] = [
  'Battle',
  'Collection',
  'Roguelite',
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
    reward: { coins: 100 }
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

  // Secret: shown as ??? until unlocked.
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
  }
]

export interface AchievementView extends AchievementDef {
  progress: number
  unlocked: boolean
  claimed: boolean
}

export interface AchievementsState {
  achievements: AchievementView[]
  // The title shown beside the player's name, if they've picked one.
  title: string | null
  // Every title they've claimed.
  titles: string[]
}

export interface AchievementClaimResult {
  state: AchievementsState
  // The reward as a line of text ("3× Rare Candy, ₽500").
  rewardText: string
  money: number
}
