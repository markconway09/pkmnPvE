import { useEffect, useRef, useState } from 'react'
import type { UpdateCheckResult, UpdateProgress } from '../../shared/battle-types'
import { IS_MOBILE } from './platform'
import { useT } from './i18n'

function megabytes(bytes: number): string {
  return `${Math.round(bytes / 1048576)} MB`
}

// Options → Updates: checks the GitHub repo's latest release and, in the packaged
// game, downloads and installs it (see src/main/updater.ts). Player saves are kept;
// the shared game data comes from the new version. On the phone the APK can't replace
// itself, so "Update now" opens the new APK in the browser instead; installing it over
// this copy keeps the saves, since every APK is signed with the same key.
function UpdatesSection(): React.JSX.Element {
  const t = useT()
  const [check, setCheck] = useState<UpdateCheckResult | null>(null)
  const [checking, setChecking] = useState(false)
  const [progress, setProgress] = useState<UpdateProgress | null>(null)
  const [installing, setInstalling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => window.api.onUpdateProgress(setProgress), [])

  // Checks straight away whenever Options opens - the button is there to check again.
  useEffect(() => {
    void runCheck()
  }, [])

  // Keeps the update box in sight as it changes - the notes can push the button, the
  // progress bar or an error out of view, where an update in progress looked like
  // nothing was happening at all.
  const panelRef = useRef<HTMLDivElement>(null)
  const phase = progress?.phase ?? null
  useEffect(() => {
    panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
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
  // The "is available" line, split around the version so it can be shown in bold.
  const [availableBefore, availableAfter] = check?.available
    ? t('updates.available', { version: '\u0000', size: megabytes(check.sizeBytes) }).split('\u0000')
    : ['', '']

  return (
    <div ref={panelRef}>
      <h2 className="options-heading">{t('updates.title')}</h2>
      <p className="editor-hint">{t('updates.version', { version: check?.current ?? '…' })}</p>
      <div className="update-row">
        <button disabled={checking || installing} onClick={() => void runCheck()}>
          {checking ? t('updates.checking') : t('updates.check')}
        </button>
        {check && !check.available && (
          <span className="editor-hint">
            {check.latest ? t('updates.upToDate', { version: check.latest }) : t('updates.noReleases')}
          </span>
        )}
      </div>
      {check?.available && (
        <div className="update-available">
          <div>
            {availableBefore}
            <strong>{check.latest}</strong>
            {availableAfter}
          </div>
          {check.notes && <pre className="update-notes">{check.notes}</pre>}
          {check.canInstall && IS_MOBILE ? (
            <>
              <button onClick={() => check.downloadUrl && window.open(check.downloadUrl, '_blank')}>
                {t('updates.download')}
              </button>
              <p className="editor-hint">{t('updates.downloadHint')}</p>
            </>
          ) : check.canInstall ? (
            <button disabled={installing} onClick={() => void install()}>
              {installing ? t('updates.updating') : t('updates.now')}
            </button>
          ) : (
            <p className="editor-hint">{IS_MOBILE ? t('updates.browserCopy') : t('updates.devCopy')}</p>
          )}
          {progress && (
            <div className="update-progress">
              <div className="hp-bar-track">
                <div className="hp-bar-fill hp-high" style={{ width: `${progress.phase === 'downloading' ? percent : 100}%` }} />
              </div>
              <span className="editor-hint">
                {progress.phase === 'downloading' &&
                  t('updates.downloading', { received: megabytes(progress.received), total: megabytes(progress.total) })}
                {progress.phase === 'unpacking' && t('updates.unpacking')}
                {progress.phase === 'restarting' && t('updates.restarting')}
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
