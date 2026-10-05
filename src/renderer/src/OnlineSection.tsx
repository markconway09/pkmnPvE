import { useEffect, useState } from 'react'
import { ROOM_CODE_LENGTH } from '../../shared/online'
import {
  clearOnlineError,
  getOnlineState,
  hostRoom,
  joinRoom,
  leaveRoom,
  startOnlineBattle,
  subscribeOnline,
  type OnlineState
} from './online'
import { trainerSpriteUrl } from './trainerSprite'

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
        <div className="online-row">
          <img className="online-friend-sprite" src={trainerSpriteUrl(online.friend.spriteId)} alt="" />
          <span className="online-friend-name">{online.friend.name}</span>
          {online.role === 'host' ? (
            <>
              <label className="challenge-doubles">
                <input type="checkbox" checked={doubles} onChange={(e) => setDoubles(e.target.checked)} /> Double battle
              </label>
              {/* Merge stars: each team member's +10% stats per star, on both sides. */}
              <label className="challenge-doubles" title="Both teams get their merge star stat boosts">
                <input type="checkbox" checked={stars} onChange={(e) => setStars(e.target.checked)} /> Use stars
              </label>
              <button
                className="online-start"
                disabled={disabled || online.starting || online.phase !== 'lobby'}
                onClick={() => startOnlineBattle(doubles, stars)}
              >
                {online.starting ? 'Starting...' : 'Start battle'}
              </button>
            </>
          ) : (
            <span className="online-status">Waiting for {online.friend.name} to start the battle...</span>
          )}
          <button className="online-leave" onClick={leaveRoom}>
            Leave
          </button>
        </div>
      )}

      {online.error && <p className="editor-error">{online.error}</p>}
    </div>
  )
}

export default OnlineSection
