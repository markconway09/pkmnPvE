import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { FOSSIL_RESTORE_COST } from '../../shared/battle-types'
import type { BagItemView, GalarFossilPartner, RestoreFossilResult } from '../../shared/battle-types'
import ItemSprite from './ItemSprite'
import { formatMoney } from './money'
import ModalSpinner from './ModalSpinner'
import { itemName, t } from './i18n'

interface Props {
  fossil: BagItemView
  money: number
  onClose: () => void
  onRestored: (result: RestoreFossilResult) => void
}

// The Galar fossils are only half a Pokemon each, so restoring one means
// choosing which other fossil to join it with - the pair decides the result.
function GalarFossilPrompt({ fossil, money, onClose, onRestored }: Props): React.JSX.Element {
  const [partners, setPartners] = useState<GalarFossilPartner[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.api
      .getGalarFossilPartners(fossil.id)
      .then(setPartners)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [fossil.id])

  const selected = partners?.find((p) => p.itemId === selectedId)
  const canAfford = money >= FOSSIL_RESTORE_COST
  const anyOwned = partners?.some((p) => p.quantity > 0) ?? false

  async function restore(): Promise<void> {
    if (!selected) return
    setBusy(true)
    setError(null)
    try {
      onRestored(await window.api.restoreFossil(fossil.id, selected.itemId))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return createPortal(
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-panel galar-prompt" onMouseDown={(e) => e.stopPropagation()}>
        <h2>{t('fossil.restore', { name: itemName(fossil.name) })}</h2>
        <p className="box-empty-hint">{t('fossil.half')}</p>

        {!partners && !error && <ModalSpinner />}
        {partners && (
          <div className="galar-partner-list">
            {partners.map((p) => (
              <button
                key={p.itemId}
                type="button"
                className={`galar-partner ${p.itemId === selectedId ? 'galar-partner-selected' : ''}`}
                disabled={p.quantity === 0 || busy}
                onClick={() => setSelectedId(p.itemId)}
              >
                <ItemSprite spritenum={p.spritenum} className="bag-item-icon" />
                <span className="galar-partner-name">{itemName(p.itemName)}</span>
                <span className="galar-partner-result">→ {p.species}</span>
                <span className="galar-partner-qty">{p.quantity > 0 ? `x${p.quantity}` : t('fossil.notOwned')}</span>
              </button>
            ))}
          </div>
        )}
        {partners && !anyOwned && <p className="editor-error">{t('fossil.noPartner')}</p>}
        {!canAfford && <p className="editor-error">{t('fossil.cantAfford', { money: formatMoney(FOSSIL_RESTORE_COST) })}</p>}
        {error && <p className="editor-error">{error}</p>}

        <div className="editor-actions">
          <button onClick={onClose}>{t('common.cancel')}</button>
          <button disabled={!selected || !canAfford || busy} onClick={() => void restore()}>
            {selected
              ? t('fossil.restoreAs', { name: selected.species, money: formatMoney(FOSSIL_RESTORE_COST) })
              : t('fossil.restoreCost', { money: formatMoney(FOSSIL_RESTORE_COST) })}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default GalarFossilPrompt
