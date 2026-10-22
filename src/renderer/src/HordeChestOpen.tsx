import { useEffect, useRef, useState } from 'react'
import {
  HORDE_BIG_NUGGET_MONEY,
  HORDE_BOOSTER_SPEED,
  HORDE_CHEST_SPRITE,
  HORDE_FLAME_ORB_DAMAGE,
  HORDE_ICY_ROCK_MS,
  HORDE_ITEM_BUFF_MS,
  HORDE_MAX_MUSHROOM_HP,
  HORDE_SCARF_WALK,
  type HordeItemId,
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
import { formatMoney } from './money'
import { itemName, useT, type Translate } from './i18n'

/** What some copies of a held item add in all, in words ("+12% Attack") - a one-time item's rule as it is. */
export function heldBuffText(t: Translate, id: HordeHeldId, copies: number): string {
  const { stat, amount, unique } = HORDE_HELD_ITEMS[id]
  if (unique) return t(`horde.stat.${stat}` as MessageKey)
  // Card Keys and Bright Powders: their chance with these copies, which doesn't simply add up.
  const total = HORDE_STACKED_CHANCE_STATS.includes(stat) ? Math.round(hordeStackedChance(id, copies) * 1000) / 10 : Math.round(amount * copies * 10) / 10
  return `+${total}${HORDE_HELD_COUNT_STATS.includes(stat) ? '' : '%'} ${t(`horde.stat.${stat}` as MessageKey)}`
}

/** What an item picked up off the field does, in words. */
export function hordeItemDesc(t: Translate, item: HordeItemId): string {
  const amount: Partial<Record<HordeItemId, number>> = {
    choiceScarf: Math.round((HORDE_SCARF_WALK - 1) * 100),
    boosterEnergy: Math.round(HORDE_BOOSTER_SPEED * 100),
    flameOrb: Math.round((HORDE_FLAME_ORB_DAMAGE - 1) * 100),
    icyRock: HORDE_ICY_ROCK_MS / 1000,
    maxMushroom: HORDE_MAX_MUSHROOM_HP
  }
  return t(`horde.itemDesc.${item}` as MessageKey, {
    n: amount[item] ?? 0,
    s: HORDE_ITEM_BUFF_MS / 1000,
    money: formatMoney(HORDE_BIG_NUGGET_MONEY)
  })
}

// How the chest opens, in milliseconds from the start: it drops in and shakes, bursts open,
// then each item spins up out of it in turn - a blur of items settling on the real one.
const SHAKE_MS = 900
const BURST_MS = 450
const ITEM_EVERY_MS = 750
// With many items (several chests opened at once) they come out quicker, down to this often.
const ITEM_EVERY_FASTEST_MS = 160
const ITEMS_REVEAL_MS = 4500
// More items than this and they wrap into rows that scroll.
const ITEMS_IN_A_ROW = 5
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
  const every = Math.max(ITEM_EVERY_FASTEST_MS, Math.min(ITEM_EVERY_MS, ITEMS_REVEAL_MS / items.length))
  const finishAt = SHAKE_MS + BURST_MS + every * (items.length - 1) + SPIN_MS
  const elapsed = now - start
  const done = elapsed >= finishAt
  // How many have started coming out - the list scrolls down to keep the newest in view.
  const out = Math.max(0, Math.min(items.length, Math.floor((elapsed - SHAKE_MS - BURST_MS) / every) + 1))
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const list = listRef.current
    const newest = list?.children[out - 1] as HTMLElement | undefined
    if (!list || !newest) return
    const bottom = newest.offsetTop + newest.offsetHeight - list.clientHeight
    if (bottom > list.scrollTop) list.scrollTo({ top: bottom, behavior: 'smooth' })
  }, [out])

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
        <div
          ref={listRef}
          className={`horde-chest-items${items.length > ITEMS_IN_A_ROW ? ' horde-chest-items-many' : ''}`}
          // Scrolling the list (or clicking in it) doesn't skip ahead.
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((id, i) => {
            const from = SHAKE_MS + BURST_MS + every * i
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
