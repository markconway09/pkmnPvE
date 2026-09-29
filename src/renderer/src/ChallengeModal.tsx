import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { MAX_USERNAME_LENGTH } from '../../shared/battle-types'

interface Props {
  // Starts a fight against another player's saved team; rejects with why it couldn't.
  onChallengePlayer: (username: string, doubles: boolean) => Promise<void>
  onClose: () => void
}

/** Challenge a player: a friendly fight against the team another player on this computer last saved. */
function ChallengeModal({ onChallengePlayer, onClose }: Props): React.JSX.Element {
  const [opponent, setOpponent] = useState('')
  const [players, setPlayers] = useState<string[]>([])
  const [doubles, setDoubles] = useState(false)
  const [challenging, setChallenging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.api
      .getSession()
      .then((session) => setPlayers(session.players.filter((p) => p !== session.username)))
      .catch(() => {})
  }, [])

  async function challenge(): Promise<void> {
    if (challenging || !opponent.trim()) return
    setChallenging(true)
    setError(null)
    try {
      await onChallengePlayer(opponent, doubles)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setChallenging(false)
    }
  }

  return createPortal(
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-panel challenge-modal" onMouseDown={(e) => e.stopPropagation()}>
        <h2>Challenge a player</h2>
        <p className="editor-hint">
          Fight the team another player on this computer last saved. It&apos;s a friendly match: their whole team is set
          to the level of your highest-level Pokemon, and there are no exp, money or item drops.
        </p>
        <form
          className="trainer-add-row challenge-row"
          onSubmit={(e) => {
            e.preventDefault()
            void challenge()
          }}
        >
          <input
            type="text"
            list="challenge-players"
            placeholder="Their username"
            value={opponent}
            maxLength={MAX_USERNAME_LENGTH}
            autoFocus
            onChange={(e) => setOpponent(e.target.value)}
          />
          <datalist id="challenge-players">
            {players.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
          <label className="challenge-doubles">
            <input type="checkbox" checked={doubles} onChange={(e) => setDoubles(e.target.checked)} /> Double battle
          </label>
          <button type="submit" disabled={challenging || !opponent.trim()}>
            Fight
          </button>
        </form>
        {error && <p className="editor-error">{error}</p>}
        <div className="editor-actions">
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default ChallengeModal
