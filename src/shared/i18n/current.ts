// The language in use right now - set by the screens (renderer i18n.ts) and, on the
// desktop, told to the game's side too (main i18n.ts), so shared code on either side can
// write its lines in it: tr() for a line, and the label tables that use it.

import { translate, type Locale, type MessageKey, type MessageParams } from './index'

let current: Locale = 'en'

export function activeLocale(): Locale {
  return current
}

export function setActiveLocale(locale: Locale): void {
  current = locale
}

/** A line in the language in use. */
export function tr(key: MessageKey, params?: MessageParams): string {
  return translate(current, key, params)
}
