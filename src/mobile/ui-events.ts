// Push messages from the game to the screens (a new achievement, the online
// battle's next turn...), all inside the one page on mobile.

const listeners = new Map<string, Set<(payload: unknown) => void>>()

/** Sends a push message to whatever on the page is listening - a copy, as IPC would. */
export function emitLocal(channel: string, payload: unknown): void {
  for (const listener of listeners.get(channel) ?? []) listener(structuredClone(payload))
}

/** Listens for a push message; returns a function to stop listening. */
export function onLocal(channel: string, listener: (payload: unknown) => void): () => void {
  const set = listeners.get(channel) ?? new Set()
  listeners.set(channel, set)
  set.add(listener)
  return () => set.delete(listener)
}
