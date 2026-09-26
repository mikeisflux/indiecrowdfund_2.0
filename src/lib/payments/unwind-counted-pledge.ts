import { db } from "@/lib/db";

/**
 * Reverse the campaign counters for a counted pledge that just went
 * terminal (FAILED / never-collectable).
 *
 * The counting invariant platform-wide is `confirmationEmailSent`: a pledge
 * with it true has been added to Project.currentAmount / backerCount and
 * holds a reward slot. Every CANCELLED / REFUNDED / CHARGEBACK path reverses
 * those on transition — but until now every PENDING→FAILED path forgot to,
 * which is how a campaign's displayed total drifted above its real
 * collected sum (a failed $28 AoN charge stayed in Demon Samurai #1's
 * total). Worse than cosmetic: the inflated currentAmount feeds
 * `currentAmount >= goalAmount`, so failures could push an AoN campaign
 * "over goal" and trigger real charges against every other saved card.
 *
 * Call this ONLY after winning a status CAS (updateMany count > 0) so
 * concurrent transitions can't double-decrement.
 */
export async function unwindCountedPledge(pledge: {
  projectId: string;
  amount: unknown;
  rewardId: string | null;
  confirmationEmailSent: boolean;
}): Promise<void> {
  if (!pledge.confirmationEmailSent) return;
  await db.project.update({
    where: { id: pledge.projectId },
    data: {
      currentAmount: { decrement: Number(pledge.amount) },
      backerCount: { decrement: 1 },
    },
  });
  if (pledge.rewardId) {
    await db.$executeRaw`UPDATE "Reward" SET "quantityClaimed" = GREATEST(0, "quantityClaimed" - 1) WHERE id = ${pledge.rewardId}`;
  }
}
