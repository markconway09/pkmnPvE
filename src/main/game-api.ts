/**
 * Every call the game's screens make, by channel name, with no Electron in sight:
 * the desktop build hands them to ipcMain (index.ts), the mobile build calls them
 * straight from the page. A handler's first argument is the caller - only used to
 * push the online battle's screens back to the one that started it.
 */
import { appVersion } from './platform'
import type {
  BattleEligibility,
  BossRematchInfo,
  RunChoiceResult,
  RunDifficulty,
  RunConsumableId,
  RunShopTile,
  RunMonEdit,
  RunView,
  BossStep,
  EditablePokemonSet,
  ItemDropConfig,
  NextBossInfo,
  Trainer
} from '../shared/battle-types'
import type {
  ItemQuantity,
  CompanionSizeChoice,
  MergeBoosts,
  WildLocationId
} from '../shared/battle-types'
import {
  WILD_LOCATIONS,
  rollWildWeather,
  WILD_RANDOM_DROP_CHANCE,
  WISHING_PIECE_ITEM_ID,
  FRIENDSHIP_PETAL_DROP_CHANCE,
  FRIENDSHIP_PETAL_ITEM_ID,
  normalizeUsername,
  usernameProblem
} from '../shared/battle-types'
import { WildBattle, getMoveInfo } from './showdown/battle-runtime'
import { exportSaveFile, importSaveFile } from './showdown/save-file'
import type {
  OnlinePlayer,
  OnlineSelf,
  OnlineDraftTeam,
  OnlineTeam,
  OnlineViews
} from '../shared/online'
import type { PokemonSet } from './showdown/sim-access'
import {
  addRandomMon,
  addMonOfSpecies,
  addStarter,
  evolveMon,
  getBoxState,
  sellMon,
  sellMons,
  getPokedex,
  getMonSet,
  getTeamPokemonSets,
  highestLevelOf,
  levelUpMon,
  setEverstone,
  toggleFavorite,
  setCompanion,
  returnCompanion,
  setCompanionSize,
  useShinyPatch,
  useFriendshipPetal,
  changeForm,
  fuseMon,
  unfuseMon,
  mergeMons,
  mergeSelectedMons,
  autoMergeMon,
  getTeamMergeStars,
  getTeamEverstones,
  readSavedTeamEverstonesOf,
  readSavedTeamMergeStarsOf,
  readSavedTeamOf,
  scaleTeamToLevel,
  resetBox,
  setTeam,
  updateMon,
  useExpCandy,
  useExpCandiesUntilCap,
  getRaidBossPreviews
} from './showdown/box-store'
import {
  getBagItemView,
  getBagState,
  getItemQuantity,
  hasItem,
  removeItem,
  resetBag
} from './showdown/bag-store'
import {
  debugRaidBoss,
  generateRaidBoss,
  raidBossKindOdds,
  type RaidBoss
} from './showdown/raid'
import {
  claimMission,
  claimMissionBonus,
  getMissions,
  rerollMission
} from './showdown/mission-store'
import {
  applyLoadout,
  deleteLoadout,
  listLoadouts,
  renameLoadout,
  saveLoadout,
  updateLoadout
} from './showdown/loadout-store'
import {
  listAllAbilities,
  generateRandomTrainerTeam,
  generateLabWildMon,
  generateRandomWildMon,
  getEditorOptions,
  getSpeciesEditInfo,
  hasFriendshipEvolution
} from './showdown/sim-access'
import {
  addTrainer,
  deleteTrainer,
  duplicateTrainer,
  listTrainers,
  updateTrainer
} from './showdown/trainer-store'
import {
  addPremadeTeam,
  addSpeciesToTeam,
  deletePremadeTeam,
  deleteTeamsForTrainer,
  copyTeamsToTrainer,
  duplicatePremadeTeam,
  getTeamMonSet,
  listPremadeTeams,
  listPremadeTeamsForTrainer,
  pickRandomPremadeTeam,
  removeMonFromTeam,
  reorderTeamMons,
  renamePremadeTeam,
  setPremadeTeamDoubleBattle,
  setPremadeTeamDrop,
  updateTeamMon
} from './showdown/premade-teams-store'
import {
  getNextBoss,
  getProgression,
  resetProgression,
  removeFromBossOrder,
  setBossOrder,
  setLevelCap,
  lateItemsUnlocked
} from './showdown/progression-store'
import { getMoney, resetMoney, setMoney } from './showdown/money-store'
import {
  buyCoinPrize,
  buyCoins,
  buyDailyCoinMon,
  buyDailyCoinOffer,
  buyPetalPack,
  claimFreePetals,
  getCoins,
  getDailyCoinMon,
  getDailyCoinOffer,
  getDailyPetalDeals,
  getDailyPrizesBought,
  getSlotRules,
  setCoins,
  spinSlots
} from './showdown/game-corner-store'
import {
  abandonTmSearch,
  buyScanner,
  buyTmFromShop,
  getTmCatalog,
  getTmShop,
  getTmState,
  reportTmSearchCheck,
  startTmSearch,
  takeTmAmbush,
  takeTmQuickCheck,
  withTmLocks,
  tmSearchRarityOdds
} from './showdown/tm-store'
import type { SkillCheckResult } from '../shared/tms'
import {
  dealBlackjack,
  doubleBlackjack,
  getBlackjackView,
  hitBlackjack,
  standBlackjack
} from './showdown/blackjack-store'
import { rollDice } from './showdown/dice-store'
import { resetStatsCounters } from './showdown/stats-store'
import { getRouletteHistory, spinRoulette } from './showdown/roulette-store'
import { dropPlinko } from './showdown/plinko-store'
import { getGameCornerPerks } from './showdown/title-perks'
import type { PlinkoRisk } from '../shared/plinko'
import {
  checkAchievements,
  claimAchievement,
  getAchievements,
  setAchievementTitle,
  setTitleActive
} from './showdown/achievement-store'
import { getTrainerProfile } from './showdown/trainer-profile'
import { buildAutoSet, listAutoSets } from './showdown/auto-sets'
import {
  completeRunGenerations,
  runChoiceAt,
  evolveRunMon,
  forfeitRun,
  getRunView,
  giveRunItem,
  moveRunItem,
  placeDisplacedItem,
  rerollRunItems,
  reorderRunTeam,
  skipRunItem,
  startRun,
  takeHealNode,
  takeItemNode,
  takePickNode,
  takeSwapNode,
  swapRunMon,
  swapRunTeam,
  skipRunSwap,
  takeRunRewardMon,
  skipRunRewardMon,
  useRunFullRestore,
  useRunRevive,
  useRunAbilityCapsule,
  resetRunAbility,
  buyRunConsumable,
  buyRunRareCandy,
  buyRunShopTile,
  previewStarterMoves,
  previewEvolutionMoves,
  getRunMonEditInfo,
  runSmogonSet,
  updateRunMon,
  giveRunAbility,
  teachRunMove,
  skipRunPick
} from './showdown/run-store'
import { createRunBattle } from './showdown/run-battles'
import { getWildDropFor, listWildDrops, setWildDrop } from './showdown/wild-drops-store'
import {
  getDexNavState,
  listDexNavCandidates,
  rollDexNavEncounter,
  setDexNavTarget
} from './showdown/dexnav-store'
import {
  buyItem,
  listShop,
  listKeyItems,
  listShopPrices,
  quickSellSelection,
  sellItem,
  sellItems,
  setShopPrice
} from './showdown/shop-store'
import { getGalarFossilPartners, restoreFossil } from './showdown/fossil-store'
import { openBagItem, openItemRarityOdds } from './showdown/open-item-store'
import type { RarityOddsSource } from '../shared/rarity'
import { eligibleRandomTrainers, isRocketEventActive } from './showdown/trainer-selection'
import {
  abandonDraft,
  beginDraftBattle,
  chaosAbilityChoices,
  chaosItemChoices,
  chaosTutorMoves,
  chooseChaosModifier,
  draftEntryFee,
  getDraftView,
  draftDailyWinClaimed,
  pickDraftMon,
  rerollDraftPack,
  swapChaosItem,
  startDraft,
  beginOnlineDraftBattle,
  endOnlineDraft,
  finishOnlineDraftBattle,
  onlineDraftTeam,
  setOnlineDraftOpponent,
  startOnlineDraft
} from './showdown/draft-store'
import type { ChaosModifierTarget, DraftFormat } from '../shared/draft'
import {
  getPlayerSummary,
  isAdmin,
  getSessionInfo,
  login,
  logout,
  requireAdmin,
  setTrainerSprite
} from './showdown/player-session'

export interface GameCaller {
  sender: { send(channel: string, payload: unknown): void; isDestroyed(): boolean }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type GameHandler = (caller: GameCaller, ...args: any[]) => unknown

export const gameHandlers = new Map<string, GameHandler>()

function handle(channel: string, handler: GameHandler): void {
  gameHandlers.set(channel, handler)
}

let activeBattle: WildBattle | null = null

// Achievements are checked shortly after the renderer's calls - anything that changes a
// tally (a battle, a catch, a spin...) comes through one - batched, so a burst of calls
// (a battle's turns) costs one check, and off the reply's path.
let achievementCheck: ReturnType<typeof setTimeout> | null = null
export function scheduleAchievementCheck(): void {
  if (achievementCheck) return
  achievementCheck = setTimeout(() => {
    achievementCheck = null
    try {
      checkAchievements()
    } catch {
      // Nobody logged in (yet) - nothing to check.
    }
  }, 400)
}
handle('battle:start', async (_event, locationId?: WildLocationId, levelCapOverride?: number) => {
  const p1team = getTeamPokemonSets()
  if (p1team.length === 0) throw new Error('Your team is empty - add Pokemon and assign them to your team first')
  const levelCap = getProgression().levelCap
  // The slider only ever lowers the wild pool, never raises it past what the
  // player's actual progression allows - clamped here rather than trusting
  // whatever the renderer last had cached.
  const effectiveLevelCap =
    levelCapOverride != null ? Math.min(Math.max(15, Math.floor(levelCapOverride)), levelCap) : levelCap
  const location = WILD_LOCATIONS.find((l) => l.id === locationId) ?? null
  if (location?.requiresAllBosses && !allBossesDefeated()) {
    throw new Error(`${location.label} opens once every boss is beaten`)
  }
  // The DexNav's hunted Pokemon first, at its chain's chance - otherwise the usual roll.
  const huntedMon = rollDexNavEncounter(location, effectiveLevelCap)
  const wildMon =
    huntedMon ??
    (location?.id === 'lab' ? generateLabWildMon(effectiveLevelCap) : generateRandomWildMon(effectiveLevelCap, location))
  if (!wildMon) throw new Error('Could not find a wild Pokemon for your current level cap in that location')
  const wildDrop = getWildDropFor(wildMon.species)
  // A Pokemon with a friendship evolution can drop a Friendship Petal, on top of its own drop -
  // once petals are unlocked (a late game item).
  const petalDrop = hasFriendshipEvolution(wildMon.species) && lateItemsUnlocked()
  const wildDrops: ItemDropConfig[] = [
    ...(wildDrop ? [wildDrop] : []),
    ...(petalDrop ? [{ itemId: FRIENDSHIP_PETAL_ITEM_ID, chance: FRIENDSHIP_PETAL_DROP_CHANCE }] : [])
  ]
  activeBattle = new WildBattle(p1team, 'gen9customgame', 'gen9randombattle', {
    team: [wildMon],
    name: 'Wild',
    difficulty: 'easy',
    drops: wildDrops.length ? wildDrops : undefined,
    randomDropChance: WILD_RANDOM_DROP_CHANCE,
    location: location?.id ?? 'all',
    // Now and then the area's weather is up when the battle starts (never in the Cave or the Lab).
    startField: { weather: rollWildWeather(location?.id ?? 'all') },
    // A TM search that made too much noise: the Pokemon it woke won't let you run.
    noRun: takeTmAmbush(location?.id ?? 'all'),
    dexNavHunt: !!huntedMon
  }, { p1: getTeamMergeStars(), everstone: { p1: getTeamEverstones() } })
  return activeBattle.getInitialView()
})

handle('battle:startTrainer', async (_event, boss: boolean, rematchTrainerId?: string) => {
  const p1team = getTeamPokemonSets()
  if (p1team.length === 0) throw new Error('Your team is empty - add Pokemon and assign them to your team first')
  const progression = getProgression()
  const levelCap = progression.levelCap

  let trainer: Trainer | null = null
  if (boss && rematchTrainerId) {
    // A rematch from the boss menu: any boss in the order the player has already beaten.
    // Just for the fight - it pays nothing at all: no exp, money, drops, TMs, friendship,
    // mission or stat progress, and no boss progress.
    const inOrder = progression.bossOrder.some((step) => step.trainerId === rematchTrainerId)
    if (!inOrder || !progression.bossesDefeated.includes(rematchTrainerId)) {
      throw new Error('Only a boss you have already beaten can be rematched')
    }
    trainer = listTrainers().find((t) => t.id === rematchTrainerId) ?? null
    if (!trainer) throw new Error('That boss trainer no longer exists')
  } else if (boss) {
    const next = getNextBoss()
    if (!next) throw new Error('No boss trainer is queued up yet - add one in the Progression editor')
    if (progression.trainerWinsSinceLastBoss < next.requiredTrainerWins) {
      const remaining = next.requiredTrainerWins - progression.trainerWinsSinceLastBoss
      throw new Error(`Beat ${remaining} more trainer${remaining === 1 ? '' : 's'} before this boss will fight you`)
    }
    trainer = listTrainers().find((t) => t.id === next.trainerId) ?? null
    if (!trainer) throw new Error('The next boss trainer no longer exists')
  } else {
    const eligible = eligibleRandomTrainers(levelCap, p1team.length)
    if (eligible.length === 0) {
      throw new Error(isRocketEventActive() ? 'No Team Rocket trainers available right now' : 'No trainers available right now')
    }
    trainer = eligible[Math.floor(Math.random() * eligible.length)]
  }

  let teamDrop: ItemDropConfig | undefined
  let isDoubleBattle = false
  // A premade team's merge stars (random teams have none).
  let p2Stars: number[] = []
  const p2team =
    trainer.teamMode === 'random'
      ? generateRandomTrainerTeam({ count: 6, levelCap })
      : trainer.teamMode === 'monotype'
        ? generateRandomTrainerTeam({ count: 6, type: trainer.monotype ?? undefined, levelCap })
        : (() => {
            const selection = pickRandomPremadeTeam(trainer.id, levelCap, p1team.length, { anyLevel: trainer.isBoss })
            if (selection) {
              teamDrop = selection.drop
              isDoubleBattle = selection.isDoubleBattle
              p2Stars = selection.mergeStars
            }
            return selection?.sets ?? []
          })()
  if (p2team.length === 0) throw new Error(`${trainer.name}'s team is empty`)
  activeBattle = new WildBattle(p1team, isDoubleBattle ? 'gen9doublescustomgame' : 'gen9customgame', 'gen9randombattle', {
    team: p2team,
    name: trainer.name,
    difficulty: trainer.difficulty,
    trainerId: trainer.id,
    spriteId: trainer.spriteId,
    drops: trainer.drops,
    teamDrop,
    tmRewards: trainer.tmRewards,
    isBoss: trainer.isBoss,
    noRewards: !!(boss && rematchTrainerId),
    startField: trainer.isBoss
      ? { weather: trainer.fieldWeather, terrain: trainer.fieldTerrain, trickRoom: trainer.fieldTrickRoom }
      : undefined
  }, { p1: getTeamMergeStars(), p2: p2Stars, everstone: { p1: getTeamEverstones() } })
  return activeBattle.getInitialView()
})

// Another player's saved team, fought as a friendly match: they're not here to play it,
// so the AI drives it, at the hardest setting, with their real moves and items. Their whole
// team is set to the level of the challenger's highest-level Pokemon, up or down, so the
// match is even whatever levels the two saves are at. It never pays out - no exp, money, drops, friendship or boss progress.
// Singles or doubles, and with `stars` both sides get their merge star boosts.
handle('battle:startPlayer', async (_event, username: string, doubles = false, stars = false) => {
  const p1team = getTeamPokemonSets()
  if (p1team.length === 0) throw new Error('Your team is empty - add Pokemon and assign them to your team first')
  const problem = usernameProblem(username)
  if (problem) throw new Error(problem)
  const player = getPlayerSummary(username)
  if (!player) throw new Error(`No player named "${normalizeUsername(username)}" has a save on this computer`)
  const savedTeam = readSavedTeamOf(player.slug)
  if (savedTeam.length === 0) throw new Error(`${player.displayName} hasn't put any Pokemon on their team yet`)
  const p2team = scaleTeamToLevel(savedTeam, highestLevelOf(p1team))
  activeBattle = new WildBattle(p1team, doubles ? 'gen9doublescustomgame' : 'gen9customgame', 'gen9randombattle', {
    team: p2team,
    name: player.displayName,
    difficulty: 'hard',
    trainerId: `player:${player.slug}`,
    spriteId: player.trainerSprite ?? 'red',
    noRewards: true
  }, {
    // Merge star boosts only when asked for - otherwise it's fought on the sets alone.
    ...(stars ? { p1: getTeamMergeStars(), p2: readSavedTeamMergeStarsOf(player.slug) } : {}),
    everstone: { p1: getTeamEverstones(), p2: readSavedTeamEverstonesOf(player.slug) }
  })
  return activeBattle.getInitialView()
})

handle('battle:choose', async (_event, choice: string) => {
  if (!activeBattle) throw new Error('No active battle')
  return activeBattle.submitChoice(choice)
})

handle('battle:run', () => {
  if (!activeBattle) throw new Error('No active battle')
  activeBattle.runAway()
  activeBattle = null
})

// Gives up a draft match or a Roguelite fight - it plays out as a loss, end screen and all.
handle('battle:forfeit', () => {
  if (!activeBattle) throw new Error('No active battle')
  return activeBattle.forfeit()
})

handle('battle:catch', (_event, replaceRunMonId?: string) => {
  if (!activeBattle) throw new Error('No active battle')
  return activeBattle.catchWildPokemon(replaceRunMonId)
})

// ---- Online battles with a friend (the connection itself lives in the renderer, see online.ts) ----

// This player as the friend sees them, and their current team.
handle('online:self', (): OnlineSelf => {
  const session = getSessionInfo()
  if (!session.username) throw new Error('Log in first')
  return {
    player: { name: session.username, spriteId: session.trainerSprite ?? 'red', version: appVersion() },
    team: { team: getTeamPokemonSets(), mergeStars: getTeamMergeStars(), everstone: getTeamEverstones() }
  }
})

// The friend's team as their copy sent it - checked over, since it came over the network.
function readOnlineTeam(input: OnlineTeam): { team: PokemonSet[]; mergeStars: number[]; everstone: boolean[] } {
  const sets = Array.isArray(input?.team) ? input.team.slice(0, 6) : []
  const team = sets.filter(
    (set): set is PokemonSet =>
      !!set && typeof set === 'object' && typeof (set as PokemonSet).species === 'string' && Array.isArray((set as PokemonSet).moves)
  )
  if (team.length === 0) throw new Error("Your friend's team is empty")
  const stars = Array.isArray(input.mergeStars) ? input.mergeStars : []
  const everstone = Array.isArray(input.everstone) ? input.everstone : []
  return {
    team: team.map((set) => ({ ...set, level: Math.max(1, Math.min(100, Math.floor(Number(set.level) || 100))) })),
    mergeStars: team.map((_, i) => Math.max(0, Math.min(20, Math.floor(Number(stars[i]) || 0)))),
    everstone: team.map((_, i) => everstone[i] === true)
  }
}

let onlineBattle: WildBattle | null = null

function onlineViews(battle: WildBattle): OnlineViews {
  return { host: battle.onlineView(0), guest: battle.onlineView(1) }
}

// The host starting a battle with the friend: both teams set to the level of the
// higher-level one's best Pokemon, and nothing paid out (like a friendly match). Both
// screens are sent to the renderer each time the battle moves on. Singles or doubles, with
// or without both sides' merge star boosts, as the host picked.
handle('online:start', async (event, friend: OnlinePlayer, friendTeam: OnlineTeam, doubles: boolean, stars = false): Promise<OnlineViews> => {
  const session = getSessionInfo()
  if (!session.username) throw new Error('Log in first')
  const hostTeam = getTeamPokemonSets()
  if (hostTeam.length === 0) throw new Error('Your team is empty - add Pokemon and assign them to your team first')
  const guest = readOnlineTeam(friendTeam)
  const level = Math.max(highestLevelOf(hostTeam), highestLevelOf(guest.team))
  // The battle tells its two sides apart by name, so the friend can't share the host's.
  const friendName = String(friend?.name ?? 'Friend').slice(0, 24) || 'Friend'
  const guestName = friendName === session.username ? `${friendName} (2)` : friendName
  onlineBattle?.forfeitSide(0)
  const battle = new WildBattle(
    scaleTeamToLevel(hostTeam, level),
    doubles ? 'gen9doublescustomgame' : 'gen9customgame',
    'gen9randombattle',
    {
      team: scaleTeamToLevel(guest.team, level),
      name: guestName,
      difficulty: 'easy',
      trainerId: `online:${guestName}`,
      spriteId: String(friend?.spriteId ?? 'red'),
      noRewards: true,
      online: { hostName: session.username, hostSpriteId: session.trainerSprite ?? 'red' }
    },
    // Merge star boosts only when the host ticked "Use stars".
    {
      ...(stars ? { p1: getTeamMergeStars(), p2: guest.mergeStars } : {}),
      everstone: { p1: getTeamEverstones(), p2: guest.everstone }
    }
  )
  return runOnlineBattle(event, battle)
})

// The online battle is on: both screens go to the renderer each time it moves on.
async function runOnlineBattle(event: Parameters<GameHandler>[0], battle: WildBattle): Promise<OnlineViews> {
  onlineBattle = battle
  activeBattle = null
  // A burst of changes (a whole turn) sends one update.
  let pending: ReturnType<typeof setTimeout> | null = null
  const sender = event.sender
  battle.onChange = () => {
    if (pending) return
    pending = setTimeout(() => {
      pending = null
      if (onlineBattle === battle && !sender.isDestroyed()) sender.send('online:views', onlineViews(battle))
    }, 40)
  }
  await battle.getInitialView()
  return onlineViews(battle)
}

// ---- Online chaos draft with a friend (see draft-store.ts) ----
// Each copy drafts its own side; the host's then runs each battle with both teams.
handle('online:draftStart', (_event, setFormats?: string[]) => startOnlineDraft(Array.isArray(setFormats) ? setFormats.map(String) : undefined))
handle('online:draftGet', () => getDraftView(true))
handle('online:draftPick', (_event, index: number) => pickDraftMon(index, true))
handle('online:draftReroll', () => rerollDraftPack(true))
handle('online:draftItemSwap', (_event, pick: number, item: string) => swapChaosItem(pick, item, true))
handle('online:draftTutor', (_event, pick: number) => chaosTutorMoves(pick, true))
handle('online:draftModifier', (_event, index: number, target?: ChaosModifierTarget) => chooseChaosModifier(index, target, true))
handle('online:draftTeam', (): OnlineDraftTeam => onlineDraftTeam())
handle('online:draftOpponent', (_event, stage: number, friend: OnlinePlayer, team: OnlineDraftTeam) =>
  setOnlineDraftOpponent(Number(stage), String(friend?.name ?? ''), String(friend?.spriteId ?? ''), team)
)
handle('online:draftResult', (_event, result: boolean | null) => finishOnlineDraftBattle(result === true ? true : result === false ? false : null))
handle('online:draftEnd', () => endOnlineDraft())

// Host: the chaos draft's next battle, both teams whole in the order picked (the lead
// first), with both sides' modifiers - nothing paid out.
handle('online:draftBattle', async (event, friend: OnlinePlayer, hostOrder: number[], guestOrder: number[]): Promise<OnlineViews> => {
  const session = getSessionInfo()
  if (!session.username) throw new Error('Log in first')
  const match = beginOnlineDraftBattle(hostOrder, guestOrder)
  const friendName = String(friend?.name ?? 'Friend').slice(0, 24) || 'Friend'
  const guestName = friendName === session.username ? `${friendName} (2)` : friendName
  onlineBattle?.forfeitSide(0)
  const battle = new WildBattle(match.p1team, 'gen9customgame', 'gen9randombattle', {
    team: match.p2team,
    name: guestName,
    difficulty: 'easy',
    trainerId: `online:${guestName}`,
    spriteId: String(friend?.spriteId ?? 'red'),
    noRewards: true,
    startField: match.field,
    statMultipliers: match.boosts,
    lockOn: match.lockOn,
    chaosModifiers: match.guestModifiers,
    online: { hostName: session.username, hostSpriteId: session.trainerSprite ?? 'red', guestChaosModifiers: match.hostModifiers }
  })
  return runOnlineBattle(event, battle)
})

// Either player's choice for the turn (side 0 is the host, 1 the friend).
handle('online:choose', async (_event, side: 0 | 1, choice: string) => {
  if (!onlineBattle) throw new Error('No online battle')
  await onlineBattle.chooseFor(side === 1 ? 1 : 0, String(choice))
})

// Either player giving up - or the friend's connection dropping, which counts the same.
handle('online:forfeit', (_event, side: 0 | 1) => {
  onlineBattle?.forfeitSide(side === 1 ? 1 : 0)
})

// The battle's over (or the room closed): nothing more to send.
handle('online:end', () => {
  if (onlineBattle) onlineBattle.onChange = null
  onlineBattle = null
})

// A Max Raid, paid for with a Raid Crystal (taken once the battle is set up): a doubles
// battle against one Dynamaxed boss at the level cap (see raid.ts and WildBattle's raid).
// The boss whose defeat opens Max Raids (and the Shop's late items), by name.
function raidUnlockBossName(): string | null {
  const step = getProgression().bossOrder.find((s) => s.unlocksLateItems)
  return step ? (listTrainers().find((t) => t.id === step.trainerId)?.name ?? null) : null
}

// Every Pokemon a Max Raid can bring, for the Max Raid page's carousel.
handle('raid:bosses', () => getRaidBossPreviews())

handle('battle:startRaid', async () => {
  if (!lateItemsUnlocked()) {
    const boss = raidUnlockBossName()
    throw new Error(`Max Raids open up once you beat ${boss ?? 'the right boss'}`)
  }
  const p1team = getTeamPokemonSets()
  if (p1team.length === 0) throw new Error('Your team is empty - add Pokemon and assign them to your team first')
  if (!hasItem(WISHING_PIECE_ITEM_ID)) throw new Error('You need a Raid Crystal to start a Max Raid - the Shop and the Game Corner sell them')
  const battle = raidBattleAgainst(p1team, generateRaidBoss(getProgression().levelCap))
  removeItem(WISHING_PIECE_ITEM_ID, 1)
  activeBattle = battle
  return activeBattle.getInitialView()
})

// Debug: a raid against a chosen species - no crystal, unlocked or not.
handle('debug:startRaid', (_event, species: string, level: number, shiny: boolean) => {
  requireAdmin()
  const p1team = getTeamPokemonSets()
  if (p1team.length === 0) throw new Error('Your team is empty - add Pokemon and assign them to your team first')
  activeBattle = raidBattleAgainst(p1team, debugRaidBoss(species, level, shiny))
  return activeBattle.getInitialView()
})

function raidBattleAgainst(p1team: PokemonSet[], boss: RaidBoss): WildBattle {
  return new WildBattle(
    p1team,
    'gen9doublescustomgame',
    'gen9randombattle',
    { team: [boss.set], name: 'Wild', difficulty: 'normal', raid: { gigantamax: boss.gigantamax, stars: boss.stars, secret: boss.secret } },
    { p1: getTeamMergeStars(), p2: [boss.stars], everstone: { p1: getTeamEverstones() } }
  )
}

// ---- Daily missions (see mission-store.ts) ----
// A save as a file, to move it between the PC and the phone (save-file.ts).
handle('save:exportFile', () => exportSaveFile())
handle('save:importFile', (_event, data: Uint8Array) => importSaveFile(data))

handle('missions:get', () => getMissions())
handle('missions:claim', (_event, slot: number) => claimMission(slot))
handle('missions:claimBonus', () => claimMissionBonus())
handle('missions:reroll', (_event, slot: number) => rerollMission(slot))

handle('battle:eligibility', (): BattleEligibility => {
  const progression = getProgression()
  const levelCap = progression.levelCap
  const playerTeamSize = getTeamPokemonSets().length
  const trainers = listTrainers()
  const hasTrainer = eligibleRandomTrainers(levelCap, playerTeamSize).length > 0

  const next = getNextBoss()
  let nextBoss: NextBossInfo | null = null
  if (next) {
    const trainer = trainers.find((t) => t.id === next.trainerId)
    nextBoss = {
      trainerId: next.trainerId,
      trainerName: trainer?.name ?? 'Unknown trainer',
      spriteId: trainer?.spriteId ?? '',
      requiredTrainerWins: next.requiredTrainerWins,
      trainerWinsSinceLastBoss: progression.trainerWinsSinceLastBoss,
      ready: progression.trainerWinsSinceLastBoss >= next.requiredTrainerWins
    }
  }

  return {
    rocketEvent: isRocketEventActive(),
    hasTrainer,
    hasBoss: !!nextBoss?.ready,
    nextBoss,
    allBossesDefeated: allBossesDefeated(),
    wishingPieces: getItemQuantity(WISHING_PIECE_ITEM_ID),
    raidsUnlocked: lateItemsUnlocked(),
    raidUnlockBoss: raidUnlockBossName()
  }
})

// Every boss in the order is beaten: Boss Battle becomes the rematch menu and the
// The Lab opens up as a wild location.
function allBossesDefeated(): boolean {
  return getProgression().bossOrder.length > 0 && !getNextBoss()
}

// ---- Roguelite runs (see run-store.ts) ----
handle('run:get', (): RunView | null => getRunView())
handle('run:generations', () => completeRunGenerations())
handle('run:start', (_event, boxMonId: string, difficulty: RunDifficulty, generation: number | null, keepMoves = false) =>
  startRun(boxMonId, difficulty, generation, keepMoves)
)
handle('run:previewStarterMoves', (_event, boxMonId: string) => previewStarterMoves(boxMonId))
handle('run:previewEvolution', (_event, runMonId: string, targetSpecies: string) =>
  previewEvolutionMoves(runMonId, targetSpecies)
)
handle('run:editInfo', (_event, runMonId: string) => getRunMonEditInfo(runMonId))
handle('run:smogonSet', (_event, runMonId: string, optionId: string) => runSmogonSet(runMonId, optionId))
handle('run:updateMon', (_event, runMonId: string, input: RunMonEdit) => updateRunMon(runMonId, input))
handle('run:forfeit', () => forfeitRun())
handle('run:giveItem', (_event, itemId: string, runMonId: string) => giveRunItem(itemId, runMonId))
handle('run:skipItem', () => skipRunItem())
handle('run:giveAbility', (_event, abilityId: string, runMonId: string) => giveRunAbility(abilityId, runMonId))
handle('run:teachMove', (_event, moveId: string, runMonId: string, replaceMoveId: string | null) =>
  teachRunMove(moveId, runMonId, replaceMoveId)
)
handle('run:skipPick', () => skipRunPick())
handle('dex:abilities', () => listAllAbilities())
handle('run:rerollItems', () => rerollRunItems())
handle('run:evolve', (_event, runMonId: string, targetSpecies: string, newMoves = true) =>
  evolveRunMon(runMonId, targetSpecies, newMoves)
)
handle('run:placeDisplacedItem', (_event, runMonId: string | null) => placeDisplacedItem(runMonId))
handle('run:moveItem', (_event, fromMonId: string, toMonId: string) => moveRunItem(fromMonId, toMonId))
handle('run:reorder', (_event, runMonIds: string[]) => reorderRunTeam(runMonIds))
// A floor's choice: a heal or an item floor answers with the run as it now stands, a
// fight starts the battle.
handle('run:swapMon', (_event, runMonId: string) => swapRunMon(runMonId))
handle('run:swapTeam', () => swapRunTeam())
handle('run:skipSwap', () => skipRunSwap())
// A beaten villain's reward Pokemon: one taken (in someone's place, with a full team), or none.
handle('run:takeRewardMon', (_event, index: number, replaceRunMonId?: string) =>
  takeRunRewardMon(index, replaceRunMonId)
)
handle('run:skipRewardMon', () => skipRunRewardMon())
handle('run:fullRestore', (_event, runMonId: string) => useRunFullRestore(runMonId))
handle('run:revive', (_event, faintedId: string, replaceId?: string) => useRunRevive(faintedId, replaceId))
handle('run:abilityCapsule', (_event, runMonId: string, abilityId: string) =>
  useRunAbilityCapsule(runMonId, abilityId)
)
handle('run:resetAbility', (_event, runMonId: string) => resetRunAbility(runMonId))
handle('run:buyConsumable', (_event, id: RunConsumableId) => buyRunConsumable(id))
handle('run:buyRareCandy', (_event, runMonId: string) => buyRunRareCandy(runMonId))
handle('run:buyShopTile', (_event, tile: RunShopTile) => buyRunShopTile(tile))

handle('run:choose', async (_event, index: number): Promise<RunChoiceResult> => {
  const choice = runChoiceAt(index)
  if (choice.kind === 'heal') return { run: takeHealNode() }
  if (choice.kind === 'item') return { run: takeItemNode() }
  if (choice.kind === 'ability' || choice.kind === 'move') return { run: takePickNode(choice.kind) }
  if (choice.kind === 'swap') return { run: takeSwapNode() }
  activeBattle = createRunBattle(choice)
  return { battle: await activeBattle.getInitialView(), location: choice.location }
})

// ---- Draft mode (see draft-store.ts) ----
handle('draft:get', () => getDraftView())
handle('draft:dailyWinClaimed', () => draftDailyWinClaimed())
handle('draft:entryFee', () => draftEntryFee())
handle('draft:start', (_event, format: DraftFormat) => startDraft(format))
handle('draft:pick', (_event, index: number) => pickDraftMon(index))
handle('draft:abandon', () => abandonDraft())
handle('draft:chaosAbilities', () => chaosAbilityChoices())
handle('draft:reroll', () => rerollDraftPack())
handle('draft:chaosItems', () => chaosItemChoices())
handle('draft:chaosItemSwap', (_event, pick: number, item: string) => swapChaosItem(pick, item))
handle('draft:chaosTutor', (_event, pick: number) => chaosTutorMoves(pick))
handle('draft:chaosModifier', (_event, index: number, target?: ChaosModifierTarget) =>
  chooseChaosModifier(index, target)
)
// The gauntlet's next battle, in the draft's format, with the picks brought (in lead order).
handle('draft:battle', async (_event, bring: number[]) => {
  const { format, p1team, opponent, chaos } = beginDraftBattle(bring)
  const formatId = format === 'doubles' ? 'gen9doublescustomgame' : 'gen9customgame'
  activeBattle = new WildBattle(p1team, formatId, 'gen9randombattle', {
    team: opponent.team,
    name: opponent.name,
    difficulty: opponent.difficulty,
    trainerId: 'draft',
    spriteId: opponent.spriteId,
    draft: true,
    // Chaos: its modifiers' starting field and stat boosts.
    startField: chaos?.field,
    statMultipliers: chaos ? { p1: chaos.boosts, p2: chaos.foeBoosts } : undefined,
    lockOn: chaos ? { p1: chaos.lockOn, p2: chaos.foeLockOn } : undefined,
    chaosModifiers: chaos?.foeModifiers
  })
  return activeBattle.getInitialView()
})

handle('battle:bossRematchList', (): BossRematchInfo[] => {
  const { bossOrder, bossesDefeated } = getProgression()
  const trainers = listTrainers()
  return bossOrder.map((step, i) => {
    const trainer = trainers.find((t) => t.id === step.trainerId)
    return {
      number: i + 1,
      trainerId: step.trainerId,
      trainerName: trainer?.name ?? 'Unknown trainer',
      spriteId: trainer?.spriteId ?? '',
      defeated: bossesDefeated.includes(step.trainerId)
    }
  })
})

handle('dex:move', (_event, id: string) => getMoveInfo(id))

handle('box:list', () => getBoxState())
handle('box:sell', (_event, id: string) => sellMon(id))
handle('box:sellMany', (_event, ids: string[]) => sellMons(ids))
handle('box:addRandom', () => {
  requireAdmin()
  return addRandomMon()
})
handle('box:addMon', (_event, species: string, level: number, shiny: boolean) => {
  requireAdmin()
  return addMonOfSpecies(species, level, shiny)
})
handle('box:setTeam', (_event, team: (string | null)[]) => setTeam(team))
handle('box:getMon', (_event, id: string) => getMonSet(id))
handle('box:updateMon', (_event, id: string, set: EditablePokemonSet, admin?: boolean) => {
  // Admin Edit skips the normal restrictions, so only an admin may ask for it.
  if (admin) requireAdmin()
  return updateMon(id, set, admin)
})
handle('box:addStarter', (_event, species: string) => addStarter(species))
handle('box:evolve', (_event, id: string, targetSpecies: string) => evolveMon(id, targetSpecies))
handle('box:levelUp', (_event, id: string) => levelUpMon(id))
handle('box:setEverstone', (_event, id: string, locked: boolean) => setEverstone(id, locked))
handle('box:toggleFavorite', (_event, id: string) => toggleFavorite(id))
handle('box:setCompanion', (_event, id: string) => setCompanion(id))
handle('box:returnCompanion', () => returnCompanion())
handle('box:setCompanionSize', (_event, size: CompanionSizeChoice) => setCompanionSize(size))
handle('box:useShinyPatch', (_event, id: string) => useShinyPatch(id))
handle('box:useFriendshipPetal', (_event, id: string) => useFriendshipPetal(id))
handle('box:changeForm', (_event, id: string, form: string) => changeForm(id, form))
handle('box:fuse', (_event, id: string, partnerId: string) => fuseMon(id, partnerId))
handle('box:unfuse', (_event, id: string) => unfuseMon(id))
handle('box:merge', (_event, keeperId: string, fodderIds: string[]) => mergeMons(keeperId, fodderIds))
handle('box:mergeSelected', (_event, ids: string[], boosts?: MergeBoosts) =>
  mergeSelectedMons(ids, { petals: !!boosts?.petals, candies: !!boosts?.candies })
)
handle('box:autoMerge', (_event, monId: string) => autoMergeMon(monId))

handle('loadouts:list', () => listLoadouts())
handle('loadouts:save', (_event, name: string) => saveLoadout(name))
handle('loadouts:update', (_event, id: string) => updateLoadout(id))
handle('loadouts:rename', (_event, id: string, name: string) => renameLoadout(id, name))
handle('loadouts:delete', (_event, id: string) => deleteLoadout(id))
handle('loadouts:apply', (_event, id: string) => applyLoadout(id))

handle('bag:list', () => getBagState())
handle('bag:item', (_event, itemId: string) => getBagItemView(itemId))
handle('bag:useExpCandy', (_event, itemId: string) => useExpCandy(itemId))
handle('bag:useExpCandiesUntilCap', (_event, itemId: string) => useExpCandiesUntilCap(itemId))

handle('money:get', () => getMoney())
handle('coins:get', () => getCoins())
handle('achievements:get', () => getAchievements())
handle('achievements:claim', (_event, id: string) => claimAchievement(id))
handle('achievements:setTitle', (_event, title: string | null) => setAchievementTitle(title))
handle('achievements:setTitleActive', (_event, title: string, active: boolean) => setTitleActive(title, active))
handle('coins:buy', (_event, amount: number) => buyCoins(amount))
handle('coins:prize', (_event, itemId: string, quantity?: number) => buyCoinPrize(itemId, quantity))
handle('coins:dailyPrizesBought', () => getDailyPrizesBought())
handle('coins:dailyOffer', () => getDailyCoinOffer())
handle('coins:buyDailyOffer', () => buyDailyCoinOffer())
handle('coins:petalDeals', () => getDailyPetalDeals())
handle('coins:claimFreePetals', () => claimFreePetals())
handle('coins:buyPetalPack', () => buyPetalPack())
handle('coins:dailyMon', () => getDailyCoinMon())
handle('coins:buyDailyMon', () => buyDailyCoinMon())

// ---- TMs (see tm-store.ts) ----
handle('tm:catalog', () => getTmCatalog())
handle('tm:state', () => getTmState())
handle('tm:startSearch', (_event, location: WildLocationId) => startTmSearch(location, allBossesDefeated()))
handle('tm:searchCheck', (_event, result: SkillCheckResult, timedOut?: boolean) => reportTmSearchCheck(result, !!timedOut))
handle('tm:abandonSearch', () => abandonTmSearch())
handle('tm:quickCheck', (_event, result: SkillCheckResult, timedOut?: boolean) => takeTmQuickCheck(result, !!timedOut))
handle('tm:shop', () => getTmShop())
handle('tm:buy', (_event, moveId: string) => buyTmFromShop(moveId))
handle('tm:buyScanner', () => buyScanner())
handle('slots:spin', (_event, bet: number) => spinSlots(bet))
handle('slots:rules', () => getSlotRules())
handle('blackjack:view', () => getBlackjackView())
handle('gamecorner:perks', () => getGameCornerPerks())
handle('roulette:history', () => getRouletteHistory())
handle('roulette:spin', (_event, bets: Record<string, number>) => spinRoulette(bets))
handle('plinko:drop', (_event, bet: number, risk: PlinkoRisk) => dropPlinko(bet, risk))
handle('blackjack:deal', (_event, bet: number) => dealBlackjack(bet))
handle('blackjack:hit', () => hitBlackjack())
handle('blackjack:stand', () => standBlackjack())
handle('blackjack:double', () => doubleBlackjack())
handle('dice:roll', (_event, bet: number, target: number, over: boolean) => rollDice(bet, target, over))
handle('debug:setWallet', (_event, money: number, coins: number) => {
  requireAdmin()
  return { money: setMoney(money), coins: setCoins(coins) }
})
handle('shop:list', () => listShop())
handle('shop:listKeyItems', () => listKeyItems())
handle('shop:buy', (_event, itemId: string, quantity: number) => buyItem(itemId, quantity))
handle('shop:listPrices', () => {
  requireAdmin()
  return listShopPrices()
})
handle('shop:setPrice', (_event, itemId: string, price: number | null) => {
  requireAdmin()
  return setShopPrice(itemId, price)
})
handle('bag:sell', (_event, itemId: string) => sellItem(itemId))
handle('bag:sellMany', (_event, entries: ItemQuantity[]) => sellItems(entries))
handle('bag:quickSellSelection', () => quickSellSelection())
handle('bag:open', (_event, itemId: string) => openBagItem(itemId))
// The odds of each rarity colour, for a raid / case / TM search button's tooltip.
handle('rarity:odds', (_event, source: RarityOddsSource) => {
  if (source.kind === 'raid') return raidBossKindOdds()
  if (source.kind === 'tm') return tmSearchRarityOdds(source.location)
  return openItemRarityOdds(source.itemId)
})
handle('fossil:galarPartners', (_event, itemId: string) => getGalarFossilPartners(itemId))
handle('fossil:restore', (_event, itemId: string, secondItemId?: string) =>
  restoreFossil(itemId, secondItemId)
)

handle('dex:editorOptions', () => getEditorOptions())
handle('dex:speciesInfo', (_event, species: string, level: number, knownMoves?: string[]) =>
  withTmLocks(getSpeciesEditInfo(species, level, knownMoves), species, knownMoves)
)

handle('trainers:list', () => listTrainers())
handle('trainers:add', (_event, input: Omit<Trainer, 'id'>) => {
  requireAdmin()
  return addTrainer(input)
})
handle('trainers:update', (_event, id: string, input: Omit<Trainer, 'id'>) => {
  requireAdmin()
  return updateTrainer(id, input)
})
handle('trainers:delete', (_event, id: string) => {
  requireAdmin()
  const result = deleteTrainer(id)
  deleteTeamsForTrainer(id)
  removeFromBossOrder(id)
  return result
})
// A copy of the trainer with copies of all its teams (the copy isn't put in the boss order).
handle('trainers:duplicate', (_event, id: string) => {
  requireAdmin()
  const copy = duplicateTrainer(id)
  copyTeamsToTrainer(id, copy.id)
  return copy
})

handle('premadeTeams:list', () => listPremadeTeams())
handle('premadeTeams:listForTrainer', (_event, trainerId: string) => listPremadeTeamsForTrainer(trainerId))
handle('premadeTeams:add', (_event, trainerId: string, name: string) => {
  requireAdmin()
  return addPremadeTeam(trainerId, name)
})
handle('premadeTeams:rename', (_event, id: string, name: string) => {
  requireAdmin()
  return renamePremadeTeam(id, name)
})
handle('premadeTeams:duplicate', (_event, id: string) => {
  requireAdmin()
  return duplicatePremadeTeam(id)
})
handle('premadeTeams:delete', (_event, id: string) => {
  requireAdmin()
  return deletePremadeTeam(id)
})
handle('premadeTeams:addSpecies', (_event, teamId: string, species: string) => {
  requireAdmin()
  return addSpeciesToTeam(teamId, species)
})
handle('premadeTeams:removeMon', (_event, teamId: string, monId: string) => {
  requireAdmin()
  return removeMonFromTeam(teamId, monId)
})
handle('premadeTeams:reorder', (_event, teamId: string, monIds: string[]) => {
  requireAdmin()
  return reorderTeamMons(teamId, monIds)
})
handle('premadeTeams:getMon', (_event, teamId: string, monId: string) => getTeamMonSet(teamId, monId))
handle('premadeTeams:updateMon', (_event, teamId: string, monId: string, input: EditablePokemonSet) => {
  requireAdmin()
  return updateTeamMon(teamId, monId, input)
})
handle('premadeTeams:setDrop', (_event, teamId: string, drop: ItemDropConfig) => {
  requireAdmin()
  return setPremadeTeamDrop(teamId, drop)
})
handle('premadeTeams:setDoubleBattle', (_event, teamId: string, isDoubleBattle: boolean) => {
  requireAdmin()
  return setPremadeTeamDoubleBattle(teamId, isDoubleBattle)
})

handle('dexnav:state', () => getDexNavState())
handle('dexnav:candidates', () => listDexNavCandidates())
handle('dexnav:setTarget', (_event, species: string | null) => setDexNavTarget(species))
handle('wildDrops:list', () => listWildDrops())
handle('wildDrops:set', (_event, species: string, drop: ItemDropConfig) => {
  requireAdmin()
  return setWildDrop(species, drop)
})


handle('progression:get', () => getProgression())
handle('progression:setBossOrder', (_event, steps: Omit<BossStep, 'id'>[]) => {
  requireAdmin()
  return setBossOrder(steps)
})
handle('progression:setLevelCap', (_event, levelCap: number) => {
  requireAdmin()
  return setLevelCap(levelCap)
})

// Boss progression only (level cap, defeated bosses, trainer-win counter) -
// unlike stats:reset this leaves the box, bag and money alone.
handle('progression:reset', () => {
  requireAdmin()
  resetProgression()
  return getProgression()
})

handle('auth:session', () => getSessionInfo())
handle('auth:login', (_event, username: string, remember: boolean) => {
  activeBattle = null
  return login(username, remember)
})
handle('auth:logout', () => {
  activeBattle = null
  return logout()
})
handle('profile:setTrainerSprite', (_event, spriteId: string) => setTrainerSprite(spriteId))

handle('stats:reset', () => {
  requireAdmin()
  resetBox()
  resetProgression()
  resetBag()
  resetMoney()
  resetStatsCounters()
  return { box: getBoxState(), progression: getProgression(), money: getMoney() }
})

handle('profile:get', () => getTrainerProfile())
handle('profile:pokedex', () => getPokedex())


handle('autoSets:list', (_event, species: string) => listAutoSets(species))
// Admin editing lifts the move/item limits - only honoured for an actual admin.
handle(
  'autoSets:build',
  (_event, species: string, level: number, optionId: string, admin: boolean, heldItem?: string) =>
    buildAutoSet(species, level, optionId, admin && isAdmin(), [], heldItem ?? '')
)
