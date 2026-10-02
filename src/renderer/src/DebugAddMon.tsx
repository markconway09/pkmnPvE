import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { BoxState, SpeciesOptionEntry } from '../../shared/battle-types'
import { toSpriteId } from '../../shared/battle-types'
import SearchBar from './SearchBar'
import SpriteImage from './SpriteImage'
import ModalSpinner from './ModalSpinner'
import { errorMessage } from './FloatingNotes'

interface Props {
  onAdded: (box: BoxState) => void
  onClose: () => void
}

// The list only shows this many matches at a time - type more to narrow it.
const MAX_SHOWN = 60

/**
 * Debug: put any Pokemon in the box - search a species, pick its level and whether it's
 * shiny, and add it (as often as you like - the window stays open). Random adds a
 * random-battle set instead, as the old button did.
 */
function DebugAddMon({ onAdded, onClose }: Props): React.JSX.Element {
  const [species, setSpecies] = useState<SpeciesOptionEntry[] | null>(null)
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<string | null>(null)
  const [levelText, setLevelText] = useState('50')
  const [shiny, setShiny] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ text: string; bad: boolean } | null>(null)

  useEffect(() => {
    window.api
      .getEditorOptions()
      .then((options) => setSpecies(options.species))
      .catch(() => setSpecies([]))
  }, [])

  const q = query.trim().toLowerCase()
  const matches = (species ?? []).filter((s) => !q || s.name.toLowerCase().includes(q))
  const level = Math.max(1, Math.min(100, Number(levelText.replace(/[^0-9]/g, '')) || 1))

  async function act(action: () => Promise<{ box: BoxState; text: string }>): Promise<void> {
    setBusy(true)
    setNote(null)
    try {
      const { box, text } = await action()
      onAdded(box)
      setNote({ text, bad: false })
    } catch (e) {
      setNote({ text: errorMessage(e), bad: true })
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-panel debug-add-mon" onMouseDown={(e) => e.stopPropagation()}>
        <div className="debug-add-header">
          <h2>Add Pokémon</h2>
          <SearchBar className="debug-add-search" placeholder="Search species…" value={query} onChange={setQuery} autoFocus />
        </div>

        {!species && <ModalSpinner />}
        <div className="debug-add-list">
          {matches.slice(0, MAX_SHOWN).map((s) => (
            <button
              key={s.name}
              className={`debug-add-row${picked === s.name ? ' debug-add-row-picked' : ''}`}
              onClick={() => setPicked(s.name)}
              onDoubleClick={() =>
                void act(async () => ({
                  box: await window.api.addBoxMon(s.name, level, shiny),
                  text: `Added ${shiny ? 'shiny ' : ''}${s.name} (Lv ${level})`
                }))
              }
            >
              <SpriteImage style="3d-static" className="debug-add-sprite" spriteId={toSpriteId(s.name)} alt="" />
              <span className="debug-add-name">{s.name}</span>
              <span className="debug-add-types">
                {s.types.map((t) => (
                  <span key={t} className={`type-badge type-${t.toLowerCase()}`}>
                    {t}
                  </span>
                ))}
              </span>
            </button>
          ))}
          {species && matches.length === 0 && <p className="box-empty-hint">No species match.</p>}
          {matches.length > MAX_SHOWN && (
            <p className="box-empty-hint">
              {matches.length - MAX_SHOWN} more - type to narrow it down.
            </p>
          )}
        </div>

        {/* What gets added: level and shiny, then the buttons. */}
        <div className="debug-add-options">
          <label className="debug-add-level">
            <span>Level</span>
            <input inputMode="numeric" value={levelText} onChange={(e) => setLevelText(e.target.value)} />
          </label>
          <label className="debug-add-shiny">
            <input type="checkbox" checked={shiny} onChange={(e) => setShiny(e.target.checked)} /> Shiny
          </label>
          {note && <span className={note.bad ? 'editor-error debug-add-note' : 'debug-add-note'}>{note.text}</span>}
        </div>

        <div className="editor-actions">
          <button
            disabled={busy}
            title="A random-battle set of a random Pokémon"
            onClick={() =>
              void act(async () => {
                const before = new Set((await window.api.listBox()).mons.map((m) => m.id))
                const box = await window.api.addRandomBoxMon()
                const added = box.mons.find((m) => !before.has(m.id))
                return { box, text: `Added ${added ? added.species : 'a random Pokémon'}` }
              })
            }
          >
            Random
          </button>
          <span className="debug-add-spacer" />
          <button onClick={onClose}>Close</button>
          <button
            className="debug-add-go"
            disabled={busy || !picked}
            onClick={() =>
              void act(async () => ({
                box: await window.api.addBoxMon(picked!, level, shiny),
                text: `Added ${shiny ? 'shiny ' : ''}${picked} (Lv ${level})`
              }))
            }
          >
            {picked ? `Add ${picked}` : 'Pick a species'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default DebugAddMon
