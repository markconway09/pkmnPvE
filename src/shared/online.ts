import type { BattleView } from './battle-types'

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
  // Host -> friend: send your team, a battle is starting (singles or doubles).
  | { type: 'teamRequest'; doubles: boolean }
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
  // Either way: leaving the room.
  | { type: 'bye' }
