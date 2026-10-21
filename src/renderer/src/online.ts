import { useSyncExternalStore } from 'react'
import { t } from './i18n'
import { Peer, type DataConnection } from 'peerjs'
import { COMPANION_SIZES, type BattleView, type CoopBattleResult, type RunDifficulty, type RunView } from '../../shared/battle-types'
import type { DraftView } from '../../shared/draft'
import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  ROOM_ID_PREFIX,
  type CoopProgress,
  type CoopSetup,
  type OnlineCoopTeam,
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

// An online chaos draft (see shared/online.ts): this player's side of it, and whether each
// player has picked their lead for the next battle.
export interface OnlineDraftState {
  view: DraftView
  leadPicked: boolean
  friendLeadPicked: boolean
}

// A co-op Battle Tower run (see shared/online.ts): its settings, where the friend's run
// stands, and whether this player is waiting at a boss or villain for them. `version` goes
// up whenever this copy changed the player's co-op run itself (the friend's run ending
// theirs, a fight's result) - the run screen reads it again then.
export interface OnlineCoopState {
  setup: CoopSetup
  partner: CoopProgress | null
  ready: { floor: number; kind: 'boss' | 'villain' } | null
  version: number
}

export interface OnlineState {
  phase: OnlinePhase
  role: 'host' | 'guest' | null
  code: string | null
  friend: OnlinePlayer | null
  // The host is asking for the friend's team / setting the battle up.
  starting: boolean
  error: string | null
  // An online chaos draft is going (the room stays in the lobby between its battles).
  draft: OnlineDraftState | null
  // A co-op Battle Tower run is going (the room stays in the lobby between its fights together).
  coop: OnlineCoopState | null
}

const IDLE: OnlineState = {
  phase: 'idle',
  role: null,
  code: null,
  friend: null,
  starting: false,
  error: null,
  draft: null,
  coop: null
}

let state: OnlineState = IDLE
// How long opening or joining a room may take before the player is told why it isn't working.
const CONNECT_TIMEOUT_MS = 20_000
let connectTimer: ReturnType<typeof setTimeout> | undefined
let peer: Peer | null = null
let conn: DataConnection | null = null
let self: OnlinePlayer | null = null
// Host: the doubles and merge-star settings for the battle being set up, and how much of
// the friend's log they already have.
let pendingDoubles = false
let pendingStars = false
let guestSent = 0
// The last screen shown here, so the next can keep its half-made choices (and, for the
// friend, be pieced together from just the new lines).
let lastView: BattleView | null = null
// Friend: choices sent and not yet answered.
let nextChoiceId = 1
const pendingChoices = new Map<number, { resolve: () => void; reject: (error: Error) => void }>()
// Chaos draft: the battle (by battles played before it) this player's team was last sent
// for, both players' leads (by battle too), and whether the battle on screen still has
// to be counted once it ends.
let sentTeamStage = -1
let myLead: { stage: number; order: number[] } | null = null
let friendLead: { stage: number; order: number[] } | null = null
let draftResultPending = false
// Co-op: the friend's run team for the fight they're waiting at (host), and the fights
// together whose result this copy has already applied (friend).
let friendCoopTeam: { floor: number; team: OnlineCoopTeam } | null = null
const appliedCoopBattles = new Set<string>()

const stateListeners = new Set<(state: OnlineState) => void>()
const viewListeners = new Set<(view: BattleView, fresh: boolean) => void>()
// A co-op fight cut off by a dropped connection: the battle screen just closes.
const battleClosedListeners = new Set<() => void>()

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

/** The room's state, kept up to date (for screens that change while a friend is connected). */
export function useOnlineState(): OnlineState {
  return useSyncExternalStore(subscribeOnline, getOnlineState)
}

// Every screen of an online battle, for the battle page (`fresh` for a new battle's first).
export function onOnlineBattleView(listener: (view: BattleView, fresh: boolean) => void): () => void {
  viewListeners.add(listener)
  return () => viewListeners.delete(listener)
}

// A co-op fight that stopped part-way (the connection dropped) - the battle page closes.
export function onOnlineBattleClosed(listener: () => void): () => void {
  battleClosedListeners.add(listener)
  return () => battleClosedListeners.delete(listener)
}

function closeBattle(): void {
  lastView = null
  for (const listener of battleClosedListeners) listener()
}

const LOG_ARRAYS = ['log', 'logStates', 'feedback', 'moveEvents', 'gimmickEvents', 'abilityEvents', 'hitEvents'] as const

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
  // A chaos draft battle: each copy counts its own player's result (a tie for both).
  if (fresh && state.draft) draftResultPending = true
  if (view.ended && draftResultPending) {
    draftResultPending = false
    const result = view.winner === 'You' ? true : view.winner === null ? null : false
    window.api.finishOnlineDraftBattle(result).then(showDraftView, () => {})
  }
  // A co-op fight: nobody is waiting at the boss any more - and once it's over, the
  // friend's copy applies how it went to its own run (the host's already has).
  if (fresh && state.coop?.ready) setState({ coop: { ...state.coop, ready: null } })
  const result = view.coop?.result
  if (view.ended && result && state.role === 'guest' && !appliedCoopBattles.has(result.battleId)) {
    appliedCoopBattles.add(result.battleId)
    applyCoopResult(result, view)
  }
}

// The friend's copy: a fight together's result into its run, and its screen's results.
function applyCoopResult(result: CoopBattleResult, view: BattleView | null): void {
  window.api.applyCoopBattle(result).then(
    (applied) => {
      if (state.coop) setState({ coop: { ...state.coop, version: state.coop.version + 1 } })
      if (!applied || !view || lastView !== view) return
      const patched = { ...view, expGains: applied.expGains, runFainted: applied.fainted, runItemReward: applied.itemReward }
      lastView = patched
      for (const listener of viewListeners) listener(patched, false)
    },
    (e) => setState({ error: e instanceof Error ? e.message : String(e) })
  )
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
  if (type === 'peer-unavailable') return t('online.noRoom')
  if (type === 'network' || type === 'server-error' || type === 'socket-error' || type === 'socket-closed' || type === 'disconnected') {
    return t('online.noServer')
  }
  if (type === 'webrtc') return BLOCKED_TEXT
  if (type === 'browser-incompatible') return t('online.unsupported')
  return fallback
}

// The two devices talk to each other directly; some networks (school, work, some mobile
// data and hotspots) block that, and the room then just never connects.
const BLOCKED_TEXT =
  t('online.blocked')

// Gives up on a room that hasn't opened (host) or reached the friend (guest) in time.
function startConnectTimer(message: string): void {
  clearTimeout(connectTimer)
  connectTimer = setTimeout(() => {
    if (state.phase === 'connecting') reset(message)
  }, CONNECT_TIMEOUT_MS)
}

// A room that loses the matchmaking server keeps its open connection, but no one new
// could join it - so it signs back in.
function keepSignedIn(room: Peer): void {
  room.on('disconnected', () => {
    if (peer === room && !room.destroyed) room.reconnect()
  })
}

function reset(error: string | null = null): void {
  clearTimeout(connectTimer)
  conn?.close()
  peer?.destroy()
  conn = null
  peer = null
  lastView = null
  for (const pending of pendingChoices.values()) pending.reject(new Error(t('online.disconnected')))
  pendingChoices.clear()
  if (state.draft) void window.api.endOnlineDraft()
  resetDraftProgress()
  friendCoopTeam = null
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
  startConnectTimer(t('online.noServer'))
  keepSignedIn(room)
  room.on('open', () => {
    clearTimeout(connectTimer)
    setState({ phase: 'waiting', code })
  })
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
        void incoming.send({ type: 'reject', reason: t('online.roomFull') } satisfies OnlineMessage)
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
    setState({ error: t('online.badCode', { n: ROOM_CODE_LENGTH }) })
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
  // Reaching the server and then the friend; the hello that moves on to the lobby ends it.
  startConnectTimer(BLOCKED_TEXT)
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
  const name = state.friend?.name ?? t('online.yourFriend')
  // A co-op fight cut off part-way counts for neither run: both runs are still at the
  // boss, saved, and the fight starts over when the two meet up again.
  const coopCutOff = !!state.coop && state.phase === 'battle' && !!lastView && !lastView.ended
  if (state.role === 'host') {
    // Mid-battle, leaving counts as giving up.
    if (coopCutOff) {
      void window.api.abandonCoopBattle()
      closeBattle()
    } else if (state.phase === 'battle' && lastView && !lastView.ended) void window.api.forfeitOnline(1)
    conn = null
    guestSent = 0
    // A chaos draft can't go on without them.
    if (state.draft) void window.api.endOnlineDraft()
    resetDraftProgress()
    friendCoopTeam = null
    // The room stays open for them to come back.
    setState({
      phase: state.phase === 'battle' && !coopCutOff ? 'battle' : 'waiting',
      friend: null,
      starting: false,
      draft: null,
      coop: null,
      error: state.coop ? t('online.leftCoop', { name }) : t('online.left', { name })
    })
    return
  }
  if (coopCutOff) {
    closeBattle()
    reset(t('online.lostCoop', { name }))
    return
  }
  // The friend's copy can't go on without the host's: an unfinished battle just stops.
  if (state.phase === 'battle' && lastView && !lastView.ended) {
    const view = { ...lastView, ended: true, winner: null, request: null }
    lastView = view
    for (const listener of viewListeners) listener(view, false)
  }
  reset(t('online.lost', { name }))
}

// The friend's title, gold name and companion, checked over since they came over the
// network - anything that isn't what it should be is just left off their panel.
function friendLooks(friend: OnlinePlayer): Pick<OnlinePlayer, 'title' | 'dexComplete' | 'companion'> {
  const mon = friend.companion
  const companion =
    mon && typeof mon === 'object' && typeof mon.species === 'string' && mon.species && COMPANION_SIZES.includes(mon.size)
      ? { species: mon.species, shiny: mon.shiny === true, gmaxLook: mon.gmaxLook === true, size: mon.size }
      : null
  return {
    title: typeof friend.title === 'string' && friend.title ? friend.title : null,
    dexComplete: friend.dexComplete === true,
    companion
  }
}

async function receive(message: OnlineMessage): Promise<void> {
  if (!message || typeof message !== 'object') return
  switch (message.type) {
    case 'hello': {
      const friend = message.player
      if (!self || !friend) return
      if (friend.version !== self.version) {
        const reason = t('online.versions', { mine: self.version, theirs: friend.version })
        if (state.role === 'host') send({ type: 'reject', reason })
        if (state.role === 'host') {
          setTimeout(() => conn?.close(), 500)
          setState({ error: reason })
        } else reset(reason)
        return
      }
      clearTimeout(connectTimer)
      setState({ phase: 'lobby', friend: { ...friend, ...friendLooks(friend) }, error: null })
      return
    }
    case 'reject':
      reset(message.reason)
      return
    case 'teamRequest': {
      try {
        const { team } = await window.api.getOnlineSelf()
        if (team.team.length === 0) send({ type: 'teamError', reason: t('online.noTeam', { name: self?.name ?? t('online.yourFriend') }) })
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
        const views = await window.api.startOnlineBattle(state.friend, message.team, pendingDoubles, pendingStars)
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
      // A chaos draft battle that couldn't start: both pick their leads again.
      if (state.draft) {
        myLead = null
        friendLead = null
        showDraftView(state.draft.view)
      }
      // A co-op fight that couldn't start: nobody's waiting at the boss any more.
      if (state.coop) setState({ coop: { ...state.coop, ready: null } })
      setState({ starting: false, error: message.reason })
      return
    case 'coopStart':
      if (state.role === 'guest' && message.setup) void joinCoop(message.setup, !!message.resume, message.lastBattle ?? null)
      return
    case 'coopRefuse':
      if (state.role === 'host') setState({ coop: null, starting: false, error: message.reason })
      return
    case 'coopProgress':
      if (state.coop && message.progress && typeof message.progress === 'object') void partnerProgressed(message.progress)
      return
    case 'coopTeam':
      if (state.role !== 'host' || !state.coop || !message.team) return
      friendCoopTeam = { floor: Number(message.floor), team: message.team }
      startCoopBattleIfReady()
      return
    case 'coopLeave':
      if (state.coop) {
        friendCoopTeam = null
        setState({ coop: null, error: t('online.leftCoopRun', { name: state.friend?.name ?? t('online.yourFriend') }) })
      }
      return
    case 'draftStart': {
      if (state.role !== 'guest') return
      try {
        resetDraftProgress()
        showDraftView((await window.api.startOnlineDraft(message.setFormats)).view)
        setState({ error: null })
      } catch (e) {
        send({ type: 'draftLeave' })
        setState({ draft: null, error: e instanceof Error ? e.message : String(e) })
      }
      return
    }
    case 'draftTeam': {
      if (!state.draft || !state.friend) return
      window.api.setOnlineDraftOpponent(message.stage, state.friend, message.team).then(showDraftView, (e) =>
        setState({ error: e instanceof Error ? e.message : String(e) })
      )
      return
    }
    case 'draftLead':
      if (!state.draft) return
      friendLead = { stage: message.stage, order: message.order }
      showDraftView(state.draft.view)
      startDraftBattleIfReady()
      return
    case 'draftLeave':
      if (state.draft) endDraft(t('online.leftDraft', { name: state.friend?.name ?? t('online.yourFriend') }))
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
    case 'undo':
      if (state.role !== 'host') return
      window.api.undoOnline(1).then(
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
export function startOnlineBattle(doubles: boolean, stars: boolean): void {
  if (state.role !== 'host' || state.phase !== 'lobby' || state.starting || state.draft) return
  pendingDoubles = doubles
  pendingStars = stars
  setState({ starting: true, error: null })
  send({ type: 'teamRequest', doubles, stars })
}

// ---- Online chaos draft (see shared/online.ts) ----

function resetDraftProgress(): void {
  sentTeamStage = -1
  myLead = null
  friendLead = null
  draftResultPending = false
}

// Battles played so far in the draft (ties too) - the stage its messages are about.
function draftStage(view: DraftView): number {
  return view.wins + view.losses + (view.ties ?? 0)
}

/** This player's draft moved on: shown, and - once done picking for a battle - sent to the friend. */
export function showDraftView(view: DraftView): void {
  if (!state.friend && !state.draft) return
  const stage = draftStage(view)
  setState({ draft: { view, leadPicked: myLead?.stage === stage, friendLeadPicked: friendLead?.stage === stage } })
  if (view.status === 'battling' && sentTeamStage !== stage) {
    sentTeamStage = stage
    window.api.getOnlineDraftTeam().then(
      (team) => send({ type: 'draftTeam', stage, team }),
      (e) => setState({ error: e instanceof Error ? e.message : String(e) })
    )
  }
}

function endDraft(error: string | null = null): void {
  resetDraftProgress()
  void window.api.endOnlineDraft()
  setState({ draft: null, starting: false, error })
}

/** Host: starts an online chaos draft - the friend's copy starts one from the same tiers. */
export async function startOnlineDraft(): Promise<void> {
  if (state.role !== 'host' || state.phase !== 'lobby' || state.starting || state.draft) return
  setState({ starting: true, error: null })
  try {
    resetDraftProgress()
    const { view, setFormats } = await window.api.startOnlineDraft()
    send({ type: 'draftStart', setFormats })
    setState({ starting: false })
    showDraftView(view)
  } catch (e) {
    setState({ starting: false, error: e instanceof Error ? e.message : String(e) })
  }
}

/** The lead for the next draft battle (the whole team, in order). The host starts it once both have picked. */
export function pickOnlineDraftLead(order: number[]): void {
  const draft = state.draft
  if (!draft || draft.view.status !== 'battling' || !draft.view.opponent) return
  const stage = draftStage(draft.view)
  if (myLead?.stage === stage) return
  myLead = { stage, order }
  send({ type: 'draftLead', stage, order })
  showDraftView(draft.view)
  startDraftBattleIfReady()
}

function startDraftBattleIfReady(): void {
  if (state.role !== 'host' || !state.draft || !state.friend || state.starting || !myLead || !friendLead) return
  const stage = draftStage(state.draft.view)
  if (myLead.stage !== stage || friendLead.stage !== stage) return
  setState({ starting: true, error: null })
  guestSent = 0
  lastView = null
  window.api.startOnlineDraftBattle(state.friend, myLead.order, friendLead.order).then(hostViews, (e) => {
    const reason = e instanceof Error ? e.message : String(e)
    send({ type: 'startError', reason })
    myLead = null
    friendLead = null
    if (state.draft) showDraftView(state.draft.view)
    setState({ starting: false, error: reason })
  })
}

/** Leaves the chaos draft (the friend's ends too, unless the match is already over). */
export function leaveOnlineDraft(): void {
  if (!state.draft) return
  if (state.draft.view.status !== 'finished') send({ type: 'draftLeave' })
  endDraft()
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

/**
 * Takes back this player's choice for the turn while the friend is still picking. Once
 * taken back, the screen gets a fresh copy of the turn's request, so every slot is asked again.
 */
export async function undoOnlineChoice(): Promise<void> {
  if (state.role === 'host') await window.api.undoOnline(0)
  else {
    await new Promise<void>((resolve, reject) => {
      const id = nextChoiceId++
      pendingChoices.set(id, { resolve, reject })
      send({ type: 'undo', id })
    })
  }
  const view = lastView
  if (!view?.request) return
  const reopened = { ...view, request: { ...view.request } as typeof view.request }
  lastView = reopened
  for (const listener of viewListeners) listener(reopened, false)
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

// ---- Co-op Battle Tower (see shared/online.ts) ----

function randomSeed(): string {
  return Array.from({ length: 16 }, () => Math.floor(Math.random() * 36).toString(36)).join('')
}

/** Host: a new co-op run for both, on these settings - each player then picks a starter. */
export function startCoopRun(difficulty: RunDifficulty, generation: number | null): void {
  if (state.role !== 'host' || state.phase !== 'lobby' || state.starting || state.draft || state.coop) return
  const setup: CoopSetup = { seed: randomSeed(), difficulty, generation }
  friendCoopTeam = null
  setState({ coop: { setup, partner: null, ready: null, version: 0 }, error: null })
  send({ type: 'coopStart', setup, resume: false, lastBattle: null })
}

/** Host: carries on the co-op run saved with this friend (the friend's copy must have it too). */
export async function resumeCoopRun(run: RunView): Promise<void> {
  if (state.role !== 'host' || state.phase !== 'lobby' || state.starting || state.draft || state.coop || !run.coop) return
  const setup: CoopSetup = { seed: run.coop.seed, difficulty: run.difficulty, generation: run.generation }
  friendCoopTeam = null
  setState({ coop: { setup, partner: null, ready: null, version: 0 }, error: null })
  let lastBattle: CoopBattleResult | null = null
  try {
    lastBattle = await window.api.getLastCoopBattle()
  } catch {
    // Nothing to send again.
  }
  send({ type: 'coopStart', setup, resume: true, lastBattle })
}

// The friend's copy: the host started (or carried on) a co-op run - joined if this copy can.
async function joinCoop(setup: CoopSetup, resume: boolean, lastBattle: CoopBattleResult | null): Promise<void> {
  const friendName = state.friend?.name ?? t('online.yourFriend')
  const myName = self?.name ?? t('online.yourFriend')
  let run: RunView | null = null
  try {
    run = await window.api.coopRun.getRun()
  } catch {
    run = null
  }
  const sameRun = run?.coop?.seed === setup.seed
  if (resume && !sameRun) {
    send({ type: 'coopRefuse', reason: t('online.noCoopSave', { name: myName }) })
    setState({ error: t('online.wantedCoop', { name: friendName }) })
    return
  }
  if (!resume && run?.status === 'active' && !sameRun) {
    send({ type: 'coopRefuse', reason: t('online.otherCoop', { name: myName }) })
    setState({ error: t('online.forfeitOther', { name: friendName, partner: run.coop?.partnerName ?? t('online.someoneElse') }) })
    return
  }
  friendCoopTeam = null
  setState({ coop: { setup, partner: null, ready: null, version: 0 }, draft: null, error: null })
  // A fight together the host's copy finished but this one never heard the end of.
  if (sameRun && lastBattle && !appliedCoopBattles.has(lastBattle.battleId)) {
    appliedCoopBattles.add(lastBattle.battleId)
    applyCoopResult(lastBattle, null)
  }
}

// Where the friend's run stands now. Their run over means this one is too.
async function partnerProgressed(progress: CoopProgress): Promise<void> {
  const coop = state.coop
  if (!coop) return
  setState({ coop: { ...coop, partner: progress } })
  // No longer waiting at the boss: the team they sent for it is out of date.
  if (!progress.ready) friendCoopTeam = null
  if (progress.seed === coop.setup.seed && progress.status === 'lost') {
    try {
      const run = await window.api.coopRun.getRun()
      if (run?.status === 'active' && run.coop?.seed === coop.setup.seed) {
        await window.api.coopRun.forfeitRun()
        if (state.coop) setState({ coop: { ...state.coop, ready: null, version: state.coop.version + 1 } })
      }
    } catch {
      // The run screen shows how things stand.
    }
  }
  startCoopBattleIfReady()
}

/** This player's co-op run as it now stands, for the friend's screen. */
export function reportCoopProgress(run: RunView | null): void {
  const coop = state.coop
  if (!coop) return
  const mine = run?.coop?.seed === coop.setup.seed ? run : null
  send({
    type: 'coopProgress',
    progress: {
      seed: mine ? coop.setup.seed : null,
      status: mine ? mine.status : 'none',
      floor: mine?.floor ?? 0,
      bossesBeaten: mine?.bossesBeaten ?? 0,
      team: mine?.team ?? [],
      ready: coop.ready
    }
  })
}

/**
 * Waiting at this floor's boss or villain for the friend (or not any more: null). The
 * friend's copy sends its run team along; the host's starts the fight once both are there.
 */
export async function setCoopReady(ready: { floor: number; kind: 'boss' | 'villain' } | null, run: RunView | null): Promise<void> {
  if (!state.coop) return
  // The friend's copy sends its team first, so the host's never starts with an old one.
  let team: OnlineCoopTeam | null = null
  if (ready && state.role === 'guest') {
    try {
      team = await window.api.getCoopTeam()
    } catch (e) {
      setState({ error: e instanceof Error ? e.message : String(e) })
      return
    }
  }
  const coop = state.coop
  if (!coop) return
  setState({ coop: { ...coop, ready }, error: null })
  if (ready && team) send({ type: 'coopTeam', floor: ready.floor, team })
  reportCoopProgress(run)
  startCoopBattleIfReady()
}

// Host: both at the same boss (or villain), the friend's team in hand - the fight starts.
function startCoopBattleIfReady(): void {
  const coop = state.coop
  if (state.role !== 'host' || !coop?.ready || !state.friend || state.starting || state.phase !== 'lobby') return
  const floor = coop.ready.floor
  if (coop.partner?.ready?.floor !== floor || friendCoopTeam?.floor !== floor) return
  const team = friendCoopTeam.team
  friendCoopTeam = null
  setState({ starting: true, error: null })
  guestSent = 0
  lastView = null
  window.api.startCoopBattle(state.friend, team).then(
    (views) => {
      setState({ starting: false })
      hostViews(views)
    },
    (e) => {
      const reason = e instanceof Error ? e.message : String(e)
      send({ type: 'startError', reason })
      setState({ starting: false, error: reason, coop: state.coop ? { ...state.coop, ready: null } : null })
    }
  )
}

/** Leaves the co-op run (back to the room) - both copies keep it saved. */
export function leaveCoopRun(): void {
  if (!state.coop) return
  send({ type: 'coopLeave' })
  friendCoopTeam = null
  setState({ coop: null })
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
