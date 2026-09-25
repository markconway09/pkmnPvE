import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { FOSSIL_RESTORE_COST } from '../../shared/battle-types'
import type { BagItemView, OpenItemResult, RestoreFossilResult } from '../../shared/battle-types'
import ItemSprite from './ItemSprite'
import GalarFossilPrompt from './GalarFossilPrompt'
import ContextMenuPanel from './ContextMenuPanel'
import CaseOpening from './CaseOpening'
import { formatMoney } from './money'

interface Props {
  onClose: () => void
  // Selling or restoring changes the wallet and (for a restore) the box, both
  // of which the main menu is showing behind this.
  onChanged: () => void
}

interface MenuState {
  item: BagItemView
  x: number
  y: number
}

// The bag arrives already sorted by category then name, so a run of matching
// categories can just be grouped in order (the shop does the same).
function groupByCategory(items: BagItemView[]): [string, BagItemView[]][] {
  const groups: [string, BagItemView[]][] = []
  for (const item of items) {
    const last = groups[groups.length - 1]
    if (last && last[0] === item.category) last[1].push(item)
    else groups.push([item.category, [item]])
  }
  return groups
}

function BagModal({ onClose, onChanged }: Props): React.JSX.Element {
  const [items, setItems] = useState<BagItemView[] | null>(null)
  const [money, setMoney] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [galarFossil, setGalarFossil] = useState<BagItemView | null>(null)
  const [busy, setBusy] = useState(false)
  // A Random Pokemon / Random Legendary being opened, shown as a spinning case.
  const [opening, setOpening] = useState<{ item: BagItemView; result: OpenItemResult; seq: number } | null>(null)

  async function refresh(): Promise<void> {
    try {
      const [bag, wallet] = await Promise.all([window.api.listBag(), window.api.getMoney()])
      setItems(bag)
      setMoney(wallet)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  // Runs one bag action and reports its outcome above the grid.
  async function act(action: () => Promise<string>): Promise<void> {
    setMenu(null)
    setBusy(true)
    setError(null)
    try {
      setMessage(await action())
      await refresh()
      onChanged()
    } catch (e) {
      setMessage(null)
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  function sell(item: BagItemView): Promise<void> {
    return act(async () => {
      const result = await window.api.sellItem(item.id)
      return `Sold ${item.name} for ${formatMoney(result.sold)}.`
    })
  }

  // Not through act(): the case animation reveals what came out, so the message - and
  // the refresh that would show the new Pokemon in the box behind it - wait until it's closed.
  // The bag message for the case just closed (or just moved on from).
  function reportOpening(soldFor?: number): void {
    if (!opening) return
    const itemName = opening.item.name
    const { result } = opening
    if (result.kind === 'item' && soldFor !== undefined) {
      setMessage(`Opened ${itemName}: you got ${result.name} and sold it for ${formatMoney(soldFor)}.`)
    } else if (result.kind === 'item') {
      setMessage(`Opened ${itemName}: you got ${result.name} - it's in your bag.`)
    } else {
      const got = result.shiny ? `a ✨shiny✨ ${result.name}` : result.name
      setMessage(`Opened ${itemName}: you got ${got} (Lv ${result.level}) - it's waiting in your box.`)
    }
  }

  async function openItem(item: BagItemView): Promise<void> {
    setMenu(null)
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const result = await window.api.openBagItem(item.id)
      // A fresh case each time (seq), even when opening the same item again.
      setOpening((prev) => ({ item, result, seq: (prev?.seq ?? 0) + 1 }))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  function useExpCandy(item: BagItemView): Promise<void> {
    return act(async () => {
      const results = await window.api.useExpCandy(item.id)
      const gained = results.filter((r) => !r.cappedOut)
      const levelUps = gained.filter((r) => r.levelAfter > r.levelBefore).map((r) => `${r.species} → Lv ${r.levelAfter}`)
      const capped = results.length - gained.length
      return [
        `Used ${item.name}: ${gained.length} Pokemon gained ${item.teamExp?.toLocaleString('en-US')} exp.`,
        levelUps.length > 0 ? levelUps.join(', ') + '.' : '',
        capped > 0 ? `${capped} at the level cap got nothing.` : ''
      ]
        .filter(Boolean)
        .join(' ')
    })
  }

  function restoreSingle(item: BagItemView): Promise<void> {
    return act(async () => describeRestore(await window.api.restoreFossil(item.id)))
  }

  function describeRestore(result: RestoreFossilResult): string {
    const got = result.shiny ? `a ✨shiny✨ ${result.species}` : result.species
    return `Restored ${got} (Lv ${result.level}) - it's waiting in your box.`
  }

  function openMenu(e: React.MouseEvent, item: BagItemView): void {
    e.preventDefault()
    setMenu({ item, x: e.clientX, y: e.clientY })
  }

  const canAffordRestore = money >= FOSSIL_RESTORE_COST

  return createPortal(
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-panel bag-modal" onMouseDown={(e) => e.stopPropagation()}>
        <h2>Bag</h2>
        <p className="box-empty-hint">Click an item to use, sell or open it, or restore a fossil.</p>
        {error && <p className="editor-error">{error}</p>}
        {message && <p className="bag-message">{message}</p>}
        {!items && !error && <p>Loading...</p>}
        {items && items.length === 0 && <p className="box-empty-hint">Your bag is empty.</p>}
        {items && items.length > 0 && (
          <div className="bag-scroll">
            {groupByCategory(items).map(([category, group]) => (
              <div key={category}>
                <h3 className="shop-category-heading">{category}</h3>
                <div className="bag-grid">
                  {group.map((item) => (
                    <div
                      key={item.id}
                      className="bag-item"
                      title={item.description}
                      onContextMenu={(e) => openMenu(e, item)}
                      onClick={(e) => openMenu(e, item)}
                    >
                      <ItemSprite spritenum={item.spritenum} className="bag-item-icon" />
                      <span className="bag-item-name">{item.name}</span>
                      <span className="bag-item-qty">x{item.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="editor-actions">
          <button onClick={onClose}>Close</button>
        </div>

        {/* Inside the panel (not beside it) so a click on either one's
            backdrop stops here instead of also closing the bag. */}
        {menu && (
          <div
            className="context-menu-overlay"
            onMouseDown={() => setMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault()
              setMenu(null)
            }}
          >
            <ContextMenuPanel key={menu.item.id} x={menu.x} y={menu.y}>
              <div className="context-menu-title">{menu.item.name}</div>
              {menu.item.teamExp !== null && (
                <button className="context-menu-item" disabled={busy} onClick={() => void useExpCandy(menu.item)}>
                  Use on team (+{menu.item.teamExp.toLocaleString('en-US')} exp each)
                </button>
              )}
              {menu.item.opens && (
                <button className="context-menu-item" disabled={busy} onClick={() => void openItem(menu.item)}>
                  Open
                </button>
              )}
              {menu.item.fossil === 'single' && (
                <button
                  className="context-menu-item"
                  disabled={busy || !canAffordRestore}
                  title={canAffordRestore ? undefined : `Restoring costs ${formatMoney(FOSSIL_RESTORE_COST)}`}
                  onClick={() => void restoreSingle(menu.item)}
                >
                  Restore into {menu.item.restoresTo} ({formatMoney(FOSSIL_RESTORE_COST)})
                </button>
              )}
              {menu.item.fossil === 'galar' && (
                <button
                  className="context-menu-item"
                  disabled={busy || !canAffordRestore}
                  title={canAffordRestore ? undefined : `Restoring costs ${formatMoney(FOSSIL_RESTORE_COST)}`}
                  onClick={() => {
                    setGalarFossil(menu.item)
                    setMenu(null)
                  }}
                >
                  Restore with another fossil... ({formatMoney(FOSSIL_RESTORE_COST)})
                </button>
              )}
              {menu.item.sellPrice !== null ? (
                <button className="context-menu-item" disabled={busy} onClick={() => void sell(menu.item)}>
                  Sell for {formatMoney(menu.item.sellPrice)}
                </button>
              ) : (
                <button className="context-menu-item" disabled title="The shop doesn't buy this">
                  Can&apos;t be sold
                </button>
              )}
            </ContextMenuPanel>
          </div>
        )}

        {opening && (
          <CaseOpening
            key={opening.seq}
            itemName={opening.item.name}
            result={opening.result}
            onClose={(soldFor) => {
              reportOpening(soldFor)
              setOpening(null)
              void refresh()
              onChanged()
            }}
            onOpenAnother={(soldFor) => {
              reportOpening(soldFor)
              void openItem(opening.item)
            }}
          />
        )}
        {galarFossil && (
          <GalarFossilPrompt
            fossil={galarFossil}
            money={money}
            onClose={() => setGalarFossil(null)}
            onRestored={(result) => {
              setGalarFossil(null)
              setError(null)
              setMessage(describeRestore(result))
              void refresh()
              onChanged()
            }}
          />
        )}
      </div>
    </div>,
    document.body
  )
}

export default BagModal
