import { useEffect, useRef, useState } from 'react'
import FitName from './FitName'
import { createPortal } from 'react-dom'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import type {
  BoxPokemonView,
  RogueliteBossClass,
  RunBossReward,
  RunChoice,
  RunConsumableId,
  RunDifficulty,
  RunMonView,
  RunNodeKind,
  RunShopTile,
  RunView
} from '../../shared/battle-types'
import {
  POKEMON_GENERATIONS,
  runBossCount,
  ROGUELITE_BOSS_EVERY,
  runFinalFloor,
  ROGUELITE_MAX_TEAM,
  ROGUELITE_START_LEVEL,
  RUN_CONSUMABLES,
  RUN_CONSUMABLE_PRICES,
  RUN_RARE_CANDY_ICON,
  RUN_RARE_CANDY_PRICE,
  RUN_DIFFICULTIES,
  RUN_GEM_ICON,
  RUN_SHOP_TILE_PRICES,
  WILD_LOCATIONS,
  rogueliteBossClassAt,
  rogueliteBossLabelAt,
  runDifficultyInfo,
  toSpriteId
} from '../../shared/battle-types'
import PokemonIconVisual from './PokemonIconVisual'
import SpriteImage from './SpriteImage'
import PokemonTooltipContent from './PokemonTooltipContent'
import Tooltip from './Tooltip'
import ItemSprite from './ItemSprite'
import { TR_SPRITENUM } from './itemIcon'
import { formatMoney } from './money'
import RunMonContextMenu from './RunMonContextMenu'
import RunMonEditor from './RunMonEditor'
import { useTapGuard } from './useTapGuard'
import { trainerSpriteUrl } from './trainerSprite'
import { LOCATION_BUTTON_BACKDROP, backdropUrl, locationIconUrl } from './battleScenery'

// The whole run as a bar: a notch per floor, a bigger one for each boss (coloured by
// Gym Leader / Elite Four / Champion), filled up to the floor the run is on.
function RunProgressBar({ floor, difficulty }: { floor: number; difficulty: RunDifficulty }): React.JSX.Element {
  const finalFloor = runFinalFloor(difficulty)
  const done = Math.min(1, (floor - 1) / (finalFloor - 1))
  return (
    <div className="run-progress" title={`Floor ${floor} of ${finalFloor}`}>
      <div className="run-progress-fill" style={{ width: `${done * 100}%` }} />
      {/* A little flag over the floor the run is on. */}
      <span className="run-progress-marker" style={{ left: `${done * 100}%` }}>
        {floor}
      </span>
      {Array.from({ length: finalFloor }, (_, i) => {
        const n = i + 1
        const boss = n % ROGUELITE_BOSS_EVERY === 0
        const bossIndex = n / ROGUELITE_BOSS_EVERY - 1
        const state = n < floor ? 'done' : n === floor ? 'current' : 'ahead'
        return (
          <span
            key={n}
            className={`run-notch run-notch-${state}${boss ? ` run-notch-boss run-notch-${rogueliteBossClassAt(bossIndex, difficulty)}` : ''}`}
            style={{ left: `${(i / (finalFloor - 1)) * 100}%` }}
            title={boss ? `Floor ${n}: ${rogueliteBossLabelAt(bossIndex, difficulty)}` : `Floor ${n}`}
          />
        )
      })}
    </div>
  )
}

// The droppable id MainMenu's drag handler looks for.
export const RUN_STARTER_SLOT_ID = 'run-starter-slot'
// Run team cards drag as run-mon-<id> and take drops as run-slot-<index> (MainMenu
// reorders the team from those).
export const RUN_MON_DRAG_PREFIX = 'run-mon-'
export const RUN_SLOT_DROP_PREFIX = 'run-slot-'

interface Props {
  run: RunView | null
  // The box/team Pokemon dragged onto the starter slot (before a run starts).
  picked: BoxPokemonView | undefined
  busy: boolean
  // The furthest floor any run reached, and on which difficulty (null if unrecorded).
  bestFloor: { floor: number; difficulty: RunDifficulty | null } | null
  onStart: (difficulty: RunDifficulty, generation: number | null) => void
  // A floor option, by its place in run.choices.
  onChoose: (index: number) => void
  onGiveItem: (itemId: string, runMonId: string) => void
  onSkipItem: () => void
  onGiveAbility: (abilityId: string, runMonId: string) => void
  onTeachMove: (moveId: string, runMonId: string, replaceMoveId: string | null) => void
  onSkipPick: () => void
  // The run as it stands after an edit made here (the run's Pokemon editor).
  onRunUpdated: (run: RunView) => void
  onRerollItems: () => void
  onEvolve: (runMonId: string, targetSpecies: string) => void
  onMoveItem: (fromMonId: string, toMonId: string) => void
  // The item a new one replaced: give it to this Pokemon, or let it go (null).
  onPlaceDisplacedItem: (runMonId: string | null) => void
  onForfeit: () => void
}

// Badly poisoned reads as PSN, the same as the battle screen shows it.
const statusLabel = (status: string): string => (status === 'tox' ? 'PSN' : status.toUpperCase())

// Each floor kind's name, its tooltip, and the one-liner under it on its tile.
const NODE_INFO: Record<RunNodeKind, { label: string; hint: string; short: string }> = {
  wild: { label: 'Wild Pokémon', hint: 'Beat it and you can add it to your team', short: 'Catch a new member' },
  trainer: {
    label: 'Trainer',
    hint: 'A trainer battle, sized for this floor - win it for a held item and extra exp',
    short: 'Item, exp & gems'
  },
  item: { label: 'Item', hint: 'Pick a held item for one of your Pokémon', short: 'Pick a held item' },
  heal: { label: 'Pokémon Center', hint: 'Your whole team back to full HP, no status', short: 'Full team heal' },
  boss: { label: 'Boss', hint: 'A boss battle - win it to heal up and move on', short: 'Boss battle' },
  ability: { label: 'New Ability', hint: 'Pick one of four strong abilities for one of your Pokémon', short: 'Pick an ability' },
  move: { label: 'New Move', hint: 'Pick one of four signature moves to teach one of your Pokémon', short: 'Teach a move' },
  swap: {
    label: 'Random Swap',
    hint: 'Swap one Pokémon - or your whole team - for completely random ones at the next boss’s level',
    short: 'Roll the dice'
  },
  villain: {
    label: 'Villain',
    hint: 'The villain who took this floor over - free to fight. Beat them to pick one of 3 Pokémon at the next level cap, each holding an item',
    short: 'Free · Win a Pokémon'
  }
}

// Where a wild option is - its location's entry, or none for an older run's "anywhere".
const locationOf = (choice: RunChoice): (typeof WILD_LOCATIONS)[number] | undefined =>
  WILD_LOCATIONS.find((l) => l.id === choice.location)

// The Choice Band on the same sheet, for item floors.
const CHOICE_BAND_SPRITENUM = 68

// villainSprite: who took the floor over, for the villain's own tile.
function NodeIcon({ choice, villainSprite }: { choice: RunChoice; villainSprite?: string }): React.JSX.Element {
  const { kind } = choice
  // Unlike a boss, the villain is shown as who they are: the takeover already gave them away.
  if (kind === 'villain') return <img className="big-battle-icon" src={trainerSpriteUrl(villainSprite ?? 'giovanni')} alt="" />
  if (kind === 'wild') {
    // The location's own icon over its backdrop (wild grass for an older run's "anywhere").
    return <img className="big-battle-icon run-node-location-icon" src={locationIconUrl(locationOf(choice)?.id)} alt="" />
  }
  if (kind === 'trainer') return <img className="big-battle-icon" src={trainerSpriteUrl('youngster')} alt="" />
  // Who the boss is stays a surprise until the fight starts.
  if (kind === 'boss') return <img className="big-battle-icon run-boss-silhouette" src={trainerSpriteUrl('giovanni')} alt="" />
  // The Ability Patch (the Shiny Patch shares its picture) and a TR from the item sheet.
  if (kind === 'ability') return <img className="big-battle-icon run-node-item-icon" src="./sprites/misc/shinypatch.png" alt="" />
  if (kind === 'move') {
    return (
      <span className="run-node-tr">
        <ItemSprite spritenum={TR_SPRITENUM} />
      </span>
    )
  }
  if (kind === 'swap') return <img className="big-battle-icon" src={trainerSpriteUrl('burglar')} alt="" />
  if (kind === 'heal') return <img className="big-battle-icon" src={trainerSpriteUrl('pokemoncenterlady')} alt="" />
  // An item floor shows a Choice Band, scaled up like the TR.
  if (kind === 'item') {
    return (
      <span className="run-node-tr">
        <ItemSprite spritenum={CHOICE_BAND_SPRITENUM} />
      </span>
    )
  }
  return <span className="run-node-emoji">❔</span>
}

// A boss floor's shop picks, in order: each plays out like the floor of the same name.
const SHOP_TILES: RunShopTile[] = ['ability', 'move', 'item', 'swap']
const SHOP_TILE_LABELS: Record<RunShopTile, string> = {
  ability: 'New Ability',
  move: 'New Move',
  item: 'New Item',
  swap: 'Random Swap'
}

function GemIcon(): React.JSX.Element {
  return <img className="run-gem-icon" src={RUN_GEM_ICON} alt="Gems" />
}

const gemPrice = (price: number): React.JSX.Element =>
  price === 0 ? (
    <span className="run-shop-price">Free</span>
  ) : (
    <span className="run-shop-price">
      <GemIcon />
      {price}
    </span>
  )

// A difficulty's end-of-run rewards as icons: what every boss is worth, then the extras
// only some classes of boss give.
const EXP_CANDY_REWARDS: Record<string, { name: string; spritenum: number }> = {
  expcandys: { name: 'Exp. Candy S', spritenum: -5 },
  expcandym: { name: 'Exp. Candy M', spritenum: -6 },
  expcandyl: { name: 'Exp. Candy L', spritenum: -7 }
}
// The bag's icons for them: the GS Ball and the Master Ball.
const RANDOM_POKEMON_SPRITENUM = -10
const RANDOM_LEGENDARY_SPRITENUM = 276
// The Raid Crystal's icon (see ItemSprite).
const RAID_CRYSTAL_SPRITENUM = -26
const BOSS_CLASS_NAMES: Record<RogueliteBossClass, string> = {
  gymLeader: 'Gym Leaders',
  eliteFour: 'Elite Four',
  champion: 'Champion',
  villainGrunt: 'Villain Grunts',
  villainElite: 'Villain Elites'
}

function RewardChip({ spritenum, label }: { spritenum?: number; label: string }): React.JSX.Element {
  return (
    <span className="achievement-reward-chip run-reward-chip">
      {spritenum !== undefined && <ItemSprite spritenum={spritenum} />}
      {label}
    </span>
  )
}

function RunRewardChips({ reward }: { reward: RunBossReward }): React.JSX.Element {
  const candy = EXP_CANDY_REWARDS[reward.expCandy]
  const randomPokemon = <RewardChip spritenum={RANDOM_POKEMON_SPRITENUM} label="Random Pokémon" />
  const randomLegendary = <RewardChip spritenum={RANDOM_LEGENDARY_SPRITENUM} label="Random Legendary" />
  // The extras for particular classes, grouped by which classes get them.
  const extras = new Map<string, React.JSX.Element[]>()
  const addExtra = (classes: RunBossReward['randomPokemon'], chip: React.JSX.Element): void => {
    if (!Array.isArray(classes)) return
    const key = classes.map((c) => BOSS_CLASS_NAMES[c]).join(' & ')
    extras.set(key, [...(extras.get(key) ?? []), chip])
  }
  addExtra(reward.randomPokemon, randomPokemon)
  addExtra(reward.randomLegendary, randomLegendary)
  const crystals = reward.raidCrystals ? (
    <RewardChip
      spritenum={RAID_CRYSTAL_SPRITENUM}
      label={reward.raidCrystals.count > 1 ? `${reward.raidCrystals.count}× Raid Crystal` : 'Raid Crystal'}
    />
  ) : null
  if (reward.raidCrystals && crystals) addExtra(reward.raidCrystals.from, crystals)
  return (
    <div className="run-reward-groups">
      <div className="run-reward-group">
        <span className="run-reward-group-label">Every boss</span>
        <div className="run-reward-group-chips">
          {reward.randomLegendary === 'all' && randomLegendary}
          {reward.randomPokemon === 'all' && randomPokemon}
        {reward.raidCrystals?.from === 'all' && crystals}
          {candy && <RewardChip spritenum={candy.spritenum} label={candy.name} />}
          <RewardChip label={formatMoney(reward.money)} />
        </div>
      </div>
      {[...extras].map(([classes, chips]) => (
        <div key={classes} className="run-reward-group">
          <span className="run-reward-group-label">{classes}</span>
          <div className="run-reward-group-chips">{chips}</div>
        </div>
      ))}
    </div>
  )
}

// The copy a run starts with: the same Pokemon at Lv 5, holding nothing.
function starterPreview(mon: BoxPokemonView): BoxPokemonView {
  return { ...mon, level: ROGUELITE_START_LEVEL, item: '', itemSpritenum: null, expPercent: undefined, favorite: false }
}

function StarterSlot({ picked }: { picked: BoxPokemonView | undefined }): React.JSX.Element {
  const { setNodeRef, isOver } = useDroppable({ id: RUN_STARTER_SLOT_ID })
  const classes = [
    'team-slot',
    'run-starter-slot',
    picked && 'team-slot-filled',
    picked && `rarity-card rarity-tier-${picked.rarityTier ?? 'common'}`,
    isOver && 'team-slot-over'
  ]
    .filter(Boolean)
    .join(' ')
  const preview = picked ? starterPreview(picked) : null
  return (
    <div ref={setNodeRef} className={classes}>
      {preview ? (
        <Tooltip className="box-icon box-icon-fill" placement="below" content={<PokemonTooltipContent pokemon={preview} />}>
          <div className="box-icon-draggable">
            <PokemonIconVisual mon={preview} />
          </div>
        </Tooltip>
      ) : (
        <span className="team-slot-empty">Drop here</span>
      )}
    </div>
  )
}

interface RunMonCardProps {
  mon: RunMonView
  index: number
  onClick?: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  // Double-click: edit it.
  onEdit?: () => void
  selectable?: boolean
  // Its held item is the one being moved.
  moving?: boolean
}

function RunMonCard({ mon, index, onClick, onContextMenu, onEdit, selectable, moving }: RunMonCardProps): React.JSX.Element {
  const hpClass = mon.hpPercent > 50 ? 'hp-high' : mon.hpPercent > 20 ? 'hp-mid' : 'hp-low'
  // Drag it onto another card to move it there - the first one leads every battle.
  const drag = useDraggable({ id: `${RUN_MON_DRAG_PREFIX}${mon.id}` })
  const drop = useDroppable({ id: `${RUN_SLOT_DROP_PREFIX}${index}` })
  const { transform } = drag
  const tap = useTapGuard()
  return (
    <Tooltip className="run-mon-card-wrap" placement="above" content={<PokemonTooltipContent pokemon={mon} />}>
      <button
        type="button"
        ref={(node) => {
          drag.setNodeRef(node)
          drop.setNodeRef(node)
        }}
        {...drag.attributes}
        {...drag.listeners}
        style={
          {
            '--i': index,
            ...(transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 5 } : {})
          } as React.CSSProperties
        }
        className={`team-slot team-slot-filled run-mon-card rarity-card rarity-tier-${mon.rarityTier ?? 'common'}${selectable ? ' run-mon-card-selectable' : ''}${
          drop.isOver && !drag.isDragging ? ' team-slot-over' : ''
        }${drag.isDragging ? ' run-mon-card-dragging' : ''}${mon.hpPercent <= 0 ? ' run-mon-card-fainted' : ''}${moving ? ' run-mon-card-moving' : ''}`}
        // Not disabled even when there's nothing to click for - a disabled button gets no
        // right-clicks, and the context menu needs them. A left click only picks it as a
        // target when something is being given (a drag that ends where it began doesn't
        // count); right-click opens the menu, and a double-click edits it.
        onPointerDownCapture={tap.onPointerDownCapture}
        onClick={() => {
          if (tap.isTap() && selectable) onClick?.()
        }}
        onDoubleClick={() => {
          if (!selectable) onEdit?.()
        }}
        onContextMenu={onContextMenu}
      >
        <div className="box-icon box-icon-fill">
          <div className="box-icon-draggable">
            <PokemonIconVisual mon={{ ...mon, expPercent: undefined }} />
          </div>
        </div>
        {/* The first one leads every battle. */}
        {index === 0 && <span className="run-mon-lead">Lead</span>}
        <div className="run-mon-hp">
          <div className={`hp-bar-fill ${hpClass}`} style={{ width: `${mon.hpPercent}%` }} />
        </div>
        <div className="run-mon-meta">
          <span>Lv {mon.level}</span>
          <span className={`run-mon-hp-text ${hpClass}`}>{Math.round(mon.hpPercent)}%</span>
          {mon.status && (
            <span className={`status-badge status-${mon.status}`}>{statusLabel(mon.status)}</span>
          )}
        </div>
      </button>
    </Tooltip>
  )
}

// Roguelite mode's half of the main menu: picking a starter before a run, and the
// run itself - its floor, its team and what this floor offers.
function RoguelitePanel({
  run,
  picked,
  busy,
  bestFloor,
  onStart,
  onChoose,
  onGiveItem,
  onSkipItem,
  onGiveAbility,
  onTeachMove,
  onSkipPick,
  onRunUpdated,
  onRerollItems,
  onEvolve,
  onMoveItem,
  onPlaceDisplacedItem,
  onForfeit
}: Props): React.JSX.Element {
  const [confirmingForfeit, setConfirmingForfeit] = useState(false)
  // A New Ability / New Move floor: the choice made, then (for a move) who learns it.
  const [chosenPick, setChosenPick] = useState<string | null>(null)
  const [learner, setLearner] = useState<RunMonView | null>(null)
  // The run Pokemon open in the run's own moves editor.
  const [editingMonId, setEditingMonId] = useState<string | null>(null)
  // The next run's settings, picked beside the starter slot.
  const [difficulty, setDifficulty] = useState<RunDifficulty>('normal')
  const [generation, setGeneration] = useState<number | null>(null)
  // Generations with at least one boss of every class - the rest are greyed out.
  const [completeGenerations, setCompleteGenerations] = useState<number[]>([])
  const settingUp = !run || run.status !== 'active'

  useEffect(() => {
    if (!settingUp) return
    window.api
      .getRunGenerations()
      .then((complete) => {
        setCompleteGenerations(complete)
        setGeneration((current) => (current !== null && !complete.includes(current) ? null : current))
      })
      .catch(() => setCompleteGenerations([]))
  }, [settingUp])
  const [chosenItem, setChosenItem] = useState<string | null>(null)
  const [menu, setMenu] = useState<{ mon: RunMonView; x: number; y: number } | null>(null)
  // "Move item" from the context menu: whose item is being moved, until a new holder is clicked.
  const [movingFrom, setMovingFrom] = useState<RunMonView | null>(null)
  // A Random Swap floor: 'one' once "Swap one Pokémon" is picked (then a team member is
  // clicked); the whole-team swap asks for a second click first.
  const [swapMode, setSwapMode] = useState<'one' | null>(null)
  const [confirmingTeamSwap, setConfirmingTeamSwap] = useState(false)
  const [swapBusy, setSwapBusy] = useState(false)
  const [swapError, setSwapError] = useState<string | null>(null)
  // A consumable being used: Full Restore and Ability Capsule then take a click on a team
  // member (the capsule then its ability), Revive a pick from the fainted.
  const [using, setUsing] = useState<RunConsumableId | null>(null)
  const [capsuleMon, setCapsuleMon] = useState<RunMonView | null>(null)
  // A Revive with a full team: the fainted Pokemon picked, waiting for who leaves.
  const [reviving, setReviving] = useState<RunMonView | null>(null)
  // Buying Rare Candies in a boss shop: each click on a team member buys and uses one.
  const [candyMode, setCandyMode] = useState(false)
  // A villain's reward with a full team: the Pokemon picked (by place), waiting for who leaves.
  const [rewardPick, setRewardPick] = useState<number | null>(null)
  const [itemBusy, setItemBusy] = useState(false)
  const [itemError, setItemError] = useState<string | null>(null)

  // Gems just won pop up as "+N" over the gem counter for a moment.
  const gems = run?.status === 'active' ? run.consumables.gems : null
  const lastGems = useRef<number | null>(null)
  const [gemPop, setGemPop] = useState<{ amount: number; key: number } | null>(null)
  useEffect(() => {
    const before = lastGems.current
    lastGems.current = gems
    if (gems === null || before === null || gems <= before) return
    setGemPop({ amount: gems - before, key: Date.now() })
    const timer = window.setTimeout(() => setGemPop(null), 1600)
    return () => window.clearTimeout(timer)
  }, [gems])

  // Keys 1-9 pick the floor's options in order, and Escape backs out of whatever's being
  // picked (an item, a consumable, a move target...) - only while nothing else is open.
  const canPickFloor =
    !!run &&
    run.status === 'active' &&
    !run.swapOffer &&
    !run.monOffer &&
    !run.pickOffer &&
    !run.itemOffer &&
    !run.displacedItem &&
    !busy &&
    !editingMonId &&
    !menu
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return
      if (e.ctrlKey || e.altKey || e.metaKey) return
      if (e.key === 'Escape') {
        setUsing(null)
        setCapsuleMon(null)
        setReviving(null)
        setCandyMode(false)
        setMovingFrom(null)
        setChosenItem(null)
        setLearner(null)
        setChosenPick(null)
        setSwapMode(null)
        setRewardPick(null)
        return
      }
      if (!canPickFloor || !run) return
      const n = Number(e.key)
      if (Number.isInteger(n) && n >= 1 && n <= run.choices.length) {
        e.preventDefault()
        onChoose(n - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canPickFloor, run, onChoose])

  // On the setup screen: left/right step through the difficulties, Enter starts the run.
  useEffect(() => {
    if (!settingUp) return
    const onKey = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName))) {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
        if (target.tagName !== 'BUTTON') return
      }
      const ids = RUN_DIFFICULTIES.map((d) => d.id)
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        const step = e.key === 'ArrowLeft' ? -1 : 1
        setDifficulty((current) => ids[Math.min(ids.length - 1, Math.max(0, ids.indexOf(current) + step))])
      } else if (e.key === 'Enter' && picked && !busy) {
        e.preventDefault()
        onStart(difficulty, generation)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [settingUp, picked, busy, difficulty, generation, onStart])

  // Using a consumable or buying in the shop - the run as it stands afterwards.
  async function runItemAction(action: () => Promise<RunView>): Promise<void> {
    setItemBusy(true)
    setItemError(null)
    try {
      onRunUpdated(await action())
      setUsing(null)
      setCapsuleMon(null)
      setReviving(null)
      setRewardPick(null)
    } catch (e) {
      setItemError(e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']*': (?:Error: )?/, '') : String(e))
    } finally {
      setItemBusy(false)
    }
  }

  async function doSwap(action: () => Promise<RunView>): Promise<void> {
    setSwapBusy(true)
    setSwapError(null)
    try {
      onRunUpdated(await action())
      setSwapMode(null)
      setConfirmingTeamSwap(false)
    } catch (e) {
      setSwapError(e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']*': (?:Error: )?/, '') : String(e))
    } finally {
      setSwapBusy(false)
    }
  }

  if (!run || run.status !== 'active') {
    const info = runDifficultyInfo(difficulty)
    return (
      <div className="run-panel run-setup">
        {/* The last run in one line: how it ended, then its rewards as icons (names on hover). */}
        {run && (
          <div className={`run-result ${run.status === 'won' ? 'run-result-won' : 'run-result-lost'}`}>
            <span className="run-result-title">{run.status === 'won' ? '🏆 Won' : 'Run over'}</span>
            <span className="run-result-summary">
              {run.starterSpecies} · {runDifficultyInfo(run.difficulty).label} ·{' '}
              {run.status === 'won' ? `all ${runBossCount(run.difficulty)} bosses` : `floor ${run.floor}, ${run.bossesBeaten}/${runBossCount(run.difficulty)} bosses`}
            </span>
            {run.rewards.length > 0 ? (
              <span className="run-reward-list" title="Sent to your bag">
                {run.rewards.map((line, i) => (
                  <span
                    key={line.label}
                    className="run-reward-line"
                    style={{ '--i': i } as React.CSSProperties}
                    title={line.itemId ? `${line.quantity}× ${line.label}` : line.label}
                  >
                    {line.spritenum !== null ? (
                      <>
                        <ItemSprite spritenum={line.spritenum} />
                        {line.itemId && line.quantity > 1 ? `×${line.quantity}` : ''}
                      </>
                    ) : (
                      line.label
                    )}
                  </span>
                ))}
              </span>
            ) : (
              <span className="run-result-none">No rewards</span>
            )}
          </div>
        )}
        <div className={`run-setup-card run-hud-${difficulty}`}>
          <div className="run-starter-row">
            {/* The starter on its pedestal, its name, and the start button under it. */}
            <div className="run-starter-column">
              <span className="run-hud-label">Starter</span>
              <div
                className={`run-starter-pedestal${picked ? ' run-starter-pedestal-filled' : ''}`}
                title={`The run uses a Lv ${ROGUELITE_START_LEVEL} copy (no held item, fresh moveset) - the original stays as it is.`}
              >
                <StarterSlot picked={picked} />
              </div>
              <span className="run-starter-name">{picked ? `${picked.species} · Lv ${ROGUELITE_START_LEVEL}` : 'Drag a Pokémon here'}</span>
              <button
                className={`run-start-button${picked ? ' run-start-ready' : ''}`}
                disabled={busy || !picked}
                title="Enter starts the run, ← → change the difficulty"
                onClick={() => onStart(difficulty, generation)}
              >
                {picked ? `Start ${info.label}` : 'Pick a starter'}
              </button>
            </div>
            <div className="run-settings">
              <div className="run-setup-header">
                <span className="run-hud-label">Difficulty</span>
                {bestFloor ? (
                  <span className={`run-setup-best${bestFloor.difficulty ? ` run-difficulty-${bestFloor.difficulty}` : ''}`}>
                    Best floor: {bestFloor.floor}
                    {bestFloor.difficulty ? ` · ${runDifficultyInfo(bestFloor.difficulty).label}` : ''}
                  </span>
                ) : null}
              </div>
              <div className="run-difficulty-row">
                {RUN_DIFFICULTIES.map((d, i) => (
                  <button
                    key={d.id}
                    className={`run-difficulty-button run-difficulty-${d.id}${difficulty === d.id ? ' run-difficulty-selected' : ''}`}
                    style={{ '--i': i } as React.CSSProperties}
                    title={`${d.gymLeaders} Gym Leaders and ${d.eliteFour} Elite Four before the Champion`}
                    onClick={() => setDifficulty(d.id)}
                  >
                    <span className="run-difficulty-name">{d.label}</span>
                    {/* One pip per step up in difficulty. */}
                    <span className="run-difficulty-pips">
                      {RUN_DIFFICULTIES.map((_, p) => (
                        <span key={p} className={p <= i ? 'run-pip-on' : ''} />
                      ))}
                    </span>
                    <span className="run-difficulty-sub">{runFinalFloor(d.id)} floors</span>
                  </button>
                ))}
              </div>
              {/* Always the same height (scrolling if a difficulty says more), so switching
                  never moves the box below. Keyed on the difficulty to fade in again. */}
              <div className="run-difficulty-details" key={difficulty}>
                <p className="run-difficulty-text">{info.rules}</p>
                <span className="run-hud-label">Rewards for each boss beaten</span>
                <RunRewardChips reward={info.reward} />
              </div>
              {/* Where the bosses come from: any generation, or one with a full set of bosses. */}
              <div className="run-generation-row">
                <span className="run-hud-label">Generation:</span>
                <div className="run-generation-chips">
                  <button
                    className={`run-generation-chip run-generation-any${generation === null ? ' run-generation-chosen' : ''}`}
                    onClick={() => setGeneration(null)}
                  >
                    Any
                  </button>
                  {POKEMON_GENERATIONS.map((g) => {
                    const complete = completeGenerations.includes(g)
                    return (
                      <button
                        key={g}
                        className={`run-generation-chip${generation === g ? ' run-generation-chosen' : ''}`}
                        disabled={!complete}
                        title={complete ? `Generation ${g} bosses only` : `Generation ${g} - coming soon`}
                        onClick={() => setGeneration(g)}
                      >
                        {g}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const offer = run.itemOffer
  const displaced = run.displacedItem
  const pick = run.pickOffer
  const pickName = pick?.options.find((o) => o.id === chosenPick)?.name
  // What clicking a team member does right now, if anything.
  const pickTarget = (mon: RunMonView): (() => void) | null => {
    if (busy || swapBusy || itemBusy) return null
    // A villain's reward Pokemon picked with a full team: whoever's clicked makes room.
    if (run.monOffer && rewardPick !== null) {
      return () => void runItemAction(() => window.api.takeRunRewardMon(rewardPick, mon.id))
    }
    if (candyMode && run.consumables.bossShop) {
      return mon.level < 100 && run.consumables.gems >= RUN_RARE_CANDY_PRICE
        ? () => void runItemAction(() => window.api.buyRunRareCandy(mon.id))
        : null
    }
    if (using === 'fullrestore') {
      return mon.hpPercent < 100 || mon.status ? () => void runItemAction(() => window.api.useRunFullRestore(mon.id)) : null
    }
    if (using === 'abilitycapsule') return () => setCapsuleMon(mon)
    if (using) return null
    if (run.swapOffer && swapMode === 'one') return () => void doSwap(() => window.api.swapRunMon(mon.id))
    if (offer && chosenItem) {
      return () => {
        onGiveItem(chosenItem, mon.id)
        setChosenItem(null)
      }
    }
    if (displaced && mon.id !== displaced.fromMonId) return () => onPlaceDisplacedItem(mon.id)
    if (pick && chosenPick && !learner) {
      if (pick.kind === 'ability') {
        return () => {
          onGiveAbility(chosenPick, mon.id)
          setChosenPick(null)
        }
      }
      // Can't teach a move it already knows.
      if (mon.moveList.some((m) => m.id === chosenPick)) return null
      return () => setLearner(mon)
    }
    // Moving an item: clicking the Pokemon it comes from again calls it off.
    if (movingFrom && mon.id === movingFrom.id) return () => setMovingFrom(null)
    if (movingFrom) {
      return () => {
        onMoveItem(movingFrom.id, mon.id)
        setMovingFrom(null)
      }
    }
    return null
  }
  const displacedFrom = displaced ? run.team.find((m) => m.id === displaced.fromMonId) : undefined
  const shop = run.consumables.bossShop
  // One of the floor's options as a tile.
  const takeover = run.takeover
  const choiceTile = (choice: RunChoice, index: number): React.JSX.Element => {
    const location = choice.kind === 'wild' ? locationOf(choice) : undefined
    const villain = choice.kind === 'villain' && takeover
    // On a taken-over floor every other tile is corrupted: it costs gems to take.
    const corrupted = !!takeover && choice.kind !== 'villain'
    const cost = takeover?.tileCost ?? 0
    return (
      <button
        key={index}
        className={`big-battle-button run-node-button run-node-${choice.kind}${location?.id === 'lab' ? ' run-node-lab' : ''}${location ? ' run-node-located' : ''}${corrupted ? ' run-node-corrupted' : ''}`}
        style={
          {
            '--i': index,
            ...(location ? { backgroundImage: `url(${backdropUrl(LOCATION_BUTTON_BACKDROP[location.id])})` } : {})
          } as React.CSSProperties
        }
        disabled={busy}
        title={
          corrupted
            ? `${NODE_INFO[choice.kind].hint} - corrupted: costs ${cost} gem${cost === 1 ? '' : 's'}`
            : villain
              ? `${villain.classLabel} ${villain.villainName}: ${NODE_INFO.villain.hint}`
              : NODE_INFO[choice.kind].hint
        }
        onClick={() => onChoose(index)}
      >
        {/* The number key that picks it. */}
        <span className="run-node-key">{index + 1}</span>
        {corrupted && <span className="run-node-cost">{gemPrice(cost)}</span>}
        <NodeIcon choice={choice} villainSprite={takeover?.spriteId} />
        <span className="run-node-label">
          {location
            ? location.label
            : choice.kind === 'boss'
              ? run.nextBossLabel
              : villain
                ? villain.villainName
                : NODE_INFO[choice.kind].label}
        </span>
        <span className="run-node-sub">
          {location ? 'Wild Pokémon' : villain ? `${villain.classLabel} · ${NODE_INFO.villain.short}` : NODE_INFO[choice.kind].short}
        </span>
      </button>
    )
  }
  return (
    <div className="run-panel">
      {/* The run's HUD: where it is, what's next and what it has to spend. */}
      <div className={`run-hud run-hud-${run.difficulty}`}>
        <div className="run-hud-floor">
          <span className="run-hud-label">Floor</span>
          <span className="run-hud-big" key={run.floor}>
            {run.floor}
            <small>/{runFinalFloor(run.difficulty)}</small>
          </span>
        </div>
        <div className="run-hud-stats">
          <span className="run-hud-stat">
            <span className="run-hud-label">Bosses</span>
            <strong>
              {run.bossesBeaten}/{runBossCount(run.difficulty)}
            </strong>
          </span>
          <span className="run-hud-stat">
            <span className="run-hud-label">Next boss</span>
            <strong>{run.nextBossLabel}</strong>
          </span>
          <span className="run-hud-stat">
            <span className="run-hud-label">Opponents</span>
            <strong>Lv {run.opponentLevel}</strong>
          </span>
          <span className="run-hud-stat">
            <span className="run-hud-label">Level cap</span>
            <strong>Lv {run.levelCap}</strong>
          </span>
        </div>
        <span className={`run-difficulty-tag run-difficulty-${run.difficulty}`}>
          {runDifficultyInfo(run.difficulty).label}
          {run.generation ? ` · Gen ${run.generation}` : ''}
        </span>
        <span
          className="run-gems run-hud-gems"
          title={`Gems: 1 per trainer, 2 per boss${run.difficulty === 'easy' ? ' (+1 each on Easy)' : ''} - spend them in the shop on boss floors`}
        >
          <GemIcon />
          <strong key={run.consumables.gems}>{run.consumables.gems}</strong>
          {gemPop && (
            <span key={gemPop.key} className="run-gem-pop">
              +{gemPop.amount}
            </span>
          )}
        </span>
        <button
          className={`run-forfeit-button${confirmingForfeit ? ' confirm-button' : ''}`}
          disabled={busy}
          onClick={() => {
            if (!confirmingForfeit) setConfirmingForfeit(true)
            else {
              setConfirmingForfeit(false)
              onForfeit()
            }
          }}
          onBlur={() => setConfirmingForfeit(false)}
        >
          {confirmingForfeit ? 'Give up the run? Click again' : 'Forfeit'}
        </button>
      </div>
      <RunProgressBar floor={run.floor} difficulty={run.difficulty} />

      {run.monOffer ? (
        // A beaten villain's reward: one of three Pokemon, each holding an item.
        <div className="run-item-offer">
          <p className="run-reward-heading">Villain defeated!</p>
          <p className="box-empty-hint">
            {rewardPick !== null
              ? `Your team is full - click the Pokémon ${run.monOffer[rewardPick]?.species ?? 'it'} replaces (its held item then needs a new holder).`
              : 'Pick one Pokémon to join your team, held item and all.'}
          </p>
          <div className="run-item-row run-reward-mons">
            {run.monOffer.map((mon, i) => (
              <Tooltip key={mon.id} placement="below" content={<PokemonTooltipContent pokemon={mon} />}>
                <button
                  className={`run-revive-card run-reward-mon rarity-card rarity-tier-${mon.rarityTier ?? 'common'}${rewardPick === i ? ' run-reward-mon-chosen' : ''}`}
                  style={{ '--i': i } as React.CSSProperties}
                  disabled={busy || itemBusy}
                  onClick={() => {
                    if (run.team.length < ROGUELITE_MAX_TEAM) void runItemAction(() => window.api.takeRunRewardMon(i))
                    else setRewardPick(rewardPick === i ? null : i)
                  }}
                >
                  <div className="run-revive-sprite rarity-glow" title={mon.item || undefined}>
                    <SpriteImage
                      style="3d-static"
                      className="run-revive-img"
                      spriteId={toSpriteId(mon.species)}
                      shiny={mon.shiny}
                      gmax={mon.gmaxLook}
                      alt={mon.species}
                      draggable={false}
                    />
                    {mon.itemSpritenum != null && <ItemSprite spritenum={mon.itemSpritenum} className="run-revive-item" />}
                  </div>
                  <FitName className="run-revive-name" text={mon.species} />
                  <span className="run-revive-ability">{mon.item || mon.ability}</span>
                  <span className="run-revive-level">Lv {mon.level}</span>
                </button>
              </Tooltip>
            ))}
          </div>
          <div className="run-item-row">
            {rewardPick !== null && (
              <button className="run-item-button run-item-skip" disabled={busy || itemBusy} onClick={() => setRewardPick(null)}>
                Back
              </button>
            )}
            <button
              className="run-item-button run-item-skip"
              disabled={busy || itemBusy}
              onClick={() => void runItemAction(() => window.api.skipRunRewardMon())}
            >
              Skip
            </button>
          </div>
        </div>
      ) : run.swapOffer ? (
        <div className="run-item-offer">
          <p className="run-reward-heading">Random Swap</p>
          <p className="box-empty-hint">
            {swapMode === 'one'
              ? 'Now click the Pokémon to swap away - its replacement takes over its held item and its New Ability / New Move picks.'
              : `Swapped-in Pokémon are completely random, at Lv ${run.swapLevel}, and take over the held items and New Ability / New Move picks of the ones they replace. Each has a 10% chance to be a legendary - and swapping the whole team has a 5% chance to be all restricted legendaries.`}
          </p>
          <div className="run-item-row">
            <button
              className={`run-item-button${swapMode === 'one' ? ' run-item-button-chosen' : ''}`}
              disabled={busy || swapBusy}
              onClick={() => {
                setConfirmingTeamSwap(false)
                setSwapMode(swapMode === 'one' ? null : 'one')
              }}
            >
              Swap one Pokémon
            </button>
            <button
              className={`run-item-button${confirmingTeamSwap ? ' confirm-button' : ''}`}
              disabled={busy || swapBusy}
              onClick={() => {
                setSwapMode(null)
                if (!confirmingTeamSwap) setConfirmingTeamSwap(true)
                else void doSwap(() => window.api.swapRunTeam())
              }}
              onBlur={() => setConfirmingTeamSwap(false)}
            >
              {confirmingTeamSwap ? 'Swap all of them? Click again' : 'Swap the whole team'}
            </button>
            <button
              className="run-item-button run-item-skip"
              disabled={busy || swapBusy}
              onClick={() => void doSwap(() => window.api.skipRunSwap())}
            >
              Skip
            </button>
          </div>
          {swapError && <p className="editor-error">{swapError}</p>}
        </div>
      ) : pick ? (
        <div className="run-item-offer">
          <p className="run-reward-heading">
            {run.pickReason === 'reward'
              ? 'Victory reward!'
              : run.pickReason === 'bonus'
                ? `Title bonus: a free ${pick.kind === 'ability' ? 'ability' : 'move'}!`
                : pick.kind === 'ability'
                  ? 'New Ability'
                  : 'New Move'}
          </p>
          {learner && chosenPick ? (
            <>
              <p className="box-empty-hint">
                Which of {learner.species}&apos;s moves should {pickName} replace? (It stays locked in when moves update.)
              </p>
              <div className="run-item-row">
                {learner.moveList.map((move) => (
                  <button
                    key={move.id}
                    className="run-item-button"
                    disabled={busy}
                    onClick={() => {
                      onTeachMove(chosenPick, learner.id, move.id)
                      setChosenPick(null)
                      setLearner(null)
                    }}
                  >
                    {move.locked && '🔒 '}
                    {move.name}
                  </button>
                ))}
                {learner.moveList.length < 4 && (
                  <button
                    className="run-item-button"
                    disabled={busy}
                    onClick={() => {
                      onTeachMove(chosenPick, learner.id, null)
                      setChosenPick(null)
                      setLearner(null)
                    }}
                  >
                    Add as a new move
                  </button>
                )}
                <button className="run-item-button run-item-skip" onClick={() => setLearner(null)}>
                  Back
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="box-empty-hint">
                {chosenPick
                  ? `Now click the Pokémon to ${pick.kind === 'ability' ? 'give' : 'teach'} ${pickName} to.`
                  : `Pick one ${pick.kind === 'ability' ? 'ability' : 'move'}.`}
              </p>
              <div className="run-item-row">
                {pick.options.map((option) => (
                  <Tooltip
                    key={option.id}
                    placement="below"
                    content={
                      <div className="tooltip-panel">
                        <div className="tooltip-title">{option.name}</div>
                        {option.type && (
                          <div className="tooltip-row">
                            <span className={`type-badge type-${option.type.toLowerCase()}`}>{option.type}</span>
                            <span className="tooltip-category">{option.category}</span>
                            {!!option.basePower && <span>Power: {option.basePower}</span>}
                          </div>
                        )}
                        {option.description && <div className="tooltip-desc">{option.description}</div>}
                      </div>
                    }
                  >
                    <button
                      className={`run-item-button${chosenPick === option.id ? ' run-item-button-chosen' : ''}`}
                      disabled={busy}
                      onClick={() => setChosenPick(option.id)}
                    >
                      {option.type && <span className={`type-badge type-${option.type.toLowerCase()}`}>{option.type}</span>}
                      <span>{option.name}</span>
                    </button>
                  </Tooltip>
                ))}
                <button
                  className="run-item-button run-item-skip"
                  disabled={busy}
                  onClick={() => {
                    setChosenPick(null)
                    onSkipPick()
                  }}
                >
                  Skip
                </button>
              </div>
            </>
          )}
        </div>
      ) : offer ? (
        <div className="run-item-offer">
          {run.itemOfferReason === 'reward' && <p className="run-reward-heading">Victory reward!</p>}
          {run.itemOfferReason === 'bonus' && <p className="run-reward-heading">Title bonus: a free item!</p>}
          {run.itemOfferReason === 'shop' && <p className="run-reward-heading">New Item</p>}
          <p className="box-empty-hint">
            {chosenItem ? 'Now click the Pokémon to give it to (it replaces what it holds).' : 'Pick one item.'}
          </p>
          <div className="run-item-row">
            {offer.map((item) => (
              <Tooltip
                key={item.itemId}
                placement="below"
                content={
                  <div className="tooltip-panel">
                    <div className="tooltip-title">{item.itemName}</div>
                    {item.description && <div className="tooltip-desc">{item.description}</div>}
                  </div>
                }
              >
                <button
                  className={`run-item-button${chosenItem === item.itemId ? ' run-item-button-chosen' : ''}`}
                  disabled={busy}
                  onClick={() => setChosenItem(item.itemId)}
                >
                  <ItemSprite spritenum={item.spritenum} />
                  <span>{item.itemName}</span>
                </button>
              </Tooltip>
            ))}
            {run.canRerollItems && (
              <button
                className="run-item-button run-item-skip"
                disabled={busy}
                title="Roll three new items - once per floor"
                onClick={() => {
                  setChosenItem(null)
                  onRerollItems()
                }}
              >
                🎲 Reroll
              </button>
            )}
            <button
              className="run-item-button run-item-skip"
              disabled={busy}
              onClick={() => {
                setChosenItem(null)
                onSkipItem()
              }}
            >
              Skip
            </button>
          </div>
        </div>
      ) : displaced ? (
        <div className="run-item-offer">
          <p className="run-reward-heading">
            <ItemSprite spritenum={displaced.spritenum} /> {displacedFrom?.species ?? 'Your Pokémon'}&apos;s old{' '}
            {displaced.itemName}
          </p>
          <p className="box-empty-hint">
            Click the Pokémon to give it to (if it holds something, that one needs a new holder next).
          </p>
          <div className="run-item-row">
            <button className="run-item-button run-item-skip" disabled={busy} onClick={() => onPlaceDisplacedItem(null)}>
              Skip (let it go)
            </button>
          </div>
        </div>
      ) : shop ? (
        // A boss floor: the shop's items on the left, the boss in the middle and the shop's
        // picks on the right - tiles like a normal floor's.
        <div className="run-boss-floor">
          <div className="run-boss-shop-items">
            <p className="run-reward-heading">
              Shop <span className="run-shop-balance">You have <GemIcon />{run.consumables.gems}</span>
            </p>
            {RUN_CONSUMABLES.map((c) => {
              const locked = run.consumables.locked.includes(c.id)
              return (
                <Tooltip
                  key={c.id}
                  placement="below"
                  content={
                    <div className="tooltip-panel">
                      <div className="tooltip-title">{c.name}</div>
                      <div className="tooltip-desc">{locked ? `Not on ${runDifficultyInfo(run.difficulty).label}.` : c.description}</div>
                    </div>
                  }
                >
                  <button
                    className="run-item-button run-shop-button"
                    disabled={busy || itemBusy || locked || run.consumables.gems < RUN_CONSUMABLE_PRICES[c.id]}
                    onClick={() => void runItemAction(() => window.api.buyRunConsumable(c.id))}
                  >
                    <img className="run-consumable-icon" src={c.icon} alt="" />
                    <span>{c.name}</span>
                    {gemPrice(RUN_CONSUMABLE_PRICES[c.id])}
                  </button>
                </Tooltip>
              )
            })}
            <Tooltip
              placement="below"
              content={
                <div className="tooltip-panel">
                  <div className="tooltip-title">Rare Candy</div>
                  <div className="tooltip-desc">
                    Used right away: pick a Pokémon to raise by one level - it can go past the level cap.
                  </div>
                </div>
              }
            >
              <button
                className={`run-item-button run-shop-button${candyMode ? ' run-shop-button-chosen' : ''}`}
                disabled={busy || itemBusy || (!candyMode && run.consumables.gems < RUN_RARE_CANDY_PRICE)}
                onClick={() => {
                  setItemError(null)
                  setUsing(null)
                  setCandyMode((on) => !on)
                }}
              >
                <img className="run-consumable-icon" src={RUN_RARE_CANDY_ICON} alt="" />
                <span>Rare Candy</span>
                {gemPrice(RUN_RARE_CANDY_PRICE)}
              </button>
            </Tooltip>
          </div>
          <div className="run-choice-grid" key={run.floor}>
            {run.choices.map(choiceTile)}
          </div>
          <div className="run-choice-grid run-boss-shop-tiles">
            {SHOP_TILES.map((tile, i) => {
              const used = shop.usedTiles.includes(tile)
              const price = RUN_SHOP_TILE_PRICES[tile]
              return (
                <button
                  key={tile}
                  className={`big-battle-button run-node-button run-node-${tile}${used ? ' run-node-bought' : ''}`}
                  style={{ '--i': i + run.choices.length } as React.CSSProperties}
                  disabled={busy || itemBusy || used || run.consumables.gems < price}
                  title={used ? 'Already bought on this floor' : NODE_INFO[tile].hint}
                  onClick={() => void runItemAction(() => window.api.buyRunShopTile(tile))}
                >
                  <NodeIcon choice={{ kind: tile }} />
                  <span className="run-node-label">{SHOP_TILE_LABELS[tile]}</span>
                  {used ? <span className="run-node-sub">Bought</span> : gemPrice(price)}
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        <div className={`run-floor-pick${takeover ? ' run-floor-takeover' : ''}`}>
          {takeover ? (
            // A Villain Takeover: who took the floor over, and what the corrupted tiles cost.
            <p className="run-floor-title run-takeover-title">
              <span className="run-takeover-name">Villain Takeover!</span>
              <span className="run-takeover-sub">
                {takeover.classLabel} {takeover.villainName} corrupted this floor -{' '}
                {takeover.tileCost > 0 ? (
                  <>every other path costs {gemPrice(takeover.tileCost)}</>
                ) : (
                  'with no gems, every path is free'
                )}
              </span>
            </p>
          ) : (
            <p className="run-floor-title">
              {run.choices.length === 1 && run.choices[0].kind === 'boss' ? 'A boss blocks the way' : 'Choose your path'}
            </p>
          )}
          {/* Keyed on the floor, so the tiles deal themselves in again each new floor. */}
          <div className="run-choice-grid" key={run.floor}>
            {run.choices.map(choiceTile)}
          </div>
        </div>
      )}

      <h2 className="options-heading run-team-heading">
        Run Team <span className="run-team-count">{run.team.length}/{ROGUELITE_MAX_TEAM}</span>
      </h2>
      <div className="team-row run-team-row">
        {run.team.map((mon, index) => {
          const target = pickTarget(mon)
          return (
            <RunMonCard
              key={mon.id}
              mon={mon}
              index={index}
              selectable={!!target}
              moving={movingFrom?.id === mon.id}
              onContextMenu={(e) => {
                e.preventDefault()
                if (!busy) setMenu({ mon, x: e.clientX, y: e.clientY })
              }}
              onEdit={() => {
                if (!busy) setEditingMonId(mon.id)
              }}
              onClick={() => target?.()}
            />
          )
        })}
      </div>
      <div className="run-consumables">
        <span className="run-hud-label run-consumables-label">Bag</span>
        {RUN_CONSUMABLES.map((c) => {
          const count = run.consumables.counts[c.id]
          const locked = run.consumables.locked.includes(c.id)
          return (
            <Tooltip
              key={c.id}
              placement="below"
              content={
                <div className="tooltip-panel">
                  <div className="tooltip-title">{c.name}</div>
                  <div className="tooltip-desc">
                    {locked ? `Not on ${runDifficultyInfo(run.difficulty).label} - there's no healing.` : c.description}
                  </div>
                </div>
              }
            >
              <button
                className={`run-consumable${using === c.id ? ' run-consumable-chosen' : ''}`}
                disabled={busy || itemBusy || locked || count < 1}
                onClick={() => {
                  setItemError(null)
                  setCapsuleMon(null)
                  setReviving(null)
                  setCandyMode(false)
                  setUsing(using === c.id ? null : c.id)
                }}
              >
                <img className="run-consumable-icon" src={c.icon} alt={c.name} />
                <span className="run-consumable-count">×{count}</span>
              </button>
            </Tooltip>
          )
        })}
      </div>
      {itemError && <p className="editor-error">{itemError}</p>}

      {using === 'revive' &&
        createPortal(
          // A Revive: pick who comes back, then - with a full team - who leaves to make room.
          <div
            className="modal-overlay run-revive-overlay"
            onMouseDown={() => {
              setUsing(null)
              setReviving(null)
            }}
          >
            <div className="modal-panel run-revive-modal" onMouseDown={(e) => e.stopPropagation()}>
              <div className="run-revive-header">
                <img className="run-revive-icon" src={RUN_CONSUMABLES.find((c) => c.id === 'revive')?.icon} alt="" />
                <div>
                  <h2>{reviving ? `Make room for ${reviving.species}` : 'Revive'}</h2>
                  <p className="run-revive-sub">
                    {run.consumables.fainted.length === 0
                      ? 'Nobody has fainted this run.'
                      : reviving
                        ? 'Your team is full - pick who leaves. They join the fainted, and can be revived later.'
                        : `Comes back at half HP, at Lv ${run.consumables.reviveLevel}.${
                            run.team.length >= ROGUELITE_MAX_TEAM ? ' Your team is full, so someone will leave to make room.' : ''
                          }`}
                  </p>
                </div>
              </div>
              {/* Keyed on the step, so the cards deal in again when it changes. */}
              <div className="run-revive-grid" key={reviving ? 'leave' : 'pick'}>
                {(reviving ? run.team : run.consumables.fainted).map((mon, i) => (
                  <button
                    key={mon.id}
                    className={`run-revive-card rarity-card rarity-tier-${mon.rarityTier ?? 'common'}${reviving ? ' run-revive-card-leave' : ''}`}
                    style={{ '--i': i } as React.CSSProperties}
                    disabled={busy || itemBusy}
                    onClick={() => {
                      if (reviving) void runItemAction(() => window.api.useRunRevive(reviving.id, mon.id))
                      else if (run.team.length >= ROGUELITE_MAX_TEAM) setReviving(mon)
                      else void runItemAction(() => window.api.useRunRevive(mon.id))
                    }}
                  >
                    {/* The sprite with its held item tucked in the corner, then name and ability. */}
                    <div className="run-revive-sprite rarity-glow" title={mon.item || undefined}>
                      <SpriteImage
                        style="3d-static"
                        className="run-revive-img"
                        spriteId={toSpriteId(mon.species)}
                        shiny={mon.shiny}
                        gmax={mon.gmaxLook}
                        alt={mon.species}
                        draggable={false}
                      />
                      {mon.itemSpritenum != null && <ItemSprite spritenum={mon.itemSpritenum} className="run-revive-item" />}
                    </div>
                    <FitName className="run-revive-name" text={mon.species} />
                    <span className="run-revive-ability">{mon.ability}</span>
                    <span className="run-revive-level">
                      {reviving ? (
                        `Lv ${mon.level}`
                      ) : (
                        <>
                          Lv {mon.level} → <strong>{run.consumables.reviveLevel}</strong>
                        </>
                      )}
                    </span>
                  </button>
                ))}
              </div>
              {itemError && <p className="editor-error">{itemError}</p>}
              <div className="editor-actions run-revive-actions">
                {reviving && (
                  <button className="run-item-button run-item-skip" onClick={() => setReviving(null)}>
                    Back
                  </button>
                )}
                <button
                  className="run-item-button run-item-skip"
                  onClick={() => {
                    setUsing(null)
                    setReviving(null)
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {using === 'abilitycapsule' && capsuleMon && (
        <div className="run-item-offer">
          <p className="box-empty-hint">
            Which ability should {capsuleMon.species} have?
            {capsuleMon.abilityLocked ? ' (It replaces the ability from its New Ability pick.)' : ''}
          </p>
          <div className="run-item-row">
            {capsuleMon.abilityChoices.map((a) => {
              const current = a.name === capsuleMon.ability
              return (
                <Tooltip
                  key={a.id}
                  placement="below"
                  content={
                    <div className="tooltip-panel">
                      <div className="tooltip-title">{a.name}</div>
                      <div className="tooltip-desc">{a.description}</div>
                    </div>
                  }
                >
                  <button
                    className="run-item-button"
                    disabled={busy || itemBusy || current}
                    onClick={() => void runItemAction(() => window.api.useRunAbilityCapsule(capsuleMon.id, a.id))}
                  >
                    {a.name}
                    {current && <span className="run-shop-price">Current</span>}
                  </button>
                </Tooltip>
              )
            })}
            <button className="run-item-button run-item-skip" onClick={() => setCapsuleMon(null)}>
              Back
            </button>
          </div>
        </div>
      )}

      {editingMonId && (
        <RunMonEditor
          runMonId={editingMonId}
          mon={run.team.find((m) => m.id === editingMonId)}
          onClose={() => setEditingMonId(null)}
          onSaved={onRunUpdated}
        />
      )}

      {menu && (
        <RunMonContextMenu
          x={menu.x}
          y={menu.y}
          species={menu.mon.species}
          evolutions={menu.mon.eligibleEvolutions ?? []}
          registeredEvolutions={menu.mon.registeredEvolutions}
          heldItem={menu.mon.item || null}
          heldItemSpritenum={menu.mon.itemSpritenum ?? null}
          onMoveItem={() => {
            setMenu(null)
            setMovingFrom(menu.mon)
          }}
          onEdit={() => {
            setMenu(null)
            setEditingMonId(menu.mon.id)
          }}
          onEvolve={(target) => {
            setMenu(null)
            onEvolve(menu.mon.id, target)
          }}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  )
}

export default RoguelitePanel
