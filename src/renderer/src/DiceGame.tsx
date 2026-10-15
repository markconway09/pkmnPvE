import { useEffect, useRef, useState } from 'react'
import { GameCornerLoading } from './GameCornerTabs'
import type { DiceRoll } from '../../shared/dice'
import {
  DICE_LONG_SHOT_CHANCE,
  DICE_MAX_TARGET,
  DICE_MIN_TARGET,
  DICE_RETURN,
  clampDiceTarget,
  diceMultiplier,
  diceWinChance
} from '../../shared/dice'
import BetSlider, { maxBet, placedBet, useGameCornerPerks, useSavedBet, betStep } from './BetSlider'
import GameCornerTitles from './GameCornerTitles'
import type { GameCornerGameProps } from './GameCornerTabs'
import { errorMessage, useFloatingNotes } from './FloatingNotes'
import CoinIcon from './CoinIcon'
import { numberLocale, t } from './i18n'

// How long the arrow takes to travel from 0 to the roll: a moment, plus longer the further
// it goes. It slows to a crawl near the end, for the suspense.
function sweepMs(roll: number): number {
  return 1000 + roll * 18
}
// How many past rolls show above the line.
const HISTORY_LENGTH = 10
// One-click multipliers.
const PRESETS = [2, 3, 5, 10, 20, 49.5]

function loadSaved<T>(key: string, parse: (raw: string) => T | null, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : (parse(raw) ?? fallback)
  } catch {
    return fallback
  }
}

function save(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // localStorage unavailable - the choice just isn't remembered
  }
}

// How bold a bet is, by its chance to win.
function riskOf(chance: number): { label: string; tone: string } {
  if (chance <= DICE_LONG_SHOT_CHANCE) return { label: t('dice.longShot'), tone: 'longshot' }
  if (chance < 20) return { label: t('dice.bold'), tone: 'bold' }
  if (chance < 45) return { label: t('dice.risky'), tone: 'risky' }
  if (chance < 80) return { label: t('dice.coinFlip'), tone: 'even' }
  return { label: t('dice.safe'), tone: 'safe' }
}

// This visit's rolls, for the strip across the top.
interface Session {
  rolls: number
  wins: number
  net: number
  // The biggest multiplier won on.
  best: number
  // Wins in a row (positive) or losses in a row (negative).
  streak: number
}

const NEW_SESSION: Session = { rolls: 0, wins: 0, net: 0, best: 0, streak: 0 }

/** A number box that's typed into freely and only takes the value on Enter or leaving it. */
function NumberField({
  value,
  decimals,
  disabled,
  onCommit
}: {
  value: number
  decimals: number
  disabled: boolean
  onCommit: (value: number) => void
}): React.JSX.Element {
  const [typed, setTyped] = useState(value.toFixed(decimals))
  useEffect(() => setTyped(value.toFixed(decimals)), [value, decimals])
  return (
    <input
      className="dice-stat-input"
      type="text"
      inputMode="decimal"
      value={typed}
      disabled={disabled}
      onChange={(e) => setTyped(e.target.value.replace(/[^0-9.]/g, ''))}
      onBlur={() => {
        const n = Number(typed)
        if (typed && Number.isFinite(n) && n > 0) onCommit(n)
        // Back to the value as it stands (a new one, once committed, replaces it).
        setTyped(value.toFixed(decimals))
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
    />
  )
}

/**
 * Game Corner Dice: a line from 0 to 100 with a divider to drag along it, Roll Over /
 * Roll Under, and an arrow that travels to where the roll lands. The multiplier and the
 * chance can be typed too, or picked from the presets. The roll is made and paid by the
 * main process (see dice-store) - this only shows it.
 */
function DiceGame({ onOpenCoinShop, onBusyChange, onCoinsChange }: GameCornerGameProps): React.JSX.Element {
  const [coins, setCoins] = useState<number | null>(null)
  const [betWanted, setBet] = useSavedBet('dice')
  const perks = useGameCornerPerks()
  const [target, setTarget] = useState(() => loadSaved('pkmnpve.diceTarget', (raw) => clampDiceTarget(Number(raw)), 50))
  const [over, setOver] = useState(() => loadSaved('pkmnpve.diceOver', (raw) => raw === 'true', true))
  const [last, setLast] = useState<DiceRoll | null>(null)
  // Where the arrow is on the line right now (null before the first roll).
  const [arrow, setArrow] = useState<number | null>(null)
  const frameRef = useRef(0)
  useEffect(() => () => cancelAnimationFrame(frameRef.current), [])
  const [history, setHistory] = useState<DiceRoll[]>([])
  const [session, setSession] = useState<Session>(NEW_SESSION)
  const [rolling, setRolling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const controlsRef = useRef<HTMLDivElement>(null)
  const notes = useFloatingNotes()

  useEffect(() => {
    window.api
      .getCoins()
      .then(setCoins)
      .catch((e) => setError(errorMessage(e)))
  }, [])

  // The Game Corner window shows the coins, and locks its tabs while the arrow travels.
  useEffect(() => {
    onCoinsChange(coins)
  }, [coins])
  useEffect(() => {
    onBusyChange(rolling)
  }, [rolling])

  const bet = placedBet(betWanted, coins, perks.betCap)
  const chance = diceWinChance(target, over)
  const multiplier = diceMultiplier(target, over)
  const pays = Math.floor(bet * multiplier)
  const risk = riskOf(chance)

  function moveTarget(next: number): void {
    const clamped = clampDiceTarget(next)
    setTarget(clamped)
    save('pkmnpve.diceTarget', String(clamped))
  }

  // A chance to win, as the divider that gives it on the side picked.
  function setChance(next: number): void {
    const allowed = Math.min(DICE_MAX_TARGET, Math.max(DICE_MIN_TARGET, next))
    moveTarget(over ? 100 - allowed : allowed)
  }

  // A multiplier, as the chance that pays it (the nearest the divider can give).
  function setMultiplier(next: number): void {
    setChance((DICE_RETURN * 100) / next)
  }

  // Flipping sides keeps the same chance to win: the divider mirrors across the line.
  function flip(): void {
    setOver(!over)
    save('pkmnpve.diceOver', String(!over))
    moveTarget(100 - target)
  }

  // Moves the arrow from 0 to the roll, fast at first and crawling at the end.
  function sweep(to: number): Promise<void> {
    const duration = sweepMs(to)
    return new Promise((resolve) => {
      const start = performance.now()
      const step = (now: number): void => {
        const t = Math.min(1, (now - start) / duration)
        setArrow(to * (1 - Math.pow(1 - t, 4)))
        if (t < 1) frameRef.current = requestAnimationFrame(step)
        else resolve()
      }
      frameRef.current = requestAnimationFrame(step)
    })
  }

  async function roll(): Promise<void> {
    setRolling(true)
    setError(null)
    try {
      const result = await window.api.rollDice(bet, target, over)
      setLast(result)
      await sweep(result.roll)
      setCoins(result.coins)
      setHistory((h) => [result, ...h].slice(0, HISTORY_LENGTH))
      const won = result.payout - result.bet
      setSession((s) => ({
        rolls: s.rolls + 1,
        wins: s.wins + (result.won ? 1 : 0),
        net: s.net + won,
        best: result.won ? Math.max(s.best, result.multiplier) : s.best,
        streak: result.won ? Math.max(0, s.streak) + 1 : Math.min(0, s.streak) - 1
      }))
      if (controlsRef.current) {
        const rect = controlsRef.current.getBoundingClientRect()
        const at = { x: rect.left + rect.width / 2, y: rect.top }
        if (result.refunded) notes.show(t('dice.refunded'), at)
        else if (result.doubled) notes.show(t('dice.doubled', { n: won }), at)
        else if (won > 0) notes.show(t('corner.plusCoins', { n: won }), at)
        else if (won < 0) notes.show(t('corner.netCoins', { n: won }), at, 'bad')
      }
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setRolling(false)
    }
  }

  if (coins === null && !error) return <GameCornerLoading />

  // The arrow stays on the last roll. On the way it leans green or red by the side it's on;
  // once it lands it turns solid.
  const landed = last && !rolling
  const arrowWinning = arrow !== null && (over ? arrow > target : arrow < target)

  // What the last roll did, in words, under the line.
  const lastLine =
    landed && last
      ? `${t(last.won ? 'dice.rolledWin' : 'dice.rolledLoss', {
          roll: last.roll.toFixed(2),
          side: last.over ? t('dice.over') : t('dice.under'),
          target: last.target.toFixed(2)
        })}${last.refunded ? t('dice.refundedNote') : last.doubled ? t('dice.doubledNote') : ''}`
      : rolling
        ? t('dice.rolling')
        : t('dice.start')

  return (
    <div className="game-corner-game dice-game">
      <div className="dice-session" title={t('dice.sessionTip')}>
        <div className="dice-session-cell">
          <span>{t('dice.rolls')}</span>
          <strong>{session.rolls}</strong>
        </div>
        <div className="dice-session-cell">
          <span>{t('dice.won')}</span>
          <strong>
            {session.wins}
            {session.rolls > 0 && <small> ({Math.round((session.wins / session.rolls) * 100)}%)</small>}
          </strong>
        </div>
        <div className="dice-session-cell">
          <span>{t('dice.net')}</span>
          <strong className={session.net > 0 ? 'dice-good' : session.net < 0 ? 'dice-bad' : ''}>
            {session.net > 0 ? '+' : ''}
            {session.net.toLocaleString(numberLocale())}
          </strong>
        </div>
        <div className="dice-session-cell">
          <span>{t('dice.best')}</span>
          <strong>{session.best > 0 ? `×${session.best.toFixed(2)}` : '-'}</strong>
        </div>
        <div className="dice-session-cell">
          <span>{t('dice.streak')}</span>
          <strong className={session.streak > 0 ? 'dice-good' : session.streak < 0 ? 'dice-bad' : ''}>
            {session.streak === 0
              ? '-'
              : session.streak > 0
                ? t('dice.streakWon', { n: session.streak })
                : t('dice.streakLost', { n: -session.streak })}
          </strong>
        </div>
      </div>

      <div className="dice-board">
        <div className="dice-history">
          {history.map((h, i) => (
            <span
              key={history.length - i}
              className={`dice-history-chip${h.won ? ' dice-history-won' : ''}`}
              title={t(h.over ? 'dice.historyOver' : 'dice.historyUnder', {
                target: h.target.toFixed(2),
                mult: h.multiplier.toFixed(2)
              })}
            >
              {h.roll.toFixed(2)}
            </span>
          ))}
        </div>

        <div className="dice-track-wrap">
          {last && arrow !== null && (
            <div
              className={`dice-marker${
                landed
                  ? last.won
                    ? ' dice-marker-won'
                    : ' dice-marker-lost'
                  : arrowWinning
                    ? ' dice-marker-leaning-won'
                    : ' dice-marker-leaning-lost'
              }`}
              style={{ left: `${arrow}%` }}
            >
              {(landed ? last.roll : arrow).toFixed(2)}
            </div>
          )}
          <div
            className="dice-track"
            style={{
              background: over
                ? `linear-gradient(to right, var(--dice-lose) ${target}%, var(--dice-win) ${target}%)`
                : `linear-gradient(to right, var(--dice-win) ${target}%, var(--dice-lose) ${target}%)`
            }}
          />
          <input
            type="range"
            className="dice-divider"
            min={0}
            max={100}
            step={0.5}
            value={target}
            disabled={rolling}
            aria-label={t('dice.divider')}
            // The line runs 0-100 but the divider stops short of the ends (see clampDiceTarget).
            onChange={(e) => moveTarget(Number(e.target.value))}
          />
          <div className="dice-scale">
            {Array.from({ length: 21 }, (_, i) => i * 5).map((n) => (
              <span key={n} className={n % 25 === 0 ? 'dice-scale-major' : 'dice-scale-minor'} style={{ left: `${n}%` }}>
                {n % 25 === 0 ? n : ''}
              </span>
            ))}
          </div>
        </div>

        <div className="dice-last">{lastLine}</div>

        <div className="dice-presets">
          <span className="dice-presets-label">{t('dice.quickPick')}</span>
          {PRESETS.map((m) => (
            <button
              key={m}
              className={`dice-preset${Math.abs(multiplier - m) < m * 0.02 ? ' dice-preset-active' : ''}`}
              disabled={rolling}
              onClick={() => setMultiplier(m)}
            >
              ×{m}
            </button>
          ))}
          <span
            className={`dice-risk dice-risk-${risk.tone}`}
            title={chance <= DICE_LONG_SHOT_CHANCE ? t('dice.longShotTip') : undefined}
          >
            {risk.label}
          </span>
        </div>

        <div className="dice-stats">
          <label className="dice-stat">
            <span className="dice-stat-label">{t('dice.multiplier')}</span>
            <span className="dice-stat-value">
              ×<NumberField value={multiplier} decimals={4} disabled={rolling} onCommit={setMultiplier} />
            </span>
            <span className="dice-stat-sub">{t('dice.multSub', { chance: chance.toFixed(1) })}</span>
          </label>
          <label className="dice-stat">
            <span className="dice-stat-label">{t('dice.winChance')}</span>
            <span className="dice-stat-value">
              <NumberField value={chance} decimals={2} disabled={rolling} onCommit={setChance} />%
            </span>
            <span className="dice-chance-bar">
              <span style={{ width: `${chance}%` }} />
            </span>
            <span className="dice-stat-sub">{t('dice.oneIn', { n: (100 / chance).toFixed(chance >= 50 ? 2 : 1) })}</span>
          </label>
          <button className="dice-stat dice-flip" disabled={rolling} onClick={flip} title={t('dice.flipTip')}>
            <span className="dice-stat-label">{over ? t('dice.rollOver') : t('dice.rollUnder')}</span>
            <span className="dice-stat-value">{target.toFixed(2)}</span>
            <span className="dice-stat-sub">
              {t('dice.winsOn', { range: over ? `${target.toFixed(2)} - 100` : `0 - ${target.toFixed(2)}` })}
            </span>
          </button>
          <div className="dice-stat">
            <span className="dice-stat-label">{t('dice.profit')}</span>
            <span className="dice-stat-value dice-good">
              +<CoinIcon /> {(pays - bet).toLocaleString(numberLocale())}
            </span>
            <span className="dice-stat-sub">{t('dice.pays', { pays, bet })}</span>
          </div>
        </div>
      </div>

      <div className="slots-controls" ref={controlsRef}>
        <BetSlider
          bet={bet}
          max={maxBet(coins, perks.betCap)}
          step={betStep(perks.betCap)}
          disabled={rolling || !coins}
          onChange={setBet}
          info={<>{t('dice.info')}</>}
        />
        <button className="slots-spin" disabled={rolling || coins === null || coins < bet} onClick={() => void roll()}>
          {t('dice.roll')}
        </button>
      </div>
      {error && <p className="editor-error">{error}</p>}
      {coins !== null && coins < 1 && !rolling && (
        <p className="editor-hint">
          {t('corner.outOfCoins')}{' '}
          <button className="link-button" onClick={onOpenCoinShop}>
            {t('corner.buyCoins')}
          </button>
        </p>
      )}
      <GameCornerTitles game="dice" perks={perks} />
      {notes.layer}
    </div>
  )
}

export default DiceGame
