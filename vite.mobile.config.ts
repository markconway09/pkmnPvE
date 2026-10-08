import { cpSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { MOBILE_SWAPS } from './src/mobile/swaps'

// The mobile build: the game and its screens in one web page (src/mobile/),
// which Capacitor wraps into the Android app. `npm run build:mobile`.

const normalize = (path: string): string => path.replace(/\\/g, '/').toLowerCase()

// Points imports of the desktop-only loaders at their mobile stand-ins.
function mobileSwaps(): Plugin {
  const swaps = new Map(Object.entries(MOBILE_SWAPS).map(([from, to]) => [normalize(resolve(from)), resolve(to)]))
  return {
    name: 'mobile-swaps',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!importer || !source.startsWith('.')) return null
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true })
      return (resolved && swaps.get(normalize(resolved.id))) ?? null
    }
  }
}

const PUBLIC_DIR = resolve('src/renderer/public')
// Left out of the app: the animated sprites (~350 MB) - the phone shows the stills.
const LEFT_OUT = ['sprites/2d-animated', 'sprites/3d-animated'].map((dir) => normalize(resolve(PUBLIC_DIR, dir)))

// Copies the screens' public files (sprites, sounds...) into the build, minus LEFT_OUT.
function copyPublic(outDir: string): Plugin {
  return {
    name: 'copy-public',
    apply: 'build',
    closeBundle() {
      cpSync(PUBLIC_DIR, outDir, {
        recursive: true,
        filter: (src) => !LEFT_OUT.some((dir) => normalize(src).startsWith(dir))
      })
    }
  }
}

const OUT_DIR = resolve('dist-mobile')

export default defineConfig(({ command }) => ({
  root: resolve('src/mobile'),
  // Capacitor serves the page from the app's own files.
  base: './',
  // The dev server serves the public files as they are; a build copies them (copyPublic).
  publicDir: command === 'serve' ? PUBLIC_DIR : false,
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src')
    }
  },
  plugins: [mobileSwaps(), react(), copyPublic(OUT_DIR)],
  build: {
    outDir: OUT_DIR,
    emptyOutDir: true,
    // The sim and its data are one big file, on purpose.
    chunkSizeWarningLimit: 20000
  },
  server: {
    port: 5174
  }
}))
