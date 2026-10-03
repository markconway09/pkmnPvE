// The sound settings (each kind's volume and on/off switch, the music's source), kept per
// computer in localStorage - a convenience, so anything unreadable falls back to the default.

export function loadNumber(key: string, fallback: number): number {
  try {
    const stored = localStorage.getItem(key)
    if (stored !== null) {
      const v = Number(stored)
      if (Number.isFinite(v)) return Math.min(1, Math.max(0, v))
    }
  } catch {
    // localStorage unavailable - fall through to default
  }
  return fallback
}

export function loadBool(key: string, fallback: boolean): boolean {
  try {
    const stored = localStorage.getItem(key)
    if (stored === 'true' || stored === 'false') return stored === 'true'
  } catch {
    // localStorage unavailable - fall through to default
  }
  return fallback
}

export function loadString(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback // localStorage unavailable
  }
}

export function savePref(key: string, value: number | boolean | string): void {
  try {
    localStorage.setItem(key, String(value))
  } catch {
    // ignore - per-viewer convenience only
  }
}
