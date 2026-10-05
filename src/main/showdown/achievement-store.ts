import { BrowserWindow } from 'electron'
import type {
  AchievementClaimResult,
  AchievementDef,
  AchievementStat,
  AchievementsState,
  AchievementView
} from '../../shared/achievements'
import { ACHIEVEMENTS } from '../../shared/achievements'
import { titleClash } from '../../shared/titles'
import { claimedTitlesOf, getAchievementProgress, persistAchievementProgress } from './achievement-progress'
import { addItem, hasItem } from './bag-store'
import { boxAchievementStats } from './box-store'
import { changeCoins } from './game-corner-store'
import { addMoney, getMoney } from './money-store'
import { getEditorOptions, nationalDexSpecies } from './sim-access'
import { tmAchievementStats } from './tm-store'
import { getTrainerProfile } from './trainer-profile'

/**
 * Achievements: works out every tally they're measured by, unlocks the ones that have
 * reached their goal (telling the window, which pops them up), and pays a reward when
 * the player claims it. Checked after the renderer's calls (see index.ts), so anything
 * that changes a tally - a battle, a catch, a spin - is picked up without each store
 * having to ask.
 */

function currentStats(): Record<AchievementStat, number> {
  const { stats, league } = getTrainerProfile()
  const box = boxAchievementStats()
  const counters = getAchievementProgress().counters
  const tms = tmAchievementStats()
  const beaten = (group: string): number => league.filter((l) => l.group === group && l.defeated).length
  return {
    battlesWon: stats.trainersDefeated + stats.wildDefeated + stats.bossesDefeated,
    trainersDefeated: stats.trainersDefeated,
    wildCaught: stats.wildCaught,
    gymBadges: beaten('gym'),
    eliteFour: beaten('eliteFour'),
    champion: beaten('champion'),
    dexSpecies: box.dexSpecies,
    dexForms: box.dexForms,
    shinyOwned: box.shiny,
    legendaryOwned: box.legendaryClass,
    restrictedOwned: box.restricted,
    rotomOwned: box.rotom,
    necrozmaOwned: box.necrozma,
    kyuremOwned: box.kyurem,
    calyrexOwned: box.calyrex,
    hoopaOwned: box.hoopa,
    forcesOwned: box.forces,
    shayminOwned: box.shaymin,
    deoxysOwned: box.deoxys,
    zygardeOwned: box.zygarde,
    maxFriendship: box.maxFriendship,
    alcremieForms: box.alcremieForms,
    miniorColors: box.miniorColors,
    pikachuForms: box.pikachuForms,
    money: getMoney(),
    bestFloor: stats.bestFloor,
    evolutions: counters.evolutions ?? 0,
    pokemonSold: counters.pokemonSold ?? 0,
    pokemonMerged: counters.pokemonMerged ?? 0,
    mergedStars: counters.mergedStars ?? 0,
    mergeShinied: counters.mergeShinied ?? 0,
    raidsWon: counters.raidsWon ?? 0,
    gmaxSpecies: box.gmaxSpecies,
    goldRaidsWon: counters.goldRaidsWon ?? 0,
    flawlessRaids: counters.flawlessRaids ?? 0,
    shinyRaidCatches: counters.shinyRaidCatches ?? 0,
    dailySetsCompleted: counters.dailySetsCompleted ?? 0,
    shinySold: counters.shinySold ?? 0,
    runsWon: counters.runsWon ?? 0,
    hardRunsWon: counters.hardRunsWon ?? 0,
    earlyRunLosses: counters.earlyRunLosses ?? 0,
    draftsFinished: counters.draftsFinished ?? 0,
    draftBattlesWon: counters.draftBattlesWon ?? 0,
    draftBestWins: counters.draftBestWins ?? 0,
    perfectDrafts: counters.perfectDrafts ?? 0,
    perfectSinglesDrafts: counters.perfectSinglesDrafts ?? 0,
    perfectDoublesDrafts: counters.perfectDoublesDrafts ?? 0,
    draftFormatsPerfected: (counters.perfectSinglesDrafts ? 1 : 0) + (counters.perfectDoublesDrafts ? 1 : 0),
    flawlessDraftWins: counters.flawlessDraftWins ?? 0,
    luckyPacks: counters.luckyPacks ?? 0,
    draftBestLegendaries: counters.draftBestLegendaries ?? 0,
    ubersPerfectDrafts: counters.ubersPerfectDrafts ?? 0,
    zuPerfectDrafts: counters.zuPerfectDrafts ?? 0,
    slotSpins: counters.slotSpins ?? 0,
    jackpots: counters.jackpots ?? 0,
    slotCoinsWon: counters.slotCoinsWon ?? 0,
    blackjackWins: counters.blackjackWins ?? 0,
    naturalBlackjacks: counters.naturalBlackjacks ?? 0,
    rouletteSpins: counters.rouletteSpins ?? 0,
    rouletteNumberWins: counters.rouletteNumberWins ?? 0,
    plinkoDrops: counters.plinkoDrops ?? 0,
    plinkoEdges: counters.plinkoEdges ?? 0,
    tmSearches: counters.tmSearches ?? 0,
    legendaryTmsFound: counters.legendaryTmsFound ?? 0,
    tmAmbushes: counters.tmAmbushes ?? 0,
    tmAreasSearched: tms.tmAreasSearched,
    labSearches: counters.labSearches ?? 0,
    tmsOwned: tms.tmsOwned,
    tmTypesCompleted: tms.tmTypesCompleted,
    skillGreats: counters.skillGreats ?? 0,
    flawlessSearches: counters.flawlessSearches ?? 0,
    flawlessLegendarySearches: counters.flawlessLegendarySearches ?? 0,
    bestGreatStreak: counters.bestGreatStreak ?? 0,
    skillTimeouts: counters.skillTimeouts ?? 0
  }
}

/**
 * Unlocks every achievement whose goal has been reached, and tells the window about the
 * new ones. The very first check only records what the save already had, quietly - an
 * older save isn't greeted by a pile of pop-ups.
 */
export function checkAchievements(): void {
  const progress = getAchievementProgress()
  // A key item added to an achievement after it was claimed is handed over anyway.
  for (const a of ACHIEVEMENTS) {
    if (!progress.claimed.includes(a.id)) continue
    for (const keyItem of a.reward.keyItems ?? []) if (!hasItem(keyItem)) addItem(keyItem, 1)
  }
  const stats = currentStats()
  const unlocked = new Set(progress.unlocked)
  const fresh = ACHIEVEMENTS.filter((a) => !unlocked.has(a.id) && stats[a.stat] >= a.goal)
  const firstCheck = !progress.seeded
  if (fresh.length === 0 && !firstCheck) return
  progress.unlocked.push(...fresh.map((a) => a.id))
  progress.seeded = true
  persistAchievementProgress()
  if (firstCheck || fresh.length === 0) return
  const names = fresh.map((a) => a.name)
  for (const window of BrowserWindow.getAllWindows()) window.webContents.send('achievements:unlocked', names)
}

export function getAchievements(): AchievementsState {
  const progress = getAchievementProgress()
  const stats = currentStats()
  const unlocked = new Set(progress.unlocked)
  const claimed = new Set(progress.claimed)
  const achievements: AchievementView[] = ACHIEVEMENTS.map((a) => ({
    ...a,
    progress: Math.min(a.goal, stats[a.stat]),
    unlocked: unlocked.has(a.id),
    claimed: claimed.has(a.id)
  }))
  return {
    achievements,
    title: progress.title,
    disabled: progress.disabledTitles,
    titles: claimedTitles(),
    dexComplete: stats.dexSpecies >= nationalDexSpecies().length
  }
}

function claimedTitles(): string[] {
  return claimedTitlesOf(getAchievementProgress().claimed)
}

function rewardText(def: AchievementDef): string {
  const names = new Map(getEditorOptions().items.map((i) => [i.id, i.name]))
  const parts: string[] = []
  for (const { itemId, count } of def.reward.items ?? []) parts.push(`${count > 1 ? `${count}× ` : 'a '}${names.get(itemId) ?? itemId}`)
  for (const keyItem of def.reward.keyItems ?? []) parts.push(`the ${names.get(keyItem) ?? keyItem}`)
  if (def.reward.money) parts.push(`₽${def.reward.money.toLocaleString('en-US')}`)
  if (def.reward.coins) parts.push(`${def.reward.coins.toLocaleString('en-US')} coins`)
  if (def.reward.title) parts.push(`the title "${def.reward.title}"`)
  return parts.join(', ')
}

/** Hands over an unlocked achievement's reward - once. */
export function claimAchievement(id: string): AchievementClaimResult {
  const def = ACHIEVEMENTS.find((a) => a.id === id)
  if (!def) throw new Error(`Unknown achievement: ${id}`)
  const progress = getAchievementProgress()
  if (!progress.unlocked.includes(id)) throw new Error(`${def.name} isn't unlocked yet`)
  if (progress.claimed.includes(id)) throw new Error(`${def.name}'s reward has already been claimed`)
  // A new title starts on - unless it clashes with one that's already on.
  const title = def.reward.title
  const clash = title ? titleClash(title) : undefined
  const startsOff = !!clash && (title === clash.lead ? clash.rivals.some(titleOn) : titleOn(clash.lead))
  progress.claimed.push(id)
  if (title && startsOff) progress.disabledTitles.push(title)
  persistAchievementProgress()
  for (const { itemId, count } of def.reward.items ?? []) addItem(itemId, count)
  // A key item is kept for good - one is all anyone needs.
  for (const keyItem of def.reward.keyItems ?? []) if (!hasItem(keyItem)) addItem(keyItem, 1)
  if (def.reward.money) addMoney(def.reward.money)
  if (def.reward.coins) changeCoins(def.reward.coins)
  return { state: getAchievements(), rewardText: rewardText(def), money: getMoney() }
}

// Whether a title is claimed and not turned off.
function titleOn(title: string): boolean {
  return claimedTitles().includes(title) && !getAchievementProgress().disabledTitles.includes(title)
}

/**
 * Turns a claimed title's perk on or off. A title in a clash (see TITLE_CLASHES) moves its
 * rivals too: the lead on turns the rivals off and off turns them back on; a rival on
 * turns the lead off, and the last rival going off turns the lead back on.
 */
export function setTitleActive(title: string, active: boolean): AchievementsState {
  const claimed = claimedTitles()
  if (!claimed.includes(title)) throw new Error("You haven't earned that title")
  const progress = getAchievementProgress()
  const off = new Set(progress.disabledTitles)
  const set = (t: string, on: boolean): void => {
    if (on) off.delete(t)
    else if (claimed.includes(t)) off.add(t)
  }
  set(title, active)
  const clash = titleClash(title)
  if (clash) {
    if (title === clash.lead) {
      for (const rival of clash.rivals) set(rival, !active)
    } else if (active) {
      set(clash.lead, false)
    } else if (!clash.rivals.some((r) => claimed.includes(r) && !off.has(r))) {
      set(clash.lead, true)
    }
  }
  progress.disabledTitles = [...off]
  persistAchievementProgress()
  return getAchievements()
}

/** Shows one of the claimed titles beside the player's name (null: none) - just for show. */
export function setAchievementTitle(title: string | null): AchievementsState {
  if (title !== null && !claimedTitles().includes(title)) throw new Error("You haven't earned that title")
  getAchievementProgress().title = title
  persistAchievementProgress()
  return getAchievements()
}
