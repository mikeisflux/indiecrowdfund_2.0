import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

interface ProjectData {
  id: string;
  title: string;
  slug: string;
  tagline: string | null;
  imageUrl: string | null;
  status: string;
  fundingGoal: number;
  currentFunding: number;
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
              in: ["ACTIVE", "FUNDED", "COMPLETED"],
            },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            title: true,
            slug: true,
            tagline: true,
            imageUrl: true,
            status: true,
            fundingGoal: true,
            currentFunding: true,
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
            project: {
              status: {
                in: ["ACTIVE", "FUNDED", "COMPLETED"],
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            project: {
              select: {
                id: true,
                title: true,
                slug: true,
                tagline: true,
                imageUrl: true,
                status: true,
                fundingGoal: true,
                currentFunding: true,
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

    // Format projects with full URLs
    const createdProjects = user.createdProjects.map((project: ProjectData) => ({
      id: project.id,
      title: project.title,
      slug: project.slug,
      tagline: project.tagline,
      imageUrl: project.imageUrl,
      status: project.status,
      fundingGoal: project.fundingGoal,
      currentFunding: project.currentFunding,
      backerCount: project.backerCount,
      projectUrl: project.creator?.vanityUrl
        ? `/projects/${project.creator.vanityUrl}/${project.slug}`
        : `/projects/${project.slug}`,
    }));

    // Get unique backed projects
    const backedProjectsMap = new Map();
    user.pledges.forEach((pledge: PledgeData) => {
      if (!backedProjectsMap.has(pledge.project.id)) {
        backedProjectsMap.set(pledge.project.id, {
          id: pledge.project.id,
          title: pledge.project.title,
          slug: pledge.project.slug,
          tagline: pledge.project.tagline,
          imageUrl: pledge.project.imageUrl,
          status: pledge.project.status,
          fundingGoal: pledge.project.fundingGoal,
          currentFunding: pledge.project.currentFunding,
          backerCount: pledge.project.backerCount,
          projectUrl: pledge.project.creator?.vanityUrl
            ? `/projects/${pledge.project.creator.vanityUrl}/${pledge.project.slug}`
            : `/projects/${pledge.project.slug}`,
        });
      }
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
    console.error("Public profile fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}
