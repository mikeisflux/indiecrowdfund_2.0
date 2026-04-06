import { db } from "@/lib/db";

export interface ProjectPermission {
  canEdit: boolean;
  isCreator: boolean;
  isCollaborator: boolean;
  projectStatus: string;
  isLaunched: boolean;
}

/**
 * Check if a user has permission to edit a project
 * Returns detailed permission info including whether they are creator or collaborator
 */
export async function checkProjectEditPermission(
  projectId: string,
  userId: string
): Promise<{ allowed: false; error: string; status: number } | { allowed: true; permission: ProjectPermission }> {
  const project = await db.project.findFirst({ where: { id: projectId, deletedAt: null },
    select: { creatorId: true, status: true, prelaunchStatus: true },
  });

  if (!project) {
    return { allowed: false, error: "Project not found", status: 404 };
  }

  const isCreator = project.creatorId === userId;
  let isCollaborator = false;

  if (!isCreator) {
    const collaborator = await db.projectCollaborator.findFirst({
      where: {
        projectId,
        userId,
        status: "ACCEPTED",
        canEditProject: true,
      },
    });
    isCollaborator = !!collaborator;
  }

  const canEdit = isCreator || isCollaborator;

  if (!canEdit) {
    return { allowed: false, error: "Forbidden", status: 403 };
  }

  const isLaunched = ["LIVE", "FUNDED", "PAUSED"].includes(project.status);

  return {
    allowed: true,
    permission: {
      canEdit,
      isCreator,
      isCollaborator,
      projectStatus: project.status,
      isLaunched,
    },
  };
}

/**
 * Check if a user has had a successful (funded + fulfilled) campaign
 */
export async function hasSuccessfulCampaign(userId: string): Promise<boolean> {
  const fundedProjects = await db.project.findMany({
    where: {
      creatorId: userId,
      OR: [
        { status: "FUNDED" },
        {
          status: { in: ["LIVE", "FUNDED"] },
        },
      ],
    },
    select: {
      id: true,
      currentAmount: true,
      goalAmount: true,
    },
  });

  const projectsThatReachedGoal = fundedProjects.filter(
    (p) => Number(p.currentAmount) >= Number(p.goalAmount)
  );

  if (projectsThatReachedGoal.length === 0) {
    return false;
  }

  for (const project of projectsThatReachedGoal) {
    const pledges = await db.pledge.findMany({
      where: {
        projectId: project.id,
        status: "COMPLETED",
      },
      select: {
        fulfillmentStatus: true,
      },
    });

    if (pledges.length === 0) {
      continue;
    }

    const deliveredCount = pledges.filter(
      (p) => p.fulfillmentStatus === "DELIVERED"
    ).length;
    const fulfillmentPercentage = (deliveredCount / pledges.length) * 100;

    if (fulfillmentPercentage >= 85) {
      return true;
    }
  }

  return false;
}

/**
 * Check if user can activate prelaunch without approval
 */
export async function canActivatePrelaunchImmediately(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!user) {
    return false;
  }

  if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
    return true;
  }

  if (user.role === "COOL_KIDS") {
    return true;
  }

  return await hasSuccessfulCampaign(userId);
}
