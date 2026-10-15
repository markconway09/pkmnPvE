import type { UpdateCheckResult } from './battle-types'

/**
 * Options → Check for updates, the part both builds share: ask the GitHub repo for its
 * latest Release and pick out this build's file - the PC's -win.zip or the phone's .apk.
 * Only the asking runs here; installing is up to each build (src/main/updater.ts on the
 * PC, the phone's browser for the APK).
 */

export interface ReleaseAsset {
  name: string
  size: number
  browser_download_url: string
  // "sha256:<hex>" - GitHub publishes one for every release file.
  digest?: string | null
}

// "0.2.10" > "0.2.9": compares dotted version numbers part by part.
export function isNewer(latest: string, current: string): boolean {
  const a = latest.split('.').map((n) => parseInt(n, 10) || 0)
  const b = current.split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0)
  }
  return false
}

// A release's notes hold a short version for the update box, then this marker, then the
// full notes (see scripts/release.mjs). Older releases without it show whole.
const FULL_NOTES_MARKER = '<!-- full notes -->'

/**
 * The latest release, and this build's file in it when that's newer than `current`. A
 * release whose file for this build isn't up yet (the APK goes up a little after the
 * zip) doesn't count as an update until it is.
 */
export async function checkLatestRelease(
  repo: string,
  current: string,
  assetName: RegExp,
  canInstall: boolean,
  // The PC names itself to GitHub; a phone's web view can't set that header.
  extraHeaders: Record<string, string> = {}
): Promise<{ result: UpdateCheckResult; asset: ReleaseAsset | null }> {
  if (!repo) throw new Error('No update repo is set (updateRepo in package.json)')
  const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
    headers: { ...extraHeaders, Accept: 'application/vnd.github+json' }
  })
  if (res.status === 404) {
    return { result: { current, latest: null, available: false, notes: '', sizeBytes: 0, canInstall }, asset: null }
  }
  if (!res.ok) throw new Error(`GitHub answered ${res.status} - try again later`)
  const release = (await res.json()) as { tag_name: string; body?: string; assets: ReleaseAsset[] }
  const latest = release.tag_name.replace(/^v/i, '')
  const file = release.assets.find((a) => assetName.test(a.name)) ?? null
  const available = !!file && isNewer(latest, current)
  return {
    result: {
      current,
      latest,
      available,
      notes: (release.body ?? '').split(FULL_NOTES_MARKER)[0].trim(),
      sizeBytes: file?.size ?? 0,
      canInstall,
      downloadUrl: available ? file!.browser_download_url : undefined
    },
    asset: available ? file : null
  }
}
