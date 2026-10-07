import { useEffect, useRef, useState } from 'react'
import Tooltip from './Tooltip'
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
import {
  CONFIRM_SELL_TIERS,
  FRIENDSHIP_PETAL_ITEM_ID,
  MERGE_MAX_STARS,
  POKEMON_SELL_PRICES,
  RARE_CANDY_ITEM_ID,
  WILD_LOCATIONS
} from '../../shared/battle-types'

// The Friendship Petal's and Rare Candy's icons (see ItemSprite).
const FRIENDSHIP_PETAL_SPRITENUM = -31
const RARE_CANDY_SPRITENUM = -2
import type {
  BattleEligibility,
  BattleView,
  BoxPokemonView,
  BoxState,
  RunMovesPreview,
  RunView,
  WildLocationId
} from '../../shared/battle-types'
import TeamDock from './TeamDock'
import CompanionSlot, { COMPANION_SLOT_ID } from './CompanionSlot'
import type { CompanionSizeChoice, MergeCandidateView, RarityTier, RunDifficulty } from '../../shared/battle-types'
import { RARITY_TIERS } from '../../shared/rarity'
import { TIER_LABELS } from './RarityOddsTooltip'
import BoxGrid from './BoxGrid'
import ModalSpinner from './ModalSpinner'
import PokemonEditor from './PokemonEditor'
import PokemonIconVisual from './PokemonIconVisual'
import DebugMenu from './DebugMenu'
import DebugAddMon from './DebugAddMon'
import PlayerTrainerModal from './PlayerTrainerModal'
import PokedexModal from './PokedexModal'
import OnlineSection from './OnlineSection'
import StarterPicker from './StarterPicker'
import PokemonContextMenu from './PokemonContextMenu'
import MergeModal from './MergeModal'
import RewardsModal, { type RewardsTab } from './RewardsModal'
import { onRewardsFocus } from './AchievementToasts'
import type { MissionsState } from '../../shared/missions'
import BagShopModal from './BagShopModal'
import WildDropsModal from './WildDropsModal'
import ShopPricesModal from './ShopPricesModal'
import LoadoutsModal from './LoadoutsModal'
import BossRematchModal from './BossRematchModal'
import RunMovesChoice from './RunMovesChoice'
import RoguelitePanel, { RUN_MON_DRAG_PREFIX, RUN_SLOT_DROP_PREFIX, RUN_STARTER_SLOT_ID } from './RoguelitePanel'
import DraftPanel from './DraftPanel'
import { loadMenuPage, saveMenuPage, type MenuPage } from './menuMode'
import MenuRail from './MenuRail'
import HomeHub from './HomeHub'
import RaidPage from './RaidPage'
import { trainerSpriteUrl } from './trainerSprite'
import type { GameCornerTab } from './GameCornerTabs'
import { errorMessage, useFloatingNotes } from './FloatingNotes'
import GameCornerModal from './GameCornerModal'
import SearchBar from './SearchBar'
import RarityCard from './RarityCard'
import type { AchievementsState } from '../../shared/achievements'
import { LOCATION_BUTTON_BACKDROP, backdropUrl, locationIconUrl } from './battleScenery'
import { TmSearchStrip, useTmSearch } from './TmSearch'
import DexNavPanel from './DexNavPanel'
import { formatMoney } from './money'
import ShinyIcon from './ShinyIcon'
import ItemSprite from './ItemSprite'
import MusicPlayer from './MusicPlayer'

interface Props {
  // A wild battle - in that location, or the one last picked.
  onFight: (location?: WildLocationId) => void
  wildLocation: WildLocationId
  onChangeWildLocation: (location: WildLocationId) => void
  wildLevelCap: number
  onChangeWildLevelCap: (levelCap: number) => void
  onTrainerFight: () => void
  // A Max Raid (uses up a Raid Crystal).
  onRaidFight: () => void
  // Debug: a Max Raid against a chosen species.
  onDebugRaid: (species: string, level: number, shiny: boolean) => void
  onBossFight: () => void
  onBossRematch: (trainerId: string) => void
  onOptions: () => void
  onTrainers: () => void
  onRogueliteBosses: () => void
  fightBusy: boolean
  fightError: string | null
  trainerSprite: string
  onChangeTrainerSprite: (id: string) => void
  username: string
  isAdmin: boolean
  // A Roguelite floor's fight has started - App takes it from here like any battle.
  onRunBattle: (view: BattleView, location?: WildLocationId) => Promise<void>
}

const EMPTY_TEAM: (string | null)[] = [null, null, null, null, null, null]
// Below this a wild encounter's level range gets thin enough to barely mean
// anything - the slider simply doesn't go lower.
const WILD_LEVEL_CAP_MIN = 15

// The orders the expanded box can be sorted in.
type BoxSortKey = 'arrival' | 'name' | 'bst' | 'dex' | 'stars'
const BOX_SORTS: { key: BoxSortKey; label: string }[] = [
  { key: 'arrival', label: 'Catch date' },
  { key: 'name', label: 'Name' },
  { key: 'bst', label: 'Base stat total' },
  { key: 'dex', label: 'Pokédex number' },
  { key: 'stars', label: 'Stars' }
]

// What the Alchemist title turned up selling, for the sale's note: " · found a Thunder Stone".
function alchemistText(found: string[]): string {
  if (found.length === 0) return ''
  const counts = new Map<string, number>()
  for (const name of found) counts.set(name, (counts.get(name) ?? 0) + 1)
  return ` · found ${[...counts].map(([name, n]) => (n > 1 ? `${n}× ${name}` : `a ${name}`)).join(', ')}`
}

// The expanded box's filter chips: each one on narrows the box to Pokemon that pass it.
type BoxFilterKey = 'favorite' | 'shiny' | 'stars' | 'duplicates'
// `candidateIds`: every Pokemon that could go into another (pre-evolutions included).
const BOX_FILTERS: {
  key: BoxFilterKey
  icon: React.ReactNode
  title: string
  test: (m: BoxPokemonView, candidateIds: Set<string>) => boolean
}[] = [
  { key: 'favorite', icon: '❤️', title: 'Favorites only', test: (m) => !!m.favorite },
  { key: 'shiny', icon: <ShinyIcon />, title: 'Shinies only', test: (m) => !!m.shiny },
  { key: 'stars', icon: '★', title: 'Merged (starred) only', test: (m) => (m.mergeStars ?? 0) > 0 },
  { key: 'duplicates', icon: '⧉', title: 'Duplicates only - Pokémon with another of their species (or a pre-evolution of theirs) to merge in, and the ones that would go in', test: (m, candidateIds) => (m.mergeCandidates?.length ?? 0) > 0 || candidateIds.has(m.id) }
]

// Ascending order for a sort key (the caller flips it for descending).
function compareBoxMons(a: BoxPokemonView, b: BoxPokemonView, key: BoxSortKey): number {
  if (key === 'name') return a.species.localeCompare(b.species)
  if (key === 'bst') return (a.bst ?? 0) - (b.bst ?? 0)
  if (key === 'dex') return (a.dexNum ?? 0) - (b.dexNum ?? 0)
  if (key === 'stars') return (a.mergeStars ?? 0) - (b.mergeStars ?? 0)
  return (a.arrival ?? 0) - (b.arrival ?? 0)
}

// The box search: every word typed has to match something about the Pokemon - its
// species, a type, its ability, item or nature, or one of its moves ("fire", "u-turn").
function matchesBoxSearch(mon: BoxPokemonView, search: string): boolean {
  const words = search.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const squash = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]/g, '')
  const haystack = [mon.species, ...mon.types, mon.ability, mon.item, mon.nature, ...mon.moveIds].map(squash)
  return words.every((word) => {
    const w = squash(word)
    return !w || haystack.some((field) => field.includes(w))
  })
}

// Each mode's colour, for the pulse when switching to it (the toggle's own colours).
const MODE_COLORS: Record<MenuPage, string> = {
  home: '#9fb3c8',
  classic: '#6bb0ff',
  catch: '#7fd08c',
  box: '#5fd4b0',
  roguelite: '#b48cff',
  draft: '#ffb74d',
  raid: '#e9628c',
  corner: '#ffd76b'
}

// Each page's name over it, beside its sidebar icon.
const PAGE_TITLES: Record<MenuPage, string> = {
  home: 'Home',
  classic: 'Battles',
  catch: 'Catch',
  box: 'Box',
  roguelite: 'Roguelite',
  draft: 'Draft',
  raid: 'Max Raid',
  corner: 'Game Corner'
}

// The number keys open the pages, in the sidebar's order (Home is 0).
const PAGE_KEYS: Record<string, MenuPage> = {
  '0': 'home',
  '1': 'catch',
  '2': 'box',
  '3': 'classic',
  '4': 'roguelite',
  '5': 'draft',
  '6': 'raid',
  '7': 'corner'
}

// The dock's small box builds its cards a few rows at a time (see dockBoxBuilt).
const DOCK_BOX_FIRST_CARDS = 40
const DOCK_BOX_CARDS_PER_FRAME = 40

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
  onRaidFight,
  onDebugRaid,
  onBossFight,
  onBossRematch,
  onOptions,
  onTrainers,
  onRogueliteBosses,
  fightBusy,
  fightError,
  trainerSprite,
  onChangeTrainerSprite,
  username,
  isAdmin,
  onRunBattle
}: Props): React.JSX.Element {
  const [boxState, setBoxState] = useState<BoxState | null>(null)
  // The menu's open page - Home, a mode or the Game Corner - picked from the sidebar.
  // Switching never touches a run. The modes' own pages go by `mode`.
  const [mode, setMode] = useState<MenuPage>(() => loadMenuPage(username))
  // Switching pages: the colour pulse spreading from the sidebar button (see goTo), and
  // the page fading in behind it.
  const [modePulse, setModePulse] = useState<{ x: number; y: number; radius: number; mode: MenuPage; seq: number } | null>(
    null
  )
  // Mid-spin / mid-hand in the Game Corner: the sidebar stays put until it's over.
  const [cornerBusy, setCornerBusy] = useState(false)
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
  const [bestFloor, setBestFloor] = useState<{ floor: number; difficulty: RunDifficulty | null } | null>(null)
  // Keep moves or take new ones - asked when a run starts and when a run Pokemon evolves.
  const [movesChoice, setMovesChoice] = useState<{
    title: string
    preview: RunMovesPreview
    decide: (keep: boolean) => Promise<void>
  } | null>(null)
  // A run in progress takes the whole menu: the regular team and box are hidden.
  const runInProgress = mode === 'roguelite' && run?.status === 'active'
  // Draft mode never uses the box, so it always has the whole menu too.
  const fullPanel = runInProgress || mode === 'draft'
  // A small box pulled up under the team dock (its PC button), to drag Pokemon from it
  // without going to the Box page. It closes again on changing page, and has its own search.
  const [dockBoxOpen, setDockBoxOpen] = useState(false)
  const [dockBoxSearch, setDockBoxSearch] = useState('')
  useEffect(() => setDockBoxOpen(false), [mode])
  // How many of its cards are built so far: the first rows at once, the rest a few rows
  // a frame after, so a big box opens without a pause.
  const [dockBoxBuilt, setDockBoxBuilt] = useState(DOCK_BOX_FIRST_CARDS)
  const [levelCap, setLevelCap] = useState<number | null>(null)
  const [eligibility, setEligibility] = useState<BattleEligibility | null>(null)
  const [busy, setBusy] = useState(false)
  const [editingMonId, setEditingMonId] = useState<string | null>(null)
  const [editingAdmin, setEditingAdmin] = useState(false)
  // Opened from the right-click Change Form: the editor scrolls to and highlights its Form changes.
  const [editingFocusForms, setEditingFocusForms] = useState(false)
  // Bumped to reopen the edit window fresh (after evolving from it).
  const [editorVersion, setEditorVersion] = useState(0)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [debugOpen, setDebugOpen] = useState(false)
  const [debugAddOpen, setDebugAddOpen] = useState(false)
  const [wildDropsOpen, setWildDropsOpen] = useState(false)
  const [shopPricesOpen, setShopPricesOpen] = useState(false)
  const [loadoutsOpen, setLoadoutsOpen] = useState(false)
  // The Box page: Classic's team and box with the battle buttons folded away, so the
  // box gets the rest of the window.
  const boxExpanded = mode === 'box'
  // The Box page's grid is slow to build, so the page opens on a spinner first and builds
  // the grid a couple of frames later - the click answers at once instead of hanging.
  const [boxPageReady, setBoxPageReady] = useState(false)
  useEffect(() => {
    if (mode !== 'box') {
      setBoxPageReady(false)
      return
    }
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setBoxPageReady(true))
    })
    return () => cancelAnimationFrame(frame)
  }, [mode])
  // Picking Pokemon in the expanded box to sell at once (null: not picking).
  const [boxSelection, setBoxSelection] = useState<Set<string> | null>(null)
  // The expanded box's filter chips, and whether its Select menu is open.
  const [boxFilters, setBoxFilters] = useState<Set<BoxFilterKey>>(new Set())
  // The one rarity colour the box shows (null: every rarity), and its menu.
  const [boxRarity, setBoxRarity] = useState<RarityTier | null>(null)
  const [rarityMenuOpen, setRarityMenuOpen] = useState(false)
  // Whether "Select all duplicates" also picks pre-evolutions that use up an evolution item.
  const [mergeWithItems, setMergeWithItems] = useState(false)
  // ...and those that need Friendship Petals (a friendship evolution) or Rare Candies (a level one).
  const [mergeWithPetals, setMergeWithPetals] = useState(false)
  const [mergeWithCandies, setMergeWithCandies] = useState(false)
  // Whether the sell's "Select all" also picks Pokemon with merge stars.
  const [sellWithStars, setSellWithStars] = useState(false)
  const [selectMenuOpen, setSelectMenuOpen] = useState(false)
  // The sort order's menu (the same kind as Select's).
  const [sortMenuOpen, setSortMenuOpen] = useState(false)
  // What the box's selection is for: selling, or merging.
  const [boxSelectMode, setBoxSelectMode] = useState<'sell' | 'merge'>('sell')
  // A pick with a shiny or a red/gold Pokemon in it asks for a second click.
  const [confirmingBoxSell, setConfirmingBoxSell] = useState(false)
  const [rematchOpen, setRematchOpen] = useState(false)
  // Only there while the box is expanded - collapsing it clears the search.
  const [boxSearch, setBoxSearch] = useState('')
  // How the box is ordered (set from the expanded box): by arrival (catch order), name,
  // base stat total or Pokedex number, either way round.
  const [boxSort, setBoxSort] = useState<BoxSortKey>('arrival')
  const [boxSortDescending, setBoxSortDescending] = useState(true)
  const [playerTrainerOpen, setPlayerTrainerOpen] = useState(false)
  const [pokedexOpen, setPokedexOpen] = useState(false)
  // The entry to open the Pokedex at - from a clicked "registered" pop-up.
  const [pokedexFocus, setPokedexFocus] = useState<string | null>(null)
  const [starterOpen, setStarterOpen] = useState(false)
  // The Items window (the bag and the shop together, the Key Items and the TMs).
  const [itemsOpen, setItemsOpen] = useState(false)
  // Sent from the Items window to an item's daily deal in the Coin Shop (the petals, the
  // Shiny Patch): the Game Corner page is remounted on its Coin Shop (jump counts the trips)
  // and scrolls down to it.
  const [coinShopJump, setCoinShopJump] = useState(0)
  const [coinShopFocus, setCoinShopFocus] = useState<string | null>(null)
  // The Game Corner page's tab (one of its games or the Coin Shop) - it reopens on the
  // one played last.
  const gameCornerOpen = mode === 'corner'
  const [gameCornerTab, setGameCornerTab] = useState<GameCornerTab>('slots')
  const [money, setMoney] = useState<number | null>(null)
  const [achievements, setAchievements] = useState<AchievementsState | null>(null)
  // The Daily Missions | Achievements window, open on one of its tabs.
  const [rewardsTab, setRewardsTab] = useState<RewardsTab | null>(null)
  // The achievement a clicked pop-up wants scrolled to, until the list has shown it.
  const [achievementFocus, setAchievementFocus] = useState<string | null>(null)
  // The player card's menu (profile, options, debug), placed under the card.
  const [playerMenu, setPlayerMenu] = useState<{ right: number; top: number } | null>(null)
  // The player menu opens on hover and closes a moment after the pointer leaves both the
  // card and the menu - the delay lets it cross the gap between them.
  const playerMenuCloseTimer = useRef<number | null>(null)
  const cancelPlayerMenuClose = (): void => {
    if (playerMenuCloseTimer.current !== null) window.clearTimeout(playerMenuCloseTimer.current)
    playerMenuCloseTimer.current = null
  }
  const schedulePlayerMenuClose = (): void => {
    cancelPlayerMenuClose()
    playerMenuCloseTimer.current = window.setTimeout(() => setPlayerMenu(null), 200)
  }
  const openPlayerMenu = (card: HTMLElement): void => {
    cancelPlayerMenuClose()
    const rect = card.getBoundingClientRect()
    setPlayerMenu((open) => open ?? { right: window.innerWidth - rect.right, top: rect.bottom + 4 })
  }
  useEffect(() => cancelPlayerMenuClose, [])
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
      .then((profile) =>
        setBestFloor(
          profile.stats.bestFloor ? { floor: profile.stats.bestFloor, difficulty: profile.stats.bestFloorDifficulty } : null
        )
      )
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

  // Opens a page of the menu, from a sidebar button, a Home card or a number key.
  function goTo(next: MenuPage, from: HTMLElement | null): void {
    if (next === mode || cornerBusy) return
    const open = (): void => {
      if (mode === 'box') collapseBox()
      setMode(next)
      saveMenuPage(username, next)
    }
    // Under 100 coins there's little to play with - the Game Corner opens on the Coin Shop.
    if (next === 'corner') {
      window.api
        .getCoins()
        .then((coins) => {
          if (coins < 100) setGameCornerTab('shop')
        })
        .catch(() => {})
        .finally(open)
    } else open()
    if (reducedMotion() || !from) return
    // A ring of the new page's colour spreads from the button over the whole window...
    const rect = from.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
    setModePulse((prev) => ({ x, y, radius, mode: next, seq: (prev?.seq ?? 0) + 1 }))
    // ...while the button itself flares up in it.
    const color = MODE_COLORS[next]
    from.animate(
      [
        { boxShadow: `0 0 0 0 ${color}` },
        { boxShadow: `0 0 22px 6px ${color}`, offset: 0.3 },
        { boxShadow: '0 0 0 0 transparent' }
      ],
      { duration: 700, easing: 'ease-out' }
    )
  }

  // The number keys open the pages - not while typing, or with a window open over the menu.
  const goToRef = useRef(goTo)
  goToRef.current = goTo
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const next = PAGE_KEYS[e.key]
      if (!next || e.ctrlKey || e.altKey || e.metaKey || e.repeat) return
      const target = e.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
      if (document.querySelector('.modal-overlay, .context-menu-overlay')) return
      goToRef.current(next, document.querySelector<HTMLElement>(`.menu-rail-${next}`))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function refreshAchievements(): void {
    window.api
      .getAchievements()
      .then(setAchievements)
      .catch(() => setAchievements(null))
  }

  // Unlocked achievements show up on the nav button's count as they happen.
  // An unlock can open the companion slot (see COMPANION_ACHIEVEMENT_ID) - the box says so.
  useEffect(
    () =>
      window.api.onAchievementsUnlocked(() => {
        refreshAchievements()
        refreshBox()
      }),
    []
  )

  // Daily missions: the day's three.
  const [missions, setMissions] = useState<MissionsState | null>(null)
  function refreshMissions(): void {
    window.api
      .getMissions()
      .then(setMissions)
      .catch(() => {})
  }
  useEffect(() => window.api.onMissionsChanged(refreshMissions), [])
  // Rewards waiting: finished missions not yet claimed, and the bonus.
  const claimableMissions = missions
    ? missions.missions.filter((m) => m.progress >= m.goal && !m.claimed).length +
      (missions.bonusReady && !missions.bonusClaimed ? 1 : 0)
    : 0

  // The Daily Missions | Achievements window - on the missions tab when only mission
  // rewards are waiting.
  function openRewards(): void {
    // A new day's missions, if the date has turned while the menu was open.
    refreshMissions()
    refreshAchievements()
    setRewardsTab(claimableMissions > 0 && unclaimedAchievements === 0 ? 'missions' : 'achievements')
  }

  // A clicked pop-up opens its tab - on an achievement, scrolled to that one.
  useEffect(
    () =>
      onRewardsFocus((focus) => {
        if (focus.tab === 'pokedex') {
          setPokedexFocus(focus.name)
          setPokedexOpen(true)
          return
        }
        refreshMissions()
        refreshAchievements()
        setAchievementFocus(focus.tab === 'achievements' ? focus.name : null)
        setRewardsTab(focus.tab)
      }),
    []
  )

  function refreshAll(): void {
    refreshAchievements()
    refreshMissions()
    refreshRun()
    refreshBox()
    refreshProgression()
    refreshEligibility()
    refreshMoney()
  }

  useEffect(refreshAll, [])

  // The Max Raid button counts Raid Crystals: bought in the Shop or the Coin Shop, sold
  // from the bag, or won from an achievement or the daily missions - so it's brought up
  // to date once those are all closed again (claims refresh it straight away too).
  const [draftRefreshKey, setDraftRefreshKey] = useState(0)
  const itemWindowOpen = itemsOpen || gameCornerOpen || rewardsTab !== null
  useEffect(() => {
    if (!itemWindowOpen) {
      refreshEligibility()
      // The Draft panel shows the coins owned, which the Game Corner and Coin Shop change.
      setDraftRefreshKey((k) => k + 1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemWindowOpen])

  function handleContextMenu(e: React.MouseEvent, mon: BoxPokemonView): void {
    e.preventDefault()
    setContextMenu({ mon, x: e.clientX, y: e.clientY })
  }

  function openEditor(monId: string, admin: boolean, focusForms = false): void {
    setContextMenu(null)
    setEditingMonId(monId)
    setEditingAdmin(admin)
    setEditingFocusForms(focusForms)
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
  // Merging takes favorites (the heart carries over), but not a fused Pokemon.
  // A 6-star one is done merging - it can be neither the keeper nor merged away.
  const canBulkMerge = (mon: BoxPokemonView): boolean => !mon.unfuse && (mon.mergeStars ?? 0) < MERGE_MAX_STARS
  const canSelect = boxSelectMode === 'merge' ? canBulkMerge : canBulkSell

  function toggleBoxSelected(mon: BoxPokemonView): void {
    if (!canSelect(mon)) return
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

  // Selling: pick every Pokemon on show - never a shiny or the companion (favorites can't
  // be sold anyway), and starred ones only with that tick on.
  function selectAllToSell(): void {
    setConfirmingBoxSell(false)
    const ids = boxMons
      .filter((m) => canBulkSell(m) && !m.shiny && !m.companion && (sellWithStars || (m.mergeStars ?? 0) === 0))
      .map((m) => m.id)
    setBoxSelection(new Set(ids))
  }

  // Merging: pick every Pokemon on show that has another of its species in the box.
  function selectAllDuplicates(): void {
    setConfirmingBoxSell(false)
    // Each fully evolved keeper with something to take in, and every one ready to go into it.
    // Pre-evolutions that need an evolution item, Friendship Petals or Rare Candies only go
    // in with that tick on, and only as many as the bag holds them for.
    const ids = new Set<string>()
    const stock = new Map<string, number>()
    const fits = (c: MergeCandidateView): boolean => {
      const boost = c.boost
      if (c.notReady && !boost) return false
      const items = c.evolveItems ?? []
      if (items.length > 0 && !mergeWithItems) return false
      if (boost?.petals && !mergeWithPetals) return false
      if (boost?.candies && !mergeWithCandies) return false
      const needs = [
        ...items.map((i) => ({ id: i.itemId, owned: i.owned, n: 1 })),
        ...(boost?.petals ? [{ id: FRIENDSHIP_PETAL_ITEM_ID, owned: boost.petalsOwned, n: boost.petals }] : []),
        ...(boost?.candies ? [{ id: RARE_CANDY_ITEM_ID, owned: boost.candiesOwned, n: boost.candies }] : [])
      ]
      if (needs.some((i) => (stock.get(i.id) ?? i.owned) < i.n)) return false
      for (const i of needs) stock.set(i.id, (stock.get(i.id) ?? i.owned) - i.n)
      return true
    }
    for (const m of boxMons) {
      const ready = (m.mergeCandidates ?? []).filter((c) => !ids.has(c.id) && fits(c))
      // The companion is left out - picking it would only ever make it the keeper.
      if (!canBulkMerge(m) || m.companion || ready.length === 0) continue
      ids.add(m.id)
      for (const c of ready) ids.add(c.id)
    }
    setBoxSelection(ids)
  }

  // Leaving the Box page: its search, filters and selection are cleared.
  function collapseBox(): void {
    setBoxSearch('')
    setBoxFilters(new Set())
    setBoxRarity(null)
    setRarityMenuOpen(false)
    setSelectMenuOpen(false)
    setSortMenuOpen(false)
    stopBoxSelection()
  }

  function startBoxSelection(mode: 'sell' | 'merge'): void {
    setBoxSelectMode(mode)
    setConfirmingBoxSell(false)
    setBoxSelection(new Set())
  }

  // What merging the selection would do: the picked Pokemon grouped by species (the
  // merge window's candidates are exactly the others of its species), and how many of
  // them would go into another.
  function mergePlan(): { groups: number; mergedAway: number } {
    const picked = (boxState?.mons ?? []).filter((m) => boxSelection?.has(m.id))
    const groups = new Map<string, number>()
    for (const mon of picked) {
      const key = [mon.id, ...(mon.mergeCandidates ?? []).map((c) => c.id)].sort()[0]
      groups.set(key, (groups.get(key) ?? 0) + 1)
    }
    const merging = [...groups.values()].filter((n) => n >= 2)
    return { groups: merging.length, mergedAway: merging.reduce((sum, n) => sum + n - 1, 0) }
  }

  async function mergeSelectedMons(e: React.MouseEvent): Promise<void> {
    if (!boxSelection || boxSelection.size === 0) return
    const at = { x: e.clientX, y: e.clientY }
    // Merged-in Pokemon leave the box for good - always asks twice.
    if (!confirmingBoxSell) {
      setConfirmingBoxSell(true)
      return
    }
    setBusy(true)
    try {
      const result = await window.api.mergeSelectedMons([...boxSelection], { petals: mergeWithPetals, candies: mergeWithCandies })
      setBoxState(result.box)
      const stars = result.results.map((r) => `${r.species} ★${r.stars}`).join(', ')
      notes.show(`Merged ${result.merged} Pokemon - ${stars}`, at)
      stopBoxSelection()
    } catch (err) {
      notes.show(errorMessage(err), at, 'bad')
    } finally {
      setBusy(false)
    }
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
      notes.show(`Sold ${result.count} Pokemon for ${formatMoney(result.sold)}${alchemistText(result.found)}`, at)
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
      notes.show(`Sold ${result.species} for ${formatMoney(result.sold)}${alchemistText(result.found)}`, at)
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
      // A cream change is only the look; any other form comes with a new set.
      notes.show(
        form.startsWith('Alcremie') ? `Changed into ${form}` : `Changed into ${form} - it has a new set to match`,
        { x: window.innerWidth / 2, y: window.innerHeight / 3 }
      )
    } catch (e) {
      notes.show(errorMessage(e), { x: window.innerWidth / 2, y: window.innerHeight / 3 }, 'bad')
    }
  }

  async function useFriendshipPetal(monId: string): Promise<void> {
    setContextMenu(null)
    setBusy(true)
    try {
      setBoxState(await window.api.useFriendshipPetal(monId))
    } finally {
      setBusy(false)
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

  // Fusing a legendary with its partner, or splitting them up.
  // The Pokemon whose merge window is open.
  const [mergingId, setMergingId] = useState<string | null>(null)

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

  // Dropped on the companion slot: any Pokemon can go there.
  function handleCompanionDrop(draggedId: string): void {
    const mon = monsById.get(draggedId)
    const slot = document.querySelector('.companion-slot')?.getBoundingClientRect()
    const at = slot ? { x: slot.left + slot.width / 2, y: slot.top } : { x: window.innerWidth / 4, y: window.innerHeight / 2 }
    if (!mon) return
    window.api
      .setCompanion(draggedId)
      .then((box) => {
        setBoxState(box)
        notes.show(`${mon.species} is your companion now`, at)
      })
      .catch((e) => notes.show(errorMessage(e), at, 'bad'))
  }

  function setCompanionSize(size: CompanionSizeChoice): void {
    window.api
      .setCompanionSize(size)
      .then(setBoxState)
      .catch(() => {})
  }

  function returnCompanion(): void {
    window.api
      .returnCompanion()
      .then(setBoxState)
      .catch((e) => notes.show(errorMessage(e), { x: window.innerWidth / 4, y: window.innerHeight / 2 }, 'bad'))
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
      setDockBoxOpen(false)
    } else if (overId === COMPANION_SLOT_ID) {
      handleCompanionDrop(draggedId)
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
  const sortedBoxMons = (boxState?.mons ?? [])
    .filter((m) => !team.includes(m.id))
    .sort(
      (a, b) =>
        Number(!!b.favorite) - Number(!!a.favorite) ||
        sortDirection * compareBoxMons(a, b, boxSort) ||
        // The same stars: Pokedex order, lowest first either way.
        (boxSort === 'stars' ? (a.dexNum ?? 0) - (b.dexNum ?? 0) : 0) ||
        (a.arrival ?? 0) - (b.arrival ?? 0)
    )
  const mergeCandidateIds = new Set((boxState?.mons ?? []).flatMap((m) => (m.mergeCandidates ?? []).map((c) => c.id)))
  const boxMons = sortedBoxMons
    .filter((m) => matchesBoxSearch(m, boxSearch))
    .filter((m) => BOX_FILTERS.every((f) => !boxFilters.has(f.key) || f.test(m, mergeCandidateIds)))
    .filter((m) => !boxRarity || (m.rarityTier ?? 'common') === boxRarity)
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
  // TM searches: a strip along the bottom of each wild area's tile.
  const tmSearch = useTmSearch((id) => onFight(id))
  if (allBossesDefeated) bossHint = 'Fight any boss again'

  // The wild level tile fills what's left of the wild grid's last row (four to a row,
  // "Anywhere" taking two) - or a whole row of its own when the tiles fill theirs.
  const wildTileCells = WILD_LOCATIONS.filter((loc) => !loc.requiresAllBosses || allBossesDefeated).length + 1
  const wildLevelSpan = (4 - (wildTileCells % 4)) % 4 || 4

  // The Lab closes again if boss progress is reset - back to All.
  const selectedLocation = WILD_LOCATIONS.find((l) => l.id === wildLocation)
  useEffect(() => {
    if (eligibility && selectedLocation?.requiresAllBosses && !eligibility.allBossesDefeated) onChangeWildLocation('all')
  }, [eligibility, selectedLocation, onChangeWildLocation])

  // The dock hidden down to its tab - remembered in this browser's storage (losing it
  // just means the dock shows).
  const [dockCollapsed, setDockCollapsed] = useState(() => {
    try {
      return localStorage.getItem('pkmnpve.dockCollapsed') === '1'
    } catch {
      return false
    }
  })
  function collapseDock(collapsed: boolean): void {
    setDockCollapsed(collapsed)
    try {
      localStorage.setItem('pkmnpve.dockCollapsed', collapsed ? '1' : '0')
    } catch {
      // Not remembered - it only decides whether the dock opens hidden.
    }
  }
  // The team dock shows on Home, Classic, Catch, the Box and Max Raid pages and while setting
  // up a Roguelite run (drag a team member onto the starter slot); it stays loaded elsewhere.
  const dockShown =
    mode === 'home' ||
    mode === 'classic' ||
    mode === 'catch' ||
    mode === 'box' ||
    mode === 'raid' ||
    (mode === 'roguelite' && !runInProgress)
  const dockBoxShown = dockBoxOpen && dockShown && !dockCollapsed && mode !== 'box'
  const boxSize = boxState?.mons.length ?? 0
  useEffect(() => {
    setDockBoxBuilt(DOCK_BOX_FIRST_CARDS)
    if (!dockBoxShown) return
    let built = DOCK_BOX_FIRST_CARDS
    let frame = 0
    const grow = (): void => {
      built += DOCK_BOX_CARDS_PER_FRAME
      setDockBoxBuilt(built)
      if (built < boxSize) frame = requestAnimationFrame(grow)
    }
    frame = requestAnimationFrame(grow)
    return () => cancelAnimationFrame(frame)
  }, [dockBoxShown, boxSize])
  // The dock itself, and the picture that follows the pointer while a Pokemon is dragged.
  const teamDock = (
    <TeamDock
      team={team}
      monsById={monsById}
      companion={
        // The companion, off the dock's left - once the Best Friends achievement opens the slot.
        boxState?.companionUnlocked && (
          <CompanionSlot
            companion={boxState.companion ?? null}
            dragging={activeDragMon ?? null}
            size={boxState.companionSize ?? 'S'}
            sizeChoice={boxState.companionSizeChoice ?? 'auto'}
            onSetSize={setCompanionSize}
            onReturn={returnCompanion}
          />
        )
      }
      onEdit={(id) => openEditor(id, false)}
      onContextMenu={handleContextMenu}
      onApplied={setBoxState}
      onManage={() => setLoadoutsOpen(true)}
      manageOpen={loadoutsOpen}
      leadCount={mode === 'raid' ? 2 : 0}
      // The Box page already shows the whole box, so no PC button there.
      boxOpen={dockBoxShown}
      onToggleBox={mode === 'box' ? undefined : () => setDockBoxOpen((open) => !open)}
      collapsed={dockCollapsed}
      onCollapsedChange={collapseDock}
    />
  )
  const dragOverlay = (
    <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
      {activeDragMon && (
        <div className="box-icon-draggable box-icon-overlay">
          <PokemonIconVisual mon={activeDragMon} />
        </div>
      )}
    </DragOverlay>
  )

  return (
    <div
      className="screen menu-shell"
    >
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
      <MenuRail
        page={mode}
        locked={cornerBusy}
        onGo={goTo}
        runFloor={run?.status === 'active' ? run.floor : null}
        raidCrystals={eligibility?.raidsUnlocked ? eligibility.wishingPieces : null}
        rewardsWaiting={claimableMissions + unclaimedAchievements}
        onItems={() => setItemsOpen(true)}
        onPokedex={() => setPokedexOpen(true)}
        onRewards={openRewards}
        onOptions={onOptions}
      />
      <div className="menu-content">
      {/* The open page's name on the left, the music player (while music is on) in the
          middle, the player card on the right. */}
      <div className="menu-header">
        <h1 className={`menu-page-title menu-page-title-${mode}`}>{PAGE_TITLES[mode]}</h1>
        <MusicPlayer />
        <div className="menu-nav">
          {/* The player: their trainer, name, title and money. A click anywhere on it opens
              the Trainer Card; hovering it opens a menu with the rarer things. */}
          <button
            className={`nav-player-card${playerMenu ? ' nav-player-card-open' : ''}`}
            title="Trainer Card"
            onMouseEnter={(e) => openPlayerMenu(e.currentTarget)}
            onMouseLeave={schedulePlayerMenuClose}
            onClick={() => {
              setPlayerMenu(null)
              setPlayerTrainerOpen(true)
            }}
          >
            <img className="nav-trainer-sprite" src={trainerSpriteUrl(trainerSprite)} alt="" />
            <span className="nav-player-text">
              {/* A full Pokedex puts the name in a gold card. */}
              {achievements?.dexComplete ? (
                <RarityCard tier="legendary" framed className="nav-player-name nav-player-name-gold" title="Pokédex complete">
                  {username}
                </RarityCard>
              ) : (
                <span className="nav-player-name">{username}</span>
              )}
              {achievements?.title && <span className="nav-player-title">{achievements.title}</span>}
            </span>
            {money !== null && <span className="nav-player-money">{formatMoney(money)}</span>}
            <span className="nav-player-caret">▾</span>
          </button>
        </div>
      </div>
      {playerMenu &&
        createPortal(
          // A hover menu: the overlay lets the pointer through, so the card under it still
          // knows when it's hovered.
          <div className="context-menu-overlay nav-player-menu-overlay">
            <div
              className="context-menu nav-player-menu"
              style={{ right: playerMenu.right, top: playerMenu.top }}
              onMouseEnter={cancelPlayerMenuClose}
              onMouseLeave={schedulePlayerMenuClose}
            >
              {[
                {
                  label: 'Trainer Card',
                  icon: <img className="nav-menu-icon" src="./icons/nav/trainercard.png" alt="" />,
                  action: () => setPlayerTrainerOpen(true)
                },
                {
                  label: 'Options',
                  icon: <img className="nav-menu-icon" src="./icons/nav/options.png" alt="" />,
                  action: onOptions
                },
                ...(isAdmin
                  ? [{ label: 'Debug', icon: <span className="nav-menu-icon">🛠</span>, action: () => setDebugOpen(true) }]
                  : [])
              ].map(({ label, icon, action }, i) => (
                <button
                  key={label}
                  className="context-menu-item nav-menu-item"
                  style={{ '--i': i } as React.CSSProperties}
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
      <div ref={sectionRef} className={`menu-page menu-page-${mode}`}>
      {mode === 'home' ? (
        <HomeHub
          levelCap={levelCap}
          eligibility={eligibility}
          bossHint={bossHint}
          run={run}
          bestFloor={bestFloor}
          boxCount={boxState ? boxState.mons.length : null}
          missions={missions}
          fightBusy={fightBusy}
          onGo={goTo}
          onOpenMissions={() => {
            refreshMissions()
            setRewardsTab('missions')
          }}
          rewardsWaiting={claimableMissions + unclaimedAchievements}
          onItems={() => setItemsOpen(true)}
          onPokedex={() => setPokedexOpen(true)}
          onRewards={openRewards}
          onOptions={onOptions}
        />
      ) : mode === 'raid' ? (
        <RaidPage
          eligibility={eligibility}
          teamSize={team.filter(Boolean).length}
          levelCap={levelCap}
          fightBusy={fightBusy}
          onStart={onRaidFight}
          onOpenShop={() => setItemsOpen(true)}
          onOpenCoinShop={() => {
            setGameCornerTab('shop')
            goTo('corner', document.querySelector<HTMLElement>('.menu-rail-corner'))
          }}
        />
      ) : mode === 'corner' ? (
        <GameCornerModal
          key={coinShopJump}
          inline
          focusItem={coinShopFocus}
          onItemFocused={() => setCoinShopFocus(null)}
          initialTab={gameCornerTab}
          onTabChange={setGameCornerTab}
          onClose={() => {}}
          onBusyChange={setCornerBusy}
          onMoneyChange={setMoney}
          onBoxChange={refreshBox}
        />
      ) : (
      <>
      <div
        className={`battle-section${boxExpanded && !fullPanel ? ' battle-section-collapsed' : ''}${
          fullPanel ? ' battle-section-run' : ''
        }`}
      >
        {mode === 'draft' ? (
          <div className="battle-section-inner">
            <DraftPanel busy={fightBusy} onBattle={(view) => onRunBattle(view)} refreshKey={draftRefreshKey} />
          </div>
        ) : mode === 'roguelite' ? (
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
          {/* One framed card like the Roguelite and Draft setups, in Classic's blue: the
              trainer and boss battles on the Classic page, the wild ones on Catch. */}
          <div className="run-panel classic-panel">
          <div className="classic-card">
          <div className="run-setup-header">
            <span className="run-hud-label">Battle</span>
            {levelCap !== null && <span className="classic-level-cap">Level Cap {levelCap}</span>}
          </div>

          {mode !== 'classic' ? (
          <>

          {/* Wild Pokemon: every area is its own battle button - click one to find a wild
              Pokemon there straight away (it's remembered as the last area fought in). */}
          <div className="classic-section-head">
            <img className="classic-section-icon" src="./icons/tall-grass.png" alt="" />
            <span className="run-hud-label">Wild battle</span>
            <span className="classic-section-sub">Pick an area to search</span>
          </div>
          <div className="classic-wild-grid">
            {WILD_LOCATIONS.filter((loc) => !loc.requiresAllBosses || allBossesDefeated).map((loc) => (
              <div key={loc.id} className={`classic-wild-cell classic-wild-${loc.id}`}>
                <button
                  className={`classic-wild-tile${wildLocation === loc.id ? ' classic-wild-tile-last' : ''}`}
                  disabled={fightBusy || teamEmpty}
                  title={wildLocation === loc.id ? `${loc.label} - where you last searched` : `Find a wild Pokémon: ${loc.label}`}
                  style={{ backgroundImage: `url(${backdropUrl(LOCATION_BUTTON_BACKDROP[loc.id])})` }}
                  onClick={() => onFight(loc.id)}
                >
                  <span className="classic-wild-go">Battle ▸</span>
                  <span className="classic-wild-label">
                    <img className="classic-wild-icon" src={locationIconUrl(loc.id)} alt="" />
                    {loc.id === 'all' ? 'Anywhere' : loc.label}
                  </span>
                </button>
                <TmSearchStrip
                  location={loc}
                  state={tmSearch.state}
                  disabled={fightBusy}
                  onSearch={() => tmSearch.open(loc)}
                />
              </div>
            ))}
            {/* The wild level, in the room left on the last row: the level big, - / + either
                side (or the mouse wheel over it), quick picks, and a bar along the bottom
                to drag. Wild Pokemon come at up to this level. */}
            <div
              className="classic-level-tile"
              style={{ gridColumn: `span ${wildLevelSpan}` }}
              title="Wild Pokémon come at up to this level - scroll over it to change it"
              onWheel={(e) =>
                onChangeWildLevelCap(
                  Math.min(levelCapMax, Math.max(WILD_LEVEL_CAP_MIN, effectiveWildLevelCap + (e.deltaY < 0 ? 1 : -1)))
                )
              }
            >
              <div className="classic-level-main">
                <button
                  className="classic-level-step"
                  aria-label="One level lower"
                  disabled={effectiveWildLevelCap <= WILD_LEVEL_CAP_MIN}
                  onClick={() => onChangeWildLevelCap(effectiveWildLevelCap - 1)}
                >
                  −
                </button>
                <span className="classic-level-value">
                  <span className="classic-level-label">Wild level</span>
                  <strong>Lv {effectiveWildLevelCap}</strong>
                </span>
                <button
                  className="classic-level-step"
                  aria-label="One level higher"
                  disabled={effectiveWildLevelCap >= levelCapMax}
                  onClick={() => onChangeWildLevelCap(effectiveWildLevelCap + 1)}
                >
                  +
                </button>
                <span className="classic-level-picks">
                  {[
                    { label: 'Min', level: WILD_LEVEL_CAP_MIN },
                    { label: 'Half', level: Math.round((WILD_LEVEL_CAP_MIN + levelCapMax) / 2) },
                    { label: 'Max', level: levelCapMax }
                  ].map((p) => (
                    <button
                      key={p.label}
                      className={`classic-level-pick${effectiveWildLevelCap === p.level ? ' classic-level-pick-on' : ''}`}
                      title={`Lv ${p.level}`}
                      onClick={() => onChangeWildLevelCap(p.level)}
                    >
                      {p.label}
                    </button>
                  ))}
                </span>
              </div>
              <input
                type="range"
                className="classic-level-bar"
                aria-label="Wild level"
                min={WILD_LEVEL_CAP_MIN}
                max={levelCapMax}
                value={effectiveWildLevelCap}
                style={
                  {
                    '--fill': `${levelCapMax > WILD_LEVEL_CAP_MIN ? ((effectiveWildLevelCap - WILD_LEVEL_CAP_MIN) / (levelCapMax - WILD_LEVEL_CAP_MIN)) * 100 : 100}%`
                  } as React.CSSProperties
                }
                onChange={(e) => onChangeWildLevelCap(Number(e.target.value))}
              />
            </div>
          </div>

          {tmSearch.modal}

          {/* The DexNav (once owned): the Pokemon being hunted, its chain, and where to look. */}
          <DexNavPanel wildLevel={effectiveWildLevelCap} disabled={fightBusy || teamEmpty} labOpen={allBossesDefeated} onHunt={(id) => onFight(id)} />
          </>
          ) : (
          <>
          {/* Trainers: the next trainer, and the next boss (or a rematch once all are beaten). */}
          <div className="classic-section-head">
            <img className="classic-section-icon" src="./icons/nav/trainercard.png" alt="" />
            <span className="run-hud-label">Trainer battles</span>
          </div>
          <div className="classic-trainer-row">
            <button
              className={`classic-trainer-tile${eligibility?.rocketEvent ? ' classic-trainer-rocket' : ''}`}
              disabled={fightBusy || teamEmpty || !eligibility?.hasTrainer}
              onClick={onTrainerFight}
            >
              <img
                className="classic-trainer-sprite"
                src={trainerSpriteUrl(eligibility?.rocketEvent ? 'rocketgrunt' : 'acetrainer')}
                alt=""
              />
              <span className="classic-trainer-text">
                <span className="classic-trainer-title">{eligibility?.rocketEvent ? 'Team Rocket!' : 'Trainer Battle'}</span>
                <span className="classic-trainer-sub">
                  {eligibility?.rocketEvent ? 'A grunt blocks the way' : 'Take on the next trainer'}
                </span>
              </span>
              <span className="classic-wild-go">Battle ▸</span>
            </button>
            <button
              className="classic-trainer-tile classic-boss-tile"
              disabled={fightBusy || teamEmpty || !(eligibility?.hasBoss || allBossesDefeated)}
              title={bossHint}
              onClick={allBossesDefeated ? () => setRematchOpen(true) : onBossFight}
            >
              <img className="classic-trainer-sprite" src={trainerSpriteUrl(nextBoss?.spriteId || 'giovanni')} alt="" />
              <span className="classic-trainer-text">
                <span className="classic-trainer-title">{allBossesDefeated ? 'Boss Rematch' : 'Boss Battle'}</span>
                <span className="classic-trainer-sub">{bossHint}</span>
              </span>
              <span className="classic-wild-go">{allBossesDefeated ? 'Pick ▸' : 'Battle ▸'}</span>
            </button>
          </div>

          {/* A battle with a friend on another computer. */}
          <OnlineSection disabled={fightBusy || teamEmpty} />
          </>
          )}
          </div>
          </div>
        </div>
        )}
      </div>

      {boxEmpty && !fullPanel && (
        <button className="choose-starter-button" onClick={() => setStarterOpen(true)}>
          Choose Starter
        </button>
      )}

        {!fullPanel && (
        <>
        {/* The box, on the Box page only: its toolbar - or, while picking Pokemon to sell or
            merge, the selection bar in its place - and the box itself. */}
        {mode === 'box' && (
        <>
        {/* The box's counts, just above the toolbar. */}
        {boxState && (
          <div className="box-summary">
            {[
              { label: 'Pokémon', value: boxState.mons.length },
              { label: 'Shiny', value: boxState.mons.filter((m) => m.shiny).length },
              { label: 'Merged ★', value: boxState.mons.filter((m) => (m.mergeStars ?? 0) > 0).length },
              { label: 'Favorites', value: boxState.mons.filter((m) => m.favorite).length },
              { label: 'Can merge', value: boxState.mons.filter((m) => (m.mergeCandidates?.length ?? 0) > 0).length }
            ].map((s) => (
              <span key={s.label} className="box-summary-stat">
                <strong>{s.value.toLocaleString('en-US')}</strong>
                {s.label}
              </span>
            ))}
          </div>
        )}
        {boxSelection ? (
          <div className="box-toolbar box-toolbar-attached box-selection-bar">
            <button className="box-selection-cancel" disabled={busy} title="Stop selecting" onClick={stopBoxSelection}>
              ✕
            </button>
            <span className="box-selection-mode">{boxSelectMode === 'merge' ? 'Merging' : 'Selling'}</span>
            <span className="box-selection-summary">
              {boxSelection.size} selected ·{' '}
              {boxSelectMode === 'merge'
                ? (() => {
                    const plan = mergePlan()
                    return plan.mergedAway > 0
                      ? `${plan.mergedAway} merged into ${plan.groups} Pokémon`
                      : 'pick two or more of the same Pokémon'
                  })()
                : formatMoney(
                    (boxState?.mons ?? [])
                      .filter((m) => boxSelection.has(m.id))
                      .reduce((sum, m) => sum + (m.sellPrice ?? POKEMON_SELL_PRICES[m.rarityTier ?? 'common']), 0)
                  )}
            </span>
            {boxSelectMode === 'merge' ? (
              <>
                <Tooltip
                  className="game-corner-info"
                  placement="below"
                  content={<div className="tooltip-panel">Each species goes into its best copy (most stars, then most evolved, then highest level)</div>}
                >
                  <span className="game-corner-info-icon" aria-label="How merging works">
                    i
                  </span>
                </Tooltip>
                <span className="box-selection-hint" />
              </>
            ) : (
              <span className="box-selection-hint">Favorites can't be picked</span>
            )}
            {boxSelectMode === 'sell' && (
              <>
                <span className="box-merge-ticks">
                  <label className="box-merge-items-toggle" title="Also pick Pokémon with merge stars when selecting all">
                    <input type="checkbox" checked={sellWithStars} onChange={(e) => setSellWithStars(e.target.checked)} />
                    <span>★ Starred</span>
                  </label>
                </span>
                <button disabled={busy} onClick={selectAllToSell} title="Pick every Pokémon shown, except favorites and shinies">
                  Select all
                </button>
              </>
            )}
            {boxSelectMode === 'merge' && (
              <>
                {/* What "Select all duplicates" may spend on pre-evolutions that need it to go in. */}
                <span className="box-merge-ticks">
                  <span className="box-merge-ticks-label">Use</span>
                  <label className="box-merge-items-toggle" title="Also pick pre-evolutions that use up an evolution item to go in (as many as your bag has items for)">
                    <input type="checkbox" checked={mergeWithItems} onChange={(e) => setMergeWithItems(e.target.checked)} />
                    <span>Evo items</span>
                  </label>
                  <label className="box-merge-items-toggle" title="Also pick pre-evolutions with a friendship evolution, using up a Friendship Petal each to max their friendship">
                    <input type="checkbox" checked={mergeWithPetals} onChange={(e) => setMergeWithPetals(e.target.checked)} />
                    <ItemSprite spritenum={FRIENDSHIP_PETAL_SPRITENUM} className="box-merge-tick-icon" />
                    <span>Petals</span>
                  </label>
                  <label className="box-merge-items-toggle" title="Also pick pre-evolutions short of their evolution's level, using up Rare Candies to reach it (up to the level cap)">
                    <input type="checkbox" checked={mergeWithCandies} onChange={(e) => setMergeWithCandies(e.target.checked)} />
                    <ItemSprite spritenum={RARE_CANDY_SPRITENUM} className="box-merge-tick-icon" />
                    <span>Candies</span>
                  </label>
                </span>
                <button disabled={busy} onClick={selectAllDuplicates} title="Pick every Pokémon shown that has another of its species">
                  Select all duplicates
                </button>
              </>
            )}
            {boxSelectMode === 'merge' ? (
              <button
                className={`box-selection-go${confirmingBoxSell ? ' box-sell-confirm' : ''}`}
                disabled={busy || mergePlan().mergedAway === 0}
                onClick={(e) => void mergeSelectedMons(e)}
              >
                {confirmingBoxSell ? 'Merge them? Click again' : 'Merge selected'}
              </button>
            ) : (
              <button
                className={`box-selection-go${confirmingBoxSell ? ' box-sell-confirm' : ''}`}
                disabled={busy || boxSelection.size === 0}
                onClick={(e) => void sellSelectedMons(e)}
              >
                {confirmingBoxSell ? 'Includes rare or shiny Pokemon - click again' : 'Sell selected'}
              </button>
            )}
          </div>
        ) : (
          <>
            {
              // One panel on top of the box, each option a section of it.
              <div className="box-toolbar box-toolbar-attached">
                {/* How many Pokemon are on show - the search and filters narrow it. */}
                <span className="box-toolbar-section box-toolbar-title box-toolbar-count-label">
                  Box <span className="box-count">· {boxMons.length}</span>
                </span>
                <div className="box-toolbar-section box-toolbar-search">
                  <SearchBar
                    key={boxExpanded ? 'expanded' : 'collapsed'}
                    className="box-search"
                    value={boxSearch}
                    onChange={setBoxSearch}
                    placeholder="Search name, type, move, ability, item…"
                    autoFocus={false}
                  />
                </div>
                <div className="box-toolbar-section box-filters">
                  {BOX_FILTERS.map((f) => (
                    <button
                      key={f.key}
                      className={`box-filter-chip${boxFilters.has(f.key) ? ' box-filter-chip-on' : ''}`}
                      title={f.title}
                      onClick={() =>
                        setBoxFilters((current) => {
                          const next = new Set(current)
                          if (next.has(f.key)) next.delete(f.key)
                          else next.add(f.key)
                          return next
                        })
                      }
                    >
                      {f.icon}
                    </button>
                  ))}
                </div>
                {/* Rarity: a menu like Sort's - every rarity, or just one colour. */}
                <div className="box-toolbar-section box-rarity-filter">
                  <span className="box-select-menu-wrap">
                    <button className="box-select-button box-rarity-button" title="Show one rarity" onClick={() => setRarityMenuOpen((v) => !v)}>
                      {boxRarity && <span className={`box-rarity-dot rarity-tier-${boxRarity}`} />}
                      {boxRarity ? TIER_LABELS[boxRarity] : 'Any rarity'} ▾
                    </button>
                    {rarityMenuOpen && (
                      <>
                        <div className="box-select-menu-backdrop" onMouseDown={() => setRarityMenuOpen(false)} />
                        <div className="context-menu box-select-menu box-sort-menu">
                          {[null, ...RARITY_TIERS].map((tier) => (
                            <button
                              key={tier ?? 'any'}
                              className={`context-menu-item box-rarity-item${tier === boxRarity ? ' box-sort-menu-current' : ''}`}
                              onClick={() => {
                                setRarityMenuOpen(false)
                                setBoxRarity(tier)
                              }}
                            >
                              {tier && <span className={`box-rarity-dot rarity-tier-${tier}`} />}
                              {tier ? TIER_LABELS[tier] : 'Any rarity'}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </span>
                </div>
                <div className="box-toolbar-section box-sort">
                  <span className="box-sort-label">Sort</span>
                  <span className="box-select-menu-wrap">
                    <button className="box-select-button box-sort-button" title="Order the box" onClick={() => setSortMenuOpen((v) => !v)}>
                      {BOX_SORTS.find((sort) => sort.key === boxSort)?.label} ▾
                    </button>
                    {sortMenuOpen && (
                      <>
                        <div className="box-select-menu-backdrop" onMouseDown={() => setSortMenuOpen(false)} />
                        <div className="context-menu box-select-menu box-sort-menu">
                          {BOX_SORTS.map((sort) => (
                            <button
                              key={sort.key}
                              className={`context-menu-item${sort.key === boxSort ? ' box-sort-menu-current' : ''}`}
                              onClick={() => {
                                setSortMenuOpen(false)
                                setBoxSort(sort.key)
                              }}
                            >
                              {sort.label}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </span>
                  <button
                    className="box-sort-direction"
                    title={boxSortDescending ? 'Descending - click for ascending' : 'Ascending - click for descending'}
                    onClick={() => setBoxSortDescending((d) => !d)}
                  >
                    {/* One arrow, turned to point up for ascending. */}
                    <svg className={`box-sort-arrow${boxSortDescending ? '' : ' box-sort-arrow-up'}`} viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M8 2.5v10M3.5 8.5 8 13l4.5-4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
                <div className="box-toolbar-section box-select-menu-wrap">
                  <button className="box-select-button" onClick={() => setSelectMenuOpen((v) => !v)}>
                    Select ▾
                  </button>
                  {selectMenuOpen && (
                    <>
                      <div className="box-select-menu-backdrop" onMouseDown={() => setSelectMenuOpen(false)} />
                      <div className="context-menu box-select-menu">
                        <button
                          className="context-menu-item"
                          onClick={() => {
                            setSelectMenuOpen(false)
                            startBoxSelection('sell')
                          }}
                        >
                          Select to sell
                        </button>
                        <button
                          className="context-menu-item"
                          onClick={() => {
                            setSelectMenuOpen(false)
                            startBoxSelection('merge')
                          }}
                        >
                          Select to merge
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            }
          </>
        )}
        {boxPageReady && boxState ? (
          <BoxGrid
            mons={boxMons}
            onEdit={(id) => openEditor(id, false)}
            onContextMenu={handleContextMenu}
            emptyHint={boxSearch.trim() ? 'No Pokemon in the box match that search.' : undefined}
            selection={boxSelection}
            onToggleSelect={toggleBoxSelected}
            canSelect={canSelect}
          />
        ) : (
          <div className="box-grid box-page-loading">
            <ModalSpinner />
          </div>
        )}
        </>
        )}
        </>
        )}

      </>
      )}
      </div>
      {/* The team dock: one, always loaded, floating over the bottom of every page that
          uses the team - it slides away where the team isn't used (Draft, the Game Corner,
          a run in progress) and back again, never reloading. */}
      <div
        className={`team-dock-holder${dockShown ? '' : ' team-dock-holder-hidden'}${dockBoxShown ? ' team-dock-holder-raised' : ''}`}
        aria-hidden={!dockShown}
      >
        {teamDock}
        {/* The small box pulled up from under the dock, which rises to make room for it. */}
        {dockBoxShown && (
          <div className="team-dock-box">
            <div className="team-dock-box-head">
              <img className="team-dock-box-icon" src="./icons/nav/box.png" alt="" />
              <span className="team-dock-box-title">
                Box <span className="box-count">· {sortedBoxMons.length}</span>
              </span>
              <SearchBar
                className="team-dock-box-search"
                value={dockBoxSearch}
                onChange={setDockBoxSearch}
                placeholder="Search name, type, move…"
                autoFocus={false}
              />
            </div>
            <BoxGrid
              mons={sortedBoxMons.filter((m) => matchesBoxSearch(m, dockBoxSearch)).slice(0, dockBoxBuilt)}
              onEdit={(id) => openEditor(id, false)}
              onContextMenu={handleContextMenu}
              emptyHint={dockBoxSearch.trim() ? 'No Pokemon in the box match that search.' : undefined}
            />
          </div>
        )}
      </div>
      {dragOverlay}
      </DndContext>
      </div>

      {editingMonId && (
        <PokemonEditor
          key={`${editingMonId}-${editorVersion}`}
          source={{ kind: 'box', monId: editingMonId }}
          admin={editingAdmin}
          onClose={() => {
            setEditingMonId(null)
            setEditingAdmin(false)
            setEditingFocusForms(false)
          }}
          focusForms={editingFocusForms}
          onSaved={refreshBox}
          favorite={!!monsById.get(editingMonId)?.favorite}
          mergeStars={monsById.get(editingMonId)?.mergeStars ?? 0}
          mergeCopies={monsById.get(editingMonId)?.copies}
          rarityTier={monsById.get(editingMonId)?.rarityTier}
          everstone={monsById.get(editingMonId)?.everstone}
          onSetEverstone={(locked) =>
            void window.api
              .setEverstone(editingMonId, locked)
              .then(setBoxState)
              .catch((err: unknown) => notes.show(errorMessage(err), { x: window.innerWidth / 2, y: window.innerHeight / 2 }, 'bad'))
          }
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

      {mergingId && monsById.get(mergingId) && (
        <MergeModal
          keeper={monsById.get(mergingId)!}
          onMerged={(box, stars) => {
            setBoxState(box)
            setMergingId(null)
            notes.show(stars > 0 ? `Merged - now ★${stars}` : 'Merged', { x: window.innerWidth / 2, y: window.innerHeight / 2 })
          }}
          onClose={() => setMergingId(null)}
        />
      )}

      {debugOpen && (
        <DebugMenu
          onClose={() => setDebugOpen(false)}
          onTrainers={onTrainers}
          onRogueliteBosses={onRogueliteBosses}
          onAddPokemon={() => {
            setDebugOpen(false)
            setDebugAddOpen(true)
          }}
          onWildDrops={() => {
            setDebugOpen(false)
            setWildDropsOpen(true)
          }}
          onShopPrices={() => {
            setDebugOpen(false)
            setShopPricesOpen(true)
          }}
          onWalletChanged={setMoney}
        />
      )}

      {debugAddOpen && (
        <DebugAddMon
          onAdded={setBoxState}
          onRaid={(species, level, shiny) => {
            setDebugAddOpen(false)
            onDebugRaid(species, level, shiny)
          }}
          onClose={() => setDebugAddOpen(false)}
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

      {pokedexOpen && (
        <PokedexModal
          focus={pokedexFocus}
          onClose={() => {
            setPokedexOpen(false)
            setPokedexFocus(null)
          }}
        />
      )}


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
          shinyPatches={contextMenu.mon.shinyPatches}
          friendshipPetals={contextMenu.mon.friendshipPetals}
          onUseFriendshipPetal={() => void useFriendshipPetal(contextMenu.mon.id)}
          formChanges={contextMenu.mon.formChanges}
          onOpenForms={() => openEditor(contextMenu.mon.id, false, true)}
          fusions={contextMenu.mon.fusions}
          onFuse={(partnerId) =>
            void fusionAction(
              () => window.api.fuseMon(contextMenu.mon.id, partnerId),
              `Fused into ${contextMenu.mon.fusions?.find((f) => f.partnerId === partnerId)?.result}`,
              { x: contextMenu.x, y: contextMenu.y }
            )
          }
          favorite={!!contextMenu.mon.favorite}
          onToggleFavorite={() => {
            window.api
              .toggleFavorite(contextMenu.mon.id)
              .then(setBoxState)
              .catch(() => {})
          }}
          mergeCount={contextMenu.mon.mergeCandidates?.length ?? 0}
          onMerge={() => {
            setMergingId(contextMenu.mon.id)
            setContextMenu(null)
          }}
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
          sellPrice={contextMenu.mon.sellPrice ?? POKEMON_SELL_PRICES[contextMenu.mon.rarityTier ?? 'common']}
          sellNeedsConfirm={!!contextMenu.mon.shiny || CONFIRM_SELL_TIERS.has(contextMenu.mon.rarityTier ?? 'common')}
          shiny={!!contextMenu.mon.shiny}
          onClose={() => setContextMenu(null)}
        />
      )}

      {itemsOpen && (
        <BagShopModal
          onClose={() => setItemsOpen(false)}
          onOpenCoinShop={(itemId) => {
            setItemsOpen(false)
            setGameCornerTab('shop')
            setCoinShopFocus(itemId)
            setCoinShopJump((n) => n + 1)
            goTo('corner', document.querySelector<HTMLElement>('.menu-rail-corner'))
          }}
          onChanged={() => {
            refreshMoney()
            refreshBox()
          }}
          onMoneyChange={setMoney}
        />
      )}

      {notes.layer}
      {rewardsTab && (
        <RewardsModal
          tab={rewardsTab}
          onSwitch={setRewardsTab}
          missions={missions}
          achievements={achievements}
          onMissionsChange={setMissions}
          onAchievementsChange={setAchievements}
          onClaimed={(newMoney) => {
            setMoney(newMoney)
            refreshBox()
            // A reward can be Raid Crystals - the Max Raid button counts them.
            refreshEligibility()
          }}
          onClose={() => {
            setRewardsTab(null)
            setAchievementFocus(null)
          }}
          focus={achievementFocus}
          onFocused={() => setAchievementFocus(null)}
        />
      )}

    </div>
  )
}

export default MainMenu
