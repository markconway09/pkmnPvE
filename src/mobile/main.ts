import { installPlatform } from '../main/platform'
import { createApi } from '../shared/api'
import { version } from '../../package.json'
import { createWebPlatform } from './web-platform'
import { Capacitor } from '@capacitor/core'
import { indexedDbBackend } from './indexeddb-backend'
import { filesystemBackend } from './filesystem-backend'
import { emitLocal } from './ui-events'
import { installBackButton } from './back-button'
import { shareFile } from './share-file'
import { deviceHooks } from '../renderer/src/deviceHooks'
import trainers from '../../save/trainers.json?raw'
import premadeTeams from '../../save/premadeTeams.json?raw'
import bossOrder from '../../save/bossOrder.json?raw'
import shopPrices from '../../save/shopPrices.json?raw'
import wildDrops from '../../save/wildDrops.json?raw'

// The mobile entry point: the game and its screens in one page. The save is
// loaded first, then window.api is put in place, then the usual screens start.
async function boot(): Promise<void> {
  // Tells the screens they're on a phone (src/renderer/src/platform.ts).
  document.documentElement.dataset.platform = 'mobile'
  // The screen's width as a plain number, for the layout's zoomed parts (mobile.css).
  const setWidth = (): void => document.documentElement.style.setProperty('--m-vw', String(document.documentElement.clientWidth))
  setWidth()
  window.addEventListener('resize', setWidth)
  const platform = await createWebPlatform({
    // Real files on the phone; the browser's IndexedDB when the page is opened on a computer.
    backend: Capacitor.isNativePlatform() ? filesystemBackend() : indexedDbBackend(),
    seed: {
      'trainers.json': trainers,
      'premadeTeams.json': premadeTeams,
      'bossOrder.json': bossOrder,
      'shopPrices.json': shopPrices,
      'wildDrops.json': wildDrops
    },
    version,
    emit: emitLocal,
    devBuild: import.meta.env.DEV
  })
  installPlatform(platform)
  // The phone's ways of handing a save file out, and of waiting for the save to be written.
  deviceHooks.shareFile = shareFile
  deviceHooks.flushSaves = platform.flushed
  const { directTransport } = await import('./direct-transport')
  ;(await import('./background')).installBackgroundHandlers()
  window.api = createApi(directTransport)
  const { restoreRememberedSession } = await import('../main/showdown/player-session')
  restoreRememberedSession()
  await import('../renderer/src/main')
  // After styles.css, so the phone layout's rules win.
  await import('./mobile.css')
  if (Capacitor.isNativePlatform()) installBackButton()
}

void boot()
