import { useEffect, useRef, useState } from 'react'
import { FOSSIL_RESTORE_COST, FRIENDSHIP_PETAL_ITEM_ID, QUICK_SELL_KEPT_BERRY_IDS, shopTotal } from '../../shared/battle-types'
import type { BagItemView, OpenItemResult, RarityTier, RestoreFossilResult, ShopItemEntry } from '../../shared/battle-types'
import ItemSprite from './ItemSprite'
import RarityCard, { RarityGlow, priceRarityTier } from './RarityCard'
import BuyButton, { BuyButtonGroup, SellButton } from './BuyButton'
import SearchBar from './SearchBar'
import GalarFossilPrompt from './GalarFossilPrompt'
import CaseOpening from './CaseOpening'
import { formatMoney, formatShort } from './money'
import { errorMessage, pointOf, useFloatingNotes, type NotePoint } from './FloatingNotes'
import ModalSpinner from './ModalSpinner'
import CategoryJumpBar from './CategoryJumpBar'
import RarityOddsTooltip from './RarityOddsTooltip'

// The bulk buttons joined onto an item's own buy button.
const BULK_AMOUNTS = [5, 10]

// Items the Shop doesn't sell that are listed anyway, owned or not, because the Game
// Corner's Coin Shop hands them out (Friendship Petals: free ones daily, and a coin pack).
const COIN_SHOP_ITEM_IDS = [FRIENDSHIP_PETAL_ITEM_ID]

// One item as the Items tab sees it: what the bag holds of it and what the shop asks for
// it - either can be missing (a Mega Stone isn't sold, a Potion may not be owned yet).
interface ItemRow {
  id: string
  name: string
  category: string
  description: string
  spritenum: number
  tier: RarityTier
  owned: BagItemView | null
  shop: ShopItemEntry | null
  // Got from the Coin Shop instead (see COIN_SHOP_ITEM_IDS).
  coinShop: boolean
}

// The bag and the shop each arrive sorted by category, and both follow the same category
// order - the bag just has a few more (Mega Stones, Evolution Items). Weaves the two
// category lists into one in that order.
function mergeCategoryOrder(a: string[], b: string[]): string[] {
  const out: string[] = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push(a[i++])
      j++
    } else if (b.indexOf(a[i], j) === -1) out.push(a[i++])
    else out.push(b[j++])
  }
  return [...out, ...a.slice(i), ...b.slice(j)]
}

function uniqueInOrder(list: string[]): string[] {
  return list.filter((c, i) => list.indexOf(c) === i)
}

// Every item from the bag and the shop - plus the Coin Shop's, held or not - as one list,
// grouped by category, by name within it.
function mergeItems(bag: BagItemView[], catalog: ShopItemEntry[], coinShop: BagItemView[]): [string, ItemRow[]][] {
  const rows = new Map<string, ItemRow>()
  for (const item of catalog) {
    rows.set(item.id, {
      id: item.id,
      name: item.name,
      category: item.category,
      description: item.description,
      spritenum: item.spritenum,
      tier: priceRarityTier(item.price),
      owned: null,
      shop: item,
      coinShop: false
    })
  }
  for (const item of bag) {
    const row = rows.get(item.id)
    if (row) {
      row.owned = item
      row.tier = item.rarityTier
    } else {
      rows.set(item.id, { ...item, tier: item.rarityTier, owned: item, shop: null, coinShop: COIN_SHOP_ITEM_IDS.includes(item.id) })
    }
  }
  for (const item of coinShop) {
    if (!rows.has(item.id)) rows.set(item.id, { ...item, tier: item.rarityTier, owned: null, shop: null, coinShop: true })
  }
  const order = uniqueInOrder([
    ...mergeCategoryOrder(uniqueInOrder(bag.map((i) => i.category)), uniqueInOrder(catalog.map((i) => i.category))),
    ...coinShop.map((i) => i.category)
  ])
  return order.map((category) => [
    category,
    [...rows.values()].filter((r) => r.category === category).sort((x, y) => x.name.localeCompare(y.name))
  ])
}

interface Props {
  // Buying, selling, using or restoring changes the wallet and (for a restore or an
  // opened case) the box, both of which the main menu is showing behind this.
  onChanged: () => void
  onMoneyChange: (money: number) => void
  // Closes this and opens the Game Corner's Coin Shop at its daily Friendship Petals.
  onOpenCoinShop: () => void
}

/**
 * The Items tab of the Bag window (see BagShopModal): the bag and the shop as one grid of
 * cards. A click on a card shows that item in the pane beside the grid - what it does, how
 * many are in the bag, and buttons to buy more, use it or sell it.
 */
function ItemsPanel({ onChanged, onMoneyChange, onOpenCoinShop }: Props): React.JSX.Element {
  const [bag, setBag] = useState<BagItemView[] | null>(null)
  const [catalog, setCatalog] = useState<ShopItemEntry[] | null>(null)
  // The Coin Shop's items, listed even with none in the bag - once they're unlocked (late game).
  const [coinShopItems, setCoinShopItems] = useState<BagItemView[]>([])
  // The boss that unlocks the late game items, while they're still locked.
  const [lockedUntil, setLockedUntil] = useState<string | null>(null)
  const [money, setMoney] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState('')
  // The item shown in the pane.
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Picking items to sell together: item id -> how many (the whole stack). Null when not picking.
  const [picks, setPicks] = useState<Map<string, number> | null>(null)
  // A Random Pokemon / Random Legendary being opened, shown as a spinning case.
  const [opening, setOpening] = useState<{ item: BagItemView; result: OpenItemResult; seq: number } | null>(null)
  const [galarFossil, setGalarFossil] = useState<BagItemView | null>(null)
  // Results float up from whatever was last clicked.
  const notes = useFloatingNotes()
  const scrollRef = useRef<HTMLDivElement>(null)
  const lastPoint = useRef<NotePoint>({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
  const say = (text: string): void => notes.show(text, lastPoint.current)

  async function refresh(): Promise<void> {
    try {
      const [items, shop, wallet, coinShop, eligibility] = await Promise.all([
        window.api.listBag(),
        window.api.listShop(),
        window.api.getMoney(),
        Promise.all(COIN_SHOP_ITEM_IDS.map((id) => window.api.getBagItem(id))),
        window.api.getBattleEligibility()
      ])
      setCoinShopItems(eligibility.raidsUnlocked ? coinShop.filter((i): i is BagItemView => i !== null) : [])
      setLockedUntil(eligibility.raidsUnlocked ? null : (eligibility.raidUnlockBoss ?? 'the right boss'))
      // Key items have a tab of their own.
      setBag(items.filter((i) => i.category !== 'Key Items'))
      setCatalog(shop)
      setMoney(wallet)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  // Runs one bag action and reports its outcome where it was clicked.
  async function act(action: () => Promise<string>): Promise<void> {
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

  async function buy(item: ShopItemEntry, count: number): Promise<void> {
    setBusy(true)
    try {
      const result = await window.api.buyItem(item.id, count)
      setMoney(result.money)
      onMoneyChange(result.money)
      if (!result.success) notes.show('Not enough money for that', lastPoint.current, 'bad')
      else {
        say(`Bought ${count > 1 ? `${count}× ` : ''}${item.name} for ${formatMoney(shopTotal(item, count))}`)
        await refresh()
      }
    } catch (e) {
      notes.show(errorMessage(e), lastPoint.current, 'bad')
    } finally {
      setBusy(false)
    }
  }

  function sell(item: BagItemView, quantity: number): Promise<void> {
    return act(async () => {
      const result = await window.api.sellItems([{ itemId: item.id, quantity }])
      return `Sold ${quantity > 1 ? `${quantity}× ` : ''}${item.name} for ${formatMoney(result.sold)}.`
    })
  }

  function startPicking(start: Map<string, number>): void {
    setPicks(start)
  }

  function togglePicked(item: BagItemView | null): void {
    if (!picks || !item || item.sellPrice === null) return
    const next = new Map(picks)
    if (next.has(item.id)) next.delete(item.id)
    else next.set(item.id, item.quantity)
    setPicks(next)
  }

  // Quick sell: picks the sell-only items, every berry but the keepers, and the
  // Memories/Plates/Drives no owned Pokemon can use, for a look before selling.
  async function startQuickSell(e: React.MouseEvent): Promise<void> {
    lastPoint.current = pointOf(e)
    setError(null)
    try {
      const quick = await window.api.quickSellSelection()
      if (quick.length === 0) {
        notes.show(
          'Nothing for Quick sell - no sell-only items, spare berries, or Memories, Plates or Drives nobody can use.',
          lastPoint.current,
          'bad'
        )
        return
      }
      startPicking(new Map(quick.map((p) => [p.itemId, p.quantity])))
      // Which berries it left alone, so it's clear they weren't missed.
      const kept = (bag ?? []).filter((i) => QUICK_SELL_KEPT_BERRY_IDS.has(i.id))
      if (kept.length > 0) {
        notes.show(`Kept: ${kept.map((i) => `${i.name} ×${i.quantity}`).join(', ')}`, lastPoint.current)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  function sellPicked(e: React.MouseEvent): Promise<void> {
    lastPoint.current = pointOf(e)
    const entries = [...(picks ?? [])].map(([itemId, quantity]) => ({ itemId, quantity }))
    const count = entries.reduce((sum, e) => sum + e.quantity, 0)
    return act(async () => {
      const result = await window.api.sellItems(entries)
      setPicks(null)
      return `Sold ${count} item${count === 1 ? '' : 's'} for ${formatMoney(result.sold)}.`
    })
  }

  // Not through act(): the case animation reveals what came out, so the message - and
  // the refresh that would show the new Pokemon in the box behind it - wait until it's closed.
  // The message for the case just closed (or just moved on from).
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

  // Arrow keys move between the cards: left/right through the list, up/down to the card
  // nearest straight above or below (the next row may be in another category).
  function moveFocus(from: HTMLElement, key: string): void {
    const cards = [...(scrollRef.current?.querySelectorAll<HTMLElement>('[data-item-card]') ?? [])]
    const i = cards.indexOf(from)
    let next: HTMLElement | undefined
    if (key === 'ArrowRight') next = cards[i + 1]
    else if (key === 'ArrowLeft') next = cards[i - 1]
    else {
      const here = from.getBoundingClientRect()
      const centre = (r: DOMRect): number => r.left + r.width / 2
      const down = key === 'ArrowDown'
      const rows = cards
        .map((card) => ({ card, rect: card.getBoundingClientRect() }))
        .filter(({ rect }) => (down ? rect.top > here.top + 4 : rect.top < here.top - 4))
      if (rows.length > 0) {
        const rowTop = down ? Math.min(...rows.map((r) => r.rect.top)) : Math.max(...rows.map((r) => r.rect.top))
        next = rows
          .filter((r) => Math.abs(r.rect.top - rowTop) < 4)
          .sort((a, b) => Math.abs(centre(a.rect) - centre(here)) - Math.abs(centre(b.rect) - centre(here)))[0]?.card
      }
    }
    if (next) {
      next.focus()
      next.scrollIntoView({ block: 'nearest' })
    }
  }

  const loaded = bag !== null && catalog !== null
  const allGroups = loaded ? mergeItems(bag, catalog, coinShopItems) : []
  const allRows = allGroups.flatMap(([, rows]) => rows)
  // Every item, the bag's and the shop's - except while picking to sell, which only looks at the bag.
  const matches = (row: ItemRow): boolean =>
    (picks === null || row.owned !== null) && row.name.toLowerCase().includes(query.trim().toLowerCase())
  const groups = allGroups
    .map(([category, rows]) => [category, rows.filter(matches)] as [string, ItemRow[]])
    .filter(([, rows]) => rows.length > 0)
  const shownCount = groups.reduce((sum, [, rows]) => sum + rows.length, 0)
  const selected = allRows.find((r) => r.id === selectedId) ?? null
  const priceOf = new Map(bag?.map((i) => [i.id, i.sellPrice ?? 0]) ?? [])
  const pickedTotal = [...(picks ?? [])].reduce((sum, [id, qty]) => sum + (priceOf.get(id) ?? 0) * qty, 0)
  const pickedCount = [...(picks ?? [])].reduce((sum, [, qty]) => sum + qty, 0)
  const ownedCount = allRows.filter((r) => r.owned).length

  return (
    <>
      {error && <p className="editor-error">{error}</p>}
      {!loaded && !error && <ModalSpinner />}
      {loaded && (
        <div className="bag-toolbar">
          <SearchBar value={query} onChange={setQuery} placeholder="Search items..." autoFocus />
          {!picks && ownedCount > 0 && (
            <>
              <button disabled={busy} onClick={() => startPicking(new Map())}>
                Select to sell
              </button>
              <button
                disabled={busy}
                title="Picks sell-only items (Bottle Caps, Rare Bones...), berries except Sitrus, Lum and the pinch berries, and Memories, Plates and Drives nobody can use"
                onClick={(e) => void startQuickSell(e)}
              >
                Quick sell
              </button>
            </>
          )}
          <span className="money-display">{formatMoney(money)}</span>
        </div>
      )}
      {loaded && (
        <div className="items-body">
          <div className="items-list">
            {/* A button per category, scrolling the list down to it. */}
            <CategoryJumpBar categories={groups.map(([c, rows]) => [c, rows.length])} scrollRef={scrollRef} />
            {shownCount === 0 && (
              <p className="box-empty-hint">
                {query.trim() ? 'No items match.' : 'Nothing here.'}
              </p>
            )}
            <div ref={scrollRef} className="bag-scroll">
              {groups.map(([category, rows]) => (
                <div key={category} data-category={category}>
                  <h3 className="shop-category-heading">{category}</h3>
                  <div className="item-card-grid items-grid">
                    {rows.map((row) => (
                      <ItemCard
                        key={row.id}
                        row={row}
                        selected={row.id === selectedId}
                        picking={picks !== null}
                        picked={picks?.has(row.id) ?? false}
                        onFocus={() => setSelectedId(row.id)}
                        // While picking to sell, a click picks the card; otherwise focusing it has
                        // already shown it in the pane.
                        onActivate={() => (picks ? togglePicked(row.owned) : setSelectedId(row.id))}
                        onArrow={(el, key) => moveFocus(el, key)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <ItemDetail
            row={selected}
            money={money}
            // While picking to sell, the pane only describes - its buttons wait.
            busy={busy || picks !== null}
            onClickAt={(e) => (lastPoint.current = pointOf(e))}
            onBuy={(item, count) => void buy(item, count)}
            onSell={(item, count) => void sell(item, count)}
            onUseCandy={(item) => void useExpCandy(item)}
            onUseCandiesToCap={(item) => void useExpCandiesUntilCap(item)}
            onOpen={(item) => void openItem(item)}
            onRestore={(item) => (item.fossil === 'galar' ? setGalarFossil(item) : void restoreSingle(item))}
            onOpenCoinShop={onOpenCoinShop}
            lockedUntil={lockedUntil}
          />
        </div>
      )}
      {picks && (
        <div className="editor-actions bag-sell-bar">
          <span className="bag-sell-summary">
            {pickedCount} item{pickedCount === 1 ? '' : 's'} selected · {formatMoney(pickedTotal)}
          </span>
          <button disabled={busy} onClick={() => setPicks(null)}>
            Cancel
          </button>
          <button disabled={busy || pickedCount === 0} onClick={(e) => void sellPicked(e)}>
            Sell selected
          </button>
        </div>
      )}

      {opening && (
        <CaseOpening
          key={opening.seq}
          itemId={opening.item.id}
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
    </>
  )
}

interface ItemCardProps {
  row: ItemRow
  selected: boolean
  picking: boolean
  picked: boolean
  onFocus: () => void
  onActivate: () => void
  onArrow: (el: HTMLElement, key: string) => void
}

// One item in the grid: big enough to click anywhere on, with how many are in the bag in
// the corner and the shop price along the bottom. Tab or the arrow keys reach it too.
function ItemCard({ row, selected, picking, picked, onFocus, onActivate, onArrow }: ItemCardProps): React.JSX.Element {
  const unsellable = picking && (row.owned?.sellPrice ?? null) === null
  const note = picking
    ? unsellable
      ? "Can't be sold"
      : picked
        ? `✓ ${formatMoney((row.owned?.sellPrice ?? 0) * (row.owned?.quantity ?? 0))}`
        : 'Click to pick'
    : row.shop
      ? formatMoney(row.shop.price)
      : row.coinShop
        ? 'Coin Shop'
        : 'Not sold in shop'
  return (
    <RarityCard
      tier={row.tier}
      lift
      role="button"
      tabIndex={0}
      aria-pressed={picking ? picked : selected}
      aria-label={`${row.name}${row.owned ? `, ${row.owned.quantity} in bag` : ''}${row.shop ? `, ${formatMoney(row.shop.price)} in the shop` : ''}`}
      data-item-card=""
      className={`items-card${selected ? ' items-card-selected' : ''}${picking ? ' bag-card-picking' : ''}${picked ? ' bag-item-selected' : ''}${unsellable ? ' bag-item-unsellable' : ''}`}
      onFocus={onFocus}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onActivate()
        } else if (e.key.startsWith('Arrow')) {
          e.preventDefault()
          onArrow(e.currentTarget, e.key)
        }
      }}
    >
      {row.owned && <span className="item-card-qty">×{row.owned.quantity}</span>}
      {!picking && row.shop?.bulkPrice !== undefined && <span className="item-card-tag">-25% ×5+</span>}
      <RarityGlow size={56}>
        <ItemSprite spritenum={row.spritenum} className="item-card-icon" />
      </RarityGlow>
      <span className="item-card-name">{row.name}</span>
      <span className={`items-card-note${row.coinShop && !picking ? ' items-card-note-coins' : row.shop || picking ? '' : ' items-card-note-faint'}`}>{note}</span>
    </RarityCard>
  )
}

interface ItemDetailProps {
  row: ItemRow | null
  money: number
  busy: boolean
  // Every button here notes where it was clicked, so its result floats up from it.
  onClickAt: (e: React.MouseEvent) => void
  onBuy: (item: ShopItemEntry, count: number) => void
  onSell: (item: BagItemView, count: number) => void
  onUseCandy: (item: BagItemView) => void
  onUseCandiesToCap: (item: BagItemView) => void
  onOpen: (item: BagItemView) => void
  onRestore: (item: BagItemView) => void
  onOpenCoinShop: () => void
  // While the late game items are locked: the boss to beat (the Coin Shop's petals wait for it).
  lockedUntil: string | null
}

// The pane beside the grid: the picked item large, what it does in words, then a section
// each for using it, buying more and selling it - only the ones that apply.
function ItemDetail({
  row,
  money,
  busy,
  onClickAt,
  onBuy,
  onSell,
  onUseCandy,
  onUseCandiesToCap,
  onOpen,
  onRestore,
  onOpenCoinShop,
  lockedUntil
}: ItemDetailProps): React.JSX.Element {
  if (!row) {
    return (
      <aside className="items-detail items-detail-empty">
        <p>Pick an item to see what it does, buy more or sell it.</p>
      </aside>
    )
  }
  const { owned, shop } = row
  const click =
    (fn: () => void) =>
    (e: React.MouseEvent): void => {
      onClickAt(e)
      fn()
    }
  const canAffordRestore = money >= FOSSIL_RESTORE_COST

  // What the item is for, when it can be used from here.
  let use: React.ReactNode = null
  if (owned?.teamExp != null) {
    use = (
      <>
        <p className="items-detail-hint">+{owned.teamExp.toLocaleString('en-US')} exp to each Pokemon on your team.</p>
        <div className="items-detail-buttons">
          <button className="items-detail-btn items-detail-btn-use" disabled={busy} onClick={click(() => onUseCandy(owned))}>
            Use one
          </button>
          <button
            className="items-detail-btn items-detail-btn-use"
            disabled={busy}
            title={`Keeps using them until your whole team is at the level cap, or you run out (×${owned.quantity} left)`}
            onClick={click(() => onUseCandiesToCap(owned))}
          >
            Use to level cap
          </button>
        </div>
      </>
    )
  } else if (owned?.opens) {
    use = (
      <div className="items-detail-buttons">
        <RarityOddsTooltip source={{ kind: 'item', itemId: owned.id }}>
          <button className="items-detail-btn items-detail-btn-use" disabled={busy} onClick={click(() => onOpen(owned))}>
            Open
          </button>
        </RarityOddsTooltip>
      </div>
    )
  } else if (owned?.fossil) {
    use = (
      <>
        <p className="items-detail-hint">
          {owned.fossil === 'single'
            ? `Restores into ${owned.restoresTo}.`
            : 'Restores together with another fossil - you pick which.'}
        </p>
        <div className="items-detail-buttons">
          <button
            className="items-detail-btn items-detail-btn-use"
            disabled={busy || !canAffordRestore}
            title={canAffordRestore ? undefined : `Restoring costs ${formatMoney(FOSSIL_RESTORE_COST)}`}
            onClick={click(() => onRestore(owned))}
          >
            Restore · {formatMoney(FOSSIL_RESTORE_COST)}
          </button>
        </div>
      </>
    )
  }

  return (
    <aside className="items-detail" aria-live="polite">
      <div className="items-detail-head">
        <RarityGlow tier={row.tier} size={88}>
          <ItemSprite spritenum={row.spritenum} className="items-detail-icon" />
        </RarityGlow>
        <h3 className="items-detail-name">{row.name}</h3>
        <span className="items-detail-meta">
          {row.category} · {owned ? `${owned.quantity} in bag` : 'none in bag'}
        </span>
      </div>
      <p className="items-detail-desc">{row.description}</p>

      {use && (
        <section className="items-detail-section">
          <h4>Use</h4>
          {use}
        </section>
      )}

      {row.coinShop && (
        <section className="items-detail-section">
          <h4>Get more</h4>
          {lockedUntil ? (
            <p className="items-detail-hint">🔒 Beat {lockedUntil} to unlock the Coin Shop&apos;s daily petals.</p>
          ) : (
            <>
              <p className="items-detail-hint">Not sold here - the Game Corner&apos;s Coin Shop gives some free every day, with a pack for coins.</p>
              <div className="items-detail-buttons">
                <button className="items-detail-btn items-detail-btn-coins" onClick={onOpenCoinShop}>
                  Go to the Coin Shop ›
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {shop && (
        <section className="items-detail-section">
          <h4>Buy</h4>
          {/* A row per amount: one, then the bulk amounts - a discounted one with its
              discount badge and the full price struck through beside its buy button. */}
          <div className="items-buy-options">
            {[1, ...BULK_AMOUNTS].map((n) => {
              const full = shop.price * n
              const total = shopTotal(shop, n)
              const saving = full - total
              return (
                <div key={n} className={`items-buy-option${saving > 0 ? ' items-buy-option-deal' : ''}`}>
                  <span className="items-buy-qty">×{n}</span>
                  {saving > 0 && <span className="items-buy-badge">-{Math.round((saving / full) * 100)}%</span>}
                  {saving > 0 && <s className="items-buy-was">₽ {formatShort(full)}</s>}
                  <BuyButton
                    price={total}
                    currency="money"
                    held={money}
                    busy={busy}
                    title={`Buy ${n === 1 ? 'one' : n} for ${formatMoney(total)}`}
                    onBuy={click(() => onBuy(shop, n))}
                  />
                </div>
              )
            })}
          </div>
        </section>
      )}

      {owned && (
        <section className="items-detail-section">
          <h4>Sell</h4>
          {owned.sellPrice === null ? (
            <p className="items-detail-hint">The shop doesn&apos;t buy this.</p>
          ) : (
            <>
              <p className="items-detail-hint">{formatMoney(owned.sellPrice)} each</p>
              <BuyButtonGroup>
                {/* Sell one or the whole stack - each with what it pays underneath. */}
                <SellButton
                  label={
                    <span className="items-sell-label">
                      Sell one
                      <span className="items-sell-pays">+₽ {formatShort(owned.sellPrice)}</span>
                    </span>
                  }
                  busy={busy}
                  title={`Sell one for ${formatMoney(owned.sellPrice)}`}
                  onSell={click(() => onSell(owned, 1))}
                />
                {owned.quantity > 1 && (
                  <SellButton
                    label={
                      <span className="items-sell-label">
                        Sell all ×{owned.quantity}
                        <span className="items-sell-pays">+₽ {formatShort(owned.sellPrice * owned.quantity)}</span>
                      </span>
                    }
                    busy={busy}
                    title={`Sell all ×${owned.quantity} for ${formatMoney(owned.sellPrice * owned.quantity)}`}
                    onSell={click(() => onSell(owned, owned.quantity))}
                  />
                )}
              </BuyButtonGroup>
            </>
          )}
        </section>
      )}
    </aside>
  )
}

export default ItemsPanel
