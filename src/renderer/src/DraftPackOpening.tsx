import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { RarityGlow } from './RarityCard'
import FitName from './FitName'
import type { RarityTier } from '../../shared/battle-types'
import { toSpriteId } from '../../shared/battle-types'
import type { DraftMonView, DraftView } from '../../shared/draft'
import Tooltip from './Tooltip'
import PokemonTooltipContent from './PokemonTooltipContent'
import SpriteImage from './SpriteImage'
import ItemSprite from './ItemSprite'
import { CLICK } from './platform'

// The box's rarity colours (grey, blue, purple, pink, gold) - a card back glows in its own.
const RARITY_COLORS: Record<RarityTier, string> = {
  common: '#6b7483',
  uncommon: '#4b8bff',
  rare: '#8847ff',
  epic: '#eb4b9b',
  legendary: '#ffd23f'
}
// The pack's picture - the same card as the Draft mode icon.
const FOIL_ART = 'url(./icons/nav/draft.png)'
// These take a moment longer to flip, shaking and glowing first.
const SHOWY_TIERS = new Set<RarityTier>(['rare', 'epic', 'legendary'])

// Players who've asked their system for less motion get every pack already open.
function reducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

// Packs and opponents already shown opening this session - coming back to the menu
// (after switching modes, say) shows them as they were left instead of replaying it.
const openedPacks = new Set<string>()
const revealedOpponents = new Set<string>()

// The Web Animations on one component: each kept so a click can skip them all to the end.
function useAnimations(skipAll: boolean): {
  play: (el: Element | null | undefined, frames: Keyframe[], options: KeyframeAnimationOptions) => Promise<void>
  skip: () => void
  cancelAll: () => void
} {
  const running = useRef<Animation[]>([])
  const skipped = useRef(skipAll)
  return {
    play: (el, frames, options) => {
      if (!el) return Promise.resolve()
      const animation = el.animate(frames, {
        fill: 'forwards',
        ...options,
        duration: skipped.current ? 0 : options.duration,
        delay: skipped.current ? 0 : options.delay
      })
      running.current.push(animation)
      return animation.finished.then(
        () => undefined,
        () => undefined
      )
    },
    skip: () => {
      skipped.current = true
      for (const animation of running.current) animation.finish()
    },
    cancelAll: () => {
      for (const animation of running.current) animation.cancel()
      running.current = []
    }
  }
}

// One of the pack's Pokemon, laid out in full: set name, types, item, ability, moves.
function DraftOfferCard({ mon, tooltip }: { mon: DraftMonView; tooltip: boolean }): React.JSX.Element {
  const card = (
    <div className={`draft-offer-card rarity-card rarity-tier-${mon.rarityTier}`}>
      <RarityGlow size={80}>
        <SpriteImage style="3d-static" className="draft-offer-sprite" spriteId={toSpriteId(mon.species)} shiny={false} alt="" />
      </RarityGlow>
      <FitName className="draft-offer-species" text={mon.species} />
      <span className="draft-offer-set">{mon.setName}</span>
      <span className="draft-offer-types">
        {mon.types.map((t) => (
          <span key={t} className={`type-badge type-${t.toLowerCase()}`}>
            {t}
          </span>
        ))}
      </span>
      <span className="draft-offer-line">
        {mon.itemSpritenum != null && <ItemSprite spritenum={mon.itemSpritenum} className="item-drop-icon" />}
        {mon.item || 'No item'}
      </span>
      <span className="draft-offer-line draft-offer-ability">{mon.ability}</span>
      <span className="draft-offer-moves">
        {mon.moveList.map((m) => (
          <span key={m.name} className={`draft-move type-${m.type.toLowerCase()}`}>
            {m.name}
          </span>
        ))}
      </span>
    </div>
  )
  // No peeking at a card's set while it's still face down.
  return tooltip ? (
    <Tooltip className="draft-offer-wrap" placement="below" content={<PokemonTooltipContent pokemon={mon} />}>
      {card}
    </Tooltip>
  ) : (
    card
  )
}

interface PackProps {
  pack: DraftMonView[]
  round: number
  disabled: boolean
  // Where a picked card flies to: the next empty slot in the team row.
  slotFor: () => HTMLElement | null
  // Takes the pick (the animation plays meanwhile), then hands the draft over once it's done.
  requestPick: (index: number) => Promise<DraftView>
  onPicked: (view: DraftView) => void
  onError: (error: unknown) => void
}

type Phase = 'opening' | 'ready' | 'picking'

/**
 * A draft pack opening: the foil pack shakes and tears open, the cards fan out of it
 * face down and flip one by one - a rare one glows in its rarity colour and shakes
 * first, a legendary flashes. Picking one flies it down into the team and drops the
 * rest. A click while it's opening skips straight to the end.
 */
export function DraftPackOpening({ pack, round, disabled, slotFor, requestPick, onPicked, onError }: PackProps): React.JSX.Element {
  const packKey = `${round}:${pack.map((m) => m.species).join(',')}`
  const [intro] = useState(() => !reducedMotion() && !openedPacks.has(packKey))
  const [phase, setPhase] = useState<Phase>(intro ? 'opening' : 'ready')
  const { play, skip, cancelAll } = useAnimations(reducedMotion())
  const stageRef = useRef<HTMLDivElement>(null)
  const foilRef = useRef<HTMLDivElement>(null)
  const foilTopRef = useRef<HTMLDivElement>(null)
  const foilBodyRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])
  const innerRefs = useRef<(HTMLDivElement | null)[]>([])
  const backRefs = useRef<(HTMLDivElement | null)[]>([])
  const flashRefs = useRef<(HTMLSpanElement | null)[]>([])

  useLayoutEffect(() => {
    if (!intro) return
    let alive = true
    const open = async (): Promise<void> => {
      const stage = stageRef.current?.getBoundingClientRect()
      // The pack drops in and shakes...
      await play(foilRef.current, [{ opacity: 0, transform: 'translateY(-40px) scale(0.85)' }, { opacity: 1, transform: 'none' }], {
        duration: 180,
        easing: 'ease-out'
      })
      await play(
        foilRef.current,
        [
          { transform: 'rotate(0deg)' },
          { transform: 'rotate(-3deg)' },
          { transform: 'rotate(3deg)' },
          { transform: 'rotate(-2deg)' },
          { transform: 'rotate(2deg)' },
          { transform: 'rotate(0deg)' }
        ],
        { duration: 280 }
      )
      // ...its top rips off, and the cards come out of it into a row, face down.
      void play(
        foilTopRef.current,
        [{ transform: 'none', opacity: 1 }, { transform: 'translate(40px, -60px) rotate(20deg)', opacity: 0 }],
        { duration: 260, easing: 'ease-out' }
      )
      void play(
        foilBodyRef.current,
        [{ transform: 'none', opacity: 1 }, { transform: 'translateY(40px) scale(0.92)', opacity: 0 }],
        { duration: 300, delay: 120, easing: 'ease-in' }
      )
      const deals = cardRefs.current.map((card, i) => {
        const rect = card?.getBoundingClientRect()
        const dx = stage && rect ? stage.left + stage.width / 2 - (rect.left + rect.width / 2) : 0
        const tilt = (i - (pack.length - 1) / 2) * -10
        return play(
          card,
          [
            { opacity: 0, transform: `translate(${dx}px, 30px) scale(0.45) rotate(${tilt}deg)` },
            { opacity: 1, transform: 'none' }
          ],
          { duration: 320, delay: 80 + i * 70, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1.15)' }
        )
      })
      await Promise.all(deals)
      // Then each flips over, left to right.
      for (const [i, mon] of pack.entries()) {
        if (!alive) return
        const color = RARITY_COLORS[mon.rarityTier]
        if (SHOWY_TIERS.has(mon.rarityTier)) {
          const long = mon.rarityTier === 'legendary'
          void play(
            backRefs.current[i],
            [
              { boxShadow: `0 0 0 0 ${color}` },
              { boxShadow: `0 0 26px 8px ${color}`, offset: 0.7 },
              { boxShadow: `0 0 14px 3px ${color}` }
            ],
            { duration: long ? 700 : 450 }
          )
          await play(
            cardRefs.current[i],
            [
              { transform: 'none' },
              { transform: 'translateX(-3px) rotate(-1.5deg)' },
              { transform: 'translateX(3px) rotate(1.5deg)' },
              { transform: 'translateX(-3px) rotate(-1deg)' },
              { transform: 'translateX(3px) rotate(1deg)' },
              { transform: 'none' }
            ],
            { duration: long ? 700 : 450 }
          )
        }
        await play(innerRefs.current[i], [{ transform: 'rotateY(180deg)' }, { transform: 'rotateY(0deg)' }], {
          duration: 300,
          easing: 'ease-in-out'
        })
        if (mon.rarityTier === 'legendary' || mon.rarityTier === 'epic') {
          void play(
            flashRefs.current[i],
            [
              { opacity: 0, transform: 'scale(0.5)' },
              { opacity: 0.9, transform: 'scale(1.1)', offset: 0.3 },
              { opacity: 0, transform: 'scale(1.5)' }
            ],
            { duration: 500, easing: 'ease-out' }
          )
        }
      }
      if (!alive) return
      openedPacks.add(packKey)
      setPhase('ready')
    }
    void open()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function pick(index: number): Promise<void> {
    if (phase !== 'ready' || disabled) return
    setPhase('picking')
    const card = cardRefs.current[index]
    const from = card?.getBoundingClientRect()
    const to = slotFor()?.getBoundingClientRect()
    // The pick lifts and flies into its team slot; the others dim and fall away.
    const fly = (async () => {
      await play(card, [{ transform: 'none', filter: 'none' }, { transform: 'translateY(-14px) scale(1.06)', filter: 'drop-shadow(0 0 12px #ffb74d)' }], {
        duration: 150,
        easing: 'ease-out'
      })
      const dx = from && to ? to.left + to.width / 2 - (from.left + from.width / 2) : 0
      const dy = from && to ? to.top + to.height / 2 - (from.top + from.height / 2) : 120
      const scale = from && to ? to.width / from.width : 0.4
      await play(
        card,
        [
          { transform: 'translateY(-14px) scale(1.06)', opacity: 1, filter: 'drop-shadow(0 0 12px #ffb74d)' },
          { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 0.25, filter: 'drop-shadow(0 0 4px #ffb74d)' }
        ],
        { duration: 380, easing: 'cubic-bezier(0.5, 0, 0.9, 0.6)' }
      )
    })()
    const drops = cardRefs.current.map((other, i) =>
      i === index
        ? Promise.resolve()
        : play(
            other,
            [
              { opacity: 1, transform: 'none', filter: 'none' },
              {
                opacity: 0,
                transform: `translateY(60px) scale(0.85) rotate(${i < index ? -8 : 8}deg)`,
                filter: 'grayscale(1) brightness(0.5)'
              }
            ],
            { duration: 320, delay: 60, easing: 'ease-in' }
          )
    )
    try {
      const [view] = await Promise.all([requestPick(index), fly, ...drops])
      onPicked(view)
    } catch (e) {
      cancelAll()
      setPhase('ready')
      onError(e)
    }
  }

  return (
    <div
      ref={stageRef}
      className={`draft-pack-stage${phase === 'opening' ? ' draft-pack-stage-opening' : ''}`}
      title={phase === 'opening' ? `${CLICK} to skip` : undefined}
      onClick={() => phase === 'opening' && skip()}
    >
      {intro && (
        // Both halves show the same picture, lined up, so the pack looks whole until it tears.
        <div ref={foilRef} className="draft-foil">
          <div ref={foilTopRef} className="draft-foil-top" style={{ backgroundImage: FOIL_ART }} />
          <div ref={foilBodyRef} className="draft-foil-body" style={{ backgroundImage: FOIL_ART }}>
            <span className="draft-foil-round">Pick {round}</span>
          </div>
        </div>
      )}
      <div className="draft-pack">
        {pack.map((mon, i) => (
          <div
            key={mon.species}
            ref={(el) => {
              cardRefs.current[i] = el
            }}
            className={`draft-card${intro ? ' draft-card-pending' : ''}${phase === 'ready' && !disabled ? ' draft-card-pickable' : ''}`}
            // A tap picks it, so on a touch screen its tooltip takes a hold.
            data-tap-action=""
            onClick={() => void pick(i)}
          >
            <div
              ref={(el) => {
                innerRefs.current[i] = el
              }}
              className={`draft-card-inner${intro ? ' draft-card-facedown' : ''}`}
            >
              <div className="draft-card-face draft-card-front">
                <DraftOfferCard mon={mon} tooltip={phase === 'ready'} />
                <span
                  ref={(el) => {
                    flashRefs.current[i] = el
                  }}
                  className="draft-card-flash"
                  style={{ '--rarity': RARITY_COLORS[mon.rarityTier] } as React.CSSProperties}
                />
              </div>
              <div
                ref={(el) => {
                  backRefs.current[i] = el
                }}
                className="draft-card-face draft-card-back"
                style={{ '--rarity': RARITY_COLORS[mon.rarityTier] } as React.CSSProperties}
              >
                <span className="draft-card-emblem" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * The gauntlet's next opponent coming in: the trainer slides in, then their team is
 * dealt out card by card ([data-reveal="trainer"] and [data-reveal="mon"] inside).
 * Once per opponent per session.
 */
export function OpponentReveal({ revealKey, className, children }: { revealKey: string; className: string; children: ReactNode }): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const root = ref.current
    if (!root || reducedMotion() || revealedOpponents.has(revealKey)) return
    revealedOpponents.add(revealKey)
    root.querySelector('[data-reveal="trainer"]')?.animate(
      [
        { opacity: 0, transform: 'translateX(50px)' },
        { opacity: 1, transform: 'none' }
      ],
      { duration: 320, easing: 'ease-out', fill: 'both' }
    )
    root.querySelectorAll('[data-reveal="mon"]').forEach((mon, i) => {
      mon.animate(
        [
          { opacity: 0, transform: 'perspective(600px) translateY(-16px) rotateY(90deg)' },
          { opacity: 1, transform: 'none' }
        ],
        { duration: 280, delay: 250 + i * 110, easing: 'ease-out', fill: 'both' }
      )
    })
  }, [revealKey])
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
