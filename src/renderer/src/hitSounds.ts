// The games' own hit sounds (Ruby / Sapphire / Emerald) in public/sfx/hits/: one for a
// neutral hit, one for a super-effective hit and one for a resisted hit. A horde lands
// many hits a second, so only one plays at a time - the strongest landed in that moment.
// They follow the menu sounds' volume. Horde and the normal battles each have their own
// switch (the battles' in Options, Horde's in its pause menu).

import { sfxVolume } from './sfx'
import { loadBool, savePref } from './soundPrefs'

export type HitSound = 'normal' | 'super' | 'weak'
// Where a hit is landing: in Horde, or in a normal battle (trainer, wild, draft, Battle Tower...).
export type HitPlace = 'horde' | 'battle'

const HIT_SOUNDS: HitSound[] = ['normal', 'super', 'weak']
const ON_KEYS: Record<HitPlace, string> = { horde: 'horde.hitSounds', battle: 'pkmnpve.battleHitSounds' }
// No new hit sound starts sooner than this after the last one.
const GAP_MS = 500
// Which wins when several land together: a super-effective hit, then a neutral one, then a resisted one.
const RANK: Record<HitSound, number> = { super: 3, normal: 2, weak: 1 }
// How loud the files play against the menu sounds' volume - they come at full volume.
const FILE_GAIN = 0.06
// In Horde each hit plays a little higher or lower than the last, up to this much either way
// (as a share of its normal pitch), so a stream of them doesn't sound like one sound on repeat.
const HORDE_PITCH_SPREAD = 0.12

const on: Record<HitPlace, boolean> = {
  horde: loadBool(ON_KEYS.horde, true),
  battle: loadBool(ON_KEYS.battle, true)
}
let audio: AudioContext | null = null
const buffers = new Map<HitSound, AudioBuffer>()
let lastAt = 0
// A hit waiting for the gap to pass, and the timer that plays it.
let queued: { name: HitSound; place: HitPlace } | null = null
let timer: ReturnType<typeof setTimeout> | null = null

export function hitSoundsOn(place: HitPlace): boolean {
  return on[place]
}

export function setHitSoundsOn(place: HitPlace, next: boolean): void {
  on[place] = next
  savePref(ON_KEYS[place], next)
}

function context(): AudioContext | null {
  if (!audio) {
    try {
      audio = new AudioContext()
      const ctx = audio
      for (const name of HIT_SOUNDS)
        void fetch(`./sfx/hits/${name}.mp3`)
          .then((res) => res.arrayBuffer())
          .then((data) => ctx.decodeAudioData(data))
          .then((buffer) => buffers.set(name, buffer))
          .catch(() => undefined)
    } catch {
      return null
    }
  }
  if (audio.state === 'suspended') void audio.resume()
  return audio
}

function play(name: HitSound, place: HitPlace): void {
  const ctx = context()
  const buffer = buffers.get(name)
  const volume = sfxVolume()
  lastAt = performance.now()
  if (!ctx || !buffer || volume <= 0) return
  const source = ctx.createBufferSource()
  const gain = ctx.createGain()
  source.buffer = buffer
  if (place === 'horde') source.playbackRate.value = 1 + (Math.random() * 2 - 1) * HORDE_PITCH_SPREAD
  gain.gain.value = volume * FILE_GAIN
  source.connect(gain).connect(ctx.destination)
  source.start()
}

/** Loads and decodes the files ahead of the first hit, so it doesn't stall the frame. */
export function preloadHitSounds(): void {
  if (!audio) context()
}

/** A hit landing with this type matchup (above 1 super effective, below 1 resisted). */
export function playHit(effectiveness: number, place: HitPlace): void {
  if (!on[place]) return
  const name: HitSound = effectiveness > 1 ? 'super' : effectiveness < 1 ? 'weak' : 'normal'
  // Starts loading the files on the first hit.
  if (!audio) context()
  const wait = lastAt + GAP_MS - performance.now()
  if (wait <= 0 && !timer) {
    play(name, place)
    return
  }
  if (!queued || RANK[name] > RANK[queued.name]) queued = { name, place }
  timer ??= setTimeout(
    () => {
      timer = null
      const next = queued
      queued = null
      if (next) play(next.name, next.place)
    },
    Math.max(0, wait)
  )
}
