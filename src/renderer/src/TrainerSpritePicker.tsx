import { useState } from 'react'
import { createPortal } from 'react-dom'
import { TRAINER_SPRITE_IDS, trainerSpriteUrl } from './trainerSprite'
import SearchBar from './SearchBar'

interface Props {
  value: string
  onChange: (id: string) => void
  onClose: () => void
}

function TrainerSpritePicker({ value, onChange, onClose }: Props): React.JSX.Element {
  const [query, setQuery] = useState('')
  const trimmed = query.trim().toLowerCase()
  const filtered = trimmed ? TRAINER_SPRITE_IDS.filter((id) => id.includes(trimmed)) : TRAINER_SPRITE_IDS

  return createPortal(
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-panel trainer-picker" onMouseDown={(e) => e.stopPropagation()}>
        {/* The title, how many sprites are shown, and the search - on one bar. */}
        <div className="trainer-picker-header">
          <h2>Choose trainer sprite</h2>
          <span className="trainer-picker-count">{filtered.length} sprites</span>
          <SearchBar className="trainer-picker-search" placeholder="Search sprites..." value={query} onChange={setQuery} autoFocus />
        </div>
        <div className="trainer-picker-grid">
          {filtered.map((id) => (
            <button
              key={id}
              className={`trainer-picker-option ${id === value ? 'trainer-picker-selected' : ''}`}
              title={id}
              onClick={() => {
                onChange(id)
                onClose()
              }}
            >
              <img
                className="trainer-picker-img"
                src={trainerSpriteUrl(id)}
                alt={id}
                loading="lazy"
                draggable={false}
              />
            </button>
          ))}
        </div>
        <div className="editor-actions">
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default TrainerSpritePicker
