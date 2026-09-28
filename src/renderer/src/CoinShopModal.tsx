import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ItemOptionEntry } from '../../shared/battle-types'
import { COIN_PACKS, COIN_PRICE, COIN_PRIZES } from '../../shared/slots'
import ItemSprite from './ItemSprite'
import { formatMoney } from './money'
import { errorMessage, pointOf, useFloatingNotes } from './FloatingNotes'

interface Props {
  onClose: () => void
  // The wallet changed - the menu bar's money needs refreshing.
  onMoneyChange: (money: number) => void
}

/**
 * The Game Corner's counter: coin packs bought with Poke Dollars (coins are never sold
 * back), and the prizes coins trade for - they go into the bag.
 */
function CoinShopModal({ onClose, onMoneyChange }: Props): React.JSX.Element {
  const [coins, setCoins] = useState<number | null>(null)
  const [money, setMoney] = useState<number | null>(null)
  const [items, setItems] = useState<Map<string, ItemOptionEntry>>(new Map())
  const [busy, setBusy] = useState(false)
  const notes = useFloatingNotes()

  useEffect(() => {
    Promise.all([window.api.getCoins(), window.api.getMoney(), window.api.getEditorOptions()])
      .then(([c, m, options]) => {
        setCoins(c)
        setMoney(m)
        setItems(new Map(options.items.map((i) => [i.id, i])))
      })
      .catch(() => setCoins(0))
  }, [])

  async function act(e: React.MouseEvent, action: () => Promise<string>): Promise<void> {
    const at = pointOf(e)
    setBusy(true)
    try {
      notes.show(await action(), at)
    } catch (err) {
      notes.show(errorMessage(err), at, 'bad')
    } finally {
      setBusy(false)
    }
  }

  function buyPack(e: React.MouseEvent, amount: number): void {
    void act(e, async () => {
      const result = await window.api.buyCoins(amount)
      setCoins(result.coins)
      setMoney(result.money)
      onMoneyChange(result.money)
      return `Bought ${amount.toLocaleString('en-US')} coins`
    })
  }

  function buyPrize(e: React.MouseEvent, itemId: string): void {
    void act(e, async () => {
      const result = await window.api.buyCoinPrize(itemId)
      setCoins(result.coins)
      return `Got a ${result.itemName} - it's in your bag`
    })
  }

  return createPortal(
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-panel coin-shop-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="shop-header">
          <h2>Coin Shop</h2>
          <span className="coin-shop-balance">
            <span className="slots-coins">🪙 {coins === null ? '…' : coins.toLocaleString('en-US')}</span>
            {money !== null && <span className="money-display">{formatMoney(money)}</span>}
          </span>
        </div>

        <h3 className="shop-category-heading">Buy coins</h3>
        <div className="coin-pack-grid">
          {COIN_PACKS.map((amount) => {
            const price = amount * COIN_PRICE
            return (
              <div key={amount} className="coin-pack">
                <span className="coin-pack-amount">🪙 {amount.toLocaleString('en-US')}</span>
                <span className="shop-item-price">{formatMoney(price)}</span>
                <button disabled={busy || money === null || money < price} onClick={(e) => buyPack(e, amount)}>
                  Buy
                </button>
              </div>
            )
          })}
        </div>
        <p className="editor-hint">Coins can&apos;t be sold back - spend them on the slots or trade them for prizes.</p>

        <h3 className="shop-category-heading">Prizes</h3>
        <div className="shop-grid">
          {COIN_PRIZES.map((prize) => {
            const item = items.get(prize.itemId)
            return (
              <div key={prize.itemId} className="shop-item" title={item?.description}>
                {item && <ItemSprite spritenum={item.spritenum} className="shop-item-icon" />}
                <span className="shop-item-name">{item?.name ?? prize.itemId}</span>
                <span className="shop-item-price">🪙 {prize.coins.toLocaleString('en-US')}</span>
                <button
                  disabled={busy || coins === null || coins < prize.coins}
                  onClick={(e) => buyPrize(e, prize.itemId)}
                >
                  Trade
                </button>
              </div>
            )
          })}
        </div>

        <div className="editor-actions">
          <button onClick={onClose}>Close</button>
        </div>
        {notes.layer}
      </div>
    </div>,
    document.body
  )
}

export default CoinShopModal
