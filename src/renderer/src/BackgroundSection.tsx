import { useState } from 'react'

interface Props {
  background: string | null
  onChange: (background: string | null) => void
}

// Options → Background: pick a picture to show behind every screen. It's kept in
// the player's own save folder (see src/main/showdown/background-store.ts), so
// each player has their own and updates leave it alone.
function BackgroundSection({ background, onChange }: Props): React.JSX.Element {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(action: () => Promise<void>): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <h2 className="options-heading">Background</h2>
      <div className="background-option-row">
        <div
          className="background-preview"
          style={background ? { backgroundImage: `url("${background}")` } : undefined}
        >
          {!background && <span>Default</span>}
        </div>
        <button
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const chosen = await window.api.chooseBackground()
              if (chosen) onChange(chosen)
            })
          }
        >
          Choose image…
        </button>
        {background && (
          <button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await window.api.clearBackground()
                onChange(null)
              })
            }
          >
            Reset to default
          </button>
        )}
      </div>
      {error && <p className="editor-hint">{error}</p>}
    </>
  )
}

export default BackgroundSection
