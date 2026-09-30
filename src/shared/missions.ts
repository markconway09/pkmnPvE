// Daily missions: three a day (one easy, one medium, one hard), rolled fresh at local
// midnight. Each counts one of the player's tallies up to its goal and pays out when
// claimed; finishing all three pays a bonus on top. Shared by the main process (which
// rolls, tracks and pays them - see mission-store.ts) and the renderer (which lists them).

export type MissionTier = 'easy' | 'medium' | 'hard'
export const MISSION_TIERS: MissionTier[] = ['easy', 'medium', 'hard']

// What a mission counts. Classic battles and Roguelite runs are counted separately.
export type MissionStat =
  | 'wildWins'
  | 'trainerWins'
  | 'bossWins'
  | 'catches'
  | 'raidsWon'
  | 'evolutions'
  | 'merges'
  | 'sold'
  | 'slotSpins'
  | 'blackjackWins'
  | 'rouletteSpins'
  | 'plinkoDrops'
  | 'runFloors'
  | 'runTrainerWins'
  | 'runBossWins'

export interface MissionReward {
  money?: number
  coins?: number
  items?: { itemId: string; count: number }[]
}

export interface MissionTemplate {
  id: string
  tier: MissionTier
  text: string
  stat: MissionStat
  goal: number
  reward: MissionReward
  // Only rolled once Max Raids are open.
  needsRaids?: boolean
}

const item = (itemId: string, count = 1): { itemId: string; count: number } => ({ itemId, count })

export const MISSION_TEMPLATES: MissionTemplate[] = [
  // Easy
  { id: 'wild5', tier: 'easy', text: 'Win 5 wild battles', stat: 'wildWins', goal: 5, reward: { money: 2000 } },
  { id: 'catch3', tier: 'easy', text: 'Catch 3 wild Pokémon', stat: 'catches', goal: 3, reward: { money: 2000 } },
  { id: 'slots20', tier: 'easy', text: 'Spin the slots 20 times', stat: 'slotSpins', goal: 20, reward: { coins: 200 } },
  { id: 'roulette10', tier: 'easy', text: 'Spin the roulette wheel 10 times', stat: 'rouletteSpins', goal: 10, reward: { coins: 200 } },
  { id: 'plinko25', tier: 'easy', text: 'Drop 25 Plinko balls', stat: 'plinkoDrops', goal: 25, reward: { coins: 200 } },
  { id: 'sell5', tier: 'easy', text: 'Sell 5 Pokémon', stat: 'sold', goal: 5, reward: { money: 2000 } },
  { id: 'runfloors5', tier: 'easy', text: 'Clear 5 Roguelite floors', stat: 'runFloors', goal: 5, reward: { money: 2000 } },

  // Medium
  { id: 'trainers3', tier: 'medium', text: 'Beat 3 trainers', stat: 'trainerWins', goal: 3, reward: { items: [item('expcandym', 2)] } },
  { id: 'blackjack3', tier: 'medium', text: 'Win 3 hands of blackjack', stat: 'blackjackWins', goal: 3, reward: { coins: 500 } },
  { id: 'evolve1', tier: 'medium', text: 'Evolve a Pokémon', stat: 'evolutions', goal: 1, reward: { items: [item('rarecandy', 3)] } },
  { id: 'merge1', tier: 'medium', text: 'Merge a Pokémon', stat: 'merges', goal: 1, reward: { items: [item('rarecandy', 3)] } },
  { id: 'wild15', tier: 'medium', text: 'Win 15 wild battles', stat: 'wildWins', goal: 15, reward: { items: [item('expcandym', 2)] } },
  { id: 'runtrainers3', tier: 'medium', text: 'Beat 3 trainers in Roguelite runs', stat: 'runTrainerWins', goal: 3, reward: { coins: 500 } },

  // Hard
  { id: 'boss1', tier: 'hard', text: 'Beat a boss (rematches count)', stat: 'bossWins', goal: 1, reward: { items: [item('randompokemon')] } },
  { id: 'raid1', tier: 'hard', text: 'Win a Max Raid', stat: 'raidsWon', goal: 1, reward: { items: [item('randompokemon')] }, needsRaids: true },
  { id: 'trainers10', tier: 'hard', text: 'Beat 10 trainers', stat: 'trainerWins', goal: 10, reward: { items: [item('lockcapsule', 2)] } },
  { id: 'runfloors15', tier: 'hard', text: 'Clear 15 Roguelite floors', stat: 'runFloors', goal: 15, reward: { items: [item('expcandyl')] } },
  { id: 'runboss1', tier: 'hard', text: 'Beat a boss in a Roguelite run', stat: 'runBossWins', goal: 1, reward: { items: [item('randompokemon')] } }
]

// Finishing all three of the day's missions.
export const DAILY_BONUS_REWARD: MissionReward = { items: [item('wishingpiece', 2)] }
// Swapping a mission the player doesn't want for another of the same difficulty.
export const DAILY_REROLLS = 1

export interface MissionView {
  // Its place in the day's list (0 easy, 1 medium, 2 hard).
  slot: number
  templateId: string
  tier: MissionTier
  text: string
  goal: number
  progress: number
  reward: MissionReward
  claimed: boolean
}

export interface MissionsState {
  // The local date these are for ("2026-09-30").
  day: string
  missions: MissionView[]
  rerollsLeft: number
  // All three finished - the bonus can be claimed.
  bonusReady: boolean
  bonusClaimed: boolean
  bonusReward: MissionReward
  // Until the next day's missions (local midnight).
  msUntilReset: number
}

export interface MissionClaimResult {
  state: MissionsState
  // The reward as a line of text ("2× Exp. Candy M").
  rewardText: string
  money: number
}
