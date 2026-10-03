import { FIELD_START_TERRAINS, FIELD_START_WEATHERS } from '../../shared/battle-types'

interface Props {
  weather: string | null
  terrain: string | null
  onWeatherChange: (weather: string | null) => void
  onTerrainChange: (terrain: string | null) => void
  trickRoom: boolean
  onTrickRoomChange: (on: boolean) => void
}

// A boss's starting field (both trainer editors): weather, terrain and Trick Room that are
// up from the first turn and last until something replaces them. Off by default.
function FieldStartPicker({ weather, terrain, onWeatherChange, onTerrainChange, trickRoom, onTrickRoomChange }: Props): React.JSX.Element {
  const row = (
    label: string,
    options: { id: string; label: string }[],
    value: string | null,
    onChange: (id: string | null) => void
  ): React.JSX.Element => (
    <div className="editor-field">
      <span>{label}</span>
      <div className="trainer-chips">
        <button type="button" className={`trainer-chip${value ? '' : ' trainer-chip-on'}`} onClick={() => onChange(null)}>
          None
        </button>
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            className={`trainer-chip${value === o.id ? ' trainer-chip-on' : ''}`}
            onClick={() => onChange(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div className="trainer-editor-card">
      <h3>Field</h3>
      {row('Weather', FIELD_START_WEATHERS, weather, onWeatherChange)}
      {row('Terrain', FIELD_START_TERRAINS, terrain, onTerrainChange)}
      <div className="editor-field">
        <span>Trick Room</span>
        <div className="trainer-chips">
          <button type="button" className={`trainer-chip${trickRoom ? '' : ' trainer-chip-on'}`} onClick={() => onTrickRoomChange(false)}>
            Off
          </button>
          <button type="button" className={`trainer-chip${trickRoom ? ' trainer-chip-on' : ''}`} onClick={() => onTrickRoomChange(true)}>
            On
          </button>
        </div>
      </div>
      <p className="editor-hint">Up from the start of the fight, and lasts until a move or ability replaces it (Trick Room until someone uses Trick Room).</p>
    </div>
  )
}

export default FieldStartPicker
