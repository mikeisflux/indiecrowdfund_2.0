import { db } from "@/lib/db";

/**
 * True if the creator has a chargeback protection card on file that
 * covers this project.
 *
 * Two storage paths exist because of how the chargeback card UI evolved:
 *
 *  - The unified user-level card (CreatorMarketplaceChargebackCard,
 *    keyed by userId). One save covers every project the creator owns
 *    plus marketplace sales.
 *
 *  - Legacy per-project cards (CreatorChargebackCard, keyed by
 *    projectId). The old project-builder form wrote here.
 *
 * Submit / launch / edit-launched validators all need to accept either
 * so a creator whose card lives in the user-level table isn't blocked
 * with "Chargeback protection card is required" while the UI shows
 * the card as saved.
 */
export async function projectHasChargebackCard(
  projectId: string,
  creatorId: string
): Promise<boolean> {
  const [userLevel, perProject] = await Promise.all([
    db.creatorMarketplaceChargebackCard.findUnique({
      where: { userId: creatorId },
      select: { id: true },
    }),
    db.creatorChargebackCard.findUnique({
      where: { projectId },
      select: { id: true },
    }),
  ]);
  return !!(userLevel || perProject);
}

/** Campaign statuses for which a creator must hold a vaulted chargeback card. */
export const CHARGEBACK_CARD_REQUIRED_STATUSES = [
  "SUBMITTED",
  "APPROVED",
  "LIVE",
  "PAUSED",
  "FUNDED",
] as const;

export interface PendingChargebackCard {
  id: string;
  title: string;
  status: string;
  /** A pre-vault card exists (encrypted PAN or dead PaymentCloud token). */
  hasLegacyCard: boolean;
}

/**
 * The creator's campaigns whose chargeback card is not in the DivinityCoin
 * vault. Drives the dashboard gate: a launched or launch-ready campaign with
 * a missing or legacy card blocks the dashboard until the card is re-entered
 * through the secure form. Legacy cards can't be charged for a dispute, so
 * they count as missing.
 */
export async function pendingChargebackCards(userId: string): Promise<PendingChargebackCard[]> {
  const projects = await db.project.findMany({
    where: {
      creatorId: userId,
      deletedAt: null,
      status: { in: [...CHARGEBACK_CARD_REQUIRED_STATUSES] },
    },
    select: {
      id: true,
      title: true,
      status: true,
      chargebackCard: { select: { divinityCoinPaymentMethodId: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return projects
    .filter((p) => !p.chargebackCard?.divinityCoinPaymentMethodId)
    .map((p) => ({
      id: p.id,
      title: p.title,
      status: p.status,
      hasLegacyCard: !!p.chargebackCard,
    }));
}
