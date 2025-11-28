import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

// Allow CORS for tracking requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

// POST - Log a behavior event
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      eventType,
      sessionId,
      projectId,
      categoryId,
      rewardId,
      searchQuery,
      path,
      referrer,
      timeSpent,
      scrollDepth,
      metadata,
    } = body;

    // Validate required fields
    if (!eventType || !sessionId || !path) {
      return NextResponse.json(
        { error: "Missing required fields: eventType, sessionId, path" },
        { status: 400 }
      );
    }

    // Valid event types
    const validEventTypes = [
      "PAGE_VIEW",
      "PAGE_EXIT",
      "PROJECT_VIEW",
      "PROJECT_CLICK",
      "REWARD_CLICK",
      "VIDEO_PLAY",
      "VIDEO_COMPLETE",
      "SEARCH",
      "FILTER_APPLY",
      "PROJECT_SAVE",
      "PROJECT_SHARE",
      "COMMENT_POST",
      "PLEDGE_START",
      "PLEDGE_COMPLETE",
      "SCROLL_DEPTH",
      "HOVER",
      "CREATOR_VIEW",
    ];

    if (!validEventTypes.includes(eventType)) {
      return NextResponse.json(
        { error: `Invalid event type. Must be one of: ${validEventTypes.join(", ")}` },
        { status: 400 }
      );
    }

    // Get user ID if authenticated
    let userId: string | null = null;
    try {
      const session = await auth();
      userId = session?.user?.id || null;
    } catch {
      // Not authenticated, that's fine
    }

    // Get request metadata
    const headersList = await headers();
    const userAgent = headersList.get("user-agent") || undefined;
    const forwardedFor = headersList.get("x-forwarded-for");
    const realIp = headersList.get("x-real-ip");
    const ipAddress = forwardedFor?.split(",")[0] || realIp || undefined;

    // Create the behavior record
    await db.userBehavior.create({
      data: {
        userId,
        sessionId,
        eventType: eventType as "PAGE_VIEW" | "PAGE_EXIT" | "PROJECT_VIEW" | "PROJECT_CLICK" | "REWARD_CLICK" | "VIDEO_PLAY" | "VIDEO_COMPLETE" | "SEARCH" | "FILTER_APPLY" | "PROJECT_SAVE" | "PROJECT_SHARE" | "COMMENT_POST" | "PLEDGE_START" | "PLEDGE_COMPLETE" | "SCROLL_DEPTH" | "HOVER" | "CREATOR_VIEW",
        projectId: projectId || null,
        categoryId: categoryId || null,
        rewardId: rewardId || null,
        searchQuery: searchQuery || null,
        path,
        referrer: referrer || null,
        userAgent,
        ipAddress,
        timeSpent: timeSpent ? parseInt(timeSpent) : null,
        scrollDepth: scrollDepth ? parseFloat(scrollDepth) : null,
        metadata: metadata || null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error logging behavior:", error);
    return NextResponse.json(
      { error: "Failed to log behavior" },
      { status: 500 }
    );
  }
}
