import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  updateUserInterestProfile,
  batchUpdateUserInterests,
  findMatchingProjectsForUser,
  findMatchingUsersForProject,
} from "@/lib/ai/user-interests";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized", status: 401 };
  }
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
    return { error: "Forbidden", status: 403 };
  }
  return { user: session.user };
}

// GET - Get user interest profiles and matching stats
export async function GET(request: Request) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const userId = searchParams.get("userId");
    const projectId = searchParams.get("projectId");
    // Validate limit parameter
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20") || 20));

    // Get stats overview
    if (!action) {
      const [
        totalProfiles,
        profilesWithHighScore,
        profilesLastWeek,
        avgProfileScore,
      ] = await Promise.all([
        db.userInterestProfile.count(),
        db.userInterestProfile.count({
          where: { profileScore: { gte: 50 } },
        }),
        db.userInterestProfile.count({
          where: {
            lastCalculatedAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            },
          },
        }),
        db.userInterestProfile.aggregate({
          _avg: { profileScore: true },
        }),
      ]);

      // Get top interest profiles
      const topProfiles = await db.userInterestProfile.findMany({
        where: { profileScore: { gte: 30 } },
        orderBy: { profileScore: "desc" },
        take: 10,
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      // Get category distribution
      const profiles = await db.userInterestProfile.findMany({
        select: { categoryInterests: true },
        take: 100,
      });

      const categoryDistribution: Record<string, number> = {};
      for (const profile of profiles) {
        const interests = profile.categoryInterests as Record<string, number>;
        for (const [category, score] of Object.entries(interests)) {
          if (score >= 0.5) {
            categoryDistribution[category] = (categoryDistribution[category] || 0) + 1;
          }
        }
      }

      return NextResponse.json({
        stats: {
          totalProfiles,
          profilesWithHighScore,
          profilesLastWeek,
          avgProfileScore: avgProfileScore._avg.profileScore?.toFixed(1) || "0",
        },
        topProfiles: topProfiles.map((p: {
          userId: string;
          profileScore: number;
          totalProjectsBacked: number;
          totalProjectsViewed: number;
          categoryInterests: unknown;
          user: { id: string; name: string | null; email: string | null };
        }) => ({
          userId: p.userId,
          userName: p.user.name || p.user.email?.split("@")[0],
          profileScore: p.profileScore,
          totalProjectsBacked: p.totalProjectsBacked,
          totalProjectsViewed: p.totalProjectsViewed,
          topCategories: Object.entries(p.categoryInterests as Record<string, number>)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([cat, score]) => ({ category: cat, score })),
        })),
        categoryDistribution: Object.entries(categoryDistribution)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([category, count]) => ({ category, count })),
      });
    }

    // Find matching projects for a user
    if (action === "matchProjects" && userId) {
      const matches = await findMatchingProjectsForUser(userId, {
        limit,
        minMatchScore: 20,
      });

      // Get project details
      const projectIds = matches.map((m) => m.projectId);
      const projects = await db.project.findMany({
        where: { id: { in: projectIds } },
        select: {
          id: true,
          title: true,
          category: true,
          imageUrl: true,
          currentAmount: true,
          goalAmount: true,
        },
      });

      const projectMap = new Map(projects.map((p) => [p.id, p]));

      return NextResponse.json({
        userId,
        matches: matches.map((m) => ({
          ...m,
          project: projectMap.get(m.projectId),
        })),
      });
    }

    // Find matching users for a project
    if (action === "matchUsers" && projectId) {
      const matches = await findMatchingUsersForProject(projectId, {
        limit,
        minMatchScore: 20,
      });

      // Get user details
      const userIds = matches.map((m) => m.userId);
      const users = await db.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });

      const userMap = new Map(users.map((u) => [u.id, u]));

      return NextResponse.json({
        projectId,
        matches: matches.map((m) => ({
          ...m,
          user: {
            id: userMap.get(m.userId)?.id,
            name: userMap.get(m.userId)?.name || userMap.get(m.userId)?.email?.split("@")[0],
          },
        })),
      });
    }

    // Get single user profile
    if (action === "profile" && userId) {
      const profile = await db.userInterestProfile.findUnique({
        where: { userId },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      if (!profile) {
        return NextResponse.json({ error: "Profile not found" }, { status: 404 });
      }

      return NextResponse.json({ profile });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error fetching user interests:", error);
    return NextResponse.json(
      { error: "Failed to fetch user interest data" },
      { status: 500 }
    );
  }
}

// POST - Update user interest profiles
export async function POST(request: Request) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await request.json();
    const { action, userId, userIds, batchSize = 50 } = body;

    // Update single user profile
    if (action === "updateProfile" && userId) {
      await updateUserInterestProfile(userId);
      const profile = await db.userInterestProfile.findUnique({
        where: { userId },
      });

      return NextResponse.json({
        success: true,
        message: "User interest profile updated",
        profile,
      });
    }

    // Batch update specific users
    if (action === "batchUpdate" && userIds && Array.isArray(userIds)) {
      const results = await batchUpdateUserInterests(userIds);

      return NextResponse.json({
        success: true,
        message: `Processed ${results.processed} profiles, ${results.failed} failed`,
        results,
      });
    }

    // Update all users with behavior data
    if (action === "updateAll") {
      // Get users with behavior data or pledges
      const usersWithActivity = await db.user.findMany({
        where: {
          OR: [
            { behaviors: { some: {} } },
            { pledges: { some: { status: "COMPLETED" } } },
          ],
        },
        select: { id: true },
        take: batchSize,
        orderBy: [
          // Prioritize users without recent profile updates
          {
            interestProfile: {
              lastCalculatedAt: "asc",
            },
          },
        ],
      });

      if (usersWithActivity.length === 0) {
        return NextResponse.json({
          success: true,
          message: "No users with activity data to process",
          processed: 0,
        });
      }

      const results = await batchUpdateUserInterests(
        usersWithActivity.map((u) => u.id)
      );

      return NextResponse.json({
        success: true,
        message: `Batch update complete: ${results.processed} processed, ${results.failed} failed`,
        results,
        remainingUsers: await db.user.count({
          where: {
            OR: [
              { behaviors: { some: {} } },
              { pledges: { some: { status: "COMPLETED" } } },
            ],
            interestProfile: null,
          },
        }),
      });
    }

    // Recalculate stale profiles (older than 24 hours)
    if (action === "refreshStale") {
      const staleProfiles = await db.userInterestProfile.findMany({
        where: {
          lastCalculatedAt: {
            lt: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
        select: { userId: true },
        take: batchSize,
        orderBy: { lastCalculatedAt: "asc" },
      });

      if (staleProfiles.length === 0) {
        return NextResponse.json({
          success: true,
          message: "No stale profiles to refresh",
          processed: 0,
        });
      }

      const results = await batchUpdateUserInterests(
        staleProfiles.map((p: { userId: string }) => p.userId)
      );

      return NextResponse.json({
        success: true,
        message: `Refreshed ${results.processed} stale profiles`,
        results,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error updating user interests:", error);
    return NextResponse.json(
      { error: "Failed to update user interest profiles" },
      { status: 500 }
    );
  }
}
