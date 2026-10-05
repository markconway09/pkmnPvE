// The Game Corner slot machine's rules, shared by the main process (which decides every
// spin) and the renderer (which draws the reels): its symbols, the three reel strips,
// the rows every spin plays, and what a row pays.

export type SlotSymbol = 'gholdengo' | 'ball' | 'high' | 'mid' | 'low' | 'cherry'

// Each reel, top to bottom, wrapping round: about thirty symbols (no blanks), two of
// them Gholdengo - the jackpot. The other three Pokemon are tiers, not species: which
// Pokemon stands for each is picked at random whenever the machine opens (see
// SlotRules.pokemon): a final-stage evolution on the big prize, a second stage on the
// medium one and a first stage on the small one. Tuned (with the payouts below)
// so that, over time, the machine pays back
// about 101.5% of what's bet - slightly in the player's favour: coins go up and down with
// luck but slowly grow on average; the same at any bet, since wins scale with it - something
// wins on just over half of all spins, and three Gholdengo land about once in 700 spins.
export const SLOT_REELS: SlotSymbol[][] = [
  [
    'mid', 'low', 'cherry', 'low', 'low', 'high', 'mid', 'gholdengo', 'ball',
    'cherry', 'mid', 'low', 'high', 'low', 'mid', 'low', 'low', 'cherry',
    'ball', 'high', 'mid', 'low', 'low', 'gholdengo', 'high', 'cherry', 'mid',
    'mid', 'ball', 'low', 'high'
  ],
  [
    'mid', 'high', 'low', 'low', 'mid', 'ball', 'low', 'high', 'cherry',
    'mid', 'low', 'low', 'mid', 'high', 'gholdengo', 'ball', 'mid', 'low',
    'cherry', 'high', 'low', 'mid', 'low', 'low', 'low', 'ball', 'high',
    'mid', 'cherry', 'gholdengo'
  ],
  [
    'low', 'low', 'ball', 'high', 'mid', 'cherry', 'gholdengo', 'mid', 'high',
    'low', 'low', 'mid', 'ball', 'low', 'high', 'cherry', 'mid', 'low',
    'low', 'mid', 'high', 'gholdengo', 'ball', 'mid', 'low', 'cherry', 'high',
    'low', 'mid', 'low'
  ]
]

// Every spin plays all three rows, whatever the bet.
// Every spin plays five lines, whatever the bet: the three rows, then both diagonals.
// Each line lists the row (0 top, 1 middle, 2 bottom) it crosses on each reel.
export const SLOT_LINES: { rows: [number, number, number]; diagonal: boolean }[] = [
  { rows: [0, 0, 0], diagonal: false },
  { rows: [1, 1, 1], diagonal: false },
  { rows: [2, 2, 2], diagonal: false },
  { rows: [0, 1, 2], diagonal: true },
  { rows: [2, 1, 0], diagonal: true }
]

// What a line pays for each coin bet, for three of a symbol. A cherry on the first reel
// pays on its own, more with two in a row - on the rows only; a diagonal needs all three. Each payout follows how rare its result is:
// apart from the single cherry (x1, the smallest whole win), every result gives back
// about the same share of the total - so the rarer it is, the more it pays.
export const SLOT_PAYOUTS: Record<SlotSymbol, number> = {
  gholdengo: 50,
  ball: 15,
  high: 5,
  mid: 2,
  low: 1,
  cherry: 6
}
export const CHERRY_ONE = 1
export const CHERRY_TWO = 2

export interface SlotLineWin {
  // The line that won (its index in SLOT_LINES).
  line: number
  symbol: SlotSymbol
  count: number
  // Coins it pays: its payout for each coin, times the bet.
  payout: number
}

/** The symbol showing in a row (0-2) of a reel stopped with its stop symbol in the middle row. */
export function slotSymbolAt(reel: number, stop: number, row: number): SlotSymbol {
  const strip = SLOT_REELS[reel]
  return strip[(stop + row - 1 + strip.length) % strip.length]
}

/**
 * What each row pays with the reels stopped here (stops = each reel's middle symbol) for this
 * bet - with this payout table and these cherry payouts (the Golden Touch title raises them).
 * A payout that isn't whole is rounded down.
 */
export function slotWins(
  stops: number[],
  bet: number,
  payouts: Record<SlotSymbol, number> = SLOT_PAYOUTS,
  cherry: { one: number; two: number } = { one: CHERRY_ONE, two: CHERRY_TWO }
): SlotLineWin[] {
  const coins = (multiplier: number): number => Math.floor(multiplier * bet + 1e-9)
  const wins: SlotLineWin[] = []
  SLOT_LINES.forEach(({ rows, diagonal }, line) => {
    const symbols = rows.map((row, reel) => slotSymbolAt(reel, stops[reel], row))
    const [first] = symbols
    if (symbols[1] === first && symbols[2] === first) {
      wins.push({ line, symbol: first, count: 3, payout: coins(payouts[first]) })
    } else if (first === 'cherry' && !diagonal) {
      const two = symbols[1] === 'cherry'
      wins.push({ line, symbol: 'cherry', count: two ? 2 : 1, payout: coins(two ? cherry.two : cherry.one) })
    }
  })
  return wins
}

// Game Corner coins: bought with Poke Dollars (never sold back), bet on the slots, and
// traded for prizes.
export const COIN_PRICE = 10

// The most either Game Corner game (slots or blackjack) takes on one bet.
export const MAX_BET = 1000
export const COIN_PACKS = [100, 500, 1000, 5000]

// The Coin Shop's daily offer: a big pack at a discount, bought once a day - it comes back
// the next day (local midnight).
export const DAILY_COIN_OFFER = { coins: 2500, price: 15000 }

// The Coin Shop's Pokemon of the day: an ultra beast, paradox, mythical or gold legendary,
// bought once a day and arriving already at this many merge stars (4 copies). It costs
// two and a half times its 2-star sell price in coins (each coin being worth COIN_PRICE) -
// a gold one 50,000 coins, a red one 10,000 - so it can never be bought and sold back at a
// profit, and costs about what four of it would.
export const DAILY_MON_STARS = 2
export const DAILY_MON_MARKUP = 2.5

export interface DailyCoinMon {
  species: string
  // Its rarity colour: 'legendary' (gold) or 'epic' (red).
  tier: 'legendary' | 'epic'
  coins: number
  stars: number
  bought: boolean
}

export interface DailyCoinMonPurchase extends CoinBalance {
  species: string
  shiny: boolean
}

export interface DailyCoinOffer {
  coins: number
  price: number
  // What the same coins cost as a normal pack.
  fullPrice: number
  // Bought already today.
  bought: boolean
}

// The Coin Shop's daily Friendship Petals: a free pack to claim, and a bigger one to buy
// with coins - each once a day.
export const DAILY_FREE_PETALS = 5
export const DAILY_PETAL_PACK = { petals: 10, coins: 10000 }

export interface DailyPetalDeals {
  free: { petals: number; claimed: boolean }
  pack: { petals: number; coins: number; bought: boolean }
}

// The most of one prize traded at once.
export const MAX_PRIZE_BULK = 99

export interface CoinPrize {
  itemId: string
  coins: number
}

export const COIN_PRIZES: CoinPrize[] = [
  { itemId: 'lockcapsule', coins: 200 },
  { itemId: 'wishingpiece', coins: 5000 },
  { itemId: 'randompokemon', coins: 1000 },
  { itemId: 'shinypatch', coins: 5000 },
  { itemId: 'expcandyl', coins: 2000 },
  { itemId: 'randomlegendary', coins: 20000 }
]

// Coins and Poke Dollars after a Game Corner purchase.
export interface CoinBalance {
  coins: number
  money: number
}

export interface SlotSpinResult {
  // Where each reel stops: the index (on its strip) of the symbol in the middle row.
  stops: number[]
  wins: SlotLineWin[]
  payout: number
  // The balance after the bet and the payout.
  coins: number
}

// The machine as the main process has it - the renderer draws from this copy rather
// than its own, so what's on screen is always what gets scored (a renderer that has
// reloaded with newer rules than a still-running main process would otherwise show
// reels that don't match the result).
// The three Pokemon tiers on the reels (see SlotRules.pokemon for who they are).
export type SlotPokemonTier = 'high' | 'mid' | 'low'

export interface SlotRules {
  reels: SlotSymbol[][]
  // The Pokemon each tier shows this time the machine is open, each picked on its own: a
  // final stage on 'high', a second stage on 'mid', a first stage on 'low'.
  pokemon: Record<SlotPokemonTier, string>
  payouts: Record<SlotSymbol, number>
  cherryOne: number
  cherryTwo: number
}

export const SLOT_RULES: SlotRules = {
  reels: SLOT_REELS,
  pokemon: { high: 'Magby', mid: 'Luvdisc', low: 'Stunky' },
  payouts: SLOT_PAYOUTS,
  cherryOne: CHERRY_ONE,
  cherryTwo: CHERRY_TWO
}
