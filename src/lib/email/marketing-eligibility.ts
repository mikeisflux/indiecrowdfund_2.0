/**
 * Who may receive a marketing email.
 *
 * Every recipient query used to filter on `deletedAt: null` and stop there.
 * That misses three groups, all of whom we have promised in writing not to
 * email:
 *
 *   - Deleted accounts. performAccountDeletion sets `accountDeletedAt`, not
 *     `deletedAt`, so a closed account stayed on every marketing list.
 *   - Unsubscribed users. Deletion also stamps `emailUnsubscribedAt` and
 *     labels it a hard opt-out; nothing on the sending side read it, so the
 *     opt-out was decorative.
 *   - Banned accounts. Terms 11a and Data Deletion Policy 6.C both say the
 *     identifiers retained after a ban are never used for marketing. Leaving
 *     a banned user on the list makes that sentence false.
 *
 * Exported as one object so the send path and the count/preview path cannot
 * disagree about who is on the list — a preview that says 900 and a send that
 * reaches 950 is its own kind of bug.
 */
export const MARKETING_RECIPIENT_WHERE = {
  // Soft-deleted rows.
  deletedAt: null,
  // Self-service or admin-approved account deletion.
  accountDeletedAt: null,
  // Site-wide opt-out, however it was set.
  emailUnsubscribedAt: null,
  // Banned or locked. Retained data is for enforcement, never promotion.
  lockedAt: null,
} as const;

/** The same rule for NewsletterSubscriber rows, which are keyed by email. */
export const MARKETING_SUBSCRIBER_WHERE = {
  isActive: true,
} as const;
