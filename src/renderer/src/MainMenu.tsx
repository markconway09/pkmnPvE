import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent
} from '@dnd-kit/core'
import { CONFIRM_SELL_TIERS, POKEMON_SELL_PRICES, WILD_LOCATIONS } from '../../shared/battle-types'
import type {
  BattleEligibility,
  BattleView,
  BoxPokemonView,
  BoxState,
  RunMovesPreview,
  RunView,
  WildLocationId
} from '../../shared/battle-types'
import TeamRow from './TeamRow'
import BoxGrid from './BoxGrid'
import PokemonEditor from './PokemonEditor'
import PokemonIconVisual from './PokemonIconVisual'
import DebugMenu from './DebugMenu'
import PlayerTrainerModal from './PlayerTrainerModal'
import PokedexModal from './PokedexModal'
import ChallengeModal from './ChallengeModal'
import StarterPicker from './StarterPicker'
import PokemonContextMenu from './PokemonContextMenu'
import BagModal from './BagModal'
import ShopModal from './ShopModal'
import WildDropsModal from './WildDropsModal'
import ShopPricesModal from './ShopPricesModal'
import LoadoutsModal from './LoadoutsModal'
import BossRematchModal from './BossRematchModal'
import RunMovesChoice from './RunMovesChoice'
import RoguelitePanel, { RUN_MON_DRAG_PREFIX, RUN_SLOT_DROP_PREFIX, RUN_STARTER_SLOT_ID } from './RoguelitePanel'
import { loadMenuMode, saveMenuMode, type MenuMode } from './menuMode'
import { trainerSpriteUrl } from './trainerSprite'
import SlotMachine from './SlotMachine'
import BlackjackTable from './BlackjackTable'
import type { GameCornerGame } from './GameCornerTabs'
import { errorMessage, useFloatingNotes } from './FloatingNotes'
import CoinShopModal from './CoinShopModal'
import RouletteTable from './RouletteTable'
import PlinkoBoard from './PlinkoBoard'
import ItemSprite from './ItemSprite'
import SearchBar from './SearchBar'
import AchievementsModal from './AchievementsModal'
import type { AchievementsState } from '../../shared/achievements'
import { LOCATION_BUTTON_BACKDROP, backdropUrl, locationIconUrl } from './battleScenery'
import { formatMoney } from './money'

interface Props {
  onFight: () => void
  wildLocation: WildLocationId
  onChangeWildLocation: (location: WildLocationId) => void
  wildLevelCap: number
  onChangeWildLevelCap: (levelCap: number) => void
  onTrainerFight: () => void
  onBossFight: () => void
  onBossRematch: (trainerId: string) => void
  onOptions: () => void
  onTrainers: () => void
  onRogueliteBosses: () => void
  onProgression: () => void
  fightBusy: boolean
  fightError: string | null
  trainerSprite: string
  onChangeTrainerSprite: (id: string) => void
  username: string
  isAdmin: boolean
  onChallengePlayer: (username: string, doubles: boolean) => Promise<void>
  // A Roguelite floor's fight has started - App takes it from here like any battle.
  onRunBattle: (view: BattleView, location?: WildLocationId) => Promise<void>
}

const EMPTY_TEAM: (string | null)[] = [null, null, null, null, null, null]
// Below this a wild encounter's level range gets thin enough to barely mean
// anything - the slider simply doesn't go lower.
const WILD_LEVEL_CAP_MIN = 15
// The Poke Ball on the Showdown item sheet - the Classic mode's icon.
const POKE_BALL_SPRITENUM = 345

// The orders the expanded box can be sorted in.
type BoxSortKey = 'arrival' | 'name' | 'bst' | 'dex'
const BOX_SORTS: { key: BoxSortKey; label: string }[] = [
  { key: 'arrival', label: 'Catch date' },
  { key: 'name', label: 'Name' },
  { key: 'bst', label: 'Base stat total' },
  { key: 'dex', label: 'Pokédex number' }
]

// Ascending order for a sort key (the caller flips it for descending).
function compareBoxMons(a: BoxPokemonView, b: BoxPokemonView, key: BoxSortKey): number {
  if (key === 'name') return a.species.localeCompare(b.species)
  if (key === 'bst') return (a.bst ?? 0) - (b.bst ?? 0)
  if (key === 'dex') return (a.dexNum ?? 0) - (b.dexNum ?? 0)
  return (a.arrival ?? 0) - (b.arrival ?? 0)
}

// The box search: every word typed has to match something about the Pokemon - its
// species, a type, its ability, item or nature, or one of its moves ("fire", "u-turn").
function matchesBoxSearch(mon: BoxPokemonView, search: string): boolean {
  const words = search.toLowerCase().split(/s+/).filter(Boolean)
  if (words.length === 0) return true
  const squash = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]/g, '')
  const haystack = [mon.species, ...mon.types, mon.ability, mon.item, mon.nature, ...mon.moveIds].map(squash)
  return words.every((word) => {
    const w = squash(word)
    return !w || haystack.some((field) => field.includes(w))
  })
}

// Each mode's colour, for the pulse when switching to it (the toggle's own colours).
const MODE_COLORS: Record<MenuMode, string> = { classic: '#6bb0ff', roguelite: '#b48cff' }

// Players who've asked their system for less motion get the switch without the effects.
function reducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

function MainMenu({
  onFight,
  wildLocation,
  onChangeWildLocation,
  wildLevelCap,
  onChangeWildLevelCap,
  onTrainerFight,
  onBossFight,
  onBossRematch,
  onOptions,
  onTrainers,
  onRogueliteBosses,
  onProgression,
  fightBusy,
  fightError,
  trainerSprite,
  onChangeTrainerSprite,
  username,
  isAdmin,
  onChallengePlayer,
  onRunBattle
}: Props): React.JSX.Element {
  const [boxState, setBoxState] = useState<BoxState | null>(null)
  // Classic or Roguelite menu - remembered per player. Switching never touches a run.
  const [mode, setMode] = useState<MenuMode>(() => loadMenuMode(username))
  // Switching modes: the colour pulse spreading from the toggle (see toggleMode), and the
  // menu content fading in behind it.
  const [modePulse, setModePulse] = useState<{ x: number; y: number; radius: number; mode: MenuMode; seq: number } | null>(
    null
  )
  const sectionRef = useRef<HTMLDivElement>(null)
  const shownMode = useRef(mode)
  useEffect(() => {
    if (shownMode.current === mode) return
    shownMode.current = mode
    if (reducedMotion()) return
    sectionRef.current?.animate(
      [
        { opacity: 0, transform: 'translateY(10px) scale(0.99)' },
        { opacity: 1, transform: 'none' }
      ],
      { duration: 380, delay: 120, easing: 'ease-out', fill: 'backwards' }
    )
  }, [mode])
  const [run, setRun] = useState<RunView | null>(null)
  // The box Pokemon dragged onto the run's starter slot - nothing moves, it's only a pick.
  const [runPickId, setRunPickId] = useState<string | null>(null)
  const [runBusy, setRunBusy] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)
  const [bestFloor, setBestFloor] = useState<number | null>(null)
  // Keep moves or take new ones - asked when a run starts and when a run Pokemon evolves.
  const [movesChoice, setMovesChoice] = useState<{
    title: string
    preview: RunMovesPreview
    decide: (keep: boolean) => Promise<void>
  } | null>(null)
  // A run in progress takes the whole menu: the regular team and box are hidden.
  const runInProgress = mode === 'roguelite' && run?.status === 'active'
  const [levelCap, setLevelCap] = useState<number | null>(null)
  const [eligibility, setEligibility] = useState<BattleEligibility | null>(null)
  const [busy, setBusy] = useState(false)
  const [editingMonId, setEditingMonId] = useState<string | null>(null)
  const [editingAdmin, setEditingAdmin] = useState(false)
  // Bumped to reopen the edit window fresh (after evolving from it).
  const [editorVersion, setEditorVersion] = useState(0)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [debugOpen, setDebugOpen] = useState(false)
  const [wildDropsOpen, setWildDropsOpen] = useState(false)
  const [shopPricesOpen, setShopPricesOpen] = useState(false)
  const [loadoutsOpen, setLoadoutsOpen] = useState(false)
  // Folds the battle buttons away so the box gets the rest of the window.
  const [boxExpanded, setBoxExpanded] = useState(false)
  // Picking Pokemon in the expanded box to sell at once (null: not picking).
  const [boxSelection, setBoxSelection] = useState<Set<string> | null>(null)
  // A pick with a shiny or a red/gold Pokemon in it asks for a second click.
  const [confirmingBoxSell, setConfirmingBoxSell] = useState(false)
  const [rematchOpen, setRematchOpen] = useState(false)
  // Only there while the box is expanded - collapsing it clears the search.
  const [boxSearch, setBoxSearch] = useState('')
  // How the box is ordered (set from the expanded box): by arrival (catch order), name,
  // base stat total or Pokedex number, either way round.
  const [boxSort, setBoxSort] = useState<BoxSortKey>('arrival')
  const [boxSortDescending, setBoxSortDescending] = useState(false)
  const [playerTrainerOpen, setPlayerTrainerOpen] = useState(false)
  const [pokedexOpen, setPokedexOpen] = useState(false)
  const [challengeOpen, setChallengeOpen] = useState(false)
  const [starterOpen, setStarterOpen] = useState(false)
  const [bagOpen, setBagOpen] = useState(false)
  const [shopOpen, setShopOpen] = useState(false)
  // The Game Corner: the slot machine, and the Coin Shop its coins come from.
  // The Game Corner game open (null: none), and the last one played - the button and the
  // Coin Shop both go back to it.
  const [gameCorner, setGameCorner] = useState<GameCornerGame | null>(null)
  const [lastGame, setLastGame] = useState<GameCornerGame>('slots')
  const [coinShopOpen, setCoinShopOpen] = useState(false)
  const openGame = (game: GameCornerGame): void => {
    setLastGame(game)
    setGameCorner(game)
  }
  const toCoinShop = (): void => {
    setGameCorner(null)
    setCoinShopOpen(true)
  }
  const [money, setMoney] = useState<number | null>(null)
  const [achievements, setAchievements] = useState<AchievementsState | null>(null)
  const [achievementsOpen, setAchievementsOpen] = useState(false)
  // The player card's menu (profile, options, debug), placed under the card.
  const [playerMenu, setPlayerMenu] = useState<{ right: number; top: number } | null>(null)
  // Notes that float up from the box (a Pokemon sold, or why it couldn't be).
  const notes = useFloatingNotes()
  const unclaimedAchievements = achievements?.achievements.filter((a) => a.unlocked && !a.claimed).length ?? 0
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ mon: BoxPokemonView; x: number; y: number } | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  function refreshBox(): void {
    window.api
      .listBox()
      .then(setBoxState)
      .catch((e) => setLoadError(e instanceof Error ? e.message : String(e)))
  }

  function refreshProgression(): void {
    window.api
      .getProgression()
      .then((p) => setLevelCap(p.levelCap))
      .catch(() => setLevelCap(null))
  }

  function refreshEligibility(): void {
    window.api
      .getBattleEligibility()
      .then(setEligibility)
      .catch(() => setEligibility(null))
  }

  function refreshMoney(): void {
    window.api
      .getMoney()
      .then(setMoney)
      .catch(() => setMoney(null))
  }

  function refreshRun(): void {
    window.api
      .getRun()
      .then(setRun)
      .catch(() => setRun(null))
    window.api
      .getTrainerProfile()
      .then((profile) => setBestFloor(profile.stats.bestFloor))
      .catch(() => setBestFloor(null))
  }

  // Every run action goes through here: one at a time, and a failure is shown.
  async function runAction(action: () => Promise<void>): Promise<void> {
    setRunBusy(true)
    setRunError(null)
    try {
      await action()
    } catch (e) {
      setRunError(e instanceof Error ? e.message : String(e))
    } finally {
      setRunBusy(false)
    }
  }

  // Moves a run Pokemon to another place in the run's team (shown straight away).
  function reorderRun(runMonId: string, toIndex: number): void {
    if (!run) return
    const ids = run.team.map((m) => m.id)
    const from = ids.indexOf(runMonId)
    if (from === -1 || from === toIndex) return
    ids.splice(toIndex, 0, ...ids.splice(from, 1))
    const byId = new Map(run.team.map((m) => [m.id, m]))
    setRun({ ...run, team: ids.map((id) => byId.get(id)!) })
    void runAction(async () => {
      setRun(await window.api.reorderRunTeam(ids))
    })
  }

  function toggleMode(e: React.MouseEvent<HTMLButtonElement>): void {
    const next: MenuMode = mode === 'classic' ? 'roguelite' : 'classic'
    setMode(next)
    saveMenuMode(username, next)
    if (reducedMotion()) return
    // A ring of the new mode's colour spreads from the button over the whole window...
    const rect = e.currentTarget.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
    setModePulse((prev) => ({ x, y, radius, mode: next, seq: (prev?.seq ?? 0) + 1 }))
    // ...while the button itself flares up in it.
    const color = MODE_COLORS[next]
    e.currentTarget.animate(
      [
        { boxShadow: `0 0 0 0 ${color}` },
        { boxShadow: `0 0 22px 6px ${color}`, offset: 0.3 },
        { boxShadow: '0 0 0 0 transparent' }
      ],
      { duration: 700, easing: 'ease-out' }
    )
  }

  function refreshAchievements(): void {
    window.api
      .getAchievements()
      .then(setAchievements)
      .catch(() => setAchievements(null))
  }

  // Unlocked achievements show up on the nav button's count as they happen.
  useEffect(() => window.api.onAchievementsUnlocked(refreshAchievements), [])

  function refreshAll(): void {
    refreshAchievements()
    refreshRun()
    refreshBox()
    refreshProgression()
    refreshEligibility()
    refreshMoney()
  }

  useEffect(refreshAll, [])

  async function addRandom(): Promise<void> {
    setBusy(true)
    try {
      setBoxState(await window.api.addRandomBoxMon())
    } finally {
      setBusy(false)
    }
  }

  async function resetStats(): Promise<void> {
    setBusy(true)
    try {
      const result = await window.api.resetStats()
      setBoxState(result.box)
      setLevelCap(result.progression.levelCap)
      setMoney(result.money)
      refreshEligibility()
    } finally {
      setBusy(false)
    }
  }

  async function debugAddMoney(): Promise<void> {
    setMoney(await window.api.debugAddMoney(1000))
  }

  async function resetBossProgression(): Promise<void> {
    const progression = await window.api.resetProgression()
    setLevelCap(progression.levelCap)
    refreshEligibility()
  }

  function handleContextMenu(e: React.MouseEvent, mon: BoxPokemonView): void {
    e.preventDefault()
    setContextMenu({ mon, x: e.clientX, y: e.clientY })
  }

  function openEditor(monId: string, admin: boolean): void {
    setContextMenu(null)
    setEditingMonId(monId)
    setEditingAdmin(admin)
  }

  async function evolve(monId: string, targetSpecies: string): Promise<void> {
    setContextMenu(null)
    setBusy(true)
    try {
      setBoxState(await window.api.evolveMon(monId, targetSpecies))
    } finally {
      setBusy(false)
    }
  }

  // Favorites are kept safe from a bulk sell, and a fused Pokemon has to be unfused first.
  const canBulkSell = (mon: BoxPokemonView): boolean => !mon.favorite && !mon.unfuse

  function toggleBoxSelected(mon: BoxPokemonView): void {
    if (!canBulkSell(mon)) return
    setConfirmingBoxSell(false)
    setBoxSelection((current) => {
      const next = new Set(current ?? [])
      if (next.has(mon.id)) next.delete(mon.id)
      else next.add(mon.id)
      return next
    })
  }

  function stopBoxSelection(): void {
    setBoxSelection(null)
    setConfirmingBoxSell(false)
  }

  async function sellSelectedMons(e: React.MouseEvent): Promise<void> {
    if (!boxSelection || boxSelection.size === 0) return
    const at = { x: e.clientX, y: e.clientY }
    const picked = (boxState?.mons ?? []).filter((m) => boxSelection.has(m.id))
    const needsConfirm = picked.some((m) => m.shiny || CONFIRM_SELL_TIERS.has(m.rarityTier ?? 'common'))
    if (needsConfirm && !confirmingBoxSell) {
      setConfirmingBoxSell(true)
      return
    }
    setBusy(true)
    try {
      const result = await window.api.sellMons([...boxSelection])
      setBoxState(result.box)
      setMoney(result.money)
      notes.show(`Sold ${result.count} Pokemon for ${formatMoney(result.sold)}`, at)
      stopBoxSelection()
    } catch (err) {
      notes.show(errorMessage(err), at, 'bad')
    } finally {
      setBusy(false)
    }
  }

  async function sellMon(monId: string): Promise<void> {
    const at = contextMenu ? { x: contextMenu.x, y: contextMenu.y } : { x: window.innerWidth / 2, y: window.innerHeight / 2 }
    setContextMenu(null)
    setBusy(true)
    try {
      const result = await window.api.sellMon(monId)
      setBoxState(result.box)
      setMoney(result.money)
      notes.show(`Sold ${result.species} for ${formatMoney(result.sold)}`, at)
    } catch (e) {
      notes.show(errorMessage(e), at, 'bad')
    } finally {
      setBusy(false)
    }
  }

  // Evolving from the edit window: the window then reopens on the evolved Pokemon (any
  // unsaved changes in it are dropped - it's a new Pokemon to edit).
  async function evolveFromEditor(monId: string, species: string): Promise<void> {
    try {
      setBoxState(await window.api.evolveMon(monId, species))
      setEditorVersion((v) => v + 1)
    } catch (e) {
      notes.show(errorMessage(e), { x: window.innerWidth / 2, y: window.innerHeight / 3 }, 'bad')
    }
  }

  // A form change from the edit window: it reopens on the new form, like evolving does.
  async function changeFormFromEditor(monId: string, form: string): Promise<void> {
    try {
      setBoxState(await window.api.changeForm(monId, form))
      setEditorVersion((v) => v + 1)
    } catch (e) {
      notes.show(errorMessage(e), { x: window.innerWidth / 2, y: window.innerHeight / 3 }, 'bad')
    }
  }

  async function useShinyPatch(monId: string): Promise<void> {
    setContextMenu(null)
    setBusy(true)
    try {
      setBoxState(await window.api.useShinyPatch(monId))
    } finally {
      setBusy(false)
    }
  }

  // A form-change item (Rotom Catalog, Prison Bottle...): a new form, with a Smogon set for it.
  async function changeForm(monId: string, form: string, at: { x: number; y: number }): Promise<void> {
    setContextMenu(null)
    setBusy(true)
    try {
      setBoxState(await window.api.changeForm(monId, form))
      notes.show(`Changed into ${form} - it has a new set to match`, at)
    } catch (e) {
      notes.show(errorMessage(e), at, 'bad')
    } finally {
      setBusy(false)
    }
  }

  // Fusing a legendary with its partner, or splitting them up.
  async function fusionAction(action: () => Promise<BoxState>, done: string, at: { x: number; y: number }): Promise<void> {
    setContextMenu(null)
    setBusy(true)
    try {
      setBoxState(await action())
      notes.show(done, at)
    } catch (e) {
      notes.show(errorMessage(e), at, 'bad')
    } finally {
      setBusy(false)
    }
  }

  async function toggleFavorite(monId: string): Promise<void> {
    setContextMenu(null)
    setBoxState(await window.api.toggleFavorite(monId))
  }

  async function persistTeam(newTeam: (string | null)[]): Promise<void> {
    setBoxState((prev) => (prev ? { ...prev, team: newTeam } : prev))
    setBusy(true)
    try {
      setBoxState(await window.api.setTeam(newTeam))
    } finally {
      setBusy(false)
    }
  }

  function handleTeamDrop(slot: number, draggedId: string): void {
    if (!boxState) return
    const newTeam = [...boxState.team]
    const sourceSlot = newTeam.indexOf(draggedId)
    if (sourceSlot === slot) return
    const displaced = newTeam[slot]
    // From another team slot the two simply trade places (an empty target is
    // just a move); from the box, whoever was in the slot goes back to the box.
    if (sourceSlot !== -1) newTeam[sourceSlot] = displaced
    newTeam[slot] = draggedId
    void persistTeam(newTeam)
  }

  function handleBoxDrop(draggedId: string): void {
    if (!boxState) return
    const sourceSlot = boxState.team.indexOf(draggedId)
    if (sourceSlot === -1) return
    const newTeam = [...boxState.team]
    newTeam[sourceSlot] = null
    void persistTeam(newTeam)
  }

  function handleDragStart(e: DragStartEvent): void {
    setActiveDragId(String(e.active.id))
  }

  function handleDragEnd(e: DragEndEvent): void {
    setActiveDragId(null)
    const { active, over } = e
    if (!over) return
    const draggedId = String(active.id)
    const overId = String(over.id)
    // A run team card: only ever reorders the run's team.
    if (draggedId.startsWith(RUN_MON_DRAG_PREFIX)) {
      if (overId.startsWith(RUN_SLOT_DROP_PREFIX)) {
        reorderRun(draggedId.slice(RUN_MON_DRAG_PREFIX.length), Number(overId.slice(RUN_SLOT_DROP_PREFIX.length)))
      }
      return
    }
    if (overId.startsWith(RUN_SLOT_DROP_PREFIX)) return
    if (overId === RUN_STARTER_SLOT_ID) {
      setRunPickId(draggedId)
    } else if (overId === 'box-drop-zone') {
      handleBoxDrop(draggedId)
    } else if (overId.startsWith('team-slot-')) {
      handleTeamDrop(Number(overId.slice('team-slot-'.length)), draggedId)
    }
  }

  const team = boxState?.team ?? EMPTY_TEAM
  const monsById = new Map((boxState?.mons ?? []).map((m) => [m.id, m]))
  // Favorites first, then the chosen order (arrival order by default).
  const sortDirection = boxSortDescending ? -1 : 1
  const boxMons = (boxState?.mons ?? [])
    .filter((m) => !team.includes(m.id))
    .filter((m) => matchesBoxSearch(m, boxSearch))
    .sort(
      (a, b) =>
        Number(!!b.favorite) - Number(!!a.favorite) ||
        sortDirection * compareBoxMons(a, b, boxSort) ||
        (a.arrival ?? 0) - (b.arrival ?? 0)
    )
  const teamCount = team.filter(Boolean).length
  const teamEmpty = teamCount === 0
  const boxEmpty = (boxState?.mons.length ?? 0) === 0
  const activeDragMon = activeDragId ? monsById.get(activeDragId) : undefined

  // The slider's own max is the player's actual level cap - it simply can't be
  // dragged past it. Clamped again for display in case a previously-picked
  // value is now above a level cap that dropped (e.g. after a stats reset).
  const levelCapMax = Math.max(WILD_LEVEL_CAP_MIN, levelCap ?? 100)
  const effectiveWildLevelCap = Math.min(Math.max(wildLevelCap, WILD_LEVEL_CAP_MIN), levelCapMax)

  const nextBoss = eligibility?.nextBoss ?? null
  let bossHint = ''
  if (!nextBoss) bossHint = 'No boss queued up yet'
  else if (!nextBoss.ready) {
    const remaining = nextBoss.requiredTrainerWins - nextBoss.trainerWinsSinceLastBoss
    bossHint = `Beat ${remaining} more trainer${remaining === 1 ? '' : 's'} to challenge ${nextBoss.trainerName}`
  } else bossHint = `Ready: ${nextBoss.trainerName}`
  // Every boss beaten: Boss Battle becomes the rematch menu.
  const allBossesDefeated = !!eligibility?.allBossesDefeated
  if (allBossesDefeated) bossHint = 'Every boss is beaten - pick one to fight again'

  // The Lab closes again if boss progress is reset - back to All.
  const selectedLocation = WILD_LOCATIONS.find((l) => l.id === wildLocation)
  useEffect(() => {
    if (eligibility && selectedLocation?.requiresAllBosses && !eligibility.allBossesDefeated) onChangeWildLocation('all')
  }, [eligibility, selectedLocation, onChangeWildLocation])

  return (
    <div className="screen">
      {modePulse &&
        createPortal(
          <div
            key={modePulse.seq}
            className={`mode-pulse mode-pulse-${modePulse.mode}`}
            style={{
              left: modePulse.x - modePulse.radius,
              top: modePulse.y - modePulse.radius,
              width: modePulse.radius * 2,
              height: modePulse.radius * 2
            }}
            onAnimationEnd={() => setModePulse((current) => (current?.seq === modePulse.seq ? null : current))}
          />,
          document.body
        )}
      <div className="menu-header">
        <div className="menu-header-left">
          <h1>pkmnPvE</h1>
          {/* Both modes side by side - the lit one is where you are. */}
          <div className="mode-switch" title="Switch between the classic game and Roguelite runs">
            <button
              className={`mode-switch-option mode-switch-classic${mode === 'classic' ? ' mode-switch-active' : ''}`}
              onClick={(e) => mode !== 'classic' && toggleMode(e)}
            >
              <ItemSprite spritenum={POKE_BALL_SPRITENUM} className="mode-switch-icon" />
              Classic
            </button>
            <button
              className={`mode-switch-option mode-switch-roguelite${mode === 'roguelite' ? ' mode-switch-active' : ''}`}
              onClick={(e) => mode !== 'roguelite' && toggleMode(e)}
            >
              <img className="mode-switch-icon" src="./icons/nav/roguelite.png" alt="" />
              Roguelite
            </button>
          </div>
        </div>
        <div className="menu-nav">
          {/* A run has no bag or shop of its own - these are the classic game's. */}
          <div className="nav-actions">
            <button className="nav-icon-button" title="Bag" disabled={mode === 'roguelite'} onClick={() => setBagOpen(true)}>
              <img className="nav-icon" src="./icons/nav/bag.png" alt="Bag" />
            </button>
            <button className="nav-icon-button" title="Shop" disabled={mode === 'roguelite'} onClick={() => setShopOpen(true)}>
              <img className="nav-icon nav-icon-smooth" src="./icons/nav/shop.png" alt="Shop" />
            </button>
            {/* Open in either mode - its coins are the player's own, not a run's. The Coin
                Shop opens from inside the Game Corner's games. */}
            <button
              className="nav-icon-button"
              title="Game Corner: slots, blackjack, roulette and Plinko"
              onClick={() => openGame(lastGame)}
            >
              <img className="nav-icon" src="./icons/nav/gamecorner.png" alt="Game Corner" />
            </button>
            <button
              className="nav-icon-button"
              title="Achievements"
              onClick={() => {
                refreshAchievements()
                setAchievementsOpen(true)
              }}
            >
              <img className="nav-icon" src="./icons/nav/achievements.png" alt="Achievements" />
              {unclaimedAchievements > 0 && <span className="nav-achievements-badge">{unclaimedAchievements}</span>}
            </button>
          </div>
          {/* The player: their trainer, name, title and money - opens a menu with the rarer things. */}
          <button
            className={`nav-player-card${playerMenu ? ' nav-player-card-open' : ''}`}
            title={`${username}'s menu`}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              setPlayerMenu(playerMenu ? null : { right: window.innerWidth - rect.right, top: rect.bottom + 4 })
            }}
          >
            {/* The trainer itself goes straight to the Trainer Card; the rest of the card opens the menu. */}
            <img
              className="nav-trainer-sprite"
              src={trainerSpriteUrl(trainerSprite)}
              alt=""
              title="Trainer Card"
              onClick={(e) => {
                e.stopPropagation()
                setPlayerMenu(null)
                setPlayerTrainerOpen(true)
              }}
            />
            <span className="nav-player-text">
              <span className="nav-player-name">{username}</span>
              {achievements?.title && <span className="nav-player-title">{achievements.title}</span>}
            </span>
            {money !== null && <span className="nav-player-money">{formatMoney(money)}</span>}
            <span className="nav-player-caret">▾</span>
          </button>
        </div>
      </div>
      {playerMenu &&
        createPortal(
          <div className="context-menu-overlay" onMouseDown={() => setPlayerMenu(null)}>
            <div
              className="context-menu nav-player-menu"
              style={{ right: playerMenu.right, top: playerMenu.top }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {[
                {
                  label: 'Trainer Card',
                  icon: <img className="nav-menu-icon" src="./icons/nav/trainercard.png" alt="" />,
                  action: () => setPlayerTrainerOpen(true)
                },
                {
                  label: 'Pokédex',
                  icon: <img className="nav-menu-icon" src="./icons/nav/pokedex.png" alt="" />,
                  action: () => setPokedexOpen(true)
                },
                {
                  label: 'Challenge a player',
                  icon: <img className="nav-menu-icon" src="./icons/nav/challenge.png" alt="" />,
                  action: () => setChallengeOpen(true)
                },
                {
                  label: 'Options',
                  icon: <img className="nav-menu-icon" src="./icons/nav/options.png" alt="" />,
                  action: onOptions
                },
                ...(isAdmin
                  ? [{ label: 'Debug', icon: <span className="nav-menu-icon">🛠</span>, action: () => setDebugOpen(true) }]
                  : [])
              ].map(({ label, icon, action }) => (
                <button
                  key={label}
                  className="context-menu-item nav-menu-item"
                  onClick={() => {
                    setPlayerMenu(null)
                    action()
                  }}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </div>
          </div>,
          document.body
        )}

      {fightError && <p style={{ color: '#ff6b6b' }}>{fightError}</p>}
      {loadError && <p style={{ color: '#ff6b6b' }}>Failed to load your box: {loadError}</p>}
      {mode === 'roguelite' && runError && <p style={{ color: '#ff6b6b' }}>{runError}</p>}

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div
        ref={sectionRef}
        className={`battle-section${boxExpanded && !runInProgress ? ' battle-section-collapsed' : ''}${
          runInProgress ? ' battle-section-run' : ''
        }`}
      >
        {mode === 'roguelite' ? (
          <div className="battle-section-inner">
            <RoguelitePanel
              run={run}
              picked={runPickId ? monsById.get(runPickId) : undefined}
              busy={runBusy || fightBusy}
              bestFloor={bestFloor}
              onStart={(difficulty, generation) =>
                void runAction(async () => {
                  if (!runPickId) return
                  const starter = runPickId
                  setMovesChoice({
                    title: `${monsById.get(starter)?.species ?? 'Your starter'} starts the run`,
                    preview: await window.api.previewStarterMoves(starter),
                    decide: async (keep) => {
                      setRun(await window.api.startRun(starter, difficulty, generation, keep))
                      setRunPickId(null)
                    }
                  })
                })
              }
              onRunUpdated={setRun}
              onChoose={(index) =>
                void runAction(async () => {
                  const result = await window.api.chooseRunNode(index)
                  if ('battle' in result) await onRunBattle(result.battle, result.location)
                  else setRun(result.run)
                })
              }
              onGiveItem={(itemId, runMonId) =>
                void runAction(async () => {
                  setRun(await window.api.giveRunItem(itemId, runMonId))
                })
              }
              onEvolve={(runMonId, target) =>
                void runAction(async () => {
                  const from = run?.team.find((m) => m.id === runMonId)?.species ?? 'It'
                  setMovesChoice({
                    title: `${from} evolves into ${target}`,
                    preview: await window.api.previewEvolutionMoves(runMonId, target),
                    decide: async (keep) => setRun(await window.api.evolveRunMon(runMonId, target, !keep))
                  })
                })
              }
              onMoveItem={(fromMonId, toMonId) =>
                void runAction(async () => {
                  setRun(await window.api.moveRunItem(fromMonId, toMonId))
                })
              }
              onPlaceDisplacedItem={(runMonId) =>
                void runAction(async () => {
                  setRun(await window.api.placeDisplacedItem(runMonId))
                })
              }
              onRerollItems={() =>
                void runAction(async () => {
                  setRun(await window.api.rerollRunItems())
                })
              }
              onGiveAbility={(abilityId, runMonId) =>
                void runAction(async () => {
                  setRun(await window.api.giveRunAbility(abilityId, runMonId))
                })
              }
              onTeachMove={(moveId, runMonId, replaceMoveId) =>
                void runAction(async () => {
                  setRun(await window.api.teachRunMove(moveId, runMonId, replaceMoveId))
                })
              }
              onSkipPick={() =>
                void runAction(async () => {
                  setRun(await window.api.skipRunPick())
                })
              }
              onSkipItem={() =>
                void runAction(async () => {
                  setRun(await window.api.skipRunItem())
                })
              }
              onForfeit={() =>
                void runAction(async () => {
                  setRun(await window.api.forfeitRun())
                  refreshRun()
                })
              }
            />
          </div>
        ) : (
        <div className="battle-section-inner">
          {levelCap !== null && <p className="level-cap-display">Level Cap: {levelCap}</p>}

          <div className="big-battle-row">
            <button className="big-battle-button" disabled={fightBusy || teamEmpty} onClick={onFight}>
              <img className="big-battle-icon" src="./icons/tall-grass.png" alt="" />
              <span>Wild Battle</span>
            </button>
            <button
              className="big-battle-button"
              disabled={fightBusy || teamEmpty || !eligibility?.hasTrainer}
              onClick={onTrainerFight}
            >
              <img
                className="big-battle-icon"
                src={trainerSpriteUrl(eligibility?.rocketEvent ? 'rocketgrunt' : 'youngster')}
                alt=""
              />
              <span>Trainer Battle</span>
            </button>
            <button
              className="big-battle-button"
              disabled={fightBusy || teamEmpty || !(eligibility?.hasBoss || allBossesDefeated)}
              title={bossHint}
              onClick={allBossesDefeated ? () => setRematchOpen(true) : onBossFight}
            >
              <img
                className="big-battle-icon"
                src={trainerSpriteUrl(nextBoss?.spriteId || 'giovanni')}
                alt=""
              />
              <span>{allBossesDefeated ? 'Boss Rematch' : 'Boss Battle'}</span>
            </button>
          </div>
          {nextBoss && <p className="box-empty-hint battle-row-hint">{bossHint}</p>}

          <div className="wild-location-row">
            {WILD_LOCATIONS.filter((loc) => !loc.requiresAllBosses || allBossesDefeated).map((loc) => (
              <button
                key={loc.id}
                className={`wild-location-button${wildLocation === loc.id ? ' wild-location-button-active' : ''}`}
                title={loc.label}
                style={{ backgroundImage: `url(${backdropUrl(LOCATION_BUTTON_BACKDROP[loc.id])})` }}
                onClick={() => onChangeWildLocation(loc.id)}
              >
                <img className="wild-location-icon" src={locationIconUrl(loc.id)} alt="" />
                <span>{loc.label}</span>
              </button>
            ))}
          </div>

          <div className="wild-levelcap-row">
            <input
              type="range"
              className="wild-levelcap-slider"
              min={WILD_LEVEL_CAP_MIN}
              max={levelCapMax}
              value={effectiveWildLevelCap}
              onChange={(e) => onChangeWildLevelCap(Number(e.target.value))}
            />
            <span className="wild-levelcap-value">Wild Level Cap: {effectiveWildLevelCap}</span>
          </div>
        </div>
        )}
      </div>

      {boxEmpty && !runInProgress && (
        <button className="choose-starter-button" onClick={() => setStarterOpen(true)}>
          Choose Starter
        </button>
      )}

        {!runInProgress && (
        <>
        <div className="team-heading-row">
          {/* The heading itself opens the saved team loadouts. */}
          <button
            className="box-heading-button"
            title="Loadouts: save this team, or switch to a saved one"
            onClick={() => setLoadoutsOpen(true)}
          >
            Team
          </button>
        </div>
        <TeamRow team={team} monsById={monsById} onEdit={(id) => openEditor(id, false)} onContextMenu={handleContextMenu} />

        <div className="team-heading-row">
          {/* The heading itself expands the box (hiding the battle buttons) and collapses it again. */}
          <button
            className={`box-heading-button${boxExpanded ? ' box-heading-button-expanded' : ''}`}
            title={boxExpanded ? 'Show the battle buttons again' : 'Hide the battle buttons for a bigger box'}
            onClick={() => {
              if (boxExpanded) {
                setBoxSearch('')
                stopBoxSelection()
              }
              setBoxExpanded((v) => !v)
            }}
          >
            Box
          </button>
          {boxExpanded && (
            <SearchBar
              className="box-search"
              value={boxSearch}
              onChange={setBoxSearch}
              placeholder="Search name, type, move, ability, item…"
              autoFocus
            />
          )}
          {boxExpanded && (
            <span className="box-sort">
              <select value={boxSort} onChange={(e) => setBoxSort(e.target.value as BoxSortKey)} title="Order the box">
                {BOX_SORTS.map((sort) => (
                  <option key={sort.key} value={sort.key}>
                    {sort.label}
                  </option>
                ))}
              </select>
              <button
                className="box-sort-direction"
                title={boxSortDescending ? 'Descending - click for ascending' : 'Ascending - click for descending'}
                onClick={() => setBoxSortDescending((d) => !d)}
              >
                {boxSortDescending ? '↓' : '↑'}
              </button>
            </span>
          )}
          {boxExpanded && !boxSelection && (
            <button className="box-select-button" onClick={() => setBoxSelection(new Set())}>
              Select to sell
            </button>
          )}
        </div>
        {boxSelection && (
          <div className="box-sell-bar">
            <span className="box-sell-summary">
              {boxSelection.size} selected ·{' '}
              {formatMoney(
                (boxState?.mons ?? [])
                  .filter((m) => boxSelection.has(m.id))
                  .reduce((sum, m) => sum + POKEMON_SELL_PRICES[m.rarityTier ?? 'common'], 0)
              )}
              <span className="box-sell-hint">Click Pokemon to pick them - favorites can't be picked</span>
            </span>
            <button disabled={busy} onClick={stopBoxSelection}>
              Cancel
            </button>
            <button
              className={confirmingBoxSell ? 'box-sell-confirm' : undefined}
              disabled={busy || boxSelection.size === 0}
              onClick={(e) => void sellSelectedMons(e)}
            >
              {confirmingBoxSell ? 'Includes rare or shiny Pokemon - click again' : 'Sell selected'}
            </button>
          </div>
        )}
        <BoxGrid
          mons={boxMons}
          onEdit={(id) => openEditor(id, false)}
          onContextMenu={handleContextMenu}
          emptyHint={boxSearch.trim() ? 'No Pokemon in the box match that search.' : undefined}
          selection={boxSelection}
          onToggleSelect={toggleBoxSelected}
          canSelect={canBulkSell}
        />
        </>
        )}

        <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
          {activeDragMon && (
            <div className="box-icon-draggable box-icon-overlay">
              <PokemonIconVisual mon={activeDragMon} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {editingMonId && (
        <PokemonEditor
          key={`${editingMonId}-${editorVersion}`}
          source={{ kind: 'box', monId: editingMonId }}
          admin={editingAdmin}
          onClose={() => {
            setEditingMonId(null)
            setEditingAdmin(false)
          }}
          onSaved={refreshBox}
          favorite={!!monsById.get(editingMonId)?.favorite}
          onToggleFavorite={() => void toggleFavorite(editingMonId)}
          canUseRareCandy={!!monsById.get(editingMonId)?.canLevelUpWithCandy}
          evolutionPaths={monsById.get(editingMonId)?.evolutionPaths}
          onEvolve={(species) => void evolveFromEditor(editingMonId, species)}
          formChanges={monsById.get(editingMonId)?.formChanges}
          onChangeForm={(form) => void changeFormFromEditor(editingMonId, form)}
          onUseRareCandy={async () => {
            const box = await window.api.levelUpMon(editingMonId)
            setBoxState(box)
            return box.mons.find((m) => m.id === editingMonId)?.level ?? null
          }}
        />
      )}

      {debugOpen && (
        <DebugMenu
          onClose={() => setDebugOpen(false)}
          onTrainers={onTrainers}
          onRogueliteBosses={onRogueliteBosses}
          onProgression={onProgression}
          onAddRandom={() => void addRandom()}
          onWildDrops={() => {
            setDebugOpen(false)
            setWildDropsOpen(true)
          }}
          onShopPrices={() => {
            setDebugOpen(false)
            setShopPricesOpen(true)
          }}
          onAddMoney={() => void debugAddMoney()}
          onResetBossProgress={() => void resetBossProgression()}
          onResetStats={() => void resetStats()}
          addRandomBusy={busy}
        />
      )}

      {wildDropsOpen && <WildDropsModal onClose={() => setWildDropsOpen(false)} />}
      {shopPricesOpen && <ShopPricesModal onClose={() => setShopPricesOpen(false)} />}

      {rematchOpen && (
        <BossRematchModal
          onClose={() => setRematchOpen(false)}
          onRematch={(trainerId) => {
            setRematchOpen(false)
            onBossRematch(trainerId)
          }}
        />
      )}

      {movesChoice && (
        <RunMovesChoice
          title={movesChoice.title}
          preview={movesChoice.preview}
          busy={runBusy}
          onCancel={() => setMovesChoice(null)}
          onKeep={() =>
            void runAction(async () => {
              await movesChoice.decide(true)
              setMovesChoice(null)
            })
          }
          onNew={() =>
            void runAction(async () => {
              await movesChoice.decide(false)
              setMovesChoice(null)
            })
          }
        />
      )}

      {loadoutsOpen && (
        <LoadoutsModal
          team={team}
          monsById={monsById}
          onApplied={(box) => {
            setBoxState(box)
            setLoadoutsOpen(false)
          }}
          onClose={() => setLoadoutsOpen(false)}
        />
      )}

      {playerTrainerOpen && (
        <PlayerTrainerModal
          trainerSprite={trainerSprite}
          onChangeTrainerSprite={onChangeTrainerSprite}
          username={username}
          onTitleChanged={refreshAchievements}
          onClose={() => setPlayerTrainerOpen(false)}
        />
      )}

      {pokedexOpen && <PokedexModal onClose={() => setPokedexOpen(false)} />}

      {challengeOpen && <ChallengeModal onChallengePlayer={onChallengePlayer} onClose={() => setChallengeOpen(false)} />}

      {starterOpen && (
        <StarterPicker
          onClose={() => setStarterOpen(false)}
          onChosen={(box) => {
            setBoxState(box)
            refreshEligibility()
          }}
        />
      )}

      {contextMenu && (
        <PokemonContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          species={contextMenu.mon.species}
          evolutions={contextMenu.mon.eligibleEvolutions ?? []}
          evolutionItems={contextMenu.mon.evolutionItems}
          registeredEvolutions={contextMenu.mon.registeredEvolutions}
          onChoose={(target) => void evolve(contextMenu.mon.id, target)}
          canUseShinyPatch={contextMenu.mon.canUseShinyPatch ?? false}
          onUseShinyPatch={() => void useShinyPatch(contextMenu.mon.id)}
          formChanges={contextMenu.mon.formChanges}
          onChangeForm={(form) => void changeForm(contextMenu.mon.id, form, { x: contextMenu.x, y: contextMenu.y })}
          fusions={contextMenu.mon.fusions}
          onFuse={(partnerId) =>
            void fusionAction(
              () => window.api.fuseMon(contextMenu.mon.id, partnerId),
              `Fused into ${contextMenu.mon.fusions?.find((f) => f.partnerId === partnerId)?.result}`,
              { x: contextMenu.x, y: contextMenu.y }
            )
          }
          unfuse={contextMenu.mon.unfuse}
          onUnfuse={() =>
            void fusionAction(
              () => window.api.unfuseMon(contextMenu.mon.id),
              `Unfused - ${contextMenu.mon.unfuse?.partnerSpecies} is back in your box`,
              { x: contextMenu.x, y: contextMenu.y }
            )
          }
          onEdit={() => openEditor(contextMenu.mon.id, false)}
          onAdminEdit={isAdmin ? () => openEditor(contextMenu.mon.id, true) : undefined}
          onSell={() => void sellMon(contextMenu.mon.id)}
          sellPrice={POKEMON_SELL_PRICES[contextMenu.mon.rarityTier ?? 'common']}
          sellNeedsConfirm={!!contextMenu.mon.shiny || CONFIRM_SELL_TIERS.has(contextMenu.mon.rarityTier ?? 'common')}
          shiny={!!contextMenu.mon.shiny}
          onClose={() => setContextMenu(null)}
        />
      )}

      {bagOpen && (
        <BagModal
          onClose={() => setBagOpen(false)}
          onChanged={() => {
            refreshMoney()
            refreshBox()
          }}
          onOpenShop={() => {
            setBagOpen(false)
            setShopOpen(true)
          }}
        />
      )}

      {notes.layer}
      {achievementsOpen && achievements && (
        <AchievementsModal
          state={achievements}
          onChange={setAchievements}
          onClaimed={(newMoney) => {
            setMoney(newMoney)
            refreshBox()
          }}
          onClose={() => setAchievementsOpen(false)}
        />
      )}
      {gameCorner === 'slots' && (
        <SlotMachine onClose={() => setGameCorner(null)} onOpenCoinShop={toCoinShop} onSwitchGame={openGame} />
      )}
      {gameCorner === 'blackjack' && (
        <BlackjackTable onClose={() => setGameCorner(null)} onOpenCoinShop={toCoinShop} onSwitchGame={openGame} />
      )}
      {gameCorner === 'roulette' && (
        <RouletteTable onClose={() => setGameCorner(null)} onOpenCoinShop={toCoinShop} onSwitchGame={openGame} />
      )}
      {gameCorner === 'plinko' && (
        <PlinkoBoard onClose={() => setGameCorner(null)} onOpenCoinShop={toCoinShop} onSwitchGame={openGame} />
      )}
      {coinShopOpen && (
        <CoinShopModal
          onClose={() => {
            setCoinShopOpen(false)
            // The Coin Shop is only reached from a Game Corner game - closing it goes back there.
            setGameCorner(lastGame)
            refreshBox()
          }}
          onMoneyChange={setMoney}
        />
      )}

      {shopOpen && (
        <ShopModal
          onClose={() => {
            setShopOpen(false)
            refreshBox()
          }}
          onMoneyChange={setMoney}
          onOpenBag={() => {
            setShopOpen(false)
            refreshBox()
            setBagOpen(true)
          }}
        />
      )}
    </div>
  )
}

export default MainMenu
