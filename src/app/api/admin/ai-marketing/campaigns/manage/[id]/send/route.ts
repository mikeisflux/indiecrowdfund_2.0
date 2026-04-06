import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminAiMarketingCampaignsManageSendLogger = logger.child({ module: "admin-ai-marketing-campaigns-manage-send" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { queueEmail, EMAIL_PRIORITY } from "@/lib/email";

export const dynamic = "force-dynamic";

// Recipient type with email and optional name
interface Recipient {
  email: string;
  name: string | null;
}

// Helper to check admin role
async function requireAdmin() {
  const session = await auth();

  if (!session?.user?.id) {
    return { error: "Unauthorized", status: 401 };
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
    return { error: "Forbidden - Admin access required", status: 403 };
  }

  return { user: session.user };
}

// Replace template variables in content
function replaceTemplateVariables(content: string, recipient: Recipient): string {
  let result = content;

  // Replace user name - use first name or "there" if no name
  const displayName = recipient.name
    ? recipient.name.split(' ')[0] // First name only
    : "there";

  result = result.replace(/\{\{USER_NAME\}\}/gi, displayName);
  result = result.replace(/\{\{NAME\}\}/gi, displayName);
  result = result.replace(/\{\{FIRST_NAME\}\}/gi, displayName);
  result = result.replace(/\{\{USER_EMAIL\}\}/gi, recipient.email);
  result = result.replace(/\{\{EMAIL\}\}/gi, recipient.email);

  return result;
}

// Convert relative URLs to absolute URLs for images and links
function convertRelativeUrls(html: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://indiecrowdfund.com";

  // Convert relative src attributes (images, etc.) to absolute URLs
  let result = html.replace(/src="\/([^"]*)"/gi, `src="${baseUrl}/$1"`);
  result = result.replace(/src='\/([^']*)'/gi, `src='${baseUrl}/$1'`);

  // Convert relative href attributes to absolute URLs (but not anchors like #section)
  result = result.replace(/href="\/([^#"][^"]*)"/gi, `href="${baseUrl}/$1"`);
  result = result.replace(/href='\/([^#'][^']*)'/gi, `href='${baseUrl}/$1'`);

  // Convert url() in inline styles (for background images)
  result = result.replace(/url\(["']?\/([^"')]+)["']?\)/gi, `url("${baseUrl}/$1")`);

  return result;
}

// Add tracking pixel and wrap links for click tracking
function addEmailTracking(html: string, campaignId: string, recipientEmail: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://indiecrowdfund.com";
  // Use encodeURIComponent so base64 chars (+, /, =) don't corrupt query parameters
  const encodedEmail = encodeURIComponent(Buffer.from(recipientEmail).toString("base64"));

  // Add tracking pixel before closing body tag
  const trackingPixel = `<img src="${baseUrl}/api/email/track/open?c=${campaignId}&e=${encodedEmail}" width="1" height="1" style="display:none;" alt="" />`;

  let result = html;

  // Add tracking pixel before </body> or at end if no body tag
  if (result.includes("</body>")) {
    result = result.replace("</body>", `${trackingPixel}</body>`);
  } else {
    result = result + trackingPixel;
  }

  // Optionally wrap links for click tracking (only external links to our site)
  // This wraps href links that point to our domain
  const linkRegex = /href="(https?:\/\/(?:www\.)?indiecrowdfund\.com[^"]*)"/gi;
  result = result.replace(linkRegex, (match, url) => {
    const encodedUrl = encodeURIComponent(Buffer.from(url).toString("base64"));
    return `href="${baseUrl}/api/email/track/click?c=${campaignId}&e=${encodedEmail}&url=${encodedUrl}"`;
  });

  return result;
}

// POST - Send campaign now
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { id } = await params;

    // Get campaign
    const campaign = await db.emailCampaign.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        subject: true,
        htmlContent: true,
        targetAudience: true,
        status: true,
        recipientCount: true,
        filters: true,
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Check if resend is requested
    const body = await request.json().catch(() => ({}));
    const isResend = body?.resend === true;

    // Check status
    if (campaign.status === "SENT" && !isResend) {
      return NextResponse.json(
        { error: "Campaign has already been sent. Use resend option to send again." },
        { status: 400 }
      );
    }

    if (campaign.status === "SENDING") {
      return NextResponse.json(
        { error: "Campaign is already being sent" },
        { status: 400 }
      );
    }

    // Log if this is a resend
    if (isResend) {
      adminAiMarketingCampaignsManageSendLogger.info(`Resending campaign "${campaign.name}" (previously sent at ${campaign.status === "SENT" ? "earlier" : "never"})`);
    }

    // Update status to SENDING
    await db.emailCampaign.update({
      where: { id },
      data: { status: "SENDING" },
    });

    // Get recipients based on target audience (with names)
    const recipientMap = new Map<string, Recipient>();
    const audience = campaign.targetAudience || "all";

    // Parse segment filters if available
    const filters = campaign.filters as { segments?: string[] } | null;
    const selectedSegmentIds = filters?.segments || [];

    switch (audience) {
      case "subscriber":
        // Get newsletter subscribers (excluding retailers)
        // If segments are selected, filter by segment tags
        let subscriberWhere: {
          isActive: boolean;
          NOT?: { source: { contains: string; mode: "insensitive" } };
          OR?: Array<{ tags: { has: string } } | { source: { in: string[] } }>;
        } = {
          isActive: true,
          NOT: { source: { contains: "retailer", mode: "insensitive" } },
        };

        // If specific segments are selected, filter by them
        if (selectedSegmentIds.length > 0) {
          // Build filters for each segment
          const segmentFilters: Array<{ tags: { has: string } } | { source: { in: string[] } }> = [];

          for (const segmentId of selectedSegmentIds) {
            if (segmentId.startsWith("source-")) {
              // Source-based segment - extract the source name
              const sourceName = segmentId.replace("source-", "");
              segmentFilters.push({ source: { in: [sourceName] } });
            } else if (segmentId.startsWith("tag-")) {
              // Tag-based segment - extract the tag name (preserve original case)
              const tagName = segmentId.replace(/^tag-/, "");
              segmentFilters.push({ tags: { has: tagName } });
            } else {
              // Legacy format or direct tag name
              segmentFilters.push({ tags: { has: segmentId } });
            }
          }

          if (segmentFilters.length > 0) {
            subscriberWhere = {
              isActive: true,
              OR: segmentFilters,
            };
          }
        }

        const [subscribers, verifiedUsers] = await Promise.all([
          db.newsletterSubscriber.findMany({
            where: subscriberWhere,
            select: { email: true, name: true, tags: true },
          }),
          // Only include verified users if no specific segments are selected
          selectedSegmentIds.length === 0
            ? db.user.findMany({
                where: { emailVerified: { not: null } },
                select: { email: true, name: true },
              })
            : Promise.resolve([]),
        ]);
        // Add subscribers
        subscribers.forEach((s: { email: string; name: string | null }) => {
          recipientMap.set(s.email.toLowerCase(), { email: s.email.toLowerCase(), name: s.name });
        });
        // Add/update with verified users (user names take priority) - only if no segment filter
        if (selectedSegmentIds.length === 0) {
          verifiedUsers.forEach(u => {
            const existing = recipientMap.get(u.email.toLowerCase());
            if (!existing || (u.name && !existing.name)) {
              recipientMap.set(u.email.toLowerCase(), { email: u.email.toLowerCase(), name: u.name });
            }
          });
        }
        break;

      case "backer":
        const backerPledges = await db.pledge.findMany({
          where: { status: "COMPLETED", deletedAt: null },
          select: { userId: true },
          distinct: ["userId"],
        });
        const backerUsers = await db.user.findMany({
          where: { id: { in: backerPledges.map(p => p.userId) } },
          select: { email: true, name: true },
        });
        backerUsers.forEach(u => {
          recipientMap.set(u.email.toLowerCase(), { email: u.email.toLowerCase(), name: u.name });
        });
        break;

      case "creator":
        const creators = await db.user.findMany({
          where: { createdProjects: { some: {} } },
          select: { email: true, name: true },
        });
        creators.forEach(c => {
          recipientMap.set(c.email.toLowerCase(), { email: c.email.toLowerCase(), name: c.name });
        });
        break;

      case "retailer":
        const retailers = await db.newsletterSubscriber.findMany({
          where: {
            isActive: true,
            source: { contains: "retailer", mode: "insensitive" },
          },
          select: { email: true, name: true },
        });
        retailers.forEach((r: { email: string; name: string | null }) => {
          recipientMap.set(r.email.toLowerCase(), { email: r.email.toLowerCase(), name: r.name });
        });
        break;

      default: {
        // "all" audience: if segments are selected, treat as subscriber query with segment filters.
        // Otherwise fall back to all verified platform users.
        if (selectedSegmentIds.length > 0) {
          const segmentFilters: Array<{ tags: { has: string } } | { source: { in: string[] } }> = [];
          for (const segmentId of selectedSegmentIds) {
            if (segmentId.startsWith("source-")) {
              const sourceName = segmentId.replace("source-", "");
              segmentFilters.push({ source: { in: [sourceName] } });
            } else if (segmentId.startsWith("tag-")) {
              const tagName = segmentId.replace(/^tag-/, "");
              segmentFilters.push({ tags: { has: tagName } });
            } else {
              segmentFilters.push({ tags: { has: segmentId } });
            }
          }
          const segmentSubscribers = await db.newsletterSubscriber.findMany({
            where: { isActive: true, OR: segmentFilters },
            select: { email: true, name: true },
          });
          segmentSubscribers.forEach((s: { email: string; name: string | null }) => {
            recipientMap.set(s.email.toLowerCase(), { email: s.email.toLowerCase(), name: s.name });
          });
        } else {
          const allUsers = await db.user.findMany({
            where: { emailVerified: { not: null } },
            select: { email: true, name: true },
          });
          allUsers.forEach(u => {
            recipientMap.set(u.email.toLowerCase(), { email: u.email.toLowerCase(), name: u.name });
          });
        }
        break;
      }
    }

    const recipients = Array.from(recipientMap.values());

    adminAiMarketingCampaignsManageSendLogger.info(`Queueing campaign "${campaign.name}" to ${recipients.length} recipients`);

    let queuedCount = 0;
    let failedCount = 0;
    const emailLogBatch: { recipientEmail: string; subject: string; htmlContent: string; sentAt: Date; type: string }[] = [];

    // Queue emails for rate-limited sending
    for (const recipient of recipients) {
      try {
        // Replace template variables with recipient data
        const personalizedSubject = replaceTemplateVariables(campaign.subject, recipient);
        let personalizedHtml = replaceTemplateVariables(campaign.htmlContent, recipient);

        // Convert relative URLs to absolute URLs for images
        personalizedHtml = convertRelativeUrls(personalizedHtml);

        // Add tracking pixel and click tracking
        personalizedHtml = addEmailTracking(personalizedHtml, campaign.id, recipient.email);

        // Queue the email with AI_MARKETING priority (lowest - 1)
        const result = await queueEmail({
          to: recipient.email,
          subject: personalizedSubject,
          html: personalizedHtml,
          priority: EMAIL_PRIORITY.AI_MARKETING, // Priority 1 - lowest
        });

        if (result.success) {
          emailLogBatch.push({
            recipientEmail: recipient.email,
            subject: personalizedSubject,
            htmlContent: personalizedHtml,
            sentAt: new Date(),
            type: "WEEKLY_DISCOVERY",
          });
          queuedCount++;
        } else {
          failedCount++;
          adminAiMarketingCampaignsManageSendLogger.error({ err: String(result.error) }, `Failed to queue email to ${recipient.email}:`);
        }
      } catch (err) {
        failedCount++;
        adminAiMarketingCampaignsManageSendLogger.error({ err: String(err) }, `Error queueing email to ${recipient.email}:`);
      }
    }

    // Batch insert all email logs (avoids N+1 queries)
    if (emailLogBatch.length > 0) {
      await db.emailLog.createMany({ data: emailLogBatch });
    }

    adminAiMarketingCampaignsManageSendLogger.info(`Campaign "${campaign.name}" queued: ${queuedCount} queued, ${failedCount} failed`);

    // Update campaign status to SENT (all emails have been queued)
    await db.emailCampaign.update({
      where: { id },
      data: {
        status: "SENT",
        sentAt: new Date(),
        sentCount: queuedCount,
        recipientCount: recipients.length,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Campaign "${campaign.name}" queued for ${queuedCount} recipients. Emails will be sent at 1 per second.`,
      queuedCount,
      failedCount,
      totalRecipients: recipients.length,
    });
  } catch (error) {
    adminAiMarketingCampaignsManageSendLogger.error({ err: String(error) }, "Error queueing campaign:");

    // Try to reset status if failed
    try {
      const { id } = await params;
      await db.emailCampaign.update({
        where: { id },
        data: { status: "DRAFT" },
      });
    } catch {
      // Ignore
    }

    return NextResponse.json(
      { error: "Failed to queue campaign" },
      { status: 500 }
    );
  }
}
