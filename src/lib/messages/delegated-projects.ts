import { db } from "@/lib/db";

/**
 * Campaigns whose message inbox a user shares with the owner.
 *
 * A campaign's messages are addressed to a user id — `Message.recipientId` is
 * the creator, not the project — so before this the only way for anyone else
 * to answer a backer was to log in as the creator. Creators who are busy
 * elsewhere simply miss messages.
 *
 * `canManageCommunity` is the permission that already means "talk to backers
 * on my behalf": it is what gates the community tools in the People step. It
 * had no effect on the inbox, which is the one place community management
 * actually happens. This closes that gap rather than inventing a new
 * permission for it.
 *
 * ACCEPTED only. A PENDING collaborator is an invitation that has been sent to
 * an email address and not yet claimed, so honouring it would hand a campaign's
 * backer correspondence to whoever typed that address in.
 *
 * Scoped to project-attached messages by design. Creator-inbox email
 * (`Message.projectId` null, from external senders) is the creator's own mail
 * and stays with them.
 */
export async function getDelegatedProjectIds(userId: string): Promise<string[]> {
  const rows = await db.projectCollaborator.findMany({
    where: {
      userId,
      status: "ACCEPTED",
      canManageCommunity: true,
      project: { deletedAt: null },
    },
    select: { projectId: true },
  });
  return (rows as { projectId: string }[]).map((r) => r.projectId);
}

/**
 * The creator behind each delegated campaign.
 *
 * Needed to work out who the *other* party in a thread is. The usual rule —
 * "whoever isn't me" — breaks on a shared inbox, because neither end of a
 * message between the owner and a backer is the person reading it, and the
 * thread would file itself under the owner's own name instead of the backer's.
 */
export async function getDelegatedProjectCreators(
  projectIds: string[]
): Promise<Map<string, string>> {
  if (projectIds.length === 0) return new Map();
  const projects = await db.project.findMany({
    where: { id: { in: projectIds } },
    select: { id: true, creatorId: true },
  });
  return new Map(projects.map((p) => [p.id, p.creatorId]));
}
