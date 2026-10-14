import type { BattleView, CoopBattleResult, RunDifficulty, RunMonView } from './battle-types'
import type { ChaosField } from './draft'

// Online battles with a friend: two copies of the game connect straight to each other
// (WebRTC, found through the free public PeerJS server by a room code). The host's copy
// runs the battle for both - the friend's only sends its choices and shows what it's sent.

// The room code's letters - no 0/O or 1/I to mix up when reading it out.
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const ROOM_CODE_LENGTH = 5
// Put in front of the code to make the PeerJS id, so it can't clash with other apps' rooms.
export const ROOM_ID_PREFIX = 'pkmnpve-room-'

export interface OnlinePlayer {
  name: string
  spriteId: string
  // Both copies must be the same version, or the battle could play out differently.
  version: string
}

// A player's team as their copy sends it: the sets as saved, with each one's merge stars
// and Everstone lock in the same order.
export interface OnlineTeam {
  team: unknown[]
  mergeStars: number[]
  everstone: boolean[]
}

// What the main process tells its renderer about itself, for the hello.
export interface OnlineSelf {
  player: OnlinePlayer
  team: OnlineTeam
}

// Online chaos draft: both players draft at the same time from the same tiers (the host
// rolls them), each with their own packs and modifiers, then battle each other with
// everything brought - the same stages as a solo chaos draft (draft 2, a modifier, battle;
// two more picks every other battle). First to ONLINE_CHAOS_WINS wins takes the match;
// after ONLINE_CHAOS_BATTLES battles (ties can happen) the most wins does.
export const ONLINE_CHAOS_WINS = 4
export const ONLINE_CHAOS_BATTLES = 7

// A player's chaos draft as their copy sends it once they're done picking for a battle:
// their picks (sets with their stat modifiers) and battle-start modifiers.
export interface OnlineDraftTeam {
  picks: unknown[]
  field: ChaosField
}

// Co-op Battle Tower: the host starts a run for both - each player picks their own starter
// and plays their own floors (the same ones: both runs share the seed), with their own team
// of up to 3, gems and shop. Bosses and villains are met together: once both are there,
// the host's copy runs the fight - both teams on one doubles side. If either player's team
// is wiped, the run is over for both. Each copy keeps its run saved, to carry on later.
export interface CoopSetup {
  seed: string
  difficulty: RunDifficulty
  generation: number | null
}

// A player's run team for a fight taken on together, as their copy sends it: the sets as
// saved, with each one's HP (0..1) and status, in their run team's order.
export interface OnlineCoopTeam {
  sets: unknown[]
  conditions: { hp: number; status: string | null }[]
}

// Where a player's co-op run stands, for the friend's screen (sent each time it changes).
export interface CoopProgress {
  // Their co-op run's seed - null with none.
  seed: string | null
  status: 'none' | 'active' | 'lost' | 'won'
  floor: number
  bossesBeaten: number
  team: RunMonView[]
  // Waiting at a boss or villain for the friend.
  ready: { floor: number; kind: 'boss' | 'villain' } | null
}

// Both players' screens of the host's battle (the host shows one, sends the other on).
export interface OnlineViews {
  host: BattleView
  guest: BattleView
}

// Everything sent over the connection, either way.
export type OnlineMessage =
  // The first thing each side sends once connected.
  | { type: 'hello'; player: OnlinePlayer }
  // The host turning the friend away (a different version, a room already full...).
  | { type: 'reject'; reason: string }
  // Host -> friend: send your team, a battle is starting (singles or doubles, with or
  // without merge star boosts).
  | { type: 'teamRequest'; doubles: boolean; stars?: boolean }
  // Friend -> host: the team asked for, or why there isn't one.
  | { type: 'team'; team: OnlineTeam }
  | { type: 'teamError'; reason: string }
  // Host -> friend: the battle couldn't start.
  | { type: 'startError'; reason: string }
  // Host -> friend: their screen. `from` is how much of the log they already have - only
  // the lines after it are sent (0 for a new battle, with the whole log).
  | { type: 'view'; from: number; view: BattleView }
  // Friend -> host: their choice for the turn; the host answers with whether it stood.
  | { type: 'choose'; id: number; choice: string }
  | { type: 'chosen'; id: number; error?: string }
  // Friend -> host: giving up the battle.
  | { type: 'forfeit' }
  // Host -> friend: an online chaos draft is starting, from these Smogon tiers.
  | { type: 'draftStart'; setFormats: string[] }
  // Either way: done picking for the battle after `stage` battles - here's the team.
  | { type: 'draftTeam'; stage: number; team: OnlineDraftTeam }
  // Either way: the lead picked for that battle (the whole team, in order - the first
  // leads). The host starts the battle once it has both.
  | { type: 'draftLead'; stage: number; order: number[] }
  // Either way: leaving the chaos draft (back to the room).
  | { type: 'draftLeave' }
  // Host -> friend: a co-op Battle Tower run - a new one, or carrying on the one with this
  // seed (with the host's last fight fought together, in case the friend's copy missed it).
  | { type: 'coopStart'; setup: CoopSetup; resume: boolean; lastBattle: CoopBattleResult | null }
  // Friend -> host: the friend's copy can't (another run of theirs, no save of this one...).
  | { type: 'coopRefuse'; reason: string }
  // Either way: where this player's co-op run stands now.
  | { type: 'coopProgress'; progress: CoopProgress }
  // Friend -> host: waiting at the boss or villain on this floor, with their run team.
  | { type: 'coopTeam'; floor: number; team: OnlineCoopTeam }
  // Either way: leaving the co-op run (back to the room - it stays saved).
  | { type: 'coopLeave' }
  // Either way: leaving the room.
  | { type: 'bye' }
