import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'node:path'
import type {
  BattleEligibility,
  BossRematchInfo,
  RunChoiceResult,
  RunDifficulty,
  RunView,
  BossStep,
  EditablePokemonSet,
  ItemDropConfig,
  NextBossInfo,
  Trainer
} from '../shared/battle-types'
import type { WildLocationId } from '../shared/battle-types'
import { WILD_LOCATIONS, WILD_RANDOM_DROP_CHANCE, normalizeUsername, usernameProblem } from '../shared/battle-types'
import { WildBattle, getMoveInfo } from './showdown/battle-runtime'
import {
  addRandomMon,
  addStarter,
  evolveMon,
  getBoxState,
  getPokedex,
  getMonSet,
  getTeamPokemonSets,
  highestLevelOf,
  levelUpMon,
  toggleFavorite,
  useShinyPatch,
  readSavedTeamOf,
  scaleTeamToLevel,
  resetBox,
  setTeam,
  updateMon,
  useExpCandy
} from './showdown/box-store'
import { getBagState, resetBag } from './showdown/bag-store'
import { applyLoadout, deleteLoadout, listLoadouts, renameLoadout, saveLoadout, updateLoadout } from './showdown/loadout-store'
import {
  generateRandomTrainerTeam,
  generateLabWildMon,
  generateRandomWildMon,
  getEditorOptions,
  getSpeciesEditInfo
} from './showdown/sim-access'
import { addTrainer, deleteTrainer, listTrainers, updateTrainer } from './showdown/trainer-store'
import {
  addPremadeTeam,
  addSpeciesToTeam,
  deletePremadeTeam,
  deleteTeamsForTrainer,
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
import { getNextBoss, getProgression, resetProgression, setBossOrder, setLevelCap } from './showdown/progression-store'
import { addMoney, getMoney, resetMoney } from './showdown/money-store'
import { resetStatsCounters } from './showdown/stats-store'
import { getTrainerProfile } from './showdown/trainer-profile'
import { buildAutoSet, listAutoSets } from './showdown/auto-sets'
import { checkForUpdate, installUpdate } from './updater'
import { chooseBackground, clearBackground, getBackground } from './showdown/background-store'
import {
  completeRunGenerations,
  runChoiceAt,
  evolveRunMon,
  forfeitRun,
  getRunView,
  giveRunItem,
  moveRunItem,
  placeDisplacedItem,
  relearnRunMoves,
  rerollRunItems,
  reorderRunTeam,
  skipRunItem,
  startRun,
  takeHealNode,
  takeItemNode
} from './showdown/run-store'
import { createRunBattle } from './showdown/run-battles'
import { getWildDropFor, listWildDrops, setWildDrop } from './showdown/wild-drops-store'
import { buyItem, listShop, listShopPrices, sellItem, setShopPrice } from './showdown/shop-store'
import { getGalarFossilPartners, restoreFossil } from './showdown/fossil-store'
import { openBagItem } from './showdown/open-item-store'
import { eligibleRandomTrainers, isRocketEventActive } from './showdown/trainer-selection'
import {
  getPlayerSummary,
  isAdmin,
  getSessionInfo,
  login,
  logout,
  requireAdmin,
  restoreRememberedSession,
  setTrainerSprite
} from './showdown/player-session'

let activeBattle: WildBattle | null = null

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    // Wide enough for the battle screen's 3-column layout (switch list, the
    // stage, the log) to sit comfortably instead of squeezing the side
    // columns down to a sliver - see .battle-screen's own minmax floors for
    // what happens below this anyway.
    width: 1280,
    // Tall enough for a full battle screen (moves, the team panel, the Run
    // button) without the page scrolling.
    height: 960,
    // The window can grow, but not shrink below the size it opens at - below
    // this the battle screen's 3-column layout starts running out of room.
    minWidth: 1280,
    minHeight: 960,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`)
  })

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.log('[renderer] process gone:', details)
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

ipcMain.handle('battle:start', async (_event, locationId?: WildLocationId, levelCapOverride?: number) => {
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
  const wildMon = location?.id === 'lab' ? generateLabWildMon(effectiveLevelCap) : generateRandomWildMon(effectiveLevelCap, location)
  if (!wildMon) throw new Error('Could not find a wild Pokemon for your current level cap in that location')
  const wildDrop = getWildDropFor(wildMon.species)
  activeBattle = new WildBattle(p1team, 'gen9customgame', 'gen9randombattle', {
    team: [wildMon],
    name: 'Wild',
    difficulty: 'easy',
    drops: wildDrop ? [wildDrop] : undefined,
    randomDropChance: WILD_RANDOM_DROP_CHANCE
  })
  return activeBattle.getInitialView()
})

ipcMain.handle('battle:startTrainer', async (_event, boss: boolean, rematchTrainerId?: string) => {
  const p1team = getTeamPokemonSets()
  if (p1team.length === 0) throw new Error('Your team is empty - add Pokemon and assign them to your team first')
  const progression = getProgression()
  const levelCap = progression.levelCap

  let trainer: Trainer | null = null
  if (boss && rematchTrainerId) {
    // A rematch from the boss menu: any boss in the order the player has already beaten.
    // It pays out like any boss fight, but can't move progression along (recordTrainerWin
    // only counts the next unbeaten boss).
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
    isBoss: trainer.isBoss
  })
  return activeBattle.getInitialView()
})

// Another player's saved team, fought as a friendly match: they're not here to play it,
// so the AI drives it, at the hardest setting, with their real moves and items. Their whole
// team is set to the level of the challenger's highest-level Pokemon, up or down, so the
// match is even whatever levels the two saves are at. It never pays out - no exp, money, drops, friendship or boss progress.
ipcMain.handle('battle:startPlayer', async (_event, username: string, doubles = false) => {
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
  })
  return activeBattle.getInitialView()
})

ipcMain.handle('battle:choose', async (_event, choice: string) => {
  if (!activeBattle) throw new Error('No active battle')
  return activeBattle.submitChoice(choice)
})

ipcMain.handle('battle:run', () => {
  if (!activeBattle) throw new Error('No active battle')
  activeBattle.runAway()
  activeBattle = null
})

ipcMain.handle('battle:catch', () => {
  if (!activeBattle) throw new Error('No active battle')
  return activeBattle.catchWildPokemon()
})

ipcMain.handle('battle:eligibility', (): BattleEligibility => {
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
    allBossesDefeated: allBossesDefeated()
  }
})

// Every boss in the order is beaten: Boss Battle becomes the rematch menu and the
// Professor's Lab opens up as a wild location.
function allBossesDefeated(): boolean {
  return getProgression().bossOrder.length > 0 && !getNextBoss()
}

// ---- Roguelite runs (see run-store.ts) ----
ipcMain.handle('run:get', (): RunView | null => getRunView())
ipcMain.handle('run:generations', () => completeRunGenerations())
ipcMain.handle('run:start', (_event, boxMonId: string, difficulty: RunDifficulty, generation: number | null) =>
  startRun(boxMonId, difficulty, generation)
)
ipcMain.handle('run:forfeit', () => forfeitRun())
ipcMain.handle('run:giveItem', (_event, itemId: string, runMonId: string) => giveRunItem(itemId, runMonId))
ipcMain.handle('run:skipItem', () => skipRunItem())
ipcMain.handle('run:rerollItems', () => rerollRunItems())
ipcMain.handle('run:evolve', (_event, runMonId: string, targetSpecies: string) => evolveRunMon(runMonId, targetSpecies))
ipcMain.handle('run:relearnMoves', (_event, runMonId: string) => relearnRunMoves(runMonId))
ipcMain.handle('run:placeDisplacedItem', (_event, runMonId: string | null) => placeDisplacedItem(runMonId))
ipcMain.handle('run:moveItem', (_event, fromMonId: string, toMonId: string) => moveRunItem(fromMonId, toMonId))
ipcMain.handle('run:reorder', (_event, runMonIds: string[]) => reorderRunTeam(runMonIds))
// A floor's choice: a heal or an item floor answers with the run as it now stands, a
// fight starts the battle.
ipcMain.handle('run:choose', async (_event, index: number): Promise<RunChoiceResult> => {
  const choice = runChoiceAt(index)
  if (choice.kind === 'heal') return { run: takeHealNode() }
  if (choice.kind === 'item') return { run: takeItemNode() }
  activeBattle = createRunBattle(choice)
  return { battle: await activeBattle.getInitialView(), location: choice.location }
})

ipcMain.handle('battle:bossRematchList', (): BossRematchInfo[] => {
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

ipcMain.handle('dex:move', (_event, id: string) => getMoveInfo(id))

ipcMain.handle('box:list', () => getBoxState())
ipcMain.handle('box:addRandom', () => {
  requireAdmin()
  return addRandomMon()
})
ipcMain.handle('box:setTeam', (_event, team: (string | null)[]) => setTeam(team))
ipcMain.handle('box:getMon', (_event, id: string) => getMonSet(id))
ipcMain.handle('box:updateMon', (_event, id: string, set: EditablePokemonSet, admin?: boolean) => {
  // Admin Edit skips the normal restrictions, so only an admin may ask for it.
  if (admin) requireAdmin()
  return updateMon(id, set, admin)
})
ipcMain.handle('box:addStarter', (_event, species: string) => addStarter(species))
ipcMain.handle('box:evolve', (_event, id: string, targetSpecies: string) => evolveMon(id, targetSpecies))
ipcMain.handle('box:levelUp', (_event, id: string) => levelUpMon(id))
ipcMain.handle('box:toggleFavorite', (_event, id: string) => toggleFavorite(id))
ipcMain.handle('box:useShinyPatch', (_event, id: string) => useShinyPatch(id))

ipcMain.handle('loadouts:list', () => listLoadouts())
ipcMain.handle('loadouts:save', (_event, name: string) => saveLoadout(name))
ipcMain.handle('loadouts:update', (_event, id: string) => updateLoadout(id))
ipcMain.handle('loadouts:rename', (_event, id: string, name: string) => renameLoadout(id, name))
ipcMain.handle('loadouts:delete', (_event, id: string) => deleteLoadout(id))
ipcMain.handle('loadouts:apply', (_event, id: string) => applyLoadout(id))

ipcMain.handle('bag:list', () => getBagState())
ipcMain.handle('bag:useExpCandy', (_event, itemId: string) => useExpCandy(itemId))

ipcMain.handle('money:get', () => getMoney())
ipcMain.handle('money:debugAdd', (_event, amount: number) => {
  requireAdmin()
  return addMoney(amount)
})
ipcMain.handle('shop:list', () => listShop())
ipcMain.handle('shop:buy', (_event, itemId: string, quantity: number) => buyItem(itemId, quantity))
ipcMain.handle('shop:listPrices', () => {
  requireAdmin()
  return listShopPrices()
})
ipcMain.handle('shop:setPrice', (_event, itemId: string, price: number | null) => {
  requireAdmin()
  return setShopPrice(itemId, price)
})
ipcMain.handle('bag:sell', (_event, itemId: string) => sellItem(itemId))
ipcMain.handle('bag:open', (_event, itemId: string) => openBagItem(itemId))
ipcMain.handle('fossil:galarPartners', (_event, itemId: string) => getGalarFossilPartners(itemId))
ipcMain.handle('fossil:restore', (_event, itemId: string, secondItemId?: string) =>
  restoreFossil(itemId, secondItemId)
)

ipcMain.handle('dex:editorOptions', () => getEditorOptions())
ipcMain.handle('dex:speciesInfo', (_event, species: string, level: number) => getSpeciesEditInfo(species, level))

ipcMain.handle('trainers:list', () => listTrainers())
ipcMain.handle('trainers:add', (_event, input: Omit<Trainer, 'id'>) => {
  requireAdmin()
  return addTrainer(input)
})
ipcMain.handle('trainers:update', (_event, id: string, input: Omit<Trainer, 'id'>) => {
  requireAdmin()
  return updateTrainer(id, input)
})
ipcMain.handle('trainers:delete', (_event, id: string) => {
  requireAdmin()
  const result = deleteTrainer(id)
  deleteTeamsForTrainer(id)
  return result
})

ipcMain.handle('premadeTeams:list', () => listPremadeTeams())
ipcMain.handle('premadeTeams:listForTrainer', (_event, trainerId: string) => listPremadeTeamsForTrainer(trainerId))
ipcMain.handle('premadeTeams:add', (_event, trainerId: string, name: string) => {
  requireAdmin()
  return addPremadeTeam(trainerId, name)
})
ipcMain.handle('premadeTeams:rename', (_event, id: string, name: string) => {
  requireAdmin()
  return renamePremadeTeam(id, name)
})
ipcMain.handle('premadeTeams:delete', (_event, id: string) => {
  requireAdmin()
  return deletePremadeTeam(id)
})
ipcMain.handle('premadeTeams:addSpecies', (_event, teamId: string, species: string) => {
  requireAdmin()
  return addSpeciesToTeam(teamId, species)
})
ipcMain.handle('premadeTeams:removeMon', (_event, teamId: string, monId: string) => {
  requireAdmin()
  return removeMonFromTeam(teamId, monId)
})
ipcMain.handle('premadeTeams:reorder', (_event, teamId: string, monIds: string[]) => {
  requireAdmin()
  return reorderTeamMons(teamId, monIds)
})
ipcMain.handle('premadeTeams:getMon', (_event, teamId: string, monId: string) => getTeamMonSet(teamId, monId))
ipcMain.handle('premadeTeams:updateMon', (_event, teamId: string, monId: string, input: EditablePokemonSet) => {
  requireAdmin()
  return updateTeamMon(teamId, monId, input)
})
ipcMain.handle('premadeTeams:setDrop', (_event, teamId: string, drop: ItemDropConfig) => {
  requireAdmin()
  return setPremadeTeamDrop(teamId, drop)
})
ipcMain.handle('premadeTeams:setDoubleBattle', (_event, teamId: string, isDoubleBattle: boolean) => {
  requireAdmin()
  return setPremadeTeamDoubleBattle(teamId, isDoubleBattle)
})

ipcMain.handle('wildDrops:list', () => listWildDrops())
ipcMain.handle('wildDrops:set', (_event, species: string, drop: ItemDropConfig) => {
  requireAdmin()
  return setWildDrop(species, drop)
})


ipcMain.handle('progression:get', () => getProgression())
ipcMain.handle('progression:setBossOrder', (_event, steps: Omit<BossStep, 'id'>[]) => {
  requireAdmin()
  return setBossOrder(steps)
})
ipcMain.handle('progression:setLevelCap', (_event, levelCap: number) => {
  requireAdmin()
  return setLevelCap(levelCap)
})

// Boss progression only (level cap, defeated bosses, trainer-win counter) -
// unlike stats:reset this leaves the box, bag and money alone.
ipcMain.handle('progression:reset', () => {
  requireAdmin()
  resetProgression()
  return getProgression()
})

ipcMain.handle('auth:session', () => getSessionInfo())
ipcMain.handle('auth:login', (_event, username: string, remember: boolean) => {
  activeBattle = null
  return login(username, remember)
})
ipcMain.handle('auth:logout', () => {
  activeBattle = null
  return logout()
})
ipcMain.handle('profile:setTrainerSprite', (_event, spriteId: string) => setTrainerSprite(spriteId))

ipcMain.handle('stats:reset', () => {
  requireAdmin()
  resetBox()
  resetProgression()
  resetBag()
  resetMoney()
  resetStatsCounters()
  return { box: getBoxState(), progression: getProgression(), money: getMoney() }
})

ipcMain.handle('profile:get', () => getTrainerProfile())
ipcMain.handle('profile:pokedex', () => getPokedex())

ipcMain.handle('update:check', () => checkForUpdate())
ipcMain.handle('background:get', () => getBackground())
ipcMain.handle('background:choose', (event) => chooseBackground(BrowserWindow.fromWebContents(event.sender)))
ipcMain.handle('background:clear', () => clearBackground())
ipcMain.handle('update:install', (event) => installUpdate(event.sender))

ipcMain.handle('autoSets:list', (_event, species: string) => listAutoSets(species))
// Admin editing lifts the move/item limits - only honoured for an actual admin.
ipcMain.handle('autoSets:build', (_event, species: string, level: number, optionId: string, admin: boolean) =>
  buildAutoSet(species, level, optionId, admin && isAdmin())
)

void app.whenReady().then(() => {
  restoreRememberedSession()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
