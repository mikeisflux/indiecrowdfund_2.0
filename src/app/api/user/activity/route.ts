import { NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const userActivityLogger = logger.child({ module: "user-activity" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

interface ActivityItem {
  id: string;
  type: "pledge" | "update" | "comment" | "message" | "project_funded" | "project_launched";
  title: string;
  description: string;
  projectId?: string;
  projectTitle?: string;
  projectSlug?: string;
  projectUrl?: string;
  projectImage?: string | null;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

// Helper to build project URL with vanity URL
function buildProjectUrl(slug: string, creatorVanityUrl?: string | null): string {
  return creatorVanityUrl ? `/projects/${creatorVanityUrl}/${slug}` : `/projects/${slug}`;
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const activities: ActivityItem[] = [];

    // Get backed project IDs first
    const backedProjects = await db.pledge.findMany({
      where: {
        userId,
        status: { in: ["PENDING", "COMPLETED"] },
        deletedAt: null,
      },
      select: { projectId: true },
      distinct: ["projectId"],
    });
    const backedProjectIds = backedProjects.map((p: { projectId: string }) => p.projectId);

    // Get followed project IDs
    const followedProjects = await db.projectFollower.findMany({
      where: { userId },
      select: { projectId: true },
    });
    const followedProjectIds = followedProjects.map((p: { projectId: string }) => p.projectId);

    // Combine and deduplicate project IDs
    const relevantProjectIds = Array.from(new Set([...backedProjectIds, ...followedProjectIds]));

    // Get recent pledges by user - pledges that went through checkout
    // and deduplicate by project to avoid showing multiple entries for the same project
    const pledges = await db.pledge.findMany({
      where: {
        userId,
        deletedAt: null,
        // Prisma 7 rejects `{ field: { not: null } }` on nullable string
        // fields at runtime — use `NOT: { field: null }` wrapper syntax.
        OR: [
          { status: "COMPLETED" },
          {
            status: "PENDING",
            NOT: { stripePaymentMethodId: null },
          },
          {
            status: "PENDING",
            confirmationEmailSent: true,
          },
          {
            status: "PENDING",
            NOT: { stripeSetupIntentId: null },
          },
          {
            status: "PENDING",
            NOT: { stripePaymentIntentId: null },
          },
          {
            status: "PENDING",
            NOT: { divinityCoinPaymentId: null },
          },
        ],
      },
      select: {
        id: true,
        amount: true,
        createdAt: true,
        status: true,
        project: {
          select: {
            id: true,
            title: true,
            slug: true,
            imageUrl: true,
            creator: { select: { vanityUrl: true } },
          },
        },
        reward: {
          select: {
            title: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50, // Get more to allow for deduplication
    });

    // Deduplicate pledges by project - keep only the most recent pledge per project
    const pledgesByProject = new Map<string, typeof pledges[0]>();
    pledges.forEach((pledge) => {
      const existing = pledgesByProject.get(pledge.project.id);
      // Prefer COMPLETED over PENDING, then most recent
      if (!existing ||
          (pledge.status === "COMPLETED" && existing.status !== "COMPLETED") ||
          (pledge.status === existing.status && new Date(pledge.createdAt) > new Date(existing.createdAt))) {
        pledgesByProject.set(pledge.project.id, pledge);
      }
    });

    // Take only the 20 most recent unique pledges
    const uniquePledges = Array.from(pledgesByProject.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 20);

    for (const pledge of uniquePledges) {
      const pledgeAmount = Number(pledge.amount);
      activities.push({
        id: `pledge-${pledge.id}`,
        type: "pledge",
        title: `You backed ${pledge.project.title}`,
        description: `Pledged $${pledgeAmount} for "${pledge.reward?.title || "No reward"}"`,
        projectId: pledge.project.id,
        projectTitle: pledge.project.title,
        projectSlug: pledge.project.slug,
        projectUrl: buildProjectUrl(pledge.project.slug, pledge.project.creator?.vanityUrl),
        projectImage: pledge.project.imageUrl,
        timestamp: pledge.createdAt,
        metadata: { amount: pledgeAmount },
      });
    }

    // Get updates from backed/followed projects
    if (relevantProjectIds.length > 0) {
      const updates = await db.update.findMany({
        where: {
          projectId: { in: relevantProjectIds },
          status: "PUBLISHED",
        },
        select: {
          id: true,
          title: true,
          publishedAt: true,
          visibility: true,
          project: {
            select: {
              id: true,
              title: true,
              slug: true,
              imageUrl: true,
              creator: { select: { vanityUrl: true } },
            },
          },
        },
        orderBy: { publishedAt: "desc" },
        take: 20,
      });

      for (const update of updates) {
        activities.push({
          id: `update-${update.id}`,
          type: "update",
          title: `New update: ${update.title}`,
          description: `${update.project.title} posted a new update`,
          projectId: update.project.id,
          projectTitle: update.project.title,
          projectSlug: update.project.slug,
          projectUrl: buildProjectUrl(update.project.slug, update.project.creator?.vanityUrl),
          projectImage: update.project.imageUrl,
          timestamp: update.publishedAt || new Date(),
          metadata: { visibility: update.visibility },
        });
      }
    }

    // Get project funding milestones
    if (relevantProjectIds.length > 0) {
      const fundedProjects = await db.project.findMany({
        where: {
          id: { in: relevantProjectIds },
          fundedAt: { not: null },
          deletedAt: null,
        },
        select: {
          id: true,
          title: true,
          slug: true,
          imageUrl: true,
          fundedAt: true,
          goalAmount: true,
          currentAmount: true,
          creator: { select: { vanityUrl: true } },
        },
        orderBy: { fundedAt: "desc" },
        take: 10,
      });

      for (const project of fundedProjects) {
        if (project.fundedAt) {
          const goalAmount = Number(project.goalAmount);
          const currentAmount = Number(project.currentAmount);
          activities.push({
            id: `funded-${project.id}`,
            type: "project_funded",
            title: `${project.title} was funded!`,
            description: `Reached $${currentAmount.toLocaleString()} of $${goalAmount.toLocaleString()} goal`,
            projectId: project.id,
            projectTitle: project.title,
            projectSlug: project.slug,
            projectUrl: buildProjectUrl(project.slug, project.creator?.vanityUrl),
            projectImage: project.imageUrl,
            timestamp: project.fundedAt,
            metadata: {
              goalAmount,
              currentAmount,
            },
          });
        }
      }
    }

    // Get unread messages count
    const unreadMessages = await db.message.count({
      where: {
        recipientId: userId,
        read: false,
      },
    });

    // Get recent messages
    const messages = await db.message.findMany({
      where: { recipientId: userId },
      select: {
        id: true,
        subject: true,
        createdAt: true,
        read: true,
        sender: {
          select: {
            name: true,
            image: true,
          },
        },
        project: {
          select: {
            id: true,
            title: true,
            slug: true,
            imageUrl: true,
            creator: { select: { vanityUrl: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    for (const message of messages) {
      // Handle messages with or without a project (creator inbox emails have no project)
      activities.push({
        id: `message-${message.id}`,
        type: "message",
        title: message.subject || "New message",
        description: `Message from ${message.sender.name || "Unknown"}`,
        projectId: message.project?.id,
        projectTitle: message.project?.title || "Inbox",
        projectSlug: message.project?.slug,
        projectUrl: message.project ? buildProjectUrl(message.project.slug, message.project.creator?.vanityUrl) : undefined,
        projectImage: message.project?.imageUrl,
        timestamp: message.createdAt,
        metadata: { read: message.read },
      });
    }

    // Sort all activities by timestamp
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Get stats
    const stats = {
      totalBacked: backedProjectIds.length,
      totalFollowing: followedProjectIds.length,
      unreadMessages,
      recentActivity: activities.length,
    };

    return NextResponse.json({
      activities: activities.slice(0, 50),
      stats,
    });
  } catch (error) {
    userActivityLogger.error({ err: formatError(error) }, "Activity fetch error:");
    return NextResponse.json(
      { error: "Failed to fetch activity" },
      { status: 500 }
    );
  }
}
