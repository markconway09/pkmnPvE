import { useEffect, useRef, useState } from 'react'
import RarityCard, { RarityGlow } from './RarityCard'
import FitName from './FitName'
import { createPortal } from 'react-dom'
import type { PokedexEntry } from '../../shared/battle-types'
import { toSpriteId } from '../../shared/battle-types'
import SpriteImage from './SpriteImage'
import ModalSpinner from './ModalSpinner'
import SearchBar from './SearchBar'

// The hint icons, spelled out for the header's legend.
const LEGEND = [
  '🗻 Cave · ⛰️ Mountain · 🌲 Forest · 🏙️ City',
  '🏭 Industry · 🪦 Graveyard · 🌊 Ocean (Wild Battle locations)',
  '🧪 Lab · ⭐ Max Raids · 🦴 Restore a fossil',
  '🔄 Form change · ⤴️ Evolve · 🎁 Random Pokémon / Legendary'
].join('\n')

interface Props {
  onClose: () => void
  // An entry to scroll to and flash (from a clicked "registered" pop-up).
  focus?: string | null
}

// The trainer profile's Pokedex: every species in National Dex order, each followed by
// its alternate forms (Alolan, Hisuian, Rotom-Wash...) - the ones the player has
// registered (had in their box, in that form) with their sprite, the rest as a "?".
// Each shows small icons for where to look for it, spelled out on hover.
function PokedexModal({ onClose, focus }: Props): React.JSX.Element {
  const [entries, setEntries] = useState<PokedexEntry[] | null>(null)
  const [search, setSearch] = useState('')
  const gridRef = useRef<HTMLDivElement>(null)

  // Fetched again for a new focus, so an entry registered while it's open shows up.
  useEffect(() => {
    window.api
      .getPokedex()
      .then(setEntries)
      .catch(() => setEntries([]))
    if (focus) setSearch('')
  }, [focus])

  // Once the entries are in, the focused one is scrolled to and flashed.
  useEffect(() => {
    if (!focus || !entries) return
    const el = gridRef.current?.querySelector<HTMLElement>(`[data-species="${CSS.escape(focus)}"]`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.remove('pokedex-cell-flash')
    void el.offsetWidth
    el.classList.add('pokedex-cell-flash')
  }, [focus, entries])

  const species = entries?.filter((e) => !e.form) ?? []
  const forms = entries?.filter((e) => e.form) ?? []
  const registeredCount = species.filter((e) => e.registered).length
  const registeredForms = forms.filter((e) => e.registered).length
  // Every species registered: the header turns into a gold card.
  const complete = species.length > 0 && registeredCount === species.length
  // Matches a name ("char") or a Dex number ("6", "#006").
  const query = search.trim().toLowerCase().replace(/^#/, '')
  const shown = (entries ?? []).filter(
    (e) => !query || e.species.toLowerCase().includes(query) || (/^\d+$/.test(query) && e.num === Number(query))
  )
  // Each Dex number's own species name, for its forms' cells.
  const baseNames = new Map((entries ?? []).filter((e) => !e.form).map((e) => [e.num, e.species]))

  return createPortal(
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className={`modal-panel pokedex-modal${entries ? '' : ' modal-panel-loading'}`} onMouseDown={(e) => e.stopPropagation()}>
        <RarityCard tier={complete ? 'legendary' : 'common'} framed={complete} className={`pokedex-header${complete ? ' pokedex-header-complete' : ''}`}>
          <h2>Pokédex{complete && <span className="pokedex-complete-badge">★ Complete</span>}</h2>
          {entries && (
            <span className="pokedex-count" title="Species in their usual form · alternate forms">
              {registeredCount}/{species.length}
              <span className="pokedex-count-forms">
                {' '}
                · Forms {registeredForms}/{forms.length}
              </span>
            </span>
          )}
          {/* How much of the Dex is registered, as a bar. */}
          {entries && species.length > 0 && (
            <span className="pokedex-progress" aria-hidden="true">
              <span style={{ width: `${(registeredCount / species.length) * 100}%` }} />
            </span>
          )}
          <span className="pokedex-legend" title={LEGEND}>
            Where to find?
          </span>
          <SearchBar className="pokedex-search" placeholder="Search name or number…" value={search} onChange={setSearch} autoFocus />
        </RarityCard>
        <div ref={gridRef} className={`pokedex-grid${entries ? '' : ' pokedex-grid-loading'}`}>
          {!entries && <ModalSpinner />}
          {shown.map((e) => {
            // An alternate form shows its species' name, and the form itself in a tag on
            // the corner ("Rotom" tagged "Wash") - the full name on hover.
            const base = e.form ? baseNames.get(e.num) : undefined
            const formName = base && e.species.startsWith(`${base}-`) ? e.species.slice(base.length + 1) : null
            return (
            <div
              key={e.species}
              data-species={e.species}
              className={`pokedex-cell rarity-card rarity-tier-${e.registered ? e.rarityTier : 'common'}${e.registered ? '' : ' pokedex-cell-unknown'}${e.form ? ' pokedex-cell-form' : ''}`}
              title={`#${e.num} ${e.species}${e.hints.length ? `\nFound: ${e.hints.map((h) => h.label).join(', ')}` : ''}`}
            >
              {formName && <span className="pokedex-form-tag">{formName}</span>}
              {e.registered ? (
                <RarityGlow size={56}>
                  <SpriteImage style="3d-static" className="pokedex-sprite" spriteId={toSpriteId(e.species)} alt={e.species} />
                </RarityGlow>
              ) : (
                <span className="pokedex-unknown">?</span>
              )}
              <FitName className="pokedex-name" text={formName ? base! : e.species} />
              {e.hints.length > 0 && (
                <span className="pokedex-hints">
                  {e.hints.map((h) => (
                    <span key={h.label}>{h.icon}</span>
                  ))}
                </span>
              )}
            </div>
            )
          })}
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
