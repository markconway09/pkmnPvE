import { useEffect, useState } from 'react'
import {
  HORDE_CHEST_SPRITE,
  HORDE_HELD_COUNT_STATS,
  HORDE_STACKED_CHANCE_STATS,
  hordeStackedChance,
  HORDE_HELD_IDS,
  HORDE_HELD_ITEMS,
  HORDE_RARITIES,
  type HordeHeld,
  type HordeHeldId
} from '../../shared/horde'
import type { MessageKey } from '../../shared/i18n'
import RarityCard, { RarityGlow } from './RarityCard'
import ItemSprite from './ItemSprite'
import { itemName, useT, type Translate } from './i18n'

/** What some copies of a held item add in all, in words ("+12% Attack") - a one-time item's rule as it is. */
export function heldBuffText(t: Translate, id: HordeHeldId, copies: number): string {
  const { stat, amount, unique } = HORDE_HELD_ITEMS[id]
  if (unique) return t(`horde.stat.${stat}` as MessageKey)
  // Card Keys and Bright Powders: their chance with these copies, which doesn't simply add up.
  const total = HORDE_STACKED_CHANCE_STATS.includes(stat) ? Math.round(hordeStackedChance(id, copies) * 1000) / 10 : Math.round(amount * copies * 10) / 10
  return `+${total}${HORDE_HELD_COUNT_STATS.includes(stat) ? '' : '%'} ${t(`horde.stat.${stat}` as MessageKey)}`
}

// How the chest opens, in milliseconds from the start: it drops in and shakes, bursts open,
// then each item spins up out of it in turn - a blur of items settling on the real one.
const SHAKE_MS = 900
const BURST_MS = 450
const ITEM_EVERY_MS = 750
const SPIN_MS = 550
// How often the spinning item changes while it spins.
const SPIN_STEP_MS = 70

interface Props {
  items: HordeHeldId[]
  // All the held items now (these included), for how many of each the lead has.
  held: HordeHeld
  onDone: () => void
}

/**
 * A chest being opened, Vampire Survivors style: the screen dims, the chest drops in at the
 * bottom and shakes, bursts open with light fanning out in the best item's colour (behind
 * the items) and coins showering up, and the items rise up out of it one by one. A click
 * anywhere skips straight to the end; Take closes it.
 */
function HordeChestOpen({ items, held, onDone }: Props): React.JSX.Element {
  const t = useT()
  const [start, setStart] = useState(() => performance.now())
  const [now, setNow] = useState(() => performance.now())
  const finishAt = SHAKE_MS + BURST_MS + ITEM_EVERY_MS * (items.length - 1) + SPIN_MS
  const elapsed = now - start
  const done = elapsed >= finishAt

  useEffect(() => {
    if (done) return
    let raf = 0
    const tick = (at: number): void => {
      setNow(at)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [done])

  // Enter or Space takes them once they're all out (or skips to that).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'e' && e.key !== 'E') return
      e.preventDefault()
      if (done) onDone()
      else setStart(performance.now() - finishAt)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [done, finishAt, onDone])

  const best = HORDE_RARITIES[Math.max(...items.map((id) => HORDE_RARITIES.indexOf(HORDE_HELD_ITEMS[id].rarity)))]
  const opened = elapsed >= SHAKE_MS

  return (
    <div
      className={`horde-overlay horde-chest-overlay rarity-tier-${best}`}
      onClick={() => {
        if (!done) setStart(performance.now() - finishAt)
      }}
    >
      {/* The items rise out of the chest at the bottom, the light fanning out behind them. */}
      <div className="horde-chest-stage">
        {opened && <span className="horde-chest-beams" />}
        {opened && (
          <span className="horde-chest-coins">
            {Array.from({ length: 14 }, (_, i) => (
              <span key={i} style={{ '--coin': i } as React.CSSProperties} />
            ))}
          </span>
        )}
        <div className="horde-chest-items">
          {items.map((id, i) => {
            const from = SHAKE_MS + BURST_MS + ITEM_EVERY_MS * i
            if (elapsed < from) return <span key={i} className="horde-chest-item horde-chest-item-waiting" />
            const spinning = elapsed < from + SPIN_MS
            const def = HORDE_HELD_ITEMS[id]
            if (spinning) {
              // A blur of items going past before it settles.
              const blur = HORDE_HELD_IDS[(Math.floor((elapsed - from) / SPIN_STEP_MS) + i * 5) % HORDE_HELD_IDS.length]
              return (
                <div key={i} className="horde-chest-item horde-chest-item-spinning">
                  <span className="horde-chest-reel">
                    <ItemSprite spritenum={HORDE_HELD_ITEMS[blur].spritenum} className="horde-chest-item-sprite" />
                  </span>
                </div>
              )
            }
            return (
              <RarityCard key={i} tier={def.rarity} framed className="horde-chest-item horde-chest-item-shown">
                <span className="horde-chest-item-rarity">{t(`rarity.${def.rarity}` as MessageKey)}</span>
                <RarityGlow size={72}>
                  <ItemSprite spritenum={def.spritenum} className="horde-chest-item-sprite" />
                </RarityGlow>
                <b className="horde-chest-item-name">{itemName(def.name)}</b>
                <span className="horde-chest-item-buff">{heldBuffText(t, id, 1)}</span>
                {(held[id] ?? 0) > 1 && <span className="horde-chest-item-count">{t('horde.heldCount', { count: held[id] ?? 0 })}</span>}
              </RarityCard>
            )
          })}
        </div>
        <span className={`horde-chest-big${opened ? ' horde-chest-big-open' : ''}`}>
          <ItemSprite spritenum={HORDE_CHEST_SPRITE} className="horde-chest-big-sprite" />
        </span>
      </div>
      <button
        className={`horde-btn horde-btn-primary horde-chest-take${done ? '' : ' horde-chest-take-hidden'}`}
        onClick={(e) => {
          e.stopPropagation()
          if (done) onDone()
        }}
      >
        {t('horde.take')}
      </button>
    </div>
  )
}

export default HordeChestOpen
