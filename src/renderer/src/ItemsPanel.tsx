import { useEffect, useRef, useState } from 'react'
import {
  DEFAULT_POKEBALL_ID,
  FOSSIL_RESTORE_COST,
  FRIENDSHIP_PETAL_ITEM_ID,
  LOCK_CAPSULE_ITEM_ID,
  QUICK_SELL_KEPT_BERRY_IDS,
  RANDOM_LEGENDARY_ITEM_ID,
  RANDOM_POKEMON_ITEM_ID,
  RARE_CANDY_ITEM_ID,
  SHINY_PATCH_ITEM_ID,
  WISHING_PIECE_ITEM_ID,
  shopTotal
} from '../../shared/battle-types'
import type { BagItemView, OpenItemResult, RarityTier, RestoreFossilResult, ShopItemEntry } from '../../shared/battle-types'
import { RARITY_TIERS } from '../../shared/rarity'
import ItemSprite from './ItemSprite'
import RarityCard, { RarityGlow, priceRarityTier } from './RarityCard'
import BuyButton, { BuyButtonGroup, SellButton } from './BuyButton'
import SearchBar from './SearchBar'
import GalarFossilPrompt from './GalarFossilPrompt'
import CaseOpening from './CaseOpening'
import { holdDexToasts } from './AchievementToasts'
import { formatMoney, formatShort } from './money'
import { errorMessage, pointOf, useFloatingNotes, type NotePoint } from './FloatingNotes'
import ModalSpinner from './ModalSpinner'
import CategoryJumpBar from './CategoryJumpBar'
import RarityOddsTooltip from './RarityOddsTooltip'
import { IS_MOBILE_LAYOUT } from './platform'
import { clickWord, itemCategoryName, itemName, itemText, nameMatches, t } from './i18n'

// The bulk buttons joined onto an item's own buy button.
const BULK_AMOUNTS = [5, 10]

// Items the Shop doesn't sell that are listed anyway, owned or not, because the Game
// Corner's Coin Shop hands them out (Friendship Petals: free ones daily, and a coin pack;
// the Shiny Patch: one a day for coins).
const COIN_SHOP_ITEM_IDS = [FRIENDSHIP_PETAL_ITEM_ID, SHINY_PATCH_ITEM_ID]

// The Recommended row in a set order rather than by name: catching, then the Random
// Pokemon items, then the candies smallest first, then the Coin Shop goods. Anything else
// in the row comes after, by name.
export const RECOMMENDED_ORDER = [
  DEFAULT_POKEBALL_ID,
  LOCK_CAPSULE_ITEM_ID,
  RANDOM_POKEMON_ITEM_ID,
  RANDOM_LEGENDARY_ITEM_ID,
  RARE_CANDY_ITEM_ID,
  'expcandys',
  'expcandym',
  'expcandyl',
  SHINY_PATCH_ITEM_ID,
  WISHING_PIECE_ITEM_ID,
  FRIENDSHIP_PETAL_ITEM_ID
]

export function recommendedRank(id: string): number {
  const i = RECOMMENDED_ORDER.indexOf(id)
  return i === -1 ? RECOMMENDED_ORDER.length : i
}

// Every other row: rarest first (gold down to grey), then by name.
function byRarityThenName(x: ItemRow, y: ItemRow): number {
  return RARITY_TIERS.indexOf(y.tier) - RARITY_TIERS.indexOf(x.tier) || x.name.localeCompare(y.name)
}

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
// grouped by category - Recommended in its set order, the rest rarest first.
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
    [...rows.values()]
      .filter((r) => r.category === category)
      .sort((x, y) =>
        category === 'Recommended'
          ? recommendedRank(x.id) - recommendedRank(y.id) || x.name.localeCompare(y.name)
          : byRarityThenName(x, y)
      )
  ])
}

interface Props {
  // Buying, selling, using or restoring changes the wallet and (for a restore or an
  // opened case) the box, both of which the main menu is showing behind this.
  onChanged: () => void
  onMoneyChange: (money: number) => void
  // Closes this and opens the Game Corner's Coin Shop at the item's daily deal.
  onOpenCoinShop: (itemId: string) => void
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
  // "New Pokemon registered" waits while the case spins, so it doesn't spoil the win.
  const releaseDexToasts = useRef<(() => void) | null>(null)
  function letDexToastsOut(): void {
    releaseDexToasts.current?.()
    releaseDexToasts.current = null
  }
  useEffect(() => letDexToastsOut, [])
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
      setCoinShopItems(coinShop.filter((i): i is BagItemView => i !== null))
      setLockedUntil(eligibility.raidsUnlocked ? null : (eligibility.raidUnlockBoss ?? t('bag.theRightBoss')))
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
      if (!result.success) notes.show(t('bag.noMoney'), lastPoint.current, 'bad')
      else {
        say(t('bag.bought', { what: `${count > 1 ? `${count}× ` : ''}${itemName(item.name)}`, money: formatMoney(shopTotal(item, count)) }))
        await refresh()
        // The box re-counts its evolution items, so the merge window sees the new ones.
        onChanged()
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
      return t('bag.sold', { what: `${quantity > 1 ? `${quantity}× ` : ''}${itemName(item.name)}`, money: formatMoney(result.sold) })
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
        notes.show(t('bag.quickNone'), lastPoint.current, 'bad')
        return
      }
      startPicking(new Map(quick.map((p) => [p.itemId, p.quantity])))
      // Which berries it left alone, so it's clear they weren't missed.
      const kept = (bag ?? []).filter((i) => QUICK_SELL_KEPT_BERRY_IDS.has(i.id))
      if (kept.length > 0) {
        notes.show(t('bag.kept', { list: kept.map((i) => `${itemName(i.name)} ×${i.quantity}`).join(', ') }), lastPoint.current)
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
      return t('bag.soldCount', { count, money: formatMoney(result.sold) })
    })
  }

  // Not through act(): the case animation reveals what came out, so the message - and
  // the refresh that would show the new Pokemon in the box behind it - wait until it's closed.
  // The message for the case just closed (or just moved on from).
  function reportOpening(soldFor?: number): void {
    if (!opening) return
    const opened = itemName(opening.item.name)
    const { result } = opening
    if (result.kind === 'item' && soldFor !== undefined) {
      say(t('bag.openedSold', { item: opened, got: itemName(result.name), money: formatMoney(soldFor) }))
    } else if (result.kind === 'item') {
      say(t('bag.openedItem', { item: opened, got: itemName(result.name) }))
    } else {
      const got = result.shiny ? t('bag.aShiny', { name: result.name }) : result.name
      say(
        soldFor !== undefined
          ? t('bag.openedMonSold', { item: opened, got, level: result.level, money: formatMoney(soldFor) })
          : t('bag.openedMon', { item: opened, got, level: result.level })
      )
    }
  }

  async function openItem(item: BagItemView): Promise<void> {
    setBusy(true)
    setError(null)
    letDexToastsOut()
    releaseDexToasts.current = holdDexToasts()
    try {
      const result = await window.api.openBagItem(item.id)
      // A fresh case each time (seq), even when opening the same item again.
      setOpening((prev) => ({ item, result, seq: (prev?.seq ?? 0) + 1 }))
    } catch (e) {
      letDexToastsOut()
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  // Exp. Candies one after another until the whole team is at the level cap, or they run out.
  function useExpCandiesUntilCap(item: BagItemView): Promise<void> {
    return act(async () => {
      const { used, results, allCapped } = await window.api.useExpCandiesUntilCap(item.id)
      const levelUps = results
        .filter((r) => r.levelAfter > r.levelBefore)
        .map((r) => t('bag.levelUp', { name: r.species, level: r.levelAfter }))
      return [
        t('bag.usedMany', { n: used, item: itemName(item.name) }),
        levelUps.length > 0 ? levelUps.join(', ') + '.' : '',
        allCapped ? t('bag.allCapped') : t('bag.outOfCandies')
      ]
        .filter(Boolean)
        .join(' ')
    })
  }

  function useExpCandy(item: BagItemView): Promise<void> {
    return act(async () => {
      const results = await window.api.useExpCandy(item.id)
      const gained = results.filter((r) => !r.cappedOut)
      const levelUps = gained
        .filter((r) => r.levelAfter > r.levelBefore)
        .map((r) => t('bag.levelUp', { name: r.species, level: r.levelAfter }))
      const capped = results.length - gained.length
      return [
        t('bag.usedOne', { item: itemName(item.name), n: gained.length, exp: item.teamExp ?? 0 }),
        levelUps.length > 0 ? levelUps.join(', ') + '.' : '',
        capped > 0 ? t('bag.cappedNothing', { n: capped }) : ''
      ]
        .filter(Boolean)
        .join(' ')
    })
  }

  function restoreSingle(item: BagItemView): Promise<void> {
    return act(async () => describeRestore(await window.api.restoreFossil(item.id)))
  }

  function describeRestore(result: RestoreFossilResult): string {
    const got = result.shiny ? t('bag.aShiny', { name: result.species }) : result.species
    return t('bag.restored', { got, level: result.level })
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
    (picks === null || row.owned !== null) && nameMatches(query.trim(), row.name, itemName(row.name))
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
          <SearchBar value={query} onChange={setQuery} placeholder={t('bag.search')} autoFocus />
          {!picks && ownedCount > 0 && (
            <>
              <button disabled={busy} onClick={() => startPicking(new Map())}>
                {t('bag.selectToSell')}
              </button>
              <button disabled={busy} title={t('bag.quickSellTip')} onClick={(e) => void startQuickSell(e)}>
                {t('bag.quickSell')}
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
            <CategoryJumpBar
              categories={groups.map(([c, rows]) => [c, rows.length])}
              scrollRef={scrollRef}
              labelOf={itemCategoryName}
            />
            {shownCount === 0 && (
              <p className="box-empty-hint">{query.trim() ? t('bag.noMatch') : t('bag.nothing')}</p>
            )}
            <div ref={scrollRef} className="bag-scroll">
              {groups.map(([category, rows]) => (
                <div key={category} data-category={category}>
                  <h3 className="shop-category-heading">{itemCategoryName(category)}</h3>
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
            onClose={() => setSelectedId(null)}
          />
        </div>
      )}
      {picks && (
        <div className="editor-actions bag-sell-bar">
          <span className="bag-sell-summary">
            {t('bag.selected', { count: pickedCount, money: formatMoney(pickedTotal) })}
          </span>
          <button disabled={busy} onClick={() => setPicks(null)}>
            {t('common.cancel')}
          </button>
          <button disabled={busy || pickedCount === 0} onClick={(e) => void sellPicked(e)}>
            {t('bag.sellSelected')}
          </button>
        </div>
      )}

      {opening && (
        <CaseOpening
          key={opening.seq}
          itemId={opening.item.id}
          itemName={itemName(opening.item.name)}
          result={opening.result}
          onRevealed={letDexToastsOut}
          onClose={(soldFor) => {
            letDexToastsOut()
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
      ? t('bag.cantSell')
      : picked
        ? `✓ ${formatMoney((row.owned?.sellPrice ?? 0) * (row.owned?.quantity ?? 0))}`
        : t('bag.toPick', { click: clickWord() })
    : row.shop
      ? formatMoney(row.shop.price)
      : row.coinShop
        ? t('bag.coinShop')
        : t('bag.notSold')
  return (
    <RarityCard
      tier={row.tier}
      lift
      role="button"
      tabIndex={0}
      aria-pressed={picking ? picked : selected}
      aria-label={`${itemName(row.name)}${row.owned ? t('bag.ariaInBag', { n: row.owned.quantity }) : ''}${row.shop ? t('bag.ariaInShop', { money: formatMoney(row.shop.price) }) : ''}`}
      data-item-card=""
      className={`items-card${selected ? ' items-card-selected' : ''}${picking ? ' bag-card-picking' : ''}${picked ? ' bag-item-selected' : ''}${unsellable ? ' bag-item-unsellable' : ''}${row.owned ? '' : ' items-card-unowned'}`}
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
      {row.owned ? <span className="item-card-qty">×{row.owned.quantity}</span> : <span className="item-card-qty item-card-qty-none">×0</span>}
      {!picking && row.shop?.bulkPrice !== undefined && <span className="item-card-tag">-25% ×5+</span>}
      <RarityGlow size={56}>
        <ItemSprite spritenum={row.spritenum} className="item-card-icon" />
      </RarityGlow>
      <span className="item-card-name">{itemName(row.name)}</span>
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
  onOpenCoinShop: (itemId: string) => void
  // While the late game items are locked: the boss to beat (the Coin Shop's petals wait for it).
  lockedUntil: string | null
  // Puts the pane away (on the phone, where it covers the bag).
  onClose: () => void
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
  lockedUntil,
  onClose
}: ItemDetailProps): React.JSX.Element {
  if (!row) {
    return (
      <aside className="items-detail items-detail-empty">
        <p>{t('bag.pickHint')}</p>
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
        <p className="items-detail-hint">{t('bag.expEach', { exp: owned.teamExp })}</p>
        <div className="items-detail-buttons">
          <button className="items-detail-btn items-detail-btn-use" disabled={busy} onClick={click(() => onUseCandy(owned))}>
            {t('bag.useOne')}
          </button>
          <button
            className="items-detail-btn items-detail-btn-use"
            disabled={busy}
            title={t('bag.useToCapTip', { n: owned.quantity })}
            onClick={click(() => onUseCandiesToCap(owned))}
          >
            {t('bag.useToCap')}
          </button>
        </div>
      </>
    )
  } else if (owned?.opens) {
    use = (
      <div className="items-detail-buttons">
        <RarityOddsTooltip source={{ kind: 'item', itemId: owned.id }}>
          <button className="items-detail-btn items-detail-btn-use" disabled={busy} onClick={click(() => onOpen(owned))}>
            {t('bag.open')}
          </button>
        </RarityOddsTooltip>
      </div>
    )
  } else if (owned?.fossil) {
    use = (
      <>
        <p className="items-detail-hint">
          {owned.fossil === 'single'
            ? t('bag.restoresInto', { name: owned.restoresTo ?? '' })
            : t('bag.restoresPair')}
        </p>
        <div className="items-detail-buttons">
          <button
            className="items-detail-btn items-detail-btn-use"
            disabled={busy || !canAffordRestore}
            title={canAffordRestore ? undefined : t('bag.restoreCost', { money: formatMoney(FOSSIL_RESTORE_COST) })}
            onClick={click(() => onRestore(owned))}
          >
            {t('bag.restore', { money: formatMoney(FOSSIL_RESTORE_COST) })}
          </button>
        </div>
      </>
    )
  }

  return (
    <aside className="items-detail" aria-live="polite">
      {/* On the phone: back to the bag (the back button does the same). */}
      {IS_MOBILE_LAYOUT && (
        <button className="items-detail-close" aria-label={t('bag.backToBag')} data-back-close="" onClick={onClose}>
          ×
        </button>
      )}
      <div className="items-detail-head">
        <RarityGlow tier={row.tier} size={88}>
          <ItemSprite spritenum={row.spritenum} className="items-detail-icon" />
        </RarityGlow>
        <h3 className="items-detail-name">{itemName(row.name)}</h3>
        <span className="items-detail-meta">
          {itemCategoryName(row.category)} · {owned ? t('bag.inBag', { n: owned.quantity }) : t('bag.noneInBag')}
        </span>
      </div>
      <p className="items-detail-desc">{itemText(row.id, row.description)}</p>

      {use && (
        <section className="items-detail-section">
          <h4>{t('bag.use')}</h4>
          {use}
        </section>
      )}

      {row.coinShop && (
        <section className="items-detail-section">
          <h4>{t('bag.getMore')}</h4>
          {lockedUntil ? (
            <p className="items-detail-hint">
              {t(row.id === SHINY_PATCH_ITEM_ID ? 'bag.lockedPatch' : 'bag.lockedPetals', { boss: lockedUntil })}
            </p>
          ) : (
            <>
              <p className="items-detail-hint">
                {row.id === SHINY_PATCH_ITEM_ID ? t('bag.patchWhere') : t('bag.petalsWhere')}
              </p>
              <div className="items-detail-buttons">
                <button className="items-detail-btn items-detail-btn-coins" onClick={() => onOpenCoinShop(row.id)}>
                  {t('bag.goCoinShop')}
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {shop && (
        <section className="items-detail-section">
          <h4>{t('bag.buy')}</h4>
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
                    title={t('bag.buyTip', { n: n === 1 ? t('bag.one') : n, money: formatMoney(total) })}
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
          <h4>{t('bag.sell')}</h4>
          {owned.sellPrice === null ? (
            <p className="items-detail-hint">{t('bag.notBought')}</p>
          ) : (
            <>
              <p className="items-detail-hint">{t('bag.each', { money: formatMoney(owned.sellPrice) })}</p>
              <BuyButtonGroup>
                {/* Sell one or the whole stack - each with what it pays underneath. */}
                <SellButton
                  label={
                    <span className="items-sell-label">
                      {t('bag.sellOne')}
                      <span className="items-sell-pays">+₽ {formatShort(owned.sellPrice)}</span>
                    </span>
                  }
                  busy={busy}
                  title={t('bag.sellOneTip', { money: formatMoney(owned.sellPrice) })}
                  onSell={click(() => onSell(owned, 1))}
                />
                {owned.quantity > 1 && (
                  <SellButton
                    label={
                      <span className="items-sell-label">
                        {t('bag.sellAll', { n: owned.quantity })}
                        <span className="items-sell-pays">+₽ {formatShort(owned.sellPrice * owned.quantity)}</span>
                      </span>
                    }
                    busy={busy}
                    title={t('bag.sellAllTip', { n: owned.quantity, money: formatMoney(owned.sellPrice * owned.quantity) })}
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
