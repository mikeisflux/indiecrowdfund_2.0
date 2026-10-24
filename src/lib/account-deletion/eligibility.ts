import { db } from "@/lib/db";
import { loadDcProjectBalance } from "@/lib/payouts/project-balance";

// Who may delete their own account, and how.
//
// Three outcomes:
//   INSTANT  — backers, creators who never took a campaign live, and
//              creators whose launched campaigns are fully fulfilled with
//              no money outstanding in either direction. Self-serve,
//              deleted immediately (Data Deletion Policy §7).
//   REQUIRES_APPROVAL — everything is fulfilled but the creator is still
//              owed a payout. Deleting would forfeit it, so an admin
//              settles the money and then approves. Nothing is destroyed
//              until they do.
//   BLOCKED  — a campaign is running, a backer is still owed a reward, or
//              the creator owes money back (open chargeback recoup, negative
//              payout balance). Deletion isn't offered until that is zero.
//
// "Has ever gone live" is `Project.launchedAt != null`. That column is
// written exactly once, in the APPROVED -> LIVE transition, and the same
// update clears the prelaunch fields. A prelaunch page therefore never has
// it set no matter how much traction it got, which is the distinction we
// want: prelaunch pages take no money and owe nobody anything.
//
// Soft-deleted projects still count. A creator must not be able to escape
// review by having a campaign removed after the fact.

export type DeletionEligibilityStatus =
  | "INSTANT"
  | "REQUIRES_APPROVAL"
  | "BLOCKED";

export interface LaunchedProjectSummary {
  id: string;
  title: string;
  slug: string;
  status: string;
  launchedAt: Date | null;
  backerCount: number;
  fulfilledCount: number;
  unfulfilledCount: number;
  /** 0-100, rounded. 100 when a launched project has no completed pledges. */
  fulfillmentPercent: number;
}

export interface DeletionEligibility {
  status: DeletionEligibilityStatus;
  /** True once the user has any project with launchedAt set. */
  everLaunched: boolean;
  /** LIVE campaigns block deletion outright and must be wound down first. */
  liveProjectCount: number;
  totalUnfulfilled: number;
  totalFulfilled: number;
  projects: LaunchedProjectSummary[];
  /** Set when status is BLOCKED — safe to show the user verbatim. */
  blockedReason: string | null;
  /** Set when status is REQUIRES_APPROVAL — why a person has to look first. */
  approvalReason: string | null;
  /** Payouts still due to the creator across finished campaigns. */
  owedToCreator: number;
  /** Money the creator owes back (open recoups + negative balances). */
  owedByCreator: number;
}

// A pledge counts as an outstanding obligation when the backer paid and the
// creator hasn't shipped. PENDING/FAILED/CANCELLED were never charged;
// REFUNDED and CHARGEBACK have had the money returned, so nothing is owed.
const OWED_PLEDGE_STATUS = "COMPLETED";
const UNFULFILLED_STATUSES = ["NOT_STARTED", "IN_PROGRESS"] as const;
const FULFILLED_STATUSES = ["SHIPPED", "DELIVERED"] as const;

export async function getDeletionEligibility(
  userId: string
): Promise<DeletionEligibility> {
  const launchedProjects = await db.project.findMany({
    where: { creatorId: userId, launchedAt: { not: null } },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      launchedAt: true,
      backerCount: true,
      deletedAt: true,
    },
    orderBy: { launchedAt: "desc" },
  });

  const everLaunched = launchedProjects.length > 0;

  // A running campaign blocks deletion regardless of fulfillment — there
  // are backers actively paying into it.
  const liveProjectCount = await db.project.count({
    where: {
      creatorId: userId,
      status: { in: ["LIVE", "PAUSED"] },
      deletedAt: null,
    },
  });

  if (!everLaunched) {
    return {
      status: liveProjectCount > 0 ? "BLOCKED" : "INSTANT",
      everLaunched: false,
      liveProjectCount,
      totalUnfulfilled: 0,
      totalFulfilled: 0,
      projects: [],
      blockedReason:
        liveProjectCount > 0
          ? "You have a campaign that is currently running. Cancel or finish it before deleting your account."
          : null,
      approvalReason: null,
      owedToCreator: 0,
      owedByCreator: 0,
    };
  }

  const projectIds = launchedProjects.map((p: { id: string }) => p.id);

  // Two grouped counts rather than loading every pledge — a launched
  // campaign can have thousands.
  const [unfulfilledRows, fulfilledRows] = await Promise.all([
    db.pledge.groupBy({
      by: ["projectId"],
      where: {
        projectId: { in: projectIds },
        status: OWED_PLEDGE_STATUS,
        deletedAt: null,
        fulfillmentStatus: { in: [...UNFULFILLED_STATUSES] },
      },
      _count: { _all: true },
    }),
    db.pledge.groupBy({
      by: ["projectId"],
      where: {
        projectId: { in: projectIds },
        status: OWED_PLEDGE_STATUS,
        deletedAt: null,
        fulfillmentStatus: { in: [...FULFILLED_STATUSES] },
      },
      _count: { _all: true },
    }),
  ]);

  type GroupRow = { projectId: string; _count: { _all: number } };
  const unfulfilledByProject = new Map<string, number>(
    (unfulfilledRows as GroupRow[]).map((r) => [r.projectId, r._count._all])
  );
  const fulfilledByProject = new Map<string, number>(
    (fulfilledRows as GroupRow[]).map((r) => [r.projectId, r._count._all])
  );

  let totalUnfulfilled = 0;
  let totalFulfilled = 0;

  const projects: LaunchedProjectSummary[] = launchedProjects.map(
    (p: {
      id: string;
      title: string;
      slug: string;
      status: string;
      launchedAt: Date | null;
      backerCount: number;
    }) => {
      const unfulfilledCount = unfulfilledByProject.get(p.id) ?? 0;
      const fulfilledCount = fulfilledByProject.get(p.id) ?? 0;
      totalUnfulfilled += unfulfilledCount;
      totalFulfilled += fulfilledCount;

      const owed = unfulfilledCount + fulfilledCount;
      return {
        id: p.id,
        title: p.title,
        slug: p.slug,
        status: p.status,
        launchedAt: p.launchedAt,
        backerCount: p.backerCount,
        fulfilledCount,
        unfulfilledCount,
        // A launched campaign that failed to fund has no completed pledges
        // and therefore owes nothing — that's 100%, not 0%.
        fulfillmentPercent:
          owed === 0 ? 100 : Math.round((fulfilledCount / owed) * 100),
      };
    }
  );

  // Money in either direction. Open recoups (a chargeback or overpaid
  // balance still being collected from the creator's card) and a negative
  // payout balance block deletion: the card goes with the account. Payouts
  // still due to the creator need a person to settle them first.
  const openRecoups = await db.chargebackRecoup.findMany({
    where: { creatorId: userId, status: { in: ["PENDING", "FAILED", "HELD_BACK"] } },
    select: { amount: true },
  });
  let owedByCreator = (openRecoups as { amount: unknown }[]).reduce((sum, r) => sum + Number(r.amount), 0);
  let owedToCreator = 0;
  const dcFunded = launchedProjects.filter(
    (p: { status: string; deletedAt: Date | null }) => p.status === "FUNDED" && !p.deletedAt
  );
  for (const p of dcFunded as { id: string }[]) {
    const balance = await loadDcProjectBalance(p.id).catch(() => null);
    if (!balance) continue; // not a DivinityCoin campaign
    if (balance.remainingAmount > 0.005) owedToCreator += balance.remainingAmount;
    else if (balance.remainingAmount < -0.005) owedByCreator += -balance.remainingAmount;
  }
  owedToCreator = Math.round(owedToCreator * 100) / 100;
  owedByCreator = Math.round(owedByCreator * 100) / 100;

  const base = {
    everLaunched: true,
    liveProjectCount,
    totalUnfulfilled,
    totalFulfilled,
    projects,
    approvalReason: null as string | null,
    owedToCreator,
    owedByCreator,
  };
  if (liveProjectCount > 0) {
    return {
      ...base,
      status: "BLOCKED",
      blockedReason:
        "You have a campaign that is currently running. Cancel or finish it before requesting account deletion.",
    };
  }
  if (totalUnfulfilled > 0) {
    return {
      ...base,
      status: "BLOCKED",
      blockedReason: `You still have ${totalUnfulfilled} unfulfilled ${
        totalUnfulfilled === 1 ? "backer" : "backers"
      } across your launched campaigns. Every backer must be marked shipped or delivered before you can request account deletion.`,
    };
  }
  if (owedByCreator > 0) {
    return {
      ...base,
      status: "BLOCKED",
      blockedReason: `You have an outstanding balance of $${owedByCreator.toFixed(2)} owed back to IndieCrowdfund from a chargeback or an overpaid payout. It must be settled before your account can be deleted. Email support@indiecrowdfund.com if you need help with it.`,
    };
  }
  if (owedToCreator > 0) {
    return {
      ...base,
      status: "REQUIRES_APPROVAL",
      blockedReason: null,
      approvalReason: `You are still owed $${owedToCreator.toFixed(2)} in campaign payouts. Deleting your account would forfeit that, so a member of our team will settle it with you first and then complete the deletion. Your account stays active until then.`,
    };
  }

  // Fulfilled, nothing owed either way: the creator may delete themselves.
  return {
    ...base,
    status: "INSTANT",
    blockedReason: null,
  };
}
