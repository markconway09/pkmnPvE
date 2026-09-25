import { contextBridge, ipcRenderer } from 'electron'
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
  PokedexEntry,
  UpdateCheckResult,
  UpdateProgress,
  SessionInfo,
  RestoreFossilResult,
  SellResult,
  ShopItemEntry,
  ShopPriceEntry,
  SpeciesEditInfo,
  Trainer,
  WildDropEntry,
  WildLocationId
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
  submitChoice: (choice: string): Promise<BattleView> => ipcRenderer.invoke('battle:choose', choice),
  catchWildPokemon: (): Promise<CatchResult> => ipcRenderer.invoke('battle:catch'),
  runFromBattle: (): Promise<void> => ipcRenderer.invoke('battle:run'),
  getBattleEligibility: (): Promise<BattleEligibility> => ipcRenderer.invoke('battle:eligibility'),
  getMoveInfo: (id: string): Promise<MoveInfo | null> => ipcRenderer.invoke('dex:move', id),
  listBox: (): Promise<BoxState> => ipcRenderer.invoke('box:list'),
  addRandomBoxMon: (): Promise<BoxState> => ipcRenderer.invoke('box:addRandom'),
  addStarter: (species: string): Promise<BoxState> => ipcRenderer.invoke('box:addStarter', species),
  setTeam: (team: (string | null)[]): Promise<BoxState> => ipcRenderer.invoke('box:setTeam', team),
  getMonSet: (id: string): Promise<EditablePokemonSet> => ipcRenderer.invoke('box:getMon', id),
  updateBoxMon: (id: string, set: EditablePokemonSet, admin?: boolean): Promise<BoxState> =>
    ipcRenderer.invoke('box:updateMon', id, set, admin),
  evolveMon: (id: string, targetSpecies: string): Promise<BoxState> => ipcRenderer.invoke('box:evolve', id, targetSpecies),
  levelUpMon: (id: string): Promise<BoxState> => ipcRenderer.invoke('box:levelUp', id),
  toggleFavorite: (id: string): Promise<BoxState> => ipcRenderer.invoke('box:toggleFavorite', id),
  useShinyPatch: (id: string): Promise<BoxState> => ipcRenderer.invoke('box:useShinyPatch', id),
  listLoadouts: (): Promise<LoadoutView[]> => ipcRenderer.invoke('loadouts:list'),
  saveLoadout: (name: string): Promise<LoadoutView[]> => ipcRenderer.invoke('loadouts:save', name),
  updateLoadout: (id: string): Promise<LoadoutView[]> => ipcRenderer.invoke('loadouts:update', id),
  renameLoadout: (id: string, name: string): Promise<LoadoutView[]> => ipcRenderer.invoke('loadouts:rename', id, name),
  deleteLoadout: (id: string): Promise<LoadoutView[]> => ipcRenderer.invoke('loadouts:delete', id),
  applyLoadout: (id: string): Promise<BoxState> => ipcRenderer.invoke('loadouts:apply', id),
  listBag: (): Promise<BagItemView[]> => ipcRenderer.invoke('bag:list'),
  useExpCandy: (itemId: string): Promise<ExpGainResult[]> => ipcRenderer.invoke('bag:useExpCandy', itemId),
  getMoney: (): Promise<number> => ipcRenderer.invoke('money:get'),
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
  buildAutoSet: (species: string, level: number, optionId: string, admin: boolean): Promise<AutoSetResult> =>
    ipcRenderer.invoke('autoSets:build', species, level, optionId, admin),
  debugAddMoney: (amount: number): Promise<number> => ipcRenderer.invoke('money:debugAdd', amount),
  listShop: (): Promise<ShopItemEntry[]> => ipcRenderer.invoke('shop:list'),
  buyItem: (itemId: string, quantity: number): Promise<{ success: boolean; money: number }> =>
    ipcRenderer.invoke('shop:buy', itemId, quantity),
  listShopPrices: (): Promise<ShopPriceEntry[]> => ipcRenderer.invoke('shop:listPrices'),
  setShopPrice: (itemId: string, price: number | null): Promise<ShopPriceEntry[]> =>
    ipcRenderer.invoke('shop:setPrice', itemId, price),
  sellItem: (itemId: string): Promise<SellResult> => ipcRenderer.invoke('bag:sell', itemId),
  openBagItem: (itemId: string): Promise<OpenItemResult> => ipcRenderer.invoke('bag:open', itemId),
  getGalarFossilPartners: (itemId: string): Promise<GalarFossilPartner[]> =>
    ipcRenderer.invoke('fossil:galarPartners', itemId),
  restoreFossil: (itemId: string, secondItemId?: string): Promise<RestoreFossilResult> =>
    ipcRenderer.invoke('fossil:restore', itemId, secondItemId),
  getEditorOptions: (): Promise<EditorOptions> => ipcRenderer.invoke('dex:editorOptions'),
  getSpeciesInfo: (species: string, level: number): Promise<SpeciesEditInfo> =>
    ipcRenderer.invoke('dex:speciesInfo', species, level),

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

  listPremadeTeams: (): Promise<PremadeTeamSummary[]> => ipcRenderer.invoke('premadeTeams:list'),
  listPremadeTeamsForTrainer: (trainerId: string): Promise<PremadeTeamSummary[]> =>
    ipcRenderer.invoke('premadeTeams:listForTrainer', trainerId),
  addPremadeTeam: (trainerId: string, name: string): Promise<PremadeTeamSummary[]> =>
    ipcRenderer.invoke('premadeTeams:add', trainerId, name),
  renamePremadeTeam: (id: string, name: string): Promise<PremadeTeamSummary[]> =>
    ipcRenderer.invoke('premadeTeams:rename', id, name),
  deletePremadeTeam: (id: string): Promise<PremadeTeamSummary[]> => ipcRenderer.invoke('premadeTeams:delete', id),
  addRandomTeamMon: (teamId: string): Promise<PremadeTeamSummary[]> =>
    ipcRenderer.invoke('premadeTeams:addRandomMon', teamId),
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
    ipcRenderer.invoke('premadeTeams:setDoubleBattle', teamId, isDoubleBattle)
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
