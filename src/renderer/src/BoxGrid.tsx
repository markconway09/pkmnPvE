import { useDroppable } from '@dnd-kit/core'
import type { BoxPokemonView } from '../../shared/battle-types'
import PokemonIcon from './PokemonIcon'

interface Props {
  mons: BoxPokemonView[]
  onEdit?: (monId: string) => void
  onContextMenu?: (e: React.MouseEvent, mon: BoxPokemonView) => void
  // Shown instead of the usual hint when the box is empty (a search with no matches).
  emptyHint?: string
  // Picking Pokemon to sell: clicking one toggles it (no dragging or menu meanwhile).
  selection?: Set<string> | null
  onToggleSelect?: (mon: BoxPokemonView) => void
  canSelect?: (mon: BoxPokemonView) => boolean
}

function BoxGrid({ mons, onEdit, onContextMenu, emptyHint, selection, onToggleSelect, canSelect }: Props): React.JSX.Element {
  const { setNodeRef, isOver } = useDroppable({ id: 'box-drop-zone' })
  const classes = ['box-grid', isOver && 'box-grid-over'].filter(Boolean).join(' ')

  return (
    <div ref={setNodeRef} className={classes}>
      {mons.length === 0 && <p className="box-empty-hint">{emptyHint ?? 'No Pokemon in the box yet.'}</p>}
      {mons.map((mon) => (
        <PokemonIcon
          key={mon.id}
          mon={mon}
          draggable={!selection}
          onEdit={selection ? undefined : onEdit}
          // While picking, a left click picks it too.
          onClick={selection ? () => onToggleSelect?.(mon) : undefined}
          onContextMenu={
            selection
              ? (e) => {
                  e.preventDefault()
                  onToggleSelect?.(mon)
                }
              : onContextMenu
          }
          selected={!!selection?.has(mon.id)}
          unselectable={!!selection && canSelect !== undefined && !canSelect(mon)}
        />
      ))}
    </div>
  )
}

export default BoxGrid
