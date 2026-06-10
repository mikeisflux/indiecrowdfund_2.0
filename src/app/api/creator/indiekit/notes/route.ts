import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const creatorIndiekitNotesLogger = logger.child({ module: "creator-indiekit-notes" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProjectAccess } from "@/lib/auth/collaborator";
import { z } from "zod";

export const dynamic = "force-dynamic";

const noteSchema = z.object({
  pledgeId: z.string(),
  content: z.string().min(1).max(10000),
  isInternal: z.boolean().default(true),
});

// GET - Get notes for a pledge
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const pledgeId = searchParams.get("pledgeId");

    if (!pledgeId) {
      return NextResponse.json({ error: "Pledge ID required" }, { status: 400 });
    }

    // Verify access via pledge's project
    const pledge = await db.pledge.findFirst({ where: { id: pledgeId, deletedAt: null },
      include: {
        project: {
          select: { creatorId: true },
        },
      },
    });

    if (!pledge) {
      return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
    }

    // Backer notes are a community / fulfillment surface, so allow
    // either canManageCommunity OR canCoordinateFulfillment perms.
    // Owner + legacy collaborators auto-pass; new restricted
    // collaborators (e.g. canEditProject-only) are blocked from
    // writing/reading backer notes.
    if (pledge.project.creatorId !== session.user.id) {
      const access =
        (await getProjectAccess(pledge.projectId, session.user.id, "canManageCommunity")) ||
        (await getProjectAccess(pledge.projectId, session.user.id, "canCoordinateFulfillment"));
      if (!access) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    }

    const notes = await db.backerNote.findMany({
      where: { pledgeId },
      include: {
        createdBy: {
          select: { name: true, email: true, image: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    type NoteType = { id: string; content: string; isInternal: boolean; createdAt: Date; createdBy: { name: string | null; email: string | null; image: string | null } | null };
    const formattedNotes = notes.map((note: NoteType) => ({
      id: note.id,
      content: note.content,
      isInternal: note.isInternal,
      createdAt: note.createdAt.toISOString(),
      createdBy: note.createdBy
        ? {
            name: note.createdBy.name,
            email: note.createdBy.email,
            image: note.createdBy.image,
          }
        : null,
    }));

    return NextResponse.json({ notes: formattedNotes });
  } catch (error) {
    creatorIndiekitNotesLogger.error({ err: formatError(error) }, "IndieKit notes fetch error:");
    return NextResponse.json(
      { error: "Failed to fetch notes" },
      { status: 500 }
    );
  }
}

// POST - Create a new note
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = noteSchema.parse(body);

    // Verify access via pledge's project
    const pledge = await db.pledge.findFirst({
      where: { id: validatedData.pledgeId, deletedAt: null },
      include: {
        project: {
          select: { id: true, creatorId: true },
        },
      },
    });

    if (!pledge) {
      return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
    }

    // Backer notes are a community / fulfillment surface, so allow
    // either canManageCommunity OR canCoordinateFulfillment perms.
    // Owner + legacy collaborators auto-pass; new restricted
    // collaborators (e.g. canEditProject-only) are blocked from
    // writing/reading backer notes.
    if (pledge.project.creatorId !== session.user.id) {
      const access =
        (await getProjectAccess(pledge.projectId, session.user.id, "canManageCommunity")) ||
        (await getProjectAccess(pledge.projectId, session.user.id, "canCoordinateFulfillment"));
      if (!access) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    }

    const note = await db.backerNote.create({
      data: {
        pledgeId: validatedData.pledgeId,
        content: validatedData.content,
        isInternal: validatedData.isInternal,
        createdById: session.user.id,
      },
      include: {
        createdBy: {
          select: { name: true, email: true, image: true },
        },
      },
    });

    // Log activity
    await db.fulfillmentActivity.create({
      data: {
        projectId: pledge.project.id,
        type: "NOTE_ADDED",
        title: "Note added to backer",
        pledgeId: validatedData.pledgeId,
        userId: session.user.id,
      },
    });

    return NextResponse.json({
      note: {
        id: note.id,
        content: note.content,
        isInternal: note.isInternal,
        createdAt: note.createdAt.toISOString(),
        createdBy: note.createdBy
          ? {
              name: note.createdBy.name,
              email: note.createdBy.email,
              image: note.createdBy.image,
            }
          : null,
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ');
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
    creatorIndiekitNotesLogger.error({ err: formatError(error) }, "IndieKit note create error:");
    return NextResponse.json(
      { error: "Failed to create note" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a note
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const noteId = searchParams.get("noteId");

    if (!noteId) {
      return NextResponse.json({ error: "Note ID required" }, { status: 400 });
    }

    // Scoped delete via deleteMany — enforces ownership in the WHERE and
    // resolves concurrent double-clicks as { count: 0 } instead of P2025.
    const deleted = await db.backerNote.deleteMany({
      where: { id: noteId, createdById: session.user.id },
    });

    if (deleted.count === 0) {
      // Either the note doesn't exist, is not owned by this user, or was
      // already deleted by a concurrent request — all three collapse to
      // the same "nothing to delete" response.
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    creatorIndiekitNotesLogger.error({ err: formatError(error) }, "IndieKit note delete error:");
    return NextResponse.json(
      { error: "Failed to delete note" },
      { status: 500 }
    );
  }
}
