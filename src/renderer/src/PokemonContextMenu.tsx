import { createPortal } from 'react-dom'
import ContextMenuPanel from './ContextMenuPanel'

interface Props {
  x: number
  y: number
  species: string
  // Every entry below only appears when its handler (or list) is given, so the
  // same menu serves the player's box (all of it) and a trainer roster (just
  // Admin Edit).
  evolutions?: string[]
  canLevelUp?: boolean
  onChoose?: (targetSpecies: string) => void
  onLevelUp?: () => void
  canUseShinyPatch?: boolean
  onUseShinyPatch?: () => void
  favorite?: boolean
  onToggleFavorite?: () => void
  onEdit?: () => void
  // Only given to admins.
  onAdminEdit?: () => void
  onClose: () => void
}

function PokemonContextMenu({
  x,
  y,
  species,
  evolutions = [],
  canLevelUp = false,
  onChoose,
  onLevelUp,
  canUseShinyPatch = false,
  onUseShinyPatch,
  favorite = false,
  onToggleFavorite,
  onEdit,
  onAdminEdit,
  onClose
}: Props): React.JSX.Element {
  return createPortal(
    <div
      className="context-menu-overlay"
      onMouseDown={onClose}
      onContextMenu={(e) => {
        e.preventDefault()
        onClose()
      }}
    >
      <ContextMenuPanel x={x} y={y}>
        <div className="context-menu-title">{species}</div>
        {onEdit && (
          <button className="context-menu-item" onClick={onEdit}>
            Edit Pokemon
          </button>
        )}
        {onToggleFavorite && (
          <button className="context-menu-item" onClick={onToggleFavorite}>
            {favorite ? 'Unfavorite' : '⭐ Favorite'}
          </button>
        )}
        {onAdminEdit && (
          <button className="context-menu-item" onClick={onAdminEdit}>
            Admin Edit
          </button>
        )}
        {canLevelUp && onLevelUp && (
          <button className="context-menu-item" onClick={onLevelUp}>
            Level Up (use Rare Candy)
          </button>
        )}
        {canUseShinyPatch && onUseShinyPatch && (
          <button className="context-menu-item" onClick={onUseShinyPatch}>
            ✨ Turn Shiny (use Shiny Patch)
          </button>
        )}
        {onChoose &&
          evolutions.map((target) => (
            <button key={target} className="context-menu-item" onClick={() => onChoose(target)}>
              Evolve into {target}
            </button>
          ))}
      </ContextMenuPanel>
    </div>,
    document.body
  )
}

export default PokemonContextMenu
