// Build-time settings from .env.local (git-ignored), compiled into the main process by
// electron-vite. Missing ones come through as undefined - cloud saves are then off.
interface ImportMetaEnv {
  readonly MAIN_VITE_GOOGLE_CLIENT_ID?: string
  readonly MAIN_VITE_GOOGLE_CLIENT_SECRET?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
