import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ShopPriceEntry } from '../../shared/battle-types'
import ItemSprite from './ItemSprite'
import { formatMoney } from './money'

interface Props {
  onClose: () => void
}

// The catalog arrives pre-sorted by category then name, so a run of matching
// categories can just be grouped sequentially instead of re-sorting here.
function groupByCategory(items: ShopPriceEntry[]): [string, ShopPriceEntry[]][] {
  const groups: [string, ShopPriceEntry[]][] = []
  for (const item of items) {
    const last = groups[groups.length - 1]
    if (last && last[0] === item.category) last[1].push(item)
    else groups.push([item.category, [item]])
  }
  return groups
}

/** Admin screen: the shop's stock with a price box on each item instead of a Buy button. */
function ShopPricesModal({ onClose }: Props): React.JSX.Element {
  const [catalog, setCatalog] = useState<ShopPriceEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  // What's typed in each box before it's saved (saved on Enter or leaving the box).
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  useEffect(() => {
    window.api
      .listShopPrices()
      .then(setCatalog)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  async function save(item: ShopPriceEntry, price: number | null): Promise<void> {
    setError(null)
    try {
      setCatalog(await window.api.setShopPrice(item.id, price))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setDrafts(({ [item.id]: _done, ...rest }) => rest)
    }
  }

  function commit(item: ShopPriceEntry): void {
    const draft = drafts[item.id]
    if (draft === undefined) return
    const price = Number(draft)
    if (draft.trim() === '' || !Number.isInteger(price) || price < 0) {
      setError('A price must be a whole number, 0 or more.')
      setDrafts(({ [item.id]: _bad, ...rest }) => rest)
      return
    }
    if (price !== item.price) void save(item, price === item.defaultPrice ? null : price)
    else setDrafts(({ [item.id]: _same, ...rest }) => rest)
  }

  const filtered = catalog?.filter((i) => i.name.toLowerCase().includes(query.trim().toLowerCase())) ?? []
  const groups = groupByCategory(filtered)
  const changedCount = catalog?.filter((i) => i.price !== i.defaultPrice).length ?? 0

  return createPortal(
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-panel shop-modal shop-prices-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="shop-header">
          <h2>Shop Prices</h2>
          <span className="box-empty-hint">{changedCount} changed</span>
        </div>
        <p className="box-empty-hint">Items sell back for half their price. Changes save as you go.</p>
        <input
          type="text"
          className="shop-search"
          placeholder="Search items..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {error && <p className="editor-error">{error}</p>}
        {!catalog && !error && <p>Loading...</p>}
        {catalog && filtered.length === 0 && <p className="box-empty-hint">No items match your search.</p>}
        {groups.map(([category, items]) => (
          <div key={category}>
            <h3 className="shop-category-heading">{category}</h3>
            <div className="shop-grid">
              {items.map((item) => {
                const changed = item.price !== item.defaultPrice
                return (
                  <div key={item.id} className={`shop-item${changed ? ' shop-item-changed' : ''}`} title={item.description}>
                    <ItemSprite spritenum={item.spritenum} className="shop-item-icon" />
                    <span className="shop-item-name">{item.name}</span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      className="shop-price-input"
                      value={drafts[item.id] ?? String(item.price)}
                      onChange={(e) => setDrafts((d) => ({ ...d, [item.id]: e.target.value }))}
                      onBlur={() => commit(item)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur()
                        if (e.key === 'Escape') setDrafts(({ [item.id]: _cancel, ...rest }) => rest)
                      }}
                    />
                    {changed ? (
                      <button type="button" className="shop-price-reset" onClick={() => void save(item, null)}>
                        Reset ({formatMoney(item.defaultPrice)})
                      </button>
                    ) : (
                      <span className="shop-price-default">default</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
        <div className="editor-actions">
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default ShopPricesModal
