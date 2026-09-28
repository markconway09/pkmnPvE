// The Game Corner slot machine's rules, shared by the main process (which decides every
// spin) and the renderer (which draws the reels): its symbols, the three reel strips,
// the rows every spin plays, and what a row pays.

export type SlotSymbol = 'gholdengo' | 'ball' | 'high' | 'mid' | 'low' | 'cherry'

// Each reel, top to bottom, wrapping round: about thirty symbols (no blanks), two of
// them Gholdengo - the jackpot. The other three Pokemon are tiers, not species: which
// Pokemon stands for each is picked at random whenever the machine opens (see
// SlotRules.pokemon), the stronger (by base stat total) the better it pays. Tuned (with the payouts below)
// so that, over time, the machine pays back
// about 120% of what's bet - in the player's favour on purpose, so coins grow the more
// they spin; the same at any bet, since wins scale with it - something
// wins on about half of all spins, and three Gholdengo land about once in 1,160 spins.
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
export const SLOT_ROWS = [0, 1, 2]

// What a row pays for each coin bet, for three of a symbol. A cherry on the first reel
// pays on its own, more with two in a row. Each payout follows how rare its result is:
// apart from the single cherry (x1, the smallest whole win), every result gives back
// about the same share of the total - so the rarer it is, the more it pays.
export const SLOT_PAYOUTS: Record<SlotSymbol, number> = {
  gholdengo: 150,
  ball: 45,
  high: 9,
  mid: 3,
  low: 1,
  cherry: 32
}
export const CHERRY_ONE = 1
export const CHERRY_TWO = 4

export interface SlotLineWin {
  // The row that won (0 top, 1 middle, 2 bottom).
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

/** What each row pays with the reels stopped here (stops = each reel's middle symbol) for this bet. */
export function slotWins(stops: number[], bet: number): SlotLineWin[] {
  const wins: SlotLineWin[] = []
  for (const row of SLOT_ROWS) {
    const symbols = [0, 1, 2].map((reel) => slotSymbolAt(reel, stops[reel], row))
    const [first] = symbols
    if (symbols[1] === first && symbols[2] === first) {
      wins.push({ line: row, symbol: first, count: 3, payout: SLOT_PAYOUTS[first] * bet })
    } else if (first === 'cherry') {
      const two = symbols[1] === 'cherry'
      wins.push({ line: row, symbol: 'cherry', count: two ? 2 : 1, payout: (two ? CHERRY_TWO : CHERRY_ONE) * bet })
    }
  }
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

export const COIN_PRIZES: CoinPrize[] = [
  { itemId: 'lockcapsule', coins: 50 },
  { itemId: 'rarecandy', coins: 25 },
  { itemId: 'randompokemon', coins: 250 },
  { itemId: 'shinypatch', coins: 500 },
  { itemId: 'expcandyl', coins: 500 },
  { itemId: 'randomlegendary', coins: 5000 }
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
  // The Pokemon each tier shows this time the machine is open - strongest on 'high'.
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
