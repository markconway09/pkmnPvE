import { useEffect, useRef, useState } from 'react'
import type { BattleView, BoxPokemonView } from '../../shared/battle-types'
import {
  DRAFT_FORMATS,
  draftBring,
  draftLeads,
  DRAFT_LEVEL,
  DRAFT_MAX_LOSSES,
  DRAFT_MAX_WINS,
  DRAFT_PACK_SIZE,
  DRAFT_REWARDS,
  DRAFT_ROUNDS,
  type DraftFormat,
  type DraftMonView,
  type DraftView
} from '../../shared/draft'
import Tooltip from './Tooltip'
import PokemonTooltipContent from './PokemonTooltipContent'
import PokemonIconVisual from './PokemonIconVisual'
import CoinIcon from './CoinIcon'
import { DraftPackOpening, OpponentReveal } from './DraftPackOpening'
import { trainerSpriteUrl } from './trainerSprite'

interface Props {
  // Another fight (or the menu) holds things up.
  busy: boolean
  // A gauntlet battle has started - App takes it from here like any battle.
  onBattle: (view: BattleView) => Promise<void>
  // Bumped by the menu when a window that can change coins (Game Corner, shops) closes.
  refreshKey?: number
}

// The four brought last time (by pick index, in order) - kept while the game runs, so
// coming back from a battle doesn't mean picking them all over again.
let lastBring: number[] = []

// The format picked for the next draft - remembered in this browser's storage, as it's
// only a preference.
const FORMAT_KEY = 'pkmnpve.draftFormat'

function loadFormat(): DraftFormat {
  try {
    return localStorage.getItem(FORMAT_KEY) === 'singles' ? 'singles' : 'doubles'
  } catch {
    return 'doubles'
  }
}

function saveFormat(format: DraftFormat): void {
  try {
    localStorage.setItem(FORMAT_KEY, format)
  } catch {
    // Not remembered - it only picks which button starts lit.
  }
}

// "the first leads" / "the first two lead".
function leadText(format: DraftFormat): string {
  return draftLeads(format) === 1 ? 'the first leads' : 'the first two lead'
}

// A Pokemon as a small box-style card, its whole set on hover.
function DraftMonIcon({ mon }: { mon: DraftMonView }): React.JSX.Element {
  const asBoxMon = { ...mon, id: mon.species } as unknown as BoxPokemonView
  return (
    <Tooltip className={`draft-mon-icon rarity-card rarity-tier-${mon.rarityTier}`} placement="above" content={<PokemonTooltipContent pokemon={mon} />}>
      <div className="box-icon box-icon-fill">
        <div className="box-icon-draggable">
          <PokemonIconVisual mon={asBoxMon} />
        </div>
      </div>
    </Tooltip>
  )
}

// The tiers a singles draft's Pokemon come from (nothing for doubles).
function TierChips({ tiers }: { tiers: string[] | null }): React.JSX.Element | null {
  if (!tiers || tiers.length === 0) return null
  return (
    <span className="draft-tiers" title="Every Pokémon in this draft - yours and your opponents' - comes from these tiers">
      {tiers.map((tier) => (
        <span key={tier} className="draft-tier-chip">
          {tier}
        </span>
      ))}
    </span>
  )
}

// A row of pips: filled for each one counted so far.
function Pips({ count, max, kind }: { count: number; max: number; kind: 'win' | 'loss' }): React.JSX.Element {
  return (
    <span className="draft-pips">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={`draft-pip draft-pip-${kind}${i < count ? ' draft-pip-on' : ''}`} />
      ))}
    </span>
  )
}

// Draft mode's half of the main menu: starting a draft, picking from packs, then the
// gauntlet - who's next, and which four of the six to bring against them.
function DraftPanel({ busy, onBattle, refreshKey }: Props): React.JSX.Element {
  const [draft, setDraft] = useState<DraftView | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [coins, setCoins] = useState<number | null>(null)
  // What a draft costs to enter (less with the Grand Drafter title).
  const [entryFee, setEntryFee] = useState<number | null>(null)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bring, setBring] = useState<number[]>(lastBring)
  const [confirmingAbandon, setConfirmingAbandon] = useState(false)
  const [format, setFormat] = useState<DraftFormat>(loadFormat)
  // The team row's slots - a picked card flies into the next empty one.
  const slotRefs = useRef<(HTMLDivElement | null)[]>([])
  // The pick that just landed, to pop it into its slot.
  const [justPicked, setJustPicked] = useState<number | null>(null)

  function refresh(): void {
    window.api
      .getDraft()
      .then((d) => {
        setDraft(d)
        setLoaded(true)
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
    window.api
      .getCoins()
      .then(setCoins)
      .catch(() => setCoins(null))
    window.api
      .getDraftEntryFee()
      .then(setEntryFee)
      .catch(() => setEntryFee(null))
  }

  useEffect(refresh, [refreshKey])

  // Every draft action goes through here: one at a time, and a failure is shown.
  async function act(action: () => Promise<void>): Promise<void> {
    setWorking(true)
    setError(null)
    try {
      await action()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setWorking(false)
    }
  }

  function toggleBring(index: number): void {
    const count = draftBring(draft?.format ?? 'doubles')
    const next = bring.includes(index)
      ? bring.filter((i) => i !== index)
      : bring.length < count
        ? [...bring, index]
        : bring
    lastBring = next
    setBring(next)
  }

  const disabled = busy || working
  if (!loaded) return <div className="run-panel">{error && <p className="editor-error">{error}</p>}</div>

  // ---- No draft going: how it works, and the button to start one ----
  if (!draft || draft.status === 'finished') {
    const fee = entryFee ?? 0
    const canAfford = entryFee !== null && (coins ?? 0) >= fee
    const topReward = DRAFT_REWARDS[DRAFT_REWARDS.length - 1]
    return (
      <div className="run-panel draft-panel draft-home">
        <div className="draft-home-main">
          {/* A fanned hand of draft cards over the title. */}
          <div className="draft-home-hero">
            <div className="draft-home-fan" aria-hidden="true">
              {[-1, 0, 1].map((i) => (
                <img key={i} className="draft-home-fan-card" style={{ '--fan': i } as React.CSSProperties} src="./icons/nav/draft.png" alt="" />
              ))}
            </div>
            <div className="draft-home-title">
              <h2>Draft</h2>
              <span>Build a team from packs, then battle the gauntlet</span>
            </div>
          </div>
          <div className="draft-format-tiles">
            {DRAFT_FORMATS.map((f) => (
              <button
                key={f.id}
                className={`draft-format-tile${format === f.id ? ' draft-format-tile-selected' : ''}`}
                disabled={disabled}
                onClick={() => {
                  setFormat(f.id)
                  saveFormat(f.id)
                }}
              >
                {/* Who's on the field: one a side, or two. */}
                <span className="draft-format-field" aria-hidden="true">
                  {Array.from({ length: draftLeads(f.id) }, (_, i) => (
                    <span key={`a${i}`} className="draft-format-ball draft-format-ball-you" />
                  ))}
                  <span className="draft-format-vs">vs</span>
                  {Array.from({ length: draftLeads(f.id) }, (_, i) => (
                    <span key={`b${i}`} className="draft-format-ball" />
                  ))}
                </span>
                <strong>{f.label}</strong>
                <span className="draft-format-sub">
                  Bring {draftBring(f.id)} of {DRAFT_ROUNDS} · {f.id === 'singles' ? 'Gen 9 Ubers-ZU sets' : 'Doubles OU sets'}
                </span>
              </button>
            ))}
          </div>
          <div className="draft-start-row">
            <button
              className="run-start-button draft-start-button"
              disabled={disabled || !canAfford}
              title={canAfford ? undefined : 'Not enough coins - buy some at the Coin Shop'}
              onClick={() =>
                void act(async () => {
                  setDraft(await window.api.startDraft(format))
                  lastBring = []
                  setBring([])
                  setCoins(await window.api.getCoins())
                })
              }
            >
              Start {format} draft · <CoinIcon /> {fee.toLocaleString('en-US')}
            </button>
            {coins !== null && (
              <span className={`draft-balance${canAfford ? '' : ' draft-balance-short'}`}>
                <CoinIcon /> {coins.toLocaleString('en-US')}
              </span>
            )}
          </div>
          {draft && (
            <p className={`run-result ${draft.wins > 0 ? 'run-result-won' : 'run-result-lost'}`}>
              Last draft ({draft.format}): {draft.wins}-{draft.losses}
              {draft.reward > 0 ? ` · +${draft.reward.toLocaleString('en-US')} coins` : ''}
            </p>
          )}
          {error && <p className="editor-error">{error}</p>}
        </div>

        <div className="draft-home-side">
          <div className="draft-home-card">
            <h3>How it works</h3>
            <ul className="draft-rules">
              <li>
                <span className="draft-rule-icon">1</span>
                Pick 1 of {DRAFT_PACK_SIZE}, {DRAFT_ROUNDS} times - Smogon sets with items, Lv {DRAFT_LEVEL}
              </li>
              <li>
                <span className="draft-rule-icon">2</span>
                See their whole team, bring {draftBring(format)} ({leadText(format)})
              </li>
              <li>
                <span className="draft-rule-icon">3</span>
                Fully healed before every battle
              </li>
              <li>
                <span className="draft-rule-icon">4</span>
                Ends at {DRAFT_MAX_WINS} wins or {DRAFT_MAX_LOSSES} losses
              </li>
            </ul>
          </div>
          <div className="draft-home-card">
            <h3>Rewards</h3>
            {/* Coins by wins, as bars - the perfect run in gold. */}
            <div className="draft-reward-ladder" title="Coins paid when the draft ends, by wins">
              {DRAFT_REWARDS.map((reward, wins) => (
                <div
                  key={wins}
                  className={`draft-reward-step${wins === DRAFT_MAX_WINS ? ' draft-reward-top' : ''}${
                    reward >= fee && (wins === 0 || DRAFT_REWARDS[wins - 1] < fee) ? ' draft-reward-even' : ''
                  }`}
                >
                  <span className="draft-reward-amount">{reward >= 1000 ? `${reward / 1000}k` : reward}</span>
                  <span className="draft-reward-track">
                    <span className="draft-reward-bar" style={{ height: `${Math.max(4, (reward / topReward) * 100)}%` }} />
                  </span>
                  <span className="draft-reward-wins">{wins}W</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const abandonButton = (
    <button
      className={`run-forfeit-button${confirmingAbandon ? ' confirm-button' : ''}`}
      disabled={disabled}
      onClick={() => {
        if (!confirmingAbandon) {
          setConfirmingAbandon(true)
          return
        }
        setConfirmingAbandon(false)
        void act(async () => {
          setDraft(await window.api.abandonDraft())
          setCoins(await window.api.getCoins())
        })
      }}
      onMouseLeave={() => setConfirmingAbandon(false)}
    >
      {confirmingAbandon ? 'Abandon? Click again' : 'Abandon draft'}
    </button>
  )

  // ---- Drafting: one from the pack ----
  if (draft.status === 'drafting') {
    return (
      <div className="run-panel draft-panel">
        <div className="run-status-row">
          <span>
            {draft.format === 'singles' ? 'Singles' : 'Doubles'} draft · Pick <strong>{draft.round}</strong> of {DRAFT_ROUNDS}
          </span>
          <TierChips tiers={draft.tiers} />
          {abandonButton}
        </div>
        <DraftPackOpening
          key={`${draft.round}:${draft.pack.map((m) => m.species).join(',')}`}
          pack={draft.pack}
          round={draft.round}
          disabled={disabled}
          slotFor={() => slotRefs.current[draft.picks.length] ?? null}
          requestPick={(i) => {
            setError(null)
            return window.api.pickDraftMon(i)
          }}
          onPicked={(view) => {
            setJustPicked(view.picks.length - 1)
            setDraft(view)
          }}
          onError={(e) => setError(e instanceof Error ? e.message : String(e))}
        />
        <div className="draft-team-row">
          {Array.from({ length: DRAFT_ROUNDS }, (_, i) => (
            <div
              key={i}
              ref={(el) => {
                slotRefs.current[i] = el
              }}
              className={draft.picks[i] ? (i === justPicked ? 'draft-slot-pop' : undefined) : 'team-slot draft-slot-empty'}
            >
              {draft.picks[i] ? <DraftMonIcon mon={draft.picks[i]} /> : <span className="team-slot-empty">{i + 1}</span>}
            </div>
          ))}
        </div>
        {error && <p className="editor-error">{error}</p>}
      </div>
    )
  }

  // ---- The gauntlet: next opponent, and the three or four to bring ----
  const opponent = draft.opponent
  const bringCount = draftBring(draft.format)
  const leads = draftLeads(draft.format)
  const validBring = bring.filter((i) => i < draft.picks.length).slice(0, bringCount)
  return (
    <div className="run-panel draft-panel">
      <div className="run-status-row">
        <span>{draft.format === 'singles' ? 'Singles' : 'Doubles'}</span>
        <TierChips tiers={draft.tiers} />
        <span className="draft-record">
          Wins <Pips count={draft.wins} max={DRAFT_MAX_WINS} kind="win" />
        </span>
        <span className="draft-record">
          Losses <Pips count={draft.losses} max={DRAFT_MAX_LOSSES} kind="loss" />
        </span>
        {abandonButton}
      </div>
      {opponent && (
        <OpponentReveal
          revealKey={`${draft.wins}-${draft.losses}-${opponent.name}-${opponent.team.map((m) => m.species).join(',')}`}
          className="draft-opponent"
        >
          <img data-reveal="trainer" className="draft-opponent-sprite" src={trainerSpriteUrl(opponent.spriteId)} alt="" />
          <div className="draft-opponent-side">
            <span className="draft-opponent-name">
              Battle {draft.wins + draft.losses + 1}: <strong>{opponent.name}</strong>
              <span className="box-empty-hint"> - brings {bringCount} of these</span>
            </span>
            <div className="draft-team-row">
              {opponent.team.map((mon, i) => (
                <div key={i} data-reveal="mon">
                  <DraftMonIcon mon={mon} />
                </div>
              ))}
            </div>
          </div>
        </OpponentReveal>
      )}
      <p className="box-empty-hint">
        Pick {bringCount} to bring, in order - {leadText(draft.format)}.
      </p>
      <div className="draft-team-row">
        {draft.picks.map((mon, i) => {
          const order = validBring.indexOf(i)
          return (
            <button
              key={i}
              type="button"
              className={`draft-bring-button${order >= 0 ? ' draft-bring-chosen' : ''}`}
              disabled={disabled}
              onClick={() => toggleBring(i)}
            >
              <DraftMonIcon mon={mon} />
              {order >= 0 && (
                <span className={`draft-bring-order${order < leads ? ' draft-bring-lead' : ''}`}>
                  {order < leads ? (leads === 1 ? 'Lead' : `Lead ${order + 1}`) : `#${order + 1}`}
                </span>
              )}
            </button>
          )
        })}
      </div>
      <button
        className="run-start-button draft-start-button"
        disabled={disabled || validBring.length !== bringCount}
        onClick={() =>
          void act(async () => {
            await onBattle(await window.api.startDraftBattle(validBring))
          })
        }
      >
        {validBring.length === bringCount ? 'Battle!' : `Pick ${bringCount - validBring.length} more`}
      </button>
      {error && <p className="editor-error">{error}</p>}
    </div>
  )
}

export default DraftPanel
