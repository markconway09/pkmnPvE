import { useState } from 'react'
import { createPortal } from 'react-dom'
import BagShopTabs, { type BagShopTab } from './BagShopTabs'
import BagPanel from './BagPanel'
import ShopPanel from './ShopPanel'
import KeyItemsPanel from './KeyItemsPanel'

interface Props {
  initialTab: BagShopTab
  onClose: () => void
  // Selling, buying or restoring changes the wallet and (for a restore) the box, both
  // of which the main menu is showing behind this.
  onChanged: () => void
  onMoneyChange: (money: number) => void
}

/**
 * The Bag, the Shop and the Key Items as one window, with tabs across the top - so
 * the tab highlight slides over instead of the whole window closing and reopening.
 */
function BagShopModal({ initialTab, onClose, onChanged, onMoneyChange }: Props): React.JSX.Element {
  const [tab, setTab] = useState<BagShopTab>(initialTab)

  function switchTab(next: BagShopTab): void {
    // Whatever was just bought shows up in the bag (and the box behind it).
    if (next === 'bag') onChanged()
    setTab(next)
  }

  function close(): void {
    if (tab === 'shop') onChanged()
    onClose()
  }

  return createPortal(
    <div className="modal-overlay" onMouseDown={close}>
      <div className="modal-panel bag-shop-modal" onMouseDown={(e) => e.stopPropagation()}>
        <BagShopTabs current={tab} onSwitch={switchTab} onClose={close} />
        {tab === 'bag' && <BagPanel onChanged={onChanged} />}
        {tab === 'shop' && <ShopPanel onMoneyChange={onMoneyChange} />}
        {tab === 'keys' && <KeyItemsPanel />}
      </div>
    </div>,
    document.body
  )
}

export default BagShopModal
