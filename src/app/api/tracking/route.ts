import { NextRequest, NextResponse } from "next/server";
import { trackEvent, trackProjectView, trackReferrer } from "@/lib/tracking";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      eventType,
      userId,
      sessionId,
      projectId,
      rewardId,
      metadata,
      referrer,
      page,
    } = body;

    // Validate required fields
    if (!eventType || !sessionId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Handle different event types
    switch (eventType) {
      case "PROJECT_VIEW":
        if (projectId) {
          await trackProjectView(projectId, userId, sessionId, referrer);
          if (referrer) {
            await trackReferrer(projectId, referrer);
          }
        }
        break;

      default:
        await trackEvent({
          eventType,
          userId,
          sessionId,
          projectId,
          rewardId,
          metadata,
          referrer,
          page,
        });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Tracking error:", error);
    // Return success anyway - tracking shouldn't fail requests
    return NextResponse.json({ success: true });
  }
}
