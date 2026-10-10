import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import CloudSavesSection from './CloudSavesSection'
import SaveFileSection from './SaveFileSection'
import SaveTransferSection from './SaveTransferSection'
import { IS_MOBILE } from './platform'

/**
 * Options → Saves: every way to move or back up this player's save, grouped by where it
 * works - PC & phone (send by room code, save file) and PC only (Google Drive backup).
 */
function SavesModal({ onClose }: { onClose: () => void }): React.JSX.Element {
  // Esc closes just this window, not the Options under it.
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
      <div className="modal-panel options-modal saves-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="options-modal-header">
          <h2>Saves</h2>
          <button className="options-modal-close" data-sfx="close" title="Close (Esc)" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="options-modal-body">
          <section className="options-section">
            <h2 className="options-heading">PC &amp; phone</h2>
            <SaveTransferSection />
            <SaveFileSection />
          </section>

          {!IS_MOBILE && (
            <section className="options-section">
              <h2 className="options-heading">PC only</h2>
              <CloudSavesSection />
            </section>
          )}
        </div>

        <div className="editor-actions">
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default SavesModal
