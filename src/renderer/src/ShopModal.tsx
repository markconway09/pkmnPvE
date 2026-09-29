import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ShopItemEntry } from '../../shared/battle-types'
import ItemSprite from './ItemSprite'
import SearchBar from './SearchBar'
import BagShopTabs from './BagShopTabs'
import { formatMoney } from './money'
import { errorMessage, pointOf, useFloatingNotes, type NotePoint } from './FloatingNotes'
import ContextMenuPanel from './ContextMenuPanel'

// How many at a time the item menu offers to buy.
const BUY_AMOUNTS = [1, 5, 10]

interface Props {
  onClose: () => void
  onMoneyChange: (money: number) => void
  // Switches over to the Bag (the tab at the top).
  onOpenBag: () => void
}

// The catalog arrives pre-sorted by category then name, so a run of matching
// categories can just be grouped sequentially instead of re-sorting here.
function groupByCategory(items: ShopItemEntry[]): [string, ShopItemEntry[]][] {
  const groups: [string, ShopItemEntry[]][] = []
  for (const item of items) {
    const last = groups[groups.length - 1]
    if (last && last[0] === item.category) last[1].push(item)
    else groups.push([item.category, [item]])
  }
  return groups
}

function ShopModal({ onClose, onMoneyChange, onOpenBag }: Props): React.JSX.Element {
  const [catalog, setCatalog] = useState<ShopItemEntry[] | null>(null)
  const [money, setMoney] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [menu, setMenu] = useState<{ item: ShopItemEntry; x: number; y: number; at: NotePoint } | null>(null)
  const notes = useFloatingNotes()

  useEffect(() => {
    Promise.all([window.api.listShop(), window.api.getMoney()])
      .then(([items, m]) => {
        setCatalog(items)
        setMoney(m)
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  function openMenu(e: React.MouseEvent, item: ShopItemEntry): void {
    e.preventDefault()
    setMenu({ item, x: e.clientX, y: e.clientY, at: pointOf(e) })
  }

  async function buy(item: ShopItemEntry, count: number, at: NotePoint): Promise<void> {
    setBusyId(item.id)
    try {
      const result = await window.api.buyItem(item.id, count)
      setMoney(result.money)
      onMoneyChange(result.money)
      if (!result.success) notes.show('Not enough money for that', at, 'bad')
      else notes.show(`Bought ${count > 1 ? `${count}× ` : ''}${item.name} for ${formatMoney(item.price * count)}`, at)
    } catch (e) {
      notes.show(errorMessage(e), at, 'bad')
    } finally {
      setBusyId(null)
    }
  }

  const filtered = catalog?.filter((i) => i.name.toLowerCase().includes(query.trim().toLowerCase())) ?? []
  const groups = groupByCategory(filtered)

  return createPortal(
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-panel shop-modal" onMouseDown={(e) => e.stopPropagation()}>
        <BagShopTabs current="shop" onSwitch={onOpenBag} />
        {error && <p className="editor-error">{error}</p>}
        {!catalog && !error && <p>Loading...</p>}
        {catalog && (
          <div className="bag-toolbar">
            <SearchBar value={query} onChange={setQuery} placeholder="Search the shop..." autoFocus />
            {money !== null && <span className="money-display">{formatMoney(money)}</span>}
          </div>
        )}
        {catalog && filtered.length === 0 && <p className="box-empty-hint">No items match.</p>}
        {catalog && (
          <div className="bag-scroll">
            {groups.map(([category, items]) => (
              <div key={category}>
                <h3 className="shop-category-heading">{category}</h3>
                <div className="bag-grid">
                  {items.map((item) =>
                    item.keyItem ? (
                      // A key item isn't sold: it shows whether you have it, or what unlocks it.
                      <div
                        key={item.id}
                        className={`bag-item shop-key-item${item.keyItem.owned ? ' shop-key-item-owned' : ''}`}
                        title={`${item.description}\n\n${item.keyItem.owned ? 'You have it.' : `Unlocked by the achievement "${item.keyItem.unlockedBy}".`}`}
                      >
                        <ItemSprite spritenum={item.spritenum} className="bag-item-icon shop-item-icon" />
                        <span className="bag-item-name">{item.name}</span>
                        <span className="shop-key-item-status">{item.keyItem.owned ? '✓ Owned' : '🔒 Achievement'}</span>
                      </div>
                    ) : (
                      <div
                        key={item.id}
                        className={`bag-item shop-buyable${money !== null && money < item.price ? ' shop-unaffordable' : ''}`}
                        title={item.description}
                        onClick={(e) => openMenu(e, item)}
                        onContextMenu={(e) => openMenu(e, item)}
                      >
                        <ItemSprite spritenum={item.spritenum} className="bag-item-icon" />
                        <span className="bag-item-name">{item.name}</span>
                        <span className="shop-item-price">{formatMoney(item.price)}</span>
                      </div>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="editor-actions">
          <button onClick={onClose}>Close</button>
        </div>

        {/* Clicking an item: buy one or several, like the bag's menu. */}
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
              {BUY_AMOUNTS.map((count) => (
                <button
                  key={count}
                  className="context-menu-item"
                  disabled={busyId !== null || (money !== null && money < menu.item.price * count)}
                  onClick={() => {
                    const { item } = menu
                    setMenu(null)
                    void buy(item, count, menu.at)
                  }}
                >
                  Buy {count > 1 ? `${count} ` : ''}for {formatMoney(menu.item.price * count)}
                </button>
              ))}
            </ContextMenuPanel>
          </div>
        )}
        {notes.layer}
      </div>
    </div>,
    document.body
  )
}

export default ShopModal
