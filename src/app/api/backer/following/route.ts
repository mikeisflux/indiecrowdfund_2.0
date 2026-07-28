import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const backerFollowingLogger = logger.child({ module: "backer-following" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getBatchProjectStats } from "@/lib/stats";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// GET: Get all followed creators with their activity
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    // Get all creators the user follows
    const following = await db.creatorFollow.findMany({
      where: { followerId: session.user.id },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            image: true,
            bio: true,
            createdAt: true,
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
                currentAmount: true,
                goalAmount: true,
                endDate: true,
                category: true,
                createdAt: true,
                backerCount: true,
              },
              orderBy: { createdAt: "desc" },
              take: 5,
            },
            _count: {
              select: {
                createdProjects: {
                  where: { status: { in: ["LIVE", "FUNDED"] }, deletedAt: null },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Batch load live stats for all projects across all followed creators
    const allProjects = following.flatMap((f: typeof following[0]) =>
      f.creator.createdProjects.map((p: typeof f.creator.createdProjects[0]) => ({
        id: p.id,
        status: p.status,
        goalAmount: p.goalAmount,
      }))
    );
    const statsMap = await getBatchProjectStats(allProjects);

    // Transform data
    const creators = following.map((f: typeof following[0]) => {
      // Sum live backer counts across the creator's loaded projects so the
      // following card can render a backer total — the UI reads
      // `totalBackers` and crashed on undefined when it wasn't returned.
      const totalBackers = f.creator.createdProjects.reduce(
        (sum: number, p: typeof f.creator.createdProjects[0]) =>
          sum + (statsMap.get(p.id)?.backerCount ?? 0),
        0
      );
      return {
      id: f.creator.id,
      name: f.creator.name,
      image: f.creator.image,
      bio: f.creator.bio,
      followedAt: f.createdAt,
      notifyNewProjects: f.notifyNewProjects,
      notifyUpdates: f.notifyUpdates,
      projectCount: f.creator._count.createdProjects,
      totalBackers,
      memberSince: f.creator.createdAt,
      recentProjects: f.creator.createdProjects.map((p: typeof f.creator.createdProjects[0]) => {
        const liveStats = statsMap.get(p.id) ?? { currentAmount: 0, backerCount: 0 };
        return {
          id: p.id,
          title: p.title,
          slug: p.slug,
          imageUrl: p.imageUrl,
          status: p.status,
          currentAmount: liveStats.currentAmount,
          goalAmount: Number(p.goalAmount),
          percentFunded: Math.round((liveStats.currentAmount / Number(p.goalAmount)) * 100),
          endDate: p.endDate,
          category: p.category,
          createdAt: p.createdAt,
          backerCount: liveStats.backerCount,
        };
      }),
      };
    });

    // Build activity feed from recent projects across all followed creators
    const allRecentProjects = following.flatMap((f: typeof following[0]) =>
      f.creator.createdProjects.map((p: typeof f.creator.createdProjects[0]) => {
        const liveStats = statsMap.get(p.id) ?? { currentAmount: 0, backerCount: 0 };
        return {
          id: p.id,
          type: "new_project" as const,
          title: p.title,
          slug: p.slug,
          imageUrl: p.imageUrl,
          status: p.status,
          currentAmount: liveStats.currentAmount,
          goalAmount: Number(p.goalAmount),
          percentFunded: Math.round((liveStats.currentAmount / Number(p.goalAmount)) * 100),
          category: p.category,
          createdAt: p.createdAt,
          creator: {
            id: f.creator.id,
            name: f.creator.name,
            image: f.creator.image,
          },
        };
      })
    );

    // Sort by created date and take most recent
    allRecentProjects.sort(
      (a: { createdAt: Date }, b: { createdAt: Date }) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const activityFeed = allRecentProjects.slice(0, 20);

    // Calculate stats
    const totalProjects = creators.reduce(
      (sum: number, c: { projectCount: number }) => sum + c.projectCount,
      0
    );

    return NextResponse.json({
      creators,
      activity: activityFeed,
      stats: {
        totalFollowing: creators.length,
        totalProjects,
        recentUpdates: activityFeed.length,
      },
    }, { headers: corsHeaders });
  } catch (error) {
    backerFollowingLogger.error({ err: formatError(error) }, "Error fetching following:");
    return NextResponse.json(
      { error: "Failed to fetch following" },
      { status: 500, headers: corsHeaders }
    );
  }
}

// POST: Follow a creator or update follow preferences
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const body = await request.json();
    const { action, creatorId, notifyNewProjects, notifyUpdates } = body;

    if (!creatorId) {
      return NextResponse.json(
        { error: "Creator ID is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Prevent self-follow
    if (creatorId === session.user.id) {
      return NextResponse.json(
        { error: "You cannot follow yourself" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Verify creator exists
    const creator = await db.user.findUnique({
      where: { id: creatorId, deletedAt: null },
      select: { id: true, name: true },
    });

    if (!creator) {
      return NextResponse.json(
        { error: "Creator not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    if (action === "follow") {
      // Create with P2002 catch on @@unique([followerId, creatorId]).
      // The findFirst check is TOCTOU under concurrent follow clicks.
      let follow;
      try {
        follow = await db.creatorFollow.create({
          data: {
            followerId: session.user.id,
            creatorId,
            notifyNewProjects: notifyNewProjects ?? true,
            notifyUpdates: notifyUpdates ?? true,
          },
        });
      } catch (createErr) {
        const isUniqueViolation =
          createErr &&
          typeof createErr === "object" &&
          "code" in createErr &&
          (createErr as { code?: string }).code === "P2002";
        if (isUniqueViolation) {
          return NextResponse.json(
            { message: `Already following ${creator.name}`, alreadyFollowing: true },
            { headers: corsHeaders }
          );
        }
        throw createErr;
      }

      return NextResponse.json({
        follow,
        message: `Now following ${creator.name}`,
      }, { headers: corsHeaders });
    } else if (action === "updatePreferences") {
      const follow = await db.creatorFollow.updateMany({
        where: { followerId: session.user.id, creatorId },
        data: {
          ...(notifyNewProjects !== undefined && { notifyNewProjects }),
          ...(notifyUpdates !== undefined && { notifyUpdates }),
        },
      });

      if (follow.count === 0) {
        return NextResponse.json(
          { error: "Not following this creator" },
          { status: 404, headers: corsHeaders }
        );
      }

      return NextResponse.json({ success: true }, { headers: corsHeaders });
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400, headers: corsHeaders }
    );
  } catch (error) {
    backerFollowingLogger.error({ err: formatError(error) }, "Error with follow operation:");
    return NextResponse.json(
      { error: "Operation failed" },
      { status: 500, headers: corsHeaders }
    );
  }
}

// PATCH: same body contract as POST. The backer notifications tab sends
// PATCH for { action: "updatePreferences" }, which 405'd because only
// GET/POST/DELETE were exported — every per-creator notification toggle
// silently failed to save.
export async function PATCH(request: NextRequest) {
  return POST(request);
}

// DELETE: Unfollow a creator
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const { searchParams } = new URL(request.url);
    const creatorId = searchParams.get("creatorId");

    if (!creatorId) {
      return NextResponse.json(
        { error: "Creator ID is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const result = await db.creatorFollow.deleteMany({
      where: { followerId: session.user.id, creatorId },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: "Not following this creator" },
        { status: 404, headers: corsHeaders }
      );
    }

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    backerFollowingLogger.error({ err: formatError(error) }, "Error unfollowing:");
    return NextResponse.json(
      { error: "Failed to unfollow" },
      { status: 500, headers: corsHeaders }
    );
  }
}
