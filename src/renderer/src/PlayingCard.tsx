import type { Card } from '../../shared/blackjack'
import { FACE_CARD_POKEMON, SUIT_SYMBOLS } from '../../shared/blackjack'
import { toSpriteId } from '../../shared/battle-types'
import SpriteImage from './SpriteImage'

interface Props {
  // null: face down.
  card: Card | null
  // Its place in the hand, so each card slides in a moment after the one before.
  index: number
}

/**
 * One blackjack card. Number cards show their suit big in the middle, an ace one huge
 * pip, and the face cards their Pokemon (see FACE_CARD_POKEMON). Face down it shows a
 * Poke Ball back.
 */
function PlayingCard({ card, index }: Props): React.JSX.Element {
  const style = { animationDelay: `${index * 90}ms` }
  if (!card) {
    return (
      <div className="playing-card playing-card-back" style={style}>
        <span className="playing-card-ball" />
      </div>
    )
  }
  const red = card.suit === 'hearts' || card.suit === 'diamonds'
  const suit = SUIT_SYMBOLS[card.suit]
  const face = card.rank === 'J' || card.rank === 'Q' || card.rank === 'K' ? FACE_CARD_POKEMON[card.suit][card.rank] : null
  return (
    <div className={`playing-card${red ? ' playing-card-red' : ''}`} style={style} title={face ?? undefined}>
      <span className="playing-card-corner">
        {card.rank}
        <br />
        {suit}
      </span>
      {face ? (
        <SpriteImage style="2d-static" className="playing-card-face" spriteId={toSpriteId(face)} alt={face} />
      ) : (
        <span className={`playing-card-pip${card.rank === 'A' ? ' playing-card-ace' : ''}`}>{suit}</span>
      )}
      <span className="playing-card-corner playing-card-corner-bottom">
        {card.rank}
        <br />
        {suit}
      </span>
    </div>
  )
}

export default PlayingCard
