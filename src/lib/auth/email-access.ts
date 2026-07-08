/**
 * Server-side email access control.
 * Access is granted if the user:
 *   - Is a SUPER_ADMIN, OR
 *   - Has at least one approved/active prelaunch page or approved campaign, OR
 *   - Has ever had a prior campaign (any project that progressed past DRAFT/SUBMITTED)
 *
 * Once a creator has had at least one campaign they retain email access in perpetuity.
 */

import { db } from "@/lib/db";

export async function checkEmailAccess(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (user?.role === "SUPER_ADMIN") {
    return { allowed: true };
  }

  const eligibleProject = await db.project.findFirst({
    where: {
      deletedAt: null,
      AND: [
        {
          OR: [
            { creatorId: userId },
            { collaborators: { some: { userId, status: "ACCEPTED" } } },
          ],
        },
        {
          OR: [
            // Currently approved, live, or funded
            { status: { in: ["APPROVED", "LIVE", "FUNDED"] } },
            // Approved or active prelaunch page
            { prelaunchStatus: "APPROVED" },
            { prelaunchActive: true },
            // Prior campaigns (launched at some point) — grants perpetual access
            { status: { in: ["PAUSED", "FAILED", "CANCELLED"] } },
          ],
        },
      ],
    },
    select: { id: true },
  });

  if (!eligibleProject) {
    return {
      allowed: false,
      reason: "Email access requires an approved project or prelaunch page",
    };
  }

  return { allowed: true };
}
