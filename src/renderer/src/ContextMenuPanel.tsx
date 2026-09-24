import { useMenuPosition } from './useMenuPosition'

interface Props {
  x: number
  y: number
  children: React.ReactNode
}

// The menu box itself, kept on screen: it opens above the cursor near the
// bottom of the window and to the left of it near the right edge.
function ContextMenuPanel({ x, y, children }: Props): React.JSX.Element {
  const { ref, style } = useMenuPosition(x, y)
  return (
    <div ref={ref} className="context-menu" style={style} onMouseDown={(e) => e.stopPropagation()}>
      {children}
    </div>
  )
}

export default ContextMenuPanel
