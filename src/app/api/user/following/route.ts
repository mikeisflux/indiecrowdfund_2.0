import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { addToCreatorEmailList } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if this is a request to check if following a specific project
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (projectId) {
      // Check if user is following this specific project
      const follow = await db.projectFollower.findFirst({
        where: {
          projectId,
          userId: session.user.id,
        },
      });
      return NextResponse.json({ isFollowing: !!follow });
    }

    // Get all projects the user is following
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
                vanityUrl: true,
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
            vanityUrl: true,
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
      followedProjects: followedProjects.map((f: typeof followedProjects[number]) => {
        // Build project URL with vanity URL if available
        const baseUrl = f.project.creator.vanityUrl
          ? `/projects/${f.project.creator.vanityUrl}/${f.project.slug}`
          : `/projects/${f.project.slug}`;
        const projectUrl = f.isPrelaunch ? `${baseUrl}/prelaunch` : baseUrl;

        return {
          ...f.project,
          followedAt: f.createdAt,
          isPrelaunch: f.isPrelaunch,
          projectUrl,
        };
      }),
      followedCreators: followedCreators.map((c) => ({
        id: c.id,
        name: c.name,
        image: c.image,
        bio: c.bio,
        vanityUrl: c.vanityUrl,
        projectCount: c._count.createdProjects,
        recentProjects: c.createdProjects.map((p: { id: string; title: string; slug: string; imageUrl: string | null; status: string }) => ({
          ...p,
          projectUrl: c.vanityUrl
            ? `/projects/${c.vanityUrl}/${p.slug}`
            : `/projects/${p.slug}`,
        })),
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
    const { projectId, type } = body;

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

    // Following requires authentication
    const isPrelaunch = type === "prelaunch";

    if (!userId) {
      return NextResponse.json(
        { error: "You must be logged in to follow projects" },
        { status: 401 }
      );
    }

    // Check for existing follow
    const existingFollow = await db.projectFollower.findFirst({
      where: {
        projectId,
        userId,
      },
    });

    if (existingFollow) {
      return NextResponse.json(
        { message: "Already following this project", alreadyFollowing: true },
        { status: 200 }
      );
    }

    // Get user's email for notifications
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    // Create the follower record
    const follower = await db.projectFollower.create({
      data: {
        projectId,
        userId,
        email: user?.email || null,
        isPrelaunch,
      },
    });

    // Get project creator ID to add follower to their email list
    const projectDetails = await db.project.findUnique({
      where: { id: projectId },
      select: { creatorId: true },
    });

    // Auto-add follower to creator's email list (non-blocking)
    if (user?.email && projectDetails?.creatorId) {
      try {
        const userDetails = await db.user.findUnique({
          where: { id: userId },
          select: { name: true },
        });
        await addToCreatorEmailList({
          creatorId: projectDetails.creatorId,
          email: user.email,
          name: userDetails?.name,
          source: isPrelaunch ? "prelaunch" : "follow",
          sourceProjectId: projectId,
        });
      } catch (emailListError) {
        console.error("[Follow] Failed to add follower to email list:", emailListError);
      }
    }

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
        userId,
        metadata: {
          isPrelaunch,
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
