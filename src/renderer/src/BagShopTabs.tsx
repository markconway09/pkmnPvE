import TabStrip from './TabStrip'
import ItemSprite from './ItemSprite'
import { TR_SPRITENUM } from './itemIcon'
import { t } from './i18n'

export type BagShopTab = 'items' | 'keys' | 'tms'

interface Props {
  current: BagShopTab
  onSwitch: (tab: BagShopTab) => void
  // The X beside the tabs closes the window.
  onClose: () => void
}

/** The strip at the top of the Bag window: the Items (bag and shop together), the Key Items and the TMs. */
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
        { id: 'items', label: label(t('bag.tabItems'), './icons/nav/bag.png') },
        { id: 'keys', label: label(t('bag.tabKeys'), './sprites/misc/shinycharm.png') },
        {
          id: 'tms',
          // The TR from the item sheet, as on a Battle Tower run's new-move floor.
          label: (
            <>
              <span className="bag-shop-tab-icon bag-shop-tab-sheet-icon">
                <ItemSprite spritenum={TR_SPRITENUM} />
              </span>
              {t('bag.tabTms')}
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
