import { Peer, type DataConnection } from 'peerjs'
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '../../shared/online'

// Sending a save straight to another device by a room code (Options → Saves). The sending
// copy opens a room and shows its code (and a QR code on the PC); the receiving copy joins
// with it, gets the save file over the connection (WebRTC - the free public PeerJS server
// only introduces them, like online battles), shows what's in it, and replaces its own save
// only once the player says so. The save is the same .pkmnsave file the Save file buttons
// make, so the import backs the old save up first in the same way.

// Put in front of the code to make the PeerJS id - apart from online battle rooms.
const TRANSFER_ID_PREFIX = 'pkmnpve-save-'
// What the PC's QR code holds, ahead of the room code.
export const QR_PREFIX = 'PKMNPVE:'
// How long joining may take before it's given up on (a connection that can't get through).
const CONNECT_TIMEOUT_MS = 20_000

type TransferMessage =
  | { type: 'save'; data: ArrayBuffer | Uint8Array }
  | { type: 'accepted' }
  | { type: 'declined' }
  | { type: 'busy' }

/** What a received save holds, for the player to check before it replaces theirs. */
export interface SavePreview {
  name: string | null
  pokemon: number | null
  money: number | null
  appVersion: string | null
  exportedAt: string | null
}

export type SendPhase = 'opening' | 'waiting' | 'connected' | 'sent'
export type ReceivePhase = 'connecting' | 'preview' | 'importing'

function randomCode(): string {
  let code = ''
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)]
  return code
}

/** A typed or scanned code, tidied up - or null when it isn't one. */
export function cleanCode(raw: string): string | null {
  const code = raw.trim().toUpperCase().replace(QR_PREFIX, '').replace(/[\s-]/g, '')
  return code.length === ROOM_CODE_LENGTH && [...code].every((c) => ROOM_CODE_ALPHABET.includes(c)) ? code : null
}

// Turns PeerJS's errors into something a player can act on.
function peerErrorText(type: string, fallback: string): string {
  if (type === 'peer-unavailable') return 'No device is sending with that code - check it and try again'
  if (type === 'network' || type === 'server-error' || type === 'socket-error' || type === 'socket-closed') {
    return "Couldn't reach the connection server - check your internet connection"
  }
  if (type === 'browser-incompatible') return "Sending saves isn't supported here"
  return fallback
}

function bytesOf(data: ArrayBuffer | Uint8Array): Uint8Array {
  return data instanceof Uint8Array ? data : new Uint8Array(data)
}

/** A peek inside a .pkmnsave file (a gzipped JSON bundle of the save folder's files). */
export async function previewSave(data: Uint8Array): Promise<SavePreview> {
  const out = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'))
  const bundle = JSON.parse(await new Response(out).text()) as {
    format?: string
    appVersion?: string
    exportedAt?: string
    files?: Record<string, string>
  }
  if (bundle.format !== 'pkmnpve-save' || !bundle.files?.['box.json']) throw new Error("That isn't a pkmnPvE save")
  const json = (name: string): Record<string, unknown> | null => {
    try {
      const binary = atob(bundle.files![name])
      const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
      return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>
    } catch {
      return null
    }
  }
  const box = json('box.json')
  const money = json('money.json')
  const profile = json('profile.json')
  return {
    name: typeof profile?.displayName === 'string' ? profile.displayName : null,
    pokemon: Array.isArray(box?.mons) ? box.mons.length : null,
    money: typeof money?.amount === 'number' ? money.amount : null,
    appVersion: bundle.appVersion ?? null,
    exportedAt: bundle.exportedAt ?? null
  }
}

/** -1, 0 or 1 as version a is older than, the same as or newer than b ("0.5.0"). */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0)
    if (diff) return diff > 0 ? 1 : -1
  }
  return 0
}

export interface SendHandlers {
  onPhase: (phase: SendPhase, code: string) => void
  onError: (message: string) => void
}

/**
 * Opens a room and sends this player's save to whoever joins with its code. The room
 * stays open until the save is accepted (a declined one can be fetched again). Returns a
 * function that closes it.
 */
export function startSending(handlers: SendHandlers): () => void {
  let peer: Peer | null = null
  let conn: DataConnection | null = null
  let closed = false
  let sent = false
  let code = ''

  function close(): void {
    closed = true
    conn?.close()
    peer?.destroy()
  }

  function open(triesLeft: number): void {
    code = randomCode()
    const room = new Peer(TRANSFER_ID_PREFIX + code)
    peer = room
    room.on('open', () => {
      if (!closed) handlers.onPhase('waiting', code)
    })
    room.on('error', (error) => {
      if (closed || peer !== room) return
      // Someone else already has this code: pick another.
      if (error.type === 'unavailable-id' && triesLeft > 1) {
        room.destroy()
        open(triesLeft - 1)
        return
      }
      // A receiver whose connection failed doesn't close the room.
      if (error.type === 'webrtc') return
      close()
      handlers.onError(peerErrorText(error.type, error.message))
    })
    room.on('connection', (incoming) => {
      // One receiver at a time.
      if (conn) {
        incoming.on('open', () => {
          void incoming.send({ type: 'busy' } satisfies TransferMessage)
          setTimeout(() => incoming.close(), 500)
        })
        return
      }
      conn = incoming
      incoming.on('open', async () => {
        if (closed) return
        handlers.onPhase('connected', code)
        try {
          // The save as it is right now.
          const { data } = await window.api.exportSaveFile()
          void incoming.send({ type: 'save', data: data.slice().buffer } satisfies TransferMessage)
        } catch (e) {
          handlers.onError(e instanceof Error ? e.message : String(e))
        }
      })
      incoming.on('data', (raw) => {
        const message = raw as TransferMessage
        if (message?.type === 'accepted') {
          sent = true
          handlers.onPhase('sent', code)
          setTimeout(close, 1000)
        } else if (message?.type === 'declined') {
          incoming.close()
        }
      })
      const gone = (): void => {
        if (conn !== incoming) return
        conn = null
        if (!closed && !sent) handlers.onPhase('waiting', code)
      }
      incoming.on('close', gone)
      incoming.on('error', gone)
    })
  }

  handlers.onPhase('opening', '')
  open(3)
  return close
}

export interface ReceiveHandlers {
  onPreview: (preview: SavePreview, data: Uint8Array) => void
  onError: (message: string) => void
}

export interface Receiver {
  /** Tells the sender the save was taken, so it can close its room. */
  accept: () => void
  /** Turns the save down (the sender's room stays open). */
  decline: () => void
  close: () => void
}

/** Joins a sending device's room by its code and waits for the save. */
export function startReceiving(code: string, handlers: ReceiveHandlers): Receiver {
  let closed = false
  let conn: DataConnection | null = null
  const peer = new Peer()

  function close(): void {
    closed = true
    clearTimeout(timer)
    conn?.close()
    peer.destroy()
  }

  function fail(message: string): void {
    if (closed) return
    close()
    handlers.onError(message)
  }

  const timer = setTimeout(() => fail("Couldn't connect to the other device - check the code, or try again"), CONNECT_TIMEOUT_MS)
  peer.on('open', () => {
    if (closed) return
    const connection = peer.connect(TRANSFER_ID_PREFIX + code, { reliable: true })
    conn = connection
    connection.on('data', async (raw) => {
      const message = raw as TransferMessage
      if (message?.type === 'busy') {
        fail('That device is already sending to someone else')
        return
      }
      if (message?.type !== 'save') return
      clearTimeout(timer)
      const data = bytesOf(message.data)
      try {
        handlers.onPreview(await previewSave(data), data)
      } catch (e) {
        fail(e instanceof Error ? e.message : String(e))
      }
    })
    connection.on('close', () => fail('The other device closed the connection'))
    connection.on('error', () => fail('Lost the connection to the other device'))
  })
  peer.on('error', (error) => fail(peerErrorText(error.type, error.message)))

  return {
    accept: () => {
      // Done listening: the sender closing its room now isn't a lost connection.
      closed = true
      if (conn?.open) void conn.send({ type: 'accepted' } satisfies TransferMessage)
    },
    decline: () => {
      closed = true
      if (conn?.open) void conn.send({ type: 'declined' } satisfies TransferMessage)
      setTimeout(close, 300)
    },
    close
  }
}
