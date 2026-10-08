// The desktop modules the mobile build replaces with its own: each one loads
// something from the disk through Node, and its stand-in gets the same thing
// bundled into the page. Paths are from the project root (see vite.mobile.config.ts).
export const MOBILE_SWAPS: Record<string, string> = {
  'src/main/showdown/ps.ts': 'src/mobile/ps.ts',
  'src/main/showdown/vendor/battle-text-data.ts': 'src/mobile/battle-text-data.ts'
}
