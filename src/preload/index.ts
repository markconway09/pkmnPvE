import type { MissionClaimResult, MissionsState } from '../shared/missions'
import type { RarityOdds, RarityOddsSource } from '../shared/rarity'
import { contextBridge, ipcRenderer } from 'electron'
import type { LocalMusicFile } from '../shared/music'
import type { CoinBalance, DailyCoinMon, DailyCoinMonPurchase, DailyCoinOffer, SlotRules, SlotSpinResult } from '../shared/slots'
import type { BlackjackView } from '../shared/blackjack'
import type { AchievementClaimResult, AchievementsState } from '../shared/achievements'
import type { CloudSave, CloudStatus } from '../shared/cloud'
import type { RouletteSpin } from '../shared/roulette'
import type { GameCornerPerks } from '../shared/titles'
import type { PlinkoDrop, PlinkoRisk } from '../shared/plinko'
import type { ChaosModifierTarget, ChaosTutorMove, DraftFormat, DraftView } from '../shared/draft'
import type { SkillCheckResult, TmInfo, TmQuickCheckResult, TmSearchProgress, TmSearchStart, TmShopView, TmState } from '../shared/tms'
import type {
  AutoSetOption,
  AutoSetResult,
  BagItemView,
  BattleEligibility,
  BattleView,
  BossStep,
  BoxState,
  CatchResult,
  EditablePokemonSet,
  EditorOptions,
  ExpGainResult,
  GalarFossilPartner,
  ItemDropConfig,
  LoadoutView,
  MoveInfo,
  OpenItemResult,
  PremadeTeamSummary,
  ProgressionState,
  TrainerProfile,
  BossRematchInfo,
  RunChoiceResult,
  RunDifficulty,
  RunConsumableId,
  RunShopTile,
  RunMonEdit,
  RunMonEditInfo,
  RunMovesPreview,
  RunView,
  PokedexEntry,
  RaidBossPreview,
  UpdateCheckResult,
  UpdateProgress,
  SessionInfo,
  RestoreFossilResult,
  ItemQuantity,
  SellResult,
  ShopItemEntry,
  KeyItemView,
  ShopPriceEntry,
  SpeciesEditInfo,
  Trainer,
  WildDropEntry,
  WildLocationId,
  CompanionSizeChoice
} from '../shared/battle-types'

const api = {
  getSession: (): Promise<SessionInfo> => ipcRenderer.invoke('auth:session'),
  login: (username: string, remember: boolean): Promise<SessionInfo> => ipcRenderer.invoke('auth:login', username, remember),
  logout: (): Promise<SessionInfo> => ipcRenderer.invoke('auth:logout'),
  setTrainerSprite: (spriteId: string): Promise<SessionInfo> => ipcRenderer.invoke('profile:setTrainerSprite', spriteId),
  startPlayerBattle: (username: string, doubles: boolean): Promise<BattleView> =>
    ipcRenderer.invoke('battle:startPlayer', username, doubles),
  startBattle: (location?: WildLocationId, levelCap?: number): Promise<BattleView> =>
    ipcRenderer.invoke('battle:start', location, levelCap),
  startTrainerBattle: (boss: boolean, rematchTrainerId?: string): Promise<BattleView> =>
    ipcRenderer.invoke('battle:startTrainer', boss, rematchTrainerId),
  getBossRematchList: (): Promise<BossRematchInfo[]> => ipcRenderer.invoke('battle:bossRematchList'),
  getRun: (): Promise<RunView | null> => ipcRenderer.invoke('run:get'),
  getDraft: (): Promise<DraftView | null> => ipcRenderer.invoke('draft:get'),
  getDraftEntryFee: (): Promise<number> => ipcRenderer.invoke('draft:entryFee'),
  startDraft: (format: DraftFormat): Promise<DraftView> => ipcRenderer.invoke('draft:start', format),
  pickDraftMon: (index: number): Promise<DraftView> => ipcRenderer.invoke('draft:pick', index),
  abandonDraft: (): Promise<DraftView> => ipcRenderer.invoke('draft:abandon'),
  rerollDraftPack: (): Promise<DraftView> => ipcRenderer.invoke('draft:reroll'),
  getChaosItems: (): Promise<{ id: string; name: string; description: string; spritenum: number }[]> =>
    ipcRenderer.invoke('draft:chaosItems'),
  getChaosTutorMoves: (pick: number): Promise<ChaosTutorMove[]> => ipcRenderer.invoke('draft:chaosTutor', pick),
  getChaosAbilities: (): Promise<{ id: string; name: string; description: string }[]> =>
    ipcRenderer.invoke('draft:chaosAbilities'),
  chooseChaosModifier: (index: number, target?: ChaosModifierTarget): Promise<DraftView> =>
    ipcRenderer.invoke('draft:chaosModifier', index, target),
  startDraftBattle: (bring: number[]): Promise<BattleView> => ipcRenderer.invoke('draft:battle', bring),
  // Generations with a Roguelite boss of every class - the ones a run can be set to.
  getRunGenerations: (): Promise<number[]> => ipcRenderer.invoke('run:generations'),
  startRun: (boxMonId: string, difficulty: RunDifficulty, generation: number | null, keepMoves: boolean): Promise<RunView> =>
    ipcRenderer.invoke('run:start', boxMonId, difficulty, generation, keepMoves),
  previewStarterMoves: (boxMonId: string): Promise<RunMovesPreview> => ipcRenderer.invoke('run:previewStarterMoves', boxMonId),
  previewEvolutionMoves: (runMonId: string, targetSpecies: string): Promise<RunMovesPreview> =>
    ipcRenderer.invoke('run:previewEvolution', runMonId, targetSpecies),
  getRunMonEditInfo: (runMonId: string): Promise<RunMonEditInfo> => ipcRenderer.invoke('run:editInfo', runMonId),
  runSmogonSet: (runMonId: string, optionId: string): Promise<string[]> =>
    ipcRenderer.invoke('run:smogonSet', runMonId, optionId),
  updateRunMon: (runMonId: string, input: RunMonEdit): Promise<RunView> => ipcRenderer.invoke('run:updateMon', runMonId, input),
  forfeitRun: (): Promise<RunView> => ipcRenderer.invoke('run:forfeit'),
  // A floor's option, by its place in the run's list of choices.
  chooseRunNode: (index: number): Promise<RunChoiceResult> => ipcRenderer.invoke('run:choose', index),
  giveRunItem: (itemId: string, runMonId: string): Promise<RunView> => ipcRenderer.invoke('run:giveItem', itemId, runMonId),
  skipRunItem: (): Promise<RunView> => ipcRenderer.invoke('run:skipItem'),
  giveRunAbility: (abilityId: string, runMonId: string): Promise<RunView> =>
    ipcRenderer.invoke('run:giveAbility', abilityId, runMonId),
  teachRunMove: (moveId: string, runMonId: string, replaceMoveId: string | null): Promise<RunView> =>
    ipcRenderer.invoke('run:teachMove', moveId, runMonId, replaceMoveId),
  skipRunPick: (): Promise<RunView> => ipcRenderer.invoke('run:skipPick'),
  swapRunMon: (runMonId: string): Promise<RunView> => ipcRenderer.invoke('run:swapMon', runMonId),
  swapRunTeam: (): Promise<RunView> => ipcRenderer.invoke('run:swapTeam'),
  skipRunSwap: (): Promise<RunView> => ipcRenderer.invoke('run:skipSwap'),
  // A beaten villain's reward: one of its Pokemon by place, in someone's place on a full team.
  takeRunRewardMon: (index: number, replaceRunMonId?: string): Promise<RunView> =>
    ipcRenderer.invoke('run:takeRewardMon', index, replaceRunMonId),
  skipRunRewardMon: (): Promise<RunView> => ipcRenderer.invoke('run:skipRewardMon'),
  // Roguelite consumables (outside battle) and a boss floor's shop.
  useRunFullRestore: (runMonId: string): Promise<RunView> => ipcRenderer.invoke('run:fullRestore', runMonId),
  // With a full team, replaceId is the team member who leaves (to the fainted) to make room.
  useRunRevive: (faintedId: string, replaceId?: string): Promise<RunView> =>
    ipcRenderer.invoke('run:revive', faintedId, replaceId),
  useRunAbilityCapsule: (runMonId: string, abilityId: string): Promise<RunView> =>
    ipcRenderer.invoke('run:abilityCapsule', runMonId, abilityId),
  // Undoes a New Ability pick, back to the ability it came with.
  resetRunAbility: (runMonId: string): Promise<RunView> => ipcRenderer.invoke('run:resetAbility', runMonId),
  buyRunConsumable: (id: RunConsumableId): Promise<RunView> => ipcRenderer.invoke('run:buyConsumable', id),
  // A boss shop's Rare Candy, used on the spot on this team member (past the cap).
  buyRunRareCandy: (runMonId: string): Promise<RunView> => ipcRenderer.invoke('run:buyRareCandy', runMonId),
  buyRunShopTile: (tile: RunShopTile): Promise<RunView> => ipcRenderer.invoke('run:buyShopTile', tile),
  listAllAbilities: (): Promise<{ id: string; name: string }[]> => ipcRenderer.invoke('dex:abilities'),
  rerollRunItems: (): Promise<RunView> => ipcRenderer.invoke('run:rerollItems'),
  evolveRunMon: (runMonId: string, targetSpecies: string, newMoves: boolean): Promise<RunView> =>
    ipcRenderer.invoke('run:evolve', runMonId, targetSpecies, newMoves),
  placeDisplacedItem: (runMonId: string | null): Promise<RunView> => ipcRenderer.invoke('run:placeDisplacedItem', runMonId),
  moveRunItem: (fromMonId: string, toMonId: string): Promise<RunView> => ipcRenderer.invoke('run:moveItem', fromMonId, toMonId),
  reorderRunTeam: (runMonIds: string[]): Promise<RunView> => ipcRenderer.invoke('run:reorder', runMonIds),
  submitChoice: (choice: string): Promise<BattleView> => ipcRenderer.invoke('battle:choose', choice),
  // replaceRunMonId: in a run with a full team, who the new Pokemon replaces.
  catchWildPokemon: (replaceRunMonId?: string): Promise<CatchResult> => ipcRenderer.invoke('battle:catch', replaceRunMonId),
  // Daily missions.
  getMissions: (): Promise<MissionsState> => ipcRenderer.invoke('missions:get'),
  claimMission: (slot: number): Promise<MissionClaimResult> => ipcRenderer.invoke('missions:claim', slot),
  claimMissionBonus: (): Promise<MissionClaimResult> => ipcRenderer.invoke('missions:claimBonus'),
  rerollMission: (slot: number): Promise<MissionsState> => ipcRenderer.invoke('missions:reroll', slot),
  // A mission's progress changed (the names of any just finished).
  onMissionsChanged: (listener: (finished: string[]) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, finished: string[]): void => listener(finished)
    ipcRenderer.on('missions:changed', handler)
    return () => ipcRenderer.removeListener('missions:changed', handler)
  },
  // A Max Raid (uses up a Raid Crystal).
  startRaidBattle: (): Promise<BattleView> => ipcRenderer.invoke('battle:startRaid'),
  // Every Pokemon a Max Raid can bring, registered or not (the Max Raid page's carousel).
  getRaidBosses: (): Promise<RaidBossPreview[]> => ipcRenderer.invoke('raid:bosses'),
  runFromBattle: (): Promise<void> => ipcRenderer.invoke('battle:run'),
  getBattleEligibility: (): Promise<BattleEligibility> => ipcRenderer.invoke('battle:eligibility'),
  getMoveInfo: (id: string): Promise<MoveInfo | null> => ipcRenderer.invoke('dex:move', id),
  listBox: (): Promise<BoxState> => ipcRenderer.invoke('box:list'),
  addRandomBoxMon: (): Promise<BoxState> => ipcRenderer.invoke('box:addRandom'),
  // Debug: a chosen species at a chosen level, shiny or not.
  addBoxMon: (species: string, level: number, shiny: boolean): Promise<BoxState> =>
    ipcRenderer.invoke('box:addMon', species, level, shiny),
  addStarter: (species: string): Promise<BoxState> => ipcRenderer.invoke('box:addStarter', species),
  setTeam: (team: (string | null)[]): Promise<BoxState> => ipcRenderer.invoke('box:setTeam', team),
  getMonSet: (id: string): Promise<EditablePokemonSet> => ipcRenderer.invoke('box:getMon', id),
  updateBoxMon: (id: string, set: EditablePokemonSet, admin?: boolean): Promise<BoxState> =>
    ipcRenderer.invoke('box:updateMon', id, set, admin),
  evolveMon: (id: string, targetSpecies: string): Promise<BoxState> => ipcRenderer.invoke('box:evolve', id, targetSpecies),
  levelUpMon: (id: string): Promise<BoxState> => ipcRenderer.invoke('box:levelUp', id),
  setEverstone: (id: string, locked: boolean): Promise<BoxState> => ipcRenderer.invoke('box:setEverstone', id, locked),
  toggleFavorite: (id: string): Promise<BoxState> => ipcRenderer.invoke('box:toggleFavorite', id),
  // The companion beside the team: a max-friendship Pokemon out of the box, and back again.
  setCompanion: (id: string): Promise<BoxState> => ipcRenderer.invoke('box:setCompanion', id),
  returnCompanion: (): Promise<BoxState> => ipcRenderer.invoke('box:returnCompanion'),
  setCompanionSize: (size: CompanionSizeChoice): Promise<BoxState> => ipcRenderer.invoke('box:setCompanionSize', size),
  useShinyPatch: (id: string): Promise<BoxState> => ipcRenderer.invoke('box:useShinyPatch', id),
  changeForm: (id: string, form: string): Promise<BoxState> => ipcRenderer.invoke('box:changeForm', id, form),
  fuseMon: (id: string, partnerId: string): Promise<BoxState> => ipcRenderer.invoke('box:fuse', id, partnerId),
  unfuseMon: (id: string): Promise<BoxState> => ipcRenderer.invoke('box:unfuse', id),
  // Merges duplicates into a Pokemon (see mergeMons).
  mergeMons: (keeperId: string, fodderIds: string[]): Promise<BoxState> =>
    ipcRenderer.invoke('box:merge', keeperId, fodderIds),
  // The expanded box's "select to merge" (see mergeSelectedMons).
  mergeSelectedMons: (ids: string[]): Promise<{ box: BoxState; merged: number; results: { species: string; stars: number }[] }> =>
    ipcRenderer.invoke('box:mergeSelected', ids),
  // A Random Pokemon's "Auto merge": straight into its best keeper (see autoMergeMon).
  autoMergeMon: (monId: string): Promise<{ box: BoxState; species: string; stars: number }> =>
    ipcRenderer.invoke('box:autoMerge', monId),
  listLoadouts: (): Promise<LoadoutView[]> => ipcRenderer.invoke('loadouts:list'),
  saveLoadout: (name: string): Promise<LoadoutView[]> => ipcRenderer.invoke('loadouts:save', name),
  updateLoadout: (id: string): Promise<LoadoutView[]> => ipcRenderer.invoke('loadouts:update', id),
  renameLoadout: (id: string, name: string): Promise<LoadoutView[]> => ipcRenderer.invoke('loadouts:rename', id, name),
  deleteLoadout: (id: string): Promise<LoadoutView[]> => ipcRenderer.invoke('loadouts:delete', id),
  applyLoadout: (id: string): Promise<BoxState> => ipcRenderer.invoke('loadouts:apply', id),
  listBag: (): Promise<BagItemView[]> => ipcRenderer.invoke('bag:list'),
  useExpCandy: (itemId: string): Promise<ExpGainResult[]> => ipcRenderer.invoke('bag:useExpCandy', itemId),
  useExpCandiesUntilCap: (itemId: string): Promise<{ used: number; results: ExpGainResult[]; allCapped: boolean }> =>
    ipcRenderer.invoke('bag:useExpCandiesUntilCap', itemId),
  getMoney: (): Promise<number> => ipcRenderer.invoke('money:get'),
  // `found`: evolution items the Alchemist title turned up (their names).
  sellMon: (id: string): Promise<{ sold: number; species: string; money: number; box: BoxState; found: string[] }> =>
    ipcRenderer.invoke('box:sell', id),
  sellMons: (ids: string[]): Promise<{ sold: number; count: number; money: number; box: BoxState; found: string[] }> =>
    ipcRenderer.invoke('box:sellMany', ids),
  getCoins: (): Promise<number> => ipcRenderer.invoke('coins:get'),
  getAchievements: (): Promise<AchievementsState> => ipcRenderer.invoke('achievements:get'),
  // Cloud saves on Google Drive, for the logged-in player.
  getCloudStatus: (): Promise<CloudStatus> => ipcRenderer.invoke('cloud:status'),
  connectCloud: (): Promise<CloudStatus> => ipcRenderer.invoke('cloud:connect'),
  disconnectCloud: (): Promise<CloudStatus> => ipcRenderer.invoke('cloud:disconnect'),
  listCloudSaves: (): Promise<CloudSave[]> => ipcRenderer.invoke('cloud:list'),
  exportToCloud: (): Promise<CloudSave[]> => ipcRenderer.invoke('cloud:export'),
  importFromCloud: (fileId: string): Promise<void> => ipcRenderer.invoke('cloud:import', fileId),
  claimAchievement: (id: string): Promise<AchievementClaimResult> => ipcRenderer.invoke('achievements:claim', id),
  setAchievementTitle: (title: string | null): Promise<AchievementsState> =>
    ipcRenderer.invoke('achievements:setTitle', title),
  // Turns a claimed title's perk on or off (clashing titles move with it).
  setTitleActive: (title: string, active: boolean): Promise<AchievementsState> =>
    ipcRenderer.invoke('achievements:setTitleActive', title, active),
  // Achievements just unlocked (their names); returns a function to stop listening.
  onAchievementsUnlocked: (listener: (names: string[]) => void): (() => void) => {
    const handler = (_event: unknown, names: string[]): void => listener(names)
    ipcRenderer.on('achievements:unlocked', handler)
    return () => ipcRenderer.removeListener('achievements:unlocked', handler)
  },
  buyCoins: (amount: number): Promise<CoinBalance> => ipcRenderer.invoke('coins:buy', amount),
  buyCoinPrize: (itemId: string, quantity = 1): Promise<CoinBalance & { itemName: string; quantity: number }> =>
    ipcRenderer.invoke('coins:prize', itemId, quantity),
  // The Coin Shop's once-a-day discounted coins.
  getDailyCoinOffer: (): Promise<DailyCoinOffer> => ipcRenderer.invoke('coins:dailyOffer'),
  buyDailyCoinOffer: (): Promise<CoinBalance> => ipcRenderer.invoke('coins:buyDailyOffer'),
  // The Coin Shop's Pokemon of the day, bought once a day at 2 stars.
  getDailyCoinMon: (): Promise<DailyCoinMon> => ipcRenderer.invoke('coins:dailyMon'),
  buyDailyCoinMon: (): Promise<DailyCoinMonPurchase> => ipcRenderer.invoke('coins:buyDailyMon'),
  getTmCatalog: (): Promise<TmInfo[]> => ipcRenderer.invoke('tm:catalog'),
  getTmState: (): Promise<TmState> => ipcRenderer.invoke('tm:state'),
  startTmSearch: (location: WildLocationId): Promise<TmSearchStart> => ipcRenderer.invoke('tm:startSearch', location),
  reportTmSearchCheck: (result: SkillCheckResult, timedOut = false): Promise<TmSearchProgress> =>
    ipcRenderer.invoke('tm:searchCheck', result, timedOut),
  abandonTmSearch: (): Promise<void> => ipcRenderer.invoke('tm:abandonSearch'),
  takeTmQuickCheck: (result: SkillCheckResult, timedOut = false): Promise<TmQuickCheckResult> =>
    ipcRenderer.invoke('tm:quickCheck', result, timedOut),
  getTmShop: (): Promise<TmShopView> => ipcRenderer.invoke('tm:shop'),
  buyTm: (moveId: string): Promise<{ coins: number; shop: TmShopView }> => ipcRenderer.invoke('tm:buy', moveId),
  buyTmScanner: (): Promise<{ coins: number; shop: TmShopView }> => ipcRenderer.invoke('tm:buyScanner'),
  spinSlots: (bet: number): Promise<SlotSpinResult> => ipcRenderer.invoke('slots:spin', bet),
  getSlotRules: (): Promise<SlotRules> => ipcRenderer.invoke('slots:rules'),
  getBlackjack: (): Promise<BlackjackView> => ipcRenderer.invoke('blackjack:view'),
  dealBlackjack: (bet: number): Promise<BlackjackView> => ipcRenderer.invoke('blackjack:deal', bet),
  hitBlackjack: (): Promise<BlackjackView> => ipcRenderer.invoke('blackjack:hit'),
  standBlackjack: (): Promise<BlackjackView> => ipcRenderer.invoke('blackjack:stand'),
  doubleBlackjack: (): Promise<BlackjackView> => ipcRenderer.invoke('blackjack:double'),
  // What the player's titles change in the Game Corner (the bet cap, Plinko's edges).
  getGameCornerPerks: (): Promise<GameCornerPerks> => ipcRenderer.invoke('gamecorner:perks'),
  getRouletteHistory: (): Promise<number[]> => ipcRenderer.invoke('roulette:history'),
  // The bets on the board: bet key ('n:17', 'red', 'dozen:2'...) -> coins on it.
  spinRoulette: (bets: Record<string, number>): Promise<RouletteSpin> => ipcRenderer.invoke('roulette:spin', bets),
  dropPlinko: (bet: number, risk: PlinkoRisk): Promise<PlinkoDrop> => ipcRenderer.invoke('plinko:drop', bet, risk),
  getTrainerProfile: (): Promise<TrainerProfile> => ipcRenderer.invoke('profile:get'),
  getPokedex: (): Promise<PokedexEntry[]> => ipcRenderer.invoke('profile:pokedex'),
  checkForUpdate: (): Promise<UpdateCheckResult> => ipcRenderer.invoke('update:check'),
  // The player's own background picture as a data: URL (null = the plain one).
  getBackground: (): Promise<string | null> => ipcRenderer.invoke('background:get'),
  chooseBackground: (): Promise<string | null> => ipcRenderer.invoke('background:choose'),
  clearBackground: (): Promise<void> => ipcRenderer.invoke('background:clear'),
  installUpdate: (): Promise<void> => ipcRenderer.invoke('update:install'),
  // Download/unpack progress while an update installs; returns a function to stop listening.
  onUpdateProgress: (listener: (progress: UpdateProgress) => void): (() => void) => {
    const handler = (_event: unknown, progress: UpdateProgress): void => listener(progress)
    ipcRenderer.on('update:progress', handler)
    return () => ipcRenderer.removeListener('update:progress', handler)
  },
  listAutoSets: (species: string): Promise<AutoSetOption[]> => ipcRenderer.invoke('autoSets:list', species),
  buildAutoSet: (
    species: string,
    level: number,
    optionId: string,
    admin: boolean,
    heldItem?: string
  ): Promise<AutoSetResult> => ipcRenderer.invoke('autoSets:build', species, level, optionId, admin, heldItem),
  // Debug menu (admins only): sets the money and coins outright.
  debugSetWallet: (money: number, coins: number): Promise<{ money: number; coins: number }> =>
    ipcRenderer.invoke('debug:setWallet', money, coins),
  listShop: (): Promise<ShopItemEntry[]> => ipcRenderer.invoke('shop:list'),
  // Every key item, owned or still locked (the Bag | Shop window's Key Items tab).
  listKeyItems: (): Promise<KeyItemView[]> => ipcRenderer.invoke('shop:listKeyItems'),
  buyItem: (itemId: string, quantity: number): Promise<{ success: boolean; money: number }> =>
    ipcRenderer.invoke('shop:buy', itemId, quantity),
  listShopPrices: (): Promise<ShopPriceEntry[]> => ipcRenderer.invoke('shop:listPrices'),
  setShopPrice: (itemId: string, price: number | null): Promise<ShopPriceEntry[]> =>
    ipcRenderer.invoke('shop:setPrice', itemId, price),
  sellItem: (itemId: string): Promise<SellResult> => ipcRenderer.invoke('bag:sell', itemId),
  sellItems: (entries: ItemQuantity[]): Promise<SellResult> => ipcRenderer.invoke('bag:sellMany', entries),
  quickSellSelection: (): Promise<ItemQuantity[]> => ipcRenderer.invoke('bag:quickSellSelection'),
  openBagItem: (itemId: string): Promise<OpenItemResult> => ipcRenderer.invoke('bag:open', itemId),
  getRarityOdds: (source: RarityOddsSource): Promise<RarityOdds | null> => ipcRenderer.invoke('rarity:odds', source),
  getGalarFossilPartners: (itemId: string): Promise<GalarFossilPartner[]> =>
    ipcRenderer.invoke('fossil:galarPartners', itemId),
  restoreFossil: (itemId: string, secondItemId?: string): Promise<RestoreFossilResult> =>
    ipcRenderer.invoke('fossil:restore', itemId, secondItemId),
  getEditorOptions: (): Promise<EditorOptions> => ipcRenderer.invoke('dex:editorOptions'),
  // knownMoves: moves the Pokemon already knows - kept on the list whatever its level.
  getSpeciesInfo: (species: string, level: number, knownMoves?: string[]): Promise<SpeciesEditInfo> =>
    ipcRenderer.invoke('dex:speciesInfo', species, level, knownMoves),

  listWildDrops: (): Promise<WildDropEntry[]> => ipcRenderer.invoke('wildDrops:list'),
  setWildDrop: (species: string, drop: ItemDropConfig): Promise<WildDropEntry[]> =>
    ipcRenderer.invoke('wildDrops:set', species, drop),

  getProgression: (): Promise<ProgressionState> => ipcRenderer.invoke('progression:get'),
  setBossOrder: (steps: Omit<BossStep, 'id'>[]): Promise<ProgressionState> =>
    ipcRenderer.invoke('progression:setBossOrder', steps),
  setLevelCap: (levelCap: number): Promise<ProgressionState> => ipcRenderer.invoke('progression:setLevelCap', levelCap),

  resetProgression: (): Promise<ProgressionState> => ipcRenderer.invoke('progression:reset'),
  resetStats: (): Promise<{ box: BoxState; progression: ProgressionState; money: number }> =>
    ipcRenderer.invoke('stats:reset'),

  listTrainers: (): Promise<Trainer[]> => ipcRenderer.invoke('trainers:list'),
  addTrainer: (input: Omit<Trainer, 'id'>): Promise<Trainer> => ipcRenderer.invoke('trainers:add', input),
  updateTrainer: (id: string, input: Omit<Trainer, 'id'>): Promise<Trainer[]> =>
    ipcRenderer.invoke('trainers:update', id, input),
  deleteTrainer: (id: string): Promise<Trainer[]> => ipcRenderer.invoke('trainers:delete', id),
  // A copy of a trainer and all its teams.
  duplicateTrainer: (id: string): Promise<Trainer> => ipcRenderer.invoke('trainers:duplicate', id),

  listPremadeTeams: (): Promise<PremadeTeamSummary[]> => ipcRenderer.invoke('premadeTeams:list'),
  listPremadeTeamsForTrainer: (trainerId: string): Promise<PremadeTeamSummary[]> =>
    ipcRenderer.invoke('premadeTeams:listForTrainer', trainerId),
  addPremadeTeam: (trainerId: string, name: string): Promise<PremadeTeamSummary[]> =>
    ipcRenderer.invoke('premadeTeams:add', trainerId, name),
  renamePremadeTeam: (id: string, name: string): Promise<PremadeTeamSummary[]> =>
    ipcRenderer.invoke('premadeTeams:rename', id, name),
  deletePremadeTeam: (id: string): Promise<PremadeTeamSummary[]> => ipcRenderer.invoke('premadeTeams:delete', id),
  duplicatePremadeTeam: (id: string): Promise<PremadeTeamSummary[]> => ipcRenderer.invoke('premadeTeams:duplicate', id),
  addSpeciesToTeam: (teamId: string, species: string): Promise<PremadeTeamSummary[]> =>
    ipcRenderer.invoke('premadeTeams:addSpecies', teamId, species),
  removeTeamMon: (teamId: string, monId: string): Promise<PremadeTeamSummary[]> =>
    ipcRenderer.invoke('premadeTeams:removeMon', teamId, monId),
  reorderTeamMons: (teamId: string, monIds: string[]): Promise<PremadeTeamSummary[]> =>
    ipcRenderer.invoke('premadeTeams:reorder', teamId, monIds),
  getTeamMonSet: (teamId: string, monId: string): Promise<EditablePokemonSet> =>
    ipcRenderer.invoke('premadeTeams:getMon', teamId, monId),
  updateTeamMon: (teamId: string, monId: string, set: EditablePokemonSet): Promise<PremadeTeamSummary[]> =>
    ipcRenderer.invoke('premadeTeams:updateMon', teamId, monId, set),
  setPremadeTeamDrop: (teamId: string, drop: ItemDropConfig): Promise<PremadeTeamSummary[]> =>
    ipcRenderer.invoke('premadeTeams:setDrop', teamId, drop),
  setPremadeTeamDoubleBattle: (teamId: string, isDoubleBattle: boolean): Promise<PremadeTeamSummary[]> =>
    ipcRenderer.invoke('premadeTeams:setDoubleBattle', teamId, isDoubleBattle),
  // The "local folder" music source: pick a folder, then list the audio files in it.
  pickMusicFolder: (): Promise<string | null> => ipcRenderer.invoke('music:pickFolder'),
  listMusicFolder: (folder: string): Promise<LocalMusicFile[]> => ipcRenderer.invoke('music:listFolder', folder)
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
