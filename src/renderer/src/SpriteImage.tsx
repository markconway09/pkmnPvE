import { useEffect, useState } from 'react'
import { spriteCandidates, type SpriteStyle } from './spriteStyle'

interface Props {
  style: SpriteStyle
  spriteId: string
  facing?: 'front' | 'back'
  shiny?: boolean
  className?: string
  alt?: string
  draggable?: boolean
}

/**
 * A Pokemon's picture that never leaves a hole: if the sprite for its form is missing
 * it tries the next best (see spriteCandidates - the shiny still, the ordinary still,
 * then the normal form's sprite), and only draws nothing once all of those fail.
 */
function SpriteImage({ style, spriteId, facing = 'front', shiny = false, className, alt = '', draggable }: Props): React.JSX.Element | null {
  const candidates = spriteCandidates(style, facing, spriteId, shiny)
  const [step, setStep] = useState(0)

  useEffect(() => {
    setStep(0)
  }, [style, facing, spriteId, shiny])

  if (step >= candidates.length) return null
  return (
    <img
      className={className}
      src={candidates[step]}
      alt={alt}
      draggable={draggable}
      onError={() => setStep((s) => s + 1)}
    />
  )
}

export default SpriteImage
