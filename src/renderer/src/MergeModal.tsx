import { useState } from 'react'
import { RarityGlow } from './RarityCard'
import { createPortal } from 'react-dom'
import type { BoxPokemonView, BoxState } from '../../shared/battle-types'
import {
  MERGE_MAX_COPIES,
  MERGE_MAX_STARS,
  mergeBonusText,
  mergeStarsFor,
  planMerge,
  toSpriteId
} from '../../shared/battle-types'
import SpriteImage from './SpriteImage'
import PokemonIconVisual from './PokemonIconVisual'
import ShinyIcon from './ShinyIcon'
import { errorMessage } from './FloatingNotes'
import ItemSprite from './ItemSprite'
import { clickWord, itemName, t } from './i18n'

interface Props {
  keeper: BoxPokemonView
  onMerged: (box: BoxState, stars: number) => void
  onClose: () => void
}

// Filled and empty stars, out of MERGE_MAX_STARS.
export function starRow(stars: number): string {
  return '★'.repeat(stars) + '☆'.repeat(MERGE_MAX_STARS - stars)
}


// How many copies the next star takes.
function nextStarAt(copies: number): number | null {
  const stars = mergeStarsFor(copies)
  return stars >= MERGE_MAX_STARS ? null : 2 ** (stars + 1)
}

/**
 * Merging duplicates into a Pokemon: pick which of the same species go in. Their copies
 * add to its own (stars at 2, 4, 8, 16, 32 and 64), a shiny makes it shiny, it keeps the
 * higher friendship, and their held items go back to the bag.
 */
function MergeModal({ keeper, onMerged, onClose }: Props): React.JSX.Element {
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Its bonus at so many stars - red and gold Pokemon get less from each one.
  const bonusText = (stars: number): string => t('merge.bonus', { bonus: mergeBonusText(stars, keeper.rarityTier) })
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
  // The evolution items the picked pre-evolutions use up between them, against the bag.
  const itemsNeeded = new Map<string, { name: string; count: number; owned: number }>()
  for (const c of chosen) {
    for (const item of c.evolveItems ?? []) {
      const entry = itemsNeeded.get(item.itemId) ?? { name: item.name, count: 0, owned: item.owned }
      entry.count++
      itemsNeeded.set(item.itemId, entry)
    }
  }
  const shortItem = [...itemsNeeded.values()].find((i) => i.count > i.owned)
  const itemsText = [...itemsNeeded.values()].map((i) => `${i.count > 1 ? `${i.count}× ` : ''}${itemName(i.name)}`).join(', ')
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

  // Every one that can go in right now (not the pre-evolutions that can't evolve yet).
  const selectable = candidates.filter((c) => !c.notReady)
  const allPicked = selectable.length > 0 && selectable.every((c) => picked.has(c.id))

  function toggleAll(): void {
    setConfirming(false)
    setPicked(allPicked ? new Set() : new Set(selectable.map((c) => c.id)))
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
        <h2>{t('merge.title', { name: keeper.species })}</h2>
        <div className="merge-keeper">
          <div className="box-icon merge-keeper-icon">
            <div className={`box-icon-draggable rarity-card rarity-tier-${keeper.rarityTier ?? 'common'}`}>
              <PokemonIconVisual mon={{ ...keeper, expPercent: undefined }} />
            </div>
          </div>
          <div className="merge-keeper-info">
            <span className="merge-stars">{starRow(starsNow)}</span>
            <span>
              {t('editor.copies', { count: copiesNow })}
              {nextAt ? t('editor.moreForStar', { n: nextAt - copiesNow, star: starsNow + 1 }) : t('editor.fullyMerged')}
            </span>
            <span className="merge-bonus">
              {starsNow > 0 ? t('merge.inClassic', { bonus: bonusText(starsNow) }) : t('merge.noBonus')}
            </span>
          </div>
        </div>

        <p className="editor-hint">{t('merge.help', { bonus: bonusText(1) })}</p>

        {keeperFull ? (
          <p className="box-empty-hint">{t('merge.full', { name: keeper.species, stars: MERGE_MAX_STARS })}</p>
        ) : candidates.length === 0 ? (
          <p className="box-empty-hint">{t('merge.noOthers', { name: keeper.species })}</p>
        ) : (
          <div className="merge-candidates">
            {candidates.map((c) => {
              const stars = mergeStarsFor(c.copies)
              return (
                <button
                  key={c.id}
                  className={`merge-candidate rarity-card rarity-tier-${keeper.rarityTier ?? 'common'}${picked.has(c.id) ? ' merge-candidate-picked' : ''}${c.notReady ? ' merge-candidate-not-ready' : ''}`}
                  // A pre-evolution that can't evolve into it yet can't go in.
                  disabled={busy || !!c.notReady}
                  title={c.notReady ? t('merge.notYet', { reason: c.notReady }) : undefined}
                  onClick={() => toggle(c.id)}
                >
                  <RarityGlow size={56}>
                    <SpriteImage style="3d-static" className="merge-candidate-sprite" spriteId={toSpriteId(c.species)} shiny={c.shiny} alt={c.species} />
                  </RarityGlow>
                  <span className="merge-candidate-name">
                    {c.favorite && '❤️ '}
                    {c.species}
                    {c.shiny && <ShinyIcon />}
                  </span>
                  <span className="merge-candidate-meta">
                    {t('merge.lv', { level: c.level })}
                    {stars > 0 && <span className="merge-stars"> {'★'.repeat(stars)}</span>}
                    {c.copies > 1 && t('merge.copiesTail', { n: c.copies })}
                  </span>
                  {c.species !== keeper.species && !c.notReady && (
                    <span className="merge-candidate-evolves">
                      {t('merge.evolvesIn')}
                      {(c.evolveItems ?? []).map((item) => (
                        <span
                          key={item.itemId}
                          className="merge-candidate-evolve-item"
                          title={t('merge.usesA', { item: itemName(item.name) })}
                        >
                          {item.spritenum !== null && <ItemSprite spritenum={item.spritenum} />}
                        </span>
                      ))}
                    </span>
                  )}
                  {c.notReady && <span className="merge-candidate-note merge-candidate-blocked">{c.notReady}</span>}
                  {(c.onTeam || c.item) && (
                    <span className="merge-candidate-note">
                      {[c.onTeam && t('merge.onTeam'), c.item && t('merge.itemToBag', { item: itemName(c.item) })]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {chosen.length > 0 && (
          <p className="merge-preview">
            {t('merge.after', { copies: copiesAfter, stars: starRow(starsAfter) })}
            {starsAfter > starsNow ? ` (${bonusText(starsAfter)})` : ''}
            {levelAfter > keeper.level ? t('merge.afterLevel', { from: keeper.level, to: levelAfter }) : ''}
            {becomesShiny ? t('merge.becomesShiny') : ''}
            {becomesFavorite ? t('merge.becomesFavorite') : ''}
            {partial && plan.partial && (
              <span className="merge-overflow">
                {t('merge.partial', {
                  name: partial.species,
                  level: partial.level,
                  given: plan.partial.given,
                  count: plan.partial.left
                })}
                {mergeStarsFor(plan.partial.left) > 0 ? ` · ★${mergeStarsFor(plan.partial.left)}` : ''}
              </span>
            )}
            {itemsText && (
              <span className={`merge-overflow${shortItem ? ' editor-error' : ''}`}>
                {shortItem
                  ? t('merge.needs', { count: shortItem.count, item: itemName(shortItem.name), owned: shortItem.owned })
                  : t('merge.uses', { items: itemsText })}
              </span>
            )}
            {plan.unused.length > 0 && (
              <span className="merge-overflow">{t('merge.unused', { count: plan.unused.length })}</span>
            )}
          </p>
        )}
        {error && <p className="editor-error">{error}</p>}

        <div className="editor-actions">
          {!keeperFull && selectable.length > 0 && (
            <button className="merge-select-all" onClick={toggleAll} disabled={busy}>
              {allPicked ? t('merge.deselectAll') : t('merge.selectAll')}
            </button>
          )}
          <button onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button
            className={confirming ? 'confirm-button' : undefined}
            disabled={busy || chosen.length === 0 || keeperFull || !!shortItem}
            onClick={() => void merge()}
            onBlur={() => setConfirming(false)}
          >
            {confirming
              ? t('merge.confirm', { click: clickWord() })
              : chosen.length
                ? t('merge.goCount', { count: chosen.length })
                : t('merge.go')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default MergeModal
