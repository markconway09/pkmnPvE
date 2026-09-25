import { useEffect, useRef, useState, type ReactNode } from 'react'
import type {
  BattleView,
  FeedbackEvent,
  FieldEffectView,
  ActivePokemonView,
  FieldSnapshot,
  GimmickEvent,
  MoveEvent,
  SessionInfo,
  WildLocationId
} from '../../shared/battle-types'
import { toSpriteId } from '../../shared/battle-types'
import BattleSprite from './BattleSprite'
import AnimationLayer from './AnimationLayer'
import MoveButton from './MoveButton'
import TeamPanel, { type TeamMatchup } from './TeamPanel'
import TrainerHud from './TrainerHud'
import BattleResultModal from './BattleResultModal'
import FieldEffectsOverlay from './FieldEffectsOverlay'
import { backdropUrl, randomBackdropId } from './battleScenery'
import Options from './Options'
import MainMenu from './MainMenu'
import TrainerList from './TrainerList'
import PremadeTeamsList from './PremadeTeamsList'
import ProgressionEditor from './ProgressionEditor'
import { loadSpriteStyle, saveSpriteStyle, spriteUrl, type SpriteStyle } from './spriteStyle'
import {
  effectivenessClass,
  effectivenessText,
  effectivenessWords,
  foeSlotsLeftToRight,
  type EffectivenessChip
} from './effectiveness'
import { loadLegacyTrainerSprite } from './trainerSprite'
import Login from './Login'

type Screen = 'menu' | 'battle' | 'options' | 'trainers' | 'rogueliteBosses' | 'premadeTeams' | 'progression'

const REVEAL_DELAY_MS = 350
const EMPTY_FIELD: FieldSnapshot = { p1: [], p2: [], effects: [] }

// Move target types that need an explicit target once there's more than one
// active Pokemon per side - mirrors Showdown's own CHOOSABLE_TARGETS gate
// (battle-actions.js). Everything else (self, spread moves, side effects,
// ...) auto-resolves without one.
const CHOOSABLE_TARGETS = new Set(['normal', 'any', 'adjacentAlly', 'adjacentAllyOrSelf', 'adjacentFoe'])

// The side conditions that get a visual wall next to the Pokemon (see
// SideScreens.tsx) rather than just the text badge FieldEffectsOverlay
// already shows every 'side'-kind effect.
const SCREEN_EFFECT_IDS = new Set(['reflect', 'lightscreen', 'auroraveil'])

interface GimmickOption {
  label: string
  suffix: string
  typeForBadge?: string
}

interface GimmickFlags {
  canMegaEvo?: boolean
  canMegaEvoX?: boolean
  canMegaEvoY?: boolean
  canUltraBurst?: boolean
  canZMove?: unknown
  canTerastallize?: string
}

interface TargetOption {
  loc: number
  label: string
  // Shown in the target picker: its 2D sprite (a foe from the front, your own side
  // from the back) and, for a foe, how effective the move is against it.
  species: string
  facing: 'front' | 'back'
  effectiveness?: number | null
}

interface TargetPrompt {
  slotIndex: number
  moveIndex: number
  gimmickSuffix: string
  options: TargetOption[]
}

function getGimmickOption(active: GimmickFlags): GimmickOption | null {
  // Mega/Z-move take priority over Tera when available, replacing it rather
  // than offering both - Dynamax is intentionally left out.
  if (active.canMegaEvo || active.canMegaEvoX || active.canMegaEvoY) {
    const suffix = !active.canMegaEvo && active.canMegaEvoY ? 'megay' : !active.canMegaEvo ? 'megax' : 'mega'
    return { label: 'Mega Evolve', suffix }
  }
  if (active.canUltraBurst) {
    return { label: 'Ultra Burst', suffix: 'ultra' }
  }
  if (active.canZMove) {
    return { label: 'Z-Move', suffix: 'zmove' }
  }
  if (active.canTerastallize) {
    return { label: 'Terastallize', suffix: 'terastallize', typeForBadge: active.canTerastallize }
  }
  return null
}

// Mega X/Y count as the same gimmick as Mega - a side gets one of each kind.
function gimmickKind(suffix: string): string {
  return suffix.startsWith('mega') ? 'mega' : suffix
}

// The gimmick a submitted choice uses ("move 2 terastallize 1" -> "terastallize"), if any.
function gimmickKindInChoice(choice: string | null): string | null {
  const suffix = choice?.split(' ').find((word) => /^(mega[xy]?|ultra|zmove|terastallize)$/.test(word))
  return suffix ? gimmickKind(suffix) : null
}

// The team list and the Poke Balls at the top show where things stand at the point
// the log has reached, not the end of the turn the server already sent - otherwise a
// faint or a status would show up there before the animation for it plays.
interface MonState {
  hpPercent?: number
  fainted: boolean
  status: string | null
}

interface SettledTeams {
  // How long the log was when this was the latest state - a longer log than what's
  // revealed means it belongs to an earlier battle.
  logLength: number
  team: Map<string, MonState>
  roster: Map<string, MonState>
}

// The same Pokemon across a forme change: "Charizard" and "Charizard-Mega-X".
function sameMon(a: string, b: string): boolean {
  return a === b || a.startsWith(`${b}-`) || b.startsWith(`${a}-`)
}

function lookupState(states: Map<string, MonState>, species: string): MonState | undefined {
  const exact = states.get(species)
  if (exact) return exact
  for (const [name, state] of states) if (sameMon(name, species)) return state
  return undefined
}

// Each side's state as of `upTo` log lines: the last settled state, moved forward by
// every Pokemon seen on the field in the lines since (so one that switched out
// mid-turn keeps the damage it took before leaving).
function replayStates(
  base: Map<string, MonState>,
  snapshots: FieldSnapshot[],
  from: number,
  upTo: number,
  side: 'p1' | 'p2'
): Map<string, MonState> {
  const states = new Map(base)
  for (let i = from; i < upTo; i++) {
    for (const mon of snapshots[i]?.[side] ?? []) {
      if (!mon) continue
      for (const name of [...states.keys()]) if (name !== mon.species && sameMon(name, mon.species)) states.delete(name)
      states.set(mon.species, { hpPercent: mon.hpPercent, fainted: mon.fainted, status: mon.status })
    }
  }
  return states
}

function renderLogLine(line: string): ReactNode {
  const parts = line.split('**')
  return parts.map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part))
}

// Whether the Pokemon in this active slot has fainted (and, since it's still in a
// move request, wasn't replaced) - the sim wants that slot passed, not given a move.
function isFaintedSlot(request: NonNullable<BattleView['request']>, slotIndex: number): boolean {
  return request.side.pokemon.filter((p) => p.active)[slotIndex]?.condition.endsWith(' fnt') ?? false
}

async function skipTeamPreview(view: BattleView): Promise<BattleView> {
  let current = view
  while (!current.ended && current.request && 'teamPreview' in current.request && current.request.teamPreview) {
    current = await window.api.submitChoice('default')
  }
  return current
}

interface GameProps {
  username: string
  isAdmin: boolean
  // The trainer sprite to start with (the saved one, or a default for a new player).
  initialTrainerSprite: string
  savedTrainerSprite: boolean
  onLogout: () => Promise<void>
}

function Game({ username, isAdmin, initialTrainerSprite, savedTrainerSprite, onLogout }: GameProps): React.JSX.Element {
  const [screen, setScreen] = useState<Screen>('menu')
  // Which trainer list the premade teams screen was opened from, to go back to.
  const [premadeTeamsBack, setPremadeTeamsBack] = useState<Screen>('trainers')
  const [view, setView] = useState<BattleView | null>(null)
  const [revealedCount, setRevealedCount] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Re-rolled every time a battle starts.
  const [backdrop, setBackdrop] = useState(randomBackdropId)
  const [confirmingRun, setConfirmingRun] = useState(false)
  const [spriteStyle, setSpriteStyle] = useState<SpriteStyle>(loadSpriteStyle)
  const [trainerSprite, setTrainerSprite] = useState<string>(initialTrainerSprite)
  const logRef = useRef<HTMLDivElement>(null)
  const battleFieldRef = useRef<HTMLDivElement>(null)
  // Set when a revealed log line uses a move the animation spike knows about -
  // AnimationLayer plays it and clears this back to null when done.
  const [animTrigger, setAnimTrigger] = useState<MoveEvent | null>(null)
  // Lifted out of MainMenu so it survives a battle - MainMenu unmounts while
  // screen !== 'menu', which would otherwise reset it back to 'all'/100 every time.
  const [wildLocation, setWildLocation] = useState<WildLocationId>('all')
  const [wildLevelCap, setWildLevelCap] = useState<number>(100)

  // One entry per active slot (length 1 in singles, up to 2 in doubles) -
  // filled in as the player picks a move/switch for each, and once every
  // entry is non-null the combined choice is submitted as one turn.
  const [pendingChoices, setPendingChoices] = useState<(string | null)[]>([])
  const [pendingGimmick, setPendingGimmick] = useState<boolean[]>([])
  const [targeting, setTargeting] = useState<TargetPrompt | null>(null)
  // Which active slot's panel is on screen right now - in doubles, moves are
  // picked one Pokemon at a time, left to right, like Showdown.
  const [activeSelectSlot, setActiveSelectSlot] = useState(0)

  function changeSpriteStyle(style: SpriteStyle): void {
    setSpriteStyle(style)
    saveSpriteStyle(style)
  }

  // The player's own background picture (Options → Background), shown behind every
  // screen - dimmed a little so the panels on top stay readable.
  const [background, setBackground] = useState<string | null>(null)

  useEffect(() => {
    window.api.getBackground().then(setBackground, () => setBackground(null))
  }, [])

  useEffect(() => {
    const body = document.body.style
    if (background) {
      body.backgroundImage = `linear-gradient(rgba(16, 20, 26, 0.55), rgba(16, 20, 26, 0.55)), url("${background}")`
      body.backgroundSize = 'cover'
      body.backgroundPosition = 'center'
      body.backgroundAttachment = 'fixed'
    } else {
      body.backgroundImage = ''
    }
    return () => {
      body.backgroundImage = ''
    }
  }, [background])

  function changeTrainerSprite(id: string): void {
    setTrainerSprite(id)
    void window.api.setTrainerSprite(id)
  }

  // A player who has never picked a sprite gets the default written into their
  // save, so other players see the same one when they fight their team.
  useEffect(() => {
    if (!savedTrainerSprite) void window.api.setTrainerSprite(initialTrainerSprite)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reveal log lines (and the field state that goes with each) one at a time,
  // instead of jumping straight to the end-of-turn result. Holds off the next
  // line while a move animation is still playing, so it doesn't get cut short
  // or overlap with the next one - AnimationLayer clears animTrigger itself
  // once it's done.
  useEffect(() => {
    if (!view || revealedCount >= view.log.length || animTrigger) return
    const timer = setTimeout(() => setRevealedCount((c) => c + 1), REVEAL_DELAY_MS)
    return () => clearTimeout(timer)
  }, [view, revealedCount, animTrigger])

  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [revealedCount])

  // A genuinely new decision point - reset per-slot state for it. `pass` is
  // pre-filled for any forceSwitch slot that doesn't actually need a switch.
  useEffect(() => {
    const request = view?.request
    if (request && 'active' in request && request.active) {
      // A slot whose Pokemon fainted with nothing left to replace it has no choice to make.
      setPendingChoices(request.active.map((_, i) => (isFaintedSlot(request, i) ? 'pass' : null)))
      setPendingGimmick(request.active.map(() => false))
      // Start on the first slot that actually needs a choice.
      const firstOpen = request.active.findIndex((_, i) => !isFaintedSlot(request, i))
      setActiveSelectSlot(firstOpen < 0 ? 0 : firstOpen)
    } else if (request && 'forceSwitch' in request && request.forceSwitch) {
      // In doubles, when both Pokemon faint with only one left on the bench, the
      // sim still flags both slots - the ones there's nobody to send in for pass.
      let benchLeft = request.side.pokemon.filter((p) => !p.active && !p.condition.endsWith(' fnt')).length
      setPendingChoices(
        request.forceSwitch.map((mustSwitch) => {
          if (!mustSwitch || benchLeft <= 0) return 'pass'
          benchLeft--
          return null
        })
      )
      setPendingGimmick([])
    } else {
      setPendingChoices([])
      setPendingGimmick([])
    }
    setTargeting(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view?.request])

  // Any new turn (or battle) un-arms a pending "run from the shiny?" click, so
  // a stale first click can't turn a later one into an instant escape.
  useEffect(() => {
    setConfirmingRun(false)
  }, [view])

  const visibleLogCount = Math.min(revealedCount, view?.log.length ?? 0)
  const visibleLog = view?.log.slice(0, visibleLogCount) ?? []
  const field = visibleLogCount > 0 ? view!.logStates[visibleLogCount - 1] : EMPTY_FIELD
  const caughtUp = !view || visibleLogCount >= view.log.length
  const isDoubles = !!view?.logStates.some((s) => s.p1[1] || s.p2[1])
  const activeFlags = view?.request?.side.pokemon.map((p) => p.active) ?? []

  // Snapshot of both teams once the log is fully played out - the starting point the
  // next turn's list is rewound to while that turn plays.
  const [settled, setSettled] = useState<SettledTeams | null>(null)
  useEffect(() => {
    if (!view || !caughtUp) return
    const toStates = (mons: { species: string; hpPercent?: number; fainted: boolean; status: string | null }[]) =>
      new Map(mons.map((m) => [m.species, { hpPercent: m.hpPercent, fainted: m.fainted, status: m.status }]))
    setSettled({ logLength: view.log.length, team: toStates(view.team), roster: toStates(view.opponentRoster) })
  }, [view, caughtUp])
  // A new battle starts its log from nothing - the last battle's teams mean nothing to it.
  useEffect(() => {
    if (revealedCount === 0) setSettled(null)
  }, [revealedCount])
  // Only while this turn's lines are still playing, and only for this battle.
  const rewinding = !!view && !caughtUp && !!settled && settled.logLength <= visibleLogCount
  const teamStates = rewinding ? replayStates(settled.team, view.logStates, settled.logLength, visibleLogCount, 'p1') : null
  const rosterStates = rewinding ? replayStates(settled.roster, view.logStates, settled.logLength, visibleLogCount, 'p2') : null
  const displayedTeam: ActivePokemonView[] = (view?.team ?? []).map((mon) => {
    const state = teamStates && lookupState(teamStates, mon.species)
    return state ? { ...mon, hpPercent: state.hpPercent ?? mon.hpPercent, fainted: state.fainted, status: state.status } : mon
  })
  const displayedRoster = (view?.opponentRoster ?? []).map((mon) => {
    const state = rosterStates && lookupState(rosterStates, mon.species)
    return state ? { ...mon, fainted: state.fainted, status: state.status } : mon
  })
  // Who's marked as out on the field - from the field itself while the turn plays.
  const displayedActiveFlags = rewinding
    ? displayedTeam.map((mon) => field.p1.some((a) => !!a && !a.fainted && sameMon(a.species, mon.species)))
    : activeFlags
  // Only the line just revealed carries a result to flash - see BattleSprite,
  // which keeps it on screen for a bit after this goes back to null.
  const currentFeedback = visibleLogCount > 0 ? (view?.feedback[visibleLogCount - 1] ?? null) : null
  const currentGimmick = visibleLogCount > 0 ? (view?.gimmickEvents?.[visibleLogCount - 1] ?? null) : null
  const gimmickFor = (slot: GimmickEvent['slot']): GimmickEvent | null =>
    currentGimmick?.slot === slot ? currentGimmick : null
  const feedbackFor = (slot: FeedbackEvent['slot']): FeedbackEvent | null =>
    currentFeedback?.slot === slot ? currentFeedback : null

  // When the line just revealed is a move being used, play its animation -
  // the real attacker/target slots come straight from the sim (see
  // computeMoveEvent in battle-runtime.ts), so this works the same in
  // doubles as singles instead of guessing from the log text.
  useEffect(() => {
    if (visibleLogCount === 0 || !view) return
    const event = view.moveEvents[visibleLogCount - 1]
    if (event) setAnimTrigger(event)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleLogCount])

  async function startBattle(location?: WildLocationId, levelCap?: number): Promise<void> {
    setError(null)
    setBusy(true)
    try {
      const initial = await skipTeamPreview(await window.api.startBattle(location, levelCap))
      setBackdrop(randomBackdropId(location))
      setView(initial)
      setRevealedCount(0)
      setScreen('battle')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function startTrainerBattle(boss: boolean, rematchTrainerId?: string): Promise<void> {
    setError(null)
    setBusy(true)
    try {
      const initial = await skipTeamPreview(await window.api.startTrainerBattle(boss, rematchTrainerId))
      setBackdrop(randomBackdropId())
      setView(initial)
      setRevealedCount(0)
      setScreen('battle')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  // Another player's saved team. Unlike the other fights, a failure is thrown back to
  // whoever asked (the challenge box shows it) rather than set on the main menu.
  // A Roguelite floor's fight, already started by the run menu. A failure goes back to
  // the run menu, which shows it.
  async function startRunBattle(started: BattleView, location?: WildLocationId): Promise<void> {
    setError(null)
    const initial = await skipTeamPreview(started)
    setBackdrop(randomBackdropId(location))
    setView(initial)
    setRevealedCount(0)
    setScreen('battle')
  }

  async function startPlayerBattle(name: string, doubles: boolean): Promise<void> {
    setBusy(true)
    try {
      const initial = await skipTeamPreview(await window.api.startPlayerBattle(name, doubles))
      setBackdrop(randomBackdropId())
      setView(initial)
      setRevealedCount(0)
      setError(null)
      setScreen('battle')
    } finally {
      setBusy(false)
    }
  }

  async function runFromBattle(): Promise<void> {
    if (busy) return
    setBusy(true)
    try {
      await window.api.runFromBattle()
      setError(null)
      setScreen('menu')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function choose(choice: string): Promise<void> {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const next = await skipTeamPreview(await window.api.submitChoice(choice))
      setView(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      // The turn wasn't accepted: hand back a fresh copy of the request so every slot
      // is asked again, instead of leaving all of them marked as already chosen.
      setView((v) => (v && v.request ? { ...v, request: { ...v.request } as typeof v.request } : v))
    } finally {
      setBusy(false)
    }
  }

  // Once every active slot has a choice, submit them together as one turn.
  useEffect(() => {
    if (pendingChoices.length > 0 && pendingChoices.every((c) => c !== null)) {
      void choose(pendingChoices.join(', '))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingChoices])

  function setPendingChoice(slotIndex: number, choiceStr: string): void {
    setPendingChoices((prev) => {
      const next = [...prev]
      next[slotIndex] = choiceStr
      return next
    })
  }

  function togglePendingGimmick(slotIndex: number): void {
    // Each kind (Mega, Z-Move, Terastallize, ...) can be used once a turn, so turning
    // it on for one Pokemon turns it off for the other.
    const slots = view?.request && 'active' in view.request ? (view.request.active ?? []) : []
    const kindOf = (i: number): string | null => {
      const option = slots[i] ? getGimmickOption(slots[i]) : null
      return option ? gimmickKind(option.suffix) : null
    }
    setPendingGimmick((prev) => {
      const next = [...prev]
      next[slotIndex] = !next[slotIndex]
      if (next[slotIndex]) {
        for (let i = 0; i < next.length; i++) {
          if (i !== slotIndex && kindOf(i) !== null && kindOf(i) === kindOf(slotIndex)) next[i] = false
        }
      }
      return next
    })
  }

  // 1-indexed team slots some *other* active slot has already picked as its
  // switch-in this turn, so the same bench Pokemon can't be sent out twice.
  function reservedSwitchSlots(excludeSlotIndex: number): Set<number> {
    const reserved = new Set<number>()
    for (let i = 0; i < pendingChoices.length; i++) {
      if (i === excludeSlotIndex) continue
      const match = /^switch (\d+)$/.exec(pendingChoices[i] ?? '')
      if (match) reserved.add(Number(match[1]))
    }
    return reserved
  }

  // Whichever Pokemon a click in the switch column would apply to right now -
  // the active slot mid move-selection, or the first forced replacement still
  // needed - or null when there's nothing to switch into at the moment.
  function currentSwitchTarget(): { slotIndex: number; disabled: boolean; forced: boolean } | null {
    const request = view?.request
    if (request && 'forceSwitch' in request && request.forceSwitch) {
      const slotIndex = request.forceSwitch.findIndex((mustSwitch, i) => mustSwitch && pendingChoices[i] == null)
      return slotIndex < 0 ? null : { slotIndex, disabled: !caughtUp || busy, forced: true }
    }
    if (request && 'active' in request && request.active) {
      const active = request.active[activeSelectSlot]
      if (!active || active.trapped) return null
      return { slotIndex: activeSelectSlot, disabled: !caughtUp || busy, forced: false }
    }
    return null
  }

  // The targets a move can be aimed at, in the order they appear on screen, left to
  // right: your own side is drawn slot 1 then slot 2, the opponent's the other way round.
  function targetOptionsFor(moveTarget: string, slotIndex: number, moveId: string): TargetOption[] {
    if (moveTarget === 'adjacentAlly' || moveTarget === 'adjacentAllyOrSelf') {
      const allySlotIndex = slotIndex === 0 ? 1 : 0
      const options: TargetOption[] = []
      for (const i of [0, 1]) {
        const mon = field.p1[i]
        if (!mon) continue
        if (i === allySlotIndex && !mon.fainted) {
          options.push({ loc: -(i + 1), label: mon.species, species: mon.species, facing: 'back' })
        } else if (i === slotIndex && moveTarget === 'adjacentAllyOrSelf') {
          options.push({ loc: -(i + 1), label: `${mon.species} (self)`, species: mon.species, facing: 'back' })
        }
      }
      return options
    }
    const effectiveness = view?.moveEffectiveness?.[slotIndex]?.[moveId]
    return foeSlotsLeftToRight(true)
      .filter((i) => field.p2[i] && !field.p2[i]!.fainted)
      .map((i) => ({
        loc: i + 1,
        label: field.p2[i]!.species,
        species: field.p2[i]!.species,
        facing: 'front' as const,
        effectiveness: effectiveness?.[i] ?? null
      }))
  }

  // Each team member's matchup against the foes out (both ways), in screen order,
  // for the switch list.
  function teamMatchupChips(): TeamMatchup[] {
    const chips = (perFoe: (number | null)[] | undefined): EffectivenessChip[] =>
      foeSlotsLeftToRight(isDoubles).flatMap((i) => {
        const multiplier = perFoe?.[i]
        const foe = field.p2[i]
        return multiplier == null || !foe || foe.fainted ? [] : [{ foeName: foe.species, multiplier }]
      })
    return (view?.team ?? []).map((_, i) => ({
      offense: chips(view?.teamMatchups?.[i]),
      defense: chips(view?.teamDefense?.[i])
    }))
  }

  // A move's effectiveness against each foe out, in screen order, for its button.
  function effectivenessChipsFor(slotIndex: number, moveId: string): EffectivenessChip[] | undefined {
    const effectiveness = view?.moveEffectiveness?.[slotIndex]?.[moveId]
    if (!effectiveness) return undefined
    return foeSlotsLeftToRight(isDoubles).flatMap((i) => {
      const multiplier = effectiveness[i]
      const foe = field.p2[i]
      return multiplier == null || !foe || foe.fainted ? [] : [{ foeName: foe.species, multiplier }]
    })
  }

  // The next active slot after `after` that still needs a choice (skipping any
  // that fainted straight into an auto-pass), or null once there isn't one.
  function nextOpenActiveSlot(after: number): number | null {
    const request = view?.request
    if (!(request && 'active' in request && request.active)) return null
    for (let i = after + 1; i < request.active.length; i++) {
      if (!isFaintedSlot(request, i)) return i
    }
    return null
  }

  // The active slot before `before` a Cancel would return to, or null if
  // `before` is already the first one.
  function prevActiveSlot(before: number): number | null {
    const request = view?.request
    if (!(request && 'active' in request && request.active)) return null
    for (let i = before - 1; i >= 0; i--) {
      if (!isFaintedSlot(request, i)) return i
    }
    return null
  }

  // Locks in this slot's choice and, in doubles, moves on to the next
  // Pokemon still waiting on one - same one-at-a-time flow as Showdown.
  function commitActiveSlotChoice(slotIndex: number, choiceStr: string): void {
    setPendingChoice(slotIndex, choiceStr)
    const next = nextOpenActiveSlot(slotIndex)
    if (next !== null) setActiveSelectSlot(next)
  }

  // Steps back to the previous Pokemon's panel and clears its choice so it
  // can be picked again - what the Cancel button does.
  function goBackActiveSlot(): void {
    const prev = prevActiveSlot(activeSelectSlot)
    if (prev === null) return
    setPendingChoices((current) => {
      const next = [...current]
      next[prev] = null
      return next
    })
    setActiveSelectSlot(prev)
    setTargeting(null)
  }

  function chooseMoveForSlot(slotIndex: number, moveIndex: number, moveTarget: string | undefined, gimmickSuffix: string): void {
    const request = view?.request
    const numActive = request && 'active' in request && request.active ? request.active.length : 1
    if (numActive < 2 || !moveTarget || !CHOOSABLE_TARGETS.has(moveTarget)) {
      commitActiveSlotChoice(slotIndex, `move ${moveIndex + 1}${gimmickSuffix}`)
      return
    }
    const moveId = (request && 'active' in request ? request.active?.[slotIndex]?.moves[moveIndex]?.id : undefined) ?? ''
    const options = targetOptionsFor(moveTarget, slotIndex, moveId)
    if (options.length <= 1) {
      commitActiveSlotChoice(slotIndex, `move ${moveIndex + 1}${gimmickSuffix} ${options[0]?.loc ?? 1}`)
      return
    }
    setTargeting({ slotIndex, moveIndex, gimmickSuffix, options })
  }

  function confirmTarget(loc: number): void {
    if (!targeting) return
    commitActiveSlotChoice(targeting.slotIndex, `move ${targeting.moveIndex + 1}${targeting.gimmickSuffix} ${loc}`)
    setTargeting(null)
  }

  if (screen === 'options') {
    return (
      <Options
        username={username}
        onLogout={onLogout}
        spriteStyle={spriteStyle}
        onChangeSpriteStyle={changeSpriteStyle}
        background={background}
        onChangeBackground={setBackground}
        onBack={() => setScreen('menu')}
      />
    )
  }

  if (screen === 'trainers') {
    return (
      <TrainerList
        onBack={() => setScreen('menu')}
        onPremadeTeams={() => {
          setPremadeTeamsBack('trainers')
          setScreen('premadeTeams')
        }}
      />
    )
  }

  if (screen === 'rogueliteBosses') {
    return (
      <TrainerList
        roguelite
        onBack={() => setScreen('menu')}
        onPremadeTeams={() => {
          setPremadeTeamsBack('rogueliteBosses')
          setScreen('premadeTeams')
        }}
      />
    )
  }

  if (screen === 'premadeTeams') {
    return <PremadeTeamsList onBack={() => setScreen(premadeTeamsBack)} />
  }

  if (screen === 'progression') {
    return <ProgressionEditor onBack={() => setScreen('menu')} />
  }

  if (screen === 'menu') {
    return (
      <MainMenu
        onFight={() => void startBattle(wildLocation, wildLevelCap)}
        wildLocation={wildLocation}
        onChangeWildLocation={setWildLocation}
        wildLevelCap={wildLevelCap}
        onChangeWildLevelCap={setWildLevelCap}
        onTrainerFight={() => void startTrainerBattle(false)}
        onBossFight={() => void startTrainerBattle(true)}
        onBossRematch={(trainerId) => void startTrainerBattle(true, trainerId)}
        onOptions={() => setScreen('options')}
        onTrainers={() => setScreen('trainers')}
        onRogueliteBosses={() => setScreen('rogueliteBosses')}
        onProgression={() => setScreen('progression')}
        fightBusy={busy}
        fightError={error}
        trainerSprite={trainerSprite}
        onChangeTrainerSprite={changeTrainerSprite}
        username={username}
        isAdmin={isAdmin}
        onChallengePlayer={startPlayerBattle}
        onRunBattle={startRunBattle}
      />
    )
  }

  const hazardsFor = (side: 'p1' | 'p2'): FieldEffectView[] =>
    field.effects.filter((e) => e.kind === 'hazard' && e.side === side)

  const screensFor = (side: 'p1' | 'p2'): FieldEffectView[] =>
    field.effects.filter((e) => e.kind === 'side' && e.side === side && SCREEN_EFFECT_IDS.has(e.id))

  const activeRequest = view?.request && 'active' in view.request ? view.request.active : undefined
  const forceSwitchRequest = view?.request && 'forceSwitch' in view.request ? view.request.forceSwitch : undefined
  const switchTarget = currentSwitchTarget()

  return (
    <div className="screen battle-screen">
      <div className="switch-column">
        {switchTarget && (
          <TeamPanel
            team={displayedTeam}
            activeFlags={displayedActiveFlags}
            selectable
            disabled={switchTarget.disabled}
            matchups={teamMatchupChips()}
            reservedSlots={reservedSwitchSlots(switchTarget.slotIndex)}
            onSwitch={(slot) => {
              if (switchTarget.forced) setPendingChoice(switchTarget.slotIndex, `switch ${slot}`)
              else commitActiveSlotChoice(switchTarget.slotIndex, `switch ${slot}`)
            }}
          />
        )}
      </div>

      <div className="battle-main">
        {view && (
          <div className="battle-huds-large">
            <TrainerHud
              name="You"
              spriteId={trainerSprite}
              roster={displayedTeam.map((m) => ({ species: m.species, fainted: m.fainted, status: m.status }))}
              align="left"
              size="large"
            />
            {view.opponentTrainer && (
              <TrainerHud
                name={view.opponentTrainer.name}
                spriteId={view.opponentTrainer.spriteId}
                roster={displayedRoster}
                align="right"
                size="large"
                rewards={view.rewards}
              />
            )}
          </div>
        )}

        <div ref={battleFieldRef} className={`battle-field${isDoubles ? ' battle-field-doubles' : ''}`}>
          <div className="field-backdrop" style={{ backgroundImage: `url(${backdropUrl(backdrop)})` }} />
          <FieldEffectsOverlay effects={field.effects} />
          <BattleSprite
            pokemon={field.p2[0] ?? null}
            facing="front"
            align="right"
            slotIndex={0}
            spriteStyle={spriteStyle}
            hazards={hazardsFor('p2')}
            screens={screensFor('p2')}
            feedback={feedbackFor('p2a')}
            gimmick={gimmickFor('p2a')}
            slot="p2a"
          />
          <BattleSprite
            pokemon={field.p2[1] ?? null}
            facing="front"
            align="right"
            slotIndex={1}
            spriteStyle={spriteStyle}
            feedback={feedbackFor('p2b')}
            gimmick={gimmickFor('p2b')}
            slot="p2b"
          />
          <BattleSprite
            pokemon={field.p1[0] ?? null}
            facing="back"
            align="left"
            slotIndex={0}
            spriteStyle={spriteStyle}
            hazards={hazardsFor('p1')}
            screens={screensFor('p1')}
            feedback={feedbackFor('p1a')}
            gimmick={gimmickFor('p1a')}
            slot="p1a"
          />
          <BattleSprite
            pokemon={field.p1[1] ?? null}
            facing="back"
            align="left"
            slotIndex={1}
            spriteStyle={spriteStyle}
            feedback={feedbackFor('p1b')}
            gimmick={gimmickFor('p1b')}
            slot="p1b"
          />
          <AnimationLayer fieldRef={battleFieldRef} trigger={animTrigger} onDone={() => setAnimTrigger(null)} />
        </div>

        {caughtUp && view?.ended && (
          <BattleResultModal
            winner={view.winner}
            expGains={view.expGains}
            itemDrops={view.itemDrops}
            moneyGained={view.moneyGained}
            canCatch={view.winner === 'You' && !view.opponentTrainer}
            isWildBattle={!view.opponentTrainer}
            opponentShiny={!!view.p2[0]?.shiny}
            runBattle={view.runBattle}
            runFainted={view.runFainted}
            runItemReward={view.runItemReward}
            onClose={() => setScreen('menu')}
          />
        )}

        {!view?.ended && activeRequest && (
          <div className="battle-action-slots">
            {activeRequest.map((active, slotIndex) => {
              // Doubles picks one Pokemon at a time - only its panel is on screen.
              if (slotIndex !== activeSelectSlot) return null
              const gimmick = getGimmickOption(active)
              // Doubles locks in one Pokemon at a time, so the gimmick may already be spoken
              // for by a partner's locked-in move this turn - only one of each kind per turn
              // (the sim rejects the whole turn otherwise).
              const gimmickTaken =
                !!gimmick &&
                pendingChoices.some(
                  (choice, i) => i !== slotIndex && gimmickKindInChoice(choice) === gimmickKind(gimmick.suffix)
                )
              const gimmickOn = (pendingGimmick[slotIndex] ?? false) && !gimmickTaken
              const chosen = pendingChoices[slotIndex] != null
              const slotMon = field.p1[slotIndex]
              // Its STAB types: once Terastallized, its original types still count and the
              // Tera type joins them (Stellar boosts differently, so it's left out); toggling
              // Tera on for this turn shows what that would do.
              const teraNow = slotMon?.terastallized ?? (gimmickOn && gimmick?.suffix === 'terastallize' ? (gimmick.typeForBadge ?? null) : null)
              const stabTypes = slotMon
                ? {
                    own: slotMon.terastallized ? slotMon.baseTypes : slotMon.types,
                    tera: teraNow && teraNow !== 'Stellar' ? teraNow : null
                  }
                : undefined
              const canGoBack = prevActiveSlot(slotIndex) !== null
              const canRun = !canGoBack && !!view && !view.opponentTrainer
              return (
                <div key={slotIndex} className="battle-action-slot">
                  {activeRequest.length > 1 && slotMon && (
                    <div className="battle-action-slot-label">{slotMon.species}</div>
                  )}
                  {(gimmick || canGoBack || canRun) && (
                    <div className="battle-action-slot-header">
                      {gimmick && (
                        <button
                          className={`gimmick-toggle ${gimmickOn ? 'gimmick-toggle-on' : ''}`}
                          disabled={!caughtUp || busy || chosen || gimmickTaken}
                          title={gimmickTaken ? 'Your other Pokemon is already using this this turn' : undefined}
                          onClick={() => togglePendingGimmick(slotIndex)}
                        >
                          {gimmickOn ? '☑' : '☐'} {gimmick.label}
                          {gimmick.typeForBadge && (
                            <span className={`type-badge type-${gimmick.typeForBadge.toLowerCase()}`}>
                              {gimmick.typeForBadge}
                            </span>
                          )}
                        </button>
                      )}
                      {(canGoBack || canRun) && (
                        <button
                          className={`run-cancel-button ${confirmingRun && canRun ? 'confirm-button' : ''}`}
                          disabled={busy}
                          onClick={() => {
                            if (canGoBack) {
                              goBackActiveSlot()
                              return
                            }
                            // A shiny is worth a second thought before walking away from it.
                            if (view!.p2[0]?.shiny && !confirmingRun) setConfirmingRun(true)
                            else void runFromBattle()
                          }}
                        >
                          {canGoBack ? 'Cancel' : confirmingRun ? 'Run from the shiny? Click again' : 'Run'}
                        </button>
                      )}
                    </div>
                  )}
                  <div className="menu-panel">
                    {active.moves.map((move, i) => (
                      <MoveButton
                        key={move.id}
                        id={move.id}
                        name={move.move}
                        pp={move.pp ?? 0}
                        maxpp={move.maxpp ?? 0}
                        disabled={!caughtUp || busy || !!move.disabled || chosen}
                        power={view?.movePowers?.[slotIndex]?.[move.id]}
                        effectiveness={effectivenessChipsFor(slotIndex, move.id)}
                        stabTypes={stabTypes}
                        onChoose={() =>
                          chooseMoveForSlot(slotIndex, i, move.target, gimmickOn && gimmick ? ` ${gimmick.suffix}` : '')
                        }
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {!view?.ended && forceSwitchRequest && (
          <div className="battle-action-slots">
            <div className="battle-action-slot">
              <div className="battle-action-slot-label">Choose a replacement</div>
              <p className="box-empty-hint">Pick one from the list on the left.</p>
            </div>
          </div>
        )}

        {targeting && (
          <div className="target-picker-overlay" onMouseDown={() => setTargeting(null)}>
            <div className="target-picker" onMouseDown={(e) => e.stopPropagation()}>
              <div className="target-picker-title">Choose a target</div>
              <div className="target-picker-options">
                {targeting.options.map((opt) => (
                  <button key={opt.loc} className="target-option" onClick={() => confirmTarget(opt.loc)}>
                    <img
                      className="target-option-sprite"
                      src={spriteUrl('2d-static', opt.facing, toSpriteId(opt.species))}
                      alt=""
                    />
                    <span className="target-option-name">{opt.label}</span>
                    {opt.effectiveness != null && (
                      <span className={`eff-chip ${effectivenessClass(opt.effectiveness)}`}>
                        {effectivenessText(opt.effectiveness)} {effectivenessWords(opt.effectiveness)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <button onClick={() => setTargeting(null)}>Cancel</button>
            </div>
          </div>
        )}

        {caughtUp && !view?.ended && !view?.request && <p>Waiting...</p>}
        {error && <p style={{ color: '#ff6b6b' }}>{error}</p>}
      </div>

      <div className="log" ref={logRef}>
        {visibleLog.map((line, i) => (
          <div key={i} className={line.startsWith('  ') ? 'log-minor' : undefined}>
            {renderLogLine(line)}
          </div>
        ))}
      </div>
    </div>
  )
}

// Who is playing. The game itself is mounted per player (keyed by name), so
// switching players starts from a clean slate instead of showing the last
// player's screens.
function App(): React.JSX.Element {
  const [session, setSession] = useState<SessionInfo | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    window.api
      .getSession()
      .then(setSession)
      .catch((e) => setLoadError(e instanceof Error ? e.message : String(e)))
  }, [])

  async function logout(): Promise<void> {
    setSession(await window.api.logout())
  }

  if (loadError) {
    return (
      <div className="screen">
        <p className="editor-error">{loadError}</p>
      </div>
    )
  }
  if (!session) return <div className="screen" />
  if (!session.username) return <Login session={session} onLoggedIn={setSession} />

  // The very first player takes over the sprite chosen before there were players;
  // anyone who joins later starts with the default.
  const initialTrainerSprite = session.trainerSprite ?? (session.players.length <= 1 ? loadLegacyTrainerSprite() : 'red')
  return (
    <Game
      key={session.username}
      username={session.username}
      isAdmin={session.isAdmin}
      initialTrainerSprite={initialTrainerSprite}
      savedTrainerSprite={session.trainerSprite !== null}
      onLogout={logout}
    />
  )
}

export default App
