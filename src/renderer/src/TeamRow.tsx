import { useDroppable } from '@dnd-kit/core'
import type { BoxPokemonView } from '../../shared/battle-types'
import PokemonIcon from './PokemonIcon'

interface Props {
  team: (string | null)[]
  monsById: Map<string, BoxPokemonView>
  onEdit?: (monId: string) => void
  onRemove?: (monId: string) => void
  onContextMenu?: (e: React.MouseEvent, mon: BoxPokemonView) => void
}

interface SlotProps {
  slot: number
  mon: BoxPokemonView | undefined
  onEdit?: (monId: string) => void
  onRemove?: (monId: string) => void
  onContextMenu?: (e: React.MouseEvent, mon: BoxPokemonView) => void
}

function TeamSlot({ slot, mon, onEdit, onRemove, onContextMenu }: SlotProps): React.JSX.Element {
  const { setNodeRef, isOver } = useDroppable({ id: `team-slot-${slot}` })
  const classes = ['team-slot', mon && 'team-slot-filled', isOver && 'team-slot-over'].filter(Boolean).join(' ')

  return (
    <div ref={setNodeRef} className={classes}>
      {mon ? (
        <PokemonIcon mon={mon} fill draggable onEdit={onEdit} onRemove={onRemove} onContextMenu={onContextMenu} />
      ) : (
        <span className="team-slot-empty">Empty</span>
      )}
    </div>
  )
}

function TeamRow({ team, monsById, onEdit, onRemove, onContextMenu }: Props): React.JSX.Element {
  return (
    <div className="team-row">
      {team.map((id, slot) => (
        <TeamSlot
          key={slot}
          slot={slot}
          mon={id ? monsById.get(id) : undefined}
          onEdit={onEdit}
          onRemove={onRemove}
          onContextMenu={onContextMenu}
        />
      ))}
    </div>
  )
}

export default TeamRow
