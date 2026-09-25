import { useEffect, useRef, useState } from 'react'
import type { UpdateCheckResult, UpdateProgress } from '../../shared/battle-types'

function megabytes(bytes: number): string {
  return `${Math.round(bytes / 1048576)} MB`
}

// Options → Updates: checks the GitHub repo's latest release and, in the packaged
// game, downloads and installs it (see src/main/updater.ts). Player saves are kept;
// the shared game data comes from the new version.
function UpdatesSection(): React.JSX.Element {
  const [check, setCheck] = useState<UpdateCheckResult | null>(null)
  const [checking, setChecking] = useState(false)
  const [progress, setProgress] = useState<UpdateProgress | null>(null)
  const [installing, setInstalling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => window.api.onUpdateProgress(setProgress), [])

  // Keeps the update box in sight as it changes - the notes can push the button, the
  // progress bar or an error past the bottom of the window, where an update in
  // progress looked like nothing was happening at all.
  const panelRef = useRef<HTMLDivElement>(null)
  const phase = progress?.phase ?? null
  useEffect(() => {
    panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [check?.available, installing, phase, error])

  async function runCheck(): Promise<void> {
    setChecking(true)
    setError(null)
    try {
      setCheck(await window.api.checkForUpdate())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setChecking(false)
    }
  }

  async function install(): Promise<void> {
    setInstalling(true)
    setError(null)
    try {
      await window.api.installUpdate()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setInstalling(false)
      setProgress(null)
    }
  }

  const percent = progress && progress.total > 0 ? Math.round((progress.received / progress.total) * 100) : 0

  return (
    <div ref={panelRef}>
      <h2 className="options-heading">Updates</h2>
      <p className="editor-hint">
        Version {check?.current ?? '…'} - your saves are kept when updating; trainers and other game data come from
        the new version.
      </p>
      <div className="update-row">
        <button disabled={checking || installing} onClick={() => void runCheck()}>
          {checking ? 'Checking…' : 'Check for updates'}
        </button>
        {check && !check.available && (
          <span className="editor-hint">
            {check.latest ? `Up to date (latest is ${check.latest})` : 'No releases have been published yet'}
          </span>
        )}
      </div>
      {check?.available && (
        <div className="update-available">
          <div>
            Version <strong>{check.latest}</strong> is available ({megabytes(check.sizeBytes)}).
          </div>
          {check.notes && <pre className="update-notes">{check.notes}</pre>}
          {check.canInstall ? (
            <button disabled={installing} onClick={() => void install()}>
              {installing ? 'Updating…' : 'Update now'}
            </button>
          ) : (
            <p className="editor-hint">This is the development copy - update it with git instead.</p>
          )}
          {progress && (
            <div className="update-progress">
              <div className="hp-bar-track">
                <div className="hp-bar-fill hp-high" style={{ width: `${progress.phase === 'downloading' ? percent : 100}%` }} />
              </div>
              <span className="editor-hint">
                {progress.phase === 'downloading' && `Downloading… ${megabytes(progress.received)} of ${megabytes(progress.total)}`}
                {progress.phase === 'unpacking' && 'Unpacking…'}
                {progress.phase === 'restarting' && 'Installing - the game will close and reopen in a moment…'}
              </span>
            </div>
          )}
        </div>
      )}
      {error && <p className="editor-error">{error}</p>}
    </div>
  )
}

export default UpdatesSection
