import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { MenuPage } from './menuMode'

interface Props {
  page: MenuPage
  // Mid-spin / mid-hand in the Game Corner: nothing can be left until it's over.
  locked: boolean
  onGo: (page: MenuPage, from: HTMLElement) => void
  // The floor of a run in progress, shown on the Roguelite button.
  runFloor: number | null
  // Raid Crystals held, shown on the Max Raid button (null while raids are locked).
  raidCrystals: number | null
  // Mission rewards and achievements waiting to be claimed.
  rewardsWaiting: number
  onBag: () => void
  onShop: () => void
  onPokedex: () => void
  onRewards: () => void
  onOptions: () => void
}


/** A little house for Home - there's no pixel-art one among the nav icons. */
function HomeIcon(): React.JSX.Element {
  return (
    <svg className="menu-rail-icon menu-rail-icon-home" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2 8 8 2.5 14 8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 7.2V13.5h3V10h2v3.5h3V7.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * The main menu's sidebar: Home and the game's modes at the top (each a page of the
 * menu), the things used from anywhere - bag, shop, Pokedex, rewards, options - at the
 * bottom (each opens its window over the page).
 */
function MenuRail({
  page,
  locked,
  onGo,
  runFloor,
  raidCrystals,
  rewardsWaiting,
  onBag,
  onShop,
  onPokedex,
  onRewards,
  onOptions
}: Props): React.JSX.Element {
  // The hovered button's name, in a tooltip to its right, centred on it. Hover goes by
  // the button's slot, so a locked (disabled) button still says what it is.
  const [tip, setTip] = useState<{ label: string; note?: string; top: number; left: number } | null>(null)
  const tipHandlers = (
    label: string,
    blocked: boolean
  ): { onMouseEnter: (e: React.MouseEvent<HTMLElement>) => void; onMouseLeave: () => void } => ({
    onMouseEnter: (e) => {
      const rect = e.currentTarget.getBoundingClientRect()
      setTip({
        label,
        note: blocked ? 'Finish the game in play first' : undefined,
        top: rect.top + rect.height / 2,
        left: rect.right + 12
      })
    },
    onMouseLeave: () => setTip(null)
  })
  const pages: { id: MenuPage; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'home', label: 'Home', icon: <HomeIcon /> },
    { id: 'classic', label: 'Classic', icon: <img className="menu-rail-icon" src="./icons/nav/classic.png" alt="" /> },
    {
      id: 'roguelite',
      label: 'Roguelite',
      icon: <img className="menu-rail-icon" src="./icons/nav/roguelite.png" alt="" />,
      badge: runFloor !== null ? `F${runFloor}` : undefined
    },
    { id: 'draft', label: 'Draft', icon: <img className="menu-rail-icon menu-rail-icon-draft" src="./icons/nav/draft.png" alt="" /> },
    {
      id: 'raid',
      label: 'Max Raid',
      icon: <img className="menu-rail-icon" src="./sprites/misc/raidcrystal.png" alt="" />,
      badge: raidCrystals ? `×${raidCrystals}` : undefined
    },
    { id: 'corner', label: 'Game Corner', icon: <img className="menu-rail-icon" src="./icons/nav/coin.png" alt="" /> },
    { id: 'box', label: 'Box', icon: <img className="menu-rail-icon" src="./icons/nav/box.png" alt="" /> }
  ]
  const tools: { label: string; icon: React.ReactNode; action: () => void; badge?: number }[] = [
    { label: 'Bag', icon: <img className="menu-rail-icon" src="./icons/nav/bag.png" alt="" />, action: onBag },
    { label: 'Shop', icon: <img className="menu-rail-icon menu-rail-icon-smooth" src="./icons/nav/shop.svg" alt="" />, action: onShop },
    { label: 'Pokédex', icon: <img className="menu-rail-icon" src="./icons/nav/pokedex.png" alt="" />, action: onPokedex },
    {
      label: 'Rewards',
      icon: <img className="menu-rail-icon" src="./icons/nav/achievements.png" alt="" />,
      action: onRewards,
      badge: rewardsWaiting
    },
    { label: 'Options', icon: <img className="menu-rail-icon" src="./icons/nav/options.png" alt="" />, action: onOptions }
  ]

  return (
    <nav className="menu-rail">
      <div className="menu-rail-logo">
        pkmn
        <br />
        PvE
      </div>
      {pages.map((p) => {
        const blocked = locked && page !== p.id
        return (
          <div key={p.id} className="menu-rail-slot" {...tipHandlers(p.label, blocked)}>
            <button
              className={`menu-rail-item menu-rail-page menu-rail-${p.id}${page === p.id ? ' menu-rail-active' : ''}`}
              aria-label={p.label}
              data-sfx="tab"
              disabled={blocked}
              onClick={(e) => onGo(p.id, e.currentTarget)}
            >
              {p.icon}
              {p.badge && <span className={`menu-rail-badge menu-rail-badge-${p.id}`}>{p.badge}</span>}
            </button>
          </div>
        )
      })}
      <span className="menu-rail-spacer" />
      {tools.map((t) => (
        <div key={t.label} className="menu-rail-slot" {...tipHandlers(t.label, locked)}>
          <button className="menu-rail-item menu-rail-tool" aria-label={t.label} disabled={locked} onClick={t.action}>
            {t.icon}
            {!!t.badge && <span className="menu-rail-badge menu-rail-badge-pulse">{t.badge}</span>}
          </button>
        </div>
      ))}
      {tip &&
        createPortal(
          <div className="menu-rail-tip" style={{ top: tip.top, left: tip.left }}>
            {tip.label}
            {tip.note && <span className="menu-rail-tip-note">{tip.note}</span>}
          </div>,
          document.body
        )}
    </nav>
  )
}

export default MenuRail
