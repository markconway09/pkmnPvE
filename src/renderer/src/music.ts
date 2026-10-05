// Background music, from one of three sources picked in Options:
// - Free To Use's lofi tracks (the default; freetouse.com - free for non-commercial use with
//   credit, which the player in the top bar gives by naming each track and its artist).
//   Streamed from their CDN, so there's no music offline. The playlist is a snapshot of
//   the category (scripts/build-music-list.mjs).
// - The player's own links: direct audio files or internet radio streams, one per line,
//   played in the order given. A radio stream has no end, so it just plays on.
// - A folder of the player's own music on their computer (served by the main process,
//   see src/main/music-folder.ts) - this one works offline.
// Free To Use and the folder play in a shuffled order, a fresh shuffle each time round.
// It keeps playing across every screen; the top bar's player only shows and controls it.
import freeToUseTracks from './musicTracks.json'
import { loadBool, loadNumber, loadString, savePref } from './soundPrefs'

export type MusicSource = 'freetouse' | 'links' | 'folder'

export const MUSIC_SOURCE_LABELS: Record<MusicSource, string> = {
  freetouse: 'Free To Use lofi',
  links: 'My links',
  folder: 'My folder'
}

export interface MusicTrack {
  url: string
  title: string
  artist: string
  // Its cover picture, when the source has one.
  cover: string | null
}

export interface MusicState {
  on: boolean
  volume: number
  playing: boolean
  // Silenced from the top bar's player - it keeps playing, just quietly.
  muted: boolean
  source: MusicSource
  // The "My links" text as saved, and the chosen folder.
  links: string
  folder: string
  // How many tracks the source has, and whether its folder is still being looked through.
  trackCount: number
  scanning: boolean
  track: MusicTrack | null
  // Seconds into the track, and its length (0 until known). A radio stream is "live" - no length.
  position: number
  duration: number
  live: boolean
}

const CDN = 'https://data.freetouse.com/music/tracks'
const ON_KEY = 'pkmnpve.musicOn'
const VOLUME_KEY = 'pkmnpve.musicVolume'
const MUTED_KEY = 'pkmnpve.musicMuted'
const SOURCE_KEY = 'pkmnpve.musicSource'
const LINKS_KEY = 'pkmnpve.musicLinks'
const FOLDER_KEY = 'pkmnpve.musicFolder'
// This many tracks failing in a row (no connection, a dead link) stops it until the next press of play.
const MAX_FAILS = 3
// The slider at 100% plays the tracks at a quarter of their own loudness.
const MAX_GAIN = 0.25
// "Previous" this far into a track starts it over instead.
const RESTART_AFTER_S = 3

const FREE_TO_USE: MusicTrack[] = (freeToUseTracks as { id: string; title: string; artist: string }[]).map((t) => ({
  url: `${CDN}/${t.id}/file/mp3`,
  title: t.title,
  artist: t.artist,
  cover: `${CDN}/${t.id}/cover/webp/sm`
}))

let on = loadBool(ON_KEY, true)
let volume = loadNumber(VOLUME_KEY, 0.05)
let muted = loadBool(MUTED_KEY, false)
let source = loadSource()
let links = loadString(LINKS_KEY, '')
let folder = loadString(FOLDER_KEY, '')
let playlist: MusicTrack[] = []
let scanning = false
// Counts playlist reloads, so a slow folder scan doesn't land after the source has changed.
let playlistVersion = 0
let order: number[] = []
let index = -1
let audio: HTMLAudioElement | null = null
let playing = false
let fails = 0
let waitingForGesture = false
const listeners = new Set<() => void>()
let state = snapshot()

function loadSource(): MusicSource {
  const stored = loadString(SOURCE_KEY, 'freetouse')
  return stored in MUSIC_SOURCE_LABELS ? (stored as MusicSource) : 'freetouse'
}

function current(): MusicTrack | null {
  return index >= 0 ? (playlist[order[index]] ?? null) : null
}

function snapshot(): MusicState {
  const live = !!audio && audio.duration === Infinity
  const length = audio && Number.isFinite(audio.duration) ? audio.duration : 0
  return {
    on,
    volume,
    playing,
    muted,
    source,
    links,
    folder,
    trackCount: playlist.length,
    scanning,
    track: current(),
    position: audio?.currentTime ?? 0,
    duration: length,
    live
  }
}

function emit(): void {
  state = snapshot()
  for (const listener of listeners) listener()
}

export function subscribeMusic(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function musicState(): MusicState {
  return state
}

/** The order to play the playlist in: as given for links, shuffled otherwise. */
function playOrder(): number[] {
  const list = playlist.map((_, i) => i)
  if (source === 'links') return list
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[list[i], list[j]] = [list[j], list[i]]
  }
  return list
}

/** "My links" as tracks: every http(s) line, named after its file (or its site, for a stream). */
function parseLinks(text: string): MusicTrack[] {
  const tracks: MusicTrack[] = []
  for (const line of text.split(/\r?\n/)) {
    let url: URL
    try {
      url = new URL(line.trim())
    } catch {
      continue
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') continue
    let file = url.pathname.split('/').filter(Boolean).pop() ?? ''
    try {
      file = decodeURIComponent(file)
    } catch {
      // a badly encoded name - shown as it is
    }
    tracks.push({
      url: url.href,
      title: file.replace(/\.[a-z0-9]{2,4}$/i, '') || url.hostname,
      artist: url.hostname,
      cover: null
    })
  }
  return tracks
}

function element(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio()
    audio.preload = 'metadata'
    audio.volume = volume * MAX_GAIN
    audio.muted = muted
    audio.addEventListener('ended', () => load(index + 1))
    audio.addEventListener('playing', () => {
      fails = 0
    })
    audio.addEventListener('error', () => {
      // Clearing the track (a new source with nothing in it) isn't a failure.
      if (!audio?.getAttribute('src')) return
      fails += 1
      if (fails >= MAX_FAILS) {
        playing = false
        emit()
        return
      }
      load(index + 1)
    })
    audio.addEventListener('timeupdate', emit)
    audio.addEventListener('durationchange', emit)
  }
  return audio
}

function start(): void {
  element()
    .play()
    .catch((err: unknown) => {
      // The window hasn't been clicked yet, so it may not play sound - the first press starts it.
      // (Anything else is a load cut short by the next track, or the error handler's job.)
      if (err instanceof DOMException && err.name === 'NotAllowedError' && !waitingForGesture) {
        waitingForGesture = true
        document.addEventListener(
          'pointerdown',
          () => {
            waitingForGesture = false
            if (playing) start()
          },
          { once: true, capture: true }
        )
      }
    })
}

/** Moves to a place in the play order (past the end starts over), playing it if the music is playing. */
function load(at: number): void {
  if (!playlist.length) return
  if (!order.length || at >= order.length) {
    order = playOrder()
    at = 0
  }
  index = at < 0 ? order.length - 1 : at
  const el = element()
  el.src = playlist[order[index]].url
  if (playing) start()
  emit()
}

/** Swaps in a new playlist, starting from its first track (playing it if the music was playing). */
function usePlaylist(tracks: MusicTrack[]): void {
  playlist = tracks
  order = []
  index = -1
  fails = 0
  if (audio) {
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
  }
  // Its first track is lined up even while paused, so the player has something to show.
  if (playlist.length) load(0)
  emit()
}

/** Builds the chosen source's playlist - the folder one has to ask the main process. */
function reloadPlaylist(): void {
  const version = ++playlistVersion
  scanning = false
  if (source === 'freetouse') usePlaylist(FREE_TO_USE)
  else if (source === 'links') usePlaylist(parseLinks(links))
  else if (!folder) usePlaylist([])
  else {
    scanning = true
    usePlaylist([])
    window.api
      .listMusicFolder(folder)
      .catch(() => [])
      .then((files) => {
        if (version !== playlistVersion) return
        scanning = false
        usePlaylist(files.map((f) => ({ url: f.url, title: f.title, artist: f.artist, cover: null })))
      })
  }
}

/** Called once at startup: loads the chosen source and begins the music if it's switched on. */
export function startMusic(): void {
  playing = on
  reloadPlaylist()
}

export function toggleMusicPlaying(): void {
  fails = 0
  playing = !playing
  if (index < 0) load(0)
  else if (playing) start()
  else audio?.pause()
  emit()
}

export function nextTrack(): void {
  fails = 0
  load(index + 1)
}

export function previousTrack(): void {
  fails = 0
  if (audio && Number.isFinite(audio.duration) && audio.currentTime > RESTART_AFTER_S) audio.currentTime = 0
  else load(index - 1)
}

/** Jumps to a point in the track, 0 (start) to 1 (end). */
export function seekMusic(fraction: number): void {
  if (audio && Number.isFinite(audio.duration)) audio.currentTime = fraction * audio.duration
}

export function setMusicOn(next: boolean): void {
  on = next
  savePref(ON_KEY, on)
  if (on) {
    playing = true
    fails = 0
    if (index < 0) load(0)
    else start()
  } else {
    playing = false
    audio?.pause()
  }
  emit()
}

export function toggleMusicMuted(): void {
  muted = !muted
  if (audio) audio.muted = muted
  savePref(MUTED_KEY, muted)
  emit()
}

export function setMusicVolume(next: number): void {
  volume = Math.min(1, Math.max(0, next))
  if (audio) audio.volume = volume * MAX_GAIN
  savePref(VOLUME_KEY, volume)
  emit()
}

export function setMusicSource(next: MusicSource): void {
  if (next === source) return
  source = next
  savePref(SOURCE_KEY, source)
  reloadPlaylist()
}

/** Saves the "My links" list (one URL per line) and, if it's the source, plays from it. */
export function setMusicLinks(text: string): void {
  links = text
  savePref(LINKS_KEY, links)
  if (source === 'links') reloadPlaylist()
  else emit()
}

/** Opens the folder picker; a folder chosen becomes "My folder" (and is looked through again). */
export async function chooseMusicFolder(): Promise<void> {
  const picked = await window.api.pickMusicFolder()
  if (!picked) return
  folder = picked
  savePref(FOLDER_KEY, folder)
  if (source === 'folder') reloadPlaylist()
  else emit()
}

/** Looks through "My folder" again, for music added since. */
export function rescanMusicFolder(): void {
  if (source === 'folder') reloadPlaylist()
}
