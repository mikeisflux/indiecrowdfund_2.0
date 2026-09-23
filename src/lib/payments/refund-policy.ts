/**
 * Refund policy: creators can only move money while their campaign is
 * still running.
 *
 * Once a campaign closes (funded/failed/cancelled, or its end date has
 * passed), payouts are computed from completed pledges and settled to
 * the creator. A refund issued after that point doesn't come out of
 * campaign funds — it comes out of the platform's pocket and turns
 * into a "Creator Owes Back" negative balance that has to be clawed
 * back by hand. Admins can still refund through the admin transaction
 * tools, where the payout ledger is in view.
 */

export interface RefundWindowProject {
  status: string;
  endDate: Date | string | null;
}

/** True when the campaign is over and creator-initiated refunds are closed. */
export function isCampaignClosedForRefunds(project: RefundWindowProject): boolean {
  if (project.status !== "LIVE") {
    // FUNDED / FAILED / CANCELLED are all past the finish line. Pre-live
    // states (DRAFT/SUBMITTED/APPROVED) can't have completed pledges to
    // refund, so treating them as closed is harmless and safe.
    return true;
  }
  if (project.endDate && new Date(project.endDate).getTime() <= Date.now()) {
    // Still marked LIVE but the clock ran out — payout math already
    // treats these as payable (see /api/admin/payouts/* queries), so
    // refunds must stop at the same moment.
    return true;
  }
  return false;
}

export const CLOSED_CAMPAIGN_REFUND_MESSAGE =
  "This campaign has ended, so refunds can no longer be issued from the creator dashboard. " +
  "Refunds after a campaign closes affect payout settlement and are handled by IndieCrowdfund support — " +
  "contact support with the backer and amount and we'll take it from there.";
