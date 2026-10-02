import { useEffect, useRef, useState } from 'react'
import { FOSSIL_RESTORE_COST, QUICK_SELL_KEPT_BERRY_IDS } from '../../shared/battle-types'
import type { BagItemView, OpenItemResult, RestoreFossilResult } from '../../shared/battle-types'
import ItemSprite from './ItemSprite'
import RarityCard, { RarityGlow } from './RarityCard'
import { BuyButtonGroup, SellButton } from './BuyButton'
import SearchBar from './SearchBar'
import GalarFossilPrompt from './GalarFossilPrompt'
import CaseOpening from './CaseOpening'
import { formatMoney, formatMoneyShort } from './money'
import { errorMessage, pointOf, useFloatingNotes, type NotePoint } from './FloatingNotes'
import ModalSpinner from './ModalSpinner'

interface Props {
  // Selling or restoring changes the wallet and (for a restore) the box, both
  // of which the main menu is showing behind this.
  onChanged: () => void
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

/** The Bag tab of the Bag | Shop window (see BagShopModal). */
function BagPanel({ onChanged }: Props): React.JSX.Element {
  const [items, setItems] = useState<BagItemView[] | null>(null)
  const [money, setMoney] = useState(0)
  const [error, setError] = useState<string | null>(null)
  // Results float up from whatever was last clicked (an item, or a sell button).
  // A sell button under the mouse: its item's "Sell ×1" shows what one pays, or (on All)
  // what the whole stack pays.
  const [sellHover, setSellHover] = useState<{ itemId: string; all: boolean } | null>(null)
  const notes = useFloatingNotes()
  const lastPoint = useRef<NotePoint>({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
  const say = (text: string): void => notes.show(text, lastPoint.current)
  const [galarFossil, setGalarFossil] = useState<BagItemView | null>(null)
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState('')
  // Picking items to sell together: item id -> how many (the whole stack). Null when not picking.
  const [selection, setSelection] = useState<Map<string, number> | null>(null)
  // A Random Pokemon / Random Legendary being opened, shown as a spinning case.
  const [opening, setOpening] = useState<{ item: BagItemView; result: OpenItemResult; seq: number } | null>(null)

  async function refresh(): Promise<void> {
    try {
      const [bag, wallet] = await Promise.all([window.api.listBag(), window.api.getMoney()])
      // Key items have a tab of their own.
      setItems(bag.filter((i) => i.category !== 'Key Items'))
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

  // Quick sell: picks the sell-only items, every berry but the keepers, and the
  // Memories/Plates/Drives no owned Pokemon can use, for a look before selling.
  async function startQuickSell(e: React.MouseEvent): Promise<void> {
    lastPoint.current = pointOf(e)
    setError(null)
    try {
      const picks = await window.api.quickSellSelection()
      if (picks.length === 0) {
        notes.show(
          'Nothing for Quick sell - no sell-only items, spare berries, or Memories, Plates or Drives nobody can use.',
          lastPoint.current,
          'bad'
        )
        return
      }
      setSelection(new Map(picks.map((p) => [p.itemId, p.quantity])))
      // Which berries it left alone, so it's clear they weren't missed.
      const kept = (items ?? []).filter((i) => QUICK_SELL_KEPT_BERRY_IDS.has(i.id))
      if (kept.length > 0) {
        notes.show(`Kept: ${kept.map((i) => `${i.name} ×${i.quantity}`).join(', ')}`, lastPoint.current)
      }
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

  const canAffordRestore = money >= FOSSIL_RESTORE_COST

  // A button under an item: the floating note rises from it.
  function button(label: React.ReactNode, onClick: () => void, opts: { kind: string; disabled?: boolean; title?: string }): React.JSX.Element {
    return (
      <button
        className={`item-card-btn item-card-btn-${opts.kind}`}
        disabled={busy || opts.disabled}
        title={opts.title}
        onClick={(e) => {
          lastPoint.current = pointOf(e)
          onClick()
        }}
      >
        {label}
      </button>
    )
  }

  // What can be done with an item, as buttons under it: what it's for on top (use a candy,
  // open a capsule, restore a fossil), and selling one or the whole stack below.
  function itemActions(item: BagItemView): React.JSX.Element {
    const restoreTitle = canAffordRestore ? undefined : `Restoring costs ${formatMoney(FOSSIL_RESTORE_COST)}`
    const useRow =
      item.teamExp !== null ? (
        <span className="item-card-bar">
          {button('Use', () => void useExpCandy(item), {
            kind: 'use',
            title: `+${item.teamExp.toLocaleString('en-US')} exp to each Pokemon on your team`
          })}
          {button('To cap', () => void useExpCandiesUntilCap(item), {
            kind: 'use',
            title: `Keeps using them until your whole team is at the level cap, or you run out (×${item.quantity} left)`
          })}
        </span>
      ) : item.opens ? (
        <span className="item-card-bar">{button('Open', () => void openItem(item), { kind: 'use' })}</span>
      ) : item.fossil === 'single' ? (
        <span className="item-card-bar">
          {button(`Restore ${formatMoney(FOSSIL_RESTORE_COST)}`, () => void restoreSingle(item), {
            kind: 'use',
            disabled: !canAffordRestore,
            title: restoreTitle ?? `Restore it into ${item.restoresTo}`
          })}
        </span>
      ) : item.fossil === 'galar' ? (
        <span className="item-card-bar">
          {button(`Restore ${formatMoney(FOSSIL_RESTORE_COST)}`, () => setGalarFossil(item), {
            kind: 'use',
            disabled: !canAffordRestore,
            title: restoreTitle ?? 'Pick another fossil to restore it with'
          })}
        </span>
      ) : null
    const sellPrice = item.sellPrice
    const sellRow =
      sellPrice === null ? (
        <span className="item-card-note" title="The shop doesn't buy this">
          Can&apos;t be sold
        </span>
      ) : (
        // Sell one, or the whole stack, joined into one bar in the buy buttons' look. It reads
        // "Sell ×1" until hovered - then what one pays, or (hovering All) what the stack pays.
        <BuyButtonGroup>
          <SellButton
            label={
              sellHover?.itemId === item.id
                ? `+${formatMoneyShort(sellPrice * (sellHover.all ? item.quantity : 1))}`
                : 'Sell ×1'
            }
            previewing={sellHover?.itemId === item.id && sellHover.all}
            busy={busy}
            title={`Sell one for ${formatMoney(sellPrice)}`}
            onMouseEnter={() => setSellHover({ itemId: item.id, all: false })}
            onMouseLeave={() => setSellHover(null)}
            onSell={(e) => {
              lastPoint.current = pointOf(e)
              void sell(item)
            }}
          />
          {item.quantity > 1 && (
            <SellButton
              compact
              label="All"
              busy={busy}
              title={`Sell all ×${item.quantity} for ${formatMoney(sellPrice * item.quantity)}`}
              onMouseEnter={() => setSellHover({ itemId: item.id, all: true })}
              onMouseLeave={() => setSellHover(null)}
              onSell={(e) => {
                lastPoint.current = pointOf(e)
                void sell(item, item.quantity)
              }}
            />
          )}
        </BuyButtonGroup>
      )
    return (
      <>
        {useRow}
        {sellRow}
      </>
    )
  }
  const shown = items?.filter((i) => i.name.toLowerCase().includes(query.trim().toLowerCase())) ?? []
  const priceOf = new Map(items?.map((i) => [i.id, i.sellPrice ?? 0]) ?? [])
  const selectionTotal = [...(selection ?? [])].reduce((sum, [id, qty]) => sum + (priceOf.get(id) ?? 0) * qty, 0)
  const selectionCount = [...(selection ?? [])].reduce((sum, [, qty]) => sum + qty, 0)

  return (
    <>
      {error && <p className="editor-error">{error}</p>}
      {!items && !error && <ModalSpinner />}
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
                title="Picks sell-only items (Bottle Caps, Rare Bones...), berries except Sitrus, Lum and the pinch berries, and Memories, Plates and Drives nobody can use"
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
              <div className="item-card-grid">
                {group.map((item) => (
                  <RarityCard
                    key={item.id}
                    tier={item.rarityTier}
                    lift
                    className={`bag-card${selection ? ' bag-card-picking' : ''}${selection?.has(item.id) ? ' bag-item-selected' : ''}${selection && item.sellPrice === null ? ' bag-item-unsellable' : ''}`}
                    title={item.description}
                    // A click on the card only picks it while selecting items to sell.
                    onClick={() => toggleSelected(item)}
                  >
                    <span className="item-card-qty">×{item.quantity}</span>
                    <RarityGlow size={56}>
                      <ItemSprite spritenum={item.spritenum} className="item-card-icon" />
                    </RarityGlow>
                    <span className="item-card-name">{item.name}</span>
                    {selection ? (
                      <span className="item-card-note">
                        {item.sellPrice === null
                          ? "Can't be sold"
                          : selection.has(item.id)
                            ? `✓ ${formatMoney(item.sellPrice * item.quantity)}`
                            : 'Click to pick'}
                      </span>
                    ) : (
                      <span className="item-card-actions">{itemActions(item)}</span>
                    )}
                  </RarityCard>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {selection && (
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
    </>
  )
}

export default BagPanel
