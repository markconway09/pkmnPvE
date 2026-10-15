import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { TRAINER_SPRITE_IDS, trainerSpriteUrl } from './trainerSprite'
import { TRAINER_SPRITE_ARTISTS } from './trainerSpriteCredits'
import SearchBar from './SearchBar'
import { t } from './i18n'

// Each credited sprite and its artist, in the same order as the sprite picker.
const ARTIST_OF = new Map(Object.entries(TRAINER_SPRITE_ARTISTS).flatMap(([artist, ids]) => ids.map((id) => [id, artist] as const)))
const CREDITED = TRAINER_SPRITE_IDS.flatMap((id) => {
  const artist = ARTIST_OF.get(id)
  return artist ? [{ id, artist }] : []
})

/**
 * Sprite credits: every trainer sprite drawn by a named artist, with the artist under it.
 * Opened from the sprite picker and from Options. The search matches a sprite or an artist.
 */
function SpriteCreditsModal({ onClose }: { onClose: () => void }): React.JSX.Element {
  const [query, setQuery] = useState('')
  const trimmed = query.trim().toLowerCase()
  const shown = trimmed
    ? CREDITED.filter((c) => c.id.includes(trimmed) || c.artist.toLowerCase().includes(trimmed))
    : CREDITED

  // Esc closes just this window, not the one under it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      e.stopImmediatePropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return createPortal(
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-panel trainer-picker sprite-credits" onMouseDown={(e) => e.stopPropagation()}>
        <div className="trainer-picker-header">
          <h2>{t('credits.title')}</h2>
          <span className="trainer-picker-count">{shown.length} sprites</span>
          <SearchBar className="trainer-picker-search" placeholder={t('credits.search')} value={query} onChange={setQuery} autoFocus />
        </div>
        <p className="editor-hint sprite-credits-intro">
          Trainer sprites from Pokémon Showdown&apos;s sprite collection, drawn by these artists. Thank you!
        </p>
        <div className="trainer-picker-grid">
          {shown.map(({ id, artist }) => (
            <div key={id} className="trainer-picker-option sprite-credit" title={`${id} - by ${artist}`}>
              <img className="trainer-picker-img" src={trainerSpriteUrl(id)} alt={id} loading="lazy" draggable={false} />
              <span className="sprite-credit-artist">{artist}</span>
            </div>
          ))}
        </div>
        <div className="editor-actions">
          <button onClick={onClose}>{t('common.close')}</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default SpriteCreditsModal
