// Randomness through Web Crypto, which both Node and the mobile WebView have,
// so the game rolls (slots, dice, roulette...) stay cryptographically fair on
// every platform without importing node:crypto.

/** A whole number from 0 up to (not including) max, with no modulo bias. */
export function randomInt(max: number): number {
  if (!Number.isSafeInteger(max) || max <= 0 || max > 0x100000000) throw new RangeError(`randomInt: bad max ${max}`)
  // Rejects the top slice of the 32-bit range that would favour low numbers.
  const limit = 0x100000000 - (0x100000000 % max)
  const buf = new Uint32Array(1)
  for (;;) {
    globalThis.crypto.getRandomValues(buf)
    if (buf[0] < limit) return buf[0] % max
  }
}

export function randomUUID(): string {
  return globalThis.crypto.randomUUID()
}
