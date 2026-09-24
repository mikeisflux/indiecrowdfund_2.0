import { db } from "@/lib/db";

/**
 * Resolve the pledges a backer segment covers. One implementation,
 * shared by the segment-backers listing and segment emailing — the
 * criteria semantics must never drift between "who you see" and "who
 * gets the email".
 */
export async function resolveSegmentPledges(segmentId: string, projectId: string) {
  const segment = await db.backerSegment.findFirst({
    where: { id: segmentId, projectId },
  });
  if (!segment) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const whereClause: any = {
    projectId,
    deletedAt: null,
    OR: [
      { status: "COMPLETED" },
      { status: "PENDING", confirmationEmailSent: true },
    ],
  };

  if (!segment.isDynamic && segment.staticBackerIds.length > 0) {
    whereClause.id = { in: segment.staticBackerIds };
  } else if (segment.isDynamic && segment.criteria) {
    const criteria = segment.criteria as { field?: string; operator?: string; value?: unknown };

    if (criteria.field === "pledgeAmount" && criteria.operator && criteria.value != null) {
      const amount = Number(criteria.value);
      switch (criteria.operator) {
        case ">=": whereClause.amount = { gte: amount }; break;
        case "<=": whereClause.amount = { lte: amount }; break;
        case ">": whereClause.amount = { gt: amount }; break;
        case "<": whereClause.amount = { lt: amount }; break;
        case "=": whereClause.amount = amount; break;
      }
    }
    if (criteria.field === "rewardId" && criteria.value) {
      whereClause.rewardId = criteria.value;
    }
    if (criteria.field === "surveyCompleted") {
      whereClause.surveyCompleted = criteria.value === true || criteria.value === "true";
    }
    if (criteria.field === "country" && criteria.value) {
      whereClause.shippingAddress = { path: ["country"], equals: criteria.value };
    }
  }

  const pledges = await db.pledge.findMany({
    where: whereClause,
    include: {
      user: { select: { name: true, email: true } },
      reward: { select: { title: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return { segment, pledges };
}
