import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const creatorEmailCampaignLogger = logger.child({ module: "creator-email-campaign" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { queueEmail, EMAIL_PRIORITY, escapeHtmlForEmail as escapeHtml } from "@/lib/email";
import {
  resolveTemplateVars,
  resolveTemplateVarsForSubject,
  extractFirstName,
} from "@/lib/email/template-vars";

export const dynamic = "force-dynamic";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "IndieCrowdfund";

function addEmailTracking(html: string, campaignId: string, recipientEmail: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://indiecrowdfund.com";
  const encodedEmail = Buffer.from(recipientEmail).toString("base64");

  const trackingPixel = `<img src="${baseUrl}/api/email/track/open?c=${campaignId}&e=${encodedEmail}" width="1" height="1" style="display:none;" alt="" />`;

  let result = html;
  if (result.includes("</body>")) {
    result = result.replace("</body>", `${trackingPixel}</body>`);
  } else {
    result = result + trackingPixel;
  }

  const linkRegex = /href="(https?:\/\/(?:www\.)?indiecrowdfund\.com[^"]*)"/gi;
  result = result.replace(linkRegex, (_match, url) => {
    const encodedUrl = Buffer.from(url).toString("base64");
    return `href="${baseUrl}/api/email/track/click?c=${campaignId}&e=${encodedEmail}&url=${encodedUrl}"`;
  });

  return result;
}

// POST - Send email campaign to creator's email list subscribers
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { subject, content, projectId, senderName, replyTo, scheduledFor } = body;
    // Optional list of EmailListSubscriber.source values to filter to.
    // When omitted/empty, send to all subscribed members (back-compat).
    const sources: string[] | undefined = Array.isArray(body.sources)
      ? body.sources.filter((s: unknown): s is string => typeof s === "string")
      : undefined;

    if (!subject?.trim() || !content?.trim()) {
      return NextResponse.json(
        { error: "Subject and content are required" },
        { status: 400 }
      );
    }

    // Handle scheduled campaigns - save without sending
    if (scheduledFor) {
      const scheduledDate = new Date(scheduledFor);
      if (scheduledDate <= new Date()) {
        return NextResponse.json(
          { error: "Scheduled date must be in the future" },
          { status: 400 }
        );
      }

      const campaign = await db.emailCampaign.create({
        data: {
          name: subject.trim(),
          subject: subject.trim(),
          htmlContent: content.trim(),
          status: "SCHEDULED",
          scheduledFor: scheduledDate,
          recipientCount: 0,
          sentCount: 0,
          openCount: 0,
          clickCount: 0,
          createdBy: session.user.id,
          filters: {
            projectId: projectId || undefined,
            senderName: senderName || undefined,
            replyTo: replyTo || undefined,
            sources: sources && sources.length > 0 ? sources : undefined,
          },
        },
      });

      return NextResponse.json({
        success: true,
        message: `Campaign scheduled for ${scheduledDate.toLocaleString()}`,
        campaign,
      });
    }

    // Get creator info
    const creator = await db.user.findFirst({
      where: { id: session.user.id, deletedAt: null },
      select: { id: true, name: true, email: true, creatorEmailHandle: true },
    });

    if (!creator) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    // Determine from email - use creator email handle if set, otherwise use system email
    const fromEmail = creator.creatorEmailHandle
      ? `${creator.creatorEmailHandle}@indiecrowdfund.com`
      : process.env.EMAIL_FROM || "noreply@indiecrowdfund.com";
    const fromName = senderName || creator.name || creator.email || APP_NAME;
    const replyToEmail = replyTo || creator.email || fromEmail;

    // Get all subscribed members from creator's email list
    // Optional source filter: when provided, only send to subscribers
    // whose `source` matches one of the listed values. Unknown sources
    // are silently ignored — empty intersection just means zero
    // recipients which the no-subscribers check below catches.
    const subscribers = await db.emailListSubscriber.findMany({
      where: {
        creatorId: session.user.id,
        status: "subscribed",
        ...(Array.isArray(sources) && sources.length > 0
          ? { source: { in: sources } }
          : {}),
      },
      select: { email: true, name: true },
    });

    if (subscribers.length === 0) {
      return NextResponse.json(
        { error: "No subscribers in your email list" },
        { status: 400 }
      );
    }

    // Resolve personalization variables
    let projectName = "";
    let projectUrl = "";
    let prelaunchUrl = "";
    if (projectId) {
      const project = await db.project.findFirst({
        where: {
          id: projectId,
          deletedAt: null,
          OR: [
            { creatorId: session.user.id },
            { collaborators: { some: { userId: session.user.id, status: "ACCEPTED" } } },
          ],
        },
        select: { title: true, slug: true, creator: { select: { vanityUrl: true } } },
      });
      if (!project) {
        return NextResponse.json(
          { error: "Project not found or access denied" },
          { status: 403 }
        );
      }
      projectName = project.title;
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const vanity = project.creator?.vanityUrl || "creator";
      projectUrl = `${appUrl}/projects/${vanity}/${project.slug}`;
      prelaunchUrl = `${appUrl}/projects/${vanity}/${project.slug}/prelaunch`;
    }

    // Campaign-level (recipient-independent) vars. FIRST_NAME / NAME
    // are filled per-recipient inside the send loop below.
    const campaignVars = {
      projectName,
      projectUrl,
      prelaunchUrl,
      creatorName: fromName,
    };

    // Subject doesn't need per-recipient personalization (most subjects
    // don't reference FIRST_NAME, and personalizing the subject hurts
    // deliverability by making every recipient see a unique subject
    // line). Resolve campaign-level vars only.
    const resolvedSubject = resolveTemplateVarsForSubject(subject.trim(), campaignVars);

    // EmailCampaign log row gets the body with campaign-level vars
    // resolved (FIRST_NAME left as-is). Per-recipient FIRST_NAME
    // substitution happens just before each send so the log shows
    // the template, not whichever subscriber's name we happened to
    // resolve into it first.
    const campaignBodyTemplate = resolveTemplateVars(content.trim(), campaignVars);

    // Build email HTML for a single recipient. The body is wrapped
    // once per recipient because {{FIRST_NAME}} substitution happens
    // before this point.
    const buildHtmlBody = (bodyHtml: string) => `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #333; margin: 0;">${APP_NAME}</h1>
          </div>

          <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">
              From <strong>${escapeHtml(fromName)}</strong>
            </p>
          </div>

          <h2 style="color: #333; margin-bottom: 20px;">${escapeHtml(resolvedSubject)}</h2>

          <div style="padding: 20px 0; white-space: pre-wrap;">
            ${bodyHtml}
          </div>

          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 20px; text-align: center; color: #999; font-size: 12px;">
            <p>This message was sent via ${APP_NAME}</p>
          </div>
        </body>
      </html>
    `;

    // Dedupe subscribers by email (keep the FIRST occurrence's name so
    // we have a per-recipient name available for {{FIRST_NAME}}).
    const seen = new Set<string>();
    const uniqueRecipients: { email: string; name: string | null }[] = [];
    for (const s of subscribers as { email: string; name: string | null }[]) {
      if (!s.email || seen.has(s.email)) continue;
      seen.add(s.email);
      uniqueRecipients.push({ email: s.email, name: s.name });
    }

    // Create EmailCampaign record first so we have an ID for tracking pixels
    const campaign = await db.emailCampaign.create({
      data: {
        name: resolvedSubject,
        subject: resolvedSubject,
        htmlContent: campaignBodyTemplate,
        status: "SENDING",
        recipientCount: uniqueRecipients.length,
        sentCount: 0,
        openCount: 0,
        clickCount: 0,
        createdBy: session.user.id,
        filters: (projectId || (sources && sources.length > 0))
          ? { projectId: projectId || undefined, sources: sources && sources.length > 0 ? sources : undefined }
          : undefined,
      },
    });

    // Queue emails for each subscriber (rate-limited sending via queue)
    let queuedCount = 0;
    const errors: string[] = [];

    for (const recipient of uniqueRecipients) {
      try {
        // Per-recipient FIRST_NAME / NAME substitution. campaignVars
        // are still applied here in case a creator typed e.g.
        // {{PROJECT_NAME}} after the template's first pass — idempotent.
        //
        // recipientEmail is passed so extractFirstName can fall through
        // to the email's local part ("john.smith@…" → "John") when the
        // subscriber row has no name at all — better than emitting a
        // bare "Friend, the wait is over!" greeting.
        const personalizedBody = resolveTemplateVars(campaignBodyTemplate, {
          firstName: extractFirstName(recipient.name, recipient.email),
          fullName: recipient.name,
          recipientEmail: recipient.email,
          ...campaignVars,
        });
        const recipientHtml = buildHtmlBody(personalizedBody);
        const trackedHtml = addEmailTracking(recipientHtml, campaign.id, recipient.email);

        const result = await queueEmail({
          to: recipient.email,
          subject: resolvedSubject,
          html: trackedHtml,
          text: personalizedBody,
          fromEmail,
          fromName,
          replyTo: replyToEmail,
          isCreatorEmail: !!creator.creatorEmailHandle,
          priority: EMAIL_PRIORITY.CREATOR,
        });

        if (result.success) {
          queuedCount++;
        } else {
          errors.push(`${recipient.email}: ${result.error}`);
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        errors.push(`${recipient.email}: ${errMsg}`);
      }
    }

    // Update campaign with final sent count and status
    await db.emailCampaign.update({
      where: { id: campaign.id },
      data: {
        status: "SENT",
        sentAt: new Date(),
        sentCount: queuedCount,
      },
    });

    // Log activity if project is provided
    if (projectId) {
      try {
        await db.fulfillmentActivity.create({
          data: {
            projectId,
            type: "SURVEY_SENT",
            title: `Email campaign sent to ${queuedCount} subscribers`,
            description: `"${subject.trim()}" sent by ${fromName}`,
          },
        });
      } catch (activityError) {
        creatorEmailCampaignLogger.error({ err: String(activityError) }, "Failed to log campaign activity:");
      }
    }

    return NextResponse.json({
      campaign: {
        id: campaign.id,
        subject: subject.trim(),
        status: "sent",
        recipientCount: uniqueRecipients.length,
        sentCount: queuedCount,
        errorCount: errors.length,
        sentAt: new Date().toISOString(),
      },
      message: `Campaign sent to ${queuedCount} subscribers!`,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    });
  } catch (error) {
    creatorEmailCampaignLogger.error({ err: String(error) }, "Error sending campaign:");
    return NextResponse.json(
      { error: "Failed to send campaign" },
      { status: 500 }
    );
  }
}
