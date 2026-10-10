import { useEffect, useMemo, useRef, useState } from 'react'
import qrcode from 'qrcode-generator'
import { ROOM_CODE_LENGTH } from '../../shared/online'
import { deviceHooks } from './deviceHooks'
import { formatMoney } from './money'
import { IS_MOBILE } from './platform'
import {
  QR_PREFIX,
  cleanCode,
  compareVersions,
  startReceiving,
  startSending,
  type Receiver,
  type ReceivePhase,
  type SavePreview,
  type SendPhase
} from './saveTransfer'

// The phone's camera reads QR codes through the browser's own barcode reader, where
// there is one (Android's has it).
interface BarcodeReader {
  detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>
}
type BarcodeReaderClass = new (options: { formats: string[] }) => BarcodeReader
const BarcodeDetectorClass = (window as unknown as { BarcodeDetector?: BarcodeReaderClass }).BarcodeDetector
const CAN_SCAN = IS_MOBILE && !!BarcodeDetectorClass && !!navigator.mediaDevices?.getUserMedia

function errorText(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e)
  // Drop Electron's "Error invoking remote method ..." wrapper.
  return message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}

/** A QR code as squares in an SVG - dark on a white card, so phones read it in any theme. */
function QrCode({ text }: { text: string }): React.JSX.Element {
  const cells = useMemo(() => {
    const qr = qrcode(0, 'M')
    qr.addData(text, 'Alphanumeric')
    qr.make()
    const count = qr.getModuleCount()
    let path = ''
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) if (qr.isDark(row, col)) path += `M${col} ${row}h1v1h-1z`
    }
    return { count, path }
  }, [text])
  const margin = 2
  const size = cells.count + margin * 2
  return (
    <svg className="save-transfer-qr" viewBox={`${-margin} ${-margin} ${size} ${size}`} shapeRendering="crispEdges">
      <rect x={-margin} y={-margin} width={size} height={size} fill="#fff" />
      <path d={cells.path} fill="#000" />
    </svg>
  )
}

/** The phone's camera, watching for the PC's QR code. */
function QrScanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: (error?: string) => void }): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    let stream: MediaStream | null = null
    let timer = 0
    let stopped = false
    const reader = new BarcodeDetectorClass!({ formats: ['qr_code'] })
    async function look(): Promise<void> {
      const video = videoRef.current
      if (stopped || !video) return
      try {
        const found = video.readyState >= 2 ? await reader.detect(video) : []
        const code = found.map((f) => cleanCode(f.rawValue)).find((c) => c)
        if (code && !stopped) {
          onCode(code)
          return
        }
      } catch {
        // A frame it couldn't read - try the next one.
      }
      timer = window.setTimeout(() => void look(), 250)
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((s) => {
        if (stopped) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream = s
        const video = videoRef.current!
        video.srcObject = s
        void video.play()
        void look()
      })
      .catch(() => onClose("Couldn't open the camera - allow it for pkmnPvE, or type the code instead"))
    return () => {
      stopped = true
      clearTimeout(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
    // Opened once; a found code or a close unmounts it.
  }, [])

  return (
    <div className="save-transfer-scanner">
      <video ref={videoRef} muted playsInline />
      <p className="editor-hint">Point the camera at the QR code on your PC.</p>
      <button onClick={() => onClose()}>Cancel</button>
    </div>
  )
}

type Mode =
  | { kind: 'idle' }
  | { kind: 'send'; phase: SendPhase; code: string }
  | { kind: 'receive-entry'; scanning: boolean }
  | { kind: 'receive'; phase: ReceivePhase; code: string; preview: SavePreview | null; data: Uint8Array | null }

/**
 * Options → Saves → Send to another device: one device sends its save by a room code, the
 * other types the code in (or scans the PC's QR code) and gets the save, checking what's in
 * it before it replaces its own (which is backed up first). Works PC ↔ phone either way.
 */
function SaveTransferSection(): React.JSX.Element {
  const [mode, setMode] = useState<Mode>({ kind: 'idle' })
  const [typed, setTyped] = useState('')
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null)
  const [myVersion, setMyVersion] = useState<string | null>(null)
  const stopSending = useRef<(() => void) | null>(null)
  const receiver = useRef<Receiver | null>(null)

  useEffect(() => {
    window.api
      .getOnlineSelf()
      .then((self) => setMyVersion(self.player.version))
      .catch(() => {})
    // Leaving the window closes any room or connection still open.
    return () => {
      stopSending.current?.()
      receiver.current?.close()
    }
  }, [])

  function back(error?: string): void {
    stopSending.current?.()
    stopSending.current = null
    receiver.current?.close()
    receiver.current = null
    setMode({ kind: 'idle' })
    setMessage(error ? { text: error, bad: true } : null)
  }

  function send(): void {
    setMessage(null)
    stopSending.current = startSending({
      onPhase: (phase, code) => setMode({ kind: 'send', phase, code }),
      onError: (error) => back(error)
    })
  }

  function receive(rawCode: string): void {
    const code = cleanCode(rawCode)
    if (!code) {
      setMessage({ text: `The code is ${ROOM_CODE_LENGTH} letters and numbers`, bad: true })
      return
    }
    setMessage(null)
    setMode({ kind: 'receive', phase: 'connecting', code, preview: null, data: null })
    receiver.current = startReceiving(code, {
      onPreview: (preview, data) => setMode({ kind: 'receive', phase: 'preview', code, preview, data }),
      onError: (error) => back(error)
    })
  }

  async function replaceSave(data: Uint8Array): Promise<void> {
    if (mode.kind !== 'receive') return
    setMode({ ...mode, phase: 'importing' })
    try {
      await window.api.importSaveFile(data)
      receiver.current?.accept()
      // On the phone the save reaches storage in the background - wait for it first.
      await deviceHooks.flushSaves?.()
      // Everything on screen belongs to the old save - start fresh.
      window.location.reload()
    } catch (e) {
      back(errorText(e))
    }
  }

  // A save from a newer copy of the game than this one can't be loaded here.
  const preview = mode.kind === 'receive' ? mode.preview : null
  const tooNew = !!preview?.appVersion && !!myVersion && compareVersions(preview.appVersion, myVersion) > 0

  return (
    <>
      <h3 className="saves-subheading">Send to another device</h3>
      {mode.kind === 'idle' && (
        <>
          <p className="editor-hint">
            Move this save straight to your {IS_MOBILE ? 'PC' : 'phone'} (or another {IS_MOBILE ? 'phone' : 'PC'}).
            Both need the game open and the internet - no account needed.
          </p>
          <div className="cloud-actions">
            <button onClick={send}>Send this save</button>
            <button onClick={() => (setMessage(null), setMode({ kind: 'receive-entry', scanning: false }))}>
              Receive a save
            </button>
          </div>
        </>
      )}

      {mode.kind === 'send' && (
        <div className="save-transfer-box">
          {mode.phase === 'opening' && <p className="editor-hint">Opening a room…</p>}
          {(mode.phase === 'waiting' || mode.phase === 'connected') && (
            <>
              <div className="save-transfer-code">{mode.code}</div>
              {!IS_MOBILE && <QrCode text={QR_PREFIX + mode.code} />}
              <p className="editor-hint">
                {mode.phase === 'connected'
                  ? 'Connected - waiting for the other device to accept the save…'
                  : IS_MOBILE
                    ? 'On the other device, open Options → Saves → Receive a save and type this code.'
                    : 'On your phone, open Options → Saves → Receive a save, then scan this QR code or type the code.'}
              </p>
            </>
          )}
          {mode.phase === 'sent' && <p className="cloud-message">Save sent - the other device has it now.</p>}
          <button onClick={() => back()}>{mode.phase === 'sent' ? 'Done' : 'Cancel'}</button>
        </div>
      )}

      {mode.kind === 'receive-entry' &&
        (mode.scanning ? (
          <QrScanner
            onCode={(code) => receive(code)}
            onClose={(error) => {
              setMode({ kind: 'receive-entry', scanning: false })
              if (error) setMessage({ text: error, bad: true })
            }}
          />
        ) : (
          <>
            <p className="editor-hint">
              On the device with the save, open Options → Saves → Send this save, then enter its code here.
            </p>
            <div className="cloud-actions save-transfer-entry">
              <input
                className="save-transfer-input"
                value={typed}
                maxLength={ROOM_CODE_LENGTH + 2}
                placeholder="CODE"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => setTyped(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') receive(typed)
                }}
              />
              <button onClick={() => receive(typed)}>Connect</button>
              {CAN_SCAN && (
                <button onClick={() => (setMessage(null), setMode({ kind: 'receive-entry', scanning: true }))}>
                  Scan QR
                </button>
              )}
              <button onClick={() => back()}>Cancel</button>
            </div>
          </>
        ))}

      {mode.kind === 'receive' && (
        <div className="save-transfer-box">
          {mode.phase === 'connecting' && <p className="editor-hint">Connecting to {mode.code}…</p>}
          {mode.phase !== 'connecting' && preview && (
            <>
              <div className="cloud-save">
                <div className="cloud-save-info">
                  <span className="cloud-save-date">{preview.name ?? 'A save'}</span>
                  <span className="cloud-save-detail">
                    {[
                      preview.pokemon !== null && `${preview.pokemon} Pokémon`,
                      preview.money !== null && formatMoney(preview.money),
                      preview.appVersion && `v${preview.appVersion}`
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
              </div>
              {tooNew ? (
                <p className="editor-error">
                  That save is from v{preview.appVersion} - update this copy of the game (v{myVersion}) first.
                </p>
              ) : (
                <p className="editor-hint">This replaces the save on this device - it&apos;s backed up first.</p>
              )}
            </>
          )}
          <div className="cloud-actions">
            {mode.phase !== 'connecting' && !tooNew && (
              <button
                className="cloud-confirm"
                disabled={mode.phase === 'importing'}
                onClick={() => mode.data && void replaceSave(mode.data)}
              >
                {mode.phase === 'importing' ? 'Loading…' : 'Replace my save'}
              </button>
            )}
            <button
              disabled={mode.phase === 'importing'}
              onClick={() => {
                receiver.current?.decline()
                receiver.current = null
                back()
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {message && <p className={message.bad ? 'editor-error' : 'cloud-message'}>{message.text}</p>}
    </>
  )
}

export default SaveTransferSection
