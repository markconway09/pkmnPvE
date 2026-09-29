import { useEffect, useState } from 'react'
import { MAX_BET } from '../../shared/slots'
import CoinIcon from './CoinIcon'

interface Props {
  // The bet as placed (already kept between 1 and max - see placedBet).
  bet: number
  // The most that can be bet: every coin held, up to MAX_BET (at least 1).
  max: number
  disabled: boolean
  onChange: (bet: number) => void
}

/**
 * The bet wanted at a Game Corner game, remembered between visits (and app restarts): it
 * starts at the last amount bet there, and placedBet brings it down to what's held if
 * that's less.
 */
export function useSavedBet(game: 'slots' | 'blackjack'): [number, (bet: number) => void] {
  const key = `pkmnpve.lastBet.${game}`
  const [bet, setBet] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(key))
      return Number.isInteger(saved) && saved >= 1 ? Math.min(MAX_BET, saved) : 10
    } catch {
      return 10
    }
  })
  function saveBet(next: number): void {
    setBet(next)
    try {
      localStorage.setItem(key, String(next))
    } catch {
      // localStorage unavailable - the bet just isn't remembered
    }
  }
  return [bet, saveBet]
}

/** The most that can be bet holding this many coins: all of them, up to MAX_BET. */
export function maxBet(coins: number | null): number {
  return Math.max(1, Math.min(MAX_BET, coins ?? 1))
}

/** The bet as it can actually be placed: at least 1, at most maxBet. */
export function placedBet(bet: number, coins: number | null): number {
  return Math.min(Math.max(1, bet), maxBet(coins))
}

/**
 * The Game Corner's bet control, shared by the slots and blackjack: − and + either side of
 * a slider that stops at 1, then every 10 up to what's held, and Max for the exact total.
 */
function BetSlider({ bet, max, disabled, onChange }: Props): React.JSX.Element {
  // The bet as typed: kept apart from the bet itself while typing (so the box can be
  // cleared and retyped), and put back to the bet whenever that changes elsewhere.
  const [typed, setTyped] = useState(String(bet))
  useEffect(() => setTyped(String(bet)), [bet])
  function typeBet(text: string): void {
    const digits = text.replace(/[^0-9]/g, '')
    setTyped(digits)
    if (digits) onChange(Math.min(max, Math.max(1, Number(digits))))
  }

  const steps = [1, ...Array.from({ length: Math.floor(max / 10) }, (_, i) => (i + 1) * 10)]
  const stepIndex = steps.reduce((best, step, i) => (step <= bet ? i : best), 0)
  // − and + move one stop down or up (from a Max bet between stops, down to the stop
  // below; + past the last stop, up to everything held).
  const lower = steps[bet === steps[stepIndex] ? Math.max(0, stepIndex - 1) : stepIndex]
  const higher = stepIndex < steps.length - 1 ? steps[stepIndex + 1] : max
  return (
    <>
      <span className="slots-bet-label">Bet</span>
      <button className="slots-bet-step" title="Bet less" disabled={disabled || bet <= 1} onClick={() => onChange(lower)}>
        −
      </button>
      <input
        type="range"
        className="slots-bet-slider"
        min={0}
        max={steps.length - 1}
        value={stepIndex}
        disabled={disabled}
        onChange={(e) => onChange(steps[Number(e.target.value)])}
      />
      <button className="slots-bet-step" title="Bet more" disabled={disabled || bet >= max} onClick={() => onChange(higher)}>
        +
      </button>
      <label className="slots-bet-value" title={`Type a bet (1 up to ${MAX_BET}, or every coin you have if that's less)`}>
        <CoinIcon />
        <input
          className="slots-bet-input"
          type="text"
          inputMode="numeric"
          value={typed}
          disabled={disabled}
          onChange={(e) => typeBet(e.target.value)}
          onBlur={() => setTyped(String(bet))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
        />
      </label>
      <button className="slots-bet-max" disabled={disabled} onClick={() => onChange(max)}>
        Max
      </button>
    </>
  )
}

export default BetSlider
