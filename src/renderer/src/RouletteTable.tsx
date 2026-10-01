import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { RouletteBetKey, RouletteSpin } from '../../shared/roulette'
import {
  BET_LABELS,
  EVEN_MONEY_BETS,
  ROULETTE_MAX_FULL_BETS,
  WHEEL_ORDER,
  betLabel,
  betOdds,
  pocketColor
} from '../../shared/roulette'
import BetSlider, { maxBet, placedBet, useGameCornerPerks, useSavedBet, betStep } from './BetSlider'
import GameCornerTabs, { type GameCornerGame } from './GameCornerTabs'
import CoinIcon from './CoinIcon'
import { errorMessage, useFloatingNotes } from './FloatingNotes'
import { playClunk, playTick } from './ticks'

interface Props {
  onClose: () => void
  onOpenCoinShop: () => void
  onSwitchGame: (game: GameCornerGame) => void
}

const SPIN_MS = 4200
const SEGMENT = 360 / WHEEL_ORDER.length
const OUTER = 124
const INNER = 88

// A point on the wheel: angle in degrees clockwise from the top.
function polar(radius: number, degrees: number): [number, number] {
  const rad = ((degrees - 90) * Math.PI) / 180
  return [radius * Math.cos(rad), radius * Math.sin(rad)]
}

// One pocket's wedge, centred on its angle.
function wedgePath(center: number): string {
  const [x1, y1] = polar(OUTER, center - SEGMENT / 2)
  const [x2, y2] = polar(OUTER, center + SEGMENT / 2)
  const [x3, y3] = polar(INNER, center + SEGMENT / 2)
  const [x4, y4] = polar(INNER, center - SEGMENT / 2)
  return `M${x1},${y1} A${OUTER},${OUTER} 0 0 1 ${x2},${y2} L${x3},${y3} A${INNER},${INNER} 0 0 0 ${x4},${y4} Z`
}

/** Where a bet sits on the board grid: [column, row, column span]. */
function boardPlace(key: RouletteBetKey): [number, number, number] {
  if (key === 'n:0') return [1, 1, 1]
  if (key.startsWith('n:')) {
    const n = Number(key.slice(2))
    return [Math.ceil(n / 3) + 1, 3 - ((n - 1) % 3), 1]
  }
  if (key.startsWith('column:')) return [14, 4 - Number(key.slice(7)), 1]
  if (key.startsWith('dozen:')) return [2 + (Number(key.slice(6)) - 1) * 4, 4, 4]
  const i = (EVEN_MONEY_BETS as readonly string[]).indexOf(key)
  return [2 + i * 2, 5, 2]
}

const BOARD_KEYS: RouletteBetKey[] = [
  'n:0',
  ...Array.from({ length: 36 }, (_, i) => `n:${i + 1}`),
  'column:3',
  'column:2',
  'column:1',
  'dozen:1',
  'dozen:2',
  'dozen:3',
  ...EVEN_MONEY_BETS
]

/**
 * Game Corner roulette: a European wheel and its betting board. Click the board to put a
 * chip (the bet slider's size) on a number or an outside bet, right-click to take a bet
 * back, then spin - the main process decides the pocket and pays every bet (see
 * roulette-store); the wheel just turns to where the ball already landed. The bets stay on
 * the board for the next spin.
 */
function RouletteTable({ onClose, onOpenCoinShop, onSwitchGame }: Props): React.JSX.Element {
  const [coins, setCoins] = useState<number | null>(null)
  const [history, setHistory] = useState<number[]>([])
  const [chipWanted, setChip] = useSavedBet('roulette')
  const perks = useGameCornerPerks()
  const [bets, setBets] = useState<Record<RouletteBetKey, number>>({})
  // Each chip placed, newest last - for Undo.
  const [placed, setPlaced] = useState<{ key: RouletteBetKey; amount: number }[]>([])
  const [spinning, setSpinning] = useState(false)
  const [rotation, setRotation] = useState(0)
  // The last spin, once the wheel has stopped on it.
  const [result, setResult] = useState<RouletteSpin | null>(null)
  const [error, setError] = useState<string | null>(null)
  const notes = useFloatingNotes()
  const boardRef = useRef<HTMLDivElement>(null)
  const timers = useRef<number[]>([])

  useEffect(() => {
    Promise.all([window.api.getCoins(), window.api.getRouletteHistory()])
      .then(([c, h]) => {
        setCoins(c)
        setHistory(h)
      })
      .catch((e) => setError(errorMessage(e)))
    const pending = timers.current
    return () => pending.forEach((t) => clearTimeout(t))
  }, [])

  const chip = placedBet(chipWanted, coins, perks.betCap)
  const total = Object.values(bets).reduce((sum, n) => sum + n, 0)

  function place(key: RouletteBetKey, e: React.MouseEvent): void {
    if (spinning) return
    const at = { x: e.clientX, y: e.clientY - 10 }
    // Up to the bet cap on each spot, and five times it on the whole board.
    if ((bets[key] ?? 0) + chip > perks.betCap) {
      notes.show(`Each spot takes at most ${perks.betCap.toLocaleString('en-US')} coins`, at, 'bad')
      return
    }
    const tableCap = perks.betCap * ROULETTE_MAX_FULL_BETS
    if (total + chip > tableCap) {
      notes.show(`The table takes at most ${tableCap.toLocaleString('en-US')} coins a spin`, at, 'bad')
      return
    }
    if (coins !== null && total + chip > coins) {
      notes.show("You don't have that many coins", at, 'bad')
      return
    }
    setResult(null)
    setBets((b) => ({ ...b, [key]: (b[key] ?? 0) + chip }))
    setPlaced((p) => [...p, { key, amount: chip }])
  }

  function takeBack(key: RouletteBetKey, e: React.MouseEvent): void {
    e.preventDefault()
    if (spinning || !bets[key]) return
    setResult(null)
    setBets((b) => {
      const next = { ...b }
      delete next[key]
      return next
    })
    setPlaced((p) => p.filter((chipPlaced) => chipPlaced.key !== key))
  }

  function undo(): void {
    const last = placed[placed.length - 1]
    if (!last || spinning) return
    setResult(null)
    setPlaced((p) => p.slice(0, -1))
    setBets((b) => {
      const next = { ...b, [last.key]: (b[last.key] ?? 0) - last.amount }
      if (next[last.key] <= 0) delete next[last.key]
      return next
    })
  }

  function clear(): void {
    if (spinning) return
    setResult(null)
    setBets({})
    setPlaced([])
  }

  // The ball's clicks slow down with the wheel, then a thud as it settles.
  function playSpinSounds(): void {
    let audio: AudioContext
    try {
      audio = new AudioContext()
    } catch {
      return
    }
    let t = 0
    let gap = 45
    while (t < SPIN_MS - 250) {
      const at = t
      timers.current.push(window.setTimeout(() => playTick(audio, 1500, 0.025), at))
      t += gap
      gap *= 1.07
    }
    timers.current.push(
      window.setTimeout(() => {
        playClunk(audio)
        window.setTimeout(() => void audio.close(), 400)
      }, SPIN_MS - 100)
    )
  }

  async function spin(): Promise<void> {
    if (spinning || total === 0) return
    setError(null)
    setResult(null)
    let outcome: RouletteSpin
    try {
      outcome = await window.api.spinRoulette(bets)
    } catch (e) {
      setError(errorMessage(e))
      return
    }
    // The bets have left the balance; the winnings show when the ball stops.
    setCoins(outcome.coins - outcome.totalReturned)
    setSpinning(true)
    // Round the wheel several times, stopping with the pocket under the marker at the top.
    const index = WHEEL_ORDER.indexOf(outcome.pocket)
    setRotation((prev) => {
      const target = (360 - index * SEGMENT) % 360
      const current = ((prev % 360) + 360) % 360
      return prev + 360 * 6 + ((target - current + 360) % 360)
    })
    playSpinSounds()
    timers.current.push(
      window.setTimeout(() => {
        setSpinning(false)
        setResult(outcome)
        setCoins(outcome.coins)
        setHistory(outcome.history)
        const net = outcome.totalReturned - outcome.totalBet
        const rect = boardRef.current?.getBoundingClientRect()
        const at = rect ? { x: rect.left + rect.width / 2, y: rect.top } : { x: window.innerWidth / 2, y: 200 }
        if (outcome.refunded) notes.show('Refunded by the Croupier!', at)
        else if (net > 0) notes.show(`+${net.toLocaleString('en-US')} coins`, at)
        else if (net < 0) notes.show(`${net.toLocaleString('en-US')} coins`, at, 'bad')
        else notes.show('Broke even', at)
      }, SPIN_MS)
    )
  }

  const winningKeys = result ? new Set(result.bets.filter((b) => b.returned > 0).map((b) => b.key)) : null

  return createPortal(
    <div className="modal-overlay" onMouseDown={() => !spinning && onClose()}>
      <div className="modal-panel roulette-modal" onMouseDown={(e) => e.stopPropagation()}>
        <GameCornerTabs current="roulette" disabled={spinning} onSwitch={onSwitchGame} />
        <div className="slots-header">
          <h2>Roulette</h2>
          <span className="slots-coins">
            <CoinIcon /> {coins === null ? '…' : coins.toLocaleString('en-US')} coins
          </span>
        </div>

        <div className="roulette-top">
          <div className="roulette-wheel-wrap">
            <svg className="roulette-wheel" viewBox="-130 -130 260 260">
              <g
                style={{
                  transform: `rotate(${rotation}deg)`,
                  transition: spinning ? `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.8, 0.2, 1)` : 'none'
                }}
              >
                <circle r={OUTER + 5} className="roulette-rim" />
                {WHEEL_ORDER.map((n, i) => {
                  const [tx, ty] = polar((OUTER + INNER) / 2, i * SEGMENT)
                  return (
                    <g key={n}>
                      <path d={wedgePath(i * SEGMENT)} className={`roulette-pocket roulette-pocket-${pocketColor(n)}`} />
                      <text
                        x={tx}
                        y={ty}
                        className="roulette-pocket-number"
                        transform={`rotate(${i * SEGMENT} ${tx} ${ty})`}
                      >
                        {n}
                      </text>
                    </g>
                  )
                })}
                {/* A Poke Ball in the middle of the wheel. */}
                <circle r={INNER - 4} className="roulette-hub" />
                <path d={`M${-(INNER - 20)},0 A${INNER - 20},${INNER - 20} 0 0 1 ${INNER - 20},0 Z`} className="roulette-ball-top" />
                <path d={`M${-(INNER - 20)},0 A${INNER - 20},${INNER - 20} 0 0 0 ${INNER - 20},0 Z`} className="roulette-ball-bottom" />
                <line x1={-(INNER - 20)} y1={0} x2={INNER - 20} y2={0} className="roulette-ball-band" />
                <circle r={13} className="roulette-ball-button" />
              </g>
              {/* The marker, and the ball resting under it once the wheel stops. */}
              <path d={`M-8,${-OUTER - 6} L8,${-OUTER - 6} L0,${-OUTER + 8} Z`} className="roulette-marker" />
              {!spinning && result && <circle cx={0} cy={-(INNER + 7)} r={6} className="roulette-ball" />}
            </svg>
          </div>
          <div className="roulette-side">
            <div className={`roulette-result${result ? ` roulette-result-${pocketColor(result.pocket)}` : ''}`}>
              {spinning ? 'Spinning…' : result ? `${result.pocket} ${pocketColor(result.pocket)}` : 'Place your bets'}
            </div>
            {result && !spinning && (
              <div className="roulette-result-detail">
                {result.refunded
                  ? `No winning bets - but the Croupier gave all ${result.totalBet.toLocaleString('en-US')} back`
                  : result.totalReturned > 0
                  ? `${result.bets
                      .filter((b) => b.returned > 0)
                      .map((b) => betLabel(b.key))
                      .join(', ')} paid ${result.totalReturned.toLocaleString('en-US')} · ${
                      result.totalReturned >= result.totalBet ? '+' : ''
                    }${(result.totalReturned - result.totalBet).toLocaleString('en-US')} overall`
                  : 'No winning bets'}
              </div>
            )}
            <div className="roulette-history" title="The last spins, newest first">
              {history.map((n, i) => (
                <span key={i} className={`roulette-history-pocket roulette-pocket-bg-${pocketColor(n)}`}>
                  {n}
                </span>
              ))}
            </div>
            <div className="roulette-total">
              On the board: <CoinIcon /> {total.toLocaleString('en-US')}
            </div>
          </div>
        </div>

        <div className="roulette-board" ref={boardRef}>
          {BOARD_KEYS.map((key) => {
            const [column, row, span] = boardPlace(key)
            const n = key.startsWith('n:') ? Number(key.slice(2)) : null
            const color = n !== null ? pocketColor(n) : key === 'red' ? 'red' : key === 'black' ? 'black' : null
            const won = winningKeys?.has(key)
            const landed = result && n === result.pocket && !spinning
            return (
              <button
                key={key}
                type="button"
                className={`roulette-cell${color ? ` roulette-cell-${color}` : ''}${won ? ' roulette-cell-won' : ''}${landed ? ' roulette-cell-landed' : ''}`}
                style={{ gridColumn: `${column} / span ${span}`, gridRow: key === 'n:0' ? '1 / span 3' : row }}
                title={`${betLabel(key)} - pays ${betOdds(key)} to 1`}
                disabled={spinning}
                onClick={(e) => place(key, e)}
                onContextMenu={(e) => takeBack(key, e)}
              >
                {n !== null ? n : BET_LABELS[key]}
                {bets[key] && <span className="roulette-chip">{bets[key].toLocaleString('en-US')}</span>}
              </button>
            )
          })}
        </div>

        <div className="slots-controls">
          <BetSlider bet={chip} max={maxBet(coins, perks.betCap)}
            step={betStep(perks.betCap)} disabled={spinning || !coins} onChange={setChip} />
        </div>
        <div className="slots-controls roulette-actions">
          <button disabled={spinning || placed.length === 0} onClick={undo}>
            Undo
          </button>
          <button disabled={spinning || total === 0} onClick={clear}>
            Clear
          </button>
          <button
            className="slots-spin"
            disabled={spinning || total === 0 || coins === null || coins < total}
            onClick={() => void spin()}
          >
            Spin
          </button>
        </div>
        <p className="editor-hint slots-hint">
          Click the board to place a chip (the bet above), right-click to take a bet back. A number pays 35 to 1, a
          dozen or column 2 to 1, the rest 1 to 1 - and the zero beats every outside bet. Each spot takes up to{' '}
          {perks.betCap.toLocaleString('en-US')} coins, the whole board up to{' '}
          {(perks.betCap * ROULETTE_MAX_FULL_BETS).toLocaleString('en-US')}.
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

        <div className="editor-actions">
          <button className="coin-shop-button" onClick={onOpenCoinShop} disabled={spinning}>
            <CoinIcon /> Coin Shop
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

export default RouletteTable
