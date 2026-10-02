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

/**
 * A Pokemon's picture that never leaves a hole: if the sprite for its form is missing
 * it tries the next best (see spriteCandidates - the shiny still, the ordinary still,
 * then the normal form's sprite), and only draws nothing once all of those fail.
 */
function SpriteImage({ style, spriteId, facing = 'front', shiny = false, gmax = false, className, alt = '', draggable }: Props): React.JSX.Element | null {
  const candidates = (gmax ? gmaxSpriteCandidates : spriteCandidates)(style, facing, spriteId, shiny)
  const [step, setStep] = useState(0)

  useEffect(() => {
    setStep(0)
  }, [style, facing, spriteId, shiny, gmax])

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
      onError={() => setStep((s) => s + 1)}
    />
  )
}

export default SpriteImage
