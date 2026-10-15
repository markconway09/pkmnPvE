import { createPortal } from 'react-dom'
import ContextMenuPanel from './ContextMenuPanel'
import ItemSprite from './ItemSprite'
import { MenuIcon, PokemonMenuAction, PokemonMenuHeader, PokemonMenuSection } from './PokemonMenuParts'
import { itemName, t } from './i18n'

// The Poke Ball item icon - an evolution already in the Pokedex.
const POKE_BALL_SPRITENUM = 345

interface Props {
  x: number
  y: number
  species: string
  // What it can evolve into right now (see runEvolutionOptions on the main side).
  evolutions: string[]
  // Evolutions already in the Pokedex - marked with a Poke Ball.
  registeredEvolutions?: string[]
  onEvolve: (targetSpecies: string) => void
  // What it holds - "Move item" only shows when it holds something.
  heldItem: string | null
  heldItemSpritenum: number | null
  onMoveItem: () => void
  onEdit: () => void
  onClose: () => void
}

// Clicking (or right-clicking) a run Pokemon: edit its moves, evolve it, or move its
// held item.
function RunMonContextMenu({ x, y, species, evolutions, registeredEvolutions: registered = [], onEvolve, heldItem, heldItemSpritenum, onMoveItem, onEdit, onClose }: Props): React.JSX.Element {
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
        <PokemonMenuHeader species={species} />
        <PokemonMenuSection label={t('pm.manage')}>
          <PokemonMenuAction
            tone="edit"
            icon={<MenuIcon name="edit" />}
            label={t('runMenu.editMoves')}
            detail={t('runMenu.editDetail')}
            onClick={onEdit}
          />
          {heldItem && (
            <PokemonMenuAction
              tone="item"
              icon={heldItemSpritenum != null ? <ItemSprite spritenum={heldItemSpritenum} /> : <MenuIcon name="item" />}
              label={t('runMenu.moveItem')}
              detail={t('runMenu.moveItemDetail', { item: itemName(heldItem) })}
              onClick={onMoveItem}
            />
          )}
        </PokemonMenuSection>
        <PokemonMenuSection label={t('pm.transform')}>
          {evolutions.map((target) => (
            <PokemonMenuAction
              key={target}
              tone="evolve"
              icon={<MenuIcon name="evolve" />}
              label={
                <>
                  {t('pm.evolveInto', { name: target })}
                  {registered.includes(target) && (
                    <span className="context-menu-caught" title={t('pm.inDex')}>
                      <ItemSprite spritenum={POKE_BALL_SPRITENUM} />
                    </span>
                  )}
                </>
              }
              onClick={() => onEvolve(target)}
            />
          ))}
        </PokemonMenuSection>
      </ContextMenuPanel>
    </div>,
    document.body
  )
}

export default RunMonContextMenu
