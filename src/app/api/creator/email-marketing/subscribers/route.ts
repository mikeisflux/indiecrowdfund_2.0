import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const creatorEmailMarketingSubscribersLogger = logger.child({ module: "creator-email-marketing-subscribers" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Helper to get creator tag
async function getCreatorTag(userId: string) {
  const creator = await db.user.findUnique({
    where: { id: userId },
    select: { name: true, vanityUrl: true },
  });
  return creator?.vanityUrl || creator?.name || userId;
}

// GET - Fetch creator's subscribers (from EmailListSubscriber + backers)
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get creator's email list subscribers
    const emailListSubscribers = await db.emailListSubscriber.findMany({
      where: {
        creatorId: session.user.id,
      },
      orderBy: { createdAt: "desc" },
    });

    // Also get backers from creator's projects (paying customers)
    const creatorProjects = await db.project.findMany({
      where: { creatorId: session.user.id, deletedAt: null },
      select: { id: true, title: true },
    });

    const projectIds = creatorProjects.map((p) => p.id);

    const backers = await db.pledge.findMany({
      where: {
        projectId: { in: projectIds },
        status: "COMPLETED",
        deletedAt: null,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            createdAt: true,
          },
        },
      },
      distinct: ["userId"],
    });

    // Get prelaunch followers (people who signed up to be notified)
    const prelaunchFollowers = await db.projectFollower.findMany({
      where: {
        projectId: { in: projectIds },
        isPrelaunch: true,
      },
      include: {
        project: {
          select: { title: true },
        },
      },
    });

    // Combine and deduplicate
    const subscriberMap = new Map<string, {
      id: string;
      email: string;
      name: string;
      status: "active" | "unsubscribed" | "bounced";
      source: string;
      sourceType: "backer" | "import" | "manual" | "teaser" | "prelaunch";
      createdAt: string;
    }>();

    // Add email list subscribers first (they're the primary source now)
    for (const sub of emailListSubscribers) {
      const sourceType = sub.source === "csv_import" || sub.source === "project_import"
        ? "import"
        : sub.source === "teaser"
        ? "teaser"
        : "manual";

      subscriberMap.set(sub.email, {
        id: sub.id,
        email: sub.email,
        name: sub.name || "Unknown",
        status: sub.status === "subscribed" ? "active" : sub.status === "bounced" ? "bounced" : "unsubscribed",
        source: sub.source || "Manual",
        sourceType,
        createdAt: sub.createdAt.toISOString(),
      });
    }

    // Add backers (if not already in the list)
    for (const backer of backers) {
      if (backer.user.email && !subscriberMap.has(backer.user.email)) {
        subscriberMap.set(backer.user.email, {
          id: `backer_${backer.user.id}`,
          email: backer.user.email,
          name: backer.user.name || "Unknown",
          status: "active",
          source: "Backer",
          sourceType: "backer",
          createdAt: backer.user.createdAt.toISOString(),
        });
      }
    }

    // Add prelaunch followers (if not already in the list)
    for (const follower of prelaunchFollowers) {
      const email = follower.email?.toLowerCase();
      if (email && !subscriberMap.has(email)) {
        subscriberMap.set(email, {
          id: follower.id,
          email: email,
          name: "Prelaunch Signup",
          status: "active",
          source: `Prelaunch: ${follower.project.title}`,
          sourceType: "prelaunch",
          createdAt: follower.createdAt.toISOString(),
        });
      }
    }

    const subscribers = Array.from(subscriberMap.values());

    const stats = {
      total: subscribers.length,
      active: subscribers.filter((s) => s.status === "active").length,
      unsubscribed: subscribers.filter((s) => s.status === "unsubscribed").length,
      bounced: subscribers.filter((s) => s.status === "bounced").length,
    };

    return NextResponse.json({ subscribers, stats });
  } catch (error) {
    creatorEmailMarketingSubscribersLogger.error({ err: String(error) }, "Error fetching subscribers:");
    return NextResponse.json(
      { error: "Failed to fetch subscribers" },
      { status: 500 }
    );
  }
}

// POST - Manually add a subscriber to creator's email list
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { email, name } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    const emailLower = email.toLowerCase().trim();

    // Check if email is on the blocklist (bounced, spam reported, etc.)
    const blocked = await db.emailBlocklist.findFirst({
      where: {
        type: "EMAIL",
        value: emailLower,
        isActive: true,
      },
    });
    if (blocked) {
      return NextResponse.json(
        { error: "This email address has been blocked due to a previous bounce or spam complaint" },
        { status: 400 }
      );
    }

    // Check if already exists in creator's email list
    const existing = await db.emailListSubscriber.findUnique({
      where: {
        creatorId_email: {
          creatorId: session.user.id,
          email: emailLower,
        },
      },
    });

    if (existing) {
      return NextResponse.json({ error: "Subscriber already exists in your email list" }, { status: 400 });
    }

    // Add to creator's email list
    const subscriber = await db.emailListSubscriber.create({
      data: {
        creatorId: session.user.id,
        email: emailLower,
        name: name?.trim() || null,
        source: "manual",
        status: "subscribed",
      },
    });

    // Also sync to admin newsletter
    const creatorTag = await getCreatorTag(session.user.id);
    try {
      const existingNewsletter = await db.newsletterSubscriber.findUnique({
        where: { email: emailLower },
      });

      if (!existingNewsletter) {
        await db.newsletterSubscriber.create({
          data: {
            email: emailLower,
            name: name?.trim() || null,
            source: "creator_import",
            tags: [`creator:${creatorTag}`],
            isActive: true,
          },
        });
      }
    } catch (err) {
      creatorEmailMarketingSubscribersLogger.error({ err: String(err) }, "Failed to sync to admin newsletter:");
    }

    return NextResponse.json({
      subscriber: {
        id: subscriber.id,
        email: subscriber.email,
        name: subscriber.name || "Unknown",
        status: "active",
        source: "Manual",
        sourceType: "manual",
        createdAt: subscriber.createdAt.toISOString(),
      },
    });
  } catch (error) {
    creatorEmailMarketingSubscribersLogger.error({ err: String(error) }, "Error adding subscriber:");
    return NextResponse.json(
      { error: "Failed to add subscriber" },
      { status: 500 }
    );
  }
}
