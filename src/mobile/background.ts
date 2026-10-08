import { gameHandlers } from '../main/game-api'
import { joinPath, readText, removeFile, writeText } from '../main/platform'
import { getCurrentPlayerSlug, playerDirFor } from '../main/showdown/save-paths'

// Options → Background on the phone: a picture from the gallery behind every screen.
// The screens shrink it and hand it over as a data: URL, which is kept as text in the
// player's own save folder (background.txt) - the phone's saves are all text. The PC
// does the same with a file picker and the picture file itself (background-store.ts).

const FILE = 'background.txt'

function backgroundPath(): string {
  const slug = getCurrentPlayerSlug()
  if (!slug) throw new Error('Not logged in')
  return joinPath(playerDirFor(slug), FILE)
}

export function installBackgroundHandlers(): void {
  gameHandlers.set('background:get', () => {
    try {
      return readText(backgroundPath())
    } catch {
      return null
    }
  })
  gameHandlers.set('background:set', (_caller, dataUrl: string) => {
    if (typeof dataUrl !== 'string' || !/^data:image\/(png|jpeg|webp);base64,/.test(dataUrl)) {
      throw new Error("That picture couldn't be used")
    }
    writeText(backgroundPath(), dataUrl)
    return dataUrl
  })
  gameHandlers.set('background:clear', () => removeFile(backgroundPath()))
}
