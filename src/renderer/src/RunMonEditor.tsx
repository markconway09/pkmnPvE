import { useEffect, useState } from 'react'
import { loadSpriteStyle } from './spriteStyle'
import { createPortal } from 'react-dom'
import type { RunMonEditInfo, RunMonView, RunView } from '../../shared/battle-types'
import { toSpriteId } from '../../shared/battle-types'
import SpriteImage from './SpriteImage'
import ItemSprite from './ItemSprite'
import ShinyIcon from './ShinyIcon'
import { TYPE_COLORS } from './moveAnimations'
import ModalSpinner from './ModalSpinner'
import { teraTypeStyle } from './PokemonEditor'
import Tooltip from './Tooltip'

interface Props {
  runMonId: string
  // The run Pokemon itself, for the picture and details beside its moves.
  mon?: RunMonView
  onClose: () => void
  onSaved: (run: RunView) => void
}

/**
 * Roguelite's own moves editor - apart from the classic Pokemon editor: a run Pokemon's
 * four moves (anything its species can ever learn) and which of them are locked in
 * (kept when its moves change on evolving), with Smogon's sets to fill them in. Laid out
 * like the classic editor: the Pokemon on the left, its moves as cards with their type,
 * category, power, accuracy and PP.
 */
function RunMonEditor({ runMonId, mon, onClose, onSaved }: Props): React.JSX.Element {
  const [info, setInfo] = useState<RunMonEditInfo | null>(null)
  const [moves, setMoves] = useState<string[]>(['', '', '', ''])
  const [locked, setLocked] = useState<string[]>([])
  const [teraType, setTeraType] = useState('')
  const [setId, setSetId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The move slot whose list is open beside the editor (as in the classic editor), and
  // what's typed into it to narrow the list.
  const [activeSlot, setActiveSlot] = useState<number | null>(null)
  const [moveQuery, setMoveQuery] = useState('')

  function chooseMove(slot: number, id: string): void {
    const next = [...moves]
    next[slot] = id
    setMoves(next)
    setActiveSlot(null)
  }

  useEffect(() => {
    window.api
      .getRunMonEditInfo(runMonId)
      .then((loaded) => {
        setInfo(loaded)
        setMoves([0, 1, 2, 3].map((i) => loaded.moves[i] ?? ''))
        setLocked(loaded.lockedMoves)
        setTeraType(loaded.teraType)
        setSetId(loaded.autoSets[0]?.id ?? '')
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [runMonId])

  const moveInfo = (id: string): RunMonEditInfo['learnable'][number] | undefined =>
    info?.learnable.find((m) => m.id === id)
  const moveName = (id: string): string => moveInfo(id)?.name ?? id
  const results =
    info && activeSlot !== null
      ? info.learnable.filter((m) => m.name.toLowerCase().includes(moveQuery.trim().toLowerCase()))
      : []

  async function applySet(): Promise<void> {
    if (!setId) return
    setBusy(true)
    setError(null)
    try {
      const setMovesFound = await window.api.runSmogonSet(runMonId, setId)
      // Locked moves stay; the set fills the other slots.
      const keep = moves.filter((m) => m && locked.includes(m))
      const fill = setMovesFound.filter((m) => !keep.includes(m))
      setMoves([0, 1, 2, 3].map((i) => (moves[i] && locked.includes(moves[i]) ? moves[i] : (fill.shift() ?? ''))))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  // Undoes its New Ability pick right away (moves being edited stay as they are), then
  // picks up the restored ability's description for its tooltip.
  async function resetAbility(): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      onSaved(await window.api.resetRunAbility(runMonId))
      const fresh = await window.api.getRunMonEditInfo(runMonId)
      setInfo((current) => (current ? { ...current, abilityDescription: fresh.abilityDescription } : fresh))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function save(): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      const chosen = moves.filter(Boolean)
      onSaved(
        await window.api.updateRunMon(runMonId, {
          moves: chosen,
          lockedMoves: locked.filter((m) => chosen.includes(m)),
          teraType
        })
      )
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-row" onMouseDown={(e) => e.stopPropagation()}>
        <div className={`modal-panel pokemon-editor pokemon-editor-main run-mon-editor${info ? '' : ' modal-panel-loading'}`}>
          <h2>{info ? `${info.species} - moves` : 'Moves'}</h2>
          {!info && <ModalSpinner />}
          {info && (
            <div
              className="pokemon-editor-layout"
              // Focusing anything but a move box (the Smogon set, a lock) closes the move list.
              onFocus={(e) => {
                if (!(e.target as HTMLElement).dataset.moveSlot) setActiveSlot(null)
              }}
            >
              <div className="pokemon-editor-top">
                <div className="pokemon-editor-side">
                  <div className="pokemon-editor-portrait" title={mon?.shiny ? `Shiny ${info.species}` : info.species}>
                    {/* In the sprite style picked in Options. */}
                    <SpriteImage
                      style={loadSpriteStyle()}
                      spriteId={toSpriteId(info.species)}
                      shiny={mon?.shiny}
                      alt={info.species}
                    />
                    <span className="pokemon-editor-portrait-name">
                      {mon?.shiny && <ShinyIcon />}
                      {info.species}
                      {mon ? ` · Lv ${mon.level}` : ''}
                    </span>
                  </div>
                  {mon && (
                    <div className="run-editor-facts">
                      <div>
                        <span className="editor-hint">Gender</span>{' '}
                        {mon.gender === 'M' ? (
                          <span className="gender-male">♂ Male</span>
                        ) : mon.gender === 'F' ? (
                          <span className="gender-female">♀ Female</span>
                        ) : (
                          'Genderless'
                        )}
                      </div>
                      {/* Hovering the ability or the item says what it does. */}
                      <Tooltip
                        className="run-editor-fact-tip"
                        placement="below"
                        content={
                          <div className="tooltip-panel">
                            <div className="tooltip-title">
                              {mon.ability}
                              {mon.abilityLocked && ' 🔒'}
                            </div>
                            <div className="tooltip-desc">{info?.abilityDescription || 'No description.'}</div>
                            {mon.abilityLocked && <div className="tooltip-desc">From a New Ability pick - kept through evolution.</div>}
                          </div>
                        }
                      >
                        <div>
                          <span className="editor-hint">Ability</span> {mon.ability}
                          {mon.abilityLocked && ' 🔒'}
                        </div>
                      </Tooltip>
                      {mon.abilityResetTo && (
                        <button
                          type="button"
                          className="run-editor-reset-ability"
                          disabled={busy}
                          title={`Undo the New Ability pick - back to ${mon.abilityResetTo}`}
                          onClick={() => void resetAbility()}
                        >
                          ↺ Reset to {mon.abilityResetTo}
                        </button>
                      )}
                      {mon.item ? (
                        <Tooltip
                          className="run-editor-fact-tip"
                          placement="below"
                          content={
                            <div className="tooltip-panel">
                              <div className="tooltip-title">{mon.item}</div>
                              <div className="tooltip-desc">{info?.itemDescription || 'No description.'}</div>
                            </div>
                          }
                        >
                          <div className="run-editor-item">
                            <span className="editor-hint">Item</span>
                            {mon.itemSpritenum != null && <ItemSprite spritenum={mon.itemSpritenum} />}
                            {mon.item}
                          </div>
                        </Tooltip>
                      ) : (
                        <div className="run-editor-item">
                          <span className="editor-hint">Item</span> None
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="pokemon-editor-details">
                  <label className="editor-field run-editor-tera">
                    <span>Tera Type</span>
                    <select
                      className="editor-tera-select"
                      style={teraTypeStyle(teraType)}
                      value={teraType}
                      onChange={(e) => setTeraType(e.target.value)}
                    >
                      {info.teraTypes.map((t) => (
                        <option key={t} value={t} style={teraTypeStyle(t)}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="editor-section">
                    <h3>Smogon set</h3>
                    <div className="auto-set-row">
                      <select value={setId} onChange={(e) => setSetId(e.target.value)}>
                        {info.autoSets.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <button disabled={busy || !setId} onClick={() => void applySet()}>
                        Apply
                      </button>
                    </div>
                    <p className="editor-hint">Fills in its moves. Locked moves stay.</p>
                  </div>
                  <p className="editor-hint">
                    🔒 Locked moves are kept when its moves change on evolving.
                    {locked.filter((m) => moves.includes(m)).length > 0 &&
                      ` Locked now: ${locked
                        .filter((m) => moves.includes(m))
                        .map(moveName)
                        .join(', ')}.`}
                  </p>
                </div>
              </div>

              <div className="editor-section">
                <h3>
                  Moves <span className="editor-hint">(up to 4, {info.learnable.length} available)</span>
                </h3>
                <div className="editor-moves-grid">
                  {moves.map((move, i) => {
                    const chosen = moveInfo(move)
                    return (
                      <div
                        key={i}
                        className="editor-move-slot"
                        style={chosen ? { borderLeftColor: TYPE_COLORS[chosen.type.toLowerCase()] } : undefined}
                      >
                        <div className="run-editor-move">
                          <input
                            type="text"
                            value={activeSlot === i ? moveQuery : moveName(move)}
                            placeholder={moveName(move) || `Move ${i + 1}`}
                            data-move-slot={i}
                            onFocus={() => {
                              setActiveSlot(i)
                              setMoveQuery('')
                            }}
                            onChange={(e) => setMoveQuery(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') {
                                setActiveSlot(null)
                                e.currentTarget.blur()
                              }
                            }}
                          />
                          <label
                            className="run-editor-lock"
                            title="Locked moves are kept when its moves change on evolving"
                          >
                            <input
                              type="checkbox"
                              disabled={!move}
                              checked={!!move && locked.includes(move)}
                              onChange={(e) =>
                                setLocked((all) => (e.target.checked ? [...all, move] : all.filter((m) => m !== move)))
                              }
                            />
                            🔒
                          </label>
                        </div>
                        <div className="editor-move-info">
                          {chosen ? (
                            <>
                              <span className={`type-badge type-${chosen.type.toLowerCase()}`}>{chosen.type}</span>
                              <img
                                className="editor-move-category"
                                src={`./sprites/misc/category-${chosen.category.toLowerCase()}.png`}
                                alt={chosen.category}
                                title={chosen.category}
                              />
                              <span>Pow {chosen.basePower || '—'}</span>
                              <span>Acc {chosen.accuracy === true ? '—' : chosen.accuracy}</span>
                              <span>PP {chosen.pp}</span>
                            </>
                          ) : (
                            <span className="editor-hint">No move</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
          {error && <p className="editor-error">{error}</p>}
          <div className="editor-actions">
            <button onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button onClick={() => void save()} disabled={busy || !info || !moves.some(Boolean)}>
              Save
            </button>
          </div>
        </div>

        {info && activeSlot !== null && (
          <div className="selector-panel">
            <div className="selector-panel-header">
              Move {activeSlot + 1} ({results.length})
            </div>
            <div className="selector-list">
              <button className="selector-row selector-row-clear" onClick={() => chooseMove(activeSlot, '')}>
                (None)
              </button>
              {results.map((m) => {
                const learnedElsewhere = moves.some((id, i) => id === m.id && i !== activeSlot)
                return (
                  <button
                    key={m.id}
                    className={`selector-row ${learnedElsewhere ? 'selector-row-disabled' : ''}`}
                    disabled={learnedElsewhere}
                    onClick={() => chooseMove(activeSlot, m.id)}
                  >
                    <div className="selector-row-main">
                      <div className="selector-row-title">
                        {m.name}
                        <span className={`type-badge type-${m.type.toLowerCase()}`}>{m.type}</span>
                        {learnedElsewhere && <span className="learned-badge">Learned</span>}
                      </div>
                      <div className="selector-row-sub">
                        {m.category} · Pow {m.basePower || '—'} · Acc {m.accuracy === true ? '—' : m.accuracy} · PP{' '}
                        {m.pp}
                      </div>
                      <div className="selector-row-desc">{m.description}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

export default RunMonEditor
