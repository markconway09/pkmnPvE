interface Props {
  // The bet as placed (already kept between 1 and max - see placedBet).
  bet: number
  // Every coin held (at least 1).
  max: number
  disabled: boolean
  onChange: (bet: number) => void
}

/** The bet as it can actually be placed: at least 1, at most every coin held. */
export function placedBet(bet: number, coins: number | null): number {
  return Math.min(Math.max(1, bet), Math.max(1, coins ?? 1))
}

/**
 * The Game Corner's bet control, shared by the slots and blackjack: − and + either side of
 * a slider that stops at 1, then every 10 up to what's held, and Max for the exact total.
 */
function BetSlider({ bet, max, disabled, onChange }: Props): React.JSX.Element {
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
      <span className="slots-bet-value">🪙 {bet.toLocaleString('en-US')}</span>
      <button className="slots-bet-max" disabled={disabled} onClick={() => onChange(max)}>
        Max
      </button>
    </>
  )
}

export default BetSlider
