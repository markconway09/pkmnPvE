import type { ApiTransport } from '../shared/api'
import { gameHandlers, scheduleAchievementCheck, type GameCaller } from '../main/game-api'
import { emitLocal, onLocal } from './ui-events'

// The mobile transport: window.api calls the game's handlers right here in the
// page. Arguments and results are copied on the way through, just as IPC copies
// them, so the screens can never change the game's state behind its back.

// The page is the only caller there is, and it never goes away.
const caller: GameCaller = { sender: { send: emitLocal, isDestroyed: () => false } }

export const directTransport: ApiTransport = {
  async invoke(channel, ...args) {
    const handler = gameHandlers.get(channel)
    if (!handler) throw new Error("That isn't available on this device")
    try {
      return structuredClone(await handler(caller, ...structuredClone(args)))
    } finally {
      scheduleAchievementCheck()
    }
  },
  on: (channel, listener) => onLocal(channel, listener as (payload: unknown) => void)
}
