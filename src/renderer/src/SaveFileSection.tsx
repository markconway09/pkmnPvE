import { useRef, useState } from 'react'
import { deviceHooks, saveFileOut } from './deviceHooks'
import { CLICK } from './platform'

function errorText(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e)
  // Drop Electron's "Error invoking remote method ..." wrapper.
  return message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}

/**
 * Options → Saves → Save file: the save as one .pkmnsave file, to carry between the PC and the
 * phone (through the Google Drive app, a cable, a chat...). Importing one replaces the
 * save (backed up first), then reloads the game. A cloud save downloaded from Drive
 * imports the same way.
 */
function SaveFileSection(): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<'export' | 'import' | null>(null)
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null)
  // A file picked, waiting for a second press to confirm replacing the save.
  const [picked, setPicked] = useState<File | null>(null)

  async function exportFile(): Promise<void> {
    setBusy('export')
    setMessage(null)
    try {
      const { name, data } = await window.api.exportSaveFile()
      await saveFileOut(name, data)
    } catch (e) {
      // Closing the phone's share sheet without picking anything isn't a failure.
      if (!/cancel/i.test(errorText(e))) setMessage({ text: errorText(e), bad: true })
    } finally {
      setBusy(null)
    }
  }

  async function importFile(file: File): Promise<void> {
    setBusy('import')
    setMessage(null)
    try {
      await window.api.importSaveFile(new Uint8Array(await file.arrayBuffer()))
      // On the phone the save reaches storage in the background - wait for it first.
      await deviceHooks.flushSaves?.()
      // Everything on screen belongs to the old save - start fresh.
      window.location.reload()
    } catch (e) {
      setMessage({ text: errorText(e), bad: true })
      setPicked(null)
      setBusy(null)
    }
  }

  return (
    <>
      <h3 className="saves-subheading">Save file</h3>
      <p className="editor-hint">
        Move this player&apos;s save between your PC and your phone: export it as a file, put it on the other device
        (the Google Drive app works), and import it there. Importing replaces the current save - it&apos;s backed up
        first.
      </p>
      <div className="cloud-actions">
        <button disabled={!!busy} onClick={() => void exportFile()}>
          {busy === 'export' ? 'Exporting…' : 'Export to file'}
        </button>
        {picked ? (
          <>
            <button className="cloud-confirm" disabled={!!busy} onClick={() => void importFile(picked)}>
              {busy === 'import' ? 'Importing…' : `Replace current save? ${CLICK} again`}
            </button>
            <button disabled={!!busy} onClick={() => setPicked(null)}>
              Cancel
            </button>
          </>
        ) : (
          <button disabled={!!busy} onClick={() => inputRef.current?.click()}>
            Import from file…
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          // The phone's file picker greys out a type it doesn't know, so it takes any file there.
          accept={deviceHooks.shareFile ? undefined : '.pkmnsave'}
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) setPicked(file)
          }}
        />
      </div>
      {picked && !busy && <p className="editor-hint">{picked.name}</p>}
      {message && <p className={message.bad ? 'editor-error' : 'cloud-message'}>{message.text}</p>}
    </>
  )
}

export default SaveFileSection
