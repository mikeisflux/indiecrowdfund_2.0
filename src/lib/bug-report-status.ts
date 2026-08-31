/**
 * What counts as an open bug report, in one place.
 *
 * This was defined three times and all three disagreed, which is how the
 * sidebar showed a badge of 1 above a page that said "No open bug reports":
 *
 *   - the admin page's Open tab:  NEW, ACKNOWLEDGED, IN_PROGRESS, NEEDS_INFO
 *   - the sidebar badge:          NEW, ACKNOWLEDGED
 *   - the stats cards:            NEW and IN_PROGRESS counted separately,
 *                                 with ACKNOWLEDGED and NEEDS_INFO counted
 *                                 nowhere at all
 *
 * A single ACKNOWLEDGED report therefore appeared in the badge, in no stat
 * card, and — because the page fetched only the first page of results — not
 * in the list either.
 *
 * Anything that answers "is there work outstanding" must use these.
 */

export const OPEN_BUG_STATUSES = [
  "NEW",
  "ACKNOWLEDGED",
  "IN_PROGRESS",
  "NEEDS_INFO",
] as const;

export const CLOSED_BUG_STATUSES = ["RESOLVED", "CLOSED", "WONT_FIX"] as const;

export function isOpenBugStatus(status: string): boolean {
  return (OPEN_BUG_STATUSES as readonly string[]).includes(status);
}

export function isClosedBugStatus(status: string): boolean {
  return (CLOSED_BUG_STATUSES as readonly string[]).includes(status);
}
