import { useEffect, useState } from 'react'
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
import type { BoxPokemonView, ItemOptionEntry, PremadeTeamSummary } from '../../shared/battle-types'
import TeamRow from './TeamRow'
import PokemonIconVisual from './PokemonIconVisual'
import PokemonContextMenu from './PokemonContextMenu'
import PokemonEditor from './PokemonEditor'
import ItemDropPicker from './ItemDropPicker'

const MAX_TEAM_SIZE = 6

interface Props {
  team: PremadeTeamSummary
  items: ItemOptionEntry[]
  onClose: () => void
  onTeamsChange: (teams: PremadeTeamSummary[]) => void
}

function PremadeTeamRoster({ team, items, onClose, onTeamsChange }: Props): React.JSX.Element {
  const [busy, setBusy] = useState(false)
  const [editingMonId, setEditingMonId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ mon: BoxPokemonView; x: number; y: number } | null>(null)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dropItemId, setDropItemId] = useState<string | null>(team.drop.itemId)
  const [dropChance, setDropChance] = useState(team.drop.chance)
  const [isDoubleBattle, setIsDoubleBattle] = useState(team.isDoubleBattle)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  // "Add Specific Pokemon": the species being typed, and every species to pick from.
  const [adding, setAdding] = useState(false)
  const [speciesQuery, setSpeciesQuery] = useState('')
  const [speciesNames, setSpeciesNames] = useState<string[]>([])

  useEffect(() => {
    if (!adding || speciesNames.length > 0) return
    window.api
      .getEditorOptions()
      .then((opts) => setSpeciesNames(opts.species.map((s) => s.name)))
      .catch(() => {})
  }, [adding, speciesNames.length])

  async function saveDrop(itemId: string | null, chance: number): Promise<void> {
    try {
      onTeamsChange(await window.api.setPremadeTeamDrop(team.id, { itemId, chance }))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function saveDoubleBattle(checked: boolean): Promise<void> {
    setIsDoubleBattle(checked)
    try {
      onTeamsChange(await window.api.setPremadeTeamDoubleBattle(team.id, checked))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  // Adds the typed species, then opens it in the editor to set up its moves and the rest.
  async function addSpecificMon(): Promise<void> {
    const species = speciesQuery.trim()
    if (!species) return
    setBusy(true)
    setError(null)
    try {
      const teams = await window.api.addSpeciesToTeam(team.id, species)
      onTeamsChange(teams)
      const added = teams.find((t) => t.id === team.id)?.mons.at(-1)
      setAdding(false)
      setSpeciesQuery('')
      if (added) setEditingMonId(added.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function removeMon(monId: string): Promise<void> {
    setBusy(true)
    try {
      onTeamsChange(await window.api.removeTeamMon(team.id, monId))
    } finally {
      setBusy(false)
    }
  }

  async function reorder(monIds: string[]): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      onTeamsChange(await window.api.reorderTeamMons(team.id, monIds))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  function refresh(): void {
    void window.api.listPremadeTeamsForTrainer(team.trainerId).then(onTeamsChange)
  }

  function handleDragStart(e: DragStartEvent): void {
    setActiveDragId(String(e.active.id))
  }

  // A team is a compact list, so a drop onto another Pokemon swaps the two, and
  // a drop onto an empty slot sends the dragged one to the end of the line.
  function handleDragEnd(e: DragEndEvent): void {
    setActiveDragId(null)
    const { active, over } = e
    if (!over || busy) return
    const overId = String(over.id)
    if (!overId.startsWith('team-slot-')) return
    const targetSlot = Number(overId.slice('team-slot-'.length))

    const ids = team.mons.map((m) => m.id)
    const from = ids.indexOf(String(active.id))
    if (from === -1 || from === targetSlot) return

    if (targetSlot < ids.length) {
      ;[ids[from], ids[targetSlot]] = [ids[targetSlot], ids[from]]
    } else {
      ids.push(ids.splice(from, 1)[0])
    }
    if (ids.every((id, i) => id === team.mons[i].id)) return
    void reorder(ids)
  }

  function handleContextMenu(e: React.MouseEvent, mon: BoxPokemonView): void {
    e.preventDefault()
    setContextMenu({ mon, x: e.clientX, y: e.clientY })
  }

  const slotIds: (string | null)[] = [
    ...team.mons.map((m) => m.id),
    ...Array(Math.max(0, MAX_TEAM_SIZE - team.mons.length)).fill(null)
  ]
  const monsById = new Map(team.mons.map((m) => [m.id, m]))
  const activeDragMon = activeDragId ? monsById.get(activeDragId) : undefined

  return createPortal(
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-panel pokemon-editor roster-modal" onMouseDown={(e) => e.stopPropagation()}>
        <h2>{team.name}</h2>
        <label className="editor-field editor-field-checkbox">
          <span>Double Battle</span>
          <input type="checkbox" checked={isDoubleBattle} onChange={(e) => void saveDoubleBattle(e.target.checked)} />
        </label>
        <ItemDropPicker
          label="This team's item drop"
          items={items}
          itemId={dropItemId}
          chance={dropChance}
          onChangeItem={(id) => {
            setDropItemId(id)
            void saveDrop(id, dropChance)
          }}
          onChangeChance={(chance) => {
            setDropChance(chance)
            void saveDrop(dropItemId, chance)
          }}
        />
        {adding ? (
          <form
            className="trainer-add-row add-specific-row"
            onSubmit={(e) => {
              e.preventDefault()
              void addSpecificMon()
            }}
          >
            <input
              type="text"
              list="premade-species-options"
              placeholder="Species (e.g. Garchomp)"
              value={speciesQuery}
              autoFocus
              onChange={(e) => setSpeciesQuery(e.target.value)}
            />
            <datalist id="premade-species-options">
              {speciesNames.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            <button type="submit" disabled={busy || !speciesQuery.trim()}>
              Add
            </button>
            <button type="button" onClick={() => setAdding(false)}>
              Cancel
            </button>
          </form>
        ) : (
          <button
            className="add-specific-button"
            disabled={busy || team.mons.length >= MAX_TEAM_SIZE}
            onClick={() => setAdding(true)}
          >
            Add Specific Pokemon
          </button>
        )}
        {error && <p className="editor-error">{error}</p>}
        <p className="box-empty-hint">
          Click a Pokemon to edit it. Drag to reorder. Click × to remove it.
        </p>

        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <TeamRow
            team={slotIds}
            monsById={monsById}
            onRemove={(id) => void removeMon(id)}
            onContextMenu={handleContextMenu}
          />
          <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
            {activeDragMon && (
              <div className="box-icon-draggable box-icon-overlay">
                <PokemonIconVisual mon={activeDragMon} />
              </div>
            )}
          </DragOverlay>
        </DndContext>

        <div className="editor-actions">
          <button onClick={onClose}>Close</button>
        </div>

        {/* Rendered inside the panel (not beside it) so a click on either one's
            backdrop stops here instead of also closing this whole roster. */}
        {contextMenu && (
          <PokemonContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            species={contextMenu.mon.species}
            onAdminEdit={() => {
              setEditingMonId(contextMenu.mon.id)
              setContextMenu(null)
            }}
            onClose={() => setContextMenu(null)}
          />
        )}

        {editingMonId && (
          <PokemonEditor
            source={{ kind: 'premadeTeam', teamId: team.id, monId: editingMonId }}
            onClose={() => setEditingMonId(null)}
            onSaved={refresh}
          />
        )}
      </div>
    </div>,
    document.body
  )
}

export default PremadeTeamRoster
