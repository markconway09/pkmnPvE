/**
 * Minimal stand-in for Showdown client's `battle-dex.ts`.
 *
 * `battle-text-parser.ts` (vendored from the pokemon-showdown-client repo,
 * itself MIT-licensed despite the rest of that client being AGPL) only
 * touches a handful of members of the real client Dex: the current
 * generation number, a no-op text-data loader (we load the text data
 * ourselves, see battle-text-data.ts), and English-only passthroughs for
 * name lookups. This shim provides just that surface without pulling in
 * the full ~1500-line browser-oriented client Dex.
 */

export type ID = string

export function toID(text: unknown): ID {
  if (typeof text !== 'string') return ''
  return text.toLowerCase().replace(/[^a-z0-9]/g, '') as ID
}

export const Dex = {
  gen: 9,
  text: {
    getLanguage: (): string => 'en',
    get: (effect: { name?: string } | null | undefined, _language?: string): { name: string } => ({
      name: effect?.name ?? ''
    })
  },
  species: {
    get: (name: string): { name: string } => ({ name })
  },
  loadTextData: (_language?: string): void => {}
}
