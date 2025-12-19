import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";

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

// Add tracking pixel and wrap links for click tracking
function addEmailTracking(html: string, campaignId: string, recipientEmail: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://indiecrowdfund.com";
  const encodedEmail = Buffer.from(recipientEmail).toString("base64");

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
    const encodedUrl = Buffer.from(url).toString("base64");
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
      console.log(`Resending campaign "${campaign.name}" (previously sent at ${campaign.status === "SENT" ? "earlier" : "never"})`);
    }

    // Update status to SENDING
    await db.emailCampaign.update({
      where: { id },
      data: { status: "SENDING" },
    });

    // Get recipients based on target audience (with names)
    const recipientMap = new Map<string, Recipient>();
    const audience = campaign.targetAudience || "all";

    switch (audience) {
      case "subscriber":
        // Get newsletter subscribers (excluding retailers)
        const [subscribers, verifiedUsers] = await Promise.all([
          db.newsletterSubscriber.findMany({
            where: {
              isActive: true,
              NOT: { source: { contains: "retailer", mode: "insensitive" } },
            },
            select: { email: true, name: true },
          }),
          db.user.findMany({
            where: { emailVerified: { not: null } },
            select: { email: true, name: true },
          }),
        ]);
        // Add subscribers
        subscribers.forEach((s: { email: string; name: string | null }) => {
          recipientMap.set(s.email.toLowerCase(), { email: s.email.toLowerCase(), name: s.name });
        });
        // Add/update with verified users (user names take priority)
        verifiedUsers.forEach(u => {
          const existing = recipientMap.get(u.email.toLowerCase());
          if (!existing || (u.name && !existing.name)) {
            recipientMap.set(u.email.toLowerCase(), { email: u.email.toLowerCase(), name: u.name });
          }
        });
        break;

      case "backer":
        const backerPledges = await db.pledge.findMany({
          where: { status: "COMPLETED" },
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

      default:
        // All verified users
        const allUsers = await db.user.findMany({
          where: { emailVerified: { not: null } },
          select: { email: true, name: true },
        });
        allUsers.forEach(u => {
          recipientMap.set(u.email.toLowerCase(), { email: u.email.toLowerCase(), name: u.name });
        });
    }

    const recipients = Array.from(recipientMap.values());

    console.log(`Sending campaign "${campaign.name}" to ${recipients.length} recipients`);

    let sentCount = 0;
    let failedCount = 0;

    // Send emails via SendGrid and log them
    let aborted = false;
    for (const recipient of recipients) {
      // Check if campaign was aborted every 10 emails
      if (sentCount % 10 === 0 && sentCount > 0) {
        const currentCampaign = await db.emailCampaign.findUnique({
          where: { id },
          select: { status: true },
        });
        if (currentCampaign?.status === "CANCELLED") {
          console.log(`Campaign "${campaign.name}" was aborted after ${sentCount} emails sent`);
          aborted = true;
          break;
        }
      }

      try {
        // Replace template variables with recipient data
        const personalizedSubject = replaceTemplateVariables(campaign.subject, recipient);
        let personalizedHtml = replaceTemplateVariables(campaign.htmlContent, recipient);

        // Add tracking pixel and click tracking
        personalizedHtml = addEmailTracking(personalizedHtml, campaign.id, recipient.email);

        // Actually send the email via SendGrid
        const result = await sendEmail({
          to: recipient.email,
          subject: personalizedSubject,
          html: personalizedHtml,
        });

        if (result.success) {
          // Log successful send
          await db.emailLog.create({
            data: {
              recipientEmail: recipient.email,
              subject: personalizedSubject,
              htmlContent: personalizedHtml,
              sentAt: new Date(),
              type: "WEEKLY_DISCOVERY",
            },
          });
          sentCount++;
        } else {
          failedCount++;
          console.error(`Failed to send email to ${recipient.email}:`, result.error);
        }
      } catch (err) {
        failedCount++;
        console.error(`Error sending email to ${recipient.email}:`, err);
      }
    }

    console.log(`Campaign "${campaign.name}" ${aborted ? "aborted" : "complete"}: ${sentCount} sent, ${failedCount} failed`);

    // Update campaign status
    if (!aborted) {
      await db.emailCampaign.update({
        where: { id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          sentCount,
          recipientCount: recipients.length,
        },
      });
    } else {
      // Update sent count even if aborted
      await db.emailCampaign.update({
        where: { id },
        data: {
          sentCount,
        },
      });
    }

    return NextResponse.json({
      success: true,
      aborted,
      message: aborted
        ? `Campaign "${campaign.name}" was aborted after sending ${sentCount} emails`
        : `Campaign "${campaign.name}" sent to ${sentCount} recipients`,
      sentCount,
      totalRecipients: recipients.length,
    });
  } catch (error) {
    console.error("Error sending campaign:", error);

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
      { error: "Failed to send campaign" },
      { status: 500 }
    );
  }
}
