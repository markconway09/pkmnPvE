import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import SaveFileSection from './SaveFileSection'
import { t } from './i18n'
import SaveTransferSection from './SaveTransferSection'

/**
 * Options → Saves: every way to move or back up this player's save, grouped by where it
 * works on the PC and the phone alike: send by room code, or a save file.
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
          <h2>{t('saves.title')}</h2>
          <button className="options-modal-close" data-sfx="close" title={t('common.closeEsc')} onClick={onClose}>
            ×
          </button>
        </div>
        <div className="options-modal-body">
          <section className="options-section">
            <h2 className="options-heading">{t('saves.pcPhone')}</h2>
            <SaveTransferSection />
            <SaveFileSection />
          </section>
        </div>

        <div className="editor-actions">
          <button onClick={onClose}>{t('common.close')}</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default SavesModal
