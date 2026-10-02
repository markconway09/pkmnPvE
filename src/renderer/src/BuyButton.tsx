import type { ReactNode } from 'react'
import CoinIcon from './CoinIcon'
import { formatMoney, formatMoneyShort, formatShort } from './money'

interface Props {
  // What it costs, in coins or Poke Dollars.
  price: number
  currency: 'coins' | 'money'
  // How much of that currency the player holds (null while it loads): it can't be bought
  // with less, and the price shows in red.
  held: number | null
  onBuy: (e: React.MouseEvent) => void
  // A purchase in progress - every button waits.
  busy?: boolean
  // Already bought (a once-a-day offer): greyed out, reading "Sold out".
  soldOut?: boolean
  // In place of the price (a bulk button's "×5").
  label?: ReactNode
  // Showing another amount's total for now (a hovered bulk button's) - drawn in orange.
  previewing?: boolean
  // Narrow, beside a wider one in a BuyButtonGroup.
  compact?: boolean
  // Its tooltip - while it can't be afforded, how much more is needed shows instead.
  title?: string
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}

/**
 * The game's buy button - the default for anything bought with coins or Poke Dollars: flat
 * and outlined in gold with the price in gold, filling in a little on hover and press.
 * Greyed out while it can't be bought, with the price in red (and how much more is
 * needed on hover) when it's the money or coins that fall short.
 */
function BuyButton({
  price,
  currency,
  held,
  onBuy,
  busy,
  soldOut,
  label,
  previewing,
  compact,
  title,
  onMouseEnter,
  onMouseLeave
}: Props): React.JSX.Element {
  const short = !soldOut && held !== null && held < price
  const missing = held === null ? 0 : price - held
  const shortTitle = short
    ? currency === 'coins'
      ? `${missing.toLocaleString('en-US')} more coins needed`
      : `${formatMoney(missing)} more needed`
    : undefined
  // The price with its thousands as k ("₽1.5k", "25k") - the exact amount on hover.
  const priceLabel =
    currency === 'coins' ? (
      <>
        <CoinIcon /> {formatShort(price)}
      </>
    ) : (
      formatMoneyShort(price)
    )
  const exactPrice = currency === 'coins' ? `${price.toLocaleString('en-US')} coins` : formatMoney(price)
  return (
    <button
      className={`buy-button${compact ? ' buy-button-compact' : ''}${short ? ' buy-button-short' : ''}${previewing ? ' buy-button-preview' : ''}`}
      disabled={busy || soldOut || held === null || held < price}
      title={shortTitle ?? title ?? exactPrice}
      onClick={onBuy}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {soldOut ? 'Sold out' : (label ?? priceLabel)}
    </button>
  )
}

interface SellProps {
  // What it pays out (shown with its thousands as k), or a label of its own ("All").
  label: ReactNode
  onSell: (e: React.MouseEvent) => void
  busy?: boolean
  // Narrow, beside a wider one in a BuyButtonGroup.
  compact?: boolean
  // Showing another amount for now (what selling the whole stack pays) - drawn in orange.
  previewing?: boolean
  title?: string
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}

/** A sell button in BuyButton's look - joined into a BuyButtonGroup for a sell one / sell all split. */
export function SellButton({
  label,
  onSell,
  busy,
  compact,
  previewing,
  title,
  onMouseEnter,
  onMouseLeave
}: SellProps): React.JSX.Element {
  return (
    <button
      className={`buy-button${compact ? ' buy-button-compact' : ''}${previewing ? ' buy-button-preview' : ''}`}
      disabled={busy}
      title={title}
      onClick={onSell}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {label}
    </button>
  )
}

/** Buy buttons joined into one segmented bar (shared borders, rounded only at the ends). */
export function BuyButtonGroup({ children }: { children: ReactNode }): React.JSX.Element {
  return <span className="buy-button-group">{children}</span>
}

export default BuyButton
