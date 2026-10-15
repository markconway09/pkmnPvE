import { gameHandlers } from '../main/game-api'
import { appVersion } from '../main/platform'
import { checkLatestRelease } from '../shared/update-check'
import packageJson from '../../package.json'

// Options → Updates on the phone: finds the latest release's APK on GitHub. An app
// can't replace itself on Android, so the screens open the APK's link in the browser
// and Android's own installer puts it over this copy (see UpdatesSection.tsx).

const REPO: string = (packageJson as { updateRepo?: string }).updateRepo ?? ''
const APK_ASSET = /\.apk$/i

// canInstall: only the installed app - the page opened in a computer's browser can't.
export function installUpdateHandlers(canInstall: boolean): void {
  gameHandlers.set('update:check', async () => (await checkLatestRelease(REPO, appVersion(), APK_ASSET, canInstall)).result)
}
