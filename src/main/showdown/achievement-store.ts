import { BrowserWindow } from 'electron'
import type {
  AchievementClaimResult,
  AchievementDef,
  AchievementStat,
  AchievementsState,
  AchievementView
} from '../../shared/achievements'
import { ACHIEVEMENTS } from '../../shared/achievements'
import { getAchievementProgress, persistAchievementProgress } from './achievement-progress'
import { addItem, hasItem } from './bag-store'
import { boxAchievementStats } from './box-store'
import { changeCoins } from './game-corner-store'
import { addMoney, getMoney } from './money-store'
import { getEditorOptions } from './sim-access'
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
    money: getMoney(),
    bestFloor: stats.bestFloor,
    evolutions: counters.evolutions ?? 0,
    pokemonSold: counters.pokemonSold ?? 0,
    shinySold: counters.shinySold ?? 0,
    runsWon: counters.runsWon ?? 0,
    hardRunsWon: counters.hardRunsWon ?? 0,
    earlyRunLosses: counters.earlyRunLosses ?? 0,
    slotSpins: counters.slotSpins ?? 0,
    jackpots: counters.jackpots ?? 0,
    slotCoinsWon: counters.slotCoinsWon ?? 0,
    blackjackWins: counters.blackjackWins ?? 0,
    naturalBlackjacks: counters.naturalBlackjacks ?? 0
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
  return { achievements, title: progress.title, titles: claimedTitles() }
}

function claimedTitles(): string[] {
  const claimed = new Set(getAchievementProgress().claimed)
  return ACHIEVEMENTS.filter((a) => claimed.has(a.id) && a.reward.title).map((a) => a.reward.title!)
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
  progress.claimed.push(id)
  persistAchievementProgress()
  for (const { itemId, count } of def.reward.items ?? []) addItem(itemId, count)
  // A key item is kept for good - one is all anyone needs.
  for (const keyItem of def.reward.keyItems ?? []) if (!hasItem(keyItem)) addItem(keyItem, 1)
  if (def.reward.money) addMoney(def.reward.money)
  if (def.reward.coins) changeCoins(def.reward.coins)
  return { state: getAchievements(), rewardText: rewardText(def), money: getMoney() }
}

/** Shows one of the claimed titles beside the player's name (null: none). */
export function setAchievementTitle(title: string | null): AchievementsState {
  if (title !== null && !claimedTitles().includes(title)) throw new Error("You haven't earned that title")
  getAchievementProgress().title = title
  persistAchievementProgress()
  return getAchievements()
}
