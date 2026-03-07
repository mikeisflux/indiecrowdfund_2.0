import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const userProfileDropdownLogger = logger.child({ module: "user-profile-dropdown" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Get user's vanity URL for created projects
    const currentUser = await db.user.findUnique({
      where: { id: userId },
      select: { vanityUrl: true },
    });
    const userVanityUrl = currentUser?.vanityUrl;

    // Fetch backed projects (projects user has pledged to)
    const backedPledges = await db.pledge.findMany({
      where: {
        userId,
        status: { in: ["PENDING", "COMPLETED"] },
      },
      select: {
        project: {
          select: {
            id: true,
            title: true,
            slug: true,
            imageUrl: true,
            status: true,
            creator: { select: { vanityUrl: true } },
          },
        },
      },
      distinct: ["projectId"],
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    // Fetch created projects
    const createdProjects = await db.project.findMany({
      where: { creatorId: userId },
      select: {
        id: true,
        title: true,
        slug: true,
        imageUrl: true,
        status: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    // Fetch collaborating projects (accepted) - lookup by userId OR email
    const userEmail = session.user.email?.toLowerCase();

    const collaborations = await db.projectCollaborator.findMany({
      where: {
        status: "ACCEPTED",
        OR: [
          { userId },
          ...(userEmail ? [{ email: { equals: userEmail, mode: "insensitive" as const } }] : []),
        ],
      },
      select: {
        id: true,
        userId: true,
        email: true,
        status: true,
        project: {
          select: {
            id: true,
            title: true,
            slug: true,
            imageUrl: true,
            status: true,
            creator: { select: { vanityUrl: true } },
          },
        },
      },
      orderBy: { acceptedAt: "desc" },
      take: 5,
    });

    // Link userId if not set (for collaborators found by email)
    for (const collab of collaborations) {
      if (!collab.userId && userEmail) {
        await db.projectCollaborator.update({
          where: { id: collab.id },
          data: { userId },
        });
      }
    }

    // Fetch pending invitations (by email since userId might not be set yet)
    const pendingInvites = userEmail ? await db.projectCollaborator.findMany({
      where: {
        OR: [
          { userId, status: "PENDING" },
          { email: { equals: userEmail, mode: "insensitive" }, status: "PENDING" },
        ],
      },
      select: {
        id: true,
        project: {
          select: {
            id: true,
            title: true,
            slug: true,
            imageUrl: true,
            status: true,
            creator: { select: { vanityUrl: true } },
          },
        },
      },
      orderBy: { invitedAt: "desc" },
      take: 5,
    }) : [];

    // Helper to build project URL with vanity URL
    const buildProjectUrl = (slug: string, creatorVanityUrl?: string | null) =>
      creatorVanityUrl ? `/projects/${creatorVanityUrl}/${slug}` : `/projects/${slug}`;

    return NextResponse.json({
      backedProjects: backedPledges.map((p) => ({
        id: p.project.id,
        title: p.project.title,
        slug: p.project.slug,
        imageUrl: p.project.imageUrl,
        status: p.project.status,
        projectUrl: buildProjectUrl(p.project.slug, p.project.creator?.vanityUrl),
      })),
      createdProjects: createdProjects.map((p) => ({
        ...p,
        projectUrl: buildProjectUrl(p.slug, userVanityUrl),
      })),
      collaboratingProjects: collaborations.map((c: typeof collaborations[number]) => ({
        id: c.project.id,
        title: c.project.title,
        slug: c.project.slug,
        imageUrl: c.project.imageUrl,
        status: c.project.status,
        projectUrl: buildProjectUrl(c.project.slug, c.project.creator?.vanityUrl),
      })),
      pendingInvites: pendingInvites.map((c: typeof pendingInvites[number]) => ({
        inviteId: c.id,
        id: c.project.id,
        title: c.project.title,
        slug: c.project.slug,
        imageUrl: c.project.imageUrl,
        status: c.project.status,
        projectUrl: buildProjectUrl(c.project.slug, c.project.creator?.vanityUrl),
      })),
    });
  } catch (error) {
    userProfileDropdownLogger.error({ err: String(error) }, "Profile dropdown error:");
    return NextResponse.json(
      { error: "Failed to fetch profile data" },
      { status: 500 }
    );
  }
}
