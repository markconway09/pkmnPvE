import { useState } from 'react'
import type { TmFind, TmInfo, TmQuickCheckResult } from '../../shared/tms'
import { DEFAULT_SKILL_CHECK } from '../../shared/tms'
import RarityCard, { RarityGlow } from './RarityCard'
import { SkillCheckRing, type SkillCheckResult } from './SkillCheck'
import { formatMoney } from './money'
import ItemSprite from './ItemSprite'
import { IS_MOBILE } from './platform'
/** A TM's disc in its move's type colour (PokéSprite's TM icons). */
export function tmIconUrl(type: string): string {
  return `./sprites/tms/${type.toLowerCase()}.png`
}

export function TmIcon({ type, className }: { type: string; className?: string }): React.JSX.Element {
  return <img className={`tm-icon${className ? ` ${className}` : ''}`} src={tmIconUrl(type)} alt="" />
}

/** A TM's rarity card, sized by its className - the disc, the move's name, its type and category. */
export function TmCard({
  tm,
  className,
  dimmed,
  framed,
  children
}: {
  tm: TmInfo
  className?: string
  dimmed?: boolean
  framed?: boolean
  children?: React.ReactNode
}): React.JSX.Element {
  return (
    <RarityCard tier={tm.tier} framed={framed} dimmed={dimmed} className={`tm-card${className ? ` ${className}` : ''}`}>
      <RarityGlow size={48} className="tm-card-art">
        <TmIcon type={tm.type} />
      </RarityGlow>
      <span className="tm-card-name">{tm.name}</span>
      <span className="tm-card-sub">
        {tm.type} · {tm.category}
      </span>
      {children}
    </RarityCard>
  )
}

/** What a search or a quick check turned up: a new TM, or a duplicate paid out. */
export function TmFindCard({ find }: { find: TmFind }): React.JSX.Element {
  return (
    <TmCard tm={find.tm} framed className="tm-find-card">
      {find.upgraded && <span className="tm-find-upgraded">Great search - one rarity higher!</span>}
      <span className={`tm-find-note${find.duplicate ? ' tm-find-note-dupe' : ''}`}>
        {find.duplicate ? `Already had it · +${formatMoney(find.payout)}` : 'New TM!'}
      </span>
    </TmCard>
  )
}

/** A quick check's random item, shown on the same framed card a found TM gets. */
export function ItemFindCard({ item }: { item: NonNullable<TmQuickCheckResult['item']> }): React.JSX.Element {
  return (
    <RarityCard tier={item.tier} framed className="tm-card tm-find-card">
      <RarityGlow size={48} className="tm-card-art">
        <ItemSprite spritenum={item.spritenum} />
      </RarityGlow>
      <span className="tm-card-name">{item.itemName}</span>
      <span className="tm-card-sub">Item</span>
      <span className="tm-find-note">No TM, but found an item!</span>
    </RarityCard>
  )
}

/**
 * The quick check on a wild win's result screen (once the Scanner is bought): one skill
 * check, and a Good or a Great has a small chance to turn up a TM from the area.
 */
export function TmQuickCheck(): React.JSX.Element {
  const [runKey, setRunKey] = useState(0)
  const [outcome, setOutcome] = useState<{ result: SkillCheckResult; find: TmFind | null; item: TmQuickCheckResult['item'] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  function onDone(result: SkillCheckResult, timedOut: boolean): void {
    const doneAt = Date.now()
    window.api
      .takeTmQuickCheck(result, timedOut)
      .then((r) => {
        const next = { result, find: r.find, item: r.item ?? null }
        // A prize waits a beat so the check's result shows on the ring first.
        const wait = next.find || next.item ? Math.max(0, 300 - (Date.now() - doneAt)) : 0
        setTimeout(() => setOutcome(next), wait)
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }

  return (
    <div className="tm-quick-check">
      {runKey === 0 ? (
        <button className="tm-quick-check-start" onClick={() => setRunKey(1)}>
          <strong className="tm-quick-check-label">
            <ItemSprite spritenum={537} />
            Search the area
          </strong>
          <span>One skill check - a Good or a Great might turn up a TM</span>
        </button>
      ) : (
        <>
          {/* Once the check turns something up, the finished ring makes way for the prize. */}
          {!outcome?.find && !outcome?.item && <SkillCheckRing runKey={runKey} settings={DEFAULT_SKILL_CHECK} onDone={onDone} />}
          {outcome?.find ? (
            <TmFindCard find={outcome.find} />
          ) : outcome?.item ? (
            <ItemFindCard item={outcome.item} />
          ) : outcome ? (
            <span className="tm-quick-check-note">
              {outcome.result === 'miss' ? 'Nothing turned up.' : `A ${outcome.result === 'great' ? 'Great' : 'Good'} - but nothing turned up this time.`}
            </span>
          ) : error ? (
            <span className="tm-quick-check-note">{error}</span>
          ) : (
            <span className="tm-quick-check-note">{IS_MOBILE ? 'Tap on the zone' : 'Space / click on the zone'}</span>
          )}
        </>
      )}
    </div>
  )
}
