import { useEffect, useRef, useState } from 'react'
import { GameCornerLoading } from './GameCornerTabs'
import type { ItemOptionEntry } from '../../shared/battle-types'
import { COIN_PACKS, COIN_PRICE, COIN_PRIZES, type DailyCoinMon, type DailyCoinOffer, type DailyPetalDeals } from '../../shared/slots'
import { FRIENDSHIP_PETAL_ITEM_ID, SHINY_PATCH_ITEM_ID, WISHING_PIECE_ITEM_ID, toSpriteId } from '../../shared/battle-types'
import SpriteImage from './SpriteImage'
import ItemSprite from './ItemSprite'
import { formatMoney } from './money'
import { errorMessage, pointOf, useFloatingNotes } from './FloatingNotes'
import BuyButton, { BuyButtonGroup } from './BuyButton'
import RarityCard, { RarityGlow } from './RarityCard'
import { coinPrizeRarityTier } from '../../shared/rarity'
import { recommendedRank } from './ItemsPanel'
import type { TmShopView } from '../../shared/tms'
import { TmCard } from './TmBits'

// The Friendship Petal's icon (see ItemSprite).
const FRIENDSHIP_PETAL_SPRITENUM = -31

// Each coin pack's name, smallest to biggest.
const PACK_NAMES = ['Handful', 'Pouch', 'Sack', 'Chest']


// The bulk buttons beside each prize's own: trade this many at once.
const BULK_AMOUNTS = [5, 10]

// What each prize does, in a few words for its card - the item's full description shows
// on hovering the card.
const PRIZE_SUMMARIES: Record<string, string> = {
  lockcapsule: 'A random Shop item',
  rarecandy: 'One level up for one Pokemon',
  expcandym: '50,000 exp for your whole team',
  randompokemon: 'A random unevolved Pokemon',
  expcandyl: '100,000 exp for your whole team',
  wishingpiece: 'Starts one Max Raid',
  shinypatch: 'Makes one Pokemon shiny',
  randomlegendary: 'A random legendary, mythical, ultra beast or paradox Pokemon'
}

// In the Items window's Recommended order, so the two read the same.
const PRIZES_IN_ORDER = [...COIN_PRIZES].sort((a, b) => recommendedRank(a.itemId) - recommendedRank(b.itemId))

interface Props {
  // The coins changed - the Game Corner's top bar shows them.
  onCoinsChange: (coins: number) => void
  // The wallet changed - the top bar's and the menu bar's money need refreshing.
  onMoneyChange: (money: number) => void
  // A Pokemon joined the box - the main menu's box needs refreshing.
  onBoxChange?: () => void
  // Scroll down to this item's daily deal (the Friendship Petals, the Shiny Patch) once
  // it's loaded (and flash it), then report it done.
  focusItem?: string | null
  onItemFocused?: () => void
}

/**
 * The Game Corner's counter (its Coin Shop tab): coin packs bought with Poke Dollars
 * (coins are never sold back), and the prizes coins trade for - they go into the bag. At
 * the bottom, the Pokemon of the day: a bubble on the banner points to it while it's
 * still for sale.
 */
function CoinShopPanel({ onCoinsChange, onMoneyChange, onBoxChange, focusItem, onItemFocused }: Props): React.JSX.Element {
  const [coins, setCoins] = useState<number | null>(null)
  const [money, setMoney] = useState<number | null>(null)
  const [items, setItems] = useState<Map<string, ItemOptionEntry>>(new Map())
  const [busy, setBusy] = useState(false)
  // Today's discounted coins - greyed out once bought, back the next day.
  const [offer, setOffer] = useState<DailyCoinOffer | null>(null)
  // Today's Pokemon - greyed out once bought, a new one the next day.
  const [dailyMon, setDailyMon] = useState<DailyCoinMon | null>(null)
  const dailyMonRef = useRef<HTMLDivElement>(null)
  // A bulk button under the mouse: its prize's main button shows that many's total meanwhile.
  const notes = useFloatingNotes()
  // Today's TMs (a set only ever sold here) and the Scanner key item.
  const [tmShop, setTmShop] = useState<TmShopView | null>(null)
  // Today's Friendship Petals: a free pack and a coin pack, each once a day.
  const [petals, setPetals] = useState<DailyPetalDeals | null>(null)
  const petalsRef = useRef<HTMLDivElement>(null)
  const [petalsFlash, setPetalsFlash] = useState(false)
  // The Shiny Patch's prize card, for the same trip from the Items window.
  const shinyPatchRef = useRef<HTMLDivElement>(null)
  const [shinyPatchFlash, setShinyPatchFlash] = useState(false)
  // The once-a-day prizes (the Shiny Patch) already traded for today.
  const [dailyPrizesBought, setDailyPrizesBought] = useState<string[]>([])

  // The Raid Crystal and the Shiny Patch are locked until Max Raids open (see BattleEligibility.raidsUnlocked);
  // the daily petals and the Pokemon of the day aren't shown at all until then.
  const [raidLock, setRaidLock] = useState<{ unlocked: boolean; boss: string | null } | null>(null)
  useEffect(() => {
    window.api
      .getBattleEligibility()
      .then((e) => setRaidLock({ unlocked: e.raidsUnlocked, boss: e.raidUnlockBoss }))
      .catch(() => {})
  }, [])

  useEffect(() => {
    Promise.all([window.api.getCoins(), window.api.getMoney(), window.api.getEditorOptions()])
      .then(([c, m, options]) => {
        setCoins(c)
        setMoney(m)
        setItems(new Map(options.items.map((i) => [i.id, i])))
      })
      .catch(() => setCoins(0))
    window.api
      .getDailyCoinOffer()
      .then(setOffer)
      .catch(() => {})
    window.api
      .getDailyCoinMon()
      .then(setDailyMon)
      .catch(() => {})
    window.api
      .getTmShop()
      .then(setTmShop)
      .catch(() => {})
    window.api
      .getDailyPetalDeals()
      .then(setPetals)
      .catch(() => {})
    window.api
      .getDailyPrizesBought()
      .then(setDailyPrizesBought)
      .catch(() => {})
  }, [])

  // Sent here from the Items window's Friendship Petal or Shiny Patch: down to its deal,
  // with a flash.
  useEffect(() => {
    const target =
      focusItem === FRIENDSHIP_PETAL_ITEM_ID && petals
        ? { el: petalsRef.current, flash: setPetalsFlash }
        : focusItem === SHINY_PATCH_ITEM_ID && items.size > 0
          ? { el: shinyPatchRef.current, flash: setShinyPatchFlash }
          : null
    if (!target?.el) return
    target.el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    target.flash(true)
    onItemFocused?.()
    const timer = setTimeout(() => target.flash(false), 1600)
    return () => clearTimeout(timer)
  }, [focusItem, petals, items, raidLock])

  async function act(e: React.MouseEvent, action: () => Promise<string>): Promise<void> {
    const at = pointOf(e)
    setBusy(true)
    try {
      notes.show(await action(), at)
    } catch (err) {
      notes.show(errorMessage(err), at, 'bad')
    } finally {
      setBusy(false)
    }
  }

  function buyPack(e: React.MouseEvent, amount: number): void {
    void act(e, async () => {
      const result = await window.api.buyCoins(amount)
      setCoins(result.coins)
      onCoinsChange(result.coins)
      setMoney(result.money)
      onMoneyChange(result.money)
      return `Bought ${amount.toLocaleString('en-US')} coins`
    })
  }

  function buyOffer(e: React.MouseEvent): void {
    void act(e, async () => {
      const result = await window.api.buyDailyCoinOffer()
      setCoins(result.coins)
      onCoinsChange(result.coins)
      setMoney(result.money)
      onMoneyChange(result.money)
      setOffer((o) => (o ? { ...o, bought: true } : o))
      return `Bought ${offer?.coins.toLocaleString('en-US') ?? ''} coins at a discount`
    })
  }

  function buyDailyMon(e: React.MouseEvent): void {
    void act(e, async () => {
      const result = await window.api.buyDailyCoinMon()
      setCoins(result.coins)
      onCoinsChange(result.coins)
      setDailyMon((m) => (m ? { ...m, bought: true } : m))
      onBoxChange?.()
      return `${result.shiny ? 'A shiny ' : ''}${result.species} joined your box`
    })
  }

  function buyPrize(e: React.MouseEvent, itemId: string, quantity: number): void {
    void act(e, async () => {
      const result = await window.api.buyCoinPrize(itemId, quantity)
      setCoins(result.coins)
      onCoinsChange(result.coins)
      if (COIN_PRIZES.find((p) => p.itemId === itemId)?.daily) setDailyPrizesBought((ids) => [...ids, itemId])
      // New items in the bag can let more pre-evolutions merge in.
      onBoxChange?.()
      return result.quantity > 1
        ? `Got ${result.quantity} ${result.itemName} - they're in your bag`
        : `Got a ${result.itemName} - it's in your bag`
    })
  }

  function claimFreePetals(e: React.MouseEvent): void {
    void act(e, async () => {
      setPetals(await window.api.claimFreePetals())
      onBoxChange?.()
      return `Got ${petals?.free.petals ?? ''} Friendship Petals - they're in your bag`
    })
  }

  function buyPetalPack(e: React.MouseEvent): void {
    void act(e, async () => {
      const result = await window.api.buyPetalPack()
      setCoins(result.coins)
      onCoinsChange(result.coins)
      setPetals(result.deals)
      onBoxChange?.()
      return `Got ${result.deals.pack.petals} Friendship Petals - they're in your bag`
    })
  }

  function buyTm(e: React.MouseEvent, moveId: string, name: string): void {
    void act(e, async () => {
      const result = await window.api.buyTm(moveId)
      setCoins(result.coins)
      onCoinsChange(result.coins)
      setTmShop(result.shop)
      return `Got the ${name} TM`
    })
  }

  function buyScanner(e: React.MouseEvent): void {
    void act(e, async () => {
      const result = await window.api.buyTmScanner()
      setCoins(result.coins)
      onCoinsChange(result.coins)
      setTmShop(result.shop)
      return "Got the Scanner - it's in your Key Items"
    })
  }

  if (coins === null) return <GameCornerLoading />
  const lateUnlocked = !!raidLock?.unlocked

  return (
    <div className="game-corner-game coin-shop-panel">
      <div className="coin-shop-banner">
        {/* Today's Pokemon, while it's still for sale: a click scrolls down to it. */}
        {lateUnlocked && dailyMon && !dailyMon.bought && (
          <button
            className={`coin-daily-mon-bubble coin-daily-mon-bubble-${dailyMon.tier}`}
            title={`Today's Pokemon: ${dailyMon.species}`}
            onClick={() => dailyMonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
          >
            <SpriteImage style="2d-static" className="coin-daily-mon-bubble-sprite" spriteId={toSpriteId(dailyMon.species)} alt={dailyMon.species} />
            <span>Today&apos;s Pokemon</span>
          </button>
        )}
        <span className="coin-shop-banner-title">Prize Exchange</span>
        <span className="coin-shop-banner-sub">Buy coins with Poke Dollars, trade them for prizes</span>
      </div>

      <div className="coin-shop-section-head">
        <h3>Buy coins</h3>
        <span>{formatMoney(COIN_PRICE)} a coin · never sold back</span>
      </div>
      {offer && (
        <div className={`coin-daily-offer${offer.bought ? ' coin-daily-offer-bought' : ''}`}>
          <span className="coin-daily-offer-tag">Daily offer</span>
          <span className="coin-pack-stack coin-daily-offer-stack" aria-hidden>
            {Array.from({ length: 5 }, (_, c) => (
              <img key={c} className="coin-pack-coin" src="./icons/nav/coin.png" alt="" style={{ zIndex: c }} />
            ))}
          </span>
          <span className="coin-daily-offer-text">
            <span className="coin-daily-offer-amount">
              {offer.coins.toLocaleString('en-US')} coins
            </span>
            <span className="coin-daily-offer-note">
              {offer.bought
                ? 'Bought today - a new offer arrives tomorrow'
                : `${Math.round((1 - offer.price / offer.fullPrice) * 100)}% off · once a day`}
            </span>
          </span>
          <span className="coin-daily-offer-buy">
            <s className="coin-daily-offer-was">{formatMoney(offer.fullPrice)}</s>
            <BuyButton price={offer.price} currency="money" held={money} busy={busy} soldOut={offer.bought} onBuy={buyOffer} />
          </span>
        </div>
      )}
      <div className="coin-pack-grid">
        {COIN_PACKS.map((amount, i) => {
          const price = amount * COIN_PRICE
          return (
            <div key={amount} className="coin-pack">
              <span className="coin-pack-name">{PACK_NAMES[i] ?? 'Pack'}</span>
              {/* A stack of coins that grows with the pack. */}
              <span className="coin-pack-stack" aria-hidden>
                {Array.from({ length: Math.min(i + 1, 4) }, (_, c) => (
                  <img key={c} className="coin-pack-coin" src="./icons/nav/coin.png" alt="" style={{ zIndex: c }} />
                ))}
              </span>
              <span className="coin-pack-amount">{amount.toLocaleString('en-US')}</span>
              <BuyButton price={price} currency="money" held={money} busy={busy} onBuy={(e) => buyPack(e, amount)} />
            </div>
          )
        })}
      </div>

      <div className="coin-shop-section-head">
        <h3>Prizes</h3>
        <span>Prizes go straight into your bag</span>
      </div>
      <div className="coin-prize-grid">
        {PRIZES_IN_ORDER.map((prize) => {
          const item = items.get(prize.itemId)
          const locked = (prize.itemId === WISHING_PIECE_ITEM_ID || prize.itemId === SHINY_PATCH_ITEM_ID) && !raidLock?.unlocked
          const boughtToday = !!prize.daily && dailyPrizesBought.includes(prize.itemId)
          return (
            <RarityCard
              key={prize.itemId}
              tier={coinPrizeRarityTier(prize.coins)}
              lift
              cardRef={prize.itemId === SHINY_PATCH_ITEM_ID ? shinyPatchRef : undefined}
              className={`coin-prize${locked ? ' coin-prize-locked' : ''}${
                prize.itemId === SHINY_PATCH_ITEM_ID && shinyPatchFlash ? ' coin-prize-flash' : ''
              }`}
              title={item?.description}
            >
              <RarityGlow size={80} className="coin-prize-art">
                {item && <ItemSprite spritenum={item.spritenum} className="coin-prize-icon" />}
              </RarityGlow>
              <span className="coin-prize-name">{item?.name ?? prize.itemId}</span>
              <span className="coin-prize-desc">
                {PRIZE_SUMMARIES[prize.itemId] ?? item?.description ?? ''}
                {prize.daily && (boughtToday ? ' · back tomorrow' : ' · one a day')}
              </span>
              {locked ? (
                <span className="coin-prize-lock">🔒 Beat {raidLock?.boss ?? 'the right boss'} to unlock</span>
              ) : prize.daily ? (
                // Just the one a day - no bulk buttons.
                <BuyButton
                  price={prize.coins}
                  currency="coins"
                  held={coins}
                  busy={busy}
                  soldOut={boughtToday}
                  onBuy={(e) => buyPrize(e, prize.itemId, 1)}
                />
              ) : (
                // One for its price, or five / ten at once beside it.
                <BuyButtonGroup>
                  <BuyButton
                    price={prize.coins}
                    currency="coins"
                    held={coins}
                    busy={busy}
                    onBuy={(e) => buyPrize(e, prize.itemId, 1)}
                  />
                  {BULK_AMOUNTS.map((n) => (
                    <BuyButton
                      key={n}
                      compact
                      price={prize.coins * n}
                      currency="coins"
                      held={coins}
                      busy={busy}
                      label={`×${n}`}
                      title={`Trade ${n} for ${(prize.coins * n).toLocaleString('en-US')} coins`}
                      onBuy={(e) => buyPrize(e, prize.itemId, n)}
                    />
                  ))}
                </BuyButtonGroup>
              )}
            </RarityCard>
          )
        })}
      </div>

      {/* Today's Friendship Petals: a free pack and a coin pack side by side, each once a day. */}
      {lateUnlocked && petals && (
        <div ref={petalsRef} className={`coin-petals${petalsFlash ? ' coin-petals-flash' : ''}`}>
          <span className="coin-petals-tag">Daily petals</span>
          <div className={`coin-petals-deal${petals.free.claimed ? ' coin-petals-deal-gone' : ''}`}>
            <ItemSprite spritenum={FRIENDSHIP_PETAL_SPRITENUM} className="coin-petals-icon" />
            <span className="coin-petals-text">
              <span className="coin-petals-amount">{petals.free.petals} Friendship Petals</span>
              <span className="coin-petals-note">{petals.free.claimed ? 'Claimed today - more tomorrow' : 'Free · once a day'}</span>
            </span>
            <span className="coin-petals-buy">
              {petals.free.claimed ? (
                <span className="coin-tm-owned">✓ Claimed</span>
              ) : (
                <button className="buy-button" disabled={busy} onClick={claimFreePetals}>
                  Claim
                </button>
              )}
            </span>
          </div>
          <div className={`coin-petals-deal${petals.pack.bought ? ' coin-petals-deal-gone' : ''}`}>
            <ItemSprite spritenum={FRIENDSHIP_PETAL_SPRITENUM} className="coin-petals-icon" />
            <span className="coin-petals-text">
              <span className="coin-petals-amount">{petals.pack.petals} Friendship Petals</span>
              <span className="coin-petals-note">{petals.pack.bought ? 'Bought today - back tomorrow' : 'Once a day'}</span>
            </span>
            <span className="coin-petals-buy">
              <BuyButton price={petals.pack.coins} currency="coins" held={coins} busy={busy} soldOut={petals.pack.bought} onBuy={buyPetalPack} />
            </span>
          </div>
        </div>
      )}

      {tmShop && (
        <>
          <div className="coin-shop-section-head">
            <h3>TMs of the day</h3>
            <span>Only ever sold here · a new set every day</span>
          </div>
          {/* The Scanner: a key item, bought once - in a banner above the day's TMs. */}
          <RarityCard tier="legendary" framed dimmed={tmShop.hasScanner} className="coin-scanner">
            <RarityGlow size={64} className="coin-scanner-art">
              <img className="coin-scanner-icon" src="./sprites/misc/scanner.png" alt="" />
            </RarityGlow>
            <span className="coin-scanner-text">
              <span className="coin-scanner-name">
                Scanner <span className="coin-scanner-tag">Key item</span>
              </span>
              <span className="coin-scanner-note">
                {tmShop.hasScanner
                  ? 'Owned - a quick TM search waits after every wild win'
                  : 'Unlocks a quick TM search after every wild win: a Good finds one 5% of the time, a Great 15%'}
              </span>
            </span>
            <span className="coin-scanner-buy">
              {tmShop.hasScanner ? (
                <span className="coin-tm-owned">✓ Owned</span>
              ) : (
                <BuyButton price={tmShop.scannerCoins} currency="coins" held={coins} busy={busy} onBuy={buyScanner} />
              )}
            </span>
          </RarityCard>
          <div className="coin-tm-grid">
            {tmShop.offers.map((offer) => (
              <TmCard key={offer.tm.moveId} tm={offer.tm} dimmed={offer.owned} className="coin-tm-card">
                {offer.owned ? (
                  <span className="coin-tm-owned">Owned</span>
                ) : (
                  <BuyButton price={offer.coins} currency="coins" held={coins} busy={busy} onBuy={(e) => buyTm(e, offer.tm.moveId, offer.tm.name)} />
                )}
              </TmCard>
            ))}
          </div>
        </>
      )}

      {lateUnlocked && dailyMon && (
        <>
          <div className="coin-shop-section-head">
            <h3>Pokemon of the day</h3>
            <span>One a day · a new one every day</span>
          </div>
          <RarityCard cardRef={dailyMonRef} tier={dailyMon.tier} framed dimmed={dailyMon.bought} className="coin-daily-mon">
            <RarityGlow stand size={{ width: 150, height: 130 }}>
              <SpriteImage style="2d-animated" className="coin-daily-mon-sprite" spriteId={toSpriteId(dailyMon.species)} alt={dailyMon.species} />
            </RarityGlow>
            <span className="coin-daily-mon-text">
              <span className="coin-daily-mon-name">{dailyMon.species}</span>
              <span className="coin-daily-mon-stars" title={`Arrives already merged to ${dailyMon.stars} stars`}>
                {'★'.repeat(dailyMon.stars)}
              </span>
              <span className="coin-daily-mon-note">
                {dailyMon.bought
                  ? 'Bought today - a new Pokemon arrives tomorrow'
                  : `Joins your box at ${dailyMon.stars} stars - a little under the level cap`}
              </span>
            </span>
            <span className="coin-daily-mon-buy">
              <BuyButton
                price={dailyMon.coins}
                currency="coins"
                held={coins}
                busy={busy}
                soldOut={dailyMon.bought}
                onBuy={buyDailyMon}
              />
            </span>
          </RarityCard>
        </>
      )}
      {notes.layer}
    </div>
  )
}

export default CoinShopPanel
