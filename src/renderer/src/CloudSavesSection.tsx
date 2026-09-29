import { useEffect, useState } from 'react'
import type { CloudSave, CloudStatus } from '../../shared/cloud'
import { formatMoney } from './money'

function errorText(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e)
  // Drop Electron's "Error invoking remote method ..." wrapper.
  return message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

/**
 * Options → Cloud saves: connect this player's Google Drive, export the save there, and
 * bring one back. Importing replaces the save (backed up first), then reloads the game.
 */
function CloudSavesSection(): React.JSX.Element | null {
  const [status, setStatus] = useState<CloudStatus | null>(null)
  const [saves, setSaves] = useState<CloudSave[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null)
  // The save waiting for a second click to confirm the import.
  const [confirming, setConfirming] = useState<string | null>(null)

  useEffect(() => {
    window.api
      .getCloudStatus()
      .then(setStatus)
      .catch(() => setStatus(null))
  }, [])

  // The list loads once connected.
  useEffect(() => {
    if (!status?.connected) return
    window.api
      .listCloudSaves()
      .then(setSaves)
      .catch((e) => setMessage({ text: errorText(e), bad: true }))
  }, [status?.connected])

  async function run(label: string, action: () => Promise<void>): Promise<void> {
    setBusy(label)
    setMessage(null)
    try {
      await action()
    } catch (e) {
      setMessage({ text: errorText(e), bad: true })
      // A lost connection shows as disconnected.
      window.api.getCloudStatus().then(setStatus).catch(() => {})
    } finally {
      setBusy(null)
    }
  }

  if (!status || !status.available) return null

  return (
    <>
      <h2 className="options-heading">Cloud saves</h2>
      {!status.connected ? (
        <>
          <p className="editor-hint">
            Keep a copy of this player&apos;s save in your Google Drive, and bring it back on any computer. Only this
            game&apos;s own hidden folder is used - nothing else in your Drive is touched.
          </p>
          <div>
            <button
              disabled={!!busy}
              onClick={() =>
                void run('connect', async () => {
                  setStatus(await window.api.connectCloud())
                  setMessage({ text: 'Google Drive connected', bad: false })
                })
              }
            >
              {busy === 'connect' ? 'Waiting for Google sign-in in your browser…' : 'Connect Google Drive'}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="editor-hint">Connected{status.email ? ` as ${status.email}` : ''} - the last 5 exports are kept.</p>
          <div className="cloud-actions">
            <button
              disabled={!!busy}
              onClick={() =>
                void run('export', async () => {
                  setSaves(await window.api.exportToCloud())
                  setMessage({ text: 'Save exported to Google Drive', bad: false })
                })
              }
            >
              {busy === 'export' ? 'Exporting…' : '☁ Export save'}
            </button>
            <button
              disabled={!!busy}
              onClick={() =>
                void run('disconnect', async () => {
                  setStatus(await window.api.disconnectCloud())
                  setSaves(null)
                })
              }
            >
              Disconnect
            </button>
          </div>
          {saves && saves.length === 0 && <p className="editor-hint">No saves in the cloud yet.</p>}
          {saves && saves.length > 0 && (
            <div className="cloud-save-list">
              {saves.map((save) => (
                <div key={save.id} className="cloud-save">
                  <div className="cloud-save-info">
                    <span className="cloud-save-date">{formatDate(save.createdAt)}</span>
                    <span className="cloud-save-detail">
                      {save.pokemon !== null && `${save.pokemon} Pokémon`}
                      {save.money !== null && ` · ${formatMoney(save.money)}`}
                      {save.appVersion && ` · v${save.appVersion}`}
                    </span>
                  </div>
                  <button
                    className={confirming === save.id ? 'cloud-confirm' : undefined}
                    disabled={!!busy}
                    title="Replace your current save with this one (your current save is backed up first)"
                    onClick={() => {
                      if (confirming !== save.id) {
                        setConfirming(save.id)
                        return
                      }
                      void run('import', async () => {
                        await window.api.importFromCloud(save.id)
                        // Everything on screen belongs to the old save - start fresh.
                        window.location.reload()
                      })
                    }}
                  >
                    {busy === 'import' && confirming === save.id
                      ? 'Importing…'
                      : confirming === save.id
                        ? 'Replace current save? Click again'
                        : 'Import'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {message && <p className={message.bad ? 'editor-error' : 'cloud-message'}>{message.text}</p>}
    </>
  )
}

export default CloudSavesSection
