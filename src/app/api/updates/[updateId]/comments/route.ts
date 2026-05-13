import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { db } from "@/lib/db";
import { validateSession } from "@/lib/auth/session";
import { stripHtml } from "@/lib/utils/sanitize";

const log = logger.child({ module: "update-comments" });

/**
 * Per-update comment thread. The Comment model already supports
 * `updateId` (sibling of `projectId`) — this route just exposes a
 * GET / POST pair so the public Updates tab can render and append
 * comments to a specific Update instead of the project as a whole.
 *
 * Auth gate is identical to /api/projects/[id]/comments:
 *   - GET is public
 *   - POST allows the project creator, accepted collaborators,
 *     any committed backer (COMPLETED or PENDING with a commit
 *     marker like nmiCustomerVaultId / confirmationEmailSent /
 *     stripePaymentMethodId), and any project follower
 */

async function isBackerOrFollower(userId: string, projectId: string): Promise<boolean> {
  const [pledge, follower] = await Promise.all([
    db.pledge.findFirst({
      where: {
        userId,
        deletedAt: null,
        projectId,
        OR: [
          { status: "COMPLETED" },
          { status: "PENDING", confirmationEmailSent: true },
          { status: "PENDING", NOT: { nmiCustomerVaultId: null } },
        ],
      },
      select: { id: true },
    }),
    db.projectFollower.findFirst({
      where: { userId, projectId },
      select: { id: true },
    }),
  ]);
  return !!pledge || !!follower;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ updateId: string }> }
) {
  try {
    const { updateId } = await params;
    if (!updateId) {
      return NextResponse.json({ error: "updateId required" }, { status: 400 });
    }

    // Verify the update exists + return the parent projectId so
    // clients know which project the comment thread belongs to.
    const update = await db.update.findFirst({
      where: { id: updateId, status: "PUBLISHED" },
      select: { id: true, projectId: true },
    });
    if (!update) {
      return NextResponse.json({ comments: [] });
    }

    const rows = await db.comment.findMany({
      where: { updateId },
      orderBy: { createdAt: "asc" },
      include: {
        user: { select: { id: true, name: true, image: true } },
      },
    });

    // Flatten into top-level + replies the same way the project
    // comments handler does — keep the response shape consistent so
    // the same client code renders both.
    type Row = (typeof rows)[number];
    const byParent = new Map<string | null, Row[]>();
    for (const r of rows) {
      const arr = byParent.get(r.parentId) || [];
      arr.push(r);
      byParent.set(r.parentId, arr);
    }

    const formatBase = (r: Row) => ({
      id: r.id,
      userId: r.userId,
      author: r.user.name || "Anonymous",
      avatarUrl: r.user.image,
      content: r.content,
      createdAt: r.createdAt.toISOString(),
      parentId: r.parentId,
    });

    const tops = byParent.get(null) || [];
    const comments = tops.map((t) => ({
      ...formatBase(t),
      replies: (byParent.get(t.id) || []).map(formatBase),
    }));

    return NextResponse.json({
      comments,
      projectId: update.projectId,
    });
  } catch (err) {
    log.error({ err: String(err) }, "GET error");
    return NextResponse.json({ error: "Failed to load comments" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ updateId: string }> }
) {
  try {
    const session = await validateSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { updateId } = await params;
    const body = await req.json().catch(() => ({}));
    const content = typeof body?.content === "string" ? body.content : "";
    const parentId =
      typeof body?.parentId === "string" && body.parentId.trim() ? body.parentId.trim() : null;

    if (!content.trim()) {
      return NextResponse.json({ error: "Comment cannot be empty" }, { status: 400 });
    }
    if (content.length > 5000) {
      return NextResponse.json({ error: "Comment too long" }, { status: 400 });
    }

    const update = await db.update.findFirst({
      where: { id: updateId, status: "PUBLISHED" },
      select: { id: true, projectId: true, title: true },
    });
    if (!update || !update.projectId) {
      return NextResponse.json({ error: "Update not found" }, { status: 404 });
    }

    const project = await db.project.findFirst({
      where: { id: update.projectId, deletedAt: null },
      select: { id: true, creatorId: true },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const isCreator = project.creatorId === session.user.id;
    let isCollaborator = false;
    if (!isCreator) {
      const collab = await db.projectCollaborator.findFirst({
        where: { projectId: project.id, userId: session.user.id, status: "ACCEPTED" },
        select: { id: true },
      });
      isCollaborator = !!collab;
    }

    if (!isCreator && !isCollaborator) {
      const allowed = await isBackerOrFollower(session.user.id, project.id);
      if (!allowed) {
        return NextResponse.json(
          { error: "Back or follow this project to comment on updates" },
          { status: 403 }
        );
      }
    }

    // If parentId is supplied, flatten replies-of-replies to the
    // root so all replies sit at one level of nesting. Same UX as
    // the project comments handler.
    let actualParentId: string | null = parentId;
    if (parentId) {
      const parent = await db.comment.findFirst({
        where: { id: parentId, updateId },
        select: { id: true, parentId: true },
      });
      if (!parent) {
        return NextResponse.json({ error: "Parent comment not found" }, { status: 404 });
      }
      actualParentId = parent.parentId || parent.id;
    }

    // Set updateId only — NOT projectId. The existing project comments
    // list at /api/projects/[id]/comments filters by `projectId` with
    // no updateId guard, so storing both would mix every update-thread
    // comment into the main Comments tab. Keep the two threads cleanly
    // separated by storing exactly one of {projectId, updateId} per row.
    const created = await db.comment.create({
      data: {
        updateId,
        userId: session.user.id,
        content: stripHtml(content.trim()),
        parentId: actualParentId,
      },
      include: { user: { select: { id: true, name: true, image: true } } },
    });

    return NextResponse.json({
      id: created.id,
      userId: created.userId,
      author: created.user.name || "Anonymous",
      avatarUrl: created.user.image,
      content: created.content,
      createdAt: created.createdAt.toISOString(),
      parentId: created.parentId,
    });
  } catch (err) {
    log.error({ err: String(err) }, "POST error");
    return NextResponse.json({ error: "Failed to post comment" }, { status: 500 });
  }
}
