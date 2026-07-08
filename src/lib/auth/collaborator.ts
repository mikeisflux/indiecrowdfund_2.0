import { db } from "@/lib/db";

// Centralised project-access + collaborator-permission gate.
//
// Before this helper: every "creator" endpoint hand-rolled the same
// check, looking for `{ creatorId: userId } OR collaborators.some({
// userId, status: ACCEPTED })`. The ACCEPTED-only check granted every
// collaborator full power -- the per-permission flags on
// ProjectCollaborator (canEditProject, canManageCommunity,
// canCoordinateFulfillment, canConfigurePledgeManager) existed in the
// schema but were never consulted, so anyone who clicked "Accept" on
// an invite could mutate the addon catalogue mid-campaign or push fake
// fulfillment statuses.
//
// This helper:
//   - returns null if the user is neither owner nor accepted collaborator
//   - the owner always passes every permission check (they own the project)
//   - if the collaborator row has ALL FOUR permission flags set to false
//     it's treated as a "legacy" row from before per-perm enforcement,
//     and ALL permissions are granted. This preserves the prior
//     behaviour for every collaborator who existed before this change;
//     new invites set the explicit flags.
//   - otherwise it checks the requested permission against the row.
//
// Usage:
//   const access = await getProjectAccess(projectId, userId, "canEditProject");
//   if (!access) return NextResponse.json({ error: "Access denied" }, { status: 403 });

export type CollaboratorPermission =
  | "canEditProject"
  | "canManageCommunity"
  | "canCoordinateFulfillment"
  | "canConfigurePledgeManager";

export interface ProjectAccess {
  projectId: string;
  isOwner: boolean;
  // True iff the user has the requested permission. Callers should
  // generally treat absence of `granted` as 403; getProjectAccess()
  // returns null in that case so they don't have to check.
  granted: true;
  // Set when the user is a collaborator -- exposes their permission
  // flags so a screen can show "you can do X but not Y" hints.
  collaboratorPerms?: {
    canEditProject: boolean;
    canManageCommunity: boolean;
    canCoordinateFulfillment: boolean;
    canConfigurePledgeManager: boolean;
  };
}

export async function getProjectAccess(
  projectId: string,
  userId: string,
  requiredPermission: CollaboratorPermission
): Promise<ProjectAccess | null> {
  const project = await db.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: {
      id: true,
      creatorId: true,
      collaborators: {
        where: { userId, status: "ACCEPTED" },
        select: {
          canEditProject: true,
          canManageCommunity: true,
          canCoordinateFulfillment: true,
          canConfigurePledgeManager: true,
        },
        take: 1,
      },
    },
  });

  if (!project) return null;

  if (project.creatorId === userId) {
    return { projectId: project.id, isOwner: true, granted: true };
  }

  const collab = project.collaborators[0];
  if (!collab) return null;

  // Legacy row: all four perms are false. Before this helper existed,
  // these rows had implicit full access. Don't lock those users out.
  const legacyFull =
    !collab.canEditProject &&
    !collab.canManageCommunity &&
    !collab.canCoordinateFulfillment &&
    !collab.canConfigurePledgeManager;

  if (legacyFull || collab[requiredPermission]) {
    return {
      projectId: project.id,
      isOwner: false,
      granted: true,
      collaboratorPerms: {
        canEditProject: legacyFull ? true : collab.canEditProject,
        canManageCommunity: legacyFull ? true : collab.canManageCommunity,
        canCoordinateFulfillment: legacyFull ? true : collab.canCoordinateFulfillment,
        canConfigurePledgeManager: legacyFull ? true : collab.canConfigurePledgeManager,
      },
    };
  }

  return null;
}
