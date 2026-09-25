import { useEffect, useState } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import type { BoxPokemonView, RunChoice, RunDifficulty, RunMonView, RunNodeKind, RunView } from '../../shared/battle-types'
import {
  POKEMON_GENERATIONS,
  ROGUELITE_BOSS_COUNT,
  ROGUELITE_FINAL_FLOOR,
  ROGUELITE_START_LEVEL,
  RUN_DIFFICULTIES,
  WILD_LOCATIONS,
  runDifficultyInfo
} from '../../shared/battle-types'
import PokemonIconVisual from './PokemonIconVisual'
import PokemonTooltipContent from './PokemonTooltipContent'
import Tooltip from './Tooltip'
import ItemSprite from './ItemSprite'
import RunMonContextMenu from './RunMonContextMenu'
import { trainerSpriteUrl } from './trainerSprite'

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
  bestFloor: number | null
  onStart: (difficulty: RunDifficulty, generation: number | null) => void
  // A floor option, by its place in run.choices.
  onChoose: (index: number) => void
  onGiveItem: (itemId: string, runMonId: string) => void
  onSkipItem: () => void
  onRerollItems: () => void
  onEvolve: (runMonId: string, targetSpecies: string) => void
  onRelearnMoves: (runMonId: string) => void
  onMoveItem: (fromMonId: string, toMonId: string) => void
  // The item a new one replaced: give it to this Pokemon, or let it go (null).
  onPlaceDisplacedItem: (runMonId: string | null) => void
  onForfeit: () => void
}

// Badly poisoned reads as PSN, the same as the battle screen shows it.
const statusLabel = (status: string): string => (status === 'tox' ? 'PSN' : status.toUpperCase())

const NODE_INFO: Record<RunNodeKind, { label: string; hint: string }> = {
  wild: { label: 'Wild Pokémon', hint: 'Beat it and you can catch it for your run' },
  trainer: { label: 'Trainer', hint: 'A trainer battle, sized for this floor - win it for a held item and extra exp' },
  item: { label: 'Item', hint: 'Pick a held item for one of your Pokémon' },
  heal: { label: 'Rest', hint: 'Your whole team back to full HP, no status' },
  boss: { label: 'Boss', hint: 'A boss battle - win it to heal up and move on' }
}

// Where a wild option is - its location's entry, or none for an older run's "anywhere".
const locationOf = (choice: RunChoice): (typeof WILD_LOCATIONS)[number] | undefined =>
  WILD_LOCATIONS.find((l) => l.id === choice.location)

function NodeIcon({ choice }: { choice: RunChoice }): React.JSX.Element {
  const { kind } = choice
  if (kind === 'wild') {
    const location = locationOf(choice)
    if (location) return <span className="run-node-emoji">{location.icon}</span>
    return <img className="big-battle-icon" src="./icons/tall-grass.png" alt="" />
  }
  if (kind === 'trainer') return <img className="big-battle-icon" src={trainerSpriteUrl('youngster')} alt="" />
  // Who the boss is stays a surprise until the fight starts.
  if (kind === 'boss') return <img className="big-battle-icon run-boss-silhouette" src={trainerSpriteUrl('giovanni')} alt="" />
  return <span className="run-node-emoji">{kind === 'heal' ? '❤️' : '🎁'}</span>
}

// The copy a run starts with: the same Pokemon at Lv 5, holding nothing.
function starterPreview(mon: BoxPokemonView): BoxPokemonView {
  return { ...mon, level: ROGUELITE_START_LEVEL, item: '', itemSpritenum: null, expPercent: undefined, favorite: false }
}

function StarterSlot({ picked }: { picked: BoxPokemonView | undefined }): React.JSX.Element {
  const { setNodeRef, isOver } = useDroppable({ id: RUN_STARTER_SLOT_ID })
  const classes = ['team-slot', 'run-starter-slot', picked && 'team-slot-filled', isOver && 'team-slot-over']
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
  selectable?: boolean
}

function RunMonCard({ mon, index, onClick, onContextMenu, selectable }: RunMonCardProps): React.JSX.Element {
  const hpClass = mon.hpPercent > 50 ? 'hp-high' : mon.hpPercent > 20 ? 'hp-mid' : 'hp-low'
  // Drag it onto another card to move it there - the first one leads every battle.
  const drag = useDraggable({ id: `${RUN_MON_DRAG_PREFIX}${mon.id}` })
  const drop = useDroppable({ id: `${RUN_SLOT_DROP_PREFIX}${index}` })
  const { transform } = drag
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
        style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 5 } : undefined}
        className={`team-slot team-slot-filled run-mon-card${selectable ? ' run-mon-card-selectable' : ''}${
          drop.isOver && !drag.isDragging ? ' team-slot-over' : ''
        }${drag.isDragging ? ' run-mon-card-dragging' : ''}`}
        // Not disabled even when there's nothing to click for - a disabled button gets no
        // right-clicks, and the context menu needs them.
        onClick={selectable ? onClick : undefined}
        onContextMenu={onContextMenu}
      >
        <div className="box-icon box-icon-fill">
          <div className="box-icon-draggable">
            <PokemonIconVisual mon={{ ...mon, expPercent: undefined }} />
          </div>
        </div>
        <div className="run-mon-hp">
          <div className={`hp-bar-fill ${hpClass}`} style={{ width: `${mon.hpPercent}%` }} />
        </div>
        <div className="run-mon-meta">
          <span>Lv {mon.level}</span>
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
  onRerollItems,
  onEvolve,
  onRelearnMoves,
  onMoveItem,
  onPlaceDisplacedItem,
  onForfeit
}: Props): React.JSX.Element {
  const [confirmingForfeit, setConfirmingForfeit] = useState(false)
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

  if (!run || run.status !== 'active') {
    return (
      <div className="run-panel">
        {run && (
          <div className={`run-result ${run.status === 'won' ? 'run-result-won' : 'run-result-lost'}`}>
            <p>
              {run.status === 'won'
                ? `Run complete! ${run.starterSpecies}'s run beat all ${ROGUELITE_BOSS_COUNT} bosses on ${runDifficultyInfo(run.difficulty).label}.`
                : `Run over - ${run.starterSpecies}'s run fell on floor ${run.floor} (${run.bossesBeaten} boss${run.bossesBeaten === 1 ? '' : 'es'} beaten, ${runDifficultyInfo(run.difficulty).label}).`}
            </p>
            {run.rewards.length > 0 ? (
              <div className="run-reward-list">
                <span>Rewards sent to your bag:</span>
                {run.rewards.map((line) => (
                  <span key={line.label} className="run-reward-line">
                    {line.spritenum !== null && <ItemSprite spritenum={line.spritenum} />}
                    {line.label}
                    {line.quantity > 1 ? ` ×${line.quantity}` : ''}
                  </span>
                ))}
              </div>
            ) : (
              <p className="box-empty-hint">No bosses beaten - no rewards this time.</p>
            )}
          </div>
        )}
        <p className="box-empty-hint">
          Drag a Pokémon from your team or box onto the slot. The run uses a Lv {ROGUELITE_START_LEVEL} copy of it
          (no held item) - the original stays exactly as it is.
          {bestFloor ? ` Best floor so far: ${bestFloor}.` : ''}
        </p>
        <div className="run-starter-row">
          <StarterSlot picked={picked} />
          <div className="run-settings">
            <div className="run-difficulty-row">
              {RUN_DIFFICULTIES.map((d) => (
                <button
                  key={d.id}
                  className={`run-difficulty-button run-difficulty-${d.id}${difficulty === d.id ? ' run-difficulty-selected' : ''}`}
                  onClick={() => setDifficulty(d.id)}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <p className="run-difficulty-text">
              <strong>{runDifficultyInfo(difficulty).rules}</strong>
              <br />
              Rewards at the end of the run: {runDifficultyInfo(difficulty).rewardText}
            </p>
            <label className="run-generation-row">
              <span>Bosses from</span>
              <select
                value={generation ?? ''}
                onChange={(e) => setGeneration(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Any generation</option>
                {POKEMON_GENERATIONS.map((g) => {
                  const complete = completeGenerations.includes(g)
                  return (
                    <option key={g} value={g} disabled={!complete}>
                      Generation {g}
                      {complete ? '' : ' (Coming soon)'}
                    </option>
                  )
                })}
              </select>
            </label>
          </div>
        </div>
        {picked && (
          <button className="run-start-button" disabled={busy} onClick={() => onStart(difficulty, generation)}>
            Start Run
          </button>
        )}
      </div>
    )
  }

  const offer = run.itemOffer
  const displaced = run.displacedItem
  // What clicking a team member does right now, if anything.
  const pickTarget = (mon: RunMonView): (() => void) | null => {
    if (busy) return null
    if (offer && chosenItem) {
      return () => {
        onGiveItem(chosenItem, mon.id)
        setChosenItem(null)
      }
    }
    if (displaced && mon.id !== displaced.fromMonId) return () => onPlaceDisplacedItem(mon.id)
    if (movingFrom && mon.id !== movingFrom.id) {
      return () => {
        onMoveItem(movingFrom.id, mon.id)
        setMovingFrom(null)
      }
    }
    return null
  }
  const displacedFrom = displaced ? run.team.find((m) => m.id === displaced.fromMonId) : undefined
  return (
    <div className="run-panel">
      <div className="run-status-row">
        <span>
          Floor <strong>{run.floor}</strong>/{ROGUELITE_FINAL_FLOOR}
        </span>
        <span>
          Bosses <strong>{run.bossesBeaten}</strong>/{ROGUELITE_BOSS_COUNT}
        </span>
        <span>Next: {run.nextBossLabel}</span>
        <span className={`run-difficulty-tag run-difficulty-${run.difficulty}`}>
          {runDifficultyInfo(run.difficulty).label}
          {run.generation ? ` · Gen ${run.generation}` : ''}
        </span>
        <span>Opponents Lv {run.opponentLevel}</span>
        <span>Level Cap: {run.levelCap}</span>
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

      {offer ? (
        <div className="run-item-offer">
          {run.itemOfferReason === 'reward' && <p className="run-reward-heading">Victory reward!</p>}
          <p className="box-empty-hint">
            {chosenItem ? 'Now click the Pokémon to give it to (it replaces what it holds).' : 'Pick one item.'}
          </p>
          <div className="run-item-row">
            {offer.map((item) => (
              <button
                key={item.itemId}
                className={`run-item-button${chosenItem === item.itemId ? ' run-item-button-chosen' : ''}`}
                disabled={busy}
                onClick={() => setChosenItem(item.itemId)}
              >
                <ItemSprite spritenum={item.spritenum} />
                <span>{item.itemName}</span>
              </button>
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
      ) : (
        <div className="run-choice-grid">
          {run.choices.map((choice, index) => {
            const location = choice.kind === 'wild' ? locationOf(choice) : undefined
            return (
              <button
                key={index}
                className={`big-battle-button run-node-button run-node-${choice.kind}${location?.id === 'lab' ? ' run-node-lab' : ''}`}
                disabled={busy}
                title={NODE_INFO[choice.kind].hint}
                onClick={() => onChoose(index)}
              >
                <NodeIcon choice={choice} />
                <span>{location ? location.label : choice.kind === 'boss' ? run.nextBossLabel : NODE_INFO[choice.kind].label}</span>
                {location && <span className="run-node-sub">Wild Pokémon</span>}
              </button>
            )
          })}
        </div>
      )}

      <h2 className="options-heading run-team-heading">Run Team</h2>
      <div className="team-row">
        {run.team.map((mon, index) => {
          const target = pickTarget(mon)
          return (
            <RunMonCard
              key={mon.id}
              mon={mon}
              index={index}
              selectable={!!target}
              onContextMenu={(e) => {
                e.preventDefault()
                if (!busy) setMenu({ mon, x: e.clientX, y: e.clientY })
              }}
              onClick={() => target?.()}
            />
          )
        })}
      </div>
      {movingFrom ? (
        <p className="box-empty-hint">
          Click the Pokémon to give {movingFrom.species}&apos;s {movingFrom.item} to - if it holds something, they swap.{' '}
          <button className="run-forfeit-button" onClick={() => setMovingFrom(null)}>
            Cancel
          </button>
        </p>
      ) : (
        <p className="box-empty-hint">
          Drag to reorder (the first one leads). Right-click to evolve, update moves or move its item.
        </p>
      )}

      {menu && (
        <RunMonContextMenu
          x={menu.x}
          y={menu.y}
          species={menu.mon.species}
          evolutions={menu.mon.eligibleEvolutions ?? []}
          heldItem={menu.mon.item || null}
          onMoveItem={() => {
            setMenu(null)
            setMovingFrom(menu.mon)
          }}
          onEvolve={(target) => {
            setMenu(null)
            onEvolve(menu.mon.id, target)
          }}
          onRelearnMoves={() => {
            setMenu(null)
            onRelearnMoves(menu.mon.id)
          }}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  )
}

export default RoguelitePanel
