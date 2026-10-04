import { useEffect, useState } from 'react'
import { gmaxSpriteCandidates, spriteCandidates, type SpriteStyle } from './spriteStyle'

interface Props {
  style: SpriteStyle
  spriteId: string
  facing?: 'front' | 'back'
  shiny?: boolean
  // Its Gigantamax picture first (the cosmetic look), its ordinary one if there's none.
  gmax?: boolean
  className?: string
  alt?: string
  draggable?: boolean
}

// Which picture in a candidate list actually loaded (or the list's length if none did),
// remembered for the whole session - so reopening the box goes straight to the working
// sprite instead of failing the same missing ones again every time.
const resolvedStep = new Map<string, number>()

/**
 * A Pokemon's picture that never leaves a hole: if the sprite for its form is missing
 * it tries the next best (see spriteCandidates - the shiny still, the ordinary still,
 * then the normal form's sprite), and only draws nothing once all of those fail.
 */
function SpriteImage({ style, spriteId, facing = 'front', shiny = false, gmax = false, className, alt = '', draggable }: Props): React.JSX.Element | null {
  const candidates = (gmax ? gmaxSpriteCandidates : spriteCandidates)(style, facing, spriteId, shiny)
  const key = candidates.join('|')
  const [step, setStep] = useState(() => resolvedStep.get(key) ?? 0)

  useEffect(() => {
    setStep(resolvedStep.get(key) ?? 0)
  }, [key])

  if (step >= candidates.length) return null
  // The 3D stills (HOME art) are big smooth renders, not pixel art - drawn smoothly
  // whatever the spot's own image-rendering says.
  const src = candidates[step]
  const smooth = src.includes('/3d-static/') || src.includes('/home-shiny/')
  return (
    <img
      className={smooth ? `${className ?? ''} sprite-smooth`.trim() : className}
      src={src}
      alt={alt}
      draggable={draggable}
      onLoad={() => resolvedStep.set(key, step)}
      onError={() => {
        if (step + 1 >= candidates.length) resolvedStep.set(key, candidates.length)
        setStep(step + 1)
      }}
    />
  )
}

export default SpriteImage
