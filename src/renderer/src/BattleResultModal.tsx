import { useEffect, useState } from 'react'
import { RarityGlow } from './RarityCard'
import { createPortal } from 'react-dom'
import { DEFAULT_POKEBALL_ID, POKEBALL_PRICE, ROGUELITE_MAX_TEAM, toSpriteId } from '../../shared/battle-types'
import type { ExpGainResult, ItemDropResult, RunMonView } from '../../shared/battle-types'
import type { DraftBattleResult } from '../../shared/draft'
import { DRAFT_MAX_WINS } from '../../shared/draft'
import ItemSprite from './ItemSprite'
import SpriteImage from './SpriteImage'
import { formatMoney } from './money'
import { TmCard, TmQuickCheck } from './TmBits'
import type { TmInfo } from '../../shared/tms'

interface Props {
  winner: string | null
  expGains: ExpGainResult[]
  itemDrops: ItemDropResult[]
  moneyGained: number
  canCatch: boolean
  isWildBattle: boolean
  opponentShiny: boolean
  // A Roguelite run's battle: catching is free and joins the run's team, and the
  // Pokemon that fainted have left the run.
  runBattle?: boolean
  runFainted?: string[]
  // A run's trainer or boss beaten: a held item to pick waits on the run menu.
  runItemReward?: boolean
  // A won Max Raid: the boss that joined the box.
  raidCatch?: { species: string; shiny: boolean } | null
  raidStars?: number
  raidGigantamax?: boolean
  // A Max Raid (won or lost).
  isRaid?: boolean
  // A Draft mode battle: the draft's record after it.
  draftResult?: DraftBattleResult | null
  // A Classic wild win: one quick skill check for a TM from the area.
  tmQuickCheck?: boolean
  // TMs a beaten trainer gave.
  tmRewards?: TmInfo[]
  // A Classic wild battle: fight another wild Pokemon from the same area straight away.
  onRebattle?: () => Promise<void>
  onClose: () => void
}

function BattleResultModal({
  winner,
  expGains,
  itemDrops,
  moneyGained,
  canCatch,
  isWildBattle,
  opponentShiny,
  runBattle = false,
  runFainted = [],
  runItemReward = false,
  raidCatch = null,
  raidStars = 0,
  raidGigantamax = false,
  isRaid = false,
  draftResult = null,
  tmQuickCheck = false,
  tmRewards = [],
  onRebattle,
  onClose
}: Props): React.JSX.Element {
  // Which way out is waiting on a second click (leaving a shiny uncaught).
  const [confirmingLeave, setConfirmingLeave] = useState<'menu' | 'rebattle' | null>(null)
  const [rebattling, setRebattling] = useState(false)
  const [pokeballs, setPokeballs] = useState<number | null>(null)
  const [money, setMoney] = useState<number | null>(null)
  const [pokeballPrice, setPokeballPrice] = useState(POKEBALL_PRICE)
  const [caught, setCaught] = useState(false)
  // The Catching Charm made the catch free.
  const [freeCatch, setFreeCatch] = useState(false)
  // A run whose team is full picks who the catch replaces - the team, while choosing.
  const [replacing, setReplacing] = useState<RunMonView[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!canCatch || runBattle) return
    Promise.all([window.api.listBag(), window.api.getMoney(), window.api.listShop()])
      .then(([bag, m, shop]) => {
        setPokeballs(bag.find((i) => i.id === DEFAULT_POKEBALL_ID)?.quantity ?? 0)
        setMoney(m)
        setPokeballPrice(shop.find((i) => i.id === DEFAULT_POKEBALL_ID)?.price ?? POKEBALL_PRICE)
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [canCatch, runBattle])

  async function catchPokemon(replaceRunMonId?: string): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      if (runBattle && !replaceRunMonId) {
        const team = (await window.api.getRun())?.team ?? []
        if (team.length >= ROGUELITE_MAX_TEAM) {
          setReplacing(team)
          return
        }
      }
      const result = await window.api.catchWildPokemon(replaceRunMonId)
      setReplacing(null)
      setPokeballs(result.pokeballs)
      setMoney(result.money)
      setCaught(true)
      setFreeCatch(!!result.free)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const hasPokeballs = (pokeballs ?? 0) > 0
  const canAfford = (money ?? 0) >= pokeballPrice
  const catchDisabled = runBattle ? busy || caught : busy || caught || pokeballs === null || (!hasPokeballs && !canAfford)
  const catchLabel = caught
    ? runBattle
      ? 'Added to team!'
      : freeCatch
        ? 'Caught! (free - Catching Charm)'
        : 'Caught!'
    : runBattle
      ? 'Add to team'
      : hasPokeballs
        ? `Catch (${pokeballs} Poke Ball${pokeballs === 1 ? '' : 's'})`
        : `Buy Poke Ball (${formatMoney(pokeballPrice)})`

  // Only a defeated shiny you could still have caught is worth a warning.
  const leaveNeedsConfirm = canCatch && opponentShiny && !caught

  let heading = 'The battle ended in a tie.'
  if (winner === 'You') heading = 'You won the battle!'
  else if (winner) heading = isRaid ? 'You lost the raid!' : isWildBattle ? 'You lost to the wild pokemon!' : `${winner} won the battle!`
  if (runBattle && winner !== 'You') heading = 'Your run is over!'

  // A Classic wild battle splits in two: the result and rewards on the left, and on the
  // right what to do next - search the area, catch, battle again or head back.
  const wildLayout = isWildBattle && !runBattle && !isRaid

  const catchRow = canCatch && !replacing && (
    <div className="catch-row">
      <button type="button" disabled={catchDisabled} onClick={() => void catchPokemon()}>
        {catchLabel}
      </button>
    </div>
  )

  const rewards = (
    <>
      {replacing && (
        <div className="run-replace">
          <p className="box-empty-hint">
            Your run team is full - who should make room? The new Pokémon takes over its held item, and any ability or moves it got from New
            Ability and New Move floors.
          </p>
          <div className="run-replace-grid">
            {replacing.map((mon) => (
              <button
                key={mon.id}
                className={`run-replace-card rarity-card rarity-tier-${mon.rarityTier ?? 'common'}`}
                disabled={busy}
                onClick={() => void catchPokemon(mon.id)}
              >
                <RarityGlow size={52}>
                  <SpriteImage
                    style="3d-static"
                    className="run-replace-sprite"
                    spriteId={toSpriteId(mon.species)}
                    shiny={mon.shiny}
                    alt=""
                  />
                </RarityGlow>
                <span>{mon.species}</span>
                <span className="box-empty-hint">Lv {mon.level}</span>
              </button>
            ))}
          </div>
          <button type="button" disabled={busy} onClick={() => setReplacing(null)}>
            Keep my team
          </button>
        </div>
      )}
      {raidCatch && (
        <div className="raid-catch">
          <SpriteImage
            style="3d-static"
            className="raid-catch-sprite"
            spriteId={toSpriteId(raidCatch.species)}
            shiny={raidCatch.shiny}
            alt={raidCatch.species}
          />
          <div className="raid-catch-text">
            <strong>
              Caught {raidCatch.shiny ? 'a shiny ' : ''}
              {raidCatch.species}!
            </strong>
            <span className="merge-stars">{'★'.repeat(raidStars)}</span>
            <span className="box-empty-hint">
              It joined your box as ★{raidStars} ({2 ** raidStars} copies merged)
              {raidGigantamax ? ' - and it can Gigantamax' : ''}.
            </span>
          </div>
        </div>
      )}
      {error && <p className="editor-error">{error}</p>}
      {draftResult && (
        <div className="exp-gain-list">
          <div className="exp-gain-row">
            <span className="exp-gain-species">Draft record</span>
            <span className="exp-gain-detail">
              {draftResult.wins}-{draftResult.losses}
              {draftResult.over &&
                ` · ${draftResult.wins >= DRAFT_MAX_WINS ? 'perfect run!' : 'draft over'} · +${draftResult.reward} coins`}
            </span>
          </div>
        </div>
      )}
      {runItemReward && (
        <div className="exp-gain-list">
          <div className="exp-gain-row">
            <span className="exp-gain-species">Reward</span>
            <span className="exp-gain-detail">Pick your reward back on the run menu</span>
          </div>
        </div>
      )}
      {runBattle && winner === 'You' && runFainted.length > 0 && (
        <div className="exp-gain-list">
          {runFainted.map((species, i) => (
            <div key={i} className="exp-gain-row">
              <span className="exp-gain-species">{species}</span>
              <span className="exp-gain-detail run-fainted-detail">Fainted - left the run</span>
            </div>
          ))}
        </div>
      )}
      {moneyGained > 0 && (
        <div className="exp-gain-list">
          <div className="exp-gain-row">
            <span className="exp-gain-species">Reward</span>
            <span className="exp-gain-detail">+{formatMoney(moneyGained)}</span>
          </div>
        </div>
      )}
      {expGains.length > 0 && (
        <div className="exp-gain-list">
          {expGains.map((g, i) => (
            <div key={i} className="exp-gain-row">
              <span className="exp-gain-species">{g.species}</span>
              {g.cappedOut ? (
                <span className="exp-gain-detail">At level cap</span>
              ) : (
                <span className="exp-gain-detail">
                  +{g.gained} exp
                  {g.levelAfter > g.levelBefore && ` · Lv ${g.levelBefore} → Lv ${g.levelAfter}`}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      {itemDrops.length > 0 && (
        <div className="exp-gain-list">
          {itemDrops.map((d, i) => (
            <div key={i} className="exp-gain-row">
              <span className="exp-gain-species">
                <ItemSprite spritenum={d.spritenum} className="item-drop-icon" />
                {d.itemName}
              </span>
              <span className="exp-gain-detail">Added to bag</span>
            </div>
          ))}
        </div>
      )}
      {tmRewards.length > 0 && (
        <div className="tm-reward-row">
          {tmRewards.map((tm) => (
            <TmCard key={tm.moveId} tm={tm} framed className="tm-reward-card">
              <span className="tm-find-note">New TM!</span>
            </TmCard>
          ))}
        </div>
      )}
    </>
  )

  const actions = (
    <div className="editor-actions battle-result-actions">
      {onRebattle && (
        <button
          className={leaveNeedsConfirm && confirmingLeave === 'rebattle' ? 'confirm-button' : undefined}
          disabled={busy || rebattling}
          onClick={() => {
            if (leaveNeedsConfirm && confirmingLeave !== 'rebattle') {
              setConfirmingLeave('rebattle')
              return
            }
            setRebattling(true)
            void onRebattle().finally(() => setRebattling(false))
          }}
        >
          {leaveNeedsConfirm && confirmingLeave === 'rebattle' ? 'Leave the shiny uncaught? Click again' : 'Battle again'}
        </button>
      )}
      <button
        className={leaveNeedsConfirm && confirmingLeave === 'menu' ? 'confirm-button' : undefined}
        disabled={rebattling}
        onClick={() => {
          if (leaveNeedsConfirm && confirmingLeave !== 'menu') setConfirmingLeave('menu')
          else onClose()
        }}
      >
        {leaveNeedsConfirm && confirmingLeave === 'menu' ? 'Leave the shiny uncaught? Click again' : 'Back to menu'}
      </button>
    </div>
  )

  return createPortal(
    <div className="modal-overlay">
      {/* Tinted green for a win, red for a loss (grey for a tie). */}
      <div
        className={`modal-panel battle-result-modal battle-result-${winner === 'You' ? 'won' : winner ? 'lost' : 'tie'}${
          wildLayout ? ' battle-result-wild' : ''
        }`}
      >
        {wildLayout ? (
          <>
            <div className="battle-result-main">
              <h2>{heading}</h2>
              {rewards}
            </div>
            <div className="battle-result-side">
              {tmQuickCheck && <TmQuickCheck />}
              {catchRow}
              {actions}
            </div>
          </>
        ) : (
          <>
            <h2>{heading}</h2>
            {catchRow}
            {rewards}
            {tmQuickCheck && <TmQuickCheck />}
            {actions}
          </>
        )}
      </div>
    </div>,
    document.body
  )
}

export default BattleResultModal
