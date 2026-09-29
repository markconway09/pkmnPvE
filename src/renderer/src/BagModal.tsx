import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FOSSIL_RESTORE_COST } from '../../shared/battle-types'
import type { BagItemView, OpenItemResult, RestoreFossilResult } from '../../shared/battle-types'
import ItemSprite from './ItemSprite'
import SearchBar from './SearchBar'
import GalarFossilPrompt from './GalarFossilPrompt'
import ContextMenuPanel from './ContextMenuPanel'
import CaseOpening from './CaseOpening'
import BagShopTabs from './BagShopTabs'
import { formatMoney } from './money'
import { errorMessage, pointOf, useFloatingNotes, type NotePoint } from './FloatingNotes'

interface Props {
  onClose: () => void
  // Selling or restoring changes the wallet and (for a restore) the box, both
  // of which the main menu is showing behind this.
  onChanged: () => void
  // Switches over to the Shop (the tab at the top).
  onOpenShop: () => void
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

function BagModal({ onClose, onChanged, onOpenShop }: Props): React.JSX.Element {
  const [items, setItems] = useState<BagItemView[] | null>(null)
  const [money, setMoney] = useState(0)
  const [error, setError] = useState<string | null>(null)
  // Results float up from whatever was last clicked (an item, or a sell button).
  const notes = useFloatingNotes()
  const lastPoint = useRef<NotePoint>({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
  const say = (text: string): void => notes.show(text, lastPoint.current)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [galarFossil, setGalarFossil] = useState<BagItemView | null>(null)
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState('')
  // Picking items to sell together: item id -> how many (the whole stack). Null when not picking.
  const [selection, setSelection] = useState<Map<string, number> | null>(null)
  // The context menu's "Sell [n]" amount.
  const [sellCount, setSellCount] = useState(1)
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
      say(await action())
      await refresh()
      onChanged()
    } catch (e) {
      // Shown where it was tried, in red - "Your whole team is already at the level cap"...
      notes.show(errorMessage(e), lastPoint.current, 'bad')
    } finally {
      setBusy(false)
    }
  }

  function sell(item: BagItemView, quantity = 1): Promise<void> {
    return act(async () => {
      const result = await window.api.sellItems([{ itemId: item.id, quantity }])
      return `Sold ${quantity > 1 ? `${quantity}× ` : ''}${item.name} for ${formatMoney(result.sold)}.`
    })
  }

  function toggleSelected(item: BagItemView): void {
    if (!selection || item.sellPrice === null) return
    const next = new Map(selection)
    if (next.has(item.id)) next.delete(item.id)
    else next.set(item.id, item.quantity)
    setSelection(next)
  }

  // Quick sell: picks every berry, and the Memories/Plates/Drives no owned Pokemon can use,
  // for a look before selling.
  async function startQuickSell(e: React.MouseEvent): Promise<void> {
    lastPoint.current = pointOf(e)
    setError(null)
    try {
      const picks = await window.api.quickSellSelection()
      if (picks.length === 0) {
        notes.show('Nothing for Quick sell - no berries, or Memories, Plates or Drives nobody can use.', lastPoint.current, 'bad')
        return
      }
      setSelection(new Map(picks.map((p) => [p.itemId, p.quantity])))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  function sellSelected(e: React.MouseEvent): Promise<void> {
    lastPoint.current = pointOf(e)
    const entries = [...(selection ?? [])].map(([itemId, quantity]) => ({ itemId, quantity }))
    const count = entries.reduce((sum, e) => sum + e.quantity, 0)
    return act(async () => {
      const result = await window.api.sellItems(entries)
      setSelection(null)
      return `Sold ${count} item${count === 1 ? '' : 's'} for ${formatMoney(result.sold)}.`
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
      say(`Opened ${itemName}: you got ${result.name} and sold it for ${formatMoney(soldFor)}.`)
    } else if (result.kind === 'item') {
      say(`Opened ${itemName}: you got ${result.name} - it's in your bag.`)
    } else {
      const got = result.shiny ? `a shiny ${result.name}` : result.name
      say(
        soldFor !== undefined
          ? `Opened ${itemName}: you got ${got} (Lv ${result.level}) and sold it for ${formatMoney(soldFor)}.`
          : `Opened ${itemName}: you got ${got} (Lv ${result.level}) - it's waiting in your box.`
      )
    }
  }

  async function openItem(item: BagItemView): Promise<void> {
    setMenu(null)
    setBusy(true)
    setError(null)
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

  // Exp. Candies one after another until the whole team is at the level cap, or they run out.
  function useExpCandiesUntilCap(item: BagItemView): Promise<void> {
    return act(async () => {
      const { used, results, allCapped } = await window.api.useExpCandiesUntilCap(item.id)
      const levelUps = results.filter((r) => r.levelAfter > r.levelBefore).map((r) => `${r.species} → Lv ${r.levelAfter}`)
      return [
        `Used ${used}× ${item.name}.`,
        levelUps.length > 0 ? levelUps.join(', ') + '.' : '',
        allCapped ? 'Your whole team is at the level cap.' : 'Out of candies.'
      ]
        .filter(Boolean)
        .join(' ')
    })
  }

  // A double-click does what the item is for: use a candy, open a capsule, restore a fossil.
  function useItem(e: React.MouseEvent, item: BagItemView): void {
    if (selection || busy) return
    lastPoint.current = pointOf(e)
    if (item.teamExp !== null) void useExpCandy(item)
    else if (item.opens) void openItem(item)
    else if (item.fossil === 'single' && canAffordRestore) void restoreSingle(item)
    else if (item.fossil === 'galar' && canAffordRestore) setGalarFossil(item)
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
    const got = result.shiny ? `a shiny ${result.species}` : result.species
    return `Restored ${got} (Lv ${result.level}) - it's waiting in your box.`
  }

  function openMenu(e: React.MouseEvent, item: BagItemView): void {
    e.preventDefault()
    lastPoint.current = pointOf(e)
    if (selection) {
      toggleSelected(item)
      return
    }
    setSellCount(1)
    setMenu({ item, x: e.clientX, y: e.clientY })
  }

  const canAffordRestore = money >= FOSSIL_RESTORE_COST
  const shown = items?.filter((i) => i.name.toLowerCase().includes(query.trim().toLowerCase())) ?? []
  const priceOf = new Map(items?.map((i) => [i.id, i.sellPrice ?? 0]) ?? [])
  const selectionTotal = [...(selection ?? [])].reduce((sum, [id, qty]) => sum + (priceOf.get(id) ?? 0) * qty, 0)
  const selectionCount = [...(selection ?? [])].reduce((sum, [, qty]) => sum + qty, 0)

  return createPortal(
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-panel bag-modal" onMouseDown={(e) => e.stopPropagation()}>
        <BagShopTabs current="bag" onSwitch={onOpenShop} />
        {error && <p className="editor-error">{error}</p>}
        {!items && !error && <p>Loading...</p>}
        {items && items.length === 0 && <p className="box-empty-hint">Your bag is empty.</p>}
        {items && items.length > 0 && (
          <div className="bag-toolbar">
            <SearchBar value={query} onChange={setQuery} placeholder="Search your bag..." autoFocus />
            {!selection && (
              <>
                <button disabled={busy} onClick={() => setSelection(new Map())}>
                  Select to sell
                </button>
                <button
                  disabled={busy}
                  title="Picks every berry, plus the Memories, Plates and Drives with no Silvally, Arceus or Genesect to use them"
                  onClick={(e) => void startQuickSell(e)}
                >
                  Quick sell
                </button>
              </>
            )}
          </div>
        )}
        {items && items.length > 0 && shown.length === 0 && <p className="box-empty-hint">No items match.</p>}
        {items && items.length > 0 && (
          <div className="bag-scroll">
            {groupByCategory(shown).map(([category, group]) => (
              <div key={category}>
                <h3 className="shop-category-heading">{category}</h3>
                <div className="bag-grid">
                  {group.map((item) => (
                    <div
                      key={item.id}
                      className={`bag-item${selection?.has(item.id) ? ' bag-item-selected' : ''}${selection && item.sellPrice === null ? ' bag-item-unsellable' : ''}`}
                      title={item.description}
                      onContextMenu={(e) => openMenu(e, item)}
                      // A left click only picks it while selecting items to sell.
                      onClick={(e) => selection && openMenu(e, item)}
                      onDoubleClick={(e) => useItem(e, item)}
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
        {selection ? (
          <div className="editor-actions bag-sell-bar">
            <span className="bag-sell-summary">
              {selectionCount} item{selectionCount === 1 ? '' : 's'} selected · {formatMoney(selectionTotal)}
            </span>
            <button disabled={busy} onClick={() => setSelection(null)}>
              Cancel
            </button>
            <button disabled={busy || selectionCount === 0} onClick={(e) => void sellSelected(e)}>
              Sell selected
            </button>
          </div>
        ) : (
          <div className="editor-actions">
            <button onClick={onClose}>Close</button>
          </div>
        )}

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
              {menu.item.teamExp !== null && (
                <button
                  className="context-menu-item"
                  disabled={busy}
                  title="Keeps using them until your whole team is at the level cap, or you run out"
                  onClick={() => void useExpCandiesUntilCap(menu.item)}
                >
                  Use until the level cap (×{menu.item.quantity} left)
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
                <>
                  <button className="context-menu-item" disabled={busy} onClick={() => void sell(menu.item)}>
                    Sell for {formatMoney(menu.item.sellPrice)}
                  </button>
                  {menu.item.quantity > 1 && (
                    <>
                      <div className="context-menu-item bag-sell-count" onMouseDown={(e) => e.stopPropagation()}>
                        Sell
                        <input
                          type="number"
                          min={1}
                          max={menu.item.quantity}
                          value={sellCount}
                          onChange={(e) =>
                            setSellCount(Math.max(1, Math.min(menu.item.quantity, Math.floor(Number(e.target.value)) || 1)))
                          }
                        />
                        <button disabled={busy} onClick={() => void sell(menu.item, sellCount)}>
                          {formatMoney(menu.item.sellPrice * sellCount)}
                        </button>
                      </div>
                      <button
                        className="context-menu-item"
                        disabled={busy}
                        onClick={() => void sell(menu.item, menu.item.quantity)}
                      >
                        Sell all ×{menu.item.quantity} for {formatMoney(menu.item.sellPrice * menu.item.quantity)}
                      </button>
                    </>
                  )}
                </>
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
              say(describeRestore(result))
              void refresh()
              onChanged()
            }}
          />
        )}
        {notes.layer}
      </div>
    </div>,
    document.body
  )
}

export default BagModal
