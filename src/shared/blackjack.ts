// Game Corner blackjack's rules and cards, shared by the main process (which deals every
// card and settles every hand) and the renderer (which only shows them).
//
// Standard rules, no house tweaks: a six-deck shoe, the dealer draws to 16 and stands on
// every 17, a blackjack pays 3:2, a win pays 1:1, a tie returns the bet. The player can
// hit, stand or double down (on the first two cards); there's no splitting or insurance.

export type CardSuit = 'spades' | 'hearts' | 'diamonds' | 'clubs'
export type CardRank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'

export interface Card {
  rank: CardRank
  suit: CardSuit
}

export const CARD_SUITS: CardSuit[] = ['spades', 'hearts', 'diamonds', 'clubs']
export const CARD_RANKS: CardRank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
export const SUIT_SYMBOLS: Record<CardSuit, string> = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' }

// The face cards' Pokemon: each suit's King and Queen are a male/female pair, its Jack a
// knight.
export const FACE_CARD_POKEMON: Record<CardSuit, Record<'K' | 'Q' | 'J', string>> = {
  spades: { K: 'Nidoking', Q: 'Nidoqueen', J: 'Aegislash' },
  hearts: { K: 'Gallade', Q: 'Gardevoir', J: "Sirfetch'd" },
  diamonds: { K: 'Meowstic', Q: 'Meowstic-F', J: 'Escavalier' },
  clubs: { K: 'Indeedee', Q: 'Indeedee-F', J: 'Samurott' }
}

export const SHOE_DECKS = 6
// The shoe is reshuffled before a hand once fewer than this many cards are left.
export const RESHUFFLE_BELOW = 52

/** A hand's best total (an ace counts 11 unless that busts it), and whether an ace still counts 11. */
export function handValue(cards: Card[]): { total: number; soft: boolean } {
  let total = 0
  let aces = 0
  for (const card of cards) {
    if (card.rank === 'A') {
      aces++
      total += 11
    } else if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') total += 10
    else total += Number(card.rank)
  }
  while (total > 21 && aces > 0) {
    total -= 10
    aces--
  }
  return { total, soft: aces > 0 }
}

/** An ace and a ten-value card as the first two cards. */
export function isBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && handValue(cards).total === 21
}

export type BlackjackOutcome = 'blackjack' | 'win' | 'push' | 'lose' | 'bust' | 'dealerBlackjack'

// What the table looks like to the player. The dealer's second card stays hidden (null)
// until the hand is over.
export interface BlackjackView {
  coins: number
  phase: 'betting' | 'playing' | 'done'
  bet: number
  player: Card[]
  dealer: (Card | null)[]
  playerTotal: { total: number; soft: boolean } | null
  // The dealer's total counting only the cards showing.
  dealerTotal: { total: number; soft: boolean } | null
  canDouble: boolean
  doubled: boolean
  outcome: BlackjackOutcome | null
  // Coins handed back when the hand ended: the bet and the winnings (0 for a loss).
  returned: number
}
