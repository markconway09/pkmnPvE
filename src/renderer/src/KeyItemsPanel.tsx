import { useEffect, useState } from 'react'
import type { KeyItemView } from '../../shared/battle-types'
import ItemSprite from './ItemSprite'
import ModalSpinner from './ModalSpinner'

/**
 * The Key Items tab of the Bag | Shop window (see BagShopModal): every key item, the ones
 * the player has first, and the rest greyed out with the achievement that unlocks each.
 */
function KeyItemsPanel(): React.JSX.Element {
  const [items, setItems] = useState<KeyItemView[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.api
      .listKeyItems()
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  const owned = items?.filter((i) => i.owned) ?? []
  const locked = items?.filter((i) => !i.owned) ?? []

  const card = (item: KeyItemView): React.JSX.Element => (
    <div
      key={item.id}
      className={`item-card shop-key-item${item.owned ? ' shop-key-item-owned' : ''}`}
      title={`${item.description}\n\n${item.owned ? 'You have it.' : `Unlocked by the achievement "${item.unlockedBy}".`}`}
    >
      <span className="item-card-art">
        <ItemSprite spritenum={item.spritenum} className="item-card-icon shop-item-icon" />
      </span>
      <span className="item-card-name">{item.name}</span>
      <span className="item-card-note shop-key-item-status">{item.owned ? '✓ Owned' : `🔒 ${item.unlockedBy}`}</span>
    </div>
  )

  return (
    <>
      {error && <p className="editor-error">{error}</p>}
      {!items && !error && <ModalSpinner />}
      {items && (
        <div className="bag-scroll">
          {owned.length > 0 && (
            <>
              <h3 className="shop-category-heading">
                Owned · {owned.length} of {items.length}
              </h3>
              <div className="item-card-grid">{owned.map(card)}</div>
            </>
          )}
          {locked.length > 0 && (
            <>
              <h3 className="shop-category-heading">Locked - unlocked by achievements</h3>
              <div className="item-card-grid">{locked.map(card)}</div>
            </>
          )}
        </div>
      )}
    </>
  )
}

export default KeyItemsPanel
