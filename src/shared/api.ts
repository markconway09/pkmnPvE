/**
 * Everything the game's screens can ask of the game, as window.api. How a call gets
 * there is the transport's business: Electron's IPC on the desktop (preload), a
 * direct function call inside the page on mobile.
 */
import type { MissionClaimResult, MissionsState } from './missions'
import type { OnlineDraftTeam, OnlinePlayer, OnlineSelf, OnlineTeam, OnlineViews } from './online'
import type { RarityOddsReport, RarityOddsSource } from './rarity'
import type { LocalMusicFile } from './music'
import type { UiScaleChoice, UiScaleState } from './ui-scale'
import type { CoinBalance, DailyCoinMon, DailyCoinMonPurchase, DailyCoinOffer, DailyPetalDeals, SlotRules, SlotSpinResult } from './slots'
import type { BlackjackView } from './blackjack'
import type { DiceRoll } from './dice'
import type { AchievementClaimResult, AchievementsState } from './achievements'
import type { CloudSave, CloudStatus } from './cloud'
import type { RouletteSpin } from './roulette'
import type { GameCornerPerks } from './titles'
import type { DexNavCandidate, DexNavState } from './dexnav'
import type { PlinkoDrop, PlinkoRisk } from './plinko'
import type { ChaosModifierTarget, ChaosTutorMove, DraftFormat, DraftView } from './draft'
import type { SkillCheckResult, TmInfo, TmQuickCheckResult, TmSearchProgress, TmSearchStart, TmShopView, TmState } from './tms'
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
  PokedexRegistration,
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
  CompanionSizeChoice,
  MergeBoosts
} from './battle-types'

export interface ApiTransport {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  invoke(channel: string, ...args: unknown[]): Promise<any>
  /** Listens for a push message from the game; returns a function to stop listening. */
  on<T>(channel: string, listener: (payload: T) => void): () => void
}

export function createApi(transport: ApiTransport) {
  return {
    getSession: (): Promise<SessionInfo> => transport.invoke('auth:session'),
    login: (username: string, remember: boolean): Promise<SessionInfo> => transport.invoke('auth:login', username, remember),
    logout: (): Promise<SessionInfo> => transport.invoke('auth:logout'),
    setTrainerSprite: (spriteId: string): Promise<SessionInfo> => transport.invoke('profile:setTrainerSprite', spriteId),
    startPlayerBattle: (username: string, doubles: boolean, stars = false): Promise<BattleView> =>
      transport.invoke('battle:startPlayer', username, doubles, stars),
    startBattle: (location?: WildLocationId, levelCap?: number): Promise<BattleView> =>
      transport.invoke('battle:start', location, levelCap),
    startTrainerBattle: (boss: boolean, rematchTrainerId?: string): Promise<BattleView> =>
      transport.invoke('battle:startTrainer', boss, rematchTrainerId),
    getBossRematchList: (): Promise<BossRematchInfo[]> => transport.invoke('battle:bossRematchList'),
    getRun: (): Promise<RunView | null> => transport.invoke('run:get'),
    getDraft: (): Promise<DraftView | null> => transport.invoke('draft:get'),
    getDraftDailyWinClaimed: (): Promise<boolean> => transport.invoke('draft:dailyWinClaimed'),
    getDraftEntryFee: (): Promise<number> => transport.invoke('draft:entryFee'),
    startDraft: (format: DraftFormat): Promise<DraftView> => transport.invoke('draft:start', format),
    pickDraftMon: (index: number): Promise<DraftView> => transport.invoke('draft:pick', index),
    abandonDraft: (): Promise<DraftView> => transport.invoke('draft:abandon'),
    rerollDraftPack: (): Promise<DraftView> => transport.invoke('draft:reroll'),
    getChaosItems: (): Promise<{ id: string; name: string; description: string; spritenum: number }[]> =>
      transport.invoke('draft:chaosItems'),
    swapChaosItem: (pick: number, item: string): Promise<DraftView> => transport.invoke('draft:chaosItemSwap', pick, item),
    getChaosTutorMoves: (pick: number): Promise<ChaosTutorMove[]> => transport.invoke('draft:chaosTutor', pick),
    getChaosAbilities: (): Promise<{ id: string; name: string; description: string }[]> =>
      transport.invoke('draft:chaosAbilities'),
    chooseChaosModifier: (index: number, target?: ChaosModifierTarget): Promise<DraftView> =>
      transport.invoke('draft:chaosModifier', index, target),
    startDraftBattle: (bring: number[]): Promise<BattleView> => transport.invoke('draft:battle', bring),
    // Generations with a Roguelite boss of every class - the ones a run can be set to.
    getRunGenerations: (): Promise<number[]> => transport.invoke('run:generations'),
    startRun: (boxMonId: string, difficulty: RunDifficulty, generation: number | null, keepMoves: boolean): Promise<RunView> =>
      transport.invoke('run:start', boxMonId, difficulty, generation, keepMoves),
    previewStarterMoves: (boxMonId: string): Promise<RunMovesPreview> => transport.invoke('run:previewStarterMoves', boxMonId),
    previewEvolutionMoves: (runMonId: string, targetSpecies: string): Promise<RunMovesPreview> =>
      transport.invoke('run:previewEvolution', runMonId, targetSpecies),
    getRunMonEditInfo: (runMonId: string): Promise<RunMonEditInfo> => transport.invoke('run:editInfo', runMonId),
    runSmogonSet: (runMonId: string, optionId: string): Promise<string[]> =>
      transport.invoke('run:smogonSet', runMonId, optionId),
    updateRunMon: (runMonId: string, input: RunMonEdit): Promise<RunView> => transport.invoke('run:updateMon', runMonId, input),
    forfeitRun: (): Promise<RunView> => transport.invoke('run:forfeit'),
    // A floor's option, by its place in the run's list of choices.
    chooseRunNode: (index: number): Promise<RunChoiceResult> => transport.invoke('run:choose', index),
    giveRunItem: (itemId: string, runMonId: string): Promise<RunView> => transport.invoke('run:giveItem', itemId, runMonId),
    skipRunItem: (): Promise<RunView> => transport.invoke('run:skipItem'),
    giveRunAbility: (abilityId: string, runMonId: string): Promise<RunView> =>
      transport.invoke('run:giveAbility', abilityId, runMonId),
    teachRunMove: (moveId: string, runMonId: string, replaceMoveId: string | null): Promise<RunView> =>
      transport.invoke('run:teachMove', moveId, runMonId, replaceMoveId),
    skipRunPick: (): Promise<RunView> => transport.invoke('run:skipPick'),
    swapRunMon: (runMonId: string): Promise<RunView> => transport.invoke('run:swapMon', runMonId),
    swapRunTeam: (): Promise<RunView> => transport.invoke('run:swapTeam'),
    skipRunSwap: (): Promise<RunView> => transport.invoke('run:skipSwap'),
    // A beaten villain's reward: one of its Pokemon by place, in someone's place on a full team.
    takeRunRewardMon: (index: number, replaceRunMonId?: string): Promise<RunView> =>
      transport.invoke('run:takeRewardMon', index, replaceRunMonId),
    skipRunRewardMon: (): Promise<RunView> => transport.invoke('run:skipRewardMon'),
    // Roguelite consumables (outside battle) and a boss floor's shop.
    useRunFullRestore: (runMonId: string): Promise<RunView> => transport.invoke('run:fullRestore', runMonId),
    // With a full team, replaceId is the team member who leaves (to the fainted) to make room.
    useRunRevive: (faintedId: string, replaceId?: string): Promise<RunView> =>
      transport.invoke('run:revive', faintedId, replaceId),
    useRunAbilityCapsule: (runMonId: string, abilityId: string): Promise<RunView> =>
      transport.invoke('run:abilityCapsule', runMonId, abilityId),
    // Undoes a New Ability pick, back to the ability it came with.
    resetRunAbility: (runMonId: string): Promise<RunView> => transport.invoke('run:resetAbility', runMonId),
    buyRunConsumable: (id: RunConsumableId): Promise<RunView> => transport.invoke('run:buyConsumable', id),
    // A boss shop's Rare Candy, used on the spot on this team member (past the cap).
    buyRunRareCandy: (runMonId: string): Promise<RunView> => transport.invoke('run:buyRareCandy', runMonId),
    buyRunShopTile: (tile: RunShopTile): Promise<RunView> => transport.invoke('run:buyShopTile', tile),
    listAllAbilities: (): Promise<{ id: string; name: string }[]> => transport.invoke('dex:abilities'),
    rerollRunItems: (): Promise<RunView> => transport.invoke('run:rerollItems'),
    evolveRunMon: (runMonId: string, targetSpecies: string, newMoves: boolean): Promise<RunView> =>
      transport.invoke('run:evolve', runMonId, targetSpecies, newMoves),
    placeDisplacedItem: (runMonId: string | null): Promise<RunView> => transport.invoke('run:placeDisplacedItem', runMonId),
    moveRunItem: (fromMonId: string, toMonId: string): Promise<RunView> => transport.invoke('run:moveItem', fromMonId, toMonId),
    reorderRunTeam: (runMonIds: string[]): Promise<RunView> => transport.invoke('run:reorder', runMonIds),
    submitChoice: (choice: string): Promise<BattleView> => transport.invoke('battle:choose', choice),
    // replaceRunMonId: in a run with a full team, who the new Pokemon replaces.
    catchWildPokemon: (replaceRunMonId?: string): Promise<CatchResult> => transport.invoke('battle:catch', replaceRunMonId),
    // Daily missions.
    getMissions: (): Promise<MissionsState> => transport.invoke('missions:get'),
    claimMission: (slot: number): Promise<MissionClaimResult> => transport.invoke('missions:claim', slot),
    claimMissionBonus: (): Promise<MissionClaimResult> => transport.invoke('missions:claimBonus'),
    rerollMission: (slot: number): Promise<MissionsState> => transport.invoke('missions:reroll', slot),
    // A mission's progress changed (the names of any just finished).
    onMissionsChanged: (listener: (finished: string[]) => void): (() => void) => {
      return transport.on('missions:changed', listener)
    },
    // A Max Raid (uses up a Raid Crystal).
    startRaidBattle: (): Promise<BattleView> => transport.invoke('battle:startRaid'),
    // Every Pokemon a Max Raid can bring, registered or not (the Max Raid page's carousel).
    getRaidBosses: (): Promise<RaidBossPreview[]> => transport.invoke('raid:bosses'),
    runFromBattle: (): Promise<void> => transport.invoke('battle:run'),
    // Gives up a draft match or a Roguelite fight; the view comes back already ended.
    forfeitBattle: (): Promise<BattleView> => transport.invoke('battle:forfeit'),
    getBattleEligibility: (): Promise<BattleEligibility> => transport.invoke('battle:eligibility'),
    // Online battles with a friend: who this player is (and their team), and - on the
    // host's copy, which runs the battle - starting it, each side's choices and forfeits.
    getOnlineSelf: (): Promise<OnlineSelf> => transport.invoke('online:self'),
    startOnlineBattle: (friend: OnlinePlayer, friendTeam: OnlineTeam, doubles: boolean, stars: boolean): Promise<OnlineViews> =>
      transport.invoke('online:start', friend, friendTeam, doubles, stars),
    chooseOnline: (side: 0 | 1, choice: string): Promise<void> => transport.invoke('online:choose', side, choice),
    forfeitOnline: (side: 0 | 1): Promise<void> => transport.invoke('online:forfeit', side),
    endOnlineBattle: (): Promise<void> => transport.invoke('online:end'),
    // Online chaos draft: this copy's side of it (the same steps as a solo chaos draft),
    // the teams swapped once each player is done picking, and - on the host's copy - the
    // battle with both. The host's start rolls the tiers; the friend's is given them.
    startOnlineDraft: (setFormats?: string[]): Promise<{ view: DraftView; setFormats: string[] }> =>
      transport.invoke('online:draftStart', setFormats),
    getOnlineDraft: (): Promise<DraftView | null> => transport.invoke('online:draftGet'),
    pickOnlineDraftMon: (index: number): Promise<DraftView> => transport.invoke('online:draftPick', index),
    rerollOnlineDraft: (): Promise<DraftView> => transport.invoke('online:draftReroll'),
    swapOnlineDraftItem: (pick: number, item: string): Promise<DraftView> => transport.invoke('online:draftItemSwap', pick, item),
    getOnlineDraftTutorMoves: (pick: number): Promise<ChaosTutorMove[]> => transport.invoke('online:draftTutor', pick),
    chooseOnlineDraftModifier: (index: number, target?: ChaosModifierTarget): Promise<DraftView> =>
      transport.invoke('online:draftModifier', index, target),
    getOnlineDraftTeam: (): Promise<OnlineDraftTeam> => transport.invoke('online:draftTeam'),
    setOnlineDraftOpponent: (stage: number, friend: OnlinePlayer, team: OnlineDraftTeam): Promise<DraftView> =>
      transport.invoke('online:draftOpponent', stage, friend, team),
    startOnlineDraftBattle: (friend: OnlinePlayer, hostOrder: number[], guestOrder: number[]): Promise<OnlineViews> =>
      transport.invoke('online:draftBattle', friend, hostOrder, guestOrder),
    // true won, false lost, null a tie.
    finishOnlineDraftBattle: (result: boolean | null): Promise<DraftView> => transport.invoke('online:draftResult', result),
    endOnlineDraft: (): Promise<void> => transport.invoke('online:draftEnd'),
    // Both screens, each time the host's battle moves on.
    onOnlineViews: (listener: (views: OnlineViews) => void): (() => void) => {
      return transport.on('online:views', listener)
    },
    getMoveInfo: (id: string): Promise<MoveInfo | null> => transport.invoke('dex:move', id),
    listBox: (): Promise<BoxState> => transport.invoke('box:list'),
    addRandomBoxMon: (): Promise<BoxState> => transport.invoke('box:addRandom'),
    // Debug: a chosen species at a chosen level, shiny or not.
    addBoxMon: (species: string, level: number, shiny: boolean): Promise<BoxState> =>
      transport.invoke('box:addMon', species, level, shiny),
    addStarter: (species: string): Promise<BoxState> => transport.invoke('box:addStarter', species),
    setTeam: (team: (string | null)[]): Promise<BoxState> => transport.invoke('box:setTeam', team),
    getMonSet: (id: string): Promise<EditablePokemonSet> => transport.invoke('box:getMon', id),
    updateBoxMon: (id: string, set: EditablePokemonSet, admin?: boolean): Promise<BoxState> =>
      transport.invoke('box:updateMon', id, set, admin),
    evolveMon: (id: string, targetSpecies: string): Promise<BoxState> => transport.invoke('box:evolve', id, targetSpecies),
    levelUpMon: (id: string): Promise<BoxState> => transport.invoke('box:levelUp', id),
    setEverstone: (id: string, locked: boolean): Promise<BoxState> => transport.invoke('box:setEverstone', id, locked),
    toggleFavorite: (id: string): Promise<BoxState> => transport.invoke('box:toggleFavorite', id),
    // The companion beside the team: a max-friendship Pokemon out of the box, and back again.
    setCompanion: (id: string): Promise<BoxState> => transport.invoke('box:setCompanion', id),
    returnCompanion: (): Promise<BoxState> => transport.invoke('box:returnCompanion'),
    setCompanionSize: (size: CompanionSizeChoice): Promise<BoxState> => transport.invoke('box:setCompanionSize', size),
    useShinyPatch: (id: string): Promise<BoxState> => transport.invoke('box:useShinyPatch', id),
    useFriendshipPetal: (id: string): Promise<BoxState> => transport.invoke('box:useFriendshipPetal', id),
    changeForm: (id: string, form: string): Promise<BoxState> => transport.invoke('box:changeForm', id, form),
    fuseMon: (id: string, partnerId: string): Promise<BoxState> => transport.invoke('box:fuse', id, partnerId),
    unfuseMon: (id: string): Promise<BoxState> => transport.invoke('box:unfuse', id),
    // Merges duplicates into a Pokemon (see mergeMons).
    mergeMons: (keeperId: string, fodderIds: string[]): Promise<BoxState> =>
      transport.invoke('box:merge', keeperId, fodderIds),
    // The expanded box's "select to merge" (see mergeSelectedMons).
    mergeSelectedMons: (
      ids: string[],
      boosts?: MergeBoosts
    ): Promise<{ box: BoxState; merged: number; results: { species: string; stars: number }[] }> =>
      transport.invoke('box:mergeSelected', ids, boosts),
    // A Random Pokemon's "Auto merge": straight into its best keeper (see autoMergeMon).
    autoMergeMon: (monId: string): Promise<{ box: BoxState; species: string; stars: number }> =>
      transport.invoke('box:autoMerge', monId),
    listLoadouts: (): Promise<LoadoutView[]> => transport.invoke('loadouts:list'),
    saveLoadout: (name: string): Promise<LoadoutView[]> => transport.invoke('loadouts:save', name),
    updateLoadout: (id: string): Promise<LoadoutView[]> => transport.invoke('loadouts:update', id),
    renameLoadout: (id: string, name: string): Promise<LoadoutView[]> => transport.invoke('loadouts:rename', id, name),
    deleteLoadout: (id: string): Promise<LoadoutView[]> => transport.invoke('loadouts:delete', id),
    applyLoadout: (id: string): Promise<BoxState> => transport.invoke('loadouts:apply', id),
    listBag: (): Promise<BagItemView[]> => transport.invoke('bag:list'),
    getBagItem: (itemId: string): Promise<BagItemView | null> => transport.invoke('bag:item', itemId),
    useExpCandy: (itemId: string): Promise<ExpGainResult[]> => transport.invoke('bag:useExpCandy', itemId),
    useExpCandiesUntilCap: (itemId: string): Promise<{ used: number; results: ExpGainResult[]; allCapped: boolean }> =>
      transport.invoke('bag:useExpCandiesUntilCap', itemId),
    getMoney: (): Promise<number> => transport.invoke('money:get'),
    // `found`: evolution items the Alchemist title turned up (their names).
    sellMon: (id: string): Promise<{ sold: number; species: string; money: number; box: BoxState; found: string[] }> =>
      transport.invoke('box:sell', id),
    sellMons: (ids: string[]): Promise<{ sold: number; count: number; money: number; box: BoxState; found: string[] }> =>
      transport.invoke('box:sellMany', ids),
    getCoins: (): Promise<number> => transport.invoke('coins:get'),
    getAchievements: (): Promise<AchievementsState> => transport.invoke('achievements:get'),
    // Cloud saves on Google Drive, for the logged-in player.
    getCloudStatus: (): Promise<CloudStatus> => transport.invoke('cloud:status'),
    connectCloud: (): Promise<CloudStatus> => transport.invoke('cloud:connect'),
    disconnectCloud: (): Promise<CloudStatus> => transport.invoke('cloud:disconnect'),
    listCloudSaves: (): Promise<CloudSave[]> => transport.invoke('cloud:list'),
    exportToCloud: (): Promise<CloudSave[]> => transport.invoke('cloud:export'),
    importFromCloud: (fileId: string): Promise<void> => transport.invoke('cloud:import', fileId),
    // The save as a .pkmnsave file, to carry between the PC and the phone.
    exportSaveFile: (): Promise<{ name: string; data: Uint8Array }> => transport.invoke('save:exportFile'),
    importSaveFile: (data: Uint8Array): Promise<void> => transport.invoke('save:importFile', data),
    claimAchievement: (id: string): Promise<AchievementClaimResult> => transport.invoke('achievements:claim', id),
    setAchievementTitle: (title: string | null): Promise<AchievementsState> =>
      transport.invoke('achievements:setTitle', title),
    // Turns a claimed title's perk on or off (clashing titles move with it).
    setTitleActive: (title: string, active: boolean): Promise<AchievementsState> =>
      transport.invoke('achievements:setTitleActive', title, active),
    // Achievements just unlocked (their names); returns a function to stop listening.
    onAchievementsUnlocked: (listener: (names: string[]) => void): (() => void) => {
      return transport.on('achievements:unlocked', listener)
    },
    buyCoins: (amount: number): Promise<CoinBalance> => transport.invoke('coins:buy', amount),
    buyCoinPrize: (itemId: string, quantity = 1): Promise<CoinBalance & { itemName: string; quantity: number }> =>
      transport.invoke('coins:prize', itemId, quantity),
    // The Coin Shop's once-a-day discounted coins.
    getDailyCoinOffer: (): Promise<DailyCoinOffer> => transport.invoke('coins:dailyOffer'),
    buyDailyCoinOffer: (): Promise<CoinBalance> => transport.invoke('coins:buyDailyOffer'),
    getDailyPrizesBought: (): Promise<string[]> => transport.invoke('coins:dailyPrizesBought'),
    getDailyPetalDeals: (): Promise<DailyPetalDeals> => transport.invoke('coins:petalDeals'),
    claimFreePetals: (): Promise<DailyPetalDeals> => transport.invoke('coins:claimFreePetals'),
    buyPetalPack: (): Promise<CoinBalance & { deals: DailyPetalDeals }> => transport.invoke('coins:buyPetalPack'),
    // The Coin Shop's Pokemon of the day, bought once a day at 2 stars.
    getDailyCoinMon: (): Promise<DailyCoinMon> => transport.invoke('coins:dailyMon'),
    buyDailyCoinMon: (): Promise<DailyCoinMonPurchase> => transport.invoke('coins:buyDailyMon'),
    getTmCatalog: (): Promise<TmInfo[]> => transport.invoke('tm:catalog'),
    getTmState: (): Promise<TmState> => transport.invoke('tm:state'),
    startTmSearch: (location: WildLocationId): Promise<TmSearchStart> => transport.invoke('tm:startSearch', location),
    reportTmSearchCheck: (result: SkillCheckResult, timedOut = false): Promise<TmSearchProgress> =>
      transport.invoke('tm:searchCheck', result, timedOut),
    abandonTmSearch: (): Promise<void> => transport.invoke('tm:abandonSearch'),
    takeTmQuickCheck: (result: SkillCheckResult, timedOut = false): Promise<TmQuickCheckResult> =>
      transport.invoke('tm:quickCheck', result, timedOut),
    getTmShop: (): Promise<TmShopView> => transport.invoke('tm:shop'),
    buyTm: (moveId: string): Promise<{ coins: number; shop: TmShopView }> => transport.invoke('tm:buy', moveId),
    buyTmScanner: (): Promise<{ coins: number; shop: TmShopView }> => transport.invoke('tm:buyScanner'),
    spinSlots: (bet: number): Promise<SlotSpinResult> => transport.invoke('slots:spin', bet),
    getSlotRules: (): Promise<SlotRules> => transport.invoke('slots:rules'),
    getBlackjack: (): Promise<BlackjackView> => transport.invoke('blackjack:view'),
    dealBlackjack: (bet: number): Promise<BlackjackView> => transport.invoke('blackjack:deal', bet),
    hitBlackjack: (): Promise<BlackjackView> => transport.invoke('blackjack:hit'),
    standBlackjack: (): Promise<BlackjackView> => transport.invoke('blackjack:stand'),
    doubleBlackjack: (): Promise<BlackjackView> => transport.invoke('blackjack:double'),
    // Bets the roll lands over (or under) the divider at target.
    rollDice: (bet: number, target: number, over: boolean): Promise<DiceRoll> => transport.invoke('dice:roll', bet, target, over),
    // What the player's titles change in the Game Corner (the bet cap, Plinko's edges).
    getGameCornerPerks: (): Promise<GameCornerPerks> => transport.invoke('gamecorner:perks'),
    getRouletteHistory: (): Promise<number[]> => transport.invoke('roulette:history'),
    // The bets on the board: bet key ('n:17', 'red', 'dozen:2'...) -> coins on it.
    spinRoulette: (bets: Record<string, number>): Promise<RouletteSpin> => transport.invoke('roulette:spin', bets),
    dropPlinko: (bet: number, risk: PlinkoRisk): Promise<PlinkoDrop> => transport.invoke('plinko:drop', bet, risk),
    getTrainerProfile: (): Promise<TrainerProfile> => transport.invoke('profile:get'),
    getPokedex: (): Promise<PokedexEntry[]> => transport.invoke('profile:pokedex'),
    // Pokedex entries just registered for the first time; returns a function to stop listening.
    onPokedexRegistered: (listener: (entries: PokedexRegistration[]) => void): (() => void) => {
      return transport.on('pokedex:registered', listener)
    },
    checkForUpdate: (): Promise<UpdateCheckResult> => transport.invoke('update:check'),
    // The player's own background picture as a data: URL (null = the plain one).
    getBackground: (): Promise<string | null> => transport.invoke('background:get'),
    chooseBackground: (): Promise<string | null> => transport.invoke('background:choose'),
    clearBackground: (): Promise<void> => transport.invoke('background:clear'),
    // The phone's: a picture from the gallery, already shrunk, as a data: URL.
    setBackground: (dataUrl: string): Promise<string> => transport.invoke('background:set', dataUrl),
    installUpdate: (): Promise<void> => transport.invoke('update:install'),
    // Download/unpack progress while an update installs; returns a function to stop listening.
    onUpdateProgress: (listener: (progress: UpdateProgress) => void): (() => void) => {
      return transport.on('update:progress', listener)
    },
    listAutoSets: (species: string): Promise<AutoSetOption[]> => transport.invoke('autoSets:list', species),
    buildAutoSet: (
      species: string,
      level: number,
      optionId: string,
      admin: boolean,
      heldItem?: string
    ): Promise<AutoSetResult> => transport.invoke('autoSets:build', species, level, optionId, admin, heldItem),
    // Debug (admins only): a Max Raid against a chosen species, at a chosen level.
    debugStartRaid: (species: string, level: number, shiny: boolean): Promise<BattleView> =>
      transport.invoke('debug:startRaid', species, level, shiny),
    // Debug menu (admins only): sets the money and coins outright.
    debugSetWallet: (money: number, coins: number): Promise<{ money: number; coins: number }> =>
      transport.invoke('debug:setWallet', money, coins),
    listShop: (): Promise<ShopItemEntry[]> => transport.invoke('shop:list'),
    // Every key item, owned or still locked (the Bag | Shop window's Key Items tab).
    listKeyItems: (): Promise<KeyItemView[]> => transport.invoke('shop:listKeyItems'),
    buyItem: (itemId: string, quantity: number): Promise<{ success: boolean; money: number }> =>
      transport.invoke('shop:buy', itemId, quantity),
    listShopPrices: (): Promise<ShopPriceEntry[]> => transport.invoke('shop:listPrices'),
    setShopPrice: (itemId: string, price: number | null): Promise<ShopPriceEntry[]> =>
      transport.invoke('shop:setPrice', itemId, price),
    sellItem: (itemId: string): Promise<SellResult> => transport.invoke('bag:sell', itemId),
    sellItems: (entries: ItemQuantity[]): Promise<SellResult> => transport.invoke('bag:sellMany', entries),
    quickSellSelection: (): Promise<ItemQuantity[]> => transport.invoke('bag:quickSellSelection'),
    openBagItem: (itemId: string): Promise<OpenItemResult> => transport.invoke('bag:open', itemId),
    getRarityOdds: (source: RarityOddsSource): Promise<RarityOddsReport | null> => transport.invoke('rarity:odds', source),
    getGalarFossilPartners: (itemId: string): Promise<GalarFossilPartner[]> =>
      transport.invoke('fossil:galarPartners', itemId),
    restoreFossil: (itemId: string, secondItemId?: string): Promise<RestoreFossilResult> =>
      transport.invoke('fossil:restore', itemId, secondItemId),
    getEditorOptions: (): Promise<EditorOptions> => transport.invoke('dex:editorOptions'),
    // knownMoves: moves the Pokemon already knows - kept on the list whatever its level.
    getSpeciesInfo: (species: string, level: number, knownMoves?: string[]): Promise<SpeciesEditInfo> =>
      transport.invoke('dex:speciesInfo', species, level, knownMoves),

    // The DexNav: the hunt and its chain, what can be hunted, and picking (or clearing) the target.
    getDexNavState: (): Promise<DexNavState> => transport.invoke('dexnav:state'),
    listDexNavCandidates: (): Promise<DexNavCandidate[]> => transport.invoke('dexnav:candidates'),
    setDexNavTarget: (species: string | null): Promise<DexNavState> => transport.invoke('dexnav:setTarget', species),
    listWildDrops: (): Promise<WildDropEntry[]> => transport.invoke('wildDrops:list'),
    setWildDrop: (species: string, drop: ItemDropConfig): Promise<WildDropEntry[]> =>
      transport.invoke('wildDrops:set', species, drop),

    getProgression: (): Promise<ProgressionState> => transport.invoke('progression:get'),
    setBossOrder: (steps: Omit<BossStep, 'id'>[]): Promise<ProgressionState> =>
      transport.invoke('progression:setBossOrder', steps),
    setLevelCap: (levelCap: number): Promise<ProgressionState> => transport.invoke('progression:setLevelCap', levelCap),

    resetProgression: (): Promise<ProgressionState> => transport.invoke('progression:reset'),
    resetStats: (): Promise<{ box: BoxState; progression: ProgressionState; money: number }> =>
      transport.invoke('stats:reset'),

    listTrainers: (): Promise<Trainer[]> => transport.invoke('trainers:list'),
    addTrainer: (input: Omit<Trainer, 'id'>): Promise<Trainer> => transport.invoke('trainers:add', input),
    updateTrainer: (id: string, input: Omit<Trainer, 'id'>): Promise<Trainer[]> =>
      transport.invoke('trainers:update', id, input),
    deleteTrainer: (id: string): Promise<Trainer[]> => transport.invoke('trainers:delete', id),
    // A copy of a trainer and all its teams.
    duplicateTrainer: (id: string): Promise<Trainer> => transport.invoke('trainers:duplicate', id),

    listPremadeTeams: (): Promise<PremadeTeamSummary[]> => transport.invoke('premadeTeams:list'),
    listPremadeTeamsForTrainer: (trainerId: string): Promise<PremadeTeamSummary[]> =>
      transport.invoke('premadeTeams:listForTrainer', trainerId),
    addPremadeTeam: (trainerId: string, name: string): Promise<PremadeTeamSummary[]> =>
      transport.invoke('premadeTeams:add', trainerId, name),
    renamePremadeTeam: (id: string, name: string): Promise<PremadeTeamSummary[]> =>
      transport.invoke('premadeTeams:rename', id, name),
    deletePremadeTeam: (id: string): Promise<PremadeTeamSummary[]> => transport.invoke('premadeTeams:delete', id),
    duplicatePremadeTeam: (id: string): Promise<PremadeTeamSummary[]> => transport.invoke('premadeTeams:duplicate', id),
    addSpeciesToTeam: (teamId: string, species: string): Promise<PremadeTeamSummary[]> =>
      transport.invoke('premadeTeams:addSpecies', teamId, species),
    removeTeamMon: (teamId: string, monId: string): Promise<PremadeTeamSummary[]> =>
      transport.invoke('premadeTeams:removeMon', teamId, monId),
    reorderTeamMons: (teamId: string, monIds: string[]): Promise<PremadeTeamSummary[]> =>
      transport.invoke('premadeTeams:reorder', teamId, monIds),
    getTeamMonSet: (teamId: string, monId: string): Promise<EditablePokemonSet> =>
      transport.invoke('premadeTeams:getMon', teamId, monId),
    updateTeamMon: (teamId: string, monId: string, set: EditablePokemonSet): Promise<PremadeTeamSummary[]> =>
      transport.invoke('premadeTeams:updateMon', teamId, monId, set),
    setPremadeTeamDrop: (teamId: string, drop: ItemDropConfig): Promise<PremadeTeamSummary[]> =>
      transport.invoke('premadeTeams:setDrop', teamId, drop),
    setPremadeTeamDoubleBattle: (teamId: string, isDoubleBattle: boolean): Promise<PremadeTeamSummary[]> =>
      transport.invoke('premadeTeams:setDoubleBattle', teamId, isDoubleBattle),
    // The "local folder" music source: pick a folder, then list the audio files in it.
    pickMusicFolder: (): Promise<string | null> => transport.invoke('music:pickFolder'),
    listMusicFolder: (folder: string): Promise<LocalMusicFile[]> => transport.invoke('music:listFolder', folder),
    // Options → Screen size: how big the game draws (Auto fits it to the screen).
    getUiScale: (): Promise<UiScaleState> => transport.invoke('uiScale:get'),
    setUiScale: (choice: UiScaleChoice): Promise<UiScaleState> => transport.invoke('uiScale:set', choice)
  }
}

export type Api = ReturnType<typeof createApi>
