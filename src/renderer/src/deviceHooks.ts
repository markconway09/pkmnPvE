// The few things the screens do differently on the phone that need the phone's own
// plugins - filled in by src/mobile/main.ts, so the desktop build never loads them.

interface DeviceHooks {
  /** Hands a file to the phone's share sheet (Google Drive, Files, a chat...). */
  shareFile?: (name: string, data: Uint8Array) => Promise<void>
  /** Waits until every save write has reached the phone's storage. */
  flushSaves?: () => Promise<void>
}

export const deviceHooks: DeviceHooks = {}

/** Saves a file for the player: the share sheet on the phone, a download on the PC. */
export async function saveFileOut(name: string, data: Uint8Array): Promise<void> {
  if (deviceHooks.shareFile) return deviceHooks.shareFile(name, data)
  const url = URL.createObjectURL(new Blob([data as BlobPart], { type: 'application/octet-stream' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
