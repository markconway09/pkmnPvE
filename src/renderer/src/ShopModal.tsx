import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ShopItemEntry } from '../../shared/battle-types'
import ItemSprite from './ItemSprite'
import SearchBar from './SearchBar'
import { formatMoney } from './money'
import { pointOf, useFloatingNotes, type NotePoint } from './FloatingNotes'

interface Props {
  onClose: () => void
  onMoneyChange: (money: number) => void
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

function ShopModal({ onClose, onMoneyChange }: Props): React.JSX.Element {
  const [catalog, setCatalog] = useState<ShopItemEntry[] | null>(null)
  const [money, setMoney] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const notes = useFloatingNotes()

  useEffect(() => {
    Promise.all([window.api.listShop(), window.api.getMoney()])
      .then(([items, m]) => {
        setCatalog(items)
        setMoney(m)
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  async function buy(item: ShopItemEntry, at: NotePoint): Promise<void> {
    const itemId = item.id
    setBusyId(itemId)
    setError(null)
    try {
      const result = await window.api.buyItem(itemId, 1)
      setMoney(result.money)
      onMoneyChange(result.money)
      if (!result.success) setError('Not enough money for that.')
      else notes.show(`Bought ${item.name} for ${formatMoney(item.price)}`, at)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusyId(null)
    }
  }

  const filtered = catalog?.filter((i) => i.name.toLowerCase().includes(query.trim().toLowerCase())) ?? []
  const groups = groupByCategory(filtered)

  return createPortal(
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-panel shop-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="shop-header">
          <h2>Shop</h2>
          {money !== null && <span className="money-display">{formatMoney(money)}</span>}
        </div>
        <SearchBar value={query} onChange={setQuery} placeholder="Search the shop..." autoFocus />
        {error && <p className="editor-error">{error}</p>}
        {!catalog && !error && <p>Loading...</p>}
        {catalog && filtered.length === 0 && <p className="box-empty-hint">No items match your search.</p>}
        {groups.map(([category, items]) => (
          <div key={category}>
            <h3 className="shop-category-heading">{category}</h3>
            <div className="shop-grid">
              {items.map((item) => (
                <div key={item.id} className="shop-item" title={item.description}>
                  <ItemSprite spritenum={item.spritenum} className="shop-item-icon" />
                  <span className="shop-item-name">{item.name}</span>
                  <span className="shop-item-price">{formatMoney(item.price)}</span>
                  <button
                    type="button"
                    disabled={busyId === item.id || (money !== null && money < item.price)}
                    onClick={(e) => void buy(item, pointOf(e))}
                  >
                    Buy
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
        <div className="editor-actions">
          <button onClick={onClose}>Close</button>
        </div>
        {notes.layer}
      </div>
    </div>,
    document.body
  )
}

export default ShopModal
