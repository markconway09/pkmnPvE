import { readFileSync, writeFileSync } from 'node:fs'
import { BrowserWindow } from 'electron'
import type { MissionClaimResult, MissionReward, MissionStat, MissionsState, MissionTemplate } from '../../shared/missions'
import { DAILY_BONUS_REWARD, DAILY_REROLLS, MISSION_TEMPLATES, MISSION_TIERS } from '../../shared/missions'
import { DILIGENT_EXTRA_REROLLS } from '../../shared/titles'
import { playerPathFor } from './save-paths'
import { getSessionInfo, onPlayerChange } from './player-session'
import { addItem } from './bag-store'
import { addMoney, getMoney } from './money-store'
import { changeCoins } from './game-corner-store'
import { getEditorOptions } from './sim-access'
import { lateItemsUnlocked } from './progression-store'
import { countAchievement } from './achievement-progress'
import { hasTitle } from './title-perks'

/**
 * Daily missions (see shared/missions.ts), kept per player in missions.json. The day's
 * three are rolled the first time they're looked at or counted on a new local day -
 * from the player's name and the date, so the same day always gives the same three.
 */

interface StoredMission {
  templateId: string
  progress: number
  claimed: boolean
}

interface StoredMissions {
  day: string
  missions: StoredMission[]
  rerollsUsed: number
  bonusClaimed: boolean
}

let state: StoredMissions | null | undefined

onPlayerChange(() => {
  state = undefined
})

// Today's local date, as the day's key.
function today(): string {
  const now = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function msUntilMidnight(): number {
  const now = new Date()
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return midnight.getTime() - now.getTime()
}

// A small seeded random number generator (mulberry32), seeded from a string.
function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let a = h >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// The missions a tier can roll right now (a Max Raid only once raids are open).
function eligible(tier: MissionTemplate['tier']): MissionTemplate[] {
  const raids = lateItemsUnlocked()
  return MISSION_TEMPLATES.filter((t) => t.tier === tier && (!t.needsRaids || raids))
}

function rollDay(day: string): StoredMissions {
  const random = seededRandom(`${getSessionInfo().username ?? ''}|${day}`)
  // Never two counting the same thing (Beat 3 trainers and Beat 10 trainers).
  const usedStats = new Set<string>()
  const missions = MISSION_TIERS.map((tier) => {
    const all = eligible(tier)
    const fresh = all.filter((t) => !usedStats.has(t.stat))
    const pool = fresh.length > 0 ? fresh : all
    const template = pool[Math.floor(random() * pool.length)]
    usedStats.add(template.stat)
    return { templateId: template.id, progress: 0, claimed: false }
  })
  return { day, missions, rerollsUsed: 0, bonusClaimed: false }
}

function load(): StoredMissions | null {
  try {
    const parsed = JSON.parse(readFileSync(playerPathFor('missions.json'), 'utf8')) as StoredMissions
    return Array.isArray(parsed.missions) && typeof parsed.day === 'string' ? parsed : null
  } catch {
    return null
  }
}

function persist(): void {
  if (state) writeFileSync(playerPathFor('missions.json'), JSON.stringify(state), 'utf8')
}

// Today's missions, rolled if the stored ones are from an earlier day. A clock set back
// keeps the stored day's missions rather than rolling (or restarting) an older one.
function current(): StoredMissions {
  if (state === undefined) state = load()
  const day = today()
  if (!state || state.day < day) {
    state = rollDay(day)
    persist()
  }
  return state
}

const templateOf = (id: string): MissionTemplate | undefined => MISSION_TEMPLATES.find((t) => t.id === id)

function rerollsAllowed(): number {
  return DAILY_REROLLS + (hasTitle('Diligent') ? DILIGENT_EXTRA_REROLLS : 0)
}

function allDone(missions: StoredMission[]): boolean {
  return missions.every((m) => {
    const t = templateOf(m.templateId)
    // A mission since taken out of the game (rolled before an update) doesn't count against it.
    return !t || m.progress >= t.goal
  })
}

export function getMissions(): MissionsState {
  const s = current()
  return {
    day: s.day,
    missions: s.missions.flatMap((m, slot) => {
      const t = templateOf(m.templateId)
      return t
        ? [{ slot, templateId: t.id, tier: t.tier, text: t.text, goal: t.goal, progress: Math.min(m.progress, t.goal), reward: t.reward, claimed: m.claimed }]
        : []
    }),
    rerollsLeft: Math.max(0, rerollsAllowed() - s.rerollsUsed),
    bonusReady: allDone(s.missions),
    bonusClaimed: s.bonusClaimed,
    bonusReward: DAILY_BONUS_REWARD,
    msUntilReset: msUntilMidnight()
  }
}

/** Counts towards today's missions; the window hears about any that just got finished. */
export function recordMission(stat: MissionStat, amount = 1): void {
  if (amount <= 0) return
  let s: StoredMissions
  try {
    s = current()
  } catch {
    return // nobody logged in
  }
  const finished: string[] = []
  let changed = false
  for (const m of s.missions) {
    const t = templateOf(m.templateId)
    if (!t || t.stat !== stat || m.progress >= t.goal) continue
    m.progress = Math.min(t.goal, m.progress + amount)
    changed = true
    if (m.progress >= t.goal) finished.push(t.text)
  }
  if (!changed) return
  persist()
  for (const window of BrowserWindow.getAllWindows()) window.webContents.send('missions:changed', finished)
}

function pay(reward: MissionReward): string {
  const names = new Map(getEditorOptions().items.map((i) => [i.id, i.name]))
  const parts: string[] = []
  for (const { itemId, count } of reward.items ?? []) {
    addItem(itemId, count)
    parts.push(`${count > 1 ? `${count}× ` : 'a '}${names.get(itemId) ?? itemId}`)
  }
  if (reward.money) {
    addMoney(reward.money)
    parts.push(`₽${reward.money.toLocaleString('en-US')}`)
  }
  if (reward.coins) {
    changeCoins(reward.coins)
    parts.push(`${reward.coins.toLocaleString('en-US')} coins`)
  }
  return parts.join(', ')
}

/** Hands over a finished mission's reward - once. */
export function claimMission(slot: number): MissionClaimResult {
  const s = current()
  const m = s.missions[slot]
  const t = m ? templateOf(m.templateId) : undefined
  if (!m || !t) throw new Error('No such mission today')
  if (m.progress < t.goal) throw new Error("That mission isn't finished yet")
  if (m.claimed) throw new Error("That mission's reward has already been claimed")
  m.claimed = true
  persist()
  const rewardText = pay(t.reward)
  return { state: getMissions(), rewardText, money: getMoney() }
}

/** All three finished: the day's bonus (and a day towards the Diligent achievement). */
export function claimMissionBonus(): MissionClaimResult {
  const s = current()
  if (!allDone(s.missions)) throw new Error('Finish all three missions first')
  if (s.bonusClaimed) throw new Error("Today's bonus has already been claimed")
  s.bonusClaimed = true
  persist()
  const rewardText = pay(DAILY_BONUS_REWARD)
  countAchievement('dailySetsCompleted')
  return { state: getMissions(), rewardText, money: getMoney() }
}

/** Swaps an unfinished mission for another of the same difficulty (a random one). */
export function rerollMission(slot: number): MissionsState {
  const s = current()
  const m = s.missions[slot]
  const t = m ? templateOf(m.templateId) : undefined
  if (!m || !t) throw new Error('No such mission today')
  if (m.progress >= t.goal) throw new Error("That mission's already finished")
  if (s.rerollsUsed >= rerollsAllowed()) throw new Error('No rerolls left today')
  // Not one already on the list, nor one counting the same thing as the others.
  const taken = new Set(s.missions.map((x) => x.templateId))
  const otherStats = new Set(s.missions.filter((x) => x !== m).map((x) => templateOf(x.templateId)?.stat))
  const pool = eligible(t.tier).filter((x) => !taken.has(x.id) && !otherStats.has(x.stat))
  if (pool.length === 0) throw new Error('There is no other mission to swap it for')
  const next = pool[Math.floor(Math.random() * pool.length)]
  s.missions[slot] = { templateId: next.id, progress: 0, claimed: false }
  s.rerollsUsed++
  persist()
  return getMissions()
}
