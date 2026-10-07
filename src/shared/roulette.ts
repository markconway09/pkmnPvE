// Game Corner roulette: a European wheel - the numbers 0 to 36, one green zero - with bets
// on single numbers and the outside bets. Shared by the main process (which spins it - see
// roulette-store.ts) and the renderer (the wheel and the betting board).
//
// Real casino odds: every bet pays back 36/37 of what's staked over time (97.3%) - the
// zero is the house's edge, and every outside bet loses when it comes up.

export const ROULETTE_NUMBERS = 37

// Each spot on the board takes up to the bet cap, and a spin up to this many times it
// (five full bets spread over the board).
export const ROULETTE_MAX_FULL_BETS = 5

// The pockets round the wheel, clockwise from the zero.
export const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7,
  28, 12, 35, 3, 26
]

const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36])

export type PocketColor = 'green' | 'red' | 'black'

export function pocketColor(n: number): PocketColor {
  return n === 0 ? 'green' : RED.has(n) ? 'red' : 'black'
}

// A bet's key on the board: 'n:17' for a single number, 'dozen:1'-'dozen:3',
// 'column:1'-'column:3' (column 1 is 1, 4, 7...), or one of the even-money bets.
export type RouletteBetKey = string
export const EVEN_MONEY_BETS = ['low', 'even', 'red', 'black', 'odd', 'high'] as const

export const BET_LABELS: Record<string, string> = {
  low: '1-18',
  even: 'Even',
  red: 'Red',
  black: 'Black',
  odd: 'Odd',
  high: '19-36',
  'dozen:1': '1st 12',
  'dozen:2': '2nd 12',
  'dozen:3': '3rd 12',
  'column:1': '2:1',
  'column:2': '2:1',
  'column:3': '2:1'
}

/** A bet's name for a message ("17", "Red", "2nd 12"...). */
export function betLabel(key: RouletteBetKey): string {
  if (key.startsWith('n:')) return key.slice(2)
  if (key.startsWith('column:')) return `Column ${key.slice(7)}`
  return BET_LABELS[key] ?? key
}

/** Whether a bet key is one the table takes. */
export function isRouletteBet(key: RouletteBetKey): boolean {
  if (key.startsWith('n:')) {
    const n = Number(key.slice(2))
    return Number.isInteger(n) && n >= 0 && n <= 36 && key === `n:${n}`
  }
  return (EVEN_MONEY_BETS as readonly string[]).includes(key) || /^(dozen|column):[123]$/.test(key)
}

/** What a winning bet pays, to 1 - the stake comes back on top. */
export function betOdds(key: RouletteBetKey): number {
  if (key.startsWith('n:')) return 35
  if (key.startsWith('dozen:') || key.startsWith('column:')) return 2
  return 1
}

/** Whether a bet wins when the ball lands in this pocket. The zero only pays a bet on 0. */
export function betWins(key: RouletteBetKey, pocket: number): boolean {
  if (key.startsWith('n:')) return Number(key.slice(2)) === pocket
  if (pocket === 0) return false
  if (key.startsWith('dozen:')) return Math.ceil(pocket / 12) === Number(key.slice(6))
  if (key.startsWith('column:')) return ((pocket - 1) % 3) + 1 === Number(key.slice(7))
  switch (key) {
    case 'low':
      return pocket <= 18
    case 'high':
      return pocket >= 19
    case 'even':
      return pocket % 2 === 0
    case 'odd':
      return pocket % 2 === 1
    case 'red':
      return pocketColor(pocket) === 'red'
    case 'black':
      return pocketColor(pocket) === 'black'
  }
  return false
}

export interface RouletteBetResult {
  key: RouletteBetKey
  amount: number
  // What came back for it (stake included) - 0 for a losing bet.
  returned: number
}

export interface RouletteSpin {
  pocket: number
  bets: RouletteBetResult[]
  totalBet: number
  totalReturned: number
  coins: number
  // The last few pockets, newest first.
  history: number[]
  // A losing spin the Croupier title gave every bet back on (totalReturned is then the bets).
  refunded?: boolean
  // A winning spin the Croupier title paid the winnings twice on (already in totalReturned).
  doubled?: boolean
}
