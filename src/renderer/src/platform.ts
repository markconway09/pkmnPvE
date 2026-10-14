// Whether the screens are running in the phone app (set by src/mobile/main.ts
// before they load). The phone build has no updater, music
// folder or screen size option, picks its background from the gallery, ships only the still sprites,
// and lays the screens out for a portrait phone (src/mobile/mobile.css).
export const IS_MOBILE = document.documentElement.dataset.platform === 'mobile'

// The phone layout: on the phone, or on the PC with Options → Screen size → Mobile. Only
// how the screens are laid out - the PC keeps its updater, mouse and file pickers.
const PC_PHONE_LAYOUT = !IS_MOBILE && (window as { desktopLayout?: string }).desktopLayout === 'mobile'
if (PC_PHONE_LAYOUT) {
  document.documentElement.dataset.layout = 'mobile'
  // The window's width as a plain number, for the layout's zoomed parts (mobile.css).
  const setWidth = (): void => document.documentElement.style.setProperty('--m-vw', String(document.documentElement.clientWidth))
  setWidth()
  window.addEventListener('resize', setWidth)
}
export const IS_MOBILE_LAYOUT = IS_MOBILE || PC_PHONE_LAYOUT

/** The word for pressing something, in on-screen hints ("Click again", "Tap to skip"). */
export const CLICK = IS_MOBILE ? 'Tap' : 'Click'
export const CLICK_LC = IS_MOBILE ? 'tap' : 'click'
