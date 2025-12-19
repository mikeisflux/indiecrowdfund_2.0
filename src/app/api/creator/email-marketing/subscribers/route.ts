import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET - Fetch creator's subscribers (from project followers)
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all users who follow any of the creator's projects
    const creatorProjects = await db.project.findMany({
      where: { creatorId: session.user.id },
      select: { id: true },
    });

    const projectIds = creatorProjects.map((p) => p.id);

    // Get followers from ProjectFollower table
    const followers = await db.projectFollower.findMany({
      where: {
        projectId: { in: projectIds },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            createdAt: true,
          },
        },
        project: {
          select: {
            title: true,
          },
        },
      },
    });

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

    // Combine and deduplicate
    const subscriberMap = new Map<string, {
      id: string;
      email: string;
      name: string;
      status: "active" | "unsubscribed" | "bounced";
      source: string;
      createdAt: string;
    }>();

    // Add followers
    for (const follower of followers) {
      if (follower.user.email && !subscriberMap.has(follower.user.email)) {
        subscriberMap.set(follower.user.email, {
          id: follower.user.id,
          email: follower.user.email,
          name: follower.user.name || "Unknown",
          status: "active",
          source: `Follower: ${follower.project.title}`,
          createdAt: follower.createdAt.toISOString(),
        });
      }
    }

    // Add backers
    for (const backer of backers) {
      if (backer.user.email && !subscriberMap.has(backer.user.email)) {
        subscriberMap.set(backer.user.email, {
          id: backer.user.id,
          email: backer.user.email,
          name: backer.user.name || "Unknown",
          status: "active",
          source: "Backer",
          createdAt: backer.user.createdAt.toISOString(),
        });
      }
    }

    const subscribers = Array.from(subscriberMap.values());

    const stats = {
      total: subscribers.length,
      active: subscribers.filter((s) => s.status === "active").length,
      unsubscribed: 0,
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
