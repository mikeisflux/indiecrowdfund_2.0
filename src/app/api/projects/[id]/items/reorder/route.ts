import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { formatError } from "@/lib/errors";
import { z } from "zod";

const log = logger.child({ module: "projects-items-reorder" });

const bodySchema = z.object({
  // Ordered item ids as the creator arranged them. Sets displayOrder to the
  // array index; ids not in the list are left untouched.
  itemIds: z.array(z.string()).min(1).max(500),
});

// POST /api/projects/[id]/items/reorder — persist the creator's chosen order
// for project items. Mirrors the rewards reorder route; without it the Items
// tab's drag order and sort choice were client-only and lost on reload.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id: projectId } = await params;

    let body: z.infer<typeof bodySchema>;
    try {
      body = bodySchema.parse(await req.json());
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    // Ownership: creator or an accepted collaborator with edit permission.
    const project = await db.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { creatorId: true },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    let canEdit = project.creatorId === session.user.id;
    if (!canEdit) {
      const collaborator = await db.projectCollaborator.findFirst({
        where: { projectId, userId: session.user.id, status: "ACCEPTED", canEditProject: true },
        select: { id: true },
      });
      canEdit = !!collaborator;
    }
    if (!canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Only reorder items that actually belong to this project (ignore any
    // stray/unsaved ids the client may include).
    const owned = await db.projectItem.findMany({
      where: { id: { in: body.itemIds }, projectId },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map((i: { id: string }) => i.id));

    const updates = body.itemIds
      .filter((id) => ownedIds.has(id))
      .map((id, index) =>
        db.projectItem.update({ where: { id }, data: { displayOrder: index } })
      );

    if (updates.length > 0) {
      await db.$transaction(updates);
    }

    return NextResponse.json({ success: true, reordered: updates.length });
  } catch (error) {
    log.error({ err: formatError(error) }, "item reorder failed");
    return NextResponse.json({ error: "Failed to reorder items" }, { status: 500 });
  }
}
