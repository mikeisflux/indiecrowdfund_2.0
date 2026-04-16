import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const backerCollectionsLogger = logger.child({ module: "backer-collections" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// GET: Get single collection with projects
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const { id } = await params;

    const collection = await db.projectCollection.findFirst({
      where: {
        id,
        OR: [
          { userId: session.user.id },
          { isPublic: true },
        ],
      },
      include: {
        user: {
          select: { name: true, image: true },
        },
        projects: {
          include: {
            project: {
              select: {
                id: true,
                title: true,
                slug: true,
                description: true,
                imageUrl: true,
                status: true,
                currentAmount: true,
                goalAmount: true,
                endDate: true,
                category: true,
                creator: {
                  select: { name: true, image: true },
                },
              },
            },
          },
          orderBy: { addedAt: "desc" },
        },
      },
    });

    if (!collection) {
      return NextResponse.json(
        { error: "Collection not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    const isOwner = collection.userId === session.user.id;

    return NextResponse.json({
      collection: {
        id: collection.id,
        name: collection.name,
        description: collection.description,
        isPublic: collection.isPublic,
        color: collection.color,
        isOwner,
        owner: {
          name: collection.user.name,
          image: collection.user.image,
        },
        projects: collection.projects.map((item: typeof collection.projects[0]) => ({
          id: item.project.id,
          title: item.project.title,
          slug: item.project.slug,
          description: item.project.description,
          imageUrl: item.project.imageUrl,
          status: item.project.status,
          currentAmount: Number(item.project.currentAmount),
          goalAmount: Number(item.project.goalAmount),
          percentFunded: Number(item.project.goalAmount) > 0
            ? Math.round((Number(item.project.currentAmount) / Number(item.project.goalAmount)) * 100)
            : 0,
          endDate: item.project.endDate,
          category: item.project.category,
          creatorName: item.project.creator.name,
          addedAt: item.addedAt,
          notes: item.notes,
        })),
        createdAt: collection.createdAt,
        updatedAt: collection.updatedAt,
      },
    }, { headers: corsHeaders });
  } catch (error) {
    backerCollectionsLogger.error({ err: String(error) }, "Error fetching collection:");
    return NextResponse.json(
      { error: "Failed to fetch collection" },
      { status: 500, headers: corsHeaders }
    );
  }
}

// PATCH: Update collection or remove project
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    // Verify ownership
    const collection = await db.projectCollection.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!collection) {
      return NextResponse.json(
        { error: "Collection not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    if (action === "update") {
      const { name, description, isPublic, color } = body;

      const updated = await db.projectCollection.update({
        where: { id },
        data: {
          ...(name !== undefined && { name: name.trim() }),
          ...(description !== undefined && { description: description?.trim() || null }),
          ...(isPublic !== undefined && { isPublic }),
          ...(color !== undefined && { color }),
        },
      });

      return NextResponse.json({ collection: updated }, { headers: corsHeaders });
    } else if (action === "removeProject") {
      const { projectId } = body;

      await db.projectCollectionItem.deleteMany({
        where: { collectionId: id, projectId },
      });

      return NextResponse.json({ success: true }, { headers: corsHeaders });
    } else if (action === "updateNote") {
      const { projectId, notes } = body;

      await db.projectCollectionItem.updateMany({
        where: { collectionId: id, projectId },
        data: { notes: notes?.trim() || null },
      });

      return NextResponse.json({ success: true }, { headers: corsHeaders });
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400, headers: corsHeaders }
    );
  } catch (error) {
    backerCollectionsLogger.error({ err: String(error) }, "Error updating collection:");
    return NextResponse.json(
      { error: "Failed to update collection" },
      { status: 500, headers: corsHeaders }
    );
  }
}

// DELETE: Delete collection
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const { id } = await params;

    // Scoped delete via deleteMany — enforces ownership AND resolves
    // concurrent double-clicks as { count: 0 } instead of P2025.
    // Cascade-deletes items via the FK relation.
    const deleted = await db.projectCollection.deleteMany({
      where: { id, userId: session.user.id },
    });

    if (deleted.count === 0) {
      return NextResponse.json(
        { error: "Collection not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    backerCollectionsLogger.error({ err: String(error) }, "Error deleting collection:");
    return NextResponse.json(
      { error: "Failed to delete collection" },
      { status: 500, headers: corsHeaders }
    );
  }
}
