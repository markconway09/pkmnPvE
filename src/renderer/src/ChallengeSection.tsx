import { useEffect, useState } from 'react'
import { MAX_USERNAME_LENGTH } from '../../shared/battle-types'

interface Props {
  // Starts a fight against another player's saved team; rejects with why it couldn't.
  onChallengePlayer: (username: string, doubles: boolean) => Promise<void>
  disabled: boolean
}

/**
 * Challenge a player, as a small section of the Classic page: a friendly fight against
 * the team another player on this computer last saved.
 */
function ChallengeSection({ onChallengePlayer, disabled }: Props): React.JSX.Element {
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
    if (challenging || disabled || !opponent.trim()) return
    setChallenging(true)
    setError(null)
    try {
      await onChallengePlayer(opponent, doubles)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setChallenging(false)
    }
  }

  return (
    <div className="classic-challenge">
      <div className="classic-section-head">
        <img className="classic-section-icon" src="./icons/nav/challenge.png" alt="" />
        <span className="run-hud-label">Challenge a player</span>
        {/* A friendly match: their whole team is set to the level of your highest-level
            Pokemon, and there are no exp, money or item drops. */}
        <span className="classic-section-sub">Friendly match · no exp, money or drops</span>
      </div>
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
        <button type="submit" disabled={challenging || disabled || !opponent.trim()}>
          Fight
        </button>
      </form>
      {error && <p className="editor-error">{error}</p>}
    </div>
  )
}

export default ChallengeSection
