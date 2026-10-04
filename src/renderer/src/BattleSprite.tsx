import { useEffect, useRef, useState } from 'react'
import type {
  AbilityEvent,
  ActivePokemonView,
  BoostStat,
  FeedbackEvent,
  FieldEffectView,
  GimmickEvent
} from '../../shared/battle-types'
import { toSpriteId } from '../../shared/battle-types'
import SideHazards from './SideHazards'
import PokemonTooltipContent from './PokemonTooltipContent'
import Tooltip from './Tooltip'
import SubstituteDoll from './SubstituteDoll'
import ProtectShield from './ProtectShield'
import SideScreens from './SideScreens'
import { gmaxSpriteCandidates, spriteCandidates, type SpriteStyle } from './spriteStyle'
import ItemSprite from './ItemSprite'
import ShinyIcon from './ShinyIcon'
import { playCry } from './cries'

interface Props {
  pokemon: ActivePokemonView | null
  facing: 'front' | 'back'
  align: 'left' | 'right'
  spriteStyle: SpriteStyle
  // Which of the (up to 2) active slots on this side this sprite is for -
  // slot 1 (doubles only) renders shifted inward from slot 0's position.
  slotIndex?: 0 | 1
  // This side's entry hazards - drawn on the ground under each of its Pokemon
  // (both of them in doubles, since they cover the whole side).
  hazards?: FieldEffectView[]
  // This side's screens (Reflect/Light Screen/Aurora Veil) - shown on each of its
  // Pokemon the same way.
  screens?: FieldEffectView[]
  // The result to flash over this sprite right now (a miss, a crit, Protect
  // working, ...) - null most of the time. Only set for the one tick it
  // applies to; the sprite keeps it on screen itself for FEEDBACK_MS after.
  feedback?: FeedbackEvent | null
  // Which battle slot this is (p1a, p1b, p2a, p2b) - set as a data attribute
  // so AnimationLayer can find the real sprite element to animate against.
  slot?: 'p1a' | 'p1b' | 'p2a' | 'p2b'
  // Set for the one tick this Pokemon Terastallizes or Mega Evolves - the sprite
  // plays its own short animation for GIMMICK_MS after, like feedback above.
  gimmick?: GimmickEvent | null
  // Set for the one tick this Pokemon's ability does something - it shows a banner
  // naming it for ABILITY_MS after, like Showdown's ability pop-up.
  ability?: AbilityEvent | null
}

type Phase = 'idle' | 'recalling' | 'sending-out'

const RECALL_MS = 350
const SEND_OUT_MS = 350
// A shiny's sparkle burst outlasts the send-out itself, so it runs on its own clock.
const SHINY_BURST_MS = 1700

// The shiny burst, like the main games: a ring of stars shooting out from the
// Pokemon, a second ring turned half a step behind it, then a few twinkles
// lingering around the sprite.
type ShinySpark = { kind: 'ray' | 'twinkle'; a: number; d: number; size: number; delay: number }
const SHINY_SPARKS: ShinySpark[] = [
  ...Array.from({ length: 8 }, (_, i) => ({ kind: 'ray' as const, a: i * 45, d: 62, size: 16, delay: 120 })),
  ...Array.from({ length: 8 }, (_, i) => ({ kind: 'ray' as const, a: i * 45 + 22.5, d: 44, size: 11, delay: 300 })),
  { kind: 'twinkle', a: -40, d: 30, size: 14, delay: 520 },
  { kind: 'twinkle', a: 60, d: 38, size: 11, delay: 640 },
  { kind: 'twinkle', a: 170, d: 26, size: 13, delay: 760 },
  { kind: 'twinkle', a: 250, d: 40, size: 10, delay: 860 },
  { kind: 'twinkle', a: 15, d: 12, size: 17, delay: 960 }
]
const FEEDBACK_MS = 900
const GIMMICK_MS = 1100
const ABILITY_MS = 1600
// Crits, flinches and confusion stay up a bit longer than the other labels.
const EMPHASIS_FEEDBACK_MS = 1300

// A Pokemon that can't move shows its status as little pieces around it: sparks for
// full paralysis, drifting Zs for sleep, snowflakes for a freeze - and the same for a
// burn's flames and poison's bubbles when they hurt it.
const CANT_MOVE_PIECES: Partial<Record<NonNullable<FeedbackEvent['emphasis']>, { glyph: string; staggerMs: number }>> = {
  paralysis: { glyph: '⚡', staggerMs: 110 },
  sleep: { glyph: 'Z', staggerMs: 100 },
  freeze: { glyph: '❄', staggerMs: 140 },
  burn: { glyph: '🔥', staggerMs: 90 },
  poison: { glyph: '●', staggerMs: 120 }
}

const STATUS_LABELS: Record<string, string> = {
  par: 'PAR',
  brn: 'BRN',
  psn: 'PSN',
  tox: 'PSN',
  slp: 'SLP',
  frz: 'FRZ'
}

const BOOST_LABELS: Record<BoostStat, string> = {
  atk: 'ATK',
  def: 'DEF',
  spa: 'SpA',
  spd: 'SpD',
  spe: 'SPE',
  accuracy: 'ACC',
  evasion: 'EVA'
}

// A move or ability has changed its types (Soak, Forest's Curse, Color Change,
// Terastallizing, ...) - as opposed to a form change, which is just a different Pokemon.
function typesChanged(pokemon: ActivePokemonView): boolean {
  const sorted = (types: string[]): string => [...types].sort().join('/')
  return sorted(pokemon.types) !== sorted(pokemon.baseTypes)
}

// The Poke Ball item icon, shown by a wild Pokemon's name when that species has been caught before.
const POKE_BALL_SPRITENUM = 345

function BattleSprite({ pokemon, facing, align, spriteStyle, slotIndex = 0, hazards, screens, feedback, slot, gimmick, ability }: Props): React.JSX.Element {
  const slotClass = `sprite-slot ${align}${slotIndex === 1 ? ' sprite-slot-second' : ''}`
  const [displayed, setDisplayed] = useState<ActivePokemonView | null>(pokemon)
  const [phase, setPhase] = useState<Phase>('idle')
  const [shake, setShake] = useState(false)
  // Bumped each time a shiny comes out, so the burst restarts even back to back.
  const [shinyBurst, setShinyBurst] = useState(0)
  const [shownFeedback, setShownFeedback] = useState<FeedbackEvent | null>(null)

  // Its own timer, not the effect's cleanup: the next log line sets feedback back to
  // null, which mustn't cancel the hide (a crit's sprite effect would stick around).
  const shownFeedbackRef = useRef<FeedbackEvent | null>(null)
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!feedback) return
    // A crit, flinch or confusion isn't cut short by a plainer label right behind it
    // (a crit's "Super-effective" comes on the very next line).
    if (shownFeedbackRef.current?.emphasis && !feedback.emphasis) return
    shownFeedbackRef.current = feedback
    setShownFeedback(feedback)
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
    feedbackTimerRef.current = setTimeout(
      () => {
        shownFeedbackRef.current = null
        setShownFeedback(null)
      },
      feedback.emphasis ? EMPHASIS_FEEDBACK_MS : FEEDBACK_MS
    )
  }, [feedback])
  const [shownAbility, setShownAbility] = useState<AbilityEvent | null>(null)
  const abilityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!ability) return
    setShownAbility(ability)
    if (abilityTimerRef.current) clearTimeout(abilityTimerRef.current)
    abilityTimerRef.current = setTimeout(() => setShownAbility(null), ABILITY_MS)
  }, [ability])
  useEffect(
    () => () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
      if (abilityTimerRef.current) clearTimeout(abilityTimerRef.current)
    },
    []
  )
  const [shownGimmick, setShownGimmick] = useState<GimmickEvent | null>(null)
  useEffect(() => {
    if (!gimmick) return
    setShownGimmick(gimmick)
    const timer = setTimeout(() => setShownGimmick(null), GIMMICK_MS)
    return () => clearTimeout(timer)
  }, [gimmick])
  // Which of the candidate sprites is being shown (see spriteCandidates): each one that
  // fails to load moves on to the next, so a missing sprite never makes it vanish.
  const [fallbackStep, setFallbackStep] = useState(0)
  const prevSwitchSeqRef = useRef<number | null>(pokemon?.switchSeq ?? null)
  const prevHpRef = useRef<number | null>(pokemon?.hpPercent ?? null)

  useEffect(() => {
    if (!pokemon) {
      setDisplayed(null)
      setPhase('idle')
      prevSwitchSeqRef.current = null
      prevHpRef.current = null
      return
    }

    const prevSeq = prevSwitchSeqRef.current
    const isSwitch = prevSeq !== null && pokemon.switchSeq !== prevSeq
    prevSwitchSeqRef.current = pokemon.switchSeq

    if (isSwitch) {
      // Recall the outgoing Pokemon first, then swap the displayed data and
      // play the send-out animation for the incoming one.
      setPhase('recalling')
      const recallTimer = setTimeout(() => {
        setDisplayed(pokemon)
        prevHpRef.current = pokemon.hpPercent
        setPhase('sending-out')
        playCry(toSpriteId(pokemon.species))
        setTimeout(() => setPhase('idle'), SEND_OUT_MS)
      }, RECALL_MS)
      return () => clearTimeout(recallTimer)
    }

    const hpDropped = prevHpRef.current !== null && pokemon.hpPercent < prevHpRef.current
    prevHpRef.current = pokemon.hpPercent
    setDisplayed(pokemon)

    if (prevSeq === null) {
      // First Pokemon shown this battle - just a plain send-out, nothing to recall.
      setPhase('sending-out')
      playCry(toSpriteId(pokemon.species))
      const sendOutTimer = setTimeout(() => setPhase('idle'), SEND_OUT_MS)
      return () => clearTimeout(sendOutTimer)
    }

    if (hpDropped) {
      setShake(true)
      const shakeTimer = setTimeout(() => setShake(false), 400)
      return () => clearTimeout(shakeTimer)
    }
  }, [pokemon])

  useEffect(() => {
    if (phase !== 'sending-out' || !displayed?.shiny) return
    setShinyBurst((n) => n + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  useEffect(() => {
    if (!shinyBurst) return
    const timer = setTimeout(() => setShinyBurst(0), SHINY_BURST_MS)
    return () => clearTimeout(timer)
  }, [shinyBurst])

  // Gigantamax (a raid boss, or the player's cosmetic look - which never grows or glows):
  // its own picture (e.g. charizardgmax), the usual one if there's none.
  const gmax = !!displayed && (!!displayed.gigantamax || !!displayed.gmaxLook)
  const spriteId = displayed ? toSpriteId(displayed.species) : ''
  const isShiny = !!displayed?.shiny
  useEffect(() => {
    setFallbackStep(0)
  }, [spriteId, gmax, spriteStyle, isShiny, facing])

  if (!displayed) return <div className={slotClass} />

  const hpClass = displayed.hpPercent > 50 ? 'hp-high' : displayed.hpPercent > 20 ? 'hp-mid' : 'hp-low'
  const imgClasses = [
    'sprite',
    shake && 'sprite-shake',
    displayed.fainted && 'sprite-fainted',
    phase === 'recalling' && 'sprite-recalling',
    phase === 'sending-out' && 'sprite-sending-out',
    displayed.substituted && 'sprite-substituted',
    displayed.dynamaxed && 'sprite-dynamax',
    shownFeedback?.emphasis && `sprite-emphasis-${shownFeedback.emphasis}`
  ]
    .filter(Boolean)
    .join(' ')
  const candidates = (gmax ? gmaxSpriteCandidates : spriteCandidates)(spriteStyle, facing, spriteId, displayed.shiny)
  const src = candidates[Math.min(fallbackStep, candidates.length - 1)]

  return (
    <Tooltip
      // A Dynamaxed raid boss grows (see .sprite-slot-dynamax) and pushes its HP bar down.
      className={`${slotClass}${displayed.dynamaxed ? ' sprite-slot-dynamax' : ''}`}
      placement={align === 'right' ? 'below' : 'above'}
      content={<PokemonTooltipContent pokemon={displayed} />}
    >
      {/* The hazards and screens sit on the ground in front of it, outside the box that
          dashes, shakes and sways - so they stay put while the Pokemon moves. */}
      <div className="sprite-stage">
        {hazards && hazards.length > 0 && <SideHazards hazards={hazards} />}
        {screens && screens.length > 0 && <SideScreens screens={screens} />}
        {/* Seeded: little green orbs on the ground at its feet, like the hazards. */}
        {displayed.volatiles.some((b) => b.id === 'leechseed') && (
          <div className="leech-seed-orbs" title="Leech Seed">
            {Array.from({ length: 3 }).map((_, i) => (
              <span key={i} className="leech-seed-orb" />
            ))}
          </div>
        )}
        <div className="sprite-image-wrap" data-slot={slot}>
          <img
            className={imgClasses}
            src={src}
            alt={displayed.species}
            onError={(e) => {
              if (fallbackStep < candidates.length - 1) setFallbackStep(fallbackStep + 1)
              else e.currentTarget.style.visibility = 'hidden'
            }}
          />
          {displayed.substituted && <SubstituteDoll facing={facing} className="substitute-doll" />}
          {displayed.protecting && <ProtectShield className="protect-shield" />}
          {shownGimmick && (
            <div
              key={shownGimmick.kind + shownGimmick.slot}
              className={`gimmick-burst gimmick-${shownGimmick.kind}`}
            >
              <span
                className={`gimmick-ring${shownGimmick.teraType ? ` type-${shownGimmick.teraType.toLowerCase()}` : ''}`}
              />
              <span className="gimmick-flash" />
            </div>
          )}
        {shownFeedback?.emphasis && CANT_MOVE_PIECES[shownFeedback.emphasis] && (
          <div
            key={'cant' + shownFeedback.label}
            className={`paralysis-sparks cant-move-${shownFeedback.emphasis}`}
          >
            {Array.from({ length: 5 }).map((_, i) => (
              <span
                key={i}
                className="paralysis-spark"
                style={{ animationDelay: `${i * CANT_MOVE_PIECES[shownFeedback.emphasis!]!.staggerMs}ms` }}
              >
                {CANT_MOVE_PIECES[shownFeedback.emphasis!]!.glyph}
              </span>
            ))}
          </div>
        )}
        {shownFeedback?.emphasis === 'confusion' && (
            <div key={'stars' + shownFeedback.label} className="confusion-stars">
              {Array.from({ length: 4 }).map((_, i) => (
                <span key={i} className="confusion-star" style={{ animationDelay: `${i * -200}ms` }}>
                  ★
                </span>
              ))}
            </div>
          )}
          {shownFeedback && (
            <div
              key={shownFeedback.label + shownFeedback.slot}
              className={`feedback-label feedback-${shownFeedback.tone}${shownFeedback.emphasis ? ` feedback-emphasis feedback-${shownFeedback.emphasis}` : ''}`}
            >
              {shownFeedback.label}
            </div>
          )}
          {shownAbility && (
            <div
              key={shownAbility.ability + shownAbility.slot}
              className={`ability-popup ability-popup-${align}${shownAbility.itemSpritenum !== undefined ? ' ability-popup-item' : ''}`}
            >
              <span className="ability-popup-mon">{shownAbility.pokemon}&apos;s</span>
              <span className="ability-popup-name">
                {/* A held item at work shows its icon. */}
                {shownAbility.itemSpritenum !== undefined && (
                  <ItemSprite spritenum={shownAbility.itemSpritenum} className="ability-popup-icon" />
                )}
                {shownAbility.ability}
              </span>
            </div>
          )}
          {shinyBurst > 0 && (
            <div key={shinyBurst} className="shiny-sparkle">
              <span className="shiny-flash" />
              <span className="shiny-ring" />
              {SHINY_SPARKS.map((s, i) => (
                <span
                  key={i}
                  className={`shiny-spark shiny-spark-${s.kind}`}
                  style={
                    {
                      '--a': `${s.a}deg`,
                      '--d': `${s.d}px`,
                      fontSize: s.size,
                      animationDelay: `${s.delay}ms`
                    } as React.CSSProperties
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="sprite-info">
        <div className="sprite-name-row">
          <span className="sprite-name">{displayed.species}</span>
          {displayed.caughtBefore && (
            <span className="sprite-caught" title="Caught before">
              <ItemSprite spritenum={POKE_BALL_SPRITENUM} />
            </span>
          )}
          {displayed.shiny && <ShinyIcon />}
          <span className="sprite-level">Lv{displayed.level}</span>
          {displayed.status && (
            <span className={`status-badge status-${displayed.status}`}>
              {STATUS_LABELS[displayed.status] ?? displayed.status.toUpperCase()}
            </span>
          )}
        </div>
        {displayed.terastallized || displayed.megaEvolved || displayed.dynamaxed ? (
          // Shown whether or not it changed its types - a Fire Tera on a Fire type is still a Tera.
          <div className="sprite-types">
            {displayed.dynamaxed && (
              <span className="type-badge gimmick-badge dynamax-badge" title={displayed.gigantamax ? 'Gigantamaxed' : 'Dynamaxed'}>
                {displayed.gigantamax ? 'G-Max' : 'Dynamax'}
              </span>
            )}
            {displayed.megaEvolved && (
              <span className="type-badge gimmick-badge mega-badge" title="Mega Evolved">
                <img className="gimmick-badge-icon" src="./sprites/misc/mega-icon.webp" alt="" />
                Mega
              </span>
            )}
            {displayed.terastallized && (
              <span
                className={`type-badge gimmick-badge tera-badge type-${displayed.terastallized.toLowerCase()}`}
                title={`Terastallized into the ${displayed.terastallized} type`}
              >
                <img className="gimmick-badge-icon tera-badge-icon" src="./sprites/misc/tera-icon.png" alt="" />
                {displayed.terastallized}
              </span>
            )}
          </div>
        ) : (
          typesChanged(displayed) && (
            <div className="sprite-types" title="Its type has changed">
              {displayed.types.map((type) => (
                <span key={type} className={`type-badge type-${type.toLowerCase().replace(/[^a-z]/g, '')}`}>
                  {type}
                </span>
              ))}
            </div>
          )
        )}
        <div className="hp-bar-track">
          <div className={`hp-bar-fill ${hpClass}`} style={{ width: `${displayed.hpPercent}%` }} />
          <span className="hp-bar-text">{displayed.hpPercent}%</span>
        </div>
        {(Object.keys(displayed.boosts).length > 0 || displayed.volatiles.length > 0) && (
          <div className="boost-row">
            {(Object.entries(displayed.boosts) as [BoostStat, number][])
              .filter(([, amount]) => amount !== 0)
              .map(([stat, amount]) => (
                <span key={stat} className={`boost-badge ${amount > 0 ? 'boost-up' : 'boost-down'}`}>
                  {BOOST_LABELS[stat]}
                  {amount > 0 ? '+' : ''}
                  {amount}
                </span>
              ))}
            {/* Confused, Taunted, Leech Seed, Perish 2... - like Showdown's status line. */}
            {displayed.volatiles.map((badge) => (
              <span key={badge.id} className={`boost-badge volatile-badge volatile-${badge.kind}`}>
                {badge.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </Tooltip>
  )
}

export default BattleSprite
