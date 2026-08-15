// Stable DOM id for a reward row, so the step can scroll one back into view
// after the edit form closes without threading refs through dnd-kit's own.
//
// Keys contain titles, which contain anything — spaces, quotes, colons. This is
// only ever used with getElementById, which takes a literal id rather than a
// selector, so encoding just needs to be collision-free and legal in an
// attribute, not CSS-safe.
export function rewardRowDomId(key: string): string {
  return `reward-row-${encodeURIComponent(key)}`;
}
