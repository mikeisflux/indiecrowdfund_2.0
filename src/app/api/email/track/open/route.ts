import { NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
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

      // Stamp openedAt on this recipient's most recent unread EmailLog
      // row -- best-effort, never gates the campaign counter on it. The
      // EmailLog schema has no campaignId, so we can't reliably scope
      // this to "this campaign's row for this recipient" -- the OR-of-
      // sentAt window is the closest we can get without a schema add.
      await db.emailLog.updateMany({
        where: { recipientEmail: email, openedAt: null },
        data: { openedAt: new Date() },
      });

      // Increment campaign openCount on every pixel hit.
      //
      // The previous version gated this on the EmailLog CAS above
      // (`if (logResult.count > 0)`), which sounded like dedup but was
      // actually catastrophically broken because EmailLog has no
      // campaignId: every campaign a recipient was in shares a single
      // global "did this recipient open ANY email" bit. So the FIRST
      // campaign a recipient opened "used up" the open bit, and every
      // subsequent campaign for that recipient saw count=0 -> skipped
      // the increment -> showed 0 opens in IndieKit even when the
      // person obviously opened them.
      //
      // The realistic trade-off is:
      //   - Pre-fix:  5x under-count (the bug you noticed -- 549/12702
      //               vs. the ~30+ confirmed actual opens of a single
      //               campaign).
      //   - Now:      Some prefetch over-count from mail clients that
      //               fetch the pixel before the user opens (Gmail's
      //               image proxy fetches once at delivery, Apple Mail
      //               Privacy fetches blind via proxy, etc.). This is
      //               the standard floor for HTML-pixel tracking and
      //               every email platform lives with it. Real-world
      //               inflation is ~20-40% on a normal audience.
      // True per-(recipient, campaign) dedup needs a
      // EmailCampaignOpen model (campaignId + email composite key);
      // worth adding later. For now correctness beats precision.
      await db.emailCampaign.update({
        where: { id: campaignId },
        data: { openCount: { increment: 1 } },
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
    emailTrackOpenLogger.error({ err: formatError(error) }, "Error tracking email open:");
    // Still return pixel to not break email display
    return new NextResponse(TRACKING_PIXEL, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
      },
    });
  }
}
