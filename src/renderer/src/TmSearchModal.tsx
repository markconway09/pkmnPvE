import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { RarityTier, WildLocationConfig, WildLocationId } from '../../shared/battle-types'
import type { TmSearchProgress, TmSearchStart } from '../../shared/tms'
import { SkillCheckRing, type SkillCheckResult } from './SkillCheck'
import { TmFindCard } from './TmBits'
import { locationIconUrl } from './battleScenery'
import { IS_MOBILE } from './platform'
import { TIER_LABELS } from './RarityOddsTooltip'
import { t } from './i18n'

// The wait before each check pops up, so it can't be timed in advance.
const MIN_GAP_MS = 700
const MAX_GAP_MS = 1900

interface Props {
  location: WildLocationConfig
  // The search is over (found, given up or not started) - the TM counts need refreshing.
  onClose: () => void
  // Too many misses: a wild Pokemon heard - fight it.
  onAmbush: (location: WildLocationId) => void
}

/**
 * A TM search in one area: a few skill checks popping up at random moments, filling the
 * bar. The ring's colour is the rarity of the TM hidden there - rarer ones take more
 * checks, with a smaller zone and a faster needle. A miss knocks the bar back and makes
 * noise; too many and a wild Pokemon jumps out. Every check a Great: one rarity higher.
 */
function TmSearchModal({ location, onClose, onAmbush }: Props): React.JSX.Element {
  const [start, setStart] = useState<TmSearchStart | null>(null)
  const [progress, setProgress] = useState<TmSearchProgress | null>(null)
  const [runKey, setRunKey] = useState(0)
  const [waiting, setWaiting] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<number | undefined>(undefined)
  const startedRef = useRef(false)

  const queueCheck = useCallback(() => {
    setWaiting(true)
    timerRef.current = window.setTimeout(() => {
      setWaiting(false)
      setRunKey((k) => k + 1)
    }, MIN_GAP_MS + Math.random() * (MAX_GAP_MS - MIN_GAP_MS))
  }, [])

  useEffect(() => {
    // Only once, even under React's double-run in development - each start spends a charge.
    if (startedRef.current) return
    startedRef.current = true
    window.api
      .startTmSearch(location.id)
      .then((s) => {
        setStart(s)
        queueCheck()
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [location.id, queueCheck])

  useEffect(() => () => window.clearTimeout(timerRef.current), [])

  const done = !!progress?.done
  const running = !!start && !done && !error

  function onDone(result: SkillCheckResult, timedOut: boolean): void {
    window.api
      .reportTmSearchCheck(result, timedOut)
      .then((p) => {
        setProgress(p)
        if (!p.done) queueCheck()
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }

  // Leaving mid-search gives it up - its charge stays spent.
  const leave = useCallback(() => {
    window.clearTimeout(timerRef.current)
    if (running) void window.api.abandonTmSearch().catch(() => {})
    onClose()
  }, [running, onClose])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') leave()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [leave])

  const needed = start?.checks ?? 0
  const filled = progress?.progress ?? 0
  const misses = progress?.misses ?? 0

  return createPortal(
    <div className="modal-overlay">
      <div className={`modal-panel tm-search-panel${start ? ` rarity-tier-${start.tier}` : ''}`}>
        <div className="tm-search-head">
          <img className="tm-search-loc-icon" src={locationIconUrl(location.id)} alt="" />
          <span className="tm-search-title">
            {location.id === 'all' ? t('tm.searchingAnywhere') : t('tm.searchingIn', { area: location.label })}
          </span>
        </div>

        {error ? (
          <p className="tm-search-error">{error}</p>
        ) : !start ? (
          <p className="tm-search-note">{t('tm.lookingAround')}</p>
        ) : (
          <>
            <div className="tm-search-tier">
              {t('tm.hiddenPre')}
              <strong>{TIER_LABELS[start.tier]}</strong>
              {t('tm.hiddenPost')}
              {start.pityTriggered && <span className="tm-search-pity">{t('tm.lucky')}</span>}
            </div>

            <div className="tm-search-bar" title={t('tm.checksTip', { n: filled, of: needed })}>
              {Array.from({ length: needed }, (_, i) => (
                <span key={i} className={`tm-search-step${i < filled ? ' tm-search-step-on' : ''}`} />
              ))}
            </div>
            <div className="tm-search-misses" title={t('tm.noiseTip')}>
              {t('tm.noise')}
              {Array.from({ length: start.maxMisses }, (_, i) => (
                <span key={i} className={`tm-search-miss${i < misses ? ' tm-search-miss-on' : ''}`} />
              ))}
            </div>

            {!done && (
              <SkillCheckRing runKey={runKey} settings={start.settings} tier={start.tier} onDone={onDone} idleLabel="..." />
            )}

            {done && progress?.find && <TmFindCard find={progress.find} />}
            {done && progress?.refunded && <p className="tm-search-refund">{t('tm.refunded')}</p>}
            {done && progress?.ambush && <p className="tm-search-ambush">{t('tm.ambush')}</p>}

            {!done && (
              <p className="tm-search-note">
                {waiting ? t('tm.getReady') : IS_MOBILE ? t('tm.tapZone') : t('tm.clickZone')}
              </p>
            )}
          </>
        )}

        <div className="editor-actions">
          {done && progress?.ambush ? (
            <button className="confirm-button" onClick={() => onAmbush(location.id)}>
              {t('tm.fight')}
            </button>
          ) : (
            <button onClick={leave}>{running ? t('tm.giveUp') : t('common.done')}</button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

export default TmSearchModal
