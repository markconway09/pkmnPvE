import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { SPRITE_STYLES, SPRITE_STYLE_LABELS, spriteUrl, type SpriteStyle } from './spriteStyle'
import UpdatesSection from './UpdatesSection'
import BackgroundSection from './BackgroundSection'

interface Props {
  username: string
  onLogout: () => Promise<void>
  spriteStyle: SpriteStyle
  onChangeSpriteStyle: (style: SpriteStyle) => void
  background: string | null
  onChangeBackground: (background: string | null) => void
  onClose: () => void
}

const PREVIEW_SPECIES_ID = 'pikachu'

function Options({
  username,
  onLogout,
  spriteStyle,
  onChangeSpriteStyle,
  background,
  onChangeBackground,
  onClose
}: Props): React.JSX.Element {
  const [loggingOut, setLoggingOut] = useState(false)

  // Esc closes it, like clicking outside.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-panel options-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="options-modal-header">
          <h2>Options</h2>
          <button className="options-modal-close" title="Close (Esc)" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="options-modal-body">
          <h2 className="options-heading">Account</h2>
          <p className="editor-hint">Logged in as {username}</p>
          <div>
            <button
              disabled={loggingOut}
              onClick={() => {
                setLoggingOut(true)
                void onLogout().finally(() => setLoggingOut(false))
              }}
            >
              Log out
            </button>
          </div>

          <h2 className="options-heading">Sprite style</h2>
          <div className="sprite-style-grid">
            {SPRITE_STYLES.map((style) => (
              <button
                key={style}
                className={`sprite-style-option ${style === spriteStyle ? 'sprite-style-selected' : ''}`}
                onClick={() => onChangeSpriteStyle(style)}
              >
                <img
                  className="sprite-style-preview"
                  src={spriteUrl(style, 'front', PREVIEW_SPECIES_ID)}
                  alt={SPRITE_STYLE_LABELS[style]}
                />
                <span>{SPRITE_STYLE_LABELS[style]}</span>
              </button>
            ))}
          </div>

          <BackgroundSection background={background} onChange={onChangeBackground} />

          <UpdatesSection />
        </div>

        <div className="editor-actions">
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default Options
