import { useLayoutEffect, useRef, useState } from 'react'

interface Props {
  text: string
  // Its own styling (font size, colour...) - the size it starts from before shrinking.
  className?: string
  // How small it may shrink before cutting off with "..." - a share of its own size.
  minScale?: number
}

/**
 * A name kept to one line, so a long one never grows a card: shrunk to fit its space
 * (down to minScale of its size), and only then cut off with "..." - the whole name on
 * hover whenever it's shown any smaller or cut.
 */
function FitName({ text, className, minScale = 0.7 }: Props): React.JSX.Element {
  const outerRef = useRef<HTMLSpanElement>(null)
  const innerRef = useRef<HTMLSpanElement>(null)
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const outer = outerRef.current
    const inner = innerRef.current
    if (!outer || !inner) return
    // Measured at full size: how much wider the name is than the room it has (the line's
    // overflow shows in the outer box's scroll width). Styles are only written when a name
    // needs shrinking, so a box full of short names is measured in one layout pass.
    if (inner.style.fontSize) inner.style.fontSize = ''
    const room = outer.clientWidth
    const needed = outer.scrollWidth
    const fit = room > 0 && needed > room ? Math.max(minScale, Math.floor((room / needed) * 100) / 100) : 1
    if (fit < 1) inner.style.fontSize = `${fit}em`
    setScale(fit)
  }, [text, minScale])

  return (
    <span ref={outerRef} className={`fit-name${className ? ` ${className}` : ''}`} title={scale < 1 ? text : undefined}>
      <span ref={innerRef}>{text}</span>
    </span>
  )
}

export default FitName
