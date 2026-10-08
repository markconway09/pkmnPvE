import { useRef, useState } from 'react'
import { IS_MOBILE } from './platform'

// A gallery picture's longest side once shrunk - a phone photo is far bigger than the screen.
const MAX_SIDE = 1920

/** A picture from the phone's gallery, shrunk and turned into a JPEG data: URL. */
async function shrinkPicture(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("That picture couldn't be opened")
  })
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.85)
}

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
  const galleryRef = useRef<HTMLInputElement>(null)

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
        {IS_MOBILE ? (
          // The phone: a picture from the gallery.
          <>
            <button disabled={busy} onClick={() => galleryRef.current?.click()}>
              Choose from gallery…
            </button>
            <input
              ref={galleryRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) void run(async () => onChange(await window.api.setBackground(await shrinkPicture(file))))
              }}
            />
          </>
        ) : (
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
        )}
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
