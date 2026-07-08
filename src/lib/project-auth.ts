import { db } from "@/lib/db";

/**
 * Check if a user can edit a project.
 * Returns true if the user is either:
 * 1. The project creator
 * 2. An accepted collaborator with canEditProject permission
 */
export async function canUserEditProject(
  projectId: string,
  userId: string,
  creatorId: string
): Promise<boolean> {
  // Check if user is the creator
  if (creatorId === userId) {
    return true;
  }

  // Check if user is an accepted collaborator with edit permission
  const collaborator = await db.projectCollaborator.findFirst({
    where: {
      projectId,
      userId,
      status: "ACCEPTED",
      canEditProject: true,
    },
  });

  return !!collaborator;
}

