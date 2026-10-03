// Builds src/renderer/src/musicTracks.json: the background music playlist, Free To
// Use's lofi category (https://freetouse.com/music/category/lofi). Only the free tracks
// are kept - the premium ones need a paid licence. The game streams each track from
// their CDN by id, so only the id, title, artist and length are stored.
//
// Their API doesn't allow requests from the game's window, so the list is fetched here
// once and shipped. Re-run to pick up new tracks:  node scripts/build-music-list.mjs
import { writeFileSync } from 'node:fs'

const API = 'https://api.freetouse.com/v3'

async function get(path) {
  const res = await fetch(API + path, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`${path}: ${res.status}`)
  const body = await res.json()
  if (!body.ok) throw new Error(`${path}: ${JSON.stringify(body)}`)
  return body.data
}

const category = await get('/music/categories/lofi')
const tracks = (await get(`/music/categories/${category.id}/tracks`))
  .filter((t) => !t.is_premium && t.status === 1)
  .map((t) => ({
    id: t.id,
    title: t.title,
    artist: t.artists.map(([, a]) => a.name).join(' & '),
    duration: Math.round(t.duration)
  }))
  .sort((a, b) => a.title.localeCompare(b.title))

writeFileSync(
  new URL('../src/renderer/src/musicTracks.json', import.meta.url),
  JSON.stringify(tracks, null, 2) + '\n'
)
console.log(`${tracks.length} tracks`)
