import TabStrip from './TabStrip'
import ItemSprite from './ItemSprite'
import { TR_SPRITENUM } from './itemIcon'

export type BagShopTab = 'bag' | 'shop' | 'keys' | 'tms'

interface Props {
  current: BagShopTab
  onSwitch: (tab: BagShopTab) => void
  // The X beside the tabs closes the window.
  onClose: () => void
}

/** The strip at the top of the Bag | Shop window: the Bag, the Shop, the Key Items and the TMs. */
function BagShopTabs({ current, onSwitch, onClose }: Props): React.JSX.Element {
  const label = (name: string, icon: string, smooth = false): React.JSX.Element => (
    <>
      <img className={`bag-shop-tab-icon${smooth ? ' nav-icon-smooth' : ''}`} src={icon} alt="" />
      {name}
    </>
  )
  return (
    <TabStrip
      className="bag-shop-tabs"
      tabs={[
        { id: 'bag', label: label('Bag', './icons/nav/bag.png') },
        { id: 'shop', label: label('Shop', './icons/nav/shop.svg', true) },
        { id: 'keys', label: label('Key Items', './sprites/misc/shinycharm.png') },
        {
          id: 'tms',
          // The TR from the item sheet, as on a Roguelite run's new-move floor.
          label: (
            <>
              <span className="bag-shop-tab-icon bag-shop-tab-sheet-icon">
                <ItemSprite spritenum={TR_SPRITENUM} />
              </span>
              TMs
            </>
          )
        }
      ]}
      current={current}
      onSwitch={onSwitch}
      onClose={onClose}
    />
  )
}

export default BagShopTabs
