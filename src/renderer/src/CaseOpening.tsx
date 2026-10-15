import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { OpenItemResult, RarityTier } from '../../shared/battle-types'
import { CONFIRM_SELL_TIERS, toSpriteId } from '../../shared/battle-types'
import SpriteImage from './SpriteImage'
import ItemSprite from './ItemSprite'
import ShinyIcon from './ShinyIcon'
import { formatMoney } from './money'
import { playCornerTick } from './ticks'
import RarityOddsTooltip from './RarityOddsTooltip'
import { TIER_LABELS } from './RarityOddsTooltip'
import { clickWord, itemName as shownItemName, t } from './i18n'

interface Props {
  // What the Random Pokemon / Random Legendary was, and what it gave.
  itemName: string
  // Its bag id, for the Open another button's odds.
  itemId: string
  result: OpenItemResult
  // soldFor: the item won was sold right from the result, for this much.
  onClose: (soldFor?: number) => void
  // Opens the next one of the same item, when there are more in the bag.
  onOpenAnother: (soldFor?: number) => void
  // The strip has stopped (or was skipped) - the win is on show.
  onRevealed?: () => void
}

// Each card's width plus the gap after it - the strip moves in steps of this.
const CARD_WIDTH = 112
const CARD_GAP = 8
const CARD_STEP = CARD_WIDTH + CARD_GAP
const SPIN_MS = 6500
// Starts fast, then crawls to a stop - the CS case-opening feel.
const SPIN_EASING = 'cubic-bezier(0.08, 0.62, 0.12, 1)'


/**
 * Opening a Random Pokemon / Random Legendary / Lock Capsule, the way a CS case opens:
 * a strip of Pokemon (or items) from the same pool spins past a marker and slows to a
 * stop on the one won
 * (the game has already picked it - this only shows it). Click to skip to the end.
 */
function CaseOpening({ itemId, itemName, result, onClose, onOpenAnother, onRevealed }: Props): React.JSX.Element {
  const viewportRef = useRef<HTMLDivElement>(null)
  const stripRef = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [done, setDone] = useState(false)
  // An item won can be sold on the spot (see the result below).
  const [soldFor, setSoldFor] = useState<number | null>(null)
  const [selling, setSelling] = useState(false)
  const [sellError, setSellError] = useState<string | null>(null)
  // Selling a shiny, or a red or gold Pokemon, takes a second click.
  const [confirmingSell, setConfirmingSell] = useState(false)
  // What the Alchemist title turned up selling it.
  const [found, setFound] = useState<string[]>([])
  // A Pokemon won can be merged straight into its keeper instead (see autoMergeMon).
  const [mergedInto, setMergedInto] = useState<{ species: string; stars: number } | null>(null)
  const canSell = !!result.sellPrice && (result.kind === 'item' ? !!result.itemId : !!result.monId)
  const canMerge = result.kind === 'pokemon' && !!result.monId && !!result.mergeKeeper
  // Sold or merged: it's gone from the box, so neither can happen again.
  const settled = soldFor !== null || mergedInto !== null
  const sellNeedsConfirm =
    result.kind === 'pokemon' && (result.shiny || CONFIRM_SELL_TIERS.has(result.tier))

  async function sell(): Promise<void> {
    if (!canSell) return
    if (sellNeedsConfirm && !confirmingSell) {
      setConfirmingSell(true)
      return
    }
    setSelling(true)
    setSellError(null)
    try {
      if (result.kind === 'item') {
        setSoldFor((await window.api.sellItem(result.itemId!)).sold)
      } else {
        const sale = await window.api.sellMon(result.monId!)
        setFound(sale.found)
        setSoldFor(sale.sold)
      }
    } catch (e) {
      setSellError(e instanceof Error ? e.message : String(e))
    } finally {
      setSelling(false)
    }
  }
  async function merge(): Promise<void> {
    if (!canMerge || settled) return
    setSelling(true)
    setSellError(null)
    try {
      const merged = await window.api.autoMergeMon(result.monId!)
      setMergedInto({ species: merged.species, stars: merged.stars })
    } catch (e) {
      setSellError(e instanceof Error ? e.message : String(e))
    } finally {
      setSelling(false)
    }
  }

  // Lands somewhere inside the winning card, not dead centre every time.
  const [jitter] = useState(() => (Math.random() - 0.5) * (CARD_WIDTH * 0.7))

  // Where the strip has to be for the winner to sit under the marker.
  function targetOffset(): number {
    const viewport = viewportRef.current?.clientWidth ?? 0
    return -(result.winnerIndex * CARD_STEP + CARD_WIDTH / 2 + jitter - viewport / 2)
  }

  useEffect(() => {
    // One frame at the start position first, so the move to the end animates.
    const frame = requestAnimationFrame(() => {
      setSpinning(true)
      setOffset(targetOffset())
    })
    return () => cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Ticks: follow the strip's real position while it moves and click whenever a new
  // card crosses the marker.
  useEffect(() => {
    if (!spinning || done) return
    let audio: AudioContext | null = null
    try {
      audio = new AudioContext()
    } catch {
      audio = null
    }
    let lastCard = -1
    let raf = 0
    const follow = (): void => {
      const strip = stripRef.current
      const viewport = viewportRef.current
      if (strip && viewport) {
        const x = new DOMMatrixReadOnly(getComputedStyle(strip).transform).m41
        const card = Math.floor((viewport.clientWidth / 2 - x) / CARD_STEP)
        if (card !== lastCard) {
          if (lastCard !== -1 && audio) playCornerTick(audio)
          lastCard = card
        }
      }
      raf = requestAnimationFrame(follow)
    }
    raf = requestAnimationFrame(follow)
    return () => {
      cancelAnimationFrame(raf)
      void audio?.close()
    }
  }, [spinning, done])

  useEffect(() => {
    if (done) onRevealed?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done])

  function skip(): void {
    if (done) return
    setDone(true)
  }

  const winner = result.reel[result.winnerIndex]

  return createPortal(
    <div className="modal-overlay">
      <div className="modal-panel case-modal" onClick={skip}>
        <h2>{itemName}</h2>
        <div className="case-viewport" ref={viewportRef}>
          <div
            ref={stripRef}
            className="case-strip"
            style={{
              transform: `translateX(${offset}px)`,
              transition: done ? 'none' : spinning ? `transform ${SPIN_MS}ms ${SPIN_EASING}` : 'none'
            }}
            onTransitionEnd={() => setDone(true)}
          >
            {result.reel.map((entry, i) => {
              const isWinner = i === result.winnerIndex
              return (
                <div
                  key={i}
                  className={`case-card case-tier-${entry.tier}${isWinner && done ? ' case-card-won' : ''}`}
                  style={{ width: CARD_WIDTH }}
                >
                  {entry.species ? (
                    <SpriteImage
                      style="2d-static"
                      className="case-card-sprite"
                      spriteId={toSpriteId(entry.species)}
                      shiny={isWinner && result.shiny}
                      alt=""
                    />
                  ) : (
                    <span className="case-card-item">
                      <ItemSprite spritenum={entry.spritenum ?? 0} />
                    </span>
                  )}
                  <span className="case-card-name">{entry.species ? entry.name : shownItemName(entry.name)}</span>
                </div>
              )
            })}
          </div>
          <div className="case-marker" />
        </div>

        {/* Always the same height - spinning or showing any result - so the window never
            changes size from one case to the next. */}
        <div className="case-bottom">
        {done ? (
          <div className="case-result">
            <p className={`case-result-name case-tier-text-${winner.tier}`}>
              {result.shiny && <ShinyIcon className="shiny-icon-large" />}
              {result.kind === 'item'
                ? shownItemName(result.name)
                : result.shiny
                  ? t('case.shiny', { name: result.name })
                  : result.name}
              {result.shiny && <ShinyIcon className="shiny-icon-large" />}
              {result.isNew && <span className="case-new-badge">{t('case.new')}</span>}
              {result.kind === 'item' && !!result.price && (
                <span className="case-result-price">{formatMoney(result.price)}</span>
              )}
            </p>
            <p className="box-empty-hint">
              {result.kind === 'item'
                ? soldFor !== null
                  ? t('case.itemSold', { tier: TIER_LABELS[winner.tier], money: formatMoney(soldFor) })
                  : t('case.itemInBag', { tier: TIER_LABELS[winner.tier] })
                : soldFor !== null
                  ? `${t('case.monSold', { tier: TIER_LABELS[winner.tier], level: result.level, money: formatMoney(soldFor) })}${
                      found.length ? t('case.found', { list: found.map(shownItemName).join(', ') }) : ''
                    }`
                  : mergedInto
                    ? `${t('case.monMerged', { tier: TIER_LABELS[winner.tier], level: result.level, name: mergedInto.species })}${
                        mergedInto.stars > 0 ? t('case.nowStars', { stars: mergedInto.stars }) : ''
                      }`
                    : t('case.monInBox', { tier: TIER_LABELS[winner.tier], level: result.level })}
            </p>
            {sellError && <p className="editor-error">{sellError}</p>}
            {/* Always the same four buttons in the same places - greyed out when they don't apply. */}
            <div className="case-result-actions">
              <button
                className={confirmingSell ? 'confirm-button' : undefined}
                disabled={selling || !canSell || settled}
                title={!canSell ? t('case.cantSell') : undefined}
                onClick={(e) => {
                  e.stopPropagation()
                  void sell()
                }}
                onBlur={() => setConfirmingSell(false)}
              >
                {confirmingSell
                  ? t('case.sellConfirm', {
                      what: result.shiny ? t('case.thisShiny') : TIER_LABELS[winner.tier],
                      name: result.kind === 'item' ? shownItemName(result.name) : result.name,
                      money: formatMoney(result.sellPrice!),
                      click: clickWord()
                    })
                  : canSell
                    ? t('case.sellFor', { money: formatMoney(result.sellPrice!) })
                    : t('case.sell')}
              </button>
              <button
                disabled={selling || !canMerge || settled}
                title={
                  canMerge
                    ? `${t('case.mergeInto', { name: result.mergeKeeper!.species })}${
                        result.mergeKeeper!.stars > 0 ? ` (★${result.mergeKeeper!.stars})` : ''
                      }${
                        result.mergeKeeper!.uses.length
                          ? t('case.evolvesUsing', { list: result.mergeKeeper!.uses.map(shownItemName).join(', ') })
                          : ''
                      }`
                    : result.kind === 'pokemon'
                      ? t('case.noKeeper')
                      : t('case.onlyMon')
                }
                onClick={(e) => {
                  e.stopPropagation()
                  void merge()
                }}
              >
                {t('case.autoMerge')}
              </button>
              <RarityOddsTooltip source={{ kind: 'item', itemId }}>
                <button
                  disabled={selling || result.remaining <= 0}
                  onClick={(e) => {
                    e.stopPropagation()
                    onOpenAnother(soldFor ?? undefined)
                  }}
                >
                  {t('case.openAnother', { n: result.remaining })}
                </button>
              </RarityOddsTooltip>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onClose(soldFor ?? undefined)
                }}
              >
                {settled ? t('case.done') : t('case.nice')}
              </button>
            </div>
          </div>
        ) : (
          <p className="box-empty-hint case-skip-hint">{t('case.skip', { click: clickWord() })}</p>
        )}
        </div>
      </div>
    </div>,
    document.body
  )
}

export default CaseOpening
