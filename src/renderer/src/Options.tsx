import { useEffect, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { SPRITE_STYLES, spriteUrl, type SpriteStyle } from './spriteStyle'
import UpdatesSection from './UpdatesSection'
import BackgroundSection from './BackgroundSection'
import SavesModal from './SavesModal'
import SpriteCreditsModal from './SpriteCreditsModal'
import WelcomeGuide from './WelcomeGuide'
import LanguagePicker from './LanguagePicker'
import { BUG_REPORT_URL } from '../../shared/about'
import { playSfx, setSfxOn, setSfxVolume, sfxLevel, sfxOn } from './sfx'
import { cryOn, cryVolume, playCry, setCryOn, setCryVolume } from './cries'
import {
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
import { ANIM_SPEEDS, animSpeed, setAnimSpeed, type AnimSpeed } from './animSpeed'
import { IS_MOBILE } from './platform'
import { UI_SCALE_CHOICES, type UiScaleChoice, type UiScaleState } from '../../shared/ui-scale'
import { useT, type Translate } from './i18n'

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

// The phone app can't look through folders, so it has no folder source.
const MUSIC_SOURCES: MusicSource[] = IS_MOBILE ? ['freetouse', 'links'] : ['freetouse', 'links', 'folder']

/** Where the music comes from (see music.ts): Free To Use's lofi, the player's own links, or a folder. */
function MusicSourceSettings(): React.JSX.Element {
  const t = useT()
  const music = useSyncExternalStore(subscribeMusic, musicState)
  // The links being typed - only used once "Use these links" is pressed.
  const [draft, setDraft] = useState(music.links)
  const count = t('music.tracks', { count: music.trackCount })

  return (
    <div className="options-music-source">
      <TabStrip
        className="options-music-tabs"
        tabs={MUSIC_SOURCES.map((id) => ({ id, label: t(`music.source.${id}`) }))}
        current={music.source}
        onSwitch={setMusicSource}
      />
      {music.source === 'freetouse' && <p className="editor-hint">{t('music.freetouseHint', { tracks: count })}</p>}
      {music.source === 'links' && (
        <>
          <p className="editor-hint">{t('music.linksHint')}</p>
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
              {t('music.useLinks')}
            </button>
            <span className="editor-hint">{count}</span>
          </div>
        </>
      )}
      {music.source === 'folder' && (
        <>
          <p className="editor-hint">{t('music.folderHint')}</p>
          <div className="options-music-row">
            <button onClick={() => void chooseMusicFolder()}>{t('music.chooseFolder')}</button>
            {music.folder && (
              <button disabled={music.scanning} onClick={rescanMusicFolder}>
                {t('music.lookAgain')}
              </button>
            )}
          </div>
          <p className="options-music-folder" title={music.folder}>
            {!music.folder
              ? t('music.noFolder')
              : music.scanning
                ? t('music.scanning', { folder: music.folder })
                : `${music.folder} - ${music.trackCount ? count : t('music.noFiles')}`}
          </p>
        </>
      )}
    </div>
  )
}

/** A screen size's tab: Auto and Mobile are words, the fixed sizes just their zoom. */
function screenSizeLabel(choice: UiScaleChoice, t: Translate): string {
  if (choice === 'auto') return t('screen.auto')
  if (choice === 'mobile') return t('screen.mobile')
  return `${choice}%`
}

/** Options → Screen size: Auto fits the game to the screen, or a fixed zoom. */
function ScreenSizeSection(): React.JSX.Element {
  const t = useT()
  const [state, setState] = useState<UiScaleState | null>(null)

  useEffect(() => {
    void window.api.getUiScale().then(setState)
  }, [])

  return (
    <section className="options-section">
      <h2 className="options-heading">{t('screen.title')}</h2>
      {state && (
        <>
          <TabStrip
            className="options-scale-tabs"
            tabs={UI_SCALE_CHOICES.map((id) => ({ id, label: screenSizeLabel(id, t) }))}
            current={state.choice}
            onSwitch={(next) => {
              setState({ ...state, choice: next })
              void window.api.setUiScale(next).then(setState)
            }}
          />
          <p className="editor-hint">
            {state.choice === 'auto'
              ? t('screen.autoHint', { percent: Math.round(state.zoom * 100) })
              : state.choice === 'mobile'
                ? t('screen.mobileHint')
                : t('screen.fixedHint')}
          </p>
        </>
      )}
    </section>
  )
}

/** The on/off switch at the start of each sound row. */
function SoundSwitch({ label, on, onToggle }: { label: string; on: boolean; onToggle: (on: boolean) => void }): React.JSX.Element {
  const t = useT()
  const name = label.toLowerCase()
  return (
    <button
      className={`options-sound-toggle${on ? ' options-sound-toggle-on' : ''}`}
      role="switch"
      aria-checked={on}
      aria-label={t('sound.switch', { name: label })}
      title={on ? t('sound.turnOff', { name }) : t('sound.turnOn', { name })}
      onClick={() => onToggle(!on)}
    >
      <span className="options-sound-toggle-knob" />
    </button>
  )
}

/** A sound row with just the switch: the Game Corner's sounds, which follow the Menus volume. */
function SwitchRow({ label, on, onToggle }: { label: string; on: boolean; onToggle: (on: boolean) => void }): React.JSX.Element {
  const t = useT()
  return (
    <>
      <SoundSwitch label={label} on={on} onToggle={onToggle} />
      <span className={`options-volume-label${on ? '' : ' options-volume-off'}`}>{label}</span>
      <span />
      <span className={`options-volume-value${on ? '' : ' options-volume-off'}`}>{on ? t('common.on') : t('common.off')}</span>
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
  const t = useT()
  // On the phone the slider is too small to drag: the volume shows on a button that opens
  // the slider in a small window (like the Game Corner's bet).
  const [open, setOpen] = useState(false)
  const shown = !on ? t('common.off') : value === 0 ? t('common.muted') : `${value}%`
  const volumeLabel = t('sound.volume', { name: label })
  if (IS_MOBILE) {
    const nudge = (by: number): void => {
      onChange(Math.min(100, Math.max(0, value + by)))
      onRelease?.()
    }
    return (
      <>
        <SoundSwitch label={label} on={on} onToggle={onToggle} />
        <span className={`options-volume-label${on ? '' : ' options-volume-off'}`}>{label}</span>
        <button className="options-volume-open" disabled={!on} onClick={() => setOpen(true)}>
          {shown}
          <span className="bet-open-caret">▾</span>
        </button>
        {open &&
          createPortal(
            <div
              className="modal-overlay bet-modal-overlay"
              onMouseDown={(e) => {
                // Only this window closes, not Options under it.
                e.stopPropagation()
                setOpen(false)
              }}
            >
              <div className="modal-panel bet-modal" onMouseDown={(e) => e.stopPropagation()}>
                <h3 className="bet-modal-title">{volumeLabel}</h3>
                <div className="bet-modal-value">{shown}</div>
                <div className="bet-modal-row">
                  <button className="slots-bet-step" disabled={value <= 0} onClick={() => nudge(-5)}>
                    −
                  </button>
                  <input
                    type="range"
                    className="slots-bet-slider"
                    min={0}
                    max={100}
                    step={5}
                    value={value}
                    aria-label={volumeLabel}
                    onChange={(e) => onChange(Number(e.target.value))}
                    onPointerUp={onRelease}
                  />
                  <button className="slots-bet-step" disabled={value >= 100} onClick={() => nudge(5)}>
                    +
                  </button>
                </div>
                <button className="bet-modal-done" onClick={() => setOpen(false)}>
                  {t('common.done')}
                </button>
              </div>
            </div>,
            document.body
          )}
      </>
    )
  }
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
        aria-label={volumeLabel}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={onRelease}
      />
      <span className={`options-volume-value${on ? '' : ' options-volume-off'}`}>{shown}</span>
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
  const t = useT()
  const [loggingOut, setLoggingOut] = useState(false)
  const [savesOpen, setSavesOpen] = useState(false)
  const [creditsOpen, setCreditsOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
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
          <h2>{t('options.title')}</h2>
          <button className="options-modal-close" data-sfx="close" title={t('options.closeEsc')} onClick={onClose}>
            ×
          </button>
        </div>
        <div className="options-modal-body">
          <section className="options-section">
            <UpdatesSection />
          </section>

          <section className="options-section">
            <h2 className="options-heading">{t('options.language')}</h2>
            <LanguagePicker className="options-language-tabs" />
            <p className="editor-hint">{t('options.languageHint')}</p>
          </section>

          <section className="options-section">
            <h2 className="options-heading">{t('sound.title')}</h2>
            <div className="options-volume">
              <VolumeRow
                label={t('sound.menus')}
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
                label={t('sound.cries')}
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
                label={t('sound.music')}
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
                label={t('sound.gameCorner')}
                on={cornerOn}
                onToggle={(next) => {
                  setCornerOn(next)
                  setCornerSoundsOn(next)
                }}
              />
            </div>
            {musicOn && <MusicSourceSettings />}
          </section>

          {!IS_MOBILE && <ScreenSizeSection />}

          <section className="options-section">
            <h2 className="options-heading">{t('anim.title')}</h2>
            <TabStrip
              className="options-anim-tabs"
              tabs={ANIM_SPEEDS.map((id) => ({ id, label: t(`anim.${id}`) }))}
              current={moveAnims}
              onSwitch={(next) => {
                setMoveAnims(next)
                setAnimSpeed(next)
              }}
            />
          </section>

          {/* The phone app only ships the 3D stills. */}
          {!IS_MOBILE && (
          <section className="options-section">
          <h2 className="options-heading">{t('sprites.title')}</h2>
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
                  alt={t(`sprites.${style}`)}
                />
                <span>{t(`sprites.${style}`)}</span>
              </button>
            ))}
          </div>
          </section>
          )}

          <section className="options-section">
            <BackgroundSection background={background} onChange={onChangeBackground} />
          </section>

          <section className="options-section">
            <h2 className="options-heading">{t('saves.title')}</h2>
            <p className="editor-hint">{t('saves.hint')}</p>
            <p className="editor-hint">{t('saves.warning')}</p>
            <div>
              <button onClick={() => setSavesOpen(true)}>{t('saves.button')}</button>
            </div>
            {savesOpen && <SavesModal onClose={() => setSavesOpen(false)} />}
          </section>

          <section className="options-section">
            <h2 className="options-heading">{t('about.title')}</h2>
            <p className="editor-hint">{t('about.fanNotice')}</p>
            <p className="editor-hint">{t('about.showdown')}</p>
            <div className="options-about-buttons">
              <button onClick={() => setGuideOpen(true)}>{t('about.guide')}</button>
              <button onClick={() => setCreditsOpen(true)}>{t('about.credits')}</button>
            </div>
            {guideOpen && <WelcomeGuide onClose={() => setGuideOpen(false)} />}
            {creditsOpen && <SpriteCreditsModal onClose={() => setCreditsOpen(false)} />}
            <p className="editor-hint">{IS_MOBILE ? t('about.bug') : t('about.bugWithLog')}</p>
            <div className="options-about-buttons">
              <button onClick={() => window.open(BUG_REPORT_URL, '_blank')}>{t('about.reportBug')}</button>
              {!IS_MOBILE && (
                <button onClick={() => void window.api.openLogFolder().catch(() => undefined)}>{t('about.openLogs')}</button>
              )}
            </div>
          </section>

          <section className="options-section">
          <h2 className="options-heading">{t('account.title')}</h2>
          <p className="editor-hint">{t('account.loggedInAs', { name: username })}</p>
          <div>
            <button
              disabled={loggingOut}
              onClick={() => {
                setLoggingOut(true)
                void onLogout().finally(() => setLoggingOut(false))
              }}
            >
              {t('account.logOut')}
            </button>
          </div>
          </section>
        </div>

        <div className="editor-actions">
          <button onClick={onClose}>{t('common.close')}</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default Options
