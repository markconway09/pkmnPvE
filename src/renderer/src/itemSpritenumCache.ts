let cache: Promise<Map<string, number>> | null = null

function load(): Promise<Map<string, number>> {
  if (!cache) {
    cache = window.api.getEditorOptions().then((opts) => {
      const map = new Map<string, number>()
      for (const item of opts.items) map.set(item.name, item.spritenum)
      return map
    })
  }
  return cache
}

export function fetchItemSpritenum(itemName: string): Promise<number | null> {
  return load().then((map) => map.get(itemName) ?? null)
}
