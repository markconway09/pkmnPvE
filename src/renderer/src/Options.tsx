import { useState } from 'react'
import { SPRITE_STYLES, SPRITE_STYLE_LABELS, spriteUrl, type SpriteStyle } from './spriteStyle'
import UpdatesSection from './UpdatesSection'

interface Props {
  username: string
  onLogout: () => Promise<void>
  spriteStyle: SpriteStyle
  onChangeSpriteStyle: (style: SpriteStyle) => void
  onBack: () => void
}

const PREVIEW_SPECIES_ID = 'pikachu'

function Options({ username, onLogout, spriteStyle, onChangeSpriteStyle, onBack }: Props): React.JSX.Element {
  const [loggingOut, setLoggingOut] = useState(false)

  return (
    <div className="screen">
      <h1>Options</h1>

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

      <UpdatesSection />

      <button onClick={onBack}>Back</button>
    </div>
  )
}

export default Options
