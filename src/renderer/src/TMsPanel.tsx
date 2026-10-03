import { useEffect, useMemo, useState } from 'react'
import { WILD_LOCATIONS } from '../../shared/battle-types'
import { TM_TIERS, type TmInfo } from '../../shared/tms'
import ItemSprite from './ItemSprite'
import { TR_SPRITENUM } from './itemIcon'
import { TmCard } from './TmBits'

type Show = 'owned' | 'missing' | 'all'

// Where a TM can be found, in a few words for its card.
function whereFound(tm: TmInfo): string {
  if (tm.coinOnly) return 'Coin Shop only'
  const areas = WILD_LOCATIONS.filter((l) => l.types && tm.locations.includes(l.id)).map((l) => l.label)
  return areas.length > 0 ? `${areas.join(', ')}, Anywhere` : 'Anywhere'
}

/**
 * The TMs tab of the Bag | Shop window (see BagShopModal): every TM collected, kept for
 * good - and, switched to Missing or All, the ones still to find with where they turn up.
 */
function TMsPanel(): React.JSX.Element {
  const [catalog, setCatalog] = useState<TmInfo[] | null>(null)
  const [owned, setOwned] = useState<Set<string>>(new Set())
  const [show, setShow] = useState<Show>('owned')
  const [query, setQuery] = useState('')

  useEffect(() => {
    Promise.all([window.api.getTmCatalog(), window.api.getTmState()])
      .then(([c, s]) => {
        setCatalog(c)
        setOwned(new Set(s.owned))
      })
      .catch(() => setCatalog([]))
  }, [])

  // By type, then rarest first, then name.
  const listed = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (catalog ?? [])
      .filter((t) => (show === 'all' ? true : show === 'owned' ? owned.has(t.moveId) : !owned.has(t.moveId)))
      .filter((t) => !q || t.name.toLowerCase().includes(q) || t.type.toLowerCase().includes(q))
      .sort(
        (a, b) =>
          a.type.localeCompare(b.type) || TM_TIERS.indexOf(b.tier) - TM_TIERS.indexOf(a.tier) || a.name.localeCompare(b.name)
      )
  }, [catalog, owned, show, query])

  if (!catalog) return <div className="bag-scroll" />

  return (
    <div className="bag-scroll tms-panel">
      <div className="tms-toolbar">
        <span className="tms-count">
          <strong>{owned.size}</strong> / {catalog.length} TMs
        </span>
        <span className="tms-filter">
          {(['owned', 'missing', 'all'] as Show[]).map((s) => (
            <button key={s} className={show === s ? 'tms-filter-on' : undefined} onClick={() => setShow(s)}>
              {s === 'owned' ? 'Owned' : s === 'missing' ? 'Missing' : 'All'}
            </button>
          ))}
        </span>
        <input className="tms-search" placeholder="Search moves or types" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {listed.length === 0 ? (
        <div className="tms-empty">
          <span className="tms-empty-icon">
            <ItemSprite spritenum={TR_SPRITENUM} />
          </span>
          <p>{show === 'owned' && owned.size === 0 ? 'No TMs yet - search the wild areas in Classic to find some.' : 'Nothing here.'}</p>
        </div>
      ) : (
        <div className="tms-grid">
          {listed.map((tm) => {
            const have = owned.has(tm.moveId)
            return (
              <TmCard key={tm.moveId} tm={tm} dimmed={!have} className="tms-card">
                {!have && <span className="tms-card-where">{whereFound(tm)}</span>}
              </TmCard>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default TMsPanel
