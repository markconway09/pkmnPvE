import { App } from '@capacitor/app'
import { closeTouchTip } from '../renderer/src/touchTip'

// Android's back button (or back gesture): closes whatever is open on top - a dialog or
// a menu, the same as tapping beside it (a tooltip that's up, or a panel with a back-close
// button - the bag's item details - goes first) - else goes back to Home, and from Home puts the
// game in the background. A battle ignores it (leaving one is the Run button's job).

function topOverlay(): HTMLElement | null {
  const overlays = document.querySelectorAll<HTMLElement>('.modal-overlay, .context-menu-overlay')
  return overlays.length ? overlays[overlays.length - 1] : null
}

function tapBeside(overlay: HTMLElement): void {
  // Dialogs close on a press of their backdrop, menus on a press anywhere outside them.
  for (const type of ['pointerdown', 'mousedown', 'mouseup', 'click']) {
    const init = { bubbles: true, cancelable: true, button: 0 }
    overlay.dispatchEvent(type === 'pointerdown' ? new PointerEvent(type, init) : new MouseEvent(type, init))
  }
}

export function installBackButton(): void {
  void App.addListener('backButton', () => {
    if (closeTouchTip()) return
    const overlay = topOverlay()
    // A panel inside the top dialog (or on the page, with none open) with its own way back.
    const closers = [...document.querySelectorAll<HTMLElement>('[data-back-close]')].filter((el) => !overlay || overlay.contains(el))
    if (closers.length) {
      closers[closers.length - 1].click()
      return
    }
    if (overlay) {
      tapBeside(overlay)
      return
    }
    if (!document.querySelector('.menu-shell')) return
    const home = document.querySelector<HTMLButtonElement>('.menu-rail-home')
    if (home && !home.classList.contains('menu-rail-active')) home.click()
    else void App.minimizeApp()
  })
}
