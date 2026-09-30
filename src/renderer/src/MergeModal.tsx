import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { BoxPokemonView, BoxState } from '../../shared/battle-types'
import {
  MERGE_MAX_COPIES,
  MERGE_MAX_STARS,
  MERGE_STAT_BONUS_PER_STAR,
  mergeStarsFor,
  planMerge,
  toSpriteId
} from '../../shared/battle-types'
import SpriteImage from './SpriteImage'
import PokemonIconVisual from './PokemonIconVisual'
import ShinyIcon from './ShinyIcon'
import { errorMessage } from './FloatingNotes'

interface Props {
  keeper: BoxPokemonView
  onMerged: (box: BoxState, stars: number) => void
  onClose: () => void
}

// Filled and empty stars, out of MERGE_MAX_STARS.
export function starRow(stars: number): string {
  return '★'.repeat(stars) + '☆'.repeat(MERGE_MAX_STARS - stars)
}

const bonusText = (stars: number): string => `+${Math.round(stars * MERGE_STAT_BONUS_PER_STAR * 100)}% to all stats`

// How many copies the next star takes.
function nextStarAt(copies: number): number | null {
  const stars = mergeStarsFor(copies)
  return stars >= MERGE_MAX_STARS ? null : 2 ** (stars + 1)
}

/**
 * Merging duplicates into a Pokemon: pick which of the same species go in. Their copies
 * add to its own (stars at 2, 4, 8, 16 and 32), a shiny makes it shiny, it keeps the
 * higher friendship, and their held items go back to the bag.
 */
function MergeModal({ keeper, onMerged, onClose }: Props): React.JSX.Element {
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const candidates = keeper.mergeCandidates ?? []
  const chosen = candidates.filter((c) => picked.has(c.id))
  const copiesNow = keeper.copies ?? 1
  // Past the top, the last one in only gives what fits and keeps the rest (see planMerge).
  const plan = planMerge(copiesNow, chosen)
  const copiesAfter = plan.copiesAfter
  const whole = chosen.filter((c) => plan.whole.includes(c.id))
  const partial = plan.partial ? chosen.find((c) => c.id === plan.partial!.id) : undefined
  const keeperFull = copiesNow >= MERGE_MAX_COPIES
  const starsNow = mergeStarsFor(copiesNow)
  const starsAfter = mergeStarsFor(copiesAfter)
  // Only those merged in whole pass anything on.
  const becomesShiny = !keeper.shiny && whole.some((c) => c.shiny)
  // A favorite merged in passes its heart on.
  const becomesFavorite = !keeper.favorite && whole.some((c) => c.favorite)
  // It takes the highest level of any that go in.
  const levelAfter = Math.max(keeper.level, ...whole.map((c) => c.level))
  // Merging a favorite (or one off the team) away asks for a second click.
  const needsConfirm = whole.some((c) => c.favorite || c.onTeam)
  const nextAt = nextStarAt(copiesNow)

  function toggle(id: string): void {
    setConfirming(false)
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function merge(): Promise<void> {
    if (needsConfirm && !confirming) {
      setConfirming(true)
      return
    }
    setBusy(true)
    setError(null)
    try {
      onMerged(await window.api.mergeMons(keeper.id, [...picked]), starsAfter)
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  return createPortal(
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-panel merge-modal" onMouseDown={(e) => e.stopPropagation()}>
        <h2>Merge into {keeper.species}</h2>
        <div className="merge-keeper">
          <div className="box-icon merge-keeper-icon">
            <div className="box-icon-draggable">
              <PokemonIconVisual mon={{ ...keeper, expPercent: undefined }} />
            </div>
          </div>
          <div className="merge-keeper-info">
            <span className="merge-stars">{starRow(starsNow)}</span>
            <span>
              {copiesNow} cop{copiesNow === 1 ? 'y' : 'ies'}
              {nextAt ? ` · ${nextAt - copiesNow} more for ★${starsNow + 1}` : ' · fully merged'}
            </span>
            <span className="merge-bonus">
              {starsNow > 0 ? `${bonusText(starsNow)} in classic battles` : 'No bonus yet - two copies make ★1'}
            </span>
          </div>
        </div>

        <p className="editor-hint">
          Each star is {bonusText(1)} in classic battles and friendly matches (not Roguelite runs). Stars come
          at 2, 4, 8, 16 and 32 copies - past 32, the last one in keeps what's left over (and the stars that go with it). Merged-in Pokémon leave your box: a shiny makes {keeper.species} shiny, a favorite makes it a favorite,
          it keeps the higher level and friendship, and held items go back to your bag.
        </p>

        {keeperFull ? (
          <p className="box-empty-hint">{keeper.species} is fully merged at ★{MERGE_MAX_STARS}.</p>
        ) : candidates.length === 0 ? (
          <p className="box-empty-hint">No other {keeper.species} to merge in.</p>
        ) : (
          <div className="merge-candidates">
            {candidates.map((c) => {
              const stars = mergeStarsFor(c.copies)
              return (
                <button
                  key={c.id}
                  className={`merge-candidate${picked.has(c.id) ? ' merge-candidate-picked' : ''}`}
                  disabled={busy}
                  onClick={() => toggle(c.id)}
                >
                  <SpriteImage style="2d-static" className="merge-candidate-sprite" spriteId={toSpriteId(c.species)} shiny={c.shiny} alt={c.species} />
                  <span className="merge-candidate-name">
                    {c.favorite && '❤️ '}
                    {c.species}
                    {c.shiny && <ShinyIcon />}
                  </span>
                  <span className="merge-candidate-meta">
                    Lv {c.level}
                    {stars > 0 && <span className="merge-stars"> {'★'.repeat(stars)}</span>}
                    {c.copies > 1 && ` · ${c.copies} copies`}
                  </span>
                  {(c.onTeam || c.item) && (
                    <span className="merge-candidate-note">
                      {[c.onTeam && 'On your team', c.item && `${c.item} to bag`].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {chosen.length > 0 && (
          <p className="merge-preview">
            {`After: ${copiesAfter} copies · ${starRow(starsAfter)}${starsAfter > starsNow ? ` (${bonusText(starsAfter)})` : ''}${levelAfter > keeper.level ? ` · Lv ${keeper.level} → ${levelAfter}` : ''}${becomesShiny ? ' · becomes shiny' : ''}${becomesFavorite ? ' · becomes a favorite' : ''}`}
            {partial && plan.partial && (
              <span className="merge-overflow">
                {partial.species} (Lv {partial.level}) gives {plan.partial.given} and keeps {plan.partial.left} cop
                {plan.partial.left === 1 ? 'y' : 'ies'}
                {mergeStarsFor(plan.partial.left) > 0 ? ` · ★${mergeStarsFor(plan.partial.left)}` : ''}
              </span>
            )}
            {plan.unused.length > 0 && (
              <span className="merge-overflow">
                {plan.unused.length} not needed - it&apos;s full before {plan.unused.length === 1 ? 'it goes' : 'they go'} in
              </span>
            )}
          </p>
        )}
        {error && <p className="editor-error">{error}</p>}

        <div className="editor-actions">
          <button onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            className={confirming ? 'confirm-button' : undefined}
            disabled={busy || chosen.length === 0 || keeperFull}
            onClick={() => void merge()}
            onBlur={() => setConfirming(false)}
          >
            {confirming ? 'Merge a favorite / team member? Click again' : `Merge ${chosen.length || ''}`.trim()}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default MergeModal
