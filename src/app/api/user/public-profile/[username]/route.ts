import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const userPublicProfileLogger = logger.child({ module: "user-public-profile" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getBatchProjectStats } from "@/lib/stats";

export const dynamic = "force-dynamic";

interface ProjectData {
  id: string;
  title: string;
  slug: string;
  subtitle: string | null;
  imageUrl: string | null;
  status: string;
  goalAmount: number;
  currentAmount: number;
  backerCount: number;
  creator: { vanityUrl: string | null } | null;
}

interface PledgeData {
  project: ProjectData;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    await auth(); // Check auth status for isFollowing feature (used later)

    // Find user by vanityUrl or id
    const user = await db.user.findFirst({
      where: {
        OR: [
          { vanityUrl: username },
          { id: username },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        heroImage: true,
        bio: true,
        location: true,
        vanityUrl: true,
        websites: true,
        socialLinks: true,
        showNameOnly: true,
        createdAt: true,
        _count: {
          select: {
            createdProjects: true,
            pledges: true,
          },
        },
        createdProjects: {
          where: {
            status: {
              in: ["LIVE", "FUNDED", "PAUSED"],
            },
            deletedAt: null,
          },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            title: true,
            slug: true,
            subtitle: true,
            imageUrl: true,
            status: true,
            goalAmount: true,
            currentAmount: true,
            backerCount: true,
            creator: {
              select: {
                vanityUrl: true,
              },
            },
          },
        },
        pledges: {
          where: {
            status: "COMPLETED",
            deletedAt: null,
            project: {
              status: {
                in: ["LIVE", "FUNDED", "PAUSED"],
              },
              deletedAt: null,
            },
          },
          orderBy: { createdAt: "desc" },
          take: 50,
          select: {
            project: {
              select: {
                id: true,
                title: true,
                slug: true,
                subtitle: true,
                imageUrl: true,
                status: true,
                goalAmount: true,
                currentAmount: true,
                backerCount: true,
                creator: {
                  select: {
                    vanityUrl: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if current user is following this profile
    // Note: Follow functionality will be added in a future update
    const isFollowing = false;

    // Collect all unique projects for batch stats lookup
    const backedProjectsRaw = new Map<string, ProjectData>();
    user.pledges.forEach((pledge: PledgeData) => {
      if (!backedProjectsRaw.has(pledge.project.id)) {
        backedProjectsRaw.set(pledge.project.id, pledge.project);
      }
    });

    const allProjects = [
      ...user.createdProjects,
      ...Array.from(backedProjectsRaw.values()),
    ];

    const statsMap = await getBatchProjectStats(
      allProjects.map((p) => ({ id: p.id, status: p.status, goalAmount: p.goalAmount }))
    );

    // Format projects with full URLs
    const createdProjects = user.createdProjects.map((project: ProjectData) => {
      const liveStats = statsMap.get(project.id) ?? { currentAmount: 0, backerCount: 0 };
      return {
        id: project.id,
        title: project.title,
        slug: project.slug,
        subtitle: project.subtitle,
        imageUrl: project.imageUrl,
        status: project.status,
        fundingGoal: Number(project.goalAmount),
        currentFunding: liveStats.currentAmount,
        backerCount: liveStats.backerCount,
        projectUrl: project.creator?.vanityUrl
          ? `/projects/${project.creator.vanityUrl}/${project.slug}`
          : `/projects/${project.slug}`,
      };
    });

    // Get unique backed projects
    const backedProjectsMap = new Map();
    backedProjectsRaw.forEach((project) => {
      const liveStats = statsMap.get(project.id) ?? { currentAmount: 0, backerCount: 0 };
      backedProjectsMap.set(project.id, {
        id: project.id,
        title: project.title,
        slug: project.slug,
        subtitle: project.subtitle,
        imageUrl: project.imageUrl,
        status: project.status,
        fundingGoal: Number(project.goalAmount),
        currentFunding: liveStats.currentAmount,
        backerCount: liveStats.backerCount,
        projectUrl: project.creator?.vanityUrl
          ? `/projects/${project.creator.vanityUrl}/${project.slug}`
          : `/projects/${project.slug}`,
      });
    });

    const response = {
      id: user.id,
      name: user.showNameOnly ? user.name : user.name,
      image: user.image,
      heroImage: user.heroImage,
      bio: user.bio,
      location: user.location,
      vanityUrl: user.vanityUrl,
      websites: user.websites || [],
      socialLinks: user.socialLinks,
      showNameOnly: user.showNameOnly,
      createdAt: user.createdAt.toISOString(),
      _count: user._count,
      createdProjects,
      backedProjects: Array.from(backedProjectsMap.values()),
      isFollowing,
    };

    return NextResponse.json(response);
  } catch (error) {
    userPublicProfileLogger.error({ err: String(error) }, "Public profile fetch error:");
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}
