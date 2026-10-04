import { Peer, type DataConnection } from 'peerjs'
import type { BattleView } from '../../shared/battle-types'
import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  ROOM_ID_PREFIX,
  type OnlineMessage,
  type OnlinePlayer,
  type OnlineViews
} from '../../shared/online'

// Online battles with a friend. One player hosts a room and reads its code out; the other
// joins with it. The two copies then talk straight to each other (WebRTC - the free public
// PeerJS server only introduces them). The host's main process runs the battle for both:
// the friend's copy sends its choices across and shows the screens it's sent back.
// Kept outside React, so the room stays open while the menus come and go.

export type OnlinePhase = 'idle' | 'connecting' | 'waiting' | 'lobby' | 'battle'

export interface OnlineState {
  phase: OnlinePhase
  role: 'host' | 'guest' | null
  code: string | null
  friend: OnlinePlayer | null
  // The host is asking for the friend's team / setting the battle up.
  starting: boolean
  error: string | null
}

const IDLE: OnlineState = { phase: 'idle', role: null, code: null, friend: null, starting: false, error: null }

let state: OnlineState = IDLE
let peer: Peer | null = null
let conn: DataConnection | null = null
let self: OnlinePlayer | null = null
// Host: the doubles setting for the battle being set up, and how much of the friend's log
// they already have.
let pendingDoubles = false
let guestSent = 0
// The last screen shown here, so the next can keep its half-made choices (and, for the
// friend, be pieced together from just the new lines).
let lastView: BattleView | null = null
// Friend: choices sent and not yet answered.
let nextChoiceId = 1
const pendingChoices = new Map<number, { resolve: () => void; reject: (error: Error) => void }>()

const stateListeners = new Set<(state: OnlineState) => void>()
const viewListeners = new Set<(view: BattleView, fresh: boolean) => void>()

function setState(patch: Partial<OnlineState>): void {
  state = { ...state, ...patch }
  for (const listener of stateListeners) listener(state)
}

export function getOnlineState(): OnlineState {
  return state
}

export function subscribeOnline(listener: (state: OnlineState) => void): () => void {
  stateListeners.add(listener)
  return () => stateListeners.delete(listener)
}

// Every screen of an online battle, for the battle page (`fresh` for a new battle's first).
export function onOnlineBattleView(listener: (view: BattleView, fresh: boolean) => void): () => void {
  viewListeners.add(listener)
  return () => viewListeners.delete(listener)
}

const LOG_ARRAYS = ['log', 'logStates', 'feedback', 'moveEvents', 'gimmickEvents', 'abilityEvents'] as const

// Just the log lines after `from` (the rest of the screen whole).
function sliceView(view: BattleView, from: number): BattleView {
  const sliced = { ...view }
  for (const key of LOG_ARRAYS) (sliced as Record<string, unknown>)[key] = (view[key] ?? []).slice(from)
  return sliced
}

function showView(next: BattleView, from: number): void {
  // The rest of a battle whose end screen is already closed.
  if (from > 0 && !lastView) return
  // The friend is only ever sent a whole log for a new battle (the host's screens are
  // always whole, so there it's the first one since the lobby).
  const fresh = from === 0 && (state.role === 'guest' || state.phase !== 'battle')
  const view = { ...next }
  if (from > 0 && lastView) {
    for (const key of LOG_ARRAYS) {
      ;(view as Record<string, unknown>)[key] = [...(lastView[key] ?? []).slice(0, from), ...(next[key] ?? [])]
    }
  }
  // The same request as before: the screen keeps the one it has, so a choice already
  // picked this turn stays picked.
  if (lastView?.request && view.request && lastView.requestSeq === view.requestSeq) view.request = lastView.request
  lastView = view
  if (state.phase !== 'battle') setState({ phase: 'battle', starting: false, error: null })
  for (const listener of viewListeners) listener(view, fresh)
}

function send(message: OnlineMessage): void {
  if (conn?.open) void conn.send(message)
}

function randomCode(): string {
  let code = ''
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)]
  return code
}

// Turns PeerJS's errors into something a player can act on.
function errorText(type: string, fallback: string): string {
  if (type === 'peer-unavailable') return 'No room with that code - check it and try again'
  if (type === 'network' || type === 'server-error' || type === 'socket-error' || type === 'socket-closed') {
    return "Couldn't reach the matchmaking server - check your internet connection"
  }
  if (type === 'browser-incompatible') return "Online play isn't supported here"
  return fallback
}

function reset(error: string | null = null): void {
  conn?.close()
  peer?.destroy()
  conn = null
  peer = null
  lastView = null
  for (const pending of pendingChoices.values()) pending.reject(new Error('Disconnected'))
  pendingChoices.clear()
  state = { ...IDLE, error }
  for (const listener of stateListeners) listener(state)
}

/** Opens a room and waits for a friend to join with its code. */
export async function hostRoom(): Promise<void> {
  if (state.phase !== 'idle') return
  setState({ ...IDLE, phase: 'connecting', role: 'host' })
  try {
    self = (await window.api.getOnlineSelf()).player
  } catch (e) {
    reset(e instanceof Error ? e.message : String(e))
    return
  }
  openRoom(3)
}

function openRoom(triesLeft: number): void {
  const code = randomCode()
  const room = new Peer(ROOM_ID_PREFIX + code)
  peer = room
  room.on('open', () => setState({ phase: 'waiting', code }))
  room.on('error', (error) => {
    if (peer !== room) return
    // Someone else already has this code: pick another.
    if (error.type === 'unavailable-id' && triesLeft > 1) {
      room.destroy()
      openRoom(triesLeft - 1)
      return
    }
    // A failed connection attempt doesn't close the room.
    if (state.phase === 'waiting' || state.phase === 'lobby' || state.phase === 'battle') {
      if (error.type === 'webrtc' || error.type === 'peer-unavailable') return
    }
    reset(errorText(error.type, error.message))
  })
  room.on('connection', (incoming) => {
    // One friend per room.
    if (conn) {
      incoming.on('open', () => {
        void incoming.send({ type: 'reject', reason: 'That room already has two players' } satisfies OnlineMessage)
        setTimeout(() => incoming.close(), 500)
      })
      return
    }
    attach(incoming)
  })
}

/** Joins a friend's room by its code. */
export async function joinRoom(rawCode: string): Promise<void> {
  if (state.phase !== 'idle') return
  const code = rawCode.trim().toUpperCase()
  if (code.length !== ROOM_CODE_LENGTH || [...code].some((c) => !ROOM_CODE_ALPHABET.includes(c))) {
    setState({ error: `A room code is ${ROOM_CODE_LENGTH} letters and numbers` })
    return
  }
  setState({ ...IDLE, phase: 'connecting', role: 'guest', code })
  try {
    self = (await window.api.getOnlineSelf()).player
  } catch (e) {
    reset(e instanceof Error ? e.message : String(e))
    return
  }
  const me = new Peer()
  peer = me
  me.on('open', () => {
    if (peer !== me) return
    attach(me.connect(ROOM_ID_PREFIX + code, { reliable: true }))
  })
  me.on('error', (error) => {
    if (peer !== me) return
    reset(errorText(error.type, error.message))
  })
}

function attach(connection: DataConnection): void {
  conn = connection
  connection.on('open', () => {
    if (self) send({ type: 'hello', player: self })
  })
  connection.on('data', (data) => {
    if (conn === connection) void receive(data as OnlineMessage)
  })
  connection.on('close', () => {
    if (conn === connection) friendLeft()
  })
  connection.on('error', () => {
    if (conn === connection) friendLeft()
  })
}

// The friend went away (closed the game, lost their connection or left the room).
function friendLeft(): void {
  const name = state.friend?.name ?? 'Your friend'
  if (state.role === 'host') {
    // Mid-battle, leaving counts as giving up.
    if (state.phase === 'battle' && lastView && !lastView.ended) void window.api.forfeitOnline(1)
    conn = null
    guestSent = 0
    // The room stays open for them to come back.
    setState({ phase: state.phase === 'battle' ? 'battle' : 'waiting', friend: null, starting: false, error: `${name} left the room` })
    return
  }
  // The friend's copy can't go on without the host's: an unfinished battle just stops.
  if (state.phase === 'battle' && lastView && !lastView.ended) {
    const view = { ...lastView, ended: true, winner: null, request: null }
    lastView = view
    for (const listener of viewListeners) listener(view, false)
  }
  reset(`Lost the connection to ${name}`)
}

async function receive(message: OnlineMessage): Promise<void> {
  if (!message || typeof message !== 'object') return
  switch (message.type) {
    case 'hello': {
      const friend = message.player
      if (!self || !friend) return
      if (friend.version !== self.version) {
        const reason = `Different game versions (${self.version} here, ${friend.version} there) - both players need the same one`
        if (state.role === 'host') send({ type: 'reject', reason })
        if (state.role === 'host') {
          setTimeout(() => conn?.close(), 500)
          setState({ error: reason })
        } else reset(reason)
        return
      }
      setState({ phase: 'lobby', friend, error: null })
      return
    }
    case 'reject':
      reset(message.reason)
      return
    case 'teamRequest': {
      try {
        const { team } = await window.api.getOnlineSelf()
        if (team.team.length === 0) send({ type: 'teamError', reason: `${self?.name ?? 'Your friend'} has no Pokemon on their team` })
        else send({ type: 'team', team })
      } catch (e) {
        send({ type: 'teamError', reason: e instanceof Error ? e.message : String(e) })
      }
      return
    }
    case 'team': {
      if (state.role !== 'host' || !state.friend) return
      try {
        guestSent = 0
        lastView = null
        const views = await window.api.startOnlineBattle(state.friend, message.team, pendingDoubles)
        hostViews(views)
      } catch (e) {
        const reason = e instanceof Error ? e.message : String(e)
        send({ type: 'startError', reason })
        setState({ starting: false, error: reason })
      }
      return
    }
    case 'teamError':
    case 'startError':
      setState({ starting: false, error: message.reason })
      return
    case 'view':
      if (state.role === 'guest') showView(message.view, message.from)
      return
    case 'choose':
      if (state.role !== 'host') return
      window.api.chooseOnline(1, message.choice).then(
        () => send({ type: 'chosen', id: message.id }),
        (e) => send({ type: 'chosen', id: message.id, error: e instanceof Error ? e.message : String(e) })
      )
      return
    case 'chosen': {
      const pending = pendingChoices.get(message.id)
      pendingChoices.delete(message.id)
      if (message.error) pending?.reject(new Error(message.error))
      else pending?.resolve()
      return
    }
    case 'forfeit':
      if (state.role === 'host') void window.api.forfeitOnline(1)
      return
    case 'bye':
      friendLeft()
      return
  }
}

// Host: the battle moved on - show this side's screen, send the friend theirs.
function hostViews(views: OnlineViews): void {
  showView(views.host, 0)
  send({ type: 'view', from: guestSent, view: sliceView(views.guest, guestSent) })
  guestSent = views.guest.log.length
}

window.api.onOnlineViews((views) => {
  if (state.role === 'host' && state.phase === 'battle') hostViews(views)
})

/** Host: asks for the friend's team and starts a battle with it. */
export function startOnlineBattle(doubles: boolean): void {
  if (state.role !== 'host' || state.phase !== 'lobby' || state.starting) return
  pendingDoubles = doubles
  setState({ starting: true, error: null })
  send({ type: 'teamRequest', doubles })
}

/** This player's choice for the turn. Resolves once it stands (rejects if the sim refused it). */
export function chooseOnline(choice: string): Promise<void> {
  if (state.role === 'host') return window.api.chooseOnline(0, choice)
  return new Promise((resolve, reject) => {
    const id = nextChoiceId++
    pendingChoices.set(id, { resolve, reject })
    send({ type: 'choose', id, choice })
  })
}

export function forfeitOnline(): void {
  if (state.role === 'host') void window.api.forfeitOnline(0)
  else send({ type: 'forfeit' })
}

/** The battle's end screen was closed: back to the room, ready for another. */
export function leaveOnlineBattle(): void {
  lastView = null
  if (state.role === 'host') void window.api.endOnlineBattle()
  if (state.phase !== 'battle') return
  setState({ phase: state.friend ? 'lobby' : state.role === 'host' ? 'waiting' : 'idle' })
}

/** Closes the room (or leaves the friend's). */
export function leaveRoom(): void {
  send({ type: 'bye' })
  if (state.role === 'host') void window.api.endOnlineBattle()
  // Give the goodbye a moment to go out before hanging up.
  const closingConn = conn
  const closingPeer = peer
  conn = null
  peer = null
  setTimeout(() => {
    closingConn?.close()
    closingPeer?.destroy()
  }, 300)
  reset()
}

export function clearOnlineError(): void {
  if (state.error) setState({ error: null })
}
