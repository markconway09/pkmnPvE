import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

// Hands a file (an exported save) to the phone's share sheet - Google Drive, Files, a
// chat... It's written to the app's cache first, which the share sheet can read from.
// Opened in an ordinary browser (npm run dev:mobile), it's a plain download instead.

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}

export async function shareFile(name: string, data: Uint8Array): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    const url = URL.createObjectURL(new Blob([data as BlobPart], { type: 'application/octet-stream' }))
    const link = document.createElement('a')
    link.href = url
    link.download = name
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    return
  }
  const { uri } = await Filesystem.writeFile({ path: name, data: toBase64(data), directory: Directory.Cache })
  await Share.share({ title: name, files: [uri], dialogTitle: 'Save your pkmnPvE save' })
}
