import { useCallback, useEffect, useState } from 'react'
import type { WildLocationConfig, WildLocationId } from '../../shared/battle-types'
import { TM_PITY_SEARCHES, TM_SEARCH_CHARGES_PER_DAY, type TmState } from '../../shared/tms'
import TmSearchModal from './TmSearchModal'
import ItemSprite from './ItemSprite'
import { TR_SPRITENUM } from './itemIcon'

/**
 * Classic's TM search: the searches left in each area today, and the search window while
 * one is going on. A search ending in an ambush fights a wild Pokemon in that area.
 */
export function useTmSearch(onAmbush: (location: WildLocationId) => void): {
  state: TmState | null
  open: (location: WildLocationConfig) => void
  modal: React.JSX.Element | null
} {
  const [state, setState] = useState<TmState | null>(null)
  const [searching, setSearching] = useState<WildLocationConfig | null>(null)

  const refresh = useCallback(() => {
    window.api
      .getTmState()
      .then(setState)
      .catch(() => {})
  }, [])
  useEffect(refresh, [refresh])

  const modal = searching && (
    <TmSearchModal
      location={searching}
      onClose={() => {
        setSearching(null)
        refresh()
      }}
      onAmbush={(id) => {
        setSearching(null)
        refresh()
        onAmbush(id)
      }}
    />
  )
  return { state, open: setSearching, modal }
}

interface StripProps {
  location: WildLocationConfig
  state: TmState | null
  disabled: boolean
  onSearch: () => void
}

/**
 * The TM search strip along the bottom of a wild area's tile, with its searches left today.
 */
export function TmSearchStrip({ location, state, disabled, onSearch }: StripProps): React.JSX.Element {
  const left = state?.charges[location.id] ?? 0
  const pity = state?.pity[location.id] ?? 0
  return (
    <button
      className={`tm-search-strip${left === 0 ? ' tm-search-strip-empty' : ''}`}
      disabled={disabled || !state || left === 0}
      title={
        left > 0
          ? `Search ${location.label} for a TM - ${left} left today · ${Math.max(0, TM_PITY_SEARCHES - pity)} more without a purple and the next is sure to be one`
          : 'No searches left here today - back tomorrow'
      }
      onClick={onSearch}
    >
      <span className="tm-search-strip-icon">
        <ItemSprite spritenum={TR_SPRITENUM} />
      </span>
      <span className="tm-search-strip-label">TM search</span>
      <span className="tm-search-strip-left">
        {left}/{TM_SEARCH_CHARGES_PER_DAY}
      </span>
    </button>
  )
}
