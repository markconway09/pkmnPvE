// Whether the screens are running in the phone app (set by src/mobile/main.ts
// before they load). The phone build has no updater, Google Drive saves, music
// folder or screen size option, picks its background from the gallery, ships only the still sprites,
// and lays the screens out for a portrait phone (src/mobile/mobile.css).
export const IS_MOBILE = document.documentElement.dataset.platform === 'mobile'

/** The word for pressing something, in on-screen hints ("Click again", "Tap to skip"). */
export const CLICK = IS_MOBILE ? 'Tap' : 'Click'
export const CLICK_LC = IS_MOBILE ? 'tap' : 'click'
