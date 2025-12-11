import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get projects the user is following
    const followedProjects = await db.projectFollower.findMany({
      where: {
        userId: session.user.id,
      },
      select: {
        id: true,
        createdAt: true,
        isPrelaunch: true,
        project: {
          select: {
            id: true,
            title: true,
            slug: true,
            imageUrl: true,
            status: true,
            goalAmount: true,
            currentAmount: true,
            backerCount: true,
            launchDate: true,
            endDate: true,
            category: true,
            creator: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Get creators the user is following from preferences
    const preferences = await db.userPreference.findUnique({
      where: { userId: session.user.id },
      select: {
        followedCreators: true,
      },
    });

    const followedCreatorIds = preferences?.followedCreators || [];

    // Fetch creator details
    const followedCreators = followedCreatorIds.length > 0
      ? await db.user.findMany({
          where: {
            id: { in: followedCreatorIds },
          },
          select: {
            id: true,
            name: true,
            image: true,
            bio: true,
            _count: {
              select: {
                createdProjects: true,
              },
            },
            createdProjects: {
              where: {
                status: { in: ["LIVE", "FUNDED"] },
              },
              select: {
                id: true,
                title: true,
                slug: true,
                imageUrl: true,
                status: true,
              },
              take: 3,
              orderBy: { createdAt: "desc" },
            },
          },
        })
      : [];

    return NextResponse.json({
      followedProjects: followedProjects.map((f: typeof followedProjects[number]) => ({
        ...f.project,
        followedAt: f.createdAt,
        isPrelaunch: f.isPrelaunch,
      })),
      followedCreators: followedCreators.map((c) => ({
        ...c,
        projectCount: c._count.createdProjects,
        recentProjects: c.createdProjects,
      })),
    });
  } catch (error) {
    console.error("Following fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch following data" },
      { status: 500 }
    );
  }
}

// Follow a project
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { projectId, email, type } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      );
    }

    // Verify the project exists
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true, title: true, prelaunchActive: true, status: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Get session for logged-in users
    const session = await auth();
    const userId = session?.user?.id;

    // For prelaunch follows, either userId OR email is required
    // For regular follows, userId is required
    const isPrelaunch = type === "prelaunch";

    if (!isPrelaunch && !userId) {
      return NextResponse.json(
        { error: "You must be logged in to follow projects" },
        { status: 401 }
      );
    }

    if (isPrelaunch && !userId && !email) {
      return NextResponse.json(
        { error: "Email is required for prelaunch notifications" },
        { status: 400 }
      );
    }

    // Check for existing follow
    const existingFollow = await db.projectFollower.findFirst({
      where: {
        projectId,
        OR: [
          ...(userId ? [{ userId }] : []),
          ...(email && !userId ? [{ email }] : []),
        ],
      },
    });

    if (existingFollow) {
      return NextResponse.json(
        { message: "Already following this project", alreadyFollowing: true },
        { status: 200 }
      );
    }

    // Create the follower record
    const follower = await db.projectFollower.create({
      data: {
        projectId,
        userId: userId || null,
        email: email || null,
        isPrelaunch,
      },
    });

    // Update follower count on the project
    await db.project.update({
      where: { id: projectId },
      data: {
        followerCount: { increment: 1 },
      },
    });

    // Record analytics event
    await db.analyticsEvent.create({
      data: {
        projectId,
        eventType: "PROJECT_FOLLOW",
        userId: userId || undefined,
        metadata: {
          isPrelaunch,
          hasEmail: !!email,
        },
      },
    });

    return NextResponse.json({
      success: true,
      followerId: follower.id,
      message: "Successfully followed project",
    });
  } catch (error) {
    console.error("Follow project error:", error);
    return NextResponse.json(
      { error: "Failed to follow project" },
      { status: 500 }
    );
  }
}

// Unfollow a project
export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const creatorId = searchParams.get("creatorId");

    if (projectId) {
      await db.projectFollower.deleteMany({
        where: {
          projectId,
          userId: session.user.id,
        },
      });
      return NextResponse.json({ success: true });
    }

    if (creatorId) {
      const preferences = await db.userPreference.findUnique({
        where: { userId: session.user.id },
        select: { followedCreators: true },
      });

      if (preferences) {
        await db.userPreference.update({
          where: { userId: session.user.id },
          data: {
            followedCreators: preferences.followedCreators.filter(
              (id: string) => id !== creatorId
            ),
          },
        });
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: "Project or creator ID required" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Unfollow error:", error);
    return NextResponse.json(
      { error: "Failed to unfollow" },
      { status: 500 }
    );
  }
}
