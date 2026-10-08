import { useEffect, useState } from 'react'
import { ROOM_CODE_LENGTH } from '../../shared/online'
import {
  clearOnlineError,
  getOnlineState,
  hostRoom,
  joinRoom,
  leaveRoom,
  startOnlineBattle,
  startOnlineDraft,
  subscribeOnline,
  type OnlineState
} from './online'
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

  useEffect(() => subscribeOnline(setOnline), [])

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
        <span className="run-hud-label">Online battle</span>
        {/* Both teams are set to the level of the higher one's best Pokemon. */}
        <span className="classic-section-sub">Battle a friend · no exp, money or drops</span>
      </div>

      {online.phase === 'idle' && (
        <div className="online-row">
          <button disabled={disabled} onClick={() => void hostRoom()}>
            Host a room
          </button>
          <span className="online-or">or</span>
          <form
            className="online-join"
            onSubmit={(e) => {
              e.preventDefault()
              void joinRoom(code)
            }}
          >
            <input
              type="text"
              placeholder="Room code"
              value={code}
              maxLength={ROOM_CODE_LENGTH}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase())
                clearOnlineError()
              }}
            />
            <button type="submit" disabled={disabled || code.trim().length !== ROOM_CODE_LENGTH}>
              Join
            </button>
          </form>
        </div>
      )}

      {online.phase === 'connecting' && (
        <div className="online-row">
          <span className="online-status">{online.role === 'host' ? 'Opening a room...' : `Joining room ${online.code}...`}</span>
          <button onClick={leaveRoom}>Cancel</button>
        </div>
      )}

      {online.phase === 'waiting' && (
        <div className="online-row">
          <span className="online-status">Room code</span>
          <button className="online-code" title="Copy the code" onClick={copyCode}>
            {online.code}
          </button>
          <span className="online-status">{copied ? 'Copied!' : 'Give it to your friend - waiting for them to join...'}</span>
          <button className="online-leave" onClick={leaveRoom}>
            Close room
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
              <span className="online-status">Chaos draft</span>
            ) : (
              online.role !== 'host' && (
                <span className="online-status">Waiting for {online.friend.name} to start a battle or a chaos draft...</span>
              )
            )}
            <button className="online-leave" onClick={leaveRoom}>
              Leave
            </button>
          </div>
          {/* Host: the two games, one per line - a battle with its own options, or a chaos draft. */}
          {!online.draft && online.role === 'host' && (
            <>
              <div className="online-mode">
                <span className="online-mode-text">
                  <strong>Battle</strong>
                  <span>Your current teams</span>
                </span>
                <span className="online-mode-options">
                  <label className="challenge-doubles">
                    <input type="checkbox" checked={doubles} onChange={(e) => setDoubles(e.target.checked)} /> Double battle
                  </label>
                  {/* Merge stars: each team member's +10% stats per star, on both sides. */}
                  <label className="challenge-doubles" title="Both teams get their merge star stat boosts">
                    <input type="checkbox" checked={stars} onChange={(e) => setStars(e.target.checked)} /> Use stars
                  </label>
                </span>
                <button
                  className="online-start"
                  disabled={disabled || online.starting || online.phase !== 'lobby'}
                  onClick={() => startOnlineBattle(doubles, stars)}
                >
                  {online.starting ? 'Starting...' : 'Start battle'}
                </button>
              </div>
              {/* A game of its own: the doubles and stars options don't apply to it. */}
              <div className="online-mode">
                <span className="online-mode-text">
                  <strong>Chaos draft</strong>
                  <span>Both draft a chaos team at the same time, then battle - first to 4 wins</span>
                </span>
                <button
                  className="online-start online-draft-start"
                  disabled={online.starting || online.phase !== 'lobby'}
                  onClick={() => void startOnlineDraft()}
                >
                  Start draft
                </button>
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
