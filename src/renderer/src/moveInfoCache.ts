import type { MoveInfo } from '../../shared/battle-types'

const cache = new Map<string, Promise<MoveInfo | null>>()

export function fetchMoveInfo(id: string): Promise<MoveInfo | null> {
  let pending = cache.get(id)
  if (!pending) {
    pending = window.api.getMoveInfo(id)
    cache.set(id, pending)
  }
  return pending
}
