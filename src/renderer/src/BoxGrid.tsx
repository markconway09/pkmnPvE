import { useDroppable } from '@dnd-kit/core'
import type { BoxPokemonView } from '../../shared/battle-types'
import PokemonIcon from './PokemonIcon'

interface Props {
  mons: BoxPokemonView[]
  onEdit?: (monId: string) => void
  onContextMenu?: (e: React.MouseEvent, mon: BoxPokemonView) => void
  // Shown instead of the usual hint when the box is empty (a search with no matches).
  emptyHint?: string
}

function BoxGrid({ mons, onEdit, onContextMenu, emptyHint }: Props): React.JSX.Element {
  const { setNodeRef, isOver } = useDroppable({ id: 'box-drop-zone' })
  const classes = ['box-grid', isOver && 'box-grid-over'].filter(Boolean).join(' ')

  return (
    <div ref={setNodeRef} className={classes}>
      {mons.length === 0 && <p className="box-empty-hint">{emptyHint ?? 'No Pokemon in the box yet.'}</p>}
      {mons.map((mon) => (
        <PokemonIcon key={mon.id} mon={mon} draggable onEdit={onEdit} onContextMenu={onContextMenu} />
      ))}
    </div>
  )
}

export default BoxGrid
