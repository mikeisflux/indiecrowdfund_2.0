import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const backerCollectionsLogger = logger.child({ module: "backer-collections" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// GET: Get all user collections with projects
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const collections = await db.projectCollection.findMany({
      where: { userId: session.user.id },
      include: {
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
      orderBy: { updatedAt: "desc" },
    });

    // Transform data for frontend
    const transformedCollections = collections.map((collection: typeof collections[0]) => ({
      id: collection.id,
      name: collection.name,
      description: collection.description,
      isPublic: collection.isPublic,
      color: collection.color,
      projectCount: collection.projects.length,
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
        creatorImage: item.project.creator.image,
        addedAt: item.addedAt,
        notes: item.notes,
      })),
      createdAt: collection.createdAt,
      updatedAt: collection.updatedAt,
    }));

    return NextResponse.json({
      collections: transformedCollections,
      totalCollections: collections.length,
      totalProjects: collections.reduce((sum: number, c: typeof collections[0]) => sum + c.projects.length, 0),
    }, { headers: corsHeaders });
  } catch (error) {
    backerCollectionsLogger.error({ err: formatError(error) }, "Error fetching collections:");
    return NextResponse.json(
      { error: "Failed to fetch collections" },
      { status: 500, headers: corsHeaders }
    );
  }
}

// POST: Create a new collection or add project to collection
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const body = await request.json();
    const { action } = body;

    if (action === "create") {
      // Create new collection
      const { name, description, isPublic, color } = body;

      if (!name || name.trim().length === 0) {
        return NextResponse.json(
          { error: "Collection name is required" },
          { status: 400, headers: corsHeaders }
        );
      }

      const collection = await db.projectCollection.create({
        data: {
          userId: session.user.id,
          name: name.trim(),
          description: description?.trim() || null,
          isPublic: isPublic || false,
          color: color || null,
        },
      });

      return NextResponse.json({ collection }, { headers: corsHeaders });
    } else if (action === "addProject") {
      // Add project to collection
      const { collectionId, projectId, notes } = body;

      if (!collectionId || !projectId) {
        return NextResponse.json(
          { error: "Collection ID and Project ID are required" },
          { status: 400, headers: corsHeaders }
        );
      }

      // Verify collection belongs to user
      const collection = await db.projectCollection.findFirst({
        where: { id: collectionId, userId: session.user.id },
      });

      if (!collection) {
        return NextResponse.json(
          { error: "Collection not found" },
          { status: 404, headers: corsHeaders }
        );
      }

      // Verify the project exists
      const projectExists = await db.project.findFirst({
        where: { id: projectId , deletedAt: null },
        select: { id: true },
      });
      if (!projectExists) {
        return NextResponse.json(
          { error: "Project not found" },
          { status: 404, headers: corsHeaders }
        );
      }

      // Attempt to create the collection item directly and catch P2002
      // on the @@unique([collectionId, projectId]) constraint instead of
      // a findFirst→create TOCTOU pattern.
      let item;
      try {
        item = await db.projectCollectionItem.create({
          data: {
            collectionId,
            projectId,
            notes: notes?.trim() || null,
          },
          include: {
            project: {
              select: {
                id: true,
                title: true,
                slug: true,
                imageUrl: true,
              },
            },
          },
        });
      } catch (createErr) {
        const isP2002 =
          (createErr as { code?: string }).code === "P2002";
        if (isP2002) {
          return NextResponse.json(
            { error: "Project already in collection" },
            { status: 400, headers: corsHeaders }
          );
        }
        throw createErr;
      }

      // Update collection timestamp
      await db.projectCollection.update({
        where: { id: collectionId },
        data: { updatedAt: new Date() },
      });

      return NextResponse.json({ item }, { headers: corsHeaders });
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400, headers: corsHeaders }
    );
  } catch (error) {
    backerCollectionsLogger.error({ err: formatError(error) }, "Error with collection operation:");
    return NextResponse.json(
      { error: "Operation failed" },
      { status: 500, headers: corsHeaders }
    );
  }
}
