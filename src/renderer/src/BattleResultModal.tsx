import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { DEFAULT_POKEBALL_ID, POKEBALL_PRICE } from '../../shared/battle-types'
import type { ExpGainResult, ItemDropResult } from '../../shared/battle-types'
import ItemSprite from './ItemSprite'

interface Props {
  winner: string | null
  expGains: ExpGainResult[]
  itemDrops: ItemDropResult[]
  moneyGained: number
  canCatch: boolean
  isWildBattle: boolean
  opponentShiny: boolean
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
  onClose
}: Props): React.JSX.Element {
  const [confirmingLeave, setConfirmingLeave] = useState(false)
  const [pokeballs, setPokeballs] = useState<number | null>(null)
  const [money, setMoney] = useState<number | null>(null)
  const [pokeballPrice, setPokeballPrice] = useState(POKEBALL_PRICE)
  const [caught, setCaught] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!canCatch) return
    Promise.all([window.api.listBag(), window.api.getMoney(), window.api.listShop()])
      .then(([bag, m, shop]) => {
        setPokeballs(bag.find((i) => i.id === DEFAULT_POKEBALL_ID)?.quantity ?? 0)
        setMoney(m)
        setPokeballPrice(shop.find((i) => i.id === DEFAULT_POKEBALL_ID)?.price ?? POKEBALL_PRICE)
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [canCatch])

  async function catchPokemon(): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      const result = await window.api.catchWildPokemon()
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
  const catchDisabled = busy || caught || pokeballs === null || (!hasPokeballs && !canAfford)
  const catchLabel = caught
    ? 'Caught!'
    : hasPokeballs
      ? `Catch (${pokeballs} Poke Ball${pokeballs === 1 ? '' : 's'})`
      : `Buy Poke Ball (₽${pokeballPrice})`

  // Only a defeated shiny you could still have caught is worth a warning.
  const leaveNeedsConfirm = canCatch && opponentShiny && !caught

  let heading = 'The battle ended in a tie.'
  if (winner === 'You') heading = 'You won the battle!'
  else if (winner) heading = isWildBattle ? 'You lost to the wild pokemon!' : `${winner} won the battle!`

  return createPortal(
    <div className="modal-overlay">
      <div className="modal-panel battle-result-modal">
        <h2>{heading}</h2>
        {canCatch && (
          <div className="catch-row">
            <button type="button" disabled={catchDisabled} onClick={() => void catchPokemon()}>
              {catchLabel}
            </button>
          </div>
        )}
        {error && <p className="editor-error">{error}</p>}
        {moneyGained > 0 && (
          <div className="exp-gain-list">
            <div className="exp-gain-row">
              <span className="exp-gain-species">Reward</span>
              <span className="exp-gain-detail">+₽{moneyGained}</span>
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
