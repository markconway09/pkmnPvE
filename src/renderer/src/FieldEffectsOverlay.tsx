import type { FieldEffectView } from '../../shared/battle-types'
import { INTENSE_WEATHER, OVERLAY_STYLES, overlayImageUrl } from './battleScenery'

interface Props {
  effects: FieldEffectView[]
}

const KIND_ORDER: FieldEffectView['kind'][] = ['weather', 'terrain', 'field', 'side']

function turnsText(turnsLeft: number): string {
  return `(${turnsLeft} turn${turnsLeft === 1 ? '' : 's'})`
}

function badgeLabel(effect: FieldEffectView): string {
  const name = effect.side === 'p2' ? `Foe's ${effect.name}` : effect.name
  return effect.turnsLeft != null ? `${name} ${turnsText(effect.turnsLeft)}` : name
}

function layerStyle(id: string): React.CSSProperties | null {
  const style = OVERLAY_STYLES[id]
  return style
    ? { backgroundColor: style.backgroundColor, backgroundImage: `url(${overlayImageUrl(style)})` }
    : null
}

// The full-scene weather/terrain tint plus the turns-left badge in the corner,
// the same two things Pokemon Showdown draws over a battle. Sits behind the
// Pokemon sprites (see .sprite-slot's z-index).
function FieldEffectsOverlay({ effects }: Props): React.JSX.Element {
  const weather = effects.find((e) => e.kind === 'weather')
  // Showdown paints a terrain and a room-style effect (Trick Room, Gravity...)
  // in the same layer, so only one shows at a time and terrain wins.
  const terrainLayer =
    effects.find((e) => e.kind === 'terrain') ?? [...effects].reverse().find((e) => e.kind === 'field' && OVERLAY_STYLES[e.id])
  const badges = KIND_ORDER.flatMap((kind) => effects.filter((e) => e.kind === kind))

  const terrainStyle = terrainLayer ? layerStyle(terrainLayer.id) : null
  const weatherStyle = weather ? layerStyle(weather.id) : null

  return (
    <>
      {terrainLayer && terrainStyle && (
        <div key={terrainLayer.id} className="field-overlay field-overlay-terrain" style={terrainStyle} />
      )}
      {weather && weatherStyle && (
        <div
          key={weather.id}
          className="field-overlay"
          style={{ ...weatherStyle, opacity: INTENSE_WEATHER.has(weather.id) ? 0.9 : 0.5 }}
        />
      )}
      {badges.length > 0 && (
        <div className="field-badges">
          {badges.map((effect) => (
            <div
              key={`${effect.kind}-${effect.side ?? ''}-${effect.id}`}
              className="field-badge"
              style={{ color: OVERLAY_STYLES[effect.id]?.textColor ?? '#1a2230' }}
            >
              {badgeLabel(effect)}
            </div>
          ))}
        </div>
      )}
    </>
  )
}

export default FieldEffectsOverlay
