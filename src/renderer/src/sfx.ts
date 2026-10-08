// The menus' little sounds: files from Kenney's Interface Sounds pack (CC0) in public/sfx/ -
// a made-up Web Audio stand-in plays until a file has loaded (or if it's missing). Every button clicks; a button (or anything around it) can pick another
// sound with data-sfx="tab" / "buy" / "close"..., or stay quiet with data-sfx="none".
// Windows (.modal-overlay) make a sound of their own as they open and close.

import { loadBool, loadNumber, savePref } from './soundPrefs'

export type SfxName = 'click' | 'tab' | 'open' | 'close' | 'buy' | 'error'

const SFX_NAMES: SfxName[] = ['click', 'tab', 'open', 'close', 'buy', 'error']

// What plays for each: a file as "pack/name", or '' for silence.
const choices: Record<SfxName, string> = {
  click: 'interface/click_003',
  tab: 'interface/bong_001',
  open: '',
  close: '',
  buy: 'interface/drop_001',
  error: 'interface/glitch_001'
}

const VOLUME_KEY = 'pkmnpve.sfxVolume'
const ON_KEY = 'pkmnpve.sfxOn'
// The same sound again this soon is dropped, so a burst of clicks doesn't machine-gun.
const REPEAT_GAP_MS = 40
// How loud the files play - they come at full volume, and menu sounds should be subtle.
const FILE_GAIN = 0.35

let volume = loadNumber(VOLUME_KEY, 0.25)
let on = loadBool(ON_KEY, true)
let audio: AudioContext | null = null
let master: GainNode | null = null
const lastPlayed: Partial<Record<SfxName, number>> = {}
// Each file once loaded (or loading), by "pack/name".
const buffers = new Map<string, AudioBuffer>()
const loading = new Set<string>()

/** How loud the menu sounds play, 0 (silent or switched off) to 1 - the Game Corner's ticks follow it too. */
export function sfxVolume(): number {
  return on ? volume : 0
}

/** The volume slider's setting, kept while the sounds are switched off. */
export function sfxLevel(): number {
  return volume
}

export function setSfxVolume(next: number): void {
  volume = Math.min(1, Math.max(0, next))
  if (master) master.gain.value = sfxVolume()
  savePref(VOLUME_KEY, volume)
}

export function sfxOn(): boolean {
  return on
}

export function setSfxOn(next: boolean): void {
  on = next
  if (master) master.gain.value = sfxVolume()
  savePref(ON_KEY, on)
}

function loadFile(ctx: AudioContext, file: string): Promise<AudioBuffer | null> {
  const ready = buffers.get(file)
  if (ready) return Promise.resolve(ready)
  if (loading.has(file)) return Promise.resolve(null)
  loading.add(file)
  return fetch(`./sfx/${file}.ogg`)
    .then((res) => res.arrayBuffer())
    .then((data) => ctx.decodeAudioData(data))
    .then((buffer) => {
      buffers.set(file, buffer)
      return buffer
    })
    .catch(() => null)
    .finally(() => loading.delete(file))
}

function output(): { audio: AudioContext; master: GainNode } | null {
  if (!audio) {
    try {
      audio = new AudioContext()
      master = audio.createGain()
      master.gain.value = sfxVolume()
      master.connect(audio.destination)
      for (const name of SFX_NAMES) if (choices[name]) void loadFile(audio, choices[name])
    } catch {
      return null
    }
  }
  if (audio.state === 'suspended') void audio.resume()
  return master ? { audio, master } : null
}

function playBuffer(out: { audio: AudioContext; master: GainNode }, buffer: AudioBuffer, rate: number): void {
  const source = out.audio.createBufferSource()
  const gain = out.audio.createGain()
  source.buffer = buffer
  source.playbackRate.value = rate
  gain.gain.value = FILE_GAIN
  source.connect(gain).connect(out.master)
  source.start()
}

/** One short note sliding from one pitch to another, fading out fast. */
function tone(
  out: { audio: AudioContext; master: GainNode },
  from: number,
  to: number,
  seconds: number,
  gainAmount: number,
  type: OscillatorType = 'sine',
  delay = 0
): void {
  const { audio: ctx } = out
  const start = ctx.currentTime + delay
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(from, start)
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, start + seconds)
  // A few milliseconds of fade-in, or the note starts with a click of its own.
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(gainAmount, start + 0.004)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds)
  osc.connect(gain).connect(out.master)
  osc.start(start)
  osc.stop(start + seconds + 0.02)
}

export function playSfx(name: SfxName): void {
  if (sfxVolume() <= 0 || !choices[name]) return
  const now = performance.now()
  if (now - (lastPlayed[name] ?? -Infinity) < REPEAT_GAP_MS) return
  lastPlayed[name] = now
  const out = output()
  if (!out) return
  // A touch of pitch wobble so the same click over and over doesn't sound robotic.
  const p = 1 + (Math.random() - 0.5) * 0.06
  const buffer = buffers.get(choices[name])
  if (buffer) {
    playBuffer(out, buffer, p)
    return
  }
  switch (name) {
    case 'click':
      tone(out, 900 * p, 520 * p, 0.05, 0.05)
      break
    case 'tab':
      tone(out, 660 * p, 660 * p, 0.045, 0.035)
      tone(out, 880 * p, 880 * p, 0.05, 0.035, 'sine', 0.04)
      break
    case 'open':
      tone(out, 420 * p, 760 * p, 0.09, 0.04, 'triangle')
      break
    case 'close':
      tone(out, 700 * p, 380 * p, 0.08, 0.035, 'triangle')
      break
    case 'buy':
      tone(out, 1320 * p, 1320 * p, 0.06, 0.035)
      tone(out, 1980 * p, 1980 * p, 0.09, 0.035, 'sine', 0.05)
      break
    case 'error':
      tone(out, 170, 130, 0.07, 0.06, 'triangle')
      tone(out, 150, 115, 0.08, 0.06, 'triangle', 0.08)
      break
  }
}

let installed = false

/** Wires the sounds into the whole page - called once at startup. */
export function installMenuSounds(): void {
  if (installed) return
  installed = true
  // Load the sound files now, so even the first click plays its own.
  output()

  // A plain click waits a frame: a click that opens or closes a window plays that
  // window's sound instead of both.
  let pendingClick = 0

  document.addEventListener(
    'click',
    (e) => {
      const target = e.target instanceof Element ? e.target : null
      const button = target?.closest('button, [role="button"], [data-sfx]')
      if (!button || (button as HTMLButtonElement).disabled) return
      const picked = (button.closest('[data-sfx]') as HTMLElement | null)?.dataset.sfx
      if (picked === 'none') return
      const name = SFX_NAMES.includes(picked as SfxName) ? (picked as SfxName) : 'click'
      if (name !== 'click') {
        playSfx(name)
        return
      }
      cancelAnimationFrame(pendingClick)
      pendingClick = requestAnimationFrame(() => playSfx('click'))
    },
    true
  )

  const windowSound = (nodes: NodeList, name: SfxName): boolean => {
    for (const node of nodes) {
      if (node instanceof Element && node.matches('.modal-overlay') && !node.closest('[data-sfx="none"]')) {
        cancelAnimationFrame(pendingClick)
        playSfx(name)
        return true
      }
    }
    return false
  }
  new MutationObserver((records) => {
    for (const record of records) {
      if (windowSound(record.addedNodes, 'open') || windowSound(record.removedNodes, 'close')) return
    }
  }).observe(document.body, { childList: true, subtree: true })
}
