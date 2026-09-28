import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { SlotBet, SlotLineWin, SlotSpinResult, SlotSymbol } from '../../shared/slots'
import { SLOT_BETS, SLOT_PAYOUTS, SLOT_REELS, CHERRY_ONE, CHERRY_TWO, linesForBet, SLOT_LINES } from '../../shared/slots'
import ItemSprite from './ItemSprite'
import SpriteImage from './SpriteImage'
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

// Where the reels sit when the machine opens: a mix that wins on no line.
const START_STOPS = [3, 3, 2]

const POKE_BALL_SPRITENUM = 345
const CHERI_BERRY_SPRITENUM = 63

function SymbolIcon({ symbol }: { symbol: SlotSymbol }): React.JSX.Element {
  if (symbol === 'seven') return <span className="slot-seven">7</span>
  if (symbol === 'ball') return <span className="slot-item"><ItemSprite spritenum={POKE_BALL_SPRITENUM} /></span>
  if (symbol === 'cherry') return <span className="slot-item"><ItemSprite spritenum={CHERI_BERRY_SPRITENUM} /></span>
  return <SpriteImage style="2d-static" className="slot-mon" spriteId={symbol} alt={symbol} />
}

/**
 * The Game Corner slot machine: three reels that stop on their own, left to right, on
 * where the main process already stopped them (see spinSlots). A bet of 1, 2 or 3 coins
 * plays 1, 3 or 5 lines; the winning ones light up once the last reel has stopped.
 */
function SlotMachine({ onClose, onOpenCoinShop }: Props): React.JSX.Element {
  const [coins, setCoins] = useState<number | null>(null)
  const [bet, setBet] = useState<SlotBet>(3)
  const [spinning, setSpinning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Each reel's middle symbol right now, and how it's drawn: the strip's offset and
  // whether it's easing to it (a spin) or jumping there (setting up the next spin).
  // It opens on a plain, losing line - not three sevens.
  const stopsRef = useRef<number[]>([...START_STOPS])
  // Each strip starts one loop down, so the row above isn't empty.
  const [offsets, setOffsets] = useState<number[]>(() =>
    SLOT_REELS.map((strip, r) => stripOffset(strip.length + START_STOPS[r]))
  )
  const [animating, setAnimating] = useState(false)
  const [wins, setWins] = useState<SlotLineWin[]>([])
  const spinButtonRef = useRef<HTMLButtonElement>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const notes = useFloatingNotes()

  useEffect(() => {
    window.api
      .getCoins()
      .then(setCoins)
      .catch((e) => setError(errorMessage(e)))
    return () => timers.current.forEach(clearTimeout)
  }, [])

  async function spin(): Promise<void> {
    if (spinning || coins === null) return
    setError(null)
    setWins([])
    let result: SlotSpinResult
    try {
      result = await window.api.spinSlots(bet)
    } catch (e) {
      setError(errorMessage(e))
      return
    }
    setSpinning(true)
    setCoins(result.coins - result.payout)
    // Jump each strip back to its current stop one loop down, then ease it on a few
    // loops to where it lands.
    const lengths = SLOT_REELS.map((s) => s.length)
    setAnimating(false)
    setOffsets(stopsRef.current.map((stop, r) => stripOffset(lengths[r] + stop)))
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setAnimating(true)
        setOffsets(result.stops.map((stop, r) => stripOffset(lengths[r] * 4 + stop)))
      })
    )
    stopsRef.current = result.stops
    timers.current.push(
      setTimeout(() => {
        setSpinning(false)
        setCoins(result.coins)
        setWins(result.wins)
        if (result.payout > 0 && spinButtonRef.current) {
          const rect = spinButtonRef.current.getBoundingClientRect()
          const jackpot = result.wins.some((w) => w.symbol === 'seven')
          notes.show(`${jackpot ? 'JACKPOT! ' : ''}+${result.payout.toLocaleString('en-US')} coins`, {
            x: rect.left + rect.width / 2,
            y: rect.top
          })
        }
      }, REEL_SPIN_MS[REEL_SPIN_MS.length - 1] + 60)
    )
  }

  const playedLines = linesForBet(bet)
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
            {SLOT_REELS.map((strip, r) => (
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
                        <SymbolIcon symbol={symbol} />
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
            {/* The lines this bet plays, faint - and the winners lit once the reels stop. */}
            <svg className="slots-lines" viewBox={`0 0 300 ${CELL * 3}`} preserveAspectRatio="none">
              {SLOT_LINES.map((line, i) => {
                const played = i < playedLines.length
                if (!played) return null
                const points = line.rows.map((row, reel) => `${50 + reel * 100},${CELL / 2 + row * CELL}`).join(' ')
                return (
                  <polyline
                    key={i}
                    points={points}
                    className={`slots-line${winningLines.has(i) ? ' slots-line-win' : ''}`}
                  />
                )
              })}
            </svg>
          </div>
        </div>

        <div className="slots-controls">
          <span className="slots-bet-label">Bet</span>
          {SLOT_BETS.map((b) => (
            <button
              key={b}
              className={`slots-bet${bet === b ? ' slots-bet-active' : ''}`}
              disabled={spinning}
              title={`${b} coin${b === 1 ? '' : 's'} - plays ${linesForBet(b).length} line${b === 1 ? '' : 's'}`}
              onClick={() => setBet(b)}
            >
              {b}
            </button>
          ))}
          <button
            ref={spinButtonRef}
            className="slots-spin"
            disabled={spinning || coins === null || coins < bet}
            onClick={() => void spin()}
          >
            {spinning ? 'Spinning…' : 'Spin'}
          </button>
        </div>
        <p className="editor-hint slots-hint">
          Bet 1 plays the middle row, 2 all three rows, 3 the rows and both diagonals - more lines for your coin.
        </p>
        {error && <p className="editor-error">{error}</p>}
        {coins !== null && coins < bet && !spinning && (
          <p className="editor-hint">
            Not enough coins for this bet.{' '}
            <button className="link-button" onClick={onOpenCoinShop}>
              Buy some at the Coin Shop
            </button>
          </p>
        )}

        <div className="slots-paytable">
          {(['seven', 'ball', 'pikachu', 'marill', 'psyduck'] as SlotSymbol[]).map((symbol) => (
            <div key={symbol} className="slots-pay">
              <span className="slots-pay-icons">
                <SymbolIcon symbol={symbol} />
                <SymbolIcon symbol={symbol} />
                <SymbolIcon symbol={symbol} />
              </span>
              <span>{SLOT_PAYOUTS[symbol]}</span>
            </div>
          ))}
          <div className="slots-pay">
            <span className="slots-pay-icons">
              <SymbolIcon symbol="cherry" />
            </span>
            <span>
              {CHERRY_ONE} · two: {CHERRY_TWO} · three: {SLOT_PAYOUTS.cherry}
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
