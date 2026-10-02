/** "₽12,345" - every Poke Dollar amount on screen, with thousands separators. */
export function formatMoney(amount: number): string {
  return `₽${amount.toLocaleString('en-US')}`
}

/** "1.5k", "25k", "1.2M" - a number shortened for a tight spot (under 1,000 it's left as is). */
export function formatShort(amount: number): string {
  const abs = Math.abs(amount)
  const [value, suffix] = abs >= 1_000_000 ? [amount / 1_000_000, 'M'] : abs >= 1000 ? [amount / 1000, 'k'] : [amount, '']
  // One decimal at most, and none when it's a round number.
  return `${Number(value.toFixed(suffix ? 1 : 0)).toLocaleString('en-US')}${suffix}`
}

/** "₽1.5k" - a Poke Dollar amount shortened (see formatShort). */
export function formatMoneyShort(amount: number): string {
  return `₽${formatShort(amount)}`
}
