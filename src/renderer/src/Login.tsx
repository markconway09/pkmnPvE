import { useState } from 'react'
import type { SessionInfo } from '../../shared/battle-types'
import { MAX_USERNAME_LENGTH, normalizeUsername, usernameProblem } from '../../shared/battle-types'

interface Props {
  session: SessionInfo
  onLoggedIn: (session: SessionInfo) => void
}

function Login({ session, onLoggedIn }: Props): React.JSX.Element {
  const [name, setName] = useState(session.lastUsername ?? '')
  const [remember, setRemember] = useState(session.rememberByDefault)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmed = normalizeUsername(name)
  const problem = trimmed ? usernameProblem(trimmed) : null
  const isExisting = session.players.some((p) => p.toLowerCase() === trimmed.toLowerCase())

  async function submit(): Promise<void> {
    if (busy || !trimmed || problem) return
    setBusy(true)
    setError(null)
    try {
      onLoggedIn(await window.api.login(trimmed, remember))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <div className="screen login-screen">
      <h1>Log in</h1>
      <p className="editor-hint">
        Enter a username to load its save. A name that doesn&apos;t exist yet starts a new one.
      </p>

      <form
        className="login-form"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <label className="editor-field editor-field-full">
          <span>Username</span>
          <input
            type="text"
            autoFocus
            value={name}
            maxLength={MAX_USERNAME_LENGTH}
            placeholder="Username"
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label className="editor-field-checkbox login-remember">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          <span>Remember me on this computer</span>
        </label>

        {problem && <p className="editor-error">{problem}</p>}
        {error && <p className="editor-error">{error}</p>}
        {trimmed && !problem && (
          <p className="editor-hint">{isExisting ? 'Loads the saved game for this name.' : 'New player - starts a fresh save.'}</p>
        )}

        <button type="submit" disabled={busy || !trimmed || !!problem}>
          {isExisting ? 'Log in' : 'Create & log in'}
        </button>
      </form>

      {session.players.length > 0 && (
        <div className="login-players">
          <h2 className="options-heading">Players on this computer</h2>
          <div className="login-player-list">
            {session.players.map((player) => (
              <button key={player} type="button" className="login-player" onClick={() => setName(player)}>
                {player}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default Login
