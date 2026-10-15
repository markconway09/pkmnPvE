import { useEffect, useRef, useState } from 'react'
import { GameCornerLoading } from './GameCornerTabs'
import type { BlackjackOutcome, BlackjackView } from '../../shared/blackjack'
import BetSlider, { maxBet, placedBet, useGameCornerPerks, useSavedBet, betStep } from './BetSlider'
import GameCornerTitles from './GameCornerTitles'
import type { GameCornerGameProps } from './GameCornerTabs'
import PlayingCard from './PlayingCard'
import { errorMessage, useFloatingNotes } from './FloatingNotes'
import CoinIcon from './CoinIcon'
import { numberLocale, t } from './i18n'

// A payout to 1 as odds: 1.5 is "3:2", 4 is "4:1".
function oddsText(toOne: number): string {
  return Number.isInteger(toOne) ? `${toOne}:1` : `${toOne * 2}:2`
}

const OUTCOME_TEXT: Record<BlackjackOutcome, 'bj.blackjack' | 'bj.win' | 'bj.push' | 'bj.lose' | 'bj.bust' | 'bj.dealerBlackjack'> = {
  blackjack: 'bj.blackjack',
  win: 'bj.win',
  push: 'bj.push',
  lose: 'bj.lose',
  bust: 'bj.bust',
  dealerBlackjack: 'bj.dealerBlackjack'
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
function BlackjackTable({ onOpenCoinShop, onBusyChange, onCoinsChange }: GameCornerGameProps): React.JSX.Element {
  const [table, setTable] = useState<BlackjackView | null>(null)
  const [betWanted, setBet] = useSavedBet('blackjack')
  const perks = useGameCornerPerks()
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
  const bet = placedBet(betWanted, coins, perks.betCap)
  const playing = table?.phase === 'playing'

  // The Game Corner window shows the coins, and locks its tabs while a hand is out.
  useEffect(() => {
    onCoinsChange(coins)
  }, [coins])
  useEffect(() => {
    onBusyChange(playing)
  }, [playing])

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
        if (won > 0) notes.show(t('corner.plusCoins', { n: won }), at)
        else if (next.outcome !== 'push') notes.show(t('corner.minusCoins', { n: next.bet }), at, 'bad')
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

  if (table === null && !error) return <GameCornerLoading />

  return (
    <div className="game-corner-game blackjack-game">
      <div className="blackjack-felt">
        <div className="blackjack-hand">
          <div className="blackjack-hand-label">
            {t('bj.dealer')} {table && table.dealer.length > 0 && <span>{totalLabel(table.dealerTotal)}</span>}
          </div>
          <div className="blackjack-cards">
            {table?.dealer.map((card, i) => (
              <PlayingCard key={`d${i}-${card ? card.rank + card.suit : 'back'}`} card={card} index={i} />
            ))}
          </div>
        </div>

        <div className={`blackjack-result${outcomeTone ? ` blackjack-result-${outcomeTone}` : ''}`}>
          {table?.phase === 'done' && table.outcome
            ? table.outcome === 'blackjack'
              ? t('bj.paidBlackjack', { odds: oddsText(perks.blackjackPayout) })
              : table.outcome === 'win' && perks.blackjackWinPayout !== 1
                ? t('bj.paidWin', { odds: oddsText(perks.blackjackWinPayout) })
                : t(OUTCOME_TEXT[table.outcome])
            : playing
              ? (
                <>
                  {t('bj.bet')} <CoinIcon /> {table!.bet.toLocaleString(numberLocale())}
                  {table!.doubled ? t('bj.doubled') : ''}
                </>
              )
              : t('bj.placeBet')}
        </div>

        <div className="blackjack-hand">
          <div className="blackjack-cards">
            {table?.player.map((card, i) => (
              <PlayingCard key={`p${i}-${card.rank}${card.suit}`} card={card} index={i} />
            ))}
          </div>
          <div className="blackjack-hand-label">
            {t('bj.you')} {table && table.player.length > 0 && <span>{totalLabel(table.playerTotal)}</span>}
          </div>
        </div>
      </div>

      <div className="slots-controls blackjack-actions" ref={actionsRef}>
        {playing ? (
          <>
            <button className="blackjack-action" disabled={busy} onClick={() => void act(() => window.api.hitBlackjack())}>
              {t('bj.hit')}
            </button>
            <button
              className="blackjack-action"
              disabled={busy}
              onClick={() => void act(() => window.api.standBlackjack())}
            >
              {t('bj.stand')}
            </button>
            <button
              className="blackjack-action"
              disabled={busy || !table?.canDouble}
              title={table?.canDouble ? t('bj.doubleTip') : t('bj.cantDouble')}
              onClick={() => void act(() => window.api.doubleBlackjack())}
            >
              {t('bj.double')}
            </button>
          </>
        ) : (
          <>
            <BetSlider bet={bet} max={maxBet(coins, perks.betCap)}
          step={betStep(perks.betCap)} disabled={busy || !coins} onChange={setBet}
          info={
            <>
              {t('bj.info1')}{' '}
              {perks.blackjackPayout !== 1.5 ? <strong>{oddsText(perks.blackjackPayout)} (9+10)</strong> : '3:2'}
              {t('bj.info2')}{' '}
              {perks.blackjackWinPayout !== 1 ? <strong>{oddsText(perks.blackjackWinPayout)} (9+10)</strong> : '1:1'}
              {t('bj.info3')}
            </>
          }
        />
            <button
              className="slots-spin"
              disabled={busy || coins === null || coins < bet}
              onClick={() => void act(() => window.api.dealBlackjack(bet))}
            >
              {t('bj.deal')}
            </button>
          </>
        )}
      </div>
      {error && <p className="editor-error">{error}</p>}
      {coins !== null && coins < 1 && !playing && (
        <p className="editor-hint">
          {t('corner.outOfCoins')}{' '}
          <button className="link-button" onClick={onOpenCoinShop}>
            {t('corner.buyCoins')}
          </button>
        </p>
      )}
      <GameCornerTitles game="blackjack" perks={perks} />
      {notes.layer}
    </div>
  )
}

export default BlackjackTable
