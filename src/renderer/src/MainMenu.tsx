import { useEffect, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent
} from '@dnd-kit/core'
import { WILD_LOCATIONS } from '../../shared/battle-types'
import type { BattleEligibility, BattleView, BoxPokemonView, BoxState, RunView, WildLocationId } from '../../shared/battle-types'
import TeamRow from './TeamRow'
import BoxGrid from './BoxGrid'
import PokemonEditor from './PokemonEditor'
import PokemonIconVisual from './PokemonIconVisual'
import DebugMenu from './DebugMenu'
import PlayerTrainerModal from './PlayerTrainerModal'
import StarterPicker from './StarterPicker'
import PokemonContextMenu from './PokemonContextMenu'
import BagModal from './BagModal'
import ShopModal from './ShopModal'
import WildDropsModal from './WildDropsModal'
import ShopPricesModal from './ShopPricesModal'
import LoadoutsModal from './LoadoutsModal'
import BossRematchModal from './BossRematchModal'
import RoguelitePanel, { RUN_MON_DRAG_PREFIX, RUN_SLOT_DROP_PREFIX, RUN_STARTER_SLOT_ID } from './RoguelitePanel'
import { loadMenuMode, saveMenuMode, type MenuMode } from './menuMode'
import { trainerSpriteUrl } from './trainerSprite'
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
  const [run, setRun] = useState<RunView | null>(null)
  // The box Pokemon dragged onto the run's starter slot - nothing moves, it's only a pick.
  const [runPickId, setRunPickId] = useState<string | null>(null)
  const [runBusy, setRunBusy] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)
  const [bestFloor, setBestFloor] = useState<number | null>(null)
  // A run in progress takes the whole menu: the regular team and box are hidden.
  const runInProgress = mode === 'roguelite' && run?.status === 'active'
  const [levelCap, setLevelCap] = useState<number | null>(null)
  const [eligibility, setEligibility] = useState<BattleEligibility | null>(null)
  const [busy, setBusy] = useState(false)
  const [editingMonId, setEditingMonId] = useState<string | null>(null)
  const [editingAdmin, setEditingAdmin] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [debugOpen, setDebugOpen] = useState(false)
  const [wildDropsOpen, setWildDropsOpen] = useState(false)
  const [shopPricesOpen, setShopPricesOpen] = useState(false)
  const [loadoutsOpen, setLoadoutsOpen] = useState(false)
  // Folds the battle buttons away so the box gets the rest of the window.
  const [boxExpanded, setBoxExpanded] = useState(false)
  const [rematchOpen, setRematchOpen] = useState(false)
  // Only there while the box is expanded - collapsing it clears the search.
  const [boxSearch, setBoxSearch] = useState('')
  const [playerTrainerOpen, setPlayerTrainerOpen] = useState(false)
  const [starterOpen, setStarterOpen] = useState(false)
  const [bagOpen, setBagOpen] = useState(false)
  const [shopOpen, setShopOpen] = useState(false)
  const [money, setMoney] = useState<number | null>(null)
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

  function toggleMode(): void {
    const next: MenuMode = mode === 'classic' ? 'roguelite' : 'classic'
    setMode(next)
    saveMenuMode(username, next)
  }

  function refreshAll(): void {
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

  async function levelUp(monId: string): Promise<void> {
    setContextMenu(null)
    setBusy(true)
    try {
      setBoxState(await window.api.levelUpMon(monId))
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
  // Favorites first; otherwise the box keeps its usual (arrival) order.
  const boxMons = (boxState?.mons ?? [])
    .filter((m) => !team.includes(m.id))
    .filter((m) => matchesBoxSearch(m, boxSearch))
    .sort((a, b) => Number(!!b.favorite) - Number(!!a.favorite))
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

  // The Professor's Lab closes again if boss progress is reset - back to All.
  const selectedLocation = WILD_LOCATIONS.find((l) => l.id === wildLocation)
  useEffect(() => {
    if (eligibility && selectedLocation?.requiresAllBosses && !eligibility.allBossesDefeated) onChangeWildLocation('all')
  }, [eligibility, selectedLocation, onChangeWildLocation])

  return (
    <div className="screen">
      <div className="menu-header">
        <h1>pkmnPvE</h1>
        <div className="menu-nav">
          {money !== null && <span className="money-display">{formatMoney(money)}</span>}
          <button
            className={`mode-toggle mode-toggle-${mode}`}
            title="Switch between the classic game and Roguelite runs"
            onClick={toggleMode}
          >
            {mode === 'classic' ? '⚔ Classic' : '🎲 Roguelite'}
          </button>
          <button onClick={() => setPlayerTrainerOpen(true)}>{username}</button>
          {/* A run has no bag or shop of its own - these are the classic game's. */}
          <button disabled={mode === 'roguelite'} onClick={() => setBagOpen(true)}>
            Bag
          </button>
          <button disabled={mode === 'roguelite'} onClick={() => setShopOpen(true)}>
            Shop
          </button>
          {isAdmin && <button onClick={() => setDebugOpen(true)}>Debug</button>}
          <button className="menu-nav-cog" title="Options" onClick={onOptions}>
            ⚙
          </button>
        </div>
      </div>

      {fightError && <p style={{ color: '#ff6b6b' }}>{fightError}</p>}
      {loadError && <p style={{ color: '#ff6b6b' }}>Failed to load your box: {loadError}</p>}
      {mode === 'roguelite' && runError && <p style={{ color: '#ff6b6b' }}>{runError}</p>}

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div
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
                  setRun(await window.api.startRun(runPickId, difficulty, generation))
                  setRunPickId(null)
                })
              }
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
                  setRun(await window.api.evolveRunMon(runMonId, target))
                })
              }
              onRelearnMoves={(runMonId) =>
                void runAction(async () => {
                  setRun(await window.api.relearnRunMoves(runMonId))
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
                onClick={() => onChangeWildLocation(loc.id)}
              >
                <span className="wild-location-icon">{loc.icon}</span>
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
          <h2 className="options-heading">Team</h2>
          <button className="loadouts-button" onClick={() => setLoadoutsOpen(true)}>
            Loadouts
          </button>
        </div>
        <TeamRow team={team} monsById={monsById} onContextMenu={handleContextMenu} />

        <div className="team-heading-row">
          <h2 className="options-heading">Box</h2>
          <button
            className={`box-expand-button${boxExpanded ? ' box-expand-button-flipped' : ''}`}
            title={boxExpanded ? 'Show the battle buttons again' : 'Hide the battle buttons for a bigger box'}
            onClick={() => {
              if (boxExpanded) setBoxSearch('')
              setBoxExpanded((v) => !v)
            }}
          >
            ▲
          </button>
          {boxExpanded && (
            <input
              className="box-search"
              type="search"
              placeholder="Search name, type, move, ability, item…"
              value={boxSearch}
              autoFocus
              onChange={(e) => setBoxSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setBoxSearch('')
              }}
            />
          )}
        </div>
        <BoxGrid
          mons={boxMons}
          onContextMenu={handleContextMenu}
          emptyHint={boxSearch.trim() ? 'No Pokemon in the box match that search.' : undefined}
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
          source={{ kind: 'box', monId: editingMonId }}
          admin={editingAdmin}
          onClose={() => {
            setEditingMonId(null)
            setEditingAdmin(false)
          }}
          onSaved={refreshBox}
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
          onChallengePlayer={onChallengePlayer}
          onClose={() => setPlayerTrainerOpen(false)}
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
          canLevelUp={contextMenu.mon.canLevelUpWithCandy ?? false}
          onChoose={(target) => void evolve(contextMenu.mon.id, target)}
          onLevelUp={() => void levelUp(contextMenu.mon.id)}
          canUseShinyPatch={contextMenu.mon.canUseShinyPatch ?? false}
          onUseShinyPatch={() => void useShinyPatch(contextMenu.mon.id)}
          favorite={!!contextMenu.mon.favorite}
          onToggleFavorite={() => void toggleFavorite(contextMenu.mon.id)}
          onEdit={() => openEditor(contextMenu.mon.id, false)}
          onAdminEdit={isAdmin ? () => openEditor(contextMenu.mon.id, true) : undefined}
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
        />
      )}

      {shopOpen && (
        <ShopModal
          onClose={() => {
            setShopOpen(false)
            refreshBox()
          }}
          onMoneyChange={setMoney}
        />
      )}
    </div>
  )
}

export default MainMenu
