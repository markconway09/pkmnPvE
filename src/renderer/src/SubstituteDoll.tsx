import { useEffect, useState } from 'react'

interface Props {
  facing: 'front' | 'back'
  className?: string
}

// Showdown's own real substitute doll (its client fetches the same asset
// from the same CDN this project already pulls shiny sprites from - see
// spriteUrl in spriteStyle.ts). Falls back to a small original hand-drawn
// doll if that ever fails to load, the same "never leave a hole" approach
// SpriteImage/BattleSprite already use for a missing Pokemon sprite.
const SUBSTITUTE_URL: Record<Props['facing'], string> = {
  front: 'https://play.pokemonshowdown.com/sprites/ani/substitute.gif',
  back: 'https://play.pokemonshowdown.com/sprites/ani-back/substitute.gif'
}

function FallbackDoll({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg className={className} viewBox="0 0 64 80" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="32" cy="46" rx="22" ry="30" fill="#e8d9ae" stroke="#8a6b3c" strokeWidth="2" />
      <ellipse cx="32" cy="20" rx="16" ry="14" fill="#e8d9ae" stroke="#8a6b3c" strokeWidth="2" />
      <path d="M28 8 Q32 0 36 8" stroke="#8a6b3c" strokeWidth="2" fill="none" strokeLinecap="round" />
      <g stroke="#3a2c14" strokeWidth="2.5" strokeLinecap="round">
        <path d="M22 18 L28 24 M28 18 L22 24" />
        <path d="M36 18 L42 24 M42 18 L36 24" />
      </g>
      <polyline
        points="20,32 24,28 28,32 32,28 36,32 40,28 44,32"
        fill="none"
        stroke="#3a2c14"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M32 34 L32 74" stroke="#8a6b3c" strokeWidth="1.5" strokeDasharray="3 3" />
      <ellipse cx="10" cy="48" rx="6" ry="10" fill="#e8d9ae" stroke="#8a6b3c" strokeWidth="2" />
      <ellipse cx="54" cy="48" rx="6" ry="10" fill="#e8d9ae" stroke="#8a6b3c" strokeWidth="2" />
    </svg>
  )
}

function SubstituteDoll({ facing, className }: Props): React.JSX.Element {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [facing])

  if (failed) return <FallbackDoll className={className} />

  return (
    <img
      className={className}
      src={SUBSTITUTE_URL[facing]}
      alt="Substitute"
      onError={() => setFailed(true)}
    />
  )
}

export default SubstituteDoll
