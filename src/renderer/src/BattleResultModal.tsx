import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { DEFAULT_POKEBALL_ID, POKEBALL_PRICE, ROGUELITE_MAX_TEAM, toSpriteId } from '../../shared/battle-types'
import type { ExpGainResult, ItemDropResult, RunMonView } from '../../shared/battle-types'
import ItemSprite from './ItemSprite'
import SpriteImage from './SpriteImage'
import { formatMoney } from './money'

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
  onClose
}: Props): React.JSX.Element {
  const [confirmingLeave, setConfirmingLeave] = useState(false)
  const [pokeballs, setPokeballs] = useState<number | null>(null)
  const [money, setMoney] = useState<number | null>(null)
  const [pokeballPrice, setPokeballPrice] = useState(POKEBALL_PRICE)
  const [caught, setCaught] = useState(false)
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
    ? 'Caught!'
    : runBattle
      ? 'Catch it for your run'
      : hasPokeballs
      ? `Catch (${pokeballs} Poke Ball${pokeballs === 1 ? '' : 's'})`
      : `Buy Poke Ball (${formatMoney(pokeballPrice)})`

  // Only a defeated shiny you could still have caught is worth a warning.
  const leaveNeedsConfirm = canCatch && opponentShiny && !caught

  let heading = 'The battle ended in a tie.'
  if (winner === 'You') heading = 'You won the battle!'
  else if (winner) heading = isWildBattle ? 'You lost to the wild pokemon!' : `${winner} won the battle!`
  if (runBattle && winner !== 'You') heading = 'Your run is over!'

  return createPortal(
    <div className="modal-overlay">
      <div className="modal-panel battle-result-modal">
        <h2>{heading}</h2>
        {canCatch && !replacing && (
          <div className="catch-row">
            <button type="button" disabled={catchDisabled} onClick={() => void catchPokemon()}>
              {catchLabel}
            </button>
          </div>
        )}
        {replacing && (
          <div className="run-replace">
            <p className="box-empty-hint">Your run team is full - who should make room?</p>
            <div className="run-replace-grid">
              {replacing.map((mon) => (
                <button key={mon.id} disabled={busy} onClick={() => void catchPokemon(mon.id)}>
                  <SpriteImage style="2d-static" className="run-replace-sprite" spriteId={toSpriteId(mon.species)} shiny={mon.shiny} alt="" />
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
        {error && <p className="editor-error">{error}</p>}
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
        <div className="editor-actions">
          <button
            className={leaveNeedsConfirm && confirmingLeave ? 'confirm-button' : undefined}
            onClick={() => {
              if (leaveNeedsConfirm && !confirmingLeave) setConfirmingLeave(true)
              else onClose()
            }}
          >
            {leaveNeedsConfirm && confirmingLeave ? 'Leave the shiny uncaught? Click again' : 'Back to menu'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default BattleResultModal
