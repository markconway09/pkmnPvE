import { useEffect, useState } from 'react'
import type { ShopItemEntry } from '../../shared/battle-types'
import ItemSprite from './ItemSprite'
import BuyButton, { BuyButtonGroup } from './BuyButton'
import RarityCard, { RarityGlow, priceRarityTier } from './RarityCard'
import SearchBar from './SearchBar'
import { formatMoney } from './money'
import { errorMessage, pointOf, useFloatingNotes, type NotePoint } from './FloatingNotes'
import ModalSpinner from './ModalSpinner'
import { shopTotal } from '../../shared/battle-types'

// The bulk buttons joined onto each item's own buy button.
const BULK_AMOUNTS = [5, 10]

interface Props {
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

/** The Shop tab of the Bag | Shop window (see BagShopModal). */
function ShopPanel({ onMoneyChange }: Props): React.JSX.Element {
  const [catalog, setCatalog] = useState<ShopItemEntry[] | null>(null)
  const [money, setMoney] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  // A bulk button under the mouse: its item's buy button shows that many's total meanwhile.
  const notes = useFloatingNotes()

  useEffect(() => {
    Promise.all([window.api.listShop(), window.api.getMoney()])
      .then(([items, m]) => {
        setCatalog(items)
        setMoney(m)
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  async function buy(item: ShopItemEntry, count: number, at: NotePoint): Promise<void> {
    setBusyId(item.id)
    try {
      const result = await window.api.buyItem(item.id, count)
      setMoney(result.money)
      onMoneyChange(result.money)
      if (!result.success) notes.show('Not enough money for that', at, 'bad')
      else notes.show(`Bought ${count > 1 ? `${count}× ` : ''}${item.name} for ${formatMoney(shopTotal(item, count))}`, at)
    } catch (e) {
      notes.show(errorMessage(e), at, 'bad')
    } finally {
      setBusyId(null)
    }
  }

  const filtered = catalog?.filter((i) => i.name.toLowerCase().includes(query.trim().toLowerCase())) ?? []
  const groups = groupByCategory(filtered)

  return (
    <>
      {error && <p className="editor-error">{error}</p>}
      {!catalog && !error && <ModalSpinner />}
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
              <div className="item-card-grid">
                {items.map((item) => (
                  <ShopCard
                    key={item.id}
                    item={item}
                    money={money}
                    busy={busyId !== null}
                    onBuy={(e, count) => void buy(item, count, pointOf(e))}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {notes.layer}
    </>
  )
}

interface ShopCardProps {
  item: ShopItemEntry
  money: number | null
  busy: boolean
  onBuy: (e: React.MouseEvent, count: number) => void
}

// One item for sale: a RarityCard in its price's colour, the item in its glow, its name,
// then a buy bar - one for its price, with x5 and x10 joined on (like the Coin Shop's prizes).
function ShopCard({ item, money, busy, onBuy }: ShopCardProps): React.JSX.Element {
  return (
    <RarityCard tier={priceRarityTier(item.price)} lift className="shop-card" title={item.description}>
      {/* Tycoon's bulk discount, from 5 at once. */}
      {item.bulkPrice !== undefined && <span className="item-card-tag">-25% ×5+</span>}
      <RarityGlow size={56}>
        <ItemSprite spritenum={item.spritenum} className="item-card-icon" />
      </RarityGlow>
      <span className="item-card-name">{item.name}</span>
      <BuyButtonGroup>
        <BuyButton
          price={shopTotal(item, 1)}
          currency="money"
          held={money}
          busy={busy}
          title={`Buy one for ${formatMoney(item.price)}`}
          onBuy={(e) => onBuy(e, 1)}
        />
        {BULK_AMOUNTS.map((n) => (
          <BuyButton
            key={n}
            compact
            price={shopTotal(item, n)}
            currency="money"
            held={money}
            busy={busy}
            label={`×${n}`}
            title={`Buy ${n} for ${formatMoney(shopTotal(item, n))}`}
            onBuy={(e) => onBuy(e, n)}
          />
        ))}
      </BuyButtonGroup>
    </RarityCard>
  )
}

export default ShopPanel
