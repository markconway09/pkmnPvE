import { useState } from 'react'
import { createPortal } from 'react-dom'
import BagShopTabs, { type BagShopTab } from './BagShopTabs'
import ItemsPanel from './ItemsPanel'
import KeyItemsPanel from './KeyItemsPanel'
import TMsPanel from './TMsPanel'

interface Props {
  onClose: () => void
  // Selling, buying or restoring changes the wallet and (for a restore) the box, both
  // of which the main menu is showing behind this.
  onChanged: () => void
  onMoneyChange: (money: number) => void
  // From a Friendship Petal: closes this and opens the Coin Shop at its daily petals.
  onOpenCoinShop: () => void
}

/**
 * The Items (the bag and the shop together), the Key Items and the TMs as one window, with
 * tabs across the top - so the tab highlight slides over instead of the whole window
 * closing and reopening.
 */
function BagShopModal({ onClose, onChanged, onMoneyChange, onOpenCoinShop }: Props): React.JSX.Element {
  const [tab, setTab] = useState<BagShopTab>('items')

  return createPortal(
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-panel bag-shop-modal" onMouseDown={(e) => e.stopPropagation()}>
        <BagShopTabs current={tab} onSwitch={setTab} onClose={onClose} />
        {tab === 'items' && <ItemsPanel onChanged={onChanged} onMoneyChange={onMoneyChange} onOpenCoinShop={onOpenCoinShop} />}
        {tab === 'keys' && <KeyItemsPanel />}
        {tab === 'tms' && <TMsPanel />}
      </div>
    </div>,
    document.body
  )
}

export default BagShopModal
