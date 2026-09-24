import type { FieldEffectView } from '../../shared/battle-types'

interface Props {
  screens: FieldEffectView[]
}

const SCREEN_COLORS: Record<string, string> = {
  reflect: '#f0a030',
  lightscreen: '#a040d0',
  auroraveil: '#8fe4ff'
}

const SCREEN_LABELS: Record<string, string> = {
  reflect: 'Reflect',
  lightscreen: 'Light Screen',
  auroraveil: 'Aurora Veil'
}

// Fixed order so when more than one is up, they always stack the same way.
// Each is free to overlap the others (and the Protect panel) - they just
// aren't dead-centered on the exact same spot, so every one stays visible.
const SCREEN_ORDER = ['reflect', 'lightscreen', 'auroraveil']
const SCREEN_OFFSETS: [number, number][] = [
  [6, -6],
  [26, -20],
  [46, -34]
]

function turnsText(turnsLeft: number | null): string {
  return turnsLeft != null ? ` (${turnsLeft} turn${turnsLeft === 1 ? '' : 's'})` : ''
}

// Reflect/Light Screen/Aurora Veil, drawn as translucent 16:9 panels over the
// side's Pokemon - one panel per active screen, each nudged off from the
// others so they're all visible even stacked up. Side-wide, so (like
// SideHazards) only rendered once per side rather than once per active
// Pokemon.
function SideScreens({ screens }: Props): React.JSX.Element | null {
  const active = SCREEN_ORDER.map((id) => screens.find((s) => s.id === id)).filter((s): s is FieldEffectView => !!s)
  if (active.length === 0) return null

  return (
    <div className="side-screens">
      {active.map((screen, i) => {
        const [dx, dy] = SCREEN_OFFSETS[i] ?? [0, 0]
        return (
          <div
            key={screen.id}
            className="side-screen-rect"
            style={{
              backgroundColor: SCREEN_COLORS[screen.id],
              borderColor: SCREEN_COLORS[screen.id],
              transform: `translate(calc(-50% + ${dx}px), ${dy}px)`
            }}
            title={`${SCREEN_LABELS[screen.id] ?? screen.name}${turnsText(screen.turnsLeft)}`}
          />
        )
      })}
    </div>
  )
}

export default SideScreens
