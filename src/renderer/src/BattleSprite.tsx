import { useEffect, useRef, useState } from 'react'
import type { ActivePokemonView, BoostStat, FeedbackEvent, FieldEffectView, GimmickEvent } from '../../shared/battle-types'
import { toSpriteId } from '../../shared/battle-types'
import SideHazards from './SideHazards'
import PokemonTooltipContent from './PokemonTooltipContent'
import Tooltip from './Tooltip'
import SubstituteDoll from './SubstituteDoll'
import ProtectShield from './ProtectShield'
import SideScreens from './SideScreens'
import { spriteCandidates, type SpriteStyle } from './spriteStyle'
import ItemSprite from './ItemSprite'

interface Props {
  pokemon: ActivePokemonView | null
  facing: 'front' | 'back'
  align: 'left' | 'right'
  spriteStyle: SpriteStyle
  // Which of the (up to 2) active slots on this side this sprite is for -
  // slot 1 (doubles only) renders shifted inward from slot 0's position.
  slotIndex?: 0 | 1
  // This side's entry hazards - drawn on the ground under the slot-0 sprite
  // only, since a side has one patch of ground however many Pokemon it has out.
  hazards?: FieldEffectView[]
  // This side's screens (Reflect/Light Screen/Aurora Veil) - same slot-0-only
  // deal as hazards, since they're side-wide too.
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
}

type Phase = 'idle' | 'recalling' | 'sending-out'

const RECALL_MS = 350
const SEND_OUT_MS = 350
const FEEDBACK_MS = 900
const GIMMICK_MS = 1100

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

function BattleSprite({ pokemon, facing, align, spriteStyle, slotIndex = 0, hazards, screens, feedback, slot, gimmick }: Props): React.JSX.Element {
  const slotClass = `sprite-slot ${align}${slotIndex === 1 ? ' sprite-slot-second' : ''}`
  const [displayed, setDisplayed] = useState<ActivePokemonView | null>(pokemon)
  const [phase, setPhase] = useState<Phase>('idle')
  const [shake, setShake] = useState(false)
  const [shownFeedback, setShownFeedback] = useState<FeedbackEvent | null>(null)

  useEffect(() => {
    if (!feedback) return
    setShownFeedback(feedback)
    const timer = setTimeout(() => setShownFeedback(null), FEEDBACK_MS)
    return () => clearTimeout(timer)
  }, [feedback])
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
      const sendOutTimer = setTimeout(() => setPhase('idle'), SEND_OUT_MS)
      return () => clearTimeout(sendOutTimer)
    }

    if (hpDropped) {
      setShake(true)
      const shakeTimer = setTimeout(() => setShake(false), 400)
      return () => clearTimeout(shakeTimer)
    }
  }, [pokemon])

  const spriteId = displayed ? toSpriteId(displayed.species) : ''
  const isShiny = !!displayed?.shiny
  useEffect(() => {
    setFallbackStep(0)
  }, [spriteId, spriteStyle, isShiny, facing])

  if (!displayed) return <div className={slotClass} />

  const hpClass = displayed.hpPercent > 50 ? 'hp-high' : displayed.hpPercent > 20 ? 'hp-mid' : 'hp-low'
  const imgClasses = [
    'sprite',
    shake && 'sprite-shake',
    displayed.fainted && 'sprite-fainted',
    phase === 'recalling' && 'sprite-recalling',
    phase === 'sending-out' && 'sprite-sending-out',
    displayed.substituted && 'sprite-substituted'
  ]
    .filter(Boolean)
    .join(' ')
  const candidates = spriteCandidates(spriteStyle, facing, spriteId, displayed.shiny)
  const src = candidates[Math.min(fallbackStep, candidates.length - 1)]

  return (
    <Tooltip
      className={slotClass}
      placement={align === 'right' ? 'below' : 'above'}
      content={<PokemonTooltipContent pokemon={displayed} />}
    >
      <div className="sprite-image-wrap" data-slot={slot}>
        {slotIndex === 0 && hazards && hazards.length > 0 && <SideHazards hazards={hazards} />}
        {slotIndex === 0 && screens && screens.length > 0 && <SideScreens screens={screens} />}
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
        {shownFeedback && (
          <div key={shownFeedback.label + shownFeedback.slot} className={`feedback-label feedback-${shownFeedback.tone}`}>
            {shownFeedback.label}
          </div>
        )}
        {phase === 'sending-out' && displayed.shiny && (
          <div className="shiny-sparkle">
            {Array.from({ length: 7 }).map((_, i) => (
              <span key={i} className="shiny-spark" />
            ))}
          </div>
        )}
      </div>
      <div className="sprite-info">
        <div className="sprite-name-row">
          <span className="sprite-name">{displayed.species}</span>
          {displayed.caughtBefore && (
            <span className="sprite-caught" title="Caught before">
              <ItemSprite spritenum={POKE_BALL_SPRITENUM} />
            </span>
          )}
          {displayed.shiny && (
            <span className="sprite-shiny" title="Shiny">
              ★
            </span>
          )}
          <span className="sprite-level">Lv{displayed.level}</span>
          {displayed.status && (
            <span className={`status-badge status-${displayed.status}`}>
              {STATUS_LABELS[displayed.status] ?? displayed.status.toUpperCase()}
            </span>
          )}
        </div>
        {displayed.terastallized || displayed.megaEvolved ? (
          // Shown whether or not it changed its types - a Fire Tera on a Fire type is still a Tera.
          <div className="sprite-types">
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
