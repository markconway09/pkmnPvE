// Little sounds made on the spot with the Web Audio API - no sound files needed.
// Both follow the volume set in Options (sfx.ts).
import { sfxVolume } from './sfx'

/** A short click: a card or a reel symbol passing its marker. */
export function playTick(audio: AudioContext, frequency = 1400, volume = 0.04): void {
  volume *= sfxVolume()
  if (volume <= 0) return
  const osc = audio.createOscillator()
  const gain = audio.createGain()
  osc.type = 'square'
  osc.frequency.value = frequency
  gain.gain.setValueAtTime(volume, audio.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.04)
  osc.connect(gain).connect(audio.destination)
  osc.start()
  osc.stop(audio.currentTime + 0.05)
}

/** A low thud: a slot reel landing. */
export function playClunk(audio: AudioContext): void {
  const volume = 0.12 * sfxVolume()
  if (volume <= 0) return
  const osc = audio.createOscillator()
  const gain = audio.createGain()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(220, audio.currentTime)
  osc.frequency.exponentialRampToValueAtTime(90, audio.currentTime + 0.12)
  gain.gain.setValueAtTime(volume, audio.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.14)
  osc.connect(gain).connect(audio.destination)
  osc.start()
  osc.stop(audio.currentTime + 0.15)
}
