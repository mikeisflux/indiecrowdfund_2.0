/**
 * Server-side email access control.
 * Only SUPER_ADMIN or users with at least one approved/prelaunch-approved project
 * can access email features (create campaigns, send emails, etc.).
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

  const approvedProject = await db.project.findFirst({
    where: {
      AND: [
        {
          OR: [
            { creatorId: userId },
            { collaborators: { some: { userId, status: "ACCEPTED" } } },
          ],
        },
        {
          OR: [
            { status: { in: ["APPROVED", "LIVE", "FUNDED"] } },
            { prelaunchStatus: "APPROVED" },
          ],
        },
      ],
    },
    select: { id: true },
  });

  if (!approvedProject) {
    return {
      allowed: false,
      reason: "Email access requires an approved project or prelaunch page",
    };
  }

  return { allowed: true };
}
