import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { MenuPage } from './menuMode'
import { useT } from './i18n'
import HordeIcon from './HordeIcon'
import { IS_MOBILE_LAYOUT } from './platform'

interface Props {
  page: MenuPage
  // Mid-spin / mid-hand in the Game Corner: nothing can be left until it's over.
  locked: boolean
  onGo: (page: MenuPage, from: HTMLElement) => void
  // The floor of a run in progress, shown on the Battle Tower button.
  runFloor: number | null
  // Raid Crystals held, shown on the Max Raid button (null while raids are locked).
  raidCrystals: number | null
  // Mission rewards and achievements waiting to be claimed.
  rewardsWaiting: number
  onItems: () => void
  onPokedex: () => void
  onRewards: () => void
  onOptions: () => void
}


// The pages the phone layout gathers behind one Modes button, so the bottom bar fits.
const MODES_PAGES: MenuPage[] = ['roguelite', 'draft', 'horde']

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
  onItems,
  onPokedex,
  onRewards,
  onOptions
}: Props): React.JSX.Element {
  const t = useT()
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
        note: blocked ? t('nav.locked') : undefined,
        top: rect.top + rect.height / 2,
        left: rect.right + 12
      })
    },
    onMouseLeave: () => setTip(null)
  })
  const pages: { id: MenuPage; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'home', label: t('nav.home'), icon: <HomeIcon /> },
    { id: 'catch', label: t('nav.catch'), icon: <img className="menu-rail-icon" src="./icons/nav/classic.png" alt="" /> },
    { id: 'box', label: t('nav.box'), icon: <img className="menu-rail-icon" src="./icons/nav/box.png" alt="" /> },
    { id: 'classic', label: t('nav.battles'), icon: <img className="menu-rail-icon menu-rail-icon-pixel" src="./icons/nav/challenge.png" alt="" /> },
    {
      id: 'roguelite',
      label: t('nav.tower'),
      icon: <img className="menu-rail-icon menu-rail-icon-pixel" src="./icons/nav/roguelite.png" alt="" />,
      badge: runFloor !== null ? `F${runFloor}` : undefined
    },
    { id: 'draft', label: t('nav.draft'), icon: <img className="menu-rail-icon menu-rail-icon-draft" src="./icons/nav/draft.png" alt="" /> },
    { id: 'horde', label: t('nav.horde'), icon: <HordeIcon className="menu-rail-icon menu-rail-icon-horde" /> },
    {
      id: 'raid',
      label: t('nav.raid'),
      icon: <img className="menu-rail-icon" src="./sprites/misc/raidcrystal.png" alt="" />,
      badge: raidCrystals ? `×${raidCrystals}` : undefined
    },
    { id: 'corner', label: t('nav.corner'), icon: <img className="menu-rail-icon" src="./icons/nav/coin.png" alt="" /> }
  ]
  // On a phone, Battle Tower, Draft and Horde give way to one Modes button (where the
  // Tower's was), lit while any of the three is open.
  const modesPage = IS_MOBILE_LAYOUT && MODES_PAGES.includes(page) ? 'modes' : page
  if (IS_MOBILE_LAYOUT) {
    const at = pages.findIndex((p) => p.id === 'roguelite')
    pages.splice(at, 0, {
      id: 'modes',
      label: t('nav.modes'),
      icon: <img className="menu-rail-icon menu-rail-icon-pixel" src="./icons/nav/roguelite.png" alt="" />,
      badge: runFloor !== null ? `F${runFloor}` : undefined
    })
    for (const id of MODES_PAGES) pages.splice(pages.findIndex((p) => p.id === id), 1)
  }
  const tools: { label: string; icon: React.ReactNode; action: () => void; badge?: number }[] = [
    { label: t('nav.items'), icon: <img className="menu-rail-icon" src="./icons/nav/bag.png" alt="" />, action: onItems },
    { label: t('nav.pokedex'), icon: <img className="menu-rail-icon" src="./icons/nav/pokedex.png" alt="" />, action: onPokedex },
    {
      label: t('nav.rewards'),
      icon: <img className="menu-rail-icon" src="./icons/nav/achievements.png" alt="" />,
      action: onRewards,
      badge: rewardsWaiting
    },
    { label: t('nav.options'), icon: <img className="menu-rail-icon" src="./icons/nav/options.png" alt="" />, action: onOptions }
  ]

  return (
    <nav className="menu-rail">
      <div className="menu-rail-logo">
        pkmn
        <br />
        PvE
      </div>
      {pages.map((p) => {
        const blocked = locked && modesPage !== p.id
        return (
          <div key={p.id} className="menu-rail-slot" {...tipHandlers(p.label, blocked)}>
            <button
              className={`menu-rail-item menu-rail-page menu-rail-${p.id}${modesPage === p.id ? ' menu-rail-active' : ''}`}
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
      {/* Wrapped so the phone layout can move them to the top bar (on desktop the
          wrapper is invisible to the layout). */}
      <div className="menu-rail-tools">
        {tools.map((tool) => (
          <div key={tool.label} className="menu-rail-slot" {...tipHandlers(tool.label, locked)}>
            <button className="menu-rail-item menu-rail-tool" aria-label={tool.label} disabled={locked} onClick={tool.action}>
              {tool.icon}
              {!!tool.badge && <span className="menu-rail-badge menu-rail-badge-pulse">{tool.badge}</span>}
            </button>
          </div>
        ))}
      </div>
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
