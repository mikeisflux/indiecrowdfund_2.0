import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const cronScheduledCampaignsLogger = logger.child({ module: "cron-scheduled-campaigns" });
import { db } from "@/lib/db";
import { queueEmail, EMAIL_PRIORITY, escapeHtmlForEmail as escapeHtml } from "@/lib/email";

// Cron job to process scheduled email campaigns
//
// Checks for campaigns with status SCHEDULED and scheduledFor <= now,
// then queues emails for delivery via the email queue system.
//
// Schedule: Every 5 minutes
// Security: Protected by CRON_SECRET environment variable

export const dynamic = "force-dynamic";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "IndieCrowdfund";
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://indiecrowdfund.com";

// Add tracking pixel and wrap links for click tracking
function addEmailTracking(html: string, campaignId: string, recipientEmail: string): string {
  const encodedEmail = Buffer.from(recipientEmail).toString("base64");

  // Add tracking pixel before </body> or at end
  const trackingPixel = `<img src="${BASE_URL}/api/email/track/open?c=${campaignId}&e=${encodedEmail}" width="1" height="1" style="display:none;" alt="" />`;

  let result = html;
  if (result.includes("</body>")) {
    result = result.replace("</body>", `${trackingPixel}</body>`);
  } else {
    result = result + trackingPixel;
  }

  // Wrap internal links for click tracking
  const linkRegex = /href="(https?:\/\/(?:www\.)?indiecrowdfund\.com[^"]*)"/gi;
  result = result.replace(linkRegex, (_, url) => {
    const encodedUrl = Buffer.from(url).toString("base64");
    return `href="${BASE_URL}/api/email/track/click?c=${campaignId}&e=${encodedEmail}&url=${encodedUrl}"`;
  });

  return result;
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find campaigns that are due to be sent
    const dueCampaigns = await db.emailCampaign.findMany({
      where: {
        status: "SCHEDULED",
        scheduledFor: { lte: new Date() },
      },
      take: 5, // Process up to 5 campaigns per run
    });

    if (dueCampaigns.length === 0) {
      return NextResponse.json({ processed: 0, message: "No scheduled campaigns due" });
    }

    const results = [];

    for (const campaign of dueCampaigns) {
      try {
        // Atomic compare-and-swap on status to prevent double-processing.
        // Without this, if two cron ticks overlap (a previous run is still
        // processing when the next one fires), both runs would findMany
        // the same SCHEDULED campaigns, both mark them as SENDING, and
        // both send the same campaign. updateMany with a status=SCHEDULED
        // WHERE clause ensures only one caller wins the race.
        const claim = await db.emailCampaign.updateMany({
          where: { id: campaign.id, status: "SCHEDULED" },
          data: { status: "SENDING" },
        });

        if (claim.count === 0) {
          // Another cron tick already claimed this campaign.
          results.push({ id: campaign.id, status: "skipped", reason: "Already being sent by another cron tick" });
          continue;
        }

        // Get creator info
        const creator = await db.user.findFirst({
          where: { id: campaign.createdBy, deletedAt: null },
          select: { id: true, name: true, email: true, creatorEmailHandle: true },
        });

        if (!creator) {
          await db.emailCampaign.update({
            where: { id: campaign.id },
            data: { status: "CANCELLED" },
          });
          results.push({ id: campaign.id, status: "cancelled", reason: "Creator not found" });
          continue;
        }

        const filters = campaign.filters as Record<string, string> | null;
        const fromEmail = creator.creatorEmailHandle
          ? `${creator.creatorEmailHandle}@indiecrowdfund.com`
          : process.env.EMAIL_FROM || "noreply@indiecrowdfund.com";
        const fromName = filters?.senderName || creator.name || creator.email || APP_NAME;
        const replyToEmail = filters?.replyTo || creator.email || fromEmail;

        // Get subscribers
        const subscribers = await db.emailListSubscriber.findMany({
          where: { creatorId: creator.id, status: "subscribed" },
          select: { email: true },
        });

        const uniqueEmails = Array.from(new Set(subscribers.map((s: { email: string }) => s.email).filter(Boolean)));

        // Build email HTML
        const htmlBody = `
          <!DOCTYPE html>
          <html>
            <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #333; margin: 0;">${APP_NAME}</h1>
              </div>
              <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">From <strong>${escapeHtml(fromName)}</strong></p>
              </div>
              <h2 style="color: #333; margin-bottom: 20px;">${escapeHtml(campaign.subject)}</h2>
              <div style="padding: 20px 0;">${campaign.htmlContent}</div>
              <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 20px; text-align: center; color: #999; font-size: 12px;">
                <p>This message was sent via ${APP_NAME}</p>
              </div>
            </body>
          </html>
        `;

        let queuedCount = 0;
        for (const recipientEmail of uniqueEmails) {
          try {
            // Add open/click tracking for this recipient
            const trackedHtml = addEmailTracking(htmlBody, campaign.id, recipientEmail as string);

            const result = await queueEmail({
              to: recipientEmail as string,
              subject: campaign.subject,
              html: trackedHtml,
              text: campaign.htmlContent || "",
              fromEmail,
              fromName,
              replyTo: replyToEmail,
              isCreatorEmail: !!creator.creatorEmailHandle,
              priority: EMAIL_PRIORITY.CREATOR,
            });
            if (result.success) queuedCount++;
          } catch {
            // Continue with remaining emails
          }
        }

        // Update campaign as sent
        await db.emailCampaign.update({
          where: { id: campaign.id },
          data: {
            status: "SENT",
            sentAt: new Date(),
            recipientCount: uniqueEmails.length,
            sentCount: queuedCount,
          },
        });

        results.push({ id: campaign.id, status: "sent", queued: queuedCount, total: uniqueEmails.length });
      } catch (error) {
        cronScheduledCampaignsLogger.error({ err: formatError(error) }, `Failed to process scheduled campaign ${campaign.id}:`);
        // Reset to SCHEDULED so it can be retried
        await db.emailCampaign.update({
          where: { id: campaign.id },
          data: { status: "SCHEDULED" },
        });
        results.push({ id: campaign.id, status: "error" });
      }
    }

    return NextResponse.json({ processed: results.length, results });
  } catch (error) {
    cronScheduledCampaignsLogger.error({ err: formatError(error) }, "Scheduled campaigns cron error:");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
