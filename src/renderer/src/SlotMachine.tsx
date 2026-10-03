import { useEffect, useRef, useState } from 'react'
import { GameCornerLoading } from './GameCornerTabs'
import type { SlotLineWin, SlotSpinResult, SlotSymbol } from '../../shared/slots'
import type { SlotRules } from '../../shared/slots'
import { SLOT_LINES, SLOT_RULES } from '../../shared/slots'
import ItemSprite from './ItemSprite'
import BetSlider, { maxBet, placedBet, useGameCornerPerks, useSavedBet, betStep, TITLE_CHANGED_EVENT } from './BetSlider'
import type { GameCornerGameProps } from './GameCornerTabs'
import SpriteImage from './SpriteImage'
import { toSpriteId } from '../../shared/battle-types'
import { errorMessage, useFloatingNotes } from './FloatingNotes'
import { playClunk, playTick } from './ticks'

// One symbol's cell on a reel.
const CELL = 96
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
 * where the main process already stopped them (see spinSlots). Every spin plays five
 * lines (the rows and both diagonals); the bet (a slider, up to every coin held or the bet cap)
 * multiplies whatever they win, and the winning lines light up once the last reel stops.
 */
function SlotMachine({ onOpenCoinShop, onBusyChange, onCoinsChange }: GameCornerGameProps): React.JSX.Element {
  const [coins, setCoins] = useState<number | null>(null)
  const [betWanted, setBet] = useSavedBet('slots')
  const perks = useGameCornerPerks()
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
  const stripRefs = useRef<(HTMLDivElement | null)[]>([])
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

  // A new title (e.g. Golden Touch) changes the payouts - reload them, keeping this visit's Pokemon.
  useEffect(() => {
    const reload = (): void => {
      window.api
        .getSlotRules()
        .then((loaded) =>
          setRules((old) => ({ ...old, payouts: loaded.payouts, cherryOne: loaded.cherryOne, cherryTwo: loaded.cherryTwo }))
        )
        .catch(() => {})
    }
    window.addEventListener(TITLE_CHANGED_EVENT, reload)
    return () => window.removeEventListener(TITLE_CHANGED_EVENT, reload)
  }, [])

  // The Game Corner window shows the coins, and locks its tabs while the reels turn.
  useEffect(() => {
    onCoinsChange(coins)
  }, [coins])
  useEffect(() => {
    onBusyChange(spinning)
  }, [spinning])

  const bet = placedBet(betWanted, coins, perks.betCap)

  async function spin(): Promise<void> {
    if (spinning || coins === null || coins < bet) return
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

  // The sound of a spin: a click each time a new symbol reaches the middle row of any
  // reel (following the strips as they really move, so it slows down with them), and a
  // clunk as each reel lands.
  useEffect(() => {
    if (!spinning || !animating) return
    let audio: AudioContext | null = null
    try {
      audio = new AudioContext()
    } catch {
      return
    }
    const sound = audio
    const lastCell: (number | null)[] = rules.reels.map(() => null)
    let lastTickAt = 0
    let raf = 0
    const follow = (): void => {
      stripRefs.current.forEach((strip, r) => {
        if (!strip) return
        const y = new DOMMatrixReadOnly(getComputedStyle(strip).transform).m42
        const cell = Math.round(-y / CELL)
        if (lastCell[r] !== null && cell !== lastCell[r]) {
          // Three reels at full speed would be a buzz - at most one click every 30ms.
          const now = performance.now()
          if (now - lastTickAt > 30) {
            lastTickAt = now
            playTick(sound, 1300 + r * 150, 0.03)
          }
        }
        lastCell[r] = cell
      })
      raf = requestAnimationFrame(follow)
    }
    raf = requestAnimationFrame(follow)
    const landings = REEL_SPIN_MS.map((ms) => setTimeout(() => playClunk(sound), ms))
    return () => {
      cancelAnimationFrame(raf)
      landings.forEach(clearTimeout)
      // Let the last clunk ring out before closing the sound.
      setTimeout(() => void sound.close(), 300)
    }
  }, [spinning, animating, rules])

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

  if (coins === null && !error) return <GameCornerLoading />

  return (
    <div className="game-corner-game slots-game">
      <div className="slots-machine">
        <div className="slots-window" style={{ height: CELL * 3 }}>
          {rules.reels.map((strip, r) => (
            <div key={r} className="slots-reel" style={{ height: CELL * 3 }}>
              <div
                ref={(el) => {
                  stripRefs.current[r] = el
                }}
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
          {/* The five lines every spin plays, faint - and the winners lit once the reels stop. */}
          <svg className="slots-lines" viewBox={`0 0 300 ${CELL * 3}`} preserveAspectRatio="none">
            {SLOT_LINES.map(({ rows }, line) => (
              <polyline
                key={line}
                points={rows.map((row, reel) => `${50 + reel * 100},${CELL / 2 + row * CELL}`).join(' ')}
                className={`slots-line${winningLines.has(line) ? ' slots-line-win' : ''}`}
              />
            ))}
          </svg>
        </div>
      </div>

      <div className="slots-controls">
        <BetSlider bet={bet} max={maxBet(coins, perks.betCap)}
          step={betStep(perks.betCap)} disabled={spinning || !coins} onChange={setBet}
          info={
            <>
              Every spin plays five lines - the three rows and both diagonals. Each winning line pays the amount below times your bet (single and double cherries count on the rows only).
            </>
          }
        />
        <button
          ref={spinButtonRef}
          className="slots-spin"
          disabled={spinning || coins === null || coins < bet}
          onClick={() => void spin()}
        >
          {spinning ? 'Spinning…' : 'Spin'}
        </button>
      </div>
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
      {notes.layer}
    </div>
  )
}

export default SlotMachine
