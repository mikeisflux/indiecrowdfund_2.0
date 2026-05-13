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
