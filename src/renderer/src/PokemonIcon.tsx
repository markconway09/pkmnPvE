import { useDraggable } from '@dnd-kit/core'
import type { BoxPokemonView } from '../../shared/battle-types'
import PokemonTooltipContent from './PokemonTooltipContent'
import PokemonIconVisual from './PokemonIconVisual'
import Tooltip from './Tooltip'
import RarityCard from './RarityCard'

interface Props {
  mon: BoxPokemonView
  fill?: boolean
  onEdit?: (monId: string) => void
  onRemove?: (monId: string) => void
  draggable?: boolean
  onContextMenu?: (e: React.MouseEvent, mon: BoxPokemonView) => void
  // Only while picking Pokemon to sell (see BoxGrid).
  onClick?: () => void
  // Picking Pokemon to sell: picked, or can't be picked (a favorite or a fused one).
  selected?: boolean
  unselectable?: boolean
}

function PokemonIcon({
  mon,
  fill,
  onEdit,
  onRemove,
  draggable = false,
  onContextMenu,
  onClick,
  selected = false,
  unselectable = false
}: Props): React.JSX.Element {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: mon.id, disabled: !draggable })

  return (
    <Tooltip
      className={fill ? 'box-icon box-icon-fill' : 'box-icon'}
      placement="above"
      content={<PokemonTooltipContent pokemon={mon} />}
    >
      {/* A RarityCard in its rarity colour (grey, blue, purple, red, gold). */}
      <RarityCard
        cardRef={setNodeRef}
        tier={mon.rarityTier ?? 'common'}
        className={`box-icon-draggable ${isDragging ? 'box-icon-dragging' : ''}${selected ? ' box-icon-selected' : ''}${unselectable ? ' box-icon-unselectable' : ''}`}
        // Right-click for the menu; double-click to edit it.
        onDoubleClick={() => onEdit?.(mon.id)}
        onContextMenu={onContextMenu ? (e) => onContextMenu(e, mon) : undefined}
        onClick={onClick}
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
      </RarityCard>
    </Tooltip>
  )
}

export default PokemonIcon
