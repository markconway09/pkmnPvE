import { useEffect, useState } from 'react'
import { ROOM_CODE_LENGTH } from '../../shared/online'
import { RUN_DIFFICULTIES, runDifficultyInfo, type RunDifficulty, type RunView } from '../../shared/battle-types'
import {
  clearOnlineError,
  getOnlineState,
  hostRoom,
  joinRoom,
  leaveRoom,
  resumeCoopRun,
  startCoopRun,
  startOnlineBattle,
  startOnlineDraft,
  subscribeOnline,
  type OnlineState
} from './online'
import { clickWord, t } from './i18n'
import { trainerSpriteUrl } from './trainerSprite'
import DraftPanel from './DraftPanel'

interface Props {
  // No team (or another fight starting): no hosting a battle.
  disabled: boolean
}

/**
 * Online battle, as a small section of the Classic page: host a room and give a friend
 * its code, or join theirs. Once both are in, the host starts the battle.
 */
function OnlineSection({ disabled }: Props): React.JSX.Element {
  const [online, setOnline] = useState<OnlineState>(getOnlineState)
  const [code, setCode] = useState('')
  const [doubles, setDoubles] = useState(false)
  const [stars, setStars] = useState(false)
  const [copied, setCopied] = useState(false)
  // Co-op Battle Tower, for the host: the settings for a new run, the generations a run can
  // be set to, and the host's own saved co-op run (carried on with the same friend).
  const [coopDifficulty, setCoopDifficulty] = useState<RunDifficulty>('normal')
  const [coopGeneration, setCoopGeneration] = useState<number | null>(null)
  const [coopGenerations, setCoopGenerations] = useState<number[]>([])
  const [savedCoop, setSavedCoop] = useState<RunView | null>(null)
  const [confirmingCoopForfeit, setConfirmingCoopForfeit] = useState(false)

  useEffect(() => subscribeOnline(setOnline), [])

  const hostLobby = online.role === 'host' && online.phase === 'lobby' && !online.draft && !online.coop
  useEffect(() => {
    if (!hostLobby) return
    window.api.coopRun
      .getRun()
      .then(setSavedCoop)
      .catch(() => setSavedCoop(null))
    window.api
      .getRunGenerations()
      .then(setCoopGenerations)
      .catch(() => setCoopGenerations([]))
  }, [hostLobby])
  const savedActive = savedCoop?.status === 'active' ? savedCoop : null
  const savedWithFriend = !!savedActive && savedActive.coop?.partnerName === online.friend?.name

  function copyCode(): void {
    if (!online.code) return
    void navigator.clipboard.writeText(online.code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="classic-challenge online-section">
      <div className="classic-section-head">
        <img className="classic-section-icon" src="./icons/nav/challenge.png" alt="" />
        <span className="run-hud-label">{t('online.title')}</span>
        {/* Both teams are set to the level of the higher one's best Pokemon. */}
        <span className="classic-section-sub">{t('online.sub')}</span>
      </div>

      {online.phase === 'idle' && (
        <div className="online-row">
          <button disabled={disabled} onClick={() => void hostRoom()}>
            {t('online.host')}
          </button>
          <span className="online-or">{t('online.or')}</span>
          <form
            className="online-join"
            onSubmit={(e) => {
              e.preventDefault()
              void joinRoom(code)
            }}
          >
            <input
              type="text"
              placeholder={t('online.roomCode')}
              value={code}
              maxLength={ROOM_CODE_LENGTH}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase())
                clearOnlineError()
              }}
            />
            <button type="submit" disabled={disabled || code.trim().length !== ROOM_CODE_LENGTH}>
              {t('online.join')}
            </button>
          </form>
        </div>
      )}

      {online.phase === 'connecting' && (
        <div className="online-row">
          <span className="online-status">{online.role === 'host' ? t('online.opening') : t('online.joining', { code: online.code ?? '' })}</span>
          <button onClick={leaveRoom}>{t('common.cancel')}</button>
        </div>
      )}

      {online.phase === 'waiting' && (
        <div className="online-row">
          <span className="online-status">{t('online.roomCode')}</span>
          <button className="online-code" title={t('online.copyTip')} onClick={copyCode}>
            {online.code}
          </button>
          <span className="online-status">{copied ? t('online.copied') : t('online.giveCode')}</span>
          <button className="online-leave" onClick={leaveRoom}>
            {t('online.closeRoom')}
          </button>
        </div>
      )}

      {(online.phase === 'lobby' || online.phase === 'battle') && online.friend && (
        <div className="online-row online-lobby">
          {/* Who's in the room, and the way out. */}
          <div className="online-lobby-head">
            <img className="online-friend-sprite" src={trainerSpriteUrl(online.friend.spriteId)} alt="" />
            <span className="online-friend-name">{online.friend.name}</span>
            {online.draft ? (
              <span className="online-status">{t('online.draft')}</span>
            ) : online.coop ? (
              <span className="online-status">{t('online.coop')}</span>
            ) : (
              online.role !== 'host' && (
                <span className="online-status">{t('online.waitingHost', { name: online.friend.name })}</span>
              )
            )}
            <button className="online-leave" onClick={leaveRoom}>
              {t('online.leave')}
            </button>
          </div>
          {/* Host: the two games, one per line - a battle with its own options, or a chaos draft. */}
          {!online.draft && !online.coop && online.role === 'host' && (
            <>
              <div className="online-mode">
                <span className="online-mode-text">
                  <strong>{t('online.battle')}</strong>
                  <span>{t('online.currentTeams')}</span>
                </span>
                <span className="online-mode-options">
                  <label className="challenge-doubles">
                    <input type="checkbox" checked={doubles} onChange={(e) => setDoubles(e.target.checked)} /> {t('online.doubles')}
                  </label>
                  {/* Merge stars: each team member's +10% stats per star, on both sides. */}
                  <label className="challenge-doubles" title={t('online.starsTip')}>
                    <input type="checkbox" checked={stars} onChange={(e) => setStars(e.target.checked)} /> {t('online.stars')}
                  </label>
                </span>
                <button
                  className="online-start"
                  disabled={disabled || online.starting || online.phase !== 'lobby'}
                  onClick={() => startOnlineBattle(doubles, stars)}
                >
                  {online.starting ? t('online.starting') : t('online.startBattle')}
                </button>
              </div>
              {/* A game of its own: the doubles and stars options don't apply to it. */}
              <div className="online-mode">
                <span className="online-mode-text">
                  <strong>{t('online.draft')}</strong>
                  <span>{t('online.draftHint')}</span>
                </span>
                <button
                  className="online-start online-draft-start"
                  disabled={online.starting || online.phase !== 'lobby'}
                  onClick={() => void startOnlineDraft()}
                >
                  {t('online.startDraft')}
                </button>
              </div>
              {/* Co-op Battle Tower: carry on the run saved with this friend, or start one. */}
              <div className="online-mode">
                <span className="online-mode-text">
                  <strong>{t('online.coop')}</strong>
                  <span>
                    {savedWithFriend && savedActive
                      ? t('online.carryOn', { floor: savedActive.floor, difficulty: runDifficultyInfo(savedActive.difficulty).label })
                      : savedActive
                        ? t('online.otherRun', { name: savedActive.coop?.partnerName ?? t('online.someoneElse') })
                        : t('online.coopHint')}
                  </span>
                </span>
                {!savedActive && (
                  <span className="online-mode-options">
                    <select
                      className="coop-select"
                      value={coopDifficulty}
                      title={t('online.difficulty')}
                      onChange={(e) => setCoopDifficulty(e.target.value as RunDifficulty)}
                    >
                      {RUN_DIFFICULTIES.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                    <select
                      className="coop-select"
                      value={coopGeneration ?? ''}
                      title={t('online.genTip')}
                      onChange={(e) => setCoopGeneration(e.target.value ? Number(e.target.value) : null)}
                    >
                      <option value="">{t('online.anyGen')}</option>
                      {coopGenerations.map((g) => (
                        <option key={g} value={g}>
                          {t('online.gen', { n: g })}
                        </option>
                      ))}
                    </select>
                  </span>
                )}
                {savedActive && !savedWithFriend ? (
                  // Another friend's run: given up (a loss, with its rewards) before a new one.
                  <button
                    className={`online-start${confirmingCoopForfeit ? ' confirm-button' : ''}`}
                    disabled={online.starting}
                    onBlur={() => setConfirmingCoopForfeit(false)}
                    onClick={() => {
                      if (!confirmingCoopForfeit) {
                        setConfirmingCoopForfeit(true)
                        return
                      }
                      setConfirmingCoopForfeit(false)
                      window.api.coopRun
                        .forfeitRun()
                        .then(setSavedCoop)
                        .catch(() => {})
                    }}
                  >
                    {confirmingCoopForfeit ? t('online.giveUp', { click: clickWord() }) : t('online.forfeit')}
                  </button>
                ) : (
                  <button
                    className="online-start online-coop-start"
                    disabled={online.starting || online.phase !== 'lobby'}
                    onClick={() => {
                      if (savedWithFriend && savedActive) void resumeCoopRun(savedActive)
                      else startCoopRun(coopDifficulty, coopGeneration)
                    }}
                  >
                    {savedWithFriend ? t('online.continue') : t('online.startCoop')}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {online.error && <p className="editor-error">{online.error}</p>}

      {/* The chaos draft itself, between its battles. */}
      {online.draft && online.friend && online.phase === 'lobby' && (
        <DraftPanel
          busy={online.starting}
          onBattle={async () => {}}
          online={{ ...online.draft, friendName: online.friend.name }}
        />
      )}
    </div>
  )
}

export default OnlineSection
