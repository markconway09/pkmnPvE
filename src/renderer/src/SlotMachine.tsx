import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { SlotLineWin, SlotSpinResult, SlotSymbol } from '../../shared/slots'
import type { SlotRules } from '../../shared/slots'
import { SLOT_RULES, SLOT_ROWS } from '../../shared/slots'
import ItemSprite from './ItemSprite'
import SpriteImage from './SpriteImage'
import { toSpriteId } from '../../shared/battle-types'
import { errorMessage, useFloatingNotes } from './FloatingNotes'

interface Props {
  onClose: () => void
  // "Coin Shop" from inside the machine, for when the coins run out.
  onOpenCoinShop: () => void
}

// One symbol's cell on a reel.
const CELL = 64
// The strip is drawn this many times over, so a spin can travel a few loops before it stops.
const REPEATS = 6
// Each reel stops a little after the one before it, left to right.
const REEL_SPIN_MS = [1100, 1600, 2100]

// Where a strip sits for `cell` (a cell index on the repeated strip) to be in the middle row.
function stripOffset(cell: number): number {
  return -(cell - 1) * CELL
}

// Where the reels sit when the machine opens: a full mix that wins on no row.
const START_STOPS = [0, 1, 1]

const POKE_BALL_SPRITENUM = 345
const CHERI_BERRY_SPRITENUM = 63

// The Pokemon each tier stands for this time the machine is open.
type SlotPokemon = SlotRules['pokemon']

function SymbolIcon({ symbol, pokemon }: { symbol: SlotSymbol; pokemon: SlotPokemon }): React.JSX.Element {
  if (symbol === 'ball') return <span className="slot-item"><ItemSprite spritenum={POKE_BALL_SPRITENUM} /></span>
  if (symbol === 'cherry') return <span className="slot-item"><ItemSprite spritenum={CHERI_BERRY_SPRITENUM} /></span>
  const species = symbol === 'gholdengo' ? 'Gholdengo' : pokemon[symbol]
  return <SpriteImage style="2d-static" className="slot-mon" spriteId={toSpriteId(species)} alt={species} />
}

/**
 * The Game Corner slot machine: three reels that stop on their own, left to right, on
 * where the main process already stopped them (see spinSlots). Every spin plays all three
 * rows; the bet (a slider, up to every coin held) multiplies whatever they win, and the
 * winning rows light up once the last reel has stopped.
 */
function SlotMachine({ onClose, onOpenCoinShop }: Props): React.JSX.Element {
  const [coins, setCoins] = useState<number | null>(null)
  const [bet, setBet] = useState(10)
  const [spinning, setSpinning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Each reel's middle symbol right now, and how it's drawn: the strip's offset and
  // whether it's easing to it (a spin) or jumping there (setting up the next spin).
  // It opens on a plain, losing line - not three Gholdengo.
  const stopsRef = useRef<number[]>([...START_STOPS])
  // Each strip starts one loop down, so the row above isn't empty.
  const [offsets, setOffsets] = useState<number[]>(() =>
    SLOT_RULES.reels.map((strip, r) => stripOffset(strip.length + (START_STOPS[r] % strip.length)))
  )
  const [animating, setAnimating] = useState(false)
  const [wins, setWins] = useState<SlotLineWin[]>([])
  const spinButtonRef = useRef<HTMLButtonElement>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const notes = useFloatingNotes()
  // The reels and payouts as the main process has them (see SLOT_RULES) - this copy is
  // only until they arrive.
  const [rules, setRules] = useState<SlotRules>(SLOT_RULES)

  useEffect(() => {
    window.api
      .getCoins()
      .then(setCoins)
      .catch((e) => setError(errorMessage(e)))
    window.api
      .getSlotRules()
      .then((loaded) => {
        setRules(loaded)
        stopsRef.current = loaded.reels.map((strip, r) => START_STOPS[r] % strip.length)
        setOffsets(loaded.reels.map((strip, r) => stripOffset(strip.length + stopsRef.current[r])))
      })
      .catch(() => {})
    return () => timers.current.forEach(clearTimeout)
  }, [])

  // The bet as it can actually be placed: at least 1, at most every coin held.
  const maxBet = Math.max(1, coins ?? 1)
  const placedBet = Math.min(Math.max(1, bet), maxBet)
  // The slider's stops: 1, then every 10 up to what's held (Max bets the exact total).
  const betSteps = [1, ...Array.from({ length: Math.floor(maxBet / 10) }, (_, i) => (i + 1) * 10)]
  const stepIndex = betSteps.reduce((best, step, i) => (step <= placedBet ? i : best), 0)
  // − and + move one stop down or up (from a Max bet between stops, down to the stop below;
  // + past the last stop, up to everything held).
  const lowerBet = betSteps[placedBet === betSteps[stepIndex] ? Math.max(0, stepIndex - 1) : stepIndex]
  const higherBet = stepIndex < betSteps.length - 1 ? betSteps[stepIndex + 1] : maxBet
  const betLocked = spinning || coins === null || coins < 1

  async function spin(): Promise<void> {
    if (spinning || coins === null || coins < placedBet) return
    setError(null)
    setWins([])
    let result: SlotSpinResult
    try {
      result = await window.api.spinSlots(placedBet)
    } catch (e) {
      setError(errorMessage(e))
      return
    }
    setSpinning(true)
    setCoins(result.coins - result.payout)
    // Jump each strip back to its current stop one loop down, then ease it on a few
    // loops to where it lands.
    const lengths = rules.reels.map((s) => s.length)
    setAnimating(false)
    setOffsets(stopsRef.current.map((stop, r) => stripOffset(lengths[r] + stop)))
    stopsRef.current = result.stops
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setAnimating(true)
        setOffsets(result.stops.map((stop, r) => stripOffset(lengths[r] * 4 + stop)))
        // Counted from here, when the reels really start moving, so the win shows only
        // once the last one has stopped.
        timers.current.push(setTimeout(() => settle(result), REEL_SPIN_MS[REEL_SPIN_MS.length - 1] + 80))
      })
    )
  }

  // The last reel has stopped: pay out, light the winning rows.
  function settle(result: SlotSpinResult): void {
    setSpinning(false)
    setCoins(result.coins)
    setWins(result.wins)
    if (result.payout > 0 && spinButtonRef.current) {
      const rect = spinButtonRef.current.getBoundingClientRect()
      const jackpot = result.wins.some((w) => w.symbol === 'gholdengo')
      notes.show(`${jackpot ? 'JACKPOT! ' : ''}+${result.payout.toLocaleString('en-US')} coins`, {
        x: rect.left + rect.width / 2,
        y: rect.top
      })
    }
  }

  const winningLines = new Set(wins.map((w) => w.line))

  return createPortal(
    <div className="modal-overlay" onMouseDown={() => !spinning && onClose()}>
      <div className="modal-panel slots-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="slots-header">
          <h2>Slot Machine</h2>
          <span className="slots-coins">🪙 {coins === null ? '…' : coins.toLocaleString('en-US')} coins</span>
        </div>

        <div className="slots-machine">
          <div className="slots-window" style={{ height: CELL * 3 }}>
            {rules.reels.map((strip, r) => (
              <div key={r} className="slots-reel" style={{ height: CELL * 3 }}>
                <div
                  className="slots-strip"
                  style={{
                    transform: `translateY(${offsets[r]}px)`,
                    transition: animating ? `transform ${REEL_SPIN_MS[r]}ms cubic-bezier(0.15, 0.6, 0.25, 1)` : 'none'
                  }}
                >
                  {Array.from({ length: REPEATS }, (_, rep) =>
                    strip.map((symbol, i) => (
                      <div key={`${rep}-${i}`} className="slots-cell" style={{ height: CELL }}>
                        <SymbolIcon symbol={symbol} pokemon={rules.pokemon} />
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
            {/* The three rows every spin plays, faint - and the winners lit once the reels stop. */}
            <svg className="slots-lines" viewBox={`0 0 300 ${CELL * 3}`} preserveAspectRatio="none">
              {SLOT_ROWS.map((row) => (
                <line
                  key={row}
                  x1={4}
                  x2={296}
                  y1={CELL / 2 + row * CELL}
                  y2={CELL / 2 + row * CELL}
                  className={`slots-line${winningLines.has(row) ? ' slots-line-win' : ''}`}
                />
              ))}
            </svg>
          </div>
        </div>

        <div className="slots-controls">
          <span className="slots-bet-label">Bet</span>
          <button className="slots-bet-step" title="Bet less" disabled={betLocked || placedBet <= 1} onClick={() => setBet(lowerBet)}>
            −
          </button>
          <input
            type="range"
            className="slots-bet-slider"
            min={0}
            max={betSteps.length - 1}
            value={stepIndex}
            disabled={spinning || coins === null || coins < 1}
            onChange={(e) => setBet(betSteps[Number(e.target.value)])}
          />
          <button className="slots-bet-step" title="Bet more" disabled={betLocked || placedBet >= maxBet} onClick={() => setBet(higherBet)}>
            +
          </button>
          <span className="slots-bet-value">
            🪙 {placedBet.toLocaleString('en-US')}
          </span>
          <button className="slots-bet-max" disabled={spinning || !coins} onClick={() => setBet(maxBet)}>
            Max
          </button>
          <button
            ref={spinButtonRef}
            className="slots-spin"
            disabled={spinning || coins === null || coins < placedBet}
            onClick={() => void spin()}
          >
            {spinning ? 'Spinning…' : 'Spin'}
          </button>
        </div>
        <p className="editor-hint slots-hint">
          Every spin plays all three rows. Each winning row pays the amount below times your bet.
        </p>
        {error && <p className="editor-error">{error}</p>}
        {coins !== null && coins < 1 && !spinning && (
          <p className="editor-hint">
            You&apos;re out of coins.{' '}
            <button className="link-button" onClick={onOpenCoinShop}>
              Buy some at the Coin Shop
            </button>
          </p>
        )}

        <div className="slots-paytable">
          {(['gholdengo', 'ball', 'high', 'mid', 'low'] as const).map((symbol) => (
            <div key={symbol} className="slots-pay">
              <span className="slots-pay-icons">
                <SymbolIcon symbol={symbol} pokemon={rules.pokemon} />
                <SymbolIcon symbol={symbol} pokemon={rules.pokemon} />
                <SymbolIcon symbol={symbol} pokemon={rules.pokemon} />
              </span>
              <span>×{rules.payouts[symbol].toLocaleString('en-US')}</span>
            </div>
          ))}
          <div className="slots-pay">
            <span className="slots-pay-icons">
              <SymbolIcon symbol="cherry" pokemon={rules.pokemon} />
            </span>
            <span>
              ×{rules.cherryOne} · two: ×{rules.cherryTwo} · three: ×{rules.payouts.cherry}
            </span>
          </div>
        </div>

        <div className="editor-actions">
          <button onClick={onOpenCoinShop} disabled={spinning}>
            Coin Shop
          </button>
          <button onClick={onClose} disabled={spinning}>
            Close
          </button>
        </div>
        {notes.layer}
      </div>
    </div>,
    document.body
  )
}

export default SlotMachine
