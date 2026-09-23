import { db } from "@/lib/db";

/**
 * Admin-facing chargeback-card summary for payout views.
 *
 * When a payout dialog shows "Creator Owes Back", the next question is
 * always "what card do we recoup against?" — this answers it. Display
 * data only (brand/last4/expiry); the PAN lives in the PaymentCloud
 * Customer Vault (or, for legacy rows, encrypted columns that are
 * never decrypted here).
 *
 * Card resolution matches projectHasChargebackCard
 * (src/lib/chargeback-card.ts): a project-level CreatorChargebackCard
 * wins, else the creator's account-wide
 * CreatorMarketplaceChargebackCard covers it.
 */

export interface ChargebackCardSummary {
  cardBrand: string | null;
  cardLastFour: string;
  expMonth: number;
  expYear: number;
  /** Which table the card came from. */
  source: "project" | "account";
  /** True when stored as a PaymentCloud vault id (rechargeable). Legacy
   *  encrypted-PAN rows are false — recouping those is a manual job. */
  vaultTokenized: boolean;
  /** Expiry is in the past — the recoup charge would decline. */
  expired: boolean;
}

function isExpired(expMonth: number, expYear: number): boolean {
  const now = new Date();
  return expYear < now.getFullYear() ||
    (expYear === now.getFullYear() && expMonth < now.getMonth() + 1);
}

/**
 * Batch-load chargeback cards for a payout listing; one query per table
 * regardless of project count. Returns a resolver keyed by
 * (projectId, creatorId).
 */
export async function loadChargebackCards(
  projectIds: string[],
  creatorIds: string[]
): Promise<{ forProject: (projectId: string, creatorId: string) => ChargebackCardSummary | null }> {
  // Prisma short-circuits `in: []`, so empty id lists are free.
  const [perProject, perUser] = await Promise.all([
    db.creatorChargebackCard.findMany({
      where: { projectId: { in: projectIds } },
      select: {
        projectId: true,
        cardBrand: true,
        cardLastFour: true,
        expMonth: true,
        expYear: true,
        nmiCustomerVaultId: true,
      },
    }),
    db.creatorMarketplaceChargebackCard.findMany({
      where: { userId: { in: creatorIds } },
      select: {
        userId: true,
        cardBrand: true,
        cardLastFour: true,
        expMonth: true,
        expYear: true,
        nmiCustomerVaultId: true,
      },
    }),
  ]);

  const byProject = new Map<string, (typeof perProject)[number]>();
  for (const c of perProject) byProject.set(c.projectId, c);
  const byUser = new Map<string, (typeof perUser)[number]>();
  for (const c of perUser) byUser.set(c.userId, c);

  return {
    forProject(projectId: string, creatorId: string): ChargebackCardSummary | null {
      const projectCard = byProject.get(projectId);
      if (projectCard) {
        return {
          cardBrand: projectCard.cardBrand,
          cardLastFour: projectCard.cardLastFour,
          expMonth: projectCard.expMonth,
          expYear: projectCard.expYear,
          source: "project",
          vaultTokenized: !!projectCard.nmiCustomerVaultId,
          expired: isExpired(projectCard.expMonth, projectCard.expYear),
        };
      }
      const userCard = byUser.get(creatorId);
      if (userCard) {
        return {
          cardBrand: userCard.cardBrand,
          cardLastFour: userCard.cardLastFour,
          expMonth: userCard.expMonth,
          expYear: userCard.expYear,
          source: "account",
          vaultTokenized: true, // vault id is NOT NULL on this table
          expired: isExpired(userCard.expMonth, userCard.expYear),
        };
      }
      return null;
    },
  };
}
