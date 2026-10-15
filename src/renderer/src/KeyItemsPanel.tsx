import { useEffect, useState } from 'react'
import type { KeyItemView } from '../../shared/battle-types'
import ItemSprite from './ItemSprite'
import ModalSpinner from './ModalSpinner'
import { achievementNameOf, itemName, itemText, t } from './i18n'

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
      title={`${itemText(item.id, item.description)}\n\n${
        item.owned
          ? t('keys.have')
          : item.coinShop
            ? t('keys.coinShop')
            : t('keys.unlockedBy', { name: achievementNameOf(item.unlockedBy ?? '') })
      }`}
    >
      <span className="item-card-art">
        <ItemSprite spritenum={item.spritenum} className="item-card-icon shop-item-icon" />
      </span>
      <span className="item-card-name">{itemName(item.name)}</span>
      <span className="item-card-note shop-key-item-status">
        {item.owned ? t('keys.owned') : `🔒 ${item.coinShop ? t('bag.coinShop') : achievementNameOf(item.unlockedBy ?? '')}`}
      </span>
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
                {t('keys.ownedHeading', { n: owned.length, of: items.length })}
              </h3>
              <div className="item-card-grid">{owned.map(card)}</div>
            </>
          )}
          {locked.length > 0 && (
            <>
              <h3 className="shop-category-heading">{t('keys.lockedHeading')}</h3>
              <div className="item-card-grid">{locked.map(card)}</div>
            </>
          )}
        </div>
      )}
    </>
  )
}

export default KeyItemsPanel
