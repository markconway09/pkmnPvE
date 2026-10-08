import type { CapacitorConfig } from '@capacitor/cli'

// The Android app: the mobile build's page (dist-mobile, from vite.mobile.config.ts)
// wrapped by Capacitor. The android/ folder is its Android Studio project.
const config: CapacitorConfig = {
  appId: 'com.pkmnpve.game',
  appName: 'pkmnPvE',
  webDir: 'dist-mobile'
}

export default config
