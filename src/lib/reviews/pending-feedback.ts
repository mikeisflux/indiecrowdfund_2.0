import { db } from "@/lib/db";

// Review feedback a creator has not yet seen.
//
// Rejecting or requesting changes resets the project to DRAFT and writes a
// ProjectReview row with the category and the reviewer's explanation. Until
// now that row was only ever read by the admin history tab; the creator got
// an email if the admin left the checkbox on, and otherwise saw a project
// that had silently gone back to draft. This is what the dashboard gate,
// the builder banner and the in-app notification read from.

export const REJECTION_REASON_LABELS: Record<string, string> = {
  INCOMPLETE_INFORMATION: "Incomplete information",
  POLICY_VIOLATION: "Policy violation",
  PROHIBITED_CONTENT: "Prohibited content",
  INTELLECTUAL_PROPERTY: "Intellectual property issue",
  FRAUD_SUSPECTED: "Suspected fraud",
  UNREALISTIC_GOALS: "Unrealistic goals",
  MISSING_REWARDS: "Missing or inadequate rewards",
  IDENTITY_VERIFICATION: "Identity verification required",
  OTHER: "Other",
};

/** What the creator should do about each category, in plain words. */
export const REJECTION_NEXT_STEPS: Record<string, string> = {
  INCOMPLETE_INFORMATION: "Fill in the missing sections the reviewer named, then resubmit.",
  POLICY_VIOLATION: "Read the Creator Terms, change the parts the reviewer pointed to, then resubmit.",
  PROHIBITED_CONTENT: "Remove or replace the content the reviewer named. Some content cannot be listed at all.",
  INTELLECTUAL_PROPERTY: "Remove material you don't own the rights to, or attach proof that you do, then resubmit.",
  FRAUD_SUSPECTED: "Contact support before resubmitting. The reviewer needs to verify details with you directly.",
  UNREALISTIC_GOALS: "Revisit the funding goal, timeline, or reward promises the reviewer flagged, then resubmit.",
  MISSING_REWARDS: "Add reward tiers with clear descriptions, prices, and delivery estimates, then resubmit.",
  IDENTITY_VERIFICATION: "Complete identity verification in your account settings, then resubmit.",
  OTHER: "Address the feedback below, then resubmit.",
};

export interface PendingReviewFeedback {
  reviewId: string;
  projectId: string;
  projectTitle: string;
  editUrl: string;
  action: "REJECTED" | "REQUESTED_CHANGES";
  rejectionReason: string | null;
  reasonLabel: string | null;
  nextStep: string;
  notes: string | null;
  reviewedAt: Date;
  acknowledgedAt: Date | null;
}

/**
 * Latest rejection / changes-requested review for each of the creator's
 * projects that is still in DRAFT and hasn't been resubmitted since.
 *
 * `includeAcknowledged` returns feedback the creator has already dismissed
 * from the gate, so the builder can keep showing it while they fix things.
 */
export async function pendingReviewFeedback(
  userId: string,
  opts: { includeAcknowledged?: boolean; projectId?: string } = {}
): Promise<PendingReviewFeedback[]> {
  const projects = await db.project.findMany({
    where: {
      creatorId: userId,
      deletedAt: null,
      status: "DRAFT",
      ...(opts.projectId ? { id: opts.projectId } : {}),
    },
    select: {
      id: true,
      title: true,
      slug: true,
      creator: { select: { vanityUrl: true } },
    },
  });
  if (projects.length === 0) return [];

  // Newest review per project; only a rejection / changes request that is
  // the most recent action counts. A later SUBMITTED / APPROVED row means
  // the creator already acted on it.
  const reviews = await db.projectReview.findMany({
    where: { projectId: { in: projects.map((p) => p.id) } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      projectId: true,
      action: true,
      rejectionReason: true,
      notes: true,
      createdAt: true,
      acknowledgedAt: true,
    },
  });
  const latestByProject = new Map<string, (typeof reviews)[number]>();
  for (const r of reviews) {
    if (!latestByProject.has(r.projectId)) latestByProject.set(r.projectId, r);
  }

  const out: PendingReviewFeedback[] = [];
  for (const p of projects) {
    const r = latestByProject.get(p.id);
    if (!r) continue;
    if (r.action !== "REJECTED" && r.action !== "REQUESTED_CHANGES") continue;
    if (r.acknowledgedAt && !opts.includeAcknowledged) continue;
    const reason = r.rejectionReason ?? null;
    out.push({
      reviewId: r.id,
      projectId: p.id,
      projectTitle: p.title,
      editUrl: p.creator.vanityUrl
        ? `/projects/${p.creator.vanityUrl}/${p.slug}/edit`
        : `/projects/${p.slug}/edit`,
      action: r.action,
      rejectionReason: reason,
      reasonLabel: reason ? REJECTION_REASON_LABELS[reason] || reason : null,
      nextStep: reason
        ? REJECTION_NEXT_STEPS[reason] || REJECTION_NEXT_STEPS.OTHER
        : "Make the changes the reviewer asked for below, then resubmit for review.",
      notes: r.notes ?? null,
      reviewedAt: r.createdAt,
      acknowledgedAt: r.acknowledgedAt ?? null,
    });
  }
  return out;
}
