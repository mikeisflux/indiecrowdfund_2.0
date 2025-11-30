/**
 * Format large numbers for display (e.g., 2500000 -> "$2.5M")
 */
export function formatCurrency(amount: number): string {
  if (amount >= 1_000_000_000) {
    return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  }
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (amount >= 1_000) {
    return `$${(amount / 1_000).toFixed(1)}K`;
  }
  return `$${amount.toFixed(0)}`;
}

/**
 * Format large numbers with suffix (e.g., 21000000 -> "21M+")
 */
export function formatNumber(num: number): string {
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(1)}B+`;
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(0)}M+`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(0)}K+`;
  }
  return `${num}+`;
}
