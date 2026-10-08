// Builds the Android app from the android/ project (after `npm run build:mobile`
// has put the page in it) and copies the APK to dist/pkmnPvE-<version>.apk.
// Uses Android Studio's own Java and the SDK where Android Studio puts it,
// unless JAVA_HOME / ANDROID_HOME already say otherwise.
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const android = join(root, 'android')
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

function firstExisting(...paths) {
  return paths.find((p) => p && existsSync(p))
}

const javaHome = firstExisting(
  process.env.JAVA_HOME,
  'C:/Program Files/Android/Android Studio/jbr',
  '/Applications/Android Studio.app/Contents/jbr/Contents/Home'
)
const sdk = firstExisting(
  process.env.ANDROID_HOME,
  process.env.ANDROID_SDK_ROOT,
  process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Android/Sdk'),
  process.env.HOME && join(process.env.HOME, 'Library/Android/sdk')
)
if (!javaHome) throw new Error('No Java found - install Android Studio or set JAVA_HOME')
if (!sdk) throw new Error('No Android SDK found - install Android Studio or set ANDROID_HOME')

// Gradle reads the SDK's place from local.properties (git-ignored by Capacitor).
writeFileSync(join(android, 'local.properties'), `sdk.dir=${sdk.replace(/\\/g, '/')}\n`)

// Gradle updates the last APK in place and never shrinks it - files the game no longer
// ships would keep taking room - so it starts from nothing each time.
rmSync(join(android, 'app/build/outputs/apk'), { recursive: true, force: true })

const gradlew = join(android, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew')
const result = spawnSync(gradlew, ['assembleDebug', '--console=plain'], {
  cwd: android,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, JAVA_HOME: javaHome, ANDROID_HOME: sdk }
})
if (result.status !== 0) process.exit(result.status ?? 1)

const apk = join(android, 'app/build/outputs/apk/debug/app-debug.apk')
const out = join(root, 'dist', `pkmnPvE-${version}.apk`)
mkdirSync(dirname(out), { recursive: true })
copyFileSync(apk, out)
console.log(`APK: ${out}`)
