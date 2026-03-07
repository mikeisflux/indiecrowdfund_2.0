import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const emailTrackOpenLogger = logger.child({ module: "email-track-open" });
import { db } from "@/lib/db";

// 1x1 transparent PNG pixel
const TRACKING_PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

export const dynamic = "force-dynamic";

// GET - Track email open via tracking pixel
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get("c");
    const emailId = searchParams.get("e"); // Base64 encoded email

    if (campaignId && emailId) {
      const email = Buffer.from(emailId, "base64").toString("utf-8");

      // Update campaign open count
      await db.emailCampaign.update({
        where: { id: campaignId },
        data: { openCount: { increment: 1 } },
      });

      // Update email log if it exists
      await db.emailLog.updateMany({
        where: {
          recipientEmail: email,
          openedAt: null, // Only count first open
        },
        data: { openedAt: new Date() },
      });

      emailTrackOpenLogger.info(`Email opened: campaign=${campaignId}, email=${email}`);
    }

    // Return 1x1 transparent PNG
    return new NextResponse(TRACKING_PIXEL, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Length": TRACKING_PIXEL.length.toString(),
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    emailTrackOpenLogger.error({ err: String(error) }, "Error tracking email open:");
    // Still return pixel to not break email display
    return new NextResponse(TRACKING_PIXEL, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
      },
    });
  }
}
