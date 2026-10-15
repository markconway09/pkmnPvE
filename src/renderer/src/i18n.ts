// The language the game shows - picked in Options (or on the login screen), kept per
// computer in localStorage like the sound settings. A first launch follows the system's
// language. App redraws every screen when the language changes (nothing is memoised), so
// screens can call t() and the Dex name helpers right in their render. The game's side
// is told too, since it writes some lines itself (hints, errors, mission text).

import { useSyncExternalStore } from 'react'
import { LOCALE_TAGS, isLocale, translate, type Locale, type MessageKey, type MessageParams } from '../../shared/i18n'
import { dexName, dexText } from '../../shared/i18n/dex'
import { setActiveLocale } from '../../shared/i18n/current'
import * as gameData from '../../shared/i18n/game-data'
import { ACHIEVEMENTS, type AchievementCategory } from '../../shared/achievements'
import { translateOr } from '../../shared/i18n'
import type { Title } from '../../shared/titles'
import { MISSION_TEMPLATES } from '../../shared/missions'
import { loadString, savePref } from './soundPrefs'
import { IS_MOBILE } from './platform'

const KEY = 'pkmnpve.locale'

function systemLocale(): Locale {
  return navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en'
}

let locale: Locale = (() => {
  const stored = loadString(KEY, '')
  return isLocale(stored) ? stored : systemLocale()
})()
document.documentElement.lang = locale
// Shared code (label tables, rarity names...) on this side writes in it too.
setActiveLocale(locale)

const listeners = new Set<() => void>()

export function currentLocale(): Locale {
  return locale
}

export function setLocale(next: Locale): void {
  if (next === locale) return
  locale = next
  setActiveLocale(next)
  savePref(KEY, next)
  document.documentElement.lang = next
  tellGame()
  listeners.forEach((listener) => listener())
}

/** Tells the game's side which language to write its lines in - at start and on a change. */
export function tellGame(): void {
  void window.api.setLocale(locale).catch(() => undefined)
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export type Translate = (key: MessageKey, params?: MessageParams) => string

/** A line in the current language, for code outside components. */
export const t: Translate = (key, params) => translate(locale, key, params)

/** A number written the way the current language writes it (1,000 / 1.000). */
export function formatNumber(value: number): string {
  return value.toLocaleString(LOCALE_TAGS[locale])
}

/** The current language's full locale, for toLocaleString. */
export function numberLocale(): string {
  return LOCALE_TAGS[locale]
}

/** The word for pressing something, in on-screen hints ("Click again", "Tap to skip"). */
export function clickWord(): string {
  return t(IS_MOBILE ? 'common.tap' : 'common.click')
}

export function clickWordLc(): string {
  return t(IS_MOBILE ? 'common.tapLc' : 'common.clickLc')
}

// Move, item, ability, type, nature and stat names (from their English name or id) and
// descriptions, in the current language - English when there's no translation.
export const moveName = (name: string): string => dexName(locale, 'moves', name)
export const itemName = (name: string): string => dexName(locale, 'items', name)
export const abilityName = (name: string): string => dexName(locale, 'abilities', name)
export const typeName = (name: string): string => dexName(locale, 'types', name)
export const natureName = (name: string): string => dexName(locale, 'natures', name)
export const statName = (name: string): string => dexName(locale, 'stats', name)
export const moveText = (id: string, english: string): string => dexText(locale, 'moves', id, english)
export const itemText = (id: string, english: string): string => dexText(locale, 'items', id, english)
export const abilityText = (id: string, english: string): string => dexText(locale, 'abilities', id, english)

/** A line by a key worked out at run time ("prize." + an item id), or the fallback when there's none. */
export function translateKey(key: string, fallback: string, params?: MessageParams): string {
  return translateOr(locale, key, fallback, params)
}

/** A bag or shop category's name ("Berries", "Key Items"...) - categories are kept in English. */
export function itemCategoryName(category: string): string {
  return translateOr(locale, `itemcat.${category}`, category)
}

/** A status condition's short badge ("PAR", "BRN"...); bad poisoning shows as poison. */
export function statusLabel(status: string): string {
  return translateOr(locale, `status.${status === 'tox' ? 'psn' : status}`, status.toUpperCase())
}

/** An achievement's name from its English name (some views only carry that). */
export function achievementNameOf(english: string): string {
  const def = ACHIEVEMENTS.find((a) => a.name === english)
  return def ? achievementName(def.id, english) : english
}

/** A daily mission's text from its English text (the finished-mission pop-ups only carry that). */
export function missionTextOf(english: string): string {
  const template = MISSION_TEMPLATES.find((m) => m.text === english)
  return template ? missionText(template.id, english) : english
}

/** Whether a search matches any of these names (the English one and the one shown), accents ignored. */
export function nameMatches(query: string, ...names: string[]): boolean {
  const fold = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const q = fold(query)
  return names.some((name) => fold(name).includes(q))
}

// The game data's text (achievements, titles, missions) in the current language.
export const achievementName = (id: string, english: string): string => gameData.achievementName(locale, id, english)
export const achievementDescription = (id: string, english: string): string =>
  gameData.achievementDescription(locale, id, english)
export const achievementCategoryName = (category: AchievementCategory): string =>
  gameData.achievementCategoryName(locale, category)
export const titleName = (title: string): string => gameData.titleName(locale, title)
export const titlePerkText = (title: Title, english: string): string => gameData.titlePerkText(locale, title, english)
export const missionText = (templateId: string, english: string): string => gameData.missionText(locale, templateId, english)

/** The current language, redrawing the component when it changes. */
export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, currentLocale)
}

/** t() for a component, redrawing it when the language changes. */
export function useT(): Translate {
  const current = useLocale()
  return (key, params) => translate(current, key, params)
}
