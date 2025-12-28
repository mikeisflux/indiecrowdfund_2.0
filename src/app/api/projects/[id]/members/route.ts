import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Helper function to verify user has access to project (creator or collaborator)
async function verifyProjectAccess(projectId: string, userId: string) {
  // Check if user is the creator
  let project = await db.project.findFirst({
    where: {
      id: projectId,
      creatorId: userId,
    },
    select: { id: true },
  });

  // If not creator, check if user is a collaborator with permission
  if (!project) {
    const collaborator = await db.projectCollaborator.findFirst({
      where: {
        projectId,
        userId,
        status: "ACCEPTED",
        canManageCommunity: true,
      },
      include: {
        project: {
          select: { id: true },
        },
      },
    });

    if (collaborator) {
      project = collaborator.project;
    }
  }

  return project;
}

// GET - Fetch project members (followers/subscribers)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId } = await params;

    // Verify user has access to this project
    const project = await verifyProjectAccess(projectId, session.user.id);

    if (!project) {
      return NextResponse.json({ error: "Project not found or you don't have access" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const search = searchParams.get("search") || "";

    const skip = (page - 1) * limit;

    // Build where clause
    const whereClause: Record<string, unknown> = {
      projectId,
    };

    if (search) {
      whereClause.OR = [
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    // Get members from ProjectFollower
    const [members, total] = await Promise.all([
      db.projectFollower.findMany({
        where: whereClause,
        include: {
          project: {
            select: { title: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.projectFollower.count({ where: whereClause }),
    ]);

    // Transform to member format
    const formattedMembers = members.map((m: { id: string; email: string | null; isPrelaunch: boolean; createdAt: Date }) => ({
      id: m.id,
      email: m.email || "",
      name: "", // ProjectFollower doesn't store name currently
      source: m.isPrelaunch ? "teaser" : "import",
      joinedAt: m.createdAt.toISOString(),
      status: "subscribed" as const,
    }));

    return NextResponse.json({
      members: formattedMembers,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching project members:", error);
    return NextResponse.json(
      { error: "Failed to fetch members" },
      { status: 500 }
    );
  }
}

// POST - Add a member to the project
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId } = await params;

    // Verify user has access to this project
    const project = await verifyProjectAccess(projectId, session.user.id);

    if (!project) {
      return NextResponse.json({ error: "Project not found or you don't have access" }, { status: 404 });
    }

    const body = await request.json();
    const { email, name } = body;

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if already exists
    const existing = await db.projectFollower.findUnique({
      where: {
        projectId_email: {
          projectId,
          email: normalizedEmail,
        },
      },
    });

    if (existing) {
      return NextResponse.json({ error: "Email already exists for this project" }, { status: 409 });
    }

    // Create new member
    const member = await db.projectFollower.create({
      data: {
        projectId,
        email: normalizedEmail,
        isPrelaunch: false,
      },
    });

    return NextResponse.json({
      member: {
        id: member.id,
        email: member.email,
        name: name || "",
        source: "import",
        joinedAt: member.createdAt.toISOString(),
        status: "subscribed",
      },
    });
  } catch (error) {
    console.error("Error adding project member:", error);
    return NextResponse.json(
      { error: "Failed to add member" },
      { status: 500 }
    );
  }
}

// DELETE - Remove a member from the project
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId } = await params;
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get("memberId");

    if (!memberId) {
      return NextResponse.json({ error: "Member ID is required" }, { status: 400 });
    }

    // Verify user has access to this project
    const project = await verifyProjectAccess(projectId, session.user.id);

    if (!project) {
      return NextResponse.json({ error: "Project not found or you don't have access" }, { status: 404 });
    }

    // Delete the member
    await db.projectFollower.delete({
      where: { id: memberId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting project member:", error);
    return NextResponse.json(
      { error: "Failed to delete member" },
      { status: 500 }
    );
  }
}
