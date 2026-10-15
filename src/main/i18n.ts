// The language the game writes its own lines in (hints, errors, mission and reward text) -
// the screens say which at start and whenever the player switches (see the renderer's
// i18n.ts). English until told.

import { LOCALE_TAGS, isLocale, translateOr, type MessageKey, type MessageParams } from '../shared/i18n'
import { activeLocale, setActiveLocale, tr } from '../shared/i18n/current'
import { dexName } from '../shared/i18n/dex'
import * as gameData from '../shared/i18n/game-data'

export function setGameLocale(next: string): void {
  if (isLocale(next)) setActiveLocale(next)
}

/** A line in the game's current language. */
export function t(key: MessageKey, params?: MessageParams): string {
  return tr(key, params)
}

/** A number written the way the game's current language writes it (1,000 / 1.000). */
export function formatNumber(value: number): string {
  return value.toLocaleString(LOCALE_TAGS[activeLocale()])
}

/** A line by a key worked out at run time ("vol." + an effect id), or the fallback when there's none. */
export function tOr(key: string, fallback: string, params?: MessageParams): string {
  return translateOr(activeLocale(), key, fallback, params)
}

// Dex names in the game's current language, for lines like "learned Thunderbolt".
export const moveName = (name: string): string => dexName(activeLocale(), 'moves', name)
export const itemName = (name: string): string => dexName(activeLocale(), 'items', name)
export const abilityName = (name: string): string => dexName(activeLocale(), 'abilities', name)
export const typeName = (name: string): string => dexName(activeLocale(), 'types', name)

// The game data's text (achievements, missions, titles) in the game's current language.
export const achievementName = (id: string, english: string): string =>
  gameData.achievementName(activeLocale(), id, english)
export const missionText = (templateId: string, english: string): string =>
  gameData.missionText(activeLocale(), templateId, english)
export const titleName = (title: string): string => gameData.titleName(activeLocale(), title)
