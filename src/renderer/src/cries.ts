// A Pokemon's cry as it's sent out, streamed from Showdown's CDN (not shipped with the
// game). Forms with a cry of their own (Megas, Therian, Crowned...) use it; any other
// form falls back to its normal form's cry. Has its own volume in Options.
import { showdownName } from './spriteStyle'
import { loadBool, loadNumber, savePref } from './soundPrefs'

const CRY_CDN = 'https://play.pokemonshowdown.com/audio/cries'
const VOLUME_KEY = 'pkmnpve.cryVolume'
const ON_KEY = 'pkmnpve.cryOn'
// The slider at 100% plays cries at a quarter of their own loudness.
const MAX_GAIN = 0.25
// Names Showdown has no cry for, so they go straight to the fallback next time.
const missing = new Set<string>()
let volume = loadNumber(VOLUME_KEY, 0.05)
let on = loadBool(ON_KEY, true)

/** The cry volume slider's setting, 0 (muted) to 1 - kept while cries are switched off. */
export function cryVolume(): number {
  return volume
}

export function setCryVolume(next: number): void {
  volume = Math.min(1, Math.max(0, next))
  savePref(VOLUME_KEY, volume)
}

export function cryOn(): boolean {
  return on
}

export function setCryOn(next: boolean): void {
  on = next
  savePref(ON_KEY, on)
}

function tryPlay(names: string[]): void {
  const name = names.find((n) => !missing.has(n))
  if (!name) return
  const audio = new Audio(`${CRY_CDN}/${name}.mp3`)
  audio.volume = volume * MAX_GAIN
  audio.onerror = () => {
    missing.add(name)
    tryPlay(names.slice(names.indexOf(name) + 1))
  }
  // Blocked autoplay or no connection - the battle just stays quiet.
  audio.play().catch(() => {})
}

export function playCry(spriteId: string): void {
  if (!spriteId || !on || volume <= 0) return
  const full = showdownName(spriteId)
  const base = full.split('-')[0]
  tryPlay(base !== full ? [full, base] : [full])
}
