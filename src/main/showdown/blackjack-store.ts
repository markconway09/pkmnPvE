import { randomInt } from 'node:crypto'
import type { BlackjackOutcome, BlackjackView, Card } from '../../shared/blackjack'
import { CARD_RANKS, CARD_SUITS, RESHUFFLE_BELOW, SHOE_DECKS, handValue, isBlackjack } from '../../shared/blackjack'
import { changeCoins, getCoins } from './game-corner-store'
import { onPlayerChange } from './player-session'

/**
 * Game Corner blackjack, dealt and settled here (the renderer only shows the table - see
 * shared/blackjack for the rules). The bet leaves the player's coins when the hand is
 * dealt and whatever it wins comes back when it ends. The shoe and the hand in play live
 * only while the game runs: closing it mid-hand forfeits that bet, like walking away.
 */

interface Round {
  bet: number
  player: Card[]
  dealer: Card[]
  doubled: boolean
  done: boolean
  outcome: BlackjackOutcome | null
  returned: number
}

let shoe: Card[] = []
let round: Round | null = null

// Another player's table is a different table.
onPlayerChange(() => {
  shoe = []
  round = null
})

function freshShoe(): Card[] {
  const cards: Card[] = []
  for (let d = 0; d < SHOE_DECKS; d++) for (const suit of CARD_SUITS) for (const rank of CARD_RANKS) cards.push({ rank, suit })
  // Fisher-Yates with a cryptographic random source.
  for (let i = cards.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[cards[i], cards[j]] = [cards[j], cards[i]]
  }
  return cards
}

function draw(): Card {
  if (shoe.length === 0) shoe = freshShoe()
  return shoe.pop()!
}

function view(): BlackjackView {
  const coins = getCoins()
  if (!round) {
    return {
      coins,
      phase: 'betting',
      bet: 0,
      player: [],
      dealer: [],
      playerTotal: null,
      dealerTotal: null,
      canDouble: false,
      doubled: false,
      outcome: null,
      returned: 0
    }
  }
  // The dealer's second card stays face down until the hand is over.
  const dealerShown = round.done ? round.dealer : round.dealer.slice(0, 1)
  return {
    coins,
    phase: round.done ? 'done' : 'playing',
    bet: round.bet,
    player: [...round.player],
    dealer: round.done ? [...round.dealer] : [round.dealer[0], null],
    playerTotal: handValue(round.player),
    dealerTotal: handValue(dealerShown),
    canDouble: !round.done && round.player.length === 2 && !round.doubled && coins >= round.bet,
    doubled: round.doubled,
    outcome: round.outcome,
    returned: round.returned
  }
}

// Ends the hand: the dealer plays out (unless the player already bust), then it's paid.
function settle(current: Round): void {
  const player = handValue(current.player).total
  let outcome: BlackjackOutcome
  if (player > 21) outcome = 'bust'
  else {
    // The dealer draws to 16 and stands on every 17.
    while (handValue(current.dealer).total < 17) current.dealer.push(draw())
    const dealer = handValue(current.dealer).total
    if (dealer > 21 || player > dealer) outcome = 'win'
    else if (player === dealer) outcome = 'push'
    else outcome = 'lose'
  }
  finish(current, outcome)
}

function finish(current: Round, outcome: BlackjackOutcome): void {
  const returned =
    outcome === 'blackjack'
      ? current.bet + Math.floor((current.bet * 3) / 2)
      : outcome === 'win'
        ? current.bet * 2
        : outcome === 'push'
          ? current.bet
          : 0
  if (returned > 0) changeCoins(returned)
  current.done = true
  current.outcome = outcome
  current.returned = returned
}

function activeRound(): Round {
  if (!round || round.done) throw new Error('No hand is being played - place a bet to deal')
  return round
}

export function getBlackjackView(): BlackjackView {
  return view()
}

/** Takes the bet and deals two cards each. A blackjack on either side ends the hand at once. */
export function dealBlackjack(bet: number): BlackjackView {
  if (round && !round.done) throw new Error('Finish this hand first')
  if (!Number.isInteger(bet) || bet < 1) throw new Error('Bet at least 1 coin')
  changeCoins(-bet)
  if (shoe.length < RESHUFFLE_BELOW) shoe = freshShoe()
  const current: Round = { bet, player: [], dealer: [], doubled: false, done: false, outcome: null, returned: 0 }
  current.player.push(draw())
  current.dealer.push(draw())
  current.player.push(draw())
  current.dealer.push(draw())
  round = current
  const playerBJ = isBlackjack(current.player)
  const dealerBJ = isBlackjack(current.dealer)
  if (playerBJ || dealerBJ) finish(current, playerBJ && dealerBJ ? 'push' : playerBJ ? 'blackjack' : 'dealerBlackjack')
  return view()
}

/** Another card. Going over 21 loses the hand; reaching 21 stands on its own. */
export function hitBlackjack(): BlackjackView {
  const current = activeRound()
  current.player.push(draw())
  if (handValue(current.player).total >= 21) settle(current)
  return view()
}

export function standBlackjack(): BlackjackView {
  settle(activeRound())
  return view()
}

/** Doubles the bet on the first two cards, takes exactly one more card, and stands. */
export function doubleBlackjack(): BlackjackView {
  const current = activeRound()
  if (current.player.length !== 2 || current.doubled) throw new Error('You can only double down on your first two cards')
  changeCoins(-current.bet)
  current.bet *= 2
  current.doubled = true
  current.player.push(draw())
  settle(current)
  return view()
}
