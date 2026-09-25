/** "₽12,345" - every Poke Dollar amount on screen, with thousands separators. */
export function formatMoney(amount: number): string {
  return `₽${amount.toLocaleString('en-US')}`
}
