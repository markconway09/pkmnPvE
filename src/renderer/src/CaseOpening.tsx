import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { OpenItemResult, RarityTier } from '../../shared/battle-types'
import { toSpriteId } from '../../shared/battle-types'
import SpriteImage from './SpriteImage'
import ItemSprite from './ItemSprite'

interface Props {
  // What the Random Pokemon / Random Legendary was, and what it gave.
  itemName: string
  result: OpenItemResult
  onClose: () => void
}

// Each card's width plus the gap after it - the strip moves in steps of this.
const CARD_WIDTH = 112
const CARD_GAP = 8
const CARD_STEP = CARD_WIDTH + CARD_GAP
const SPIN_MS = 6500
// Starts fast, then crawls to a stop - the CS case-opening feel.
const SPIN_EASING = 'cubic-bezier(0.08, 0.62, 0.12, 1)'

const TIER_LABELS: Record<RarityTier, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  epic: 'Mythical',
  legendary: 'Legendary'
}

// A short click for each card that passes the marker, made on the spot - no sound file needed.
function playTick(audio: AudioContext): void {
  const osc = audio.createOscillator()
  const gain = audio.createGain()
  osc.type = 'square'
  osc.frequency.value = 1400
  gain.gain.setValueAtTime(0.04, audio.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.04)
  osc.connect(gain).connect(audio.destination)
  osc.start()
  osc.stop(audio.currentTime + 0.05)
}

/**
 * Opening a Random Pokemon / Random Legendary / Lock Capsule, the way a CS case opens:
 * a strip of Pokemon (or items) from the same pool spins past a marker and slows to a
 * stop on the one won
 * (the game has already picked it - this only shows it). Click to skip to the end.
 */
function CaseOpening({ itemName, result, onClose }: Props): React.JSX.Element {
  const viewportRef = useRef<HTMLDivElement>(null)
  const stripRef = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [done, setDone] = useState(false)
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
          if (lastCard !== -1 && audio) playTick(audio)
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
                  <span className="case-card-name">{entry.name}</span>
                </div>
              )
            })}
          </div>
          <div className="case-marker" />
        </div>

        {done ? (
          <div className="case-result">
            <p className={`case-result-name case-tier-text-${winner.tier}`}>
              {result.shiny && '✨ '}
              {result.shiny ? `Shiny ${result.name}` : result.name}
              {result.shiny && ' ✨'}
            </p>
            <p className="box-empty-hint">
              {result.kind === 'item'
                ? `${TIER_LABELS[winner.tier]} · it's in your bag`
                : `${TIER_LABELS[winner.tier]} · Lv ${result.level} · it's waiting in your box`}
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onClose()
              }}
            >
              Nice!
            </button>
          </div>
        ) : (
          <p className="box-empty-hint case-skip-hint">Click to skip</p>
        )}
      </div>
    </div>,
    document.body
  )
}

export default CaseOpening
