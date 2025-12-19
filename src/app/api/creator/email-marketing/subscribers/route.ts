import { NextRequest, NextResponse } from "next/server";
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

// GET - Fetch creator's subscribers (from project followers + manual imports)
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const creatorTag = await getCreatorTag(session.user.id);

    // Get all users who follow any of the creator's projects
    const creatorProjects = await db.project.findMany({
      where: { creatorId: session.user.id },
      select: { id: true },
    });

    const projectIds = creatorProjects.map((p) => p.id);

    // Get followers from ProjectFollower table (note: user relation not defined in schema)
    const followers = await db.projectFollower.findMany({
      where: {
        projectId: { in: projectIds },
        userId: { not: null }, // Only get followers with user accounts
      },
      include: {
        project: {
          select: {
            title: true,
          },
        },
      },
    });

    // Get user details for followers
    const followerUserIds = followers.map((f) => f.userId).filter((id): id is string => id !== null);
    const followerUsers = await db.user.findMany({
      where: { id: { in: followerUserIds } },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });
    const followerUserMap = new Map(followerUsers.map((u) => [u.id, u]));

    // Also get backers
    const backers = await db.pledge.findMany({
      where: {
        projectId: { in: projectIds },
        status: "COMPLETED",
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

    // Get manually added/imported subscribers for this creator
    const manualSubscribers = await db.newsletterSubscriber.findMany({
      where: {
        OR: [
          { source: { startsWith: `creator_import:${creatorTag}` } },
          { source: { startsWith: `creator_manual:${creatorTag}` } },
        ],
      },
    });

    // Combine and deduplicate
    const subscriberMap = new Map<string, {
      id: string;
      email: string;
      name: string;
      status: "active" | "unsubscribed" | "bounced";
      source: string;
      sourceType: "follower" | "backer" | "import" | "manual";
      createdAt: string;
    }>();

    // Add followers
    for (const follower of followers) {
      const user = follower.userId ? followerUserMap.get(follower.userId) : null;
      if (user?.email && !subscriberMap.has(user.email)) {
        subscriberMap.set(user.email, {
          id: `follower_${user.id}`,
          email: user.email,
          name: user.name || "Unknown",
          status: "active",
          source: `Follower: ${follower.project.title}`,
          sourceType: "follower",
          createdAt: follower.createdAt.toISOString(),
        });
      }
    }

    // Add backers
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

    // Add manual/imported subscribers
    for (const sub of manualSubscribers) {
      if (!subscriberMap.has(sub.email)) {
        const isImport = sub.source?.includes("creator_import:");
        subscriberMap.set(sub.email, {
          id: sub.id,
          email: sub.email,
          name: sub.name || "Unknown",
          status: sub.isActive ? "active" : "unsubscribed",
          source: isImport ? "CSV Import" : "Manual",
          sourceType: isImport ? "import" : "manual",
          createdAt: sub.createdAt.toISOString(),
        });
      }
    }

    const subscribers = Array.from(subscriberMap.values());

    const stats = {
      total: subscribers.length,
      active: subscribers.filter((s) => s.status === "active").length,
      unsubscribed: subscribers.filter((s) => s.status === "unsubscribed").length,
      bounced: 0,
    };

    return NextResponse.json({ subscribers, stats });
  } catch (error) {
    console.error("Error fetching subscribers:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscribers" },
      { status: 500 }
    );
  }
}

// POST - Manually add a subscriber
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

    // Check if already exists
    const existing = await db.newsletterSubscriber.findUnique({
      where: { email: emailLower },
    });

    if (existing) {
      return NextResponse.json({ error: "Subscriber already exists" }, { status: 400 });
    }

    const creatorTag = await getCreatorTag(session.user.id);

    const subscriber = await db.newsletterSubscriber.create({
      data: {
        email: emailLower,
        name: name?.trim() || null,
        source: `creator_manual:${creatorTag}`,
        isActive: true,
      },
    });

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
    console.error("Error adding subscriber:", error);
    return NextResponse.json(
      { error: "Failed to add subscriber" },
      { status: 500 }
    );
  }
}
