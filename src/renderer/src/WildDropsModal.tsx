import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { EditorOptions, WildDropEntry } from '../../shared/battle-types'
import ItemDropPicker from './ItemDropPicker'
import ItemSprite from './ItemSprite'

interface Props {
  onClose: () => void
}

function WildDropsModal({ onClose }: Props): React.JSX.Element {
  const [options, setOptions] = useState<EditorOptions | null>(null)
  const [entries, setEntries] = useState<WildDropEntry[]>([])
  const [speciesInput, setSpeciesInput] = useState('')
  const [itemId, setItemId] = useState<string | null>(null)
  const [chance, setChance] = useState(10)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([window.api.getEditorOptions(), window.api.listWildDrops()])
      .then(([opts, drops]) => {
        setOptions(opts)
        setEntries(drops)
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  const itemsById = new Map((options?.items ?? []).map((i) => [i.id, i]))

  async function save(species: string, drop: { itemId: string | null; chance: number }): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      setEntries(await window.api.setWildDrop(species, drop))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  function submit(): void {
    // The species box is free text (with suggestions) - only accept a real one,
    // and store it under its proper name.
    const match = options?.species.find((s) => s.name.toLowerCase() === speciesInput.trim().toLowerCase())
    if (!match) {
      setError('Pick a species from the list')
      return
    }
    if (!itemId) {
      setError('Pick an item for it to drop')
      return
    }
    void save(match.name, { itemId, chance })
  }

  function edit(entry: WildDropEntry): void {
    setSpeciesInput(entry.species)
    setItemId(entry.drop.itemId)
    setChance(entry.drop.chance)
    setError(null)
  }

  return createPortal(
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-panel wild-drops-modal" onMouseDown={(e) => e.stopPropagation()}>
        <h2>Wild Item Drops</h2>
        <p className="box-empty-hint">
          Give a species a chance to drop an item when you defeat it in a wild encounter. Trainer battles are never affected.
        </p>

        <div className="editor-form">
          <label className="editor-field editor-field-full">
            <span>Species</span>
            <input
              list="wild-drop-species"
              value={speciesInput}
              placeholder="Search for a species..."
              onChange={(e) => setSpeciesInput(e.target.value)}
            />
            <datalist id="wild-drop-species">
              {(options?.species ?? []).map((s) => (
                <option key={s.name} value={s.name} />
              ))}
            </datalist>
          </label>
          <ItemDropPicker
            label="Item drop"
            items={options?.items ?? []}
            itemId={itemId}
            chance={chance}
            onChangeItem={setItemId}
            onChangeChance={setChance}
          />
        </div>
        {error && <p className="editor-error">{error}</p>}
        <div className="editor-actions">
          <button disabled={busy || !options} onClick={submit}>
            Save drop
          </button>
        </div>

        <h3>Configured drops</h3>
        {entries.length === 0 ? (
          <p className="box-empty-hint">No wild drops set up yet.</p>
        ) : (
          <div className="wild-drop-list">
            {entries.map((entry) => {
              const item = entry.drop.itemId ? itemsById.get(entry.drop.itemId) : undefined
              return (
                <div key={entry.species} className="wild-drop-row">
                  <span className="wild-drop-species">{entry.species}</span>
                  <span className="wild-drop-item">
                    {item && <ItemSprite spritenum={item.spritenum} className="item-drop-icon" />}
                    {item?.name ?? entry.drop.itemId}
                  </span>
                  <span className="wild-drop-chance">{entry.drop.chance}%</span>
                  <button disabled={busy} onClick={() => edit(entry)}>
                    Edit
                  </button>
                  <button disabled={busy} onClick={() => void save(entry.species, { itemId: null, chance: 0 })}>
                    Remove
                  </button>
                </div>
              )
            })}
          </div>
        )}

        <div className="editor-actions">
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default WildDropsModal
