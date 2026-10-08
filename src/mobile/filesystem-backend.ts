import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import type { SaveBackend } from './web-platform'

// The save files as real files in the app's private storage on the phone
// (Directory.Data), laid out like the desktop's save/ folder.

// '/save/players/ash/box.json' -> 'save/players/ash/box.json'
const relative = (path: string): string => path.replace(/^\/+/, '')

async function listFiles(dir: string): Promise<string[]> {
  let entries
  try {
    entries = (await Filesystem.readdir({ path: dir, directory: Directory.Data })).files
  } catch {
    return [] // No save folder yet - a first launch.
  }
  const found: string[] = []
  for (const entry of entries) {
    const path = `${dir}/${entry.name}`
    if (entry.type === 'directory') found.push(...(await listFiles(path)))
    else found.push(path)
  }
  return found
}

export function filesystemBackend(): SaveBackend {
  return {
    async loadAll() {
      const files: Record<string, string> = {}
      for (const path of await listFiles('save')) {
        const { data } = await Filesystem.readFile({ path, directory: Directory.Data, encoding: Encoding.UTF8 })
        files['/' + path] = typeof data === 'string' ? data : await data.text()
      }
      return files
    },
    async write(path, text) {
      await Filesystem.writeFile({
        path: relative(path),
        data: text,
        directory: Directory.Data,
        encoding: Encoding.UTF8,
        recursive: true
      })
    },
    async remove(path) {
      await Filesystem.deleteFile({ path: relative(path), directory: Directory.Data }).catch(() => {})
    }
  }
}
