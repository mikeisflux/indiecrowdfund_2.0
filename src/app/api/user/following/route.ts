import { NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const userFollowingLogger = logger.child({ module: "user-following" });
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

    // Creators the user follows.
    //
    // This read from UserPreference.followedCreators, a String[] that NOTHING
    // in the codebase ever writes to — so it was empty for every user and the
    // creators tab could never show anything. Following a creator writes a
    // CreatorFollow row (POST /api/backer/following), which is also what the
    // profile page and the backer dashboard read. That table is the source of
    // truth; this now uses it too.
    const creatorFollows = await db.creatorFollow.findMany({
      where: { followerId: session.user.id },
      select: { creatorId: true },
      orderBy: { createdAt: "desc" },
    });

    const followedCreatorIds = creatorFollows.map(
      (f: { creatorId: string }) => f.creatorId
    );

    // Fetch creator details
    const followedCreators = followedCreatorIds.length > 0
      ? await db.user.findMany({
          where: {
            id: { in: followedCreatorIds },
            deletedAt: null,
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
                deletedAt: null,
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
    userFollowingLogger.error({ err: formatError(error) }, "Following fetch error:");
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
    const project = await db.project.findFirst({
      where: { id: projectId, deletedAt: null },
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

    // Get user's email for notifications
    const user = await db.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { email: true },
    });

    // Create the follower record. Use try/catch on P2002 so two
    // concurrent follow requests (double-click, retry) can't both
    // pass the existing-follow check and cause the followerCount
    // to be incremented twice. Only increment the counter if we
    // actually inserted a new row.
    let follower;
    let alreadyFollowing = false;
    try {
      follower = await db.projectFollower.create({
        data: {
          projectId,
          userId,
          email: user?.email || null,
          isPrelaunch,
        },
      });
    } catch (createErr) {
      const isUniqueViolation =
        createErr &&
        typeof createErr === "object" &&
        "code" in createErr &&
        (createErr as { code?: string }).code === "P2002";
      if (isUniqueViolation) {
        alreadyFollowing = true;
      } else {
        throw createErr;
      }
    }

    if (alreadyFollowing) {
      return NextResponse.json(
        { message: "Already following this project", alreadyFollowing: true },
        { status: 200 }
      );
    }

    // Get project creator ID to add follower to their email list
    const projectDetails = await db.project.findFirst({
      where: { id: projectId , deletedAt: null },
      select: { creatorId: true },
    });

    // Auto-add follower to creator's email list (non-blocking)
    if (user?.email && projectDetails?.creatorId) {
      try {
        const userDetails = await db.user.findFirst({
          where: { id: userId, deletedAt: null },
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
        userFollowingLogger.error({ err: String(emailListError) }, "[Follow] Failed to add follower to email list:");
      }
    }

    // Update follower count on the project — only runs if we actually
    // created a new follower row above.
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
      followerId: follower?.id,
      message: "Successfully followed project",
    });
  } catch (error) {
    userFollowingLogger.error({ err: formatError(error) }, "Follow project error:");
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
      const deleted = await db.projectFollower.deleteMany({
        where: {
          projectId,
          userId: session.user.id,
        },
      });
      // Decrement follower count if a record was actually removed
      if (deleted.count > 0) {
        await db.project.update({
          where: { id: projectId },
          data: { followerCount: { decrement: 1 } },
        });
      }
      return NextResponse.json({ success: true });
    }

    if (creatorId) {
      // Delete the CreatorFollow row rather than filtering the dead
      // UserPreference array, which held nothing and so unfollowed nothing.
      // deleteMany, not delete: a second click on an already-removed follow
      // is a no-op instead of a P2025.
      await db.creatorFollow.deleteMany({
        where: { followerId: session.user.id, creatorId },
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: "Project or creator ID required" },
      { status: 400 }
    );
  } catch (error) {
    userFollowingLogger.error({ err: formatError(error) }, "Unfollow error:");
    return NextResponse.json(
      { error: "Failed to unfollow" },
      { status: 500 }
    );
  }
}
