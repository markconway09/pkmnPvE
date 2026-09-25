import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { PokedexEntry } from '../../shared/battle-types'
import { toSpriteId } from '../../shared/battle-types'
import SpriteImage from './SpriteImage'

interface Props {
  onClose: () => void
}

// The trainer profile's Pokedex: every species in National Dex order - the ones the
// player has registered (had in their box) with their sprite, the rest as a "?".
function PokedexModal({ onClose }: Props): React.JSX.Element {
  const [entries, setEntries] = useState<PokedexEntry[] | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    window.api
      .getPokedex()
      .then(setEntries)
      .catch(() => setEntries([]))
  }, [])

  const registeredCount = entries?.filter((e) => e.registered).length ?? 0
  // Matches a name ("char") or a Dex number ("6", "#006").
  const query = search.trim().toLowerCase().replace(/^#/, '')
  const shown = (entries ?? []).filter(
    (e) => !query || e.species.toLowerCase().includes(query) || (/^\d+$/.test(query) && e.num === Number(query))
  )

  return createPortal(
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-panel pokedex-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="pokedex-header">
          <h2>Pokédex</h2>
          {entries && (
            <span className="pokedex-count">
              {registeredCount}/{entries.length}
            </span>
          )}
          <input
            className="box-search pokedex-search"
            type="search"
            placeholder="Search name or number…"
            value={search}
            autoFocus
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="pokedex-grid">
          {shown.map((e) => (
            <div key={e.num} className={`pokedex-cell${e.registered ? '' : ' pokedex-cell-unknown'}`}>
              {e.registered ? (
                <SpriteImage style="2d-static" className="pokedex-sprite" spriteId={toSpriteId(e.species)} alt={e.species} />
              ) : (
                <span className="pokedex-unknown">?</span>
              )}
              <span className="pokedex-name">{e.species}</span>
            </div>
          ))}
          {entries && shown.length === 0 && <p className="box-empty-hint">No Pokémon match that search.</p>}
        </div>
        <div className="editor-actions">
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default PokedexModal
