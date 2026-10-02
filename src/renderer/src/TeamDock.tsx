import { useEffect, useState, type ReactNode } from 'react'
import { useDroppable } from '@dnd-kit/core'
import type { BoxPokemonView, BoxState, LoadoutView } from '../../shared/battle-types'
import PokemonIcon from './PokemonIcon'
import { errorMessage, pointOf, useFloatingNotes } from './FloatingNotes'

interface Props {
  team: (string | null)[]
  monsById: Map<string, BoxPokemonView>
  // The companion slot, shown off the dock's left side once it's unlocked.
  companion?: ReactNode
  onEdit: (monId: string) => void
  onContextMenu: (e: React.MouseEvent, mon: BoxPokemonView) => void
  // A loadout was loaded from the dock's menu.
  onApplied: (box: BoxState) => void
  // Opens the full Loadouts window (save, rename, overwrite, delete).
  onManage: () => void
  // While that window is open - the dock's list is read again once it closes.
  manageOpen: boolean
  // The first this many Pokemon are marked as leads (a Max Raid's two).
  leadCount?: number
  // Hidden away: only a small tab shows, to bring it back.
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
}

const sameTeam = (a: (string | null)[], b: (string | null)[]): boolean => a.every((id, i) => id === b[i])

function DockSlot({ slot, mon, lead, onEdit, onContextMenu }: {
  slot: number
  mon: BoxPokemonView | undefined
  lead: boolean
  onEdit: (monId: string) => void
  onContextMenu: (e: React.MouseEvent, mon: BoxPokemonView) => void
}): React.JSX.Element {
  // The same drop target ids as the old team row, so dragging works as before.
  const { setNodeRef, isOver } = useDroppable({ id: `team-slot-${slot}` })
  return (
    <div
      ref={setNodeRef}
      className={`team-dock-slot${mon ? ' team-dock-slot-filled' : ''}${isOver ? ' team-dock-slot-over' : ''}${lead ? ' team-dock-slot-lead' : ''}`}
    >
      {lead && <span className="team-dock-lead-tag">Lead</span>}
      {mon ? (
        <PokemonIcon mon={mon} fill draggable onEdit={onEdit} onContextMenu={onContextMenu} />
      ) : (
        <span className="team-dock-slot-empty">{slot + 1}</span>
      )}
    </div>
  )
}

/**
 * The team, as a floating dock: the count and the loadout in use on the left - its menu
 * switches to a saved loadout straight away - and the six slots beside them. Drag a
 * Pokemon from the box onto a slot to put it in the team, as before.
 */
function TeamDock({
  team,
  monsById,
  companion,
  onEdit,
  onContextMenu,
  onApplied,
  onManage,
  manageOpen,
  leadCount = 0,
  collapsed,
  onCollapsedChange
}: Props): React.JSX.Element {
  const [loadouts, setLoadouts] = useState<LoadoutView[] | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const notes = useFloatingNotes()

  function refreshLoadouts(): void {
    window.api
      .listLoadouts()
      .then(setLoadouts)
      .catch(() => setLoadouts([]))
  }
  // Read on opening, and again whenever the Loadouts window closes (it may have changed them).
  useEffect(() => {
    if (!manageOpen) refreshLoadouts()
  }, [manageOpen])

  const count = team.filter(Boolean).length
  // The slots the leads are in: the first filled ones, empty slots skipped.
  const leadSlots = new Set(team.flatMap((id, slot) => (id ? [slot] : [])).slice(0, leadCount))
  const current = loadouts?.find((l) => sameTeam(l.team, team)) ?? null

  async function load(e: React.MouseEvent, loadout: LoadoutView): Promise<void> {
    const at = pointOf(e)
    setMenuOpen(false)
    setBusy(true)
    try {
      onApplied(await window.api.applyLoadout(loadout.id))
      notes.show(`Loaded "${loadout.name}"`, at)
    } catch (err) {
      notes.show(errorMessage(err), at, 'bad')
    } finally {
      setBusy(false)
    }
  }

  // Hidden: a small tab in its place - the dock itself stays loaded behind it.
  if (collapsed) {
    return (
      <button className="team-dock team-dock-tab" title="Show your team" onClick={() => onCollapsedChange(false)}>
        <svg className="team-dock-tab-icon" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4 10l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Team <span className="team-dock-tab-count">{count}/{team.length}</span>
      </button>
    )
  }

  return (
    <div className="team-dock">
      {companion}
      <div className="team-dock-side">
        {/* Hides the dock down to a small tab. */}
        <button className="team-dock-side-button team-dock-hide" title="Hide the team" aria-label="Hide the team" onClick={() => onCollapsedChange(true)}>
          <svg className="team-dock-loadout-icon" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="team-dock-loadout-wrap">
          {/* The loadouts as one icon - its tooltip names the one in use. */}
          <button
            className={`team-dock-side-button team-dock-loadout${menuOpen ? ' team-dock-loadout-open' : ''}${current ? ' team-dock-loadout-saved' : ''}`}
            disabled={busy}
            title={`Loadouts - ${current ? `using "${current.name}"` : count > 0 ? "this team isn't saved" : 'no team yet'}`}
            aria-label="Loadouts"
            onClick={() => {
              if (!menuOpen) refreshLoadouts()
              setMenuOpen((v) => !v)
            }}
          >
            <svg className="team-dock-loadout-icon" viewBox="0 0 16 16" aria-hidden="true">
              <rect x="2.5" y="6" width="11" height="7.5" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <path d="M4 4h8M5.5 2h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
          {menuOpen && (
            <>
              <div className="box-select-menu-backdrop" onMouseDown={() => setMenuOpen(false)} />
              <div className="context-menu team-dock-menu">
                {/* Which one is in use, over the list. */}
                <div className="team-dock-menu-head">
                  {current ? `Using "${current.name}"` : count > 0 ? "This team isn't saved" : 'No team yet'}
                </div>
                {loadouts && loadouts.length === 0 && <div className="team-dock-menu-empty">No saved loadouts yet</div>}
                {loadouts?.map((l) => {
                  const inUse = current?.id === l.id
                  return (
                    <button
                      key={l.id}
                      className={`context-menu-item team-dock-menu-item${inUse ? ' team-dock-menu-current' : ''}`}
                      disabled={inUse}
                      onClick={(e) => void load(e, l)}
                    >
                      <span className="team-dock-menu-check">{inUse ? '✓' : ''}</span>
                      <span className="team-dock-menu-name">{l.name}</span>
                      <span className="team-dock-menu-size">{l.team.filter(Boolean).length}</span>
                    </button>
                  )
                })}
                <button
                  className="context-menu-item team-dock-menu-manage"
                  onClick={() => {
                    setMenuOpen(false)
                    onManage()
                  }}
                >
                  Manage loadouts…
                </button>
              </div>
            </>
          )}
        </span>
      </div>
      <div className="team-dock-slots">
        {team.map((id, slot) => (
          <DockSlot
            key={slot}
            slot={slot}
            mon={id ? monsById.get(id) : undefined}
            lead={leadSlots.has(slot)}
            onEdit={onEdit}
            onContextMenu={onContextMenu}
          />
        ))}
      </div>
      {notes.layer}
    </div>
  )
}

export default TeamDock
