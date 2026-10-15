// The game's languages. English is the source: every line lives in en.ts under a key, and
// each other language must give the same keys (the typecheck catches a missing one).
// Lines can hold {placeholders}, filled from the params; a line that changes with a count
// ("1 coin" / "5 coins") is a { one, other } pair, picked by params.count.

import { en, type Message } from './en'
import { es } from './es'

export type Locale = 'en' | 'es'

export const LOCALES: Locale[] = ['en', 'es']

// Each language's name in itself, for the picker.
export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  es: 'Español'
}

// The full locale for number formatting and plural rules.
export const LOCALE_TAGS: Record<Locale, string> = {
  en: 'en-US',
  es: 'es-ES'
}

export type MessageKey = keyof typeof en
export type MessageParams = Record<string, string | number>

const DICTIONARIES: Record<Locale, Record<MessageKey, Message>> = { en, es }

const pluralRules = new Map<Locale, Intl.PluralRules>()

function pluralCategory(locale: Locale, count: number): string {
  let rules = pluralRules.get(locale)
  if (!rules) {
    rules = new Intl.PluralRules(LOCALE_TAGS[locale])
    pluralRules.set(locale, rules)
  }
  return rules.select(count)
}

export function isLocale(value: string): value is Locale {
  return (LOCALES as string[]).includes(value)
}

/** A line by a key worked out at run time ("itemcat." + a category), or the fallback when there's no such key. */
export function translateOr(locale: Locale, key: string, fallback: string, params?: MessageParams): string {
  return key in en ? translate(locale, key as MessageKey, params) : fallback
}

/** The line for a key in a language, with its {placeholders} filled in. */
export function translate(locale: Locale, key: MessageKey, params?: MessageParams): string {
  const message = DICTIONARIES[locale][key] ?? en[key]
  let text: string
  if (typeof message === 'string') {
    text = message
  } else {
    const count = typeof params?.count === 'number' ? params.count : 0
    text = pluralCategory(locale, count) === 'one' ? message.one : message.other
  }
  if (!params) return text
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = params[name]
    if (value === undefined) return whole
    return typeof value === 'number' ? value.toLocaleString(LOCALE_TAGS[locale]) : value
  })
}
