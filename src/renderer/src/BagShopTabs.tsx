export type BagShopTab = 'bag' | 'shop'

interface Props {
  current: BagShopTab
  onSwitch: () => void
}

/** The strip at the top of the Bag and the Shop, to go straight to the other one. */
function BagShopTabs({ current, onSwitch }: Props): React.JSX.Element {
  const tab = (which: BagShopTab, label: string, icon: string): React.JSX.Element => (
    <button
      className={`game-corner-tab bag-shop-tab${current === which ? ' game-corner-tab-active' : ''}`}
      onClick={() => current !== which && onSwitch()}
    >
      <img className={`bag-shop-tab-icon${which === 'shop' ? ' nav-icon-smooth' : ''}`} src={icon} alt="" />
      {label}
    </button>
  )
  return (
    <div className="game-corner-tabs">
      {tab('bag', 'Bag', './icons/nav/bag.png')}
      {tab('shop', 'Shop', './icons/nav/shop.png')}
    </div>
  )
}

export default BagShopTabs
