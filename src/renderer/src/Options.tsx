import { useEffect, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { SPRITE_STYLES, SPRITE_STYLE_LABELS, spriteUrl, type SpriteStyle } from './spriteStyle'
import UpdatesSection from './UpdatesSection'
import BackgroundSection from './BackgroundSection'
import CloudSavesSection from './CloudSavesSection'
import { playSfx, setSfxOn, setSfxVolume, sfxLevel, sfxOn } from './sfx'
import { cryOn, cryVolume, playCry, setCryOn, setCryVolume } from './cries'
import {
  MUSIC_SOURCE_LABELS,
  chooseMusicFolder,
  musicState,
  rescanMusicFolder,
  setMusicLinks,
  setMusicOn,
  setMusicSource,
  setMusicVolume,
  subscribeMusic,
  type MusicSource
} from './music'
import TabStrip from './TabStrip'
import { cornerSoundsOn, setCornerSoundsOn } from './ticks'
import { ANIM_SPEEDS, ANIM_SPEED_LABELS, animSpeed, setAnimSpeed, type AnimSpeed } from './animSpeed'
import { UI_SCALE_CHOICES, UI_SCALE_LABELS, type UiScaleState } from '../../shared/ui-scale'

interface Props {
  username: string
  onLogout: () => Promise<void>
  spriteStyle: SpriteStyle
  onChangeSpriteStyle: (style: SpriteStyle) => void
  background: string | null
  onChangeBackground: (background: string | null) => void
  onClose: () => void
}

const PREVIEW_SPECIES_ID = 'pikachu'

const MUSIC_SOURCES: MusicSource[] = ['freetouse', 'links', 'folder']

/** Where the music comes from (see music.ts): Free To Use's lofi, the player's own links, or a folder. */
function MusicSourceSettings(): React.JSX.Element {
  const music = useSyncExternalStore(subscribeMusic, musicState)
  // The links being typed - only used once "Use these links" is pressed.
  const [draft, setDraft] = useState(music.links)
  const count = `${music.trackCount} track${music.trackCount === 1 ? '' : 's'}`

  return (
    <div className="options-music-source">
      <TabStrip
        className="options-music-tabs"
        tabs={MUSIC_SOURCES.map((id) => ({ id, label: MUSIC_SOURCE_LABELS[id] }))}
        current={music.source}
        onSwitch={setMusicSource}
      />
      {music.source === 'freetouse' && (
        <p className="editor-hint">
          {count} of free lofi from freetouse.com, streamed - so no music while offline.
        </p>
      )}
      {music.source === 'links' && (
        <>
          <p className="editor-hint">
            One link per line: direct audio files (.mp3, .ogg...) or internet radio streams, played in
            order. Pages like YouTube or Spotify won't work - the link has to be the audio itself.
          </p>
          <textarea
            className="options-music-links"
            rows={4}
            spellCheck={false}
            placeholder="https://example.com/song.mp3"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="options-music-row">
            <button disabled={draft === music.links} onClick={() => setMusicLinks(draft)}>
              Use these links
            </button>
            <span className="editor-hint">{count}</span>
          </div>
        </>
      )}
      {music.source === 'folder' && (
        <>
          <p className="editor-hint">
            Plays the music files in a folder on this computer (and its subfolders), shuffled. Works
            offline.
          </p>
          <div className="options-music-row">
            <button onClick={() => void chooseMusicFolder()}>Choose folder…</button>
            {music.folder && (
              <button disabled={music.scanning} onClick={rescanMusicFolder}>
                Look again
              </button>
            )}
          </div>
          <p className="options-music-folder" title={music.folder}>
            {!music.folder
              ? 'No folder chosen yet.'
              : music.scanning
                ? `Looking through ${music.folder}…`
                : `${music.folder} - ${music.trackCount ? count : 'no music files found'}`}
          </p>
        </>
      )}
    </div>
  )
}

/** Options → Screen size: Auto fits the game to the screen, or a fixed zoom. */
function ScreenSizeSection(): React.JSX.Element {
  const [state, setState] = useState<UiScaleState | null>(null)

  useEffect(() => {
    void window.api.getUiScale().then(setState)
  }, [])

  return (
    <section className="options-section">
      <h2 className="options-heading">Screen size</h2>
      {state && (
        <>
          <TabStrip
            className="options-scale-tabs"
            tabs={UI_SCALE_CHOICES.map((id) => ({ id, label: UI_SCALE_LABELS[id] }))}
            current={state.choice}
            onSwitch={(next) => {
              setState({ ...state, choice: next })
              void window.api.setUiScale(next).then(setState)
            }}
          />
          <p className="editor-hint">
            {state.choice === 'auto'
              ? `Fits the game to this screen - ${Math.round(state.zoom * 100)}% here.`
              : 'The game always draws at this size; the window is never bigger than the screen.'}
          </p>
        </>
      )}
    </section>
  )
}

/** The on/off switch at the start of each sound row. */
function SoundSwitch({ label, on, onToggle }: { label: string; on: boolean; onToggle: (on: boolean) => void }): React.JSX.Element {
  return (
    <button
      className={`options-sound-toggle${on ? ' options-sound-toggle-on' : ''}`}
      role="switch"
      aria-checked={on}
      aria-label={`${label} sound`}
      title={on ? `Turn ${label.toLowerCase()} off` : `Turn ${label.toLowerCase()} on`}
      onClick={() => onToggle(!on)}
    >
      <span className="options-sound-toggle-knob" />
    </button>
  )
}

/** A sound row with just the switch: the Game Corner's sounds, which follow the Menus volume. */
function SwitchRow({ label, on, onToggle }: { label: string; on: boolean; onToggle: (on: boolean) => void }): React.JSX.Element {
  return (
    <>
      <SoundSwitch label={label} on={on} onToggle={onToggle} />
      <span className={`options-volume-label${on ? '' : ' options-volume-off'}`}>{label}</span>
      <span />
      <span className={`options-volume-value${on ? '' : ' options-volume-off'}`}>{on ? 'On' : 'Off'}</span>
    </>
  )
}

/** One sound's row in Options: an on/off switch, its name, a volume slider and the value. */
function VolumeRow({
  label,
  on,
  value,
  onToggle,
  onChange,
  onRelease
}: {
  label: string
  on: boolean
  value: number
  onToggle: (on: boolean) => void
  onChange: (value: number) => void
  onRelease?: () => void
}): React.JSX.Element {
  return (
    <>
      <SoundSwitch label={label} on={on} onToggle={onToggle} />
      <span className={`options-volume-label${on ? '' : ' options-volume-off'}`}>{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        disabled={!on}
        aria-label={`${label} volume`}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={onRelease}
      />
      <span className={`options-volume-value${on ? '' : ' options-volume-off'}`}>
        {!on ? 'Off' : value === 0 ? 'Muted' : `${value}%`}
      </span>
    </>
  )
}

function Options({
  username,
  onLogout,
  spriteStyle,
  onChangeSpriteStyle,
  background,
  onChangeBackground,
  onClose
}: Props): React.JSX.Element {
  const [loggingOut, setLoggingOut] = useState(false)
  const [volume, setVolume] = useState(() => Math.round(sfxLevel() * 100))
  const [menuSoundsOn, setMenuSoundsOn] = useState(sfxOn)
  const [cries, setCries] = useState(() => Math.round(cryVolume() * 100))
  const [criesOn, setCriesOn] = useState(cryOn)
  const [music, setMusic] = useState(() => Math.round(musicState().volume * 100))
  const [musicOn, setMusicOnState] = useState(() => musicState().on)
  const [cornerOn, setCornerOn] = useState(cornerSoundsOn)
  const [moveAnims, setMoveAnims] = useState<AnimSpeed>(animSpeed)

  // Esc closes it, like clicking outside.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-panel options-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="options-modal-header">
          <h2>Options</h2>
          <button className="options-modal-close" data-sfx="close" title="Close (Esc)" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="options-modal-body">
          <section className="options-section">
            <UpdatesSection />
          </section>

          <section className="options-section">
          <h2 className="options-heading">Account</h2>
          <p className="editor-hint">Logged in as {username}</p>
          <div>
            <button
              disabled={loggingOut}
              onClick={() => {
                setLoggingOut(true)
                void onLogout().finally(() => setLoggingOut(false))
              }}
            >
              Log out
            </button>
          </div>
          </section>

          <section className="options-section">
            <CloudSavesSection />
          </section>

          <section className="options-section">
          <h2 className="options-heading">Sprite style</h2>
          <div className="sprite-style-grid">
            {SPRITE_STYLES.map((style) => (
              <button
                key={style}
                className={`sprite-style-option ${style === spriteStyle ? 'sprite-style-selected' : ''}`}
                onClick={() => onChangeSpriteStyle(style)}
              >
                <img
                  className="sprite-style-preview"
                  src={spriteUrl(style, 'front', PREVIEW_SPECIES_ID)}
                  alt={SPRITE_STYLE_LABELS[style]}
                />
                <span>{SPRITE_STYLE_LABELS[style]}</span>
              </button>
            ))}
          </div>
          </section>

          <ScreenSizeSection />

          <section className="options-section">
            <h2 className="options-heading">Move animations</h2>
            <TabStrip
              className="options-anim-tabs"
              tabs={ANIM_SPEEDS.map((id) => ({ id, label: ANIM_SPEED_LABELS[id] }))}
              current={moveAnims}
              onSwitch={(next) => {
                setMoveAnims(next)
                setAnimSpeed(next)
              }}
            />
          </section>

          <section className="options-section">
            <h2 className="options-heading">Sound</h2>
            <div className="options-volume">
              <VolumeRow
                label="Menus"
                on={menuSoundsOn}
                value={volume}
                onToggle={(next) => {
                  setMenuSoundsOn(next)
                  setSfxOn(next)
                }}
                onChange={(next) => {
                  setVolume(next)
                  setSfxVolume(next / 100)
                }}
                // A click on letting go, to hear the new volume.
                onRelease={() => playSfx('click')}
              />
              <VolumeRow
                label="Cries"
                on={criesOn}
                value={cries}
                onToggle={(next) => {
                  setCriesOn(next)
                  setCryOn(next)
                }}
                onChange={(next) => {
                  setCries(next)
                  setCryVolume(next / 100)
                }}
                // A Pikachu on letting go, to hear the new volume.
                onRelease={() => playCry('pikachu')}
              />
              <VolumeRow
                label="Music"
                on={musicOn}
                value={music}
                onToggle={(next) => {
                  setMusicOnState(next)
                  setMusicOn(next)
                }}
                onChange={(next) => {
                  setMusic(next)
                  setMusicVolume(next / 100)
                }}
              />
              <SwitchRow
                label="Game Corner"
                on={cornerOn}
                onToggle={(next) => {
                  setCornerOn(next)
                  setCornerSoundsOn(next)
                }}
              />
            </div>
            {musicOn && <MusicSourceSettings />}
          </section>

          <section className="options-section">
            <BackgroundSection background={background} onChange={onChangeBackground} />
          </section>
        </div>

        <div className="editor-actions">
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default Options
