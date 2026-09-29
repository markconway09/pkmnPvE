import { useState } from 'react'
import { createPortal } from 'react-dom'
import ContextMenuPanel from './ContextMenuPanel'
import ItemSprite from './ItemSprite'
import type { BoxPokemonView, EvolutionItemUse } from '../../shared/battle-types'

// The Poke Ball item icon - an evolution already in the Pokedex.
const POKE_BALL_SPRITENUM = 345

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
  // With a form-change item (Rotom Catalog, Prison Bottle...): the forms it can change into.
  formChanges?: BoxPokemonView['formChanges']
  onChangeForm?: (form: string) => void
  // Fusing with a partner from the box, or splitting back up (see BoxPokemonView).
  fusions?: BoxPokemonView['fusions']
  onFuse?: (partnerId: string) => void
  unfuse?: BoxPokemonView['unfuse']
  onUnfuse?: () => void
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
  formChanges,
  onChangeForm,
  fusions = [],
  onFuse,
  unfuse,
  onUnfuse,
  onEdit,
  onAdminEdit,
  onSell,
  sellPrice,
  sellNeedsConfirm = false,
  shiny = false,
  onClose
}: Props): React.JSX.Element {
  const [confirmingSell, setConfirmingSell] = useState(false)
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
        {onAdminEdit && (
          <button className="context-menu-item" onClick={onAdminEdit}>
            Admin Edit
          </button>
        )}
        {canUseShinyPatch && onUseShinyPatch && (
          <button className="context-menu-item" onClick={onUseShinyPatch}>
            ✨ Turn Shiny (use Shiny Patch)
          </button>
        )}
        {onChangeForm &&
          formChanges?.ready &&
          formChanges.forms.map((form) => (
            <button
              key={form}
              className="context-menu-item"
              title={`Use the ${formChanges.itemName}`}
              onClick={() => onChangeForm(form)}
            >
              <span className="context-menu-evo-target">
                <ItemSprite spritenum={formChanges.spritenum} />
                Change into {form}
              </span>
            </button>
          ))}
        {onFuse &&
          fusions.map((fusion) => (
            <button key={fusion.partnerId} className="context-menu-item" onClick={() => onFuse(fusion.partnerId)}>
              <span className="context-menu-evo-target">
                Fuse with {fusion.partnerSpecies} (Lv{fusion.partnerLevel}) → {fusion.result}
              </span>
              <span className="context-menu-evo-item">use the {fusion.itemName}</span>
            </button>
          ))}
        {onUnfuse && unfuse && (
          <button className="context-menu-item" onClick={onUnfuse}>
            <span className="context-menu-evo-target">Unfuse (get {unfuse.partnerSpecies} back)</span>
            <span className="context-menu-evo-item">use the {unfuse.itemName}</span>
          </button>
        )}
        {onChoose &&
          evolutions.map((target) => {
            const item = evolutionItems[target]
            return (
              <button key={target} className="context-menu-item" onClick={() => onChoose(target)}>
                <span className="context-menu-evo-target">
                  Evolve into {target}
                  {registered.includes(target) && (
                    <span className="context-menu-caught" title="Already in your Pokédex">
                      <ItemSprite spritenum={POKE_BALL_SPRITENUM} />
                    </span>
                  )}
                </span>
                {item && (
                  <span className="context-menu-evo-item">
                    <ItemSprite spritenum={item.spritenum} />
                    use {item.name} (×{item.quantity})
                  </span>
                )}
              </button>
            )
          })}
        {onSell && sellPrice !== undefined && (
          <button
            className={`context-menu-item context-menu-sell${confirmingSell ? ' context-menu-confirm' : ''}`}
            onClick={() => {
              if (sellNeedsConfirm && !confirmingSell) setConfirmingSell(true)
              else onSell()
            }}
          >
            {confirmingSell
              ? `Sell ${shiny ? 'this shiny ' : ''}${species}? Click again`
              : `Sell for ₽${sellPrice.toLocaleString('en-US')}`}
          </button>
        )}
      </ContextMenuPanel>
    </div>,
    document.body
  )
}

export default PokemonContextMenu
