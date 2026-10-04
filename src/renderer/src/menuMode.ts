// Which page of the main menu is open - Home (the hub), one of the game's modes, or the
// Game Corner. Remembered only for this session, per player, so a battle comes back to
// the page it started from; the game itself always opens on Home.
export type MenuPage = 'home' | 'classic' | 'catch' | 'box' | 'roguelite' | 'draft' | 'raid' | 'corner'

const openPages = new Map<string, MenuPage>()

export function loadMenuPage(username: string): MenuPage {
  return openPages.get(username.toLowerCase()) ?? 'home'
}

export function saveMenuPage(username: string, page: MenuPage): void {
  openPages.set(username.toLowerCase(), page)
}
