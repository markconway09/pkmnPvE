import type { ui as en } from '../en/ui'
import type { Message } from '../en'

export const ui: Record<keyof typeof en, Message> = {
  'common.loading': 'Cargando...',
  'common.notAvailable': 'No disponible',
  'odds.byType': 'Probabilidad por tipo',
  'odds.byRarity': 'Probabilidad por rareza'
}
