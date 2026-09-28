import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { BlackjackOutcome, BlackjackView } from '../../shared/blackjack'
import BetSlider, { placedBet } from './BetSlider'
import GameCornerTabs from './GameCornerTabs'
import PlayingCard from './PlayingCard'
import { errorMessage, useFloatingNotes } from './FloatingNotes'

interface Props {
  onClose: () => void
  onOpenCoinShop: () => void
  onSwitchGame: () => void
}

const OUTCOME_TEXT: Record<BlackjackOutcome, string> = {
  blackjack: 'Blackjack! Paid 3:2',
  win: 'You win!',
  push: 'Push - your bet is returned',
  lose: 'The dealer wins',
  bust: 'Bust!',
  dealerBlackjack: 'The dealer has blackjack'
}

// "17", or "7 / 17" while an ace still counts as 11.
function totalLabel(total: { total: number; soft: boolean } | null): string {
  if (!total) return ''
  return total.soft && total.total < 21 ? `${total.total - 10} / ${total.total}` : String(total.total)
}

/**
 * Game Corner blackjack: the dealer and the player's hands on a felt table, a bet slider,
 * and Hit / Stand / Double down. Every card is dealt and every hand settled by the main
 * process (see blackjack-store) - this only shows them.
 */
function BlackjackTable({ onClose, onOpenCoinShop, onSwitchGame }: Props): React.JSX.Element {
  const [table, setTable] = useState<BlackjackView | null>(null)
  const [betWanted, setBet] = useState(10)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const actionsRef = useRef<HTMLDivElement>(null)
  const notes = useFloatingNotes()

  useEffect(() => {
    window.api
      .getBlackjack()
      .then(setTable)
      .catch((e) => setError(errorMessage(e)))
  }, [])

  const coins = table?.coins ?? null
  const bet = placedBet(betWanted, coins)
  const playing = table?.phase === 'playing'

  async function act(action: () => Promise<BlackjackView>): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      const next = await action()
      setTable(next)
      if (next.phase === 'done' && next.outcome && actionsRef.current) {
        const rect = actionsRef.current.getBoundingClientRect()
        const at = { x: rect.left + rect.width / 2, y: rect.top }
        const won = next.returned - next.bet
        if (won > 0) notes.show(`+${won.toLocaleString('en-US')} coins`, at)
        else if (next.outcome !== 'push') notes.show(`-${next.bet.toLocaleString('en-US')} coins`, at, 'bad')
      }
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const outcomeTone = table?.outcome
    ? table.outcome === 'blackjack' || table.outcome === 'win'
      ? 'good'
      : table.outcome === 'push'
        ? 'even'
        : 'bad'
    : null

  return createPortal(
    <div className="modal-overlay" onMouseDown={() => !playing && onClose()}>
      <div className="modal-panel blackjack-modal" onMouseDown={(e) => e.stopPropagation()}>
        <GameCornerTabs current="blackjack" disabled={playing} onSwitch={onSwitchGame} />
        <div className="slots-header">
          <h2>Blackjack</h2>
          <span className="slots-coins">🪙 {coins === null ? '…' : coins.toLocaleString('en-US')} coins</span>
        </div>

        <div className="blackjack-felt">
          <div className="blackjack-hand">
            <div className="blackjack-hand-label">
              Dealer {table && table.dealer.length > 0 && <span>{totalLabel(table.dealerTotal)}</span>}
            </div>
            <div className="blackjack-cards">
              {table?.dealer.map((card, i) => (
                <PlayingCard key={`d${i}-${card ? card.rank + card.suit : 'back'}`} card={card} index={i} />
              ))}
            </div>
          </div>

          <div className={`blackjack-result${outcomeTone ? ` blackjack-result-${outcomeTone}` : ''}`}>
            {table?.phase === 'done' && table.outcome
              ? OUTCOME_TEXT[table.outcome]
              : playing
                ? `Bet 🪙 ${table!.bet.toLocaleString('en-US')}${table!.doubled ? ' (doubled)' : ''}`
                : 'Place a bet and deal'}
          </div>

          <div className="blackjack-hand">
            <div className="blackjack-cards">
              {table?.player.map((card, i) => (
                <PlayingCard key={`p${i}-${card.rank}${card.suit}`} card={card} index={i} />
              ))}
            </div>
            <div className="blackjack-hand-label">
              You {table && table.player.length > 0 && <span>{totalLabel(table.playerTotal)}</span>}
            </div>
          </div>
        </div>

        <div className="slots-controls blackjack-actions" ref={actionsRef}>
          {playing ? (
            <>
              <button className="blackjack-action" disabled={busy} onClick={() => void act(() => window.api.hitBlackjack())}>
                Hit
              </button>
              <button
                className="blackjack-action"
                disabled={busy}
                onClick={() => void act(() => window.api.standBlackjack())}
              >
                Stand
              </button>
              <button
                className="blackjack-action"
                disabled={busy || !table?.canDouble}
                title={table?.canDouble ? 'Double your bet, take one more card and stand' : 'Only on your first two cards, with enough coins'}
                onClick={() => void act(() => window.api.doubleBlackjack())}
              >
                Double down
              </button>
            </>
          ) : (
            <>
              <BetSlider bet={bet} max={Math.max(1, coins ?? 1)} disabled={busy || !coins} onChange={setBet} />
              <button
                className="slots-spin"
                disabled={busy || coins === null || coins < bet}
                onClick={() => void act(() => window.api.dealBlackjack(bet))}
              >
                Deal
              </button>
            </>
          )}
        </div>
        <p className="editor-hint slots-hint">
          The dealer draws to 16 and stands on 17. Blackjack pays 3:2, a win 1:1, a tie returns your bet.
        </p>
        {error && <p className="editor-error">{error}</p>}
        {coins !== null && coins < 1 && !playing && (
          <p className="editor-hint">
            You&apos;re out of coins.{' '}
            <button className="link-button" onClick={onOpenCoinShop}>
              Buy some at the Coin Shop
            </button>
          </p>
        )}

        <div className="editor-actions">
          <button onClick={onOpenCoinShop} disabled={playing}>
            Coin Shop
          </button>
          <button onClick={onClose} disabled={playing}>
            Close
          </button>
        </div>
        {notes.layer}
      </div>
    </div>,
    document.body
  )
}

export default BlackjackTable
