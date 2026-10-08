import type { SaveBackend } from './web-platform'

// The save files in the WebView's IndexedDB, one record per file, keyed by path.
// Used when the mobile page runs in an ordinary browser (npm run dev:mobile); the
// app itself keeps them as real files (filesystem-backend.ts).

const DB_NAME = 'pkmnpve'
const STORE = 'files'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export function indexedDbBackend(): SaveBackend {
  const db = openDb()
  return {
    async loadAll() {
      const store = (await db).transaction(STORE, 'readonly').objectStore(STORE)
      const [keys, values] = await Promise.all([
        new Promise<IDBValidKey[]>((resolve, reject) => {
          const r = store.getAllKeys()
          r.onsuccess = () => resolve(r.result)
          r.onerror = () => reject(r.error)
        }),
        new Promise<string[]>((resolve, reject) => {
          const r = store.getAll()
          r.onsuccess = () => resolve(r.result as string[])
          r.onerror = () => reject(r.error)
        })
      ])
      return Object.fromEntries(keys.map((key, i) => [String(key), values[i]]))
    },
    async write(path, text) {
      const tx = (await db).transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(text, path)
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
    },
    async remove(path) {
      const tx = (await db).transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(path)
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
    }
  }
}
