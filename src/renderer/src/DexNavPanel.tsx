import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { WildLocationId } from '../../shared/battle-types'
import { WILD_LOCATIONS, toSpriteId } from '../../shared/battle-types'
import {
  dexNavChance,
  dexNavShinyMultiplier,
  type DexNavCandidate,
  type DexNavState
} from '../../shared/dexnav'
import RarityCard, { RarityGlow } from './RarityCard'
import SpriteImage from './SpriteImage'
import FitName from './FitName'
import SearchBar from './SearchBar'
import ModalSpinner from './ModalSpinner'
import { locationIconUrl } from './battleScenery'
import { errorMessage } from './FloatingNotes'

interface Props {
  // The wild level picked on the Battle page - the target only turns up once it's high enough.
  wildLevel: number
  disabled: boolean
  // A wild battle in this area (the DexNav rolls for its target there).
  onHunt: (location: WildLocationId) => void
}

const percent = (chance: number): string => `${Math.round(chance * 100)}%`

/**
 * The Battle page's DexNav (once the key item is owned): the Pokemon being hunted, its
 * chain with how likely it is to turn up and its shiny boost, a Hunt button for every area
 * it lives in (and Anywhere), and a picker for a new target.
 */
function DexNavPanel({ wildLevel, disabled, onHunt }: Props): React.JSX.Element | null {
  const [state, setState] = useState<DexNavState | null>(null)
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmStop, setConfirmStop] = useState(false)

  useEffect(() => {
    window.api
      .getDexNavState()
      .then(setState)
      .catch(() => setState(null))
  }, [])

  if (!state?.owned) return null
  const target = state.target
  const tooLow = !!target && target.minLevel > wildLevel
  const areas = target ? WILD_LOCATIONS.filter((l) => l.id === 'all' || target.locations.includes(l.id)) : []

  async function choose(species: string | null): Promise<void> {
    setError(null)
    try {
      setState(await window.api.setDexNavTarget(species))
      setPicking(false)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  // Stopping throws the chain away, so a chain worth keeping asks for a second click.
  function stopHunting(): void {
    if (state && state.chain > 0 && !confirmStop) {
      setConfirmStop(true)
      return
    }
    setConfirmStop(false)
    void choose(null)
  }

  return (
    <>
      <div className="classic-section-head">
        <img className="classic-section-icon" src="./sprites/misc/dexnav.png" alt="" />
        <span className="run-hud-label">DexNav</span>
        <span className="classic-section-sub">Hunt a Pokémon you've registered</span>
      </div>
      <div className="dexnav-panel">
        {target ? (
          <>
            <RarityCard tier={target.rarityTier} className="dexnav-target" title={`Hunting ${target.species}`}>
              <RarityGlow size={56}>
                <SpriteImage style="3d-static" className="dexnav-target-sprite" spriteId={toSpriteId(target.species)} alt={target.species} />
              </RarityGlow>
              <FitName className="dexnav-target-name" text={target.species} />
            </RarityCard>
            <div className="dexnav-info">
              <div className="dexnav-chain-row">
                <span className="dexnav-chain-label">
                  Chain <strong>{state.chain}</strong>
                  {state.chain >= state.maxChain && <span className="dexnav-chain-max">MAX</span>}
                </span>
                <span className="dexnav-stat" title="How often it turns up in a wild battle where it lives">
                  Appears <strong>{percent(dexNavChance(state.chain, state.maxChain))}</strong>
                </span>
                <span className="dexnav-stat" title="Its shiny odds, on top of every other boost">
                  Shiny <strong>×{dexNavShinyMultiplier(state.chain, state.maxChain).toFixed(2)}</strong>
                </span>
              </div>
              <span
                className="dexnav-chain-bar"
                title={`Beat or catch it to grow the chain (up to ${state.maxChain}) - running from it or losing breaks it`}
              >
                <span style={{ width: `${(Math.min(state.chain, state.maxChain) / state.maxChain) * 100}%` }} />
              </span>
              {tooLow ? (
                <span className="dexnav-warning">Turns up from wild level {target.minLevel} - raise the wild level to hunt it</span>
              ) : (
                <div className="dexnav-areas">
                  {areas.map((loc) => (
                    <button
                      key={loc.id}
                      className="dexnav-area"
                      disabled={disabled}
                      title={`Battle in ${loc.id === 'all' ? 'any area' : loc.label} - ${percent(dexNavChance(state.chain, state.maxChain))} chance it's ${target.species}`}
                      onClick={() => onHunt(loc.id)}
                    >
                      <img className="dexnav-area-icon" src={locationIconUrl(loc.id)} alt="" />
                      {loc.id === 'all' ? 'Anywhere' : loc.label}
                      <span className="dexnav-area-go">▸</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="dexnav-actions">
              <button className="dexnav-action dexnav-action-change" onClick={() => setPicking(true)} title="Hunt a different Pokémon">
                <span className="dexnav-action-icon">
                  <svg viewBox="0 0 12 12" aria-hidden="true">
                    <path d="M2 4h7.5M7.5 2l2 2-2 2M10 8H2.5M4.5 6l-2 2 2 2" />
                  </svg>
                </span>
                Change
              </button>
              <button
                className={`dexnav-action dexnav-action-stop${confirmStop ? ' dexnav-action-confirm' : ''}`}
                onClick={stopHunting}
                onMouseLeave={() => setConfirmStop(false)}
                title={state.chain > 0 ? `Stop hunting - your chain of ${state.chain} is lost` : 'Stop hunting'}
              >
                <span className="dexnav-action-icon">
                  <svg viewBox="0 0 12 12" aria-hidden="true">
                    {confirmStop ? (
                      <path d="M6 2.5v4.5M6 9.2v0.3" />
                    ) : (
                      <rect className="dexnav-action-fill" x="3.5" y="3.5" width="5" height="5" rx="1" />
                    )}
                  </svg>
                </span>
                {confirmStop ? 'Sure?' : 'Stop'}
              </button>
            </div>
          </>
        ) : (
          <button className="dexnav-pick" onClick={() => setPicking(true)}>
            <img src="./sprites/misc/dexnav.png" alt="" />
            Pick a Pokémon to hunt ▸
          </button>
        )}
      </div>
      {error && <p className="dexnav-error">{error}</p>}
      {picking && (
        <DexNavPicker
          current={target?.species ?? null}
          chain={state.chain}
          wildLevel={wildLevel}
          onPick={(species) => void choose(species)}
          onClose={() => setPicking(false)}
        />
      )}
    </>
  )
}

interface PickerProps {
  current: string | null
  chain: number
  wildLevel: number
  onPick: (species: string) => void
  onClose: () => void
}

/** Every registered Pokemon the DexNav can hunt, to pick a new target from. */
function DexNavPicker({ current, chain, wildLevel, onPick, onClose }: PickerProps): React.JSX.Element {
  const [candidates, setCandidates] = useState<DexNavCandidate[] | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    window.api
      .listDexNavCandidates()
      .then(setCandidates)
      .catch(() => setCandidates([]))
  }, [])

  const query = search.trim().toLowerCase().replace(/^#/, '')
  const shown = (candidates ?? []).filter(
    (c) => !query || c.species.toLowerCase().includes(query) || (/^\d+$/.test(query) && c.num === Number(query))
  )

  return createPortal(
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className={`modal-panel dexnav-picker${candidates ? '' : ' modal-panel-loading'}`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="pokedex-header">
          <h2>DexNav</h2>
          <span className="dexnav-picker-note">
            {current && chain > 0 ? `A new target starts over your chain of ${chain}` : 'Pick a Pokémon to hunt'}
          </span>
          <SearchBar className="pokedex-search" placeholder="Search name or number…" value={search} onChange={setSearch} autoFocus />
        </div>
        <div className="pokedex-grid">
          {!candidates && <ModalSpinner />}
          {shown.map((c) => {
            const areas = WILD_LOCATIONS.filter((l) => c.locations.includes(l.id))
            return (
              <RarityCard
                key={c.species}
                tier={c.rarityTier}
                lift
                dimmed={c.minLevel > wildLevel}
                className={`pokedex-cell dexnav-cell${c.species === current ? ' dexnav-cell-current' : ''}`}
                title={`#${c.num} ${c.species}\nFound: ${areas.length ? areas.map((l) => l.label).join(', ') : 'Anywhere'}\nFrom wild level ${c.minLevel}`}
                onClick={() => onPick(c.species)}
              >
                <span className="dexnav-cell-level">Lv {c.minLevel}+</span>
                <RarityGlow size={56}>
                  <SpriteImage style="3d-static" className="pokedex-sprite" spriteId={toSpriteId(c.species)} alt={c.species} />
                </RarityGlow>
                <FitName className="pokedex-name" text={c.species} />
                <span className="dexnav-cell-areas">
                  {areas.map((l) => (
                    <img key={l.id} src={locationIconUrl(l.id)} alt="" />
                  ))}
                </span>
              </RarityCard>
            )
          })}
          {candidates && candidates.length === 0 && (
            <p className="box-empty-hint">Register Pokémon found in the wild to hunt them here.</p>
          )}
          {candidates && candidates.length > 0 && shown.length === 0 && (
            <p className="box-empty-hint">No Pokémon match that search.</p>
          )}
        </div>
        <div className="editor-actions">
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default DexNavPanel
