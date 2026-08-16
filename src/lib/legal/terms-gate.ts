import { db } from "@/lib/db";
import { TERMS_VERSION } from "@/components/legal/terms-of-service";

// Who has to accept the Terms, and whether they already have.
//
// "Creator" here means anyone who has started a project — a draft counts. The
// alternative, User.role === "CREATOR", is set by other flows and would both
// miss people who have a draft but no role and catch people who have never
// built anything. Owning a project is the fact that matters, so it is the test.
//
// One module so the dashboard gate and the project-creation endpoint cannot
// drift into disagreeing about who is blocked.

/** True when this user owns at least one project, drafts included. */
export async function isCreator(userId: string): Promise<boolean> {
  const project = await db.project.findFirst({
    where: { creatorId: userId, deletedAt: null },
    select: { id: true },
  });
  return !!project;
}

/** True when this user has accepted the current Terms version. */
export async function hasAcceptedCurrentTerms(userId: string): Promise<boolean> {
  const acceptance = await db.termsAcceptance.findFirst({
    where: { userId, version: TERMS_VERSION },
    select: { id: true },
  });
  return !!acceptance;
}

/**
 * Whether to block this user until they accept.
 *
 * Deliberately fails OPEN. A database hiccup here would otherwise lock every
 * creator out of their own dashboard mid-campaign, which is a far worse outcome
 * than a missed prompt — they will be asked again on the next page load.
 */
export async function needsTermsAcceptance(userId: string): Promise<boolean> {
  try {
    if (!(await isCreator(userId))) return false;
    return !(await hasAcceptedCurrentTerms(userId));
  } catch {
    return false;
  }
}
