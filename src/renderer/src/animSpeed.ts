// How fast move animations play in battle - picked in Options, kept per computer in
// localStorage like the sound settings. Off skips them entirely.

import { loadString, savePref } from './soundPrefs'

export type AnimSpeed = 'normal' | 'fast' | 'off'

export const ANIM_SPEEDS: AnimSpeed[] = ['normal', 'fast', 'off']

export const ANIM_SPEED_LABELS: Record<AnimSpeed, string> = {
  normal: 'Normal',
  fast: 'Fast',
  off: 'Off'
}

const KEY = 'pkmnpve.animSpeed'
// Fast plays every part of an animation in this share of its normal time.
const FAST_FACTOR = 0.55

let speed: AnimSpeed = parse(loadString(KEY, 'normal'))

function parse(value: string): AnimSpeed {
  return (ANIM_SPEEDS as string[]).includes(value) ? (value as AnimSpeed) : 'normal'
}

export function animSpeed(): AnimSpeed {
  return speed
}

export function setAnimSpeed(next: AnimSpeed): void {
  speed = next
  savePref(KEY, next)
}

/** What every animation time is multiplied by right now. */
export function animTimeFactor(): number {
  return speed === 'fast' ? FAST_FACTOR : 1
}
