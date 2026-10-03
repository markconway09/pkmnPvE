import { useSyncExternalStore } from 'react'
import {
  musicState,
  nextTrack,
  previousTrack,
  seekMusic,
  subscribeMusic,
  toggleMusicMuted,
  toggleMusicPlaying
} from './music'

// The background music's controls in the top bar (see music.ts): the track's cover (a music
// note when it has none), its title and artist (the credit Free To Use asks for), a bar to
// see and jump through it (just "LIVE" for a radio stream), previous / play-pause / next,
// and a mute button. Hidden while the music is switched off in Options.

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const ICONS = {
  previous: 'M6 5h2v14H6zM20 5v14L9 12z',
  next: 'M16 5h2v14h-2zM4 5v14l11-7z',
  play: 'M7 4v16l13-8z',
  pause: 'M6 4h4v16H6zM14 4h4v16h-4z',
  sound: 'M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z',
  note: 'M12 3v10.6A4 4 0 1 0 14 17V7h4V3z',
  muted: 'M3 9v6h4l5 5V4L7 9H3zm13.6 3 2.7-2.7-1.4-1.4-2.7 2.7-2.7-2.7-1.4 1.4 2.7 2.7-2.7 2.7 1.4 1.4 2.7-2.7 2.7 2.7 1.4-1.4z'
}

function Icon({ path }: { path: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={path} fill="currentColor" />
    </svg>
  )
}

function MusicPlayer(): React.JSX.Element | null {
  const music = useSyncExternalStore(subscribeMusic, musicState)
  if (!music.on || !music.track) return null
  const { track } = music
  const freeToUse = music.source === 'freetouse'
  const credit = freeToUse ? ' - music from freetouse.com' : ''
  const progress = music.duration > 0 ? Math.min(1, music.position / music.duration) : 0

  return (
    <div className={`music-player${music.playing ? ' music-player-playing' : ''}`}>
      {track.cover ? (
        <img className="music-player-cover" src={track.cover} alt="" />
      ) : (
        <span className="music-player-cover music-player-cover-blank">
          <Icon path={ICONS.note} />
        </span>
      )}
      <div className="music-player-info" title={`${track.title} by ${track.artist}${credit}`}>
        <span className="music-player-title">{track.title}</span>
        <span className="music-player-artist">
          {track.artist}
          {freeToUse && ' · freetouse.com'}
        </span>
        <div
          className={`music-player-bar${music.live ? ' music-player-bar-live' : ''}`}
          onClick={(e) => {
            const box = e.currentTarget.getBoundingClientRect()
            seekMusic((e.clientX - box.left) / box.width)
          }}
        >
          <div className="music-player-fill" style={{ width: `${music.live ? 100 : progress * 100}%` }} />
        </div>
      </div>
      <span className="music-player-time">
        {music.live ? 'LIVE' : `${formatTime(music.position)} / ${formatTime(music.duration)}`}
      </span>
      <div className="music-player-controls">
        <button className="music-player-button" title="Previous track" onClick={previousTrack}>
          <Icon path={ICONS.previous} />
        </button>
        <button
          className="music-player-button music-player-play"
          title={music.playing ? 'Pause' : 'Play'}
          onClick={toggleMusicPlaying}
        >
          <Icon path={music.playing ? ICONS.pause : ICONS.play} />
        </button>
        <button className="music-player-button" title="Next track" onClick={nextTrack}>
          <Icon path={ICONS.next} />
        </button>
        <button
          className={`music-player-button${music.muted ? ' music-player-muted' : ''}`}
          title={music.muted ? 'Unmute' : 'Mute'}
          onClick={toggleMusicMuted}
        >
          <Icon path={music.muted ? ICONS.muted : ICONS.sound} />
        </button>
      </div>
    </div>
  )
}

export default MusicPlayer
