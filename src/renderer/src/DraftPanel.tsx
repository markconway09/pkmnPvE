import { useEffect, useRef, useState } from 'react'
import { FIELD_START_TERRAINS, FIELD_START_WEATHERS, type BattleView, type BoxPokemonView, type StatBlock } from '../../shared/battle-types'
import {
  CHAOS_MON_MODIFIER_CAP,
  CHAOS_MON_MODIFIERS,
  CHAOS_OFFER_SIZE,
  CHAOS_STAT_LABELS,
  chaosModifierPin,
  type ChaosField,
  type ChaosModifier,
  type ChaosModifierTarget,
  type ChaosTutorMove,
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
import ItemSprite from './ItemSprite'
import { CLICK, CLICK_LC } from './platform'
import { ONLINE_CHAOS_BATTLES, ONLINE_CHAOS_WINS } from '../../shared/online'
import { leaveOnlineDraft, pickOnlineDraftLead, showDraftView, type OnlineDraftState } from './online'

// The Shiny Patch's icon (see ItemSprite).
const SHINY_PATCH_SPRITENUM = -8

interface Props {
  // Another fight (or the menu) holds things up.
  busy: boolean
  // A gauntlet battle has started - App takes it from here like any battle.
  onBattle: (view: BattleView) => Promise<void>
  // Bumped by the menu when a window that can change coins (Game Corner, shops) closes.
  refreshKey?: number
  // An online chaos draft with a friend (see online.ts): its screens come from the room,
  // its steps go to the online draft, and each battle waits for both players' leads.
  online?: OnlineDraftState & { friendName: string }
  // Connected with a friend online: the gauntlet's battles can't start (the draft itself goes on).
  battleLocked?: boolean
}

// The four brought last time (by pick index, in order) - kept while the game runs, so
// coming back from a battle doesn't mean picking them all over again.
let lastBring: number[] = []

// The format picked for the next draft - remembered in this browser's storage, as it's
// only a preference.
const FORMAT_KEY = 'pkmnpve.draftFormat'

function loadFormat(): DraftFormat {
  try {
    const saved = localStorage.getItem(FORMAT_KEY)
    return saved === 'singles' || saved === 'chaos' ? saved : 'doubles'
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

function formatLabel(format: DraftFormat): string {
  return format === 'chaos' ? 'Chaos' : format === 'singles' ? 'Singles' : 'Doubles'
}

function fieldLabel(kind: 'weather' | 'terrain', id: string): string {
  const option = (kind === 'weather' ? FIELD_START_WEATHERS : FIELD_START_TERRAINS).find((o) => o.id === id)
  return kind === 'weather' ? (option?.label ?? id) : `${option?.label ?? id} Terrain`
}

// A chaos modifier's chip: its name, and what it does (shown once it's picked).
function modifierText(modifier: ChaosModifier): { icon: string; title: string; text: string } {
  switch (modifier.kind) {
    case 'weather':
      return { icon: '☀', title: fieldLabel('weather', modifier.id), text: 'Every battle starts in it, until a move or ability replaces it' }
    case 'terrain':
      return { icon: '⛰', title: fieldLabel('terrain', modifier.id), text: 'Every battle starts with it, until a move or ability replaces it' }
    case 'trickroom':
      return { icon: '⧗', title: 'Trick Room', text: 'Every battle starts in Trick Room (slower Pokémon move first) - until someone uses Trick Room' }
    case 'tailwind':
      return { icon: '༄', title: 'Tailwind Start', text: 'Tailwind on your side for the first 4 turns of every battle' }
    case 'screens':
      return { icon: '▣', title: 'Screens Up', text: 'Reflect and Light Screen on your side for the first 5 turns of every battle' }
    case 'hazard':
      return modifier.id === 'stealthrock'
        ? { icon: '◆', title: 'Stealth Rock', text: "Stealth Rock on the opponent's side from the start of every battle" }
        : modifier.id === 'stickyweb'
          ? { icon: '✱', title: 'Sticky Web', text: "Sticky Web on the opponent's side from the start of every battle (-1 Speed on switch-in)" }
          : { icon: '⋀', title: 'Spikes', text: "A layer of Spikes on the opponent's side from the start of every battle (up to 3)" }
    case 'intimidate':
      return { icon: '☠', title: 'Intimidating Aura', text: "The opponent's lead starts every battle at -1 Attack, Sp. Atk and Speed" }
    case 'ability':
      return { icon: '✦', title: 'Ability Change', text: 'Give one of your Pokémon any ability' }
    case 'stat':
      return { icon: '▲', title: 'Stat Boost', text: '+50% to one stat of one of your Pokémon, for good' }
    case 'tutor':
      return { icon: '✎', title: 'Move Tutor', text: 'Swap one of its moves for any move in the game' }
    case 'fortress':
      return { icon: '⛨', title: 'Fortress', text: '+50% HP, Defense and Sp. Def, -30% Attack, Sp. Atk and Speed' }
    case 'glasscannon':
      return { icon: '✸', title: 'Glass Cannon', text: '+50% Attack, Sp. Atk and Speed, -30% Defense and Sp. Def' }
    case 'lockon':
      return { icon: '◎', title: 'Lock-On', text: 'Its moves never miss (not one-hit KO moves) - take it twice for +1 crit stage too' }
    case 'wildcard':
      return { icon: '⁇', title: 'Wild Card', text: 'Swap it for a random Pokémon from the tier above (its stat modifiers stay)' }
  }
}

// The modifier offer's rows, in order.
const MODIFIER_GROUPS: { label: string; kinds: ChaosModifier['kind'][] }[] = [
  { label: 'Weather', kinds: ['weather'] },
  { label: 'Terrain', kinds: ['terrain'] },
  { label: 'Battle start', kinds: ['trickroom', 'tailwind', 'screens', 'hazard', 'intimidate'] },
  { label: 'Pokémon', kinds: CHAOS_MON_MODIFIERS }
]

// The chaos field so far, as chips (nothing while it's empty).
function ChaosFieldChips({ field }: { field?: ChaosField }): React.JSX.Element | null {
  if (!field) return null
  const chips = [
    field.weather ? fieldLabel('weather', field.weather) : null,
    field.terrain ? fieldLabel('terrain', field.terrain) : null,
    field.trickRoom ? 'Trick Room' : null,
    field.tailwind ? 'Tailwind' : null,
    field.screens ? 'Screens' : null,
    field.stealthRock ? 'Stealth Rock' : null,
    field.stickyWeb ? 'Sticky Web' : null,
    field.spikes ? `Spikes${field.spikes > 1 ? ` x${field.spikes}` : ''}` : null,
    field.intimidate ? 'Intimidating Aura' : null
  ].filter((c): c is string => !!c)
  if (chips.length === 0) return null
  return (
    <span className="draft-tiers" title="Every chaos battle starts with these">
      {chips.map((chip) => (
        <span key={chip} className="draft-tier-chip draft-chaos-chip">
          {chip}
        </span>
      ))}
    </span>
  )
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
      {mon.chaosTags && <span className="draft-chaos-boosts">{mon.chaosTags.join(' · ')}</span>}
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
function DraftPanel({ busy, onBattle, refreshKey, online, battleLocked }: Props): React.JSX.Element {
  const [soloDraft, setSoloDraft] = useState<DraftView | null>(null)
  const [soloLoaded, setLoaded] = useState(false)
  const draft = online ? online.view : soloDraft
  const loaded = !!online || soloLoaded
  // Online, every step goes to the online draft and its screen back to the room.
  const setDraft = (view: DraftView): void => (online ? showDraftView(view) : setSoloDraft(view))
  const draftApi = online
    ? {
        pick: window.api.pickOnlineDraftMon,
        reroll: window.api.rerollOnlineDraft,
        swapItem: window.api.swapOnlineDraftItem,
        tutorMoves: window.api.getOnlineDraftTutorMoves,
        modifier: window.api.chooseOnlineDraftModifier
      }
    : {
        pick: window.api.pickDraftMon,
        reroll: window.api.rerollDraftPack,
        swapItem: window.api.swapChaosItem,
        tutorMoves: window.api.getChaosTutorMoves,
        modifier: window.api.chooseChaosModifier
      }
  const [coins, setCoins] = useState<number | null>(null)
  // What a draft costs to enter (less with the Grand Drafter title).
  const [entryFee, setEntryFee] = useState<number | null>(null)
  // Today's first full gauntlet already gave its Shiny Patch.
  const [dailyWinClaimed, setDailyWinClaimed] = useState<boolean | null>(null)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bring, setBring] = useState<number[]>(lastBring)
  const [confirmingAbandon, setConfirmingAbandon] = useState(false)
  const [format, setFormat] = useState<DraftFormat>(loadFormat)
  // The team row's slots - a picked card flies into the next empty one.
  const slotRefs = useRef<(HTMLDivElement | null)[]>([])
  // The pick that just landed, to pop it into its slot.
  const [justPicked, setJustPicked] = useState<number | null>(null)
  // Chaos: the modifier being taken, and (for a Pokemon one) its Pokemon and what goes on it.
  const [modifierIndex, setModifierIndex] = useState<number | null>(null)
  const [modifierMon, setModifierMon] = useState<number | null>(null)
  const [modifierStat, setModifierStat] = useState<keyof StatBlock | null>(null)
  const [modifierAbility, setModifierAbility] = useState<string | null>(null)
  // Chaos: the free item swap - open instead of a modifier, its Pokemon and its new item.
  const [swapping, setSwapping] = useState(false)
  const [modifierItem, setModifierItem] = useState<string | null>(null)
  const [tutorSlot, setTutorSlot] = useState<number | null>(null)
  const [tutorMove, setTutorMove] = useState<string | null>(null)
  const [tutorMoves, setTutorMoves] = useState<ChaosTutorMove[]>([])
  const [listFilter, setListFilter] = useState('')
  const [chaosAbilities, setChaosAbilities] = useState<{ id: string; name: string; description: string }[]>([])
  const [chaosItems, setChaosItems] = useState<{ id: string; name: string; description: string; spritenum: number }[]>([])

  function refresh(): void {
    if (online) return
    window.api
      .getDraft()
      .then((d) => {
        setSoloDraft(d)
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
    window.api
      .getDraftDailyWinClaimed()
      .then(setDailyWinClaimed)
      .catch(() => setDailyWinClaimed(null))
  }

  useEffect(refresh, [refreshKey])

  // Picking another modifier or Pokemon starts its choices over.
  function resetModifierChoices(): void {
    setModifierStat(null)
    setModifierAbility(null)
    setModifierItem(null)
    setTutorSlot(null)
    setTutorMove(null)
    setTutorMoves([])
    setListFilter('')
  }

  // A fresh modifier offer starts with nothing chosen; the ability and item lists load the first time they're needed.
  const offerKey = draft?.status === 'modifier' ? `${draft.wins}-${draft.losses}-${draft.picks.length}-${JSON.stringify(draft.modifierOffer)}` : ''
  useEffect(() => {
    setModifierIndex(null)
    setModifierMon(null)
    setSwapping(false)
    resetModifierChoices()
    if (offerKey && chaosAbilities.length === 0) {
      window.api
        .getChaosAbilities()
        .then(setChaosAbilities)
        .catch(() => {})
    }
    if (offerKey && chaosItems.length === 0) {
      window.api
        .getChaosItems()
        .then(setChaosItems)
        .catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offerKey])

  // Move Tutor: every move the chosen Pokemon can be taught.
  const tutorFor = draft?.status === 'modifier' && modifierIndex !== null && draft.modifierOffer?.[modifierIndex]?.kind === 'tutor' ? modifierMon : null
  useEffect(() => {
    if (tutorFor === null) return
    draftApi
      .tutorMoves(tutorFor)
      .then(setTutorMoves)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorFor])

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
    const count = draftBring(draft?.format ?? 'doubles', draft?.picks.length)
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

  // ---- Online: the match is over ----
  if (online && draft?.status === 'finished') {
    const ties = draft.ties ?? 0
    const outcome = draft.wins > draft.losses ? 'won' : draft.wins < draft.losses ? 'lost' : 'drew'
    return (
      <div className="run-panel draft-panel online-draft-over">
        <p className={`run-result ${outcome === 'won' ? 'run-result-won' : 'run-result-lost'}`}>
          {outcome === 'won' ? 'You won the match' : outcome === 'lost' ? `${online.friendName} won the match` : 'The match is a draw'}:{' '}
          {draft.wins}-{draft.losses}
          {ties > 0 ? ` (${ties} tie${ties > 1 ? 's' : ''})` : ''}
        </p>
        <div className="draft-team-row">
          {draft.picks.map((mon, i) => (
            <div key={i}>
              <DraftMonIcon mon={mon} />
            </div>
          ))}
        </div>
        <button className="run-start-button draft-start-button" onClick={leaveOnlineDraft}>
          Back to the room
        </button>
      </div>
    )
  }

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
          <div className="draft-format-picker">
          {/* Chaos: just for fun, above the two serious formats. */}
          <button
            className={`draft-format-tile draft-format-tile-chaos${format === 'chaos' ? ' draft-format-tile-selected' : ''}`}
            disabled={disabled}
            onClick={() => {
              setFormat('chaos')
              saveFormat('chaos')
            }}
          >
            <strong>Chaos</strong>
            <span className="draft-format-sub">
              Singles for fun · draft 2 at a time, permanent weather, Trick Room, ability swaps and stat boosts
            </span>
          </button>
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
              Last draft ({formatLabel(draft.format).toLowerCase()}): {draft.wins}-{draft.losses}
              {draft.reward > 0 ? ` · +${draft.reward.toLocaleString('en-US')} coins` : ''}
            </p>
          )}
          {error && <p className="editor-error">{error}</p>}
        </div>

        <div className="draft-home-side">
          <div className="draft-home-card">
            <h3>How it works</h3>
            {format === 'chaos' ? (
              <ul className="draft-rules">
                <li>
                  <span className="draft-rule-icon">1</span>
                  Draft 2, take 1 of {CHAOS_OFFER_SIZE} random modifiers, then battle a hard trainer with as many Pokémon as you
                </li>
                <li>
                  <span className="draft-rule-icon">2</span>
                  A modifier after every battle, win or lose - with 2 more picks before it every other battle until the team is full
                </li>
                <li>
                  <span className="draft-rule-icon">3</span>
                  Each Pokémon takes {CHAOS_MON_MODIFIER_CAP} modifiers at most - plus one free item swap every round
                </li>
                <li>
                  <span className="draft-rule-icon">4</span>
                  Ends at {DRAFT_MAX_WINS} wins or {DRAFT_MAX_LOSSES} losses
                </li>
              </ul>
            ) : (
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
            )}
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
            {/* The first full gauntlet each day gives a Shiny Patch. */}
            {dailyWinClaimed !== null && (
              <div className={`draft-daily-win${dailyWinClaimed ? ' draft-daily-win-claimed' : ''}`}>
                <ItemSprite spritenum={SHINY_PATCH_SPRITENUM} className="draft-daily-win-icon" />
                <span className="draft-daily-win-text">
                  <span className="draft-daily-win-name">Daily reward: Shiny Patch</span>
                  <span className="draft-daily-win-note">
                    {dailyWinClaimed ? 'Claimed today - back tomorrow' : `For your first ${DRAFT_MAX_WINS}-win gauntlet today`}
                  </span>
                </span>
                {dailyWinClaimed && <span className="draft-daily-win-check">✓ Claimed</span>}
              </div>
            )}
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
        if (online) {
          leaveOnlineDraft()
          return
        }
        void act(async () => {
          setDraft(await window.api.abandonDraft())
          setCoins(await window.api.getCoins())
        })
      }}
      onMouseLeave={() => setConfirmingAbandon(false)}
    >
      {confirmingAbandon ? `${online ? 'Leave' : 'Abandon'}? ${CLICK} again` : online ? 'Leave match' : 'Abandon draft'}
    </button>
  )
  // Online: whether the friend is done picking for the next battle.
  const friendReady = online && draft.opponent ? (
    <span className="draft-tier-chip online-draft-ready">{online.friendName} is ready</span>
  ) : null

  // ---- Drafting: one from the pack ----
  if (draft.status === 'drafting') {
    return (
      <div className="run-panel draft-panel">
        <div className="run-status-row">
          <span>
            {formatLabel(draft.format)} draft{online ? ` vs ${online.friendName}` : ''} · Pick <strong>{draft.round}</strong> of{' '}
            {draft.pickTarget ?? DRAFT_ROUNDS}
          </span>
          {friendReady}
          <TierChips tiers={draft.tiers} />
          <ChaosFieldChips field={draft.chaosField} />
          {/* Chaos: one fresh pack per drafting stretch. */}
          {draft.format === 'chaos' && (
            <button
              className="run-forfeit-button draft-reroll-button"
              disabled={disabled || !draft.canReroll}
              title={draft.canReroll ? 'Swap this pack for a new one - once per draft phase' : 'Already rerolled this draft phase'}
              onClick={() =>
                void act(async () => {
                  setDraft(await draftApi.reroll())
                })
              }
            >
              {draft.canReroll ? 'Reroll pack' : 'Rerolled'}
            </button>
          )}
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
            return draftApi.pick(i)
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

  const recordPips = online ? (
    <>
      {/* First to ONLINE_CHAOS_WINS, over ONLINE_CHAOS_BATTLES battles at most. */}
      <span className="draft-record" title={`First to ${ONLINE_CHAOS_WINS} wins - ${ONLINE_CHAOS_BATTLES} battles at most`}>
        You <Pips count={draft.wins} max={ONLINE_CHAOS_WINS} kind="win" />
      </span>
      <span className="draft-record">
        {online.friendName} <Pips count={draft.losses} max={ONLINE_CHAOS_WINS} kind="loss" />
      </span>
      {(draft.ties ?? 0) > 0 && <span className="draft-record">Ties {draft.ties}</span>}
    </>
  ) : (
    <>
      <span className="draft-record">
        Wins <Pips count={draft.wins} max={DRAFT_MAX_WINS} kind="win" />
      </span>
      <span className="draft-record">
        Losses <Pips count={draft.losses} max={DRAFT_MAX_LOSSES} kind="loss" />
      </span>
    </>
  )

  // ---- Chaos: one of the offered modifiers (and the free item swap in the corner) ----
  if (draft.status === 'modifier') {
    const offer = draft.modifierOffer ?? []
    const chosen = !swapping && modifierIndex !== null ? offer[modifierIndex] : null
    const needsMon = swapping || (!!chosen && CHAOS_MON_MODIFIERS.includes(chosen.kind))
    // A pinned Pokemon modifier can only go on its own Pokemon.
    const pin = chosen ? chaosModifierPin(chosen) : undefined
    const mon = modifierMon !== null ? draft.picks[modifierMon] : null
    // What the chosen modifier (or the item swap) still needs, or null once it can be done.
    const missing = swapping
      ? !mon
        ? 'Pick a Pokémon'
        : !modifierItem
          ? 'Pick an item'
          : null
      : !chosen
        ? 'Pick a modifier'
        : !needsMon
          ? null
          : !mon
            ? 'Pick a Pokémon'
            : chosen.kind === 'ability' && !modifierAbility
              ? 'Pick an ability'
              : chosen.kind === 'stat' && !modifierStat
                ? 'Pick a stat'
                : chosen.kind === 'tutor' && (tutorSlot === null || !tutorMove)
                  ? tutorSlot === null
                    ? 'Pick a move to forget'
                    : 'Pick a move to learn'
                  : null
    const filter = listFilter.trim().toLowerCase()
    // The searchable list for an Ability, item or move.
    const searchList = (
      entries: { id: string; name: string; description: string; spritenum?: number }[],
      value: string | null,
      onPick: (id: string) => void,
      placeholder: string
    ): React.JSX.Element => (
      <div className="draft-modifier-abilities">
        <input className="draft-ability-filter" placeholder={placeholder} value={listFilter} onChange={(e) => setListFilter(e.target.value)} />
        <div className="draft-ability-list">
          {entries
            .filter((e) => !filter || e.name.toLowerCase().includes(filter))
            .map((e) => (
              <button
                key={e.id}
                type="button"
                className={`draft-ability-option${value === e.id ? ' draft-ability-option-on' : ''}`}
                disabled={disabled}
                onClick={() => onPick(e.id)}
              >
                <strong>
                  {e.spritenum !== undefined && <ItemSprite spritenum={e.spritenum} />}
                  {e.name}
                </strong>
                <span>{e.description}</span>
              </button>
            ))}
        </div>
      </div>
    )
    // The offer as cards, grouped in MODIFIER_GROUPS order.
    const cards = MODIFIER_GROUPS.flatMap((group) =>
      offer.flatMap((modifier, i) => (group.kinds.includes(modifier.kind) ? [{ modifier, i, group: group.label }] : []))
    )
    return (
      <div className="run-panel draft-panel">
        <div className="run-status-row">
          <span>Chaos{online ? ` vs ${online.friendName}` : ''} · Pick a modifier</span>
          {friendReady}
          <TierChips tiers={draft.tiers} />
          <ChaosFieldChips field={draft.chaosField} />
          {/* One fresh offer per modifier step. */}
          <button
            className="run-forfeit-button draft-reroll-button"
            disabled={disabled || !draft.canReroll}
            title={draft.canReroll ? 'Swap these modifiers for new ones - once per modifier step' : 'Already rerolled these modifiers'}
            onClick={() =>
              void act(async () => {
                setDraft(await window.api.rerollDraftPack())
              })
            }
          >
            {draft.canReroll ? 'Reroll modifiers' : 'Rerolled'}
          </button>
          {recordPips}
          {abandonButton}
        </div>
        <div className="draft-modifier-head">
          <span className="draft-modifier-heading">
            Take 1 of {offer.length}
          </span>
          {/* The free item swap, once a round - not a modifier, so it doesn't count toward the cap. */}
          <button
            type="button"
            className={`draft-item-swap${swapping ? ' draft-item-swap-on' : ''}`}
            disabled={disabled || !draft.canSwapItem}
            title={draft.canSwapItem ? 'Give one of your Pokémon any held item - free, once per round' : 'Already swapped an item this round'}
            onClick={() => {
              setSwapping(!swapping)
              setModifierIndex(null)
              setModifierMon(null)
              resetModifierChoices()
            }}
          >
            <span className="draft-item-swap-icon" aria-hidden="true">
              ◈
            </span>
            <span className="draft-item-swap-text">
              <strong>Item swap</strong>
              <span>{draft.canSwapItem ? (swapping ? 'Cancel' : '1 free this round') : 'Used this round'}</span>
            </span>
          </button>
        </div>
        {/* The offered modifiers as big cards - a pinned one names its Pokemon. */}
        <div className={`draft-modifier-cards${swapping ? ' draft-modifier-cards-dim' : ''}`}>
          {cards.map(({ modifier, i, group }) => {
            const text = modifierText(modifier)
            const pinned = chaosModifierPin(modifier)
            return (
              <button
                key={i}
                type="button"
                className={`draft-modifier-card draft-modifier-${modifier.kind}${modifierIndex === i && !swapping ? ' draft-modifier-chosen' : ''}`}
                disabled={disabled}
                onClick={() => {
                  setSwapping(false)
                  setModifierIndex(i)
                  setModifierMon(pinned ?? null)
                  resetModifierChoices()
                }}
              >
                <span className="draft-modifier-card-group">{group}</span>
                <span className="draft-modifier-icon" aria-hidden="true">
                  {text.icon}
                </span>
                <strong className="draft-modifier-card-title">{text.title}</strong>
                <span className="draft-modifier-card-text">{text.text}</span>
                {pinned !== undefined && draft.picks[pinned] && <span className="draft-modifier-pin">Only for {draft.picks[pinned].species}</span>}
              </button>
            )
          })}
        </div>
        {/* The whole team is always on show - clickable when a Pokemon modifier or the item swap needs one. */}
        <p className="box-empty-hint">
          {swapping
            ? 'Which Pokémon gets a new item?'
            : !needsMon
              ? 'Your team'
              : pin !== undefined
                ? `Only for ${draft.picks[pin]?.species ?? 'one Pokémon'}`
                : `Which Pokémon? Each takes ${CHAOS_MON_MODIFIER_CAP} Pokémon modifiers at most`}
        </p>
        <div className="draft-team-row">
          {draft.picks.map((pick, i) => {
            const full = !swapping && (pick.chaosModifiers ?? 0) >= CHAOS_MON_MODIFIER_CAP
            return needsMon ? (
              <button
                key={i}
                type="button"
                className={`draft-bring-button${modifierMon === i ? ' draft-bring-chosen' : ''}`}
                disabled={disabled || (pin !== undefined && pin !== i) || full}
                title={full ? `Already has ${CHAOS_MON_MODIFIER_CAP} modifiers` : undefined}
                onClick={() => {
                  setModifierMon(i)
                  resetModifierChoices()
                }}
              >
                <DraftMonIcon mon={pick} />
                {modifierMon === i && (
                  <span className="draft-bring-order draft-bring-lead">{swapping ? pick.item || 'No item' : pick.ability}</span>
                )}
              </button>
            ) : (
              <div key={i}>
                <DraftMonIcon mon={pick} />
              </div>
            )
          })}
        </div>
        {chosen?.kind === 'stat' && mon && (
          <div className="trainer-chips draft-modifier-choices">
            {(Object.keys(CHAOS_STAT_LABELS) as (keyof StatBlock)[]).map((stat) => (
              <button
                key={stat}
                type="button"
                className={`trainer-chip${modifierStat === stat ? ' trainer-chip-on' : ''}`}
                disabled={disabled}
                onClick={() => setModifierStat(stat)}
              >
                {CHAOS_STAT_LABELS[stat]} {mon.stats[stat]}
              </button>
            ))}
          </div>
        )}
        {chosen?.kind === 'ability' && mon && searchList(chaosAbilities, modifierAbility, setModifierAbility, 'Search abilities...')}
        {swapping && mon && searchList(chaosItems, modifierItem, setModifierItem, 'Search items...')}
        {chosen?.kind === 'tutor' && mon && (
          <div className="draft-tutor">
            <div className="trainer-chips draft-modifier-choices">
              <span className="draft-modifier-group-label">Forget</span>
              {mon.moveList.map((move, slot) => (
                <button
                  key={slot}
                  type="button"
                  className={`trainer-chip${tutorSlot === slot ? ' trainer-chip-on' : ''}`}
                  disabled={disabled}
                  onClick={() => setTutorSlot(slot)}
                >
                  {move.name}
                </button>
              ))}
            </div>
            <span className="draft-modifier-group-label">Learn</span>
            {searchList(
              tutorMoves.map((move) => ({ id: move.id, name: move.name, description: `${move.type} · ${move.category} - ${move.description}` })),
              tutorMove,
              setTutorMove,
              'Search moves...'
            )}
          </div>
        )}
        <button
          className="run-start-button draft-start-button"
          disabled={disabled || missing !== null}
          onClick={() =>
            void act(async () => {
              // The item swap leaves the modifier step open; a modifier moves on to the battle.
              if (swapping) {
                setDraft(await draftApi.swapItem(modifierMon!, modifierItem!))
                setSwapping(false)
                setModifierMon(null)
                resetModifierChoices()
                return
              }
              const target: ChaosModifierTarget | undefined =
                needsMon && modifierMon !== null
                  ? {
                      pick: modifierMon,
                      ability: modifierAbility ?? undefined,
                      stat: modifierStat ?? undefined,
                      moveSlot: tutorSlot ?? undefined,
                      newMove: tutorMove ?? undefined
                    }
                  : undefined
              setDraft(await draftApi.modifier(modifierIndex!, target))
              lastBring = []
              setBring([])
            })
          }
        >
          {missing ?? (swapping ? 'Swap item' : 'Take it')}
        </button>
        {error && <p className="editor-error">{error}</p>}
      </div>
    )
  }

  // ---- The gauntlet: next opponent, and the three or four to bring ----
  const opponent = draft.opponent
  const bringCount = draftBring(draft.format, draft.picks.length)
  const leads = draftLeads(draft.format)
  const validBring = bring.filter((i) => i < draft.picks.length).slice(0, bringCount)
  const battleNumber = draft.wins + draft.losses + (draft.ties ?? 0) + 1
  // Online: the friend is still picking - a standby until their team arrives.
  if (online && !opponent) {
    return (
      <div className="run-panel draft-panel">
        <div className="run-status-row">
          <span>Chaos vs {online.friendName}</span>
          <TierChips tiers={draft.tiers} />
          <ChaosFieldChips field={draft.chaosField} />
          {recordPips}
          {abandonButton}
        </div>
        <div className="online-draft-standby">
          <span className="online-draft-spinner" aria-hidden="true" />
          <span>Waiting for {online.friendName} to pick their Pokémon and modifier...</span>
        </div>
        <p className="box-empty-hint">Your team</p>
        <div className="draft-team-row">
          {draft.picks.map((mon, i) => (
            <div key={i}>
              <DraftMonIcon mon={mon} />
            </div>
          ))}
        </div>
        {error && <p className="editor-error">{error}</p>}
      </div>
    )
  }
  return (
    <div className="run-panel draft-panel">
      <div className="run-status-row">
        <span>{formatLabel(draft.format)}</span>
        <TierChips tiers={draft.tiers} />
        <ChaosFieldChips field={draft.chaosField} />
        {recordPips}
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
              Battle {battleNumber}: <strong>{opponent.name}</strong>
              <span className="box-empty-hint">
                {online
                  ? ` - bringing all ${opponent.team.length}`
                  : draft.format === 'chaos'
                    ? ` - a hard trainer, bringing all ${bringCount}`
                    : ` - brings ${bringCount} of these`}
              </span>
              <ChaosFieldChips field={opponent.chaosField} />
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
        {online
          ? online.leadPicked
            ? ''
            : `All ${bringCount} go in - ${CLICK_LC} one to lead.${online.friendLeadPicked ? ` ${online.friendName} has picked their lead.` : ''}`
          : draft.format === 'chaos'
          ? `All ${bringCount} go in - ${CLICK_LC} one to lead and start the battle.`
          : `Pick ${bringCount} to bring, in order - ${leadText(draft.format)}.`}
      </p>
      <div className="draft-team-row">
        {draft.picks.map((mon, i) => {
          // Chaos: the whole team goes in, so a click picks the lead and starts the battle
          // (the rest follow in team order).
          if (draft.format === 'chaos') {
            return (
              <button
                key={i}
                type="button"
                className="draft-bring-button draft-chaos-lead-button"
                disabled={disabled || !!online?.leadPicked || (!online && battleLocked)}
                title={!online && battleLocked ? 'Leave the online room first' : undefined}
                onClick={() => {
                  const order = [i, ...draft.picks.map((_, j) => j).filter((j) => j !== i)]
                  // Online: the lead goes to the room; the battle starts once both have picked.
                  if (online) {
                    setError(null)
                    pickOnlineDraftLead(order)
                    return
                  }
                  void act(async () => {
                    await onBattle(await window.api.startDraftBattle(order))
                  })
                }}
              >
                <DraftMonIcon mon={mon} />
              </button>
            )
          }
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
      {online?.leadPicked && (
        <div className="online-draft-standby">
          <span className="online-draft-spinner" aria-hidden="true" />
          <span>
            {online.friendLeadPicked ? 'Starting the battle...' : `Lead picked - waiting for ${online.friendName} to pick theirs...`}
          </span>
        </div>
      )}
      {draft.format !== 'chaos' && (
        <button
          className="run-start-button draft-start-button"
          disabled={disabled || validBring.length !== bringCount || battleLocked}
          title={battleLocked ? 'Leave the online room first' : undefined}
          onClick={() =>
            void act(async () => {
              await onBattle(await window.api.startDraftBattle(validBring))
            })
          }
        >
          {validBring.length === bringCount ? 'Battle!' : `Pick ${bringCount - validBring.length} more`}
        </button>
      )}
      {error && <p className="editor-error">{error}</p>}
    </div>
  )
}

export default DraftPanel
