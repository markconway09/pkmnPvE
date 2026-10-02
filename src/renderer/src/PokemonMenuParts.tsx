import { toSpriteId } from '../../shared/battle-types'
import SpriteImage from './SpriteImage'

// The pieces of a Pokemon's right-click menu (box, trainer roster and run team):
// a header with its sprite and name, then rows grouped into sections, each row a
// coloured icon tile, the action in bold and what it does underneath.

// Each kind of action has its own colour, so the menu reads at a glance.
export type MenuTone = 'edit' | 'admin' | 'evolve' | 'form' | 'fuse' | 'merge' | 'shiny' | 'item' | 'sell'

interface HeaderProps {
  species: string
  shiny?: boolean
  // The favorite heart, at the header's right - only when it can be toggled.
  favorite?: boolean
  onToggleFavorite?: () => void
}

export function PokemonMenuHeader({ species, shiny = false, favorite = false, onToggleFavorite }: HeaderProps): React.JSX.Element {
  return (
    <div className="pkmn-menu-header">
      <span className="pkmn-menu-sprite">
        <SpriteImage style="3d-static" spriteId={toSpriteId(species)} shiny={shiny} alt={species} draggable={false} />
      </span>
      <span className="pkmn-menu-name">{species}</span>
      {onToggleFavorite && (
        <button
          type="button"
          className={`pkmn-menu-heart${favorite ? ' pkmn-menu-heart-on' : ''}`}
          title={favorite ? 'Unfavorite' : 'Favorite'}
          onClick={onToggleFavorite}
        >
          {favorite ? '❤️' : '🤍'}
        </button>
      )}
    </div>
  )
}

// A group of rows under a small label; nothing at all when none of its rows show.
export function PokemonMenuSection({ label, children }: { label?: string; children: React.ReactNode }): React.JSX.Element | null {
  const rows = Array.isArray(children) ? children.flat().filter(Boolean) : children ? [children] : []
  if (rows.length === 0) return null
  return (
    <div className="pkmn-menu-section">
      {label && <div className="pkmn-menu-section-label">{label}</div>}
      {rows}
    </div>
  )
}

interface ActionProps {
  tone: MenuTone
  // The tile's picture: one of MenuIcon's, or an item sprite.
  icon: React.ReactNode
  label: React.ReactNode
  // A line under the label: the target, the cost, the price...
  detail?: React.ReactNode
  // Waiting on a second click to be sure (sell a rare one, use the Shiny Patch).
  confirming?: boolean
  title?: string
  onClick: () => void
}

export function PokemonMenuAction({ tone, icon, label, detail, confirming = false, title, onClick }: ActionProps): React.JSX.Element {
  return (
    <button
      type="button"
      className={`pkmn-menu-action pkmn-tone-${tone}${confirming ? ' pkmn-menu-confirming' : ''}`}
      title={title}
      onClick={onClick}
    >
      <span className="pkmn-menu-tile">{icon}</span>
      <span className="pkmn-menu-text">
        <span className="pkmn-menu-label">{label}</span>
        {detail && <span className="pkmn-menu-detail">{detail}</span>}
      </span>
    </button>
  )
}

// Line icons for the tiles, drawn in the row's colour.
type IconName = 'edit' | 'admin' | 'evolve' | 'form' | 'fuse' | 'unfuse' | 'merge' | 'item' | 'sell'

const ICON_PATHS: Record<IconName, React.ReactNode> = {
  // A pencil.
  edit: (
    <>
      <path d="M4 20h4L19 9l-4-4L4 16v4z" />
      <path d="M13.5 6.5l4 4" />
    </>
  ),
  // A shield - admin only.
  admin: (
    <>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  // Two arrows climbing - evolving.
  evolve: (
    <>
      <path d="M7 14l5-5 5 5" />
      <path d="M7 20l5-5 5 5" />
    </>
  ),
  // Two arrows chasing each other round - changing form.
  form: (
    <>
      <path d="M20 12a8 8 0 0 1-13.7 5.6" />
      <path d="M4 12a8 8 0 0 1 13.7-5.6" />
      <path d="M18 3v4h-4" />
      <path d="M6 21v-4h4" />
    </>
  ),
  // Two links joined - fusing.
  fuse: (
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </>
  ),
  // Two links pulled apart - unfusing.
  unfuse: (
    <>
      <path d="M15.5 11.5l3-3a4 4 0 0 0-5.7-5.7l-3 3" />
      <path d="M8.5 12.5l-3 3a4 4 0 0 0 5.7 5.7l3-3" />
      <path d="M4 4l3 3M20 20l-3-3" />
    </>
  ),
  // A star - merging adds stars.
  merge: <path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9L12 3z" />,
  // Arrows out of a box - moving the held item.
  item: (
    <>
      <path d="M4 8h12" />
      <path d="M12 4l4 4-4 4" />
      <path d="M20 16H8" />
      <path d="M12 12l-4 4 4 4" />
    </>
  ),
  // A coin - selling.
  sell: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.5 16V8h3a2.5 2.5 0 0 1 0 5h-3" />
      <path d="M8 11h6" />
    </>
  )
}

export function MenuIcon({ name }: { name: IconName }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="pkmn-menu-icon" aria-hidden="true">
      {ICON_PATHS[name]}
    </svg>
  )
}
