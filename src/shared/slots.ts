// The Game Corner slot machine's rules, shared by the main process (which decides every
// spin) and the renderer (which draws the reels): its symbols, the three reel strips,
// the lines each bet plays, and what a line pays.

export type SlotSymbol = 'seven' | 'ball' | 'pikachu' | 'marill' | 'psyduck' | 'cherry'

export const SLOT_SYMBOLS: SlotSymbol[] = ['seven', 'ball', 'pikachu', 'marill', 'psyduck', 'cherry']

// Each reel, top to bottom, wrapping round - one seven on each. Tuned (with the payouts
// below) so that, over time, a bet of 3 pays back about 95% of what goes in, a bet of 2
// about 86% and a bet of 1 about 57%: more lines for the coin, as in the Gen 3 slots.
export const SLOT_REELS: SlotSymbol[][] = [
  ['seven', 'cherry', 'psyduck', 'marill', 'psyduck', 'pikachu', 'psyduck', 'ball', 'marill', 'cherry', 'psyduck',
    'pikachu', 'marill', 'psyduck', 'psyduck', 'ball', 'marill', 'pikachu', 'psyduck', 'cherry', 'marill'],
  ['seven', 'psyduck', 'marill', 'pikachu', 'psyduck', 'cherry', 'marill', 'ball', 'psyduck', 'pikachu', 'marill',
    'psyduck', 'cherry', 'marill', 'pikachu', 'psyduck', 'ball', 'marill', 'psyduck', 'pikachu', 'marill'],
  ['seven', 'marill', 'psyduck', 'pikachu', 'marill', 'psyduck', 'ball', 'cherry', 'marill', 'psyduck', 'pikachu',
    'marill', 'psyduck', 'ball', 'cherry', 'pikachu', 'marill', 'psyduck', 'pikachu', 'marill', 'psyduck']
]

export const SLOT_BETS = [1, 2, 3] as const
export type SlotBet = (typeof SLOT_BETS)[number]

// A line: which of the three visible rows (0 top, 1 middle, 2 bottom) it crosses on
// each reel. Bet 1 plays the middle row, 2 all three rows, 3 the rows and both
// diagonals - as in the Gen 3 Game Corner.
export const SLOT_LINES: { rows: [number, number, number]; name: string }[] = [
  { rows: [1, 1, 1], name: 'middle' },
  { rows: [0, 0, 0], name: 'top' },
  { rows: [2, 2, 2], name: 'bottom' },
  { rows: [0, 1, 2], name: 'diagonal-down' },
  { rows: [2, 1, 0], name: 'diagonal-up' }
]
const LINES_FOR_BET: Record<SlotBet, number> = { 1: 1, 2: 3, 3: 5 }

export function linesForBet(bet: SlotBet): typeof SLOT_LINES {
  return SLOT_LINES.slice(0, LINES_FOR_BET[bet])
}

// Coins a line pays for three of a symbol. A cherry on the first reel pays on its own,
// more with two in a row.
export const SLOT_PAYOUTS: Record<SlotSymbol, number> = {
  seven: 300,
  ball: 40,
  pikachu: 12,
  marill: 4,
  psyduck: 2,
  cherry: 12
}
export const CHERRY_ONE = 2
export const CHERRY_TWO = 3

export interface SlotLineWin {
  line: number
  symbol: SlotSymbol
  count: number
  payout: number
}

/** The symbol showing in a row (0-2) of a reel stopped with `stop` in the middle row. */
export function slotSymbolAt(reel: number, stop: number, row: number): SlotSymbol {
  const strip = SLOT_REELS[reel]
  return strip[(stop + row - 1 + strip.length) % strip.length]
}

/** What each played line pays with the reels stopped here (`stops` = each reel's middle symbol). */
export function slotWins(stops: number[], bet: SlotBet): SlotLineWin[] {
  const wins: SlotLineWin[] = []
  linesForBet(bet).forEach((line, index) => {
    const symbols = line.rows.map((row, reel) => slotSymbolAt(reel, stops[reel], row))
    if (symbols[0] === symbols[1] && symbols[1] === symbols[2]) {
      wins.push({ line: index, symbol: symbols[0], count: 3, payout: SLOT_PAYOUTS[symbols[0]] })
    } else if (symbols[0] === 'cherry') {
      const two = symbols[1] === 'cherry'
      wins.push({ line: index, symbol: 'cherry', count: two ? 2 : 1, payout: two ? CHERRY_TWO : CHERRY_ONE })
    }
  })
  return wins
}

// Game Corner coins: bought with Poke Dollars (never sold back), bet on the slots, and
// traded for prizes.
export const COIN_PRICE = 20
export const COIN_PACKS = [50, 250, 500, 2500]

export interface CoinPrize {
  itemId: string
  coins: number
}

// Prizes cost a bit more in coins than their shop price would buy at COIN_PRICE - the
// slots are how coins are meant to grow.
export const COIN_PRIZES: CoinPrize[] = [
  { itemId: 'lockcapsule', coins: 60 },
  { itemId: 'rarecandy', coins: 30 },
  { itemId: 'randompokemon', coins: 300 },
  { itemId: 'shinypatch', coins: 600 },
  { itemId: 'expcandyl', coins: 600 },
  { itemId: 'randomlegendary', coins: 6000 }
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
