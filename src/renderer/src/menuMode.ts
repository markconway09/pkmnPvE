// Which half of the game the main menu shows - the classic game or Roguelite runs.
// Remembered per player in this browser's storage; it's only a view, so losing it
// just means the menu opens in Classic.
export type MenuMode = 'classic' | 'roguelite'

const key = (username: string): string => `pkmnpve.menuMode.${username.toLowerCase()}`

export function loadMenuMode(username: string): MenuMode {
  try {
    return localStorage.getItem(key(username)) === 'roguelite' ? 'roguelite' : 'classic'
  } catch {
    return 'classic'
  }
}

export function saveMenuMode(username: string, mode: MenuMode): void {
  try {
    localStorage.setItem(key(username), mode)
  } catch {
    // Not remembered - it's only which menu opens first.
  }
}
