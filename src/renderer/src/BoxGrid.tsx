import { useDroppable } from '@dnd-kit/core'
import type { BoxPokemonView } from '../../shared/battle-types'
import PokemonIcon from './PokemonIcon'

interface Props {
  mons: BoxPokemonView[]
  onEdit?: (monId: string) => void
  onContextMenu?: (e: React.MouseEvent, mon: BoxPokemonView) => void
}

function BoxGrid({ mons, onEdit, onContextMenu }: Props): React.JSX.Element {
  const { setNodeRef, isOver } = useDroppable({ id: 'box-drop-zone' })
  const classes = ['box-grid', isOver && 'box-grid-over'].filter(Boolean).join(' ')

  return (
    <div ref={setNodeRef} className={classes}>
      {mons.length === 0 && <p className="box-empty-hint">No Pokemon in the box yet.</p>}
      {mons.map((mon) => (
        <PokemonIcon key={mon.id} mon={mon} draggable onEdit={onEdit} onContextMenu={onContextMenu} />
      ))}
    </div>
  )
}

export default BoxGrid
