import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { BossRematchInfo } from '../../shared/battle-types'
import { trainerSpriteUrl } from './trainerSprite'
import { t } from './i18n'

interface Props {
  onRematch: (trainerId: string) => void
  onClose: () => void
}

// Boss Battle once every boss is beaten: every boss in order, to fight again. A boss
// not beaten yet (if the boss order grows later) is shown locked.
function BossRematchModal({ onRematch, onClose }: Props): React.JSX.Element {
  const [bosses, setBosses] = useState<BossRematchInfo[] | null>(null)

  useEffect(() => {
    window.api
      .getBossRematchList()
      .then(setBosses)
      .catch(() => setBosses([]))
  }, [])

  return createPortal(
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-panel boss-rematch-modal" onMouseDown={(e) => e.stopPropagation()}>
        <h2>{t('rematch.title')}</h2>
        <div className="boss-rematch-grid">
          {(bosses ?? []).map((boss) => (
            <button
              key={boss.number}
              className="boss-rematch-cell"
              disabled={!boss.defeated}
              title={boss.defeated ? t('rematch.fight', { name: boss.trainerName }) : t('rematch.notYet')}
              onClick={() => onRematch(boss.trainerId)}
            >
              <span className="boss-rematch-number">#{boss.number}</span>
              <img className="boss-rematch-sprite" src={trainerSpriteUrl(boss.spriteId || 'giovanni')} alt="" />
              <span className="boss-rematch-name">{boss.trainerName}</span>
            </button>
          ))}
          {bosses && bosses.length === 0 && <p className="box-empty-hint">{t('rematch.none')}</p>}
        </div>
        <div className="editor-actions">
          <button onClick={onClose}>{t('common.close')}</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default BossRematchModal
