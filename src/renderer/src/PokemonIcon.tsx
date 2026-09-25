import { useDraggable } from '@dnd-kit/core'
import type { BoxPokemonView } from '../../shared/battle-types'
import PokemonTooltipContent from './PokemonTooltipContent'
import PokemonIconVisual from './PokemonIconVisual'
import Tooltip from './Tooltip'
import { useTapGuard } from './useTapGuard'

interface Props {
  mon: BoxPokemonView
  fill?: boolean
  onEdit?: (monId: string) => void
  onRemove?: (monId: string) => void
  draggable?: boolean
  onContextMenu?: (e: React.MouseEvent, mon: BoxPokemonView) => void
}

function PokemonIcon({ mon, fill, onEdit, onRemove, draggable = false, onContextMenu }: Props): React.JSX.Element {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: mon.id, disabled: !draggable })
  // A left click opens the same menu as a right click - but not a drag that ends where it began.
  const tap = useTapGuard()

  return (
    <Tooltip
      className={fill ? 'box-icon box-icon-fill' : 'box-icon'}
      placement="above"
      content={<PokemonTooltipContent pokemon={mon} />}
    >
      <div
        ref={setNodeRef}
        className={`box-icon-draggable ${isDragging ? 'box-icon-dragging' : ''}`}
        onDoubleClick={() => onEdit?.(mon.id)}
        onContextMenu={onContextMenu ? (e) => onContextMenu(e, mon) : undefined}
        onPointerDownCapture={tap.onPointerDownCapture}
        onClick={onContextMenu ? (e) => tap.isTap() && onContextMenu(e, mon) : undefined}
        {...attributes}
        {...listeners}
      >
        {onRemove && (
          <button
            type="button"
            className="box-icon-remove"
            title="Remove"
            onClick={(e) => {
              e.stopPropagation()
              onRemove(mon.id)
            }}
          >
            ×
          </button>
        )}
        <PokemonIconVisual mon={mon} />
      </div>
    </Tooltip>
  )
}

export default PokemonIcon
