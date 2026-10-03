import { useState } from 'react'
import { createPortal } from 'react-dom'
import ContextMenuPanel from './ContextMenuPanel'
import ItemSprite from './ItemSprite'
import ShinyIcon from './ShinyIcon'
import { MenuIcon, PokemonMenuAction, PokemonMenuHeader, PokemonMenuSection } from './PokemonMenuParts'
import type { BoxPokemonView, EvolutionItemUse } from '../../shared/battle-types'

// The Poke Ball item icon - an evolution already in the Pokedex.
const POKE_BALL_SPRITENUM = 345
// The Shiny Patch's icon (see ItemSprite).
const SHINY_PATCH_SPRITENUM = -8

interface Props {
  x: number
  y: number
  species: string
  // Every entry below only appears when its handler (or list) is given, so the
  // same menu serves the player's box (all of it) and a trainer roster (just
  // Admin Edit).
  evolutions?: string[]
  // What each item evolution would use up (see BoxPokemonView.evolutionItems).
  evolutionItems?: Record<string, EvolutionItemUse>
  // Evolutions already in the Pokedex (see BoxPokemonView.registeredEvolutions).
  registeredEvolutions?: string[]
  onChoose?: (targetSpecies: string) => void
  canUseShinyPatch?: boolean
  onUseShinyPatch?: () => void
  // How many Shiny Patches the bag holds.
  shinyPatches?: number
  // With a form-change item (Rotom Catalog, Prison Bottle...): the forms it can change into.
  // One Change Form entry opens the editor at its Form changes section, so a Pokemon
  // with many forms (Rotom, Alcremie) doesn't stretch the menu.
  formChanges?: BoxPokemonView['formChanges']
  onOpenForms?: () => void
  // Fusing with a partner from the box, or splitting back up (see BoxPokemonView).
  fusions?: BoxPokemonView['fusions']
  onFuse?: (partnerId: string) => void
  unfuse?: BoxPokemonView['unfuse']
  onUnfuse?: () => void
  // Its favorite heart, beside its name at the top - toggled straight away.
  favorite?: boolean
  onToggleFavorite?: () => void
  // Duplicates of it in the box: opens the merge window.
  mergeCount?: number
  onMerge?: () => void
  onEdit?: () => void
  // Only given to admins.
  onAdminEdit?: () => void
  // Sells it for sellPrice; a shiny or a red/gold Pokemon (sellNeedsConfirm) asks twice.
  onSell?: () => void
  sellPrice?: number
  sellNeedsConfirm?: boolean
  shiny?: boolean
  onClose: () => void
}

function PokemonContextMenu({
  x,
  y,
  species,
  evolutions = [],
  evolutionItems = {},
  registeredEvolutions: registered = [],
  onChoose,
  canUseShinyPatch = false,
  onUseShinyPatch,
  shinyPatches,
  formChanges,
  onOpenForms,
  fusions = [],
  onFuse,
  unfuse,
  onUnfuse,
  mergeCount = 0,
  onMerge,
  favorite = false,
  onToggleFavorite,
  onEdit,
  onAdminEdit,
  onSell,
  sellPrice,
  sellNeedsConfirm = false,
  shiny = false,
  onClose
}: Props): React.JSX.Element {
  const [confirmingSell, setConfirmingSell] = useState(false)
  // The Shiny Patch is used up, so it asks twice.
  const [confirmingPatch, setConfirmingPatch] = useState(false)
  // Shown straight away; the box catches up behind the menu.
  const [isFavorite, setIsFavorite] = useState(favorite)
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
        <PokemonMenuHeader
          species={species}
          shiny={shiny}
          favorite={isFavorite}
          onToggleFavorite={
            onToggleFavorite &&
            (() => {
              setIsFavorite(!isFavorite)
              onToggleFavorite()
            })
          }
        />

        <PokemonMenuSection label="Manage">
          {onEdit && <PokemonMenuAction tone="edit" icon={<MenuIcon name="edit" />} label="Edit" detail="Moves, item, ability and more" onClick={onEdit} />}
          {onAdminEdit && <PokemonMenuAction tone="admin" icon={<MenuIcon name="admin" />} label="Admin Edit" detail="Change anything" onClick={onAdminEdit} />}
          {onMerge && mergeCount > 0 && (
            <PokemonMenuAction
              tone="merge"
              icon={<MenuIcon name="merge" />}
              label="Merge"
              detail={`${mergeCount} duplicate${mergeCount === 1 ? '' : 's'} in your box`}
              onClick={onMerge}
            />
          )}
        </PokemonMenuSection>

        <PokemonMenuSection label="Transform">
          {onChoose &&
            evolutions.map((target) => {
              const item = evolutionItems[target]
              return (
                <PokemonMenuAction
                  key={target}
                  tone="evolve"
                  icon={<MenuIcon name="evolve" />}
                  label={
                    <>
                      Evolve into {target}
                      {registered.includes(target) && (
                        <span className="context-menu-caught" title="Already in your Pokédex">
                          <ItemSprite spritenum={POKE_BALL_SPRITENUM} />
                        </span>
                      )}
                    </>
                  }
                  detail={
                    item && (
                      <>
                        <ItemSprite spritenum={item.spritenum} />
                        Uses {item.name} (×{item.quantity})
                      </>
                    )
                  }
                  onClick={() => onChoose(target)}
                />
              )
            })}
          {onOpenForms && formChanges?.ready && formChanges.forms.length > 0 && (
            <PokemonMenuAction
              tone="form"
              icon={<ItemSprite spritenum={formChanges.spritenum} />}
              label="Change Form"
              detail={`${formChanges.forms.length} form${formChanges.forms.length === 1 ? '' : 's'}, uses the ${formChanges.itemName}`}
              onClick={onOpenForms}
            />
          )}
          {onFuse &&
            fusions.map((fusion) => (
              <PokemonMenuAction
                key={fusion.partnerId}
                tone="fuse"
                icon={<MenuIcon name="fuse" />}
                label={`Fuse into ${fusion.result}`}
                detail={
                  <>
                    With {fusion.partnerFavorite && '❤️ '}
                    {fusion.partnerSpecies} (Lv{fusion.partnerLevel}), uses the {fusion.itemName}
                  </>
                }
                onClick={() => onFuse(fusion.partnerId)}
              />
            ))}
          {onUnfuse && unfuse && (
            <PokemonMenuAction
              tone="fuse"
              icon={<MenuIcon name="unfuse" />}
              label="Unfuse"
              detail={`Get ${unfuse.partnerSpecies} back, uses the ${unfuse.itemName}`}
              onClick={onUnfuse}
            />
          )}
          {canUseShinyPatch && onUseShinyPatch && (
            <PokemonMenuAction
              tone="shiny"
              icon={<ShinyIcon />}
              label={confirmingPatch ? 'Click again to turn Shiny' : 'Turn Shiny'}
              detail={
                <>
                  <ItemSprite spritenum={SHINY_PATCH_SPRITENUM} />
                  Uses up a Shiny Patch{shinyPatches !== undefined && ` (×${shinyPatches})`}
                </>
              }
              confirming={confirmingPatch}
              onClick={() => {
                if (!confirmingPatch) setConfirmingPatch(true)
                else onUseShinyPatch()
              }}
            />
          )}
        </PokemonMenuSection>

        {onSell && sellPrice !== undefined && (
          <PokemonMenuSection>
            <PokemonMenuAction
              tone="sell"
              icon={<MenuIcon name="sell" />}
              label={confirmingSell ? 'Click again to sell' : 'Sell'}
              detail={
                confirmingSell
                  ? `This ${shiny ? 'shiny ' : ''}${species}, for ₽${sellPrice.toLocaleString('en-US')}`
                  : `₽${sellPrice.toLocaleString('en-US')}`
              }
              confirming={confirmingSell}
              onClick={() => {
                if (sellNeedsConfirm && !confirmingSell) setConfirmingSell(true)
                else onSell()
              }}
            />
          </PokemonMenuSection>
        )}
      </ContextMenuPanel>
    </div>,
    document.body
  )
}

export default PokemonContextMenu
