import { useEffect, useRef, useState } from 'react'
import { GameCornerLoading } from './GameCornerTabs'
import type { PlinkoDrop, PlinkoRisk } from '../../shared/plinko'
import { PLINKO_PAYOUTS, PLINKO_RISKS, PLINKO_RISK_LABELS, PLINKO_ROWS, PLINKO_SLOTS, plinkoSlotMultiplier } from '../../shared/plinko'
import BetSlider, { maxBet, placedBet, useGameCornerPerks, useSavedBet, betStep } from './BetSlider'
import GameCornerTitles from './GameCornerTitles'
import type { GameCornerGameProps } from './GameCornerTabs'
import { errorMessage, useFloatingNotes } from './FloatingNotes'
import { playCornerClunk, playCornerTick } from './ticks'

// The board's geometry, in SVG units: the gap between pegs, and between rows.
const GAP = 34
const ROW_HEIGHT = 30
const TOP = 26
const PEG_RADIUS = 4
const BALL_RADIUS = 8
const WIDTH = GAP * (PLINKO_SLOTS + 1)
const CENTER = WIDTH / 2
const SLOT_TOP = TOP + PLINKO_ROWS * ROW_HEIGHT + 6
const HEIGHT = SLOT_TOP + 30
// How long the ball takes over each row.
const ROW_MS = 95
// Drop ×10: the gap between balls.
const MULTI_GAP_MS = 220
const MULTI_COUNT = 10
// Holding Drop down: how long before it starts dropping on its own (a quick tap drops
// just the one), then a ball every MULTI_GAP_MS until it's let go.
const HOLD_DELAY_MS = 350

// Where a ball is after `rights` of its first `row` bounces went right.
function ballX(row: number, rights: number): number {
  return CENTER + (rights - row / 2) * GAP
}

interface Ball {
  id: number
  drop: PlinkoDrop
  started: number
}

// A slot's colour: the bigger the multiplier, the hotter.
function slotTone(multiplier: number): string {
  if (multiplier >= 10) return 'plinko-slot-hot'
  if (multiplier >= 2) return 'plinko-slot-warm'
  if (multiplier >= 1) return 'plinko-slot-even'
  return 'plinko-slot-cold'
}

/**
 * Game Corner Plinko: pick a bet and a risk level and drop a Poke Ball through the pegs -
 * where it lands decides what it pays. Every bounce is decided by the main process when
 * the ball is dropped (see plinko-store); the ball here just follows that path down.
 */
function PlinkoBoard({ onOpenCoinShop, onBusyChange, onCoinsChange }: GameCornerGameProps): React.JSX.Element {
  const [coins, setCoins] = useState<number | null>(null)
  const [betWanted, setBet] = useSavedBet('plinko')
  const perks = useGameCornerPerks()
  const [risk, setRisk] = useState<PlinkoRisk>(() => {
    try {
      const saved = localStorage.getItem('pkmnpve.plinkoRisk') as PlinkoRisk | null
      return saved && PLINKO_RISKS.includes(saved) ? saved : 'medium'
    } catch {
      return 'medium'
    }
  })
  const [balls, setBalls] = useState<Ball[]>([])
  const [, setFrame] = useState(0)
  const [lit, setLit] = useState<{ slot: number; id: number } | null>(null)
  const [dropping, setDropping] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const notes = useFloatingNotes()
  const nextId = useRef(0)
  const audio = useRef<AudioContext | null>(null)
  const boardRef = useRef<SVGSVGElement>(null)
  // Which row each ball last ticked on, so each peg clicks once.
  const ticked = useRef(new Map<number, number>())
  // Whether Drop is held down, and a way to cut short the wait between held drops.
  const holding = useRef(false)
  const wakeHold = useRef<(() => void) | null>(null)

  useEffect(() => {
    window.api
      .getCoins()
      .then(setCoins)
      .catch((e) => setError(errorMessage(e)))
    return () => void audio.current?.close()
  }, [])

  // The Game Corner window shows the coins, and locks its tabs while balls are dropping.
  useEffect(() => {
    onCoinsChange(coins)
  }, [coins])
  useEffect(() => {
    onBusyChange(dropping)
  }, [dropping])

  function chooseRisk(next: PlinkoRisk): void {
    setRisk(next)
    try {
      localStorage.setItem('pkmnpve.plinkoRisk', next)
    } catch {
      // Not remembered - that's all.
    }
  }

  function sound(): AudioContext | null {
    if (!audio.current) {
      try {
        audio.current = new AudioContext()
      } catch {
        return null
      }
    }
    return audio.current
  }

  // Moves every ball in flight along its path, and lands the ones at the bottom.
  const inFlight = balls.length > 0
  useEffect(() => {
    if (!inFlight) return
    let raf = 0
    const step = (): void => {
      const now = performance.now()
      const landed: Ball[] = []
      for (const ball of balls) {
        const row = Math.floor((now - ball.started) / ROW_MS)
        if (row > (ticked.current.get(ball.id) ?? -1) && row < PLINKO_ROWS) {
          ticked.current.set(ball.id, row)
          const a = sound()
          if (a) playCornerTick(a, 900 + row * 60, 0.02)
        }
        if (now - ball.started >= (PLINKO_ROWS + 1) * ROW_MS) landed.push(ball)
      }
      if (landed.length > 0) {
        for (const ball of landed) {
          ticked.current.delete(ball.id)
          const a = sound()
          if (a) playCornerClunk(a)
          setLit({ slot: ball.drop.slot, id: ball.id })
          setCoins(ball.drop.coins)
          const net = ball.drop.payout - ball.drop.bet
          const rect = boardRef.current?.getBoundingClientRect()
          const at = rect
            ? { x: rect.left + (ballX(PLINKO_ROWS, ball.drop.slot) / WIDTH) * rect.width, y: rect.bottom - 40 }
            : { x: window.innerWidth / 2, y: 400 }
          if (net !== 0) notes.show(`${net > 0 ? '+' : ''}${net.toLocaleString('en-US')}`, at, net > 0 ? 'good' : 'bad')
        }
        setBalls((all) => all.filter((b) => !landed.includes(b)))
      }
      setFrame((f) => f + 1)
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [inFlight, balls])

  // A ball's position right now: across one row per ROW_MS, falling faster through each.
  function position(ball: Ball): [number, number] {
    const elapsed = (performance.now() - ball.started) / ROW_MS
    const row = Math.min(PLINKO_ROWS, Math.floor(elapsed))
    const t = Math.min(1, elapsed - row)
    const rightsBefore = ball.drop.path.slice(0, row).filter(Boolean).length
    const x0 = ballX(row, rightsBefore)
    const y0 = TOP + row * ROW_HEIGHT - PEG_RADIUS - BALL_RADIUS
    if (row >= PLINKO_ROWS) return [x0, Math.min(SLOT_TOP + 8, y0 + t * 24)]
    const x1 = ballX(row + 1, rightsBefore + (ball.drop.path[row] ? 1 : 0))
    const y1 = y0 + ROW_HEIGHT
    // A little hop off the peg, then down.
    const hop = Math.sin(t * Math.PI) * 6
    return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t * t - hop]
  }

  async function dropOne(bet: number): Promise<PlinkoDrop | null> {
    try {
      const drop = await window.api.dropPlinko(bet, risk)
      setBalls((all) => [...all, { id: nextId.current++, drop, started: performance.now() }])
      return drop
    } catch (e) {
      setError(errorMessage(e))
      return null
    }
  }

  // Drop pressed down: one ball straight away, then - still held after a moment - one
  // after another until it's let go (or the next bet can't be covered).
  async function holdDrop(): Promise<void> {
    if (dropping) return
    holding.current = true
    const release = (): void => {
      holding.current = false
      wakeHold.current?.()
    }
    window.addEventListener('pointerup', release)
    window.addEventListener('blur', release)
    setError(null)
    setDropping(true)
    try {
      let left = coins ?? 0
      for (let i = 0; ; i++) {
        const next = placedBet(betWanted, left, perks.betCap)
        if (next < 1 || left < next) break
        const dropped = await dropOne(next)
        if (!dropped) break
        left = dropped.coins
        if (!holding.current) break
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, i === 0 ? HOLD_DELAY_MS : MULTI_GAP_MS)
          wakeHold.current = () => {
            clearTimeout(timer)
            resolve()
          }
        })
        wakeHold.current = null
        if (!holding.current) break
      }
    } finally {
      holding.current = false
      wakeHold.current = null
      window.removeEventListener('pointerup', release)
      window.removeEventListener('blur', release)
      setDropping(false)
    }
  }

  async function drop(count: number): Promise<void> {
    if (dropping) return
    setError(null)
    setDropping(true)
    try {
      for (let i = 0; i < count; i++) {
        if (!(await dropOne(placedBet(betWanted, coins, perks.betCap)))) break
        if (i < count - 1) await new Promise((r) => setTimeout(r, MULTI_GAP_MS))
      }
    } finally {
      setDropping(false)
    }
  }

  const bet = placedBet(betWanted, coins, perks.betCap)
  // The edge slots (and the ones next to them) pay more with the Edge Lord title.
  const payouts = PLINKO_PAYOUTS[risk].map((_, slot) => plinkoSlotMultiplier(risk, slot, perks))

  if (coins === null && !error) return <GameCornerLoading />

  return (
    <div className="game-corner-game plinko-game">
      <div className="plinko-risk" title="Higher risk: bigger edge slots, smaller middle ones - the same payback over time">
        Risk
        {PLINKO_RISKS.map((r) => (
          <button
            key={r}
            className={`plinko-risk-option${risk === r ? ' plinko-risk-active' : ''}`}
            disabled={inFlight || dropping}
            onClick={() => chooseRisk(r)}
          >
            {PLINKO_RISK_LABELS[r]}
          </button>
        ))}
      </div>

      <svg ref={boardRef} className="plinko-board" viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        {Array.from({ length: PLINKO_ROWS }, (_, row) =>
          Array.from({ length: row + 3 }, (_, k) => (
            <circle
              key={`${row}-${k}`}
              cx={ballX(row, k - 1)}
              cy={TOP + row * ROW_HEIGHT}
              r={PEG_RADIUS}
              className="plinko-peg"
            />
          ))
        )}
        {payouts.map((multiplier, slot) => {
          const x = ballX(PLINKO_ROWS, slot)
          return (
            <g key={slot} className={lit?.slot === slot ? 'plinko-slot-lit' : undefined}>
              <rect
                key={lit?.slot === slot ? lit.id : 'slot'}
                x={x - GAP / 2 + 2}
                y={SLOT_TOP}
                width={GAP - 4}
                height={24}
                rx={5}
                className={`plinko-slot ${slotTone(multiplier)}`}
              />
              <text x={x} y={SLOT_TOP + 16} className="plinko-slot-text">
                ×{multiplier}
              </text>
            </g>
          )
        })}
        {balls.map((ball) => {
          const [x, y] = position(ball)
          return (
            <g key={ball.id} transform={`translate(${x} ${y})`}>
              {/* A Poke Ball. */}
              <circle r={BALL_RADIUS} className="plinko-ball-bottom" />
              <path d={`M${-BALL_RADIUS},0 A${BALL_RADIUS},${BALL_RADIUS} 0 0 1 ${BALL_RADIUS},0 Z`} className="plinko-ball-top" />
              <line x1={-BALL_RADIUS} y1={0} x2={BALL_RADIUS} y2={0} className="plinko-ball-band" />
              <circle r={2.6} className="plinko-ball-button" />
            </g>
          )
        })}
      </svg>

      <div className="slots-controls">
        <BetSlider bet={bet} max={maxBet(coins, perks.betCap)}
          step={betStep(perks.betCap)} disabled={dropping || !coins} onChange={setBet}
          info={
            <>
              The ball bounces left or right at every peg - most land near the middle, a few reach the edges. Each slot pays
              its multiplier times your bet.
            </>
          }
        />
        <button
          className="slots-spin"
          disabled={dropping || coins === null || coins < bet}
          title="Hold to keep dropping"
          onPointerDown={(e) => {
            if (e.button === 0) void holdDrop()
          }}
          // The keyboard (Enter / Space) still drops one.
          onClick={(e) => {
            if (e.detail === 0) void drop(1)
          }}
        >
          Drop
        </button>
        <button
          disabled={dropping || coins === null || coins < bet}
          title={`Drops ${MULTI_COUNT} balls one after another, each bet on its own`}
          onClick={() => void drop(MULTI_COUNT)}
        >
          ×{MULTI_COUNT}
        </button>
      </div>
      {error && <p className="editor-error">{error}</p>}
      {coins !== null && coins < 1 && !dropping && (
        <p className="editor-hint">
          You&apos;re out of coins.{' '}
          <button className="link-button" onClick={onOpenCoinShop}>
            Buy some at the Coin Shop
          </button>
        </p>
      )}
      <GameCornerTitles game="plinko" perks={perks} />
      {notes.layer}
    </div>
  )
}

export default PlinkoBoard
