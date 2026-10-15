import { useState } from 'react'
import { createPortal } from 'react-dom'
import ContextMenuPanel from './ContextMenuPanel'
import ItemSprite from './ItemSprite'
import ShinyIcon from './ShinyIcon'
import { MenuIcon, PokemonMenuAction, PokemonMenuHeader, PokemonMenuSection } from './PokemonMenuParts'
import type { BoxPokemonView, EvolutionItemUse } from '../../shared/battle-types'
import { formatMoney } from './money'
import { clickWord, itemName, t } from './i18n'

// The Poke Ball item icon - an evolution already in the Pokedex.
const POKE_BALL_SPRITENUM = 345
// The Shiny Patch's icon (see ItemSprite).
const SHINY_PATCH_SPRITENUM = -8
// The Friendship Petal's icon (see ItemSprite).
const FRIENDSHIP_PETAL_SPRITENUM = -31

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
  // Friendship not maxed and Friendship Petals in the bag: how many (see BoxPokemonView.friendshipPetals).
  friendshipPetals?: number
  onUseFriendshipPetal?: () => void
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
  friendshipPetals,
  onUseFriendshipPetal,
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

        <PokemonMenuSection label={t('pm.manage')}>
          {onEdit && (
            <PokemonMenuAction tone="edit" icon={<MenuIcon name="edit" />} label={t('pm.edit')} detail={t('pm.editDetail')} onClick={onEdit} />
          )}
          {onAdminEdit && (
            <PokemonMenuAction
              tone="admin"
              icon={<MenuIcon name="admin" />}
              label={t('pm.adminEdit')}
              detail={t('pm.adminDetail')}
              onClick={onAdminEdit}
            />
          )}
          {onMerge && mergeCount > 0 && (
            <PokemonMenuAction
              tone="merge"
              icon={<MenuIcon name="merge" />}
              label={t('pm.merge')}
              detail={t('pm.duplicates', { count: mergeCount })}
              onClick={onMerge}
            />
          )}
        </PokemonMenuSection>

        <PokemonMenuSection label={t('pm.transform')}>
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
                      {t('pm.evolveInto', { name: target })}
                      {registered.includes(target) && (
                        <span className="context-menu-caught" title={t('pm.inDex')}>
                          <ItemSprite spritenum={POKE_BALL_SPRITENUM} />
                        </span>
                      )}
                    </>
                  }
                  detail={
                    item && (
                      <>
                        <ItemSprite spritenum={item.spritenum} />
                        {t('pm.uses', { item: itemName(item.name), n: item.quantity })}
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
              label={t('pm.changeForm')}
              detail={t('pm.forms', { count: formChanges.forms.length, item: itemName(formChanges.itemName) })}
              onClick={onOpenForms}
            />
          )}
          {onFuse &&
            fusions.map((fusion) => (
              <PokemonMenuAction
                key={fusion.partnerId}
                tone="fuse"
                icon={<MenuIcon name="fuse" />}
                label={t('pm.fuseInto', { name: fusion.result })}
                detail={t('pm.fuseWith', {
                  name: `${fusion.partnerFavorite ? '❤️ ' : ''}${fusion.partnerSpecies}`,
                  level: fusion.partnerLevel,
                  item: itemName(fusion.itemName)
                })}
                onClick={() => onFuse(fusion.partnerId)}
              />
            ))}
          {onUnfuse && unfuse && (
            <PokemonMenuAction
              tone="fuse"
              icon={<MenuIcon name="unfuse" />}
              label={t('pm.unfuse')}
              detail={t('pm.unfuseDetail', { name: unfuse.partnerSpecies, item: itemName(unfuse.itemName) })}
              onClick={onUnfuse}
            />
          )}
          {canUseShinyPatch && onUseShinyPatch && (
            <PokemonMenuAction
              tone="shiny"
              icon={<ShinyIcon />}
              label={confirmingPatch ? t('pm.shinyConfirm', { click: clickWord() }) : t('pm.turnShiny')}
              detail={
                <>
                  <ItemSprite spritenum={SHINY_PATCH_SPRITENUM} />
                  {t('pm.usesPatch')}
                  {shinyPatches !== undefined && ` (×${shinyPatches})`}
                </>
              }
              confirming={confirmingPatch}
              onClick={() => {
                if (!confirmingPatch) setConfirmingPatch(true)
                else onUseShinyPatch()
              }}
            />
          )}
          {friendshipPetals !== undefined && onUseFriendshipPetal && (
            <PokemonMenuAction
              tone="item"
              icon={<ItemSprite spritenum={FRIENDSHIP_PETAL_SPRITENUM} />}
              label={t('pm.maxFriendship')}
              detail={t('pm.usesPetal', { n: friendshipPetals })}
              onClick={onUseFriendshipPetal}
            />
          )}
        </PokemonMenuSection>

        {onSell && sellPrice !== undefined && (
          <PokemonMenuSection>
            <PokemonMenuAction
              tone="sell"
              icon={<MenuIcon name="sell" />}
              label={confirmingSell ? t('pm.sellConfirm', { click: clickWord() }) : t('pm.sell')}
              detail={
                confirmingSell
                  ? t(shiny ? 'pm.sellThisShiny' : 'pm.sellThis', { name: species, money: formatMoney(sellPrice) })
                  : formatMoney(sellPrice)
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
