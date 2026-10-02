import type { HTMLAttributes, ReactNode, Ref } from 'react'
import type { RarityTier } from '../../shared/battle-types'

interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'className' | 'children'> {
  // Its colour, in the Pokemon rarity colours: grey, blue, purple, red, gold.
  tier: RarityTier
  children: ReactNode
  // Layout (size, padding, direction) is the caller's: the card takes whatever size its
  // className or its parent gives it.
  className?: string
  // A coloured stripe along the top (the default), or a full frame with an inner glow
  // for a featured card.
  framed?: boolean
  // Rises a little, glowing in its colour, under the mouse.
  lift?: boolean
  // Greyed out (bought, locked...).
  dimmed?: boolean
  cardRef?: Ref<HTMLDivElement>
}

// An item's colour by its Shop price (see shared/rarity).
export { priceRarityTier } from '../../shared/rarity'

/**
 * A box tinted in a rarity's colour, with its border (or a full frame) in that colour -
 * any size: it fills whatever its className or parent gives it. Put a RarityGlow inside
 * for the glowing stand an item or Pokemon sits on. Anything else a div takes (handlers,
 * drag-and-drop attributes...) passes straight through.
 */
function RarityCard({ tier, children, className, framed, lift, dimmed, cardRef, ...rest }: CardProps): React.JSX.Element {
  return (
    <div
      ref={cardRef}
      {...rest}
      className={`rarity-card rarity-tier-${tier}${framed ? ' rarity-card-framed' : ''}${lift ? ' rarity-card-lift' : ''}${dimmed ? ' rarity-card-dimmed' : ''}${className ? ` ${className}` : ''}`}
    >
      {children}
    </div>
  )
}

interface GlowProps {
  children: ReactNode
  // Its colour - inside a RarityCard it takes the card's, so this can be left out.
  tier?: RarityTier
  // Its size in pixels: a number for a square, or a width and height - or null to leave
  // it to its className (a size that grows with the card).
  size?: number | { width: number; height: number } | null
  // A round glow around what's in it (the default), or a stand it sits on, glowing
  // under its feet.
  stand?: boolean
  className?: string
}

/** The soft glow, in a rarity's colour, that an item or Pokemon sits in - any size. */
export function RarityGlow({ children, tier, size = 80, stand, className }: GlowProps): React.JSX.Element {
  const style = size === null ? undefined : typeof size === 'number' ? { width: size, height: size } : size
  return (
    <span
      className={`rarity-glow${stand ? ' rarity-glow-stand' : ''}${tier ? ` rarity-tier-${tier}` : ''}${className ? ` ${className}` : ''}`}
      style={style}
    >
      {children}
    </span>
  )
}

export default RarityCard
