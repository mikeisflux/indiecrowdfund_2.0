import { db } from "@/lib/db";

// Who may delete their own account, and how.
//
// Three outcomes:
//   INSTANT  — backers and creators who never took a campaign live. The
//              existing self-serve flow deletes immediately.
//   REQUIRES_APPROVAL — the creator has launched at least one campaign and
//              everything on it is fulfilled. They may submit a request; an
//              admin approves before anything is destroyed.
//   BLOCKED  — the creator has launched and still owes fulfillment on any
//              backer. Deleting would release them from those obligations,
//              so it isn't offered at all until the number reaches zero.
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

  if (liveProjectCount > 0) {
    return {
      status: "BLOCKED",
      everLaunched: true,
      liveProjectCount,
      totalUnfulfilled,
      totalFulfilled,
      projects,
      blockedReason:
        "You have a campaign that is currently running. Cancel or finish it before requesting account deletion.",
    };
  }

  if (totalUnfulfilled > 0) {
    return {
      status: "BLOCKED",
      everLaunched: true,
      liveProjectCount,
      totalUnfulfilled,
      totalFulfilled,
      projects,
      blockedReason: `You still have ${totalUnfulfilled} unfulfilled ${
        totalUnfulfilled === 1 ? "backer" : "backers"
      } across your launched campaigns. Every backer must be marked shipped or delivered before you can request account deletion.`,
    };
  }

  return {
    status: "REQUIRES_APPROVAL",
    everLaunched: true,
    liveProjectCount,
    totalUnfulfilled,
    totalFulfilled,
    projects,
    blockedReason: null,
  };
}
