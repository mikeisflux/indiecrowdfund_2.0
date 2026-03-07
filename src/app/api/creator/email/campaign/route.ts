import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { queueEmail, EMAIL_PRIORITY, escapeHtmlForEmail as escapeHtml } from "@/lib/email";

export const dynamic = "force-dynamic";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "IndieCrowdfund";

// POST - Send email campaign to creator's email list subscribers
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { subject, content, projectId, senderName, replyTo, scheduledFor } = body;

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
    const creator = await db.user.findUnique({
      where: { id: session.user.id },
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
    const subscribers = await db.emailListSubscriber.findMany({
      where: {
        creatorId: session.user.id,
        status: "subscribed",
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
    if (projectId) {
      const project = await db.project.findUnique({
        where: { id: projectId },
        select: { title: true, slug: true, creator: { select: { vanityUrl: true } } },
      });
      if (project) {
        projectName = project.title;
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        projectUrl = `${appUrl}/projects/${project.creator?.vanityUrl || "creator"}/${project.slug}`;
      }
    }

    const resolveVars = (text: string) =>
      text
        .replace(/\{\{PROJECT_NAME\}\}/g, escapeHtml(projectName))
        .replace(/\{\{CREATOR_NAME\}\}/g, escapeHtml(fromName))
        .replace(/\{\{PROJECT_URL\}\}/g, projectUrl);

    const resolvedSubject = subject.trim().replace(/\{\{PROJECT_NAME\}\}/g, projectName).replace(/\{\{CREATOR_NAME\}\}/g, fromName);
    const resolvedContent = resolveVars(content.trim());

    // Build email HTML
    const htmlBody = `
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

          <div style="padding: 20px 0;">
            ${resolvedContent}
          </div>

          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 20px; text-align: center; color: #999; font-size: 12px;">
            <p>This message was sent via ${APP_NAME}</p>
          </div>
        </body>
      </html>
    `;

    // Queue emails for each subscriber (rate-limited sending via queue)
    let queuedCount = 0;
    const errors: string[] = [];

    // Get unique emails
    const uniqueEmails = Array.from(
      new Set(subscribers.map((s: { email: string; name: string | null }) => s.email).filter(Boolean))
    ) as string[];

    for (const recipientEmail of uniqueEmails) {
      try {
        const result = await queueEmail({
          to: recipientEmail,
          subject: resolvedSubject,
          html: htmlBody,
          text: resolvedContent,
          fromEmail,
          fromName,
          replyTo: replyToEmail,
          isCreatorEmail: !!creator.creatorEmailHandle,
          priority: EMAIL_PRIORITY.CREATOR,
        });

        if (result.success) {
          queuedCount++;
        } else {
          errors.push(`${recipientEmail}: ${result.error}`);
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        errors.push(`${recipientEmail}: ${errMsg}`);
      }
    }

    // Create EmailCampaign record to track this campaign
    const campaign = await db.emailCampaign.create({
      data: {
        name: resolvedSubject,
        subject: resolvedSubject,
        htmlContent: resolvedContent,
        status: "SENT",
        sentAt: new Date(),
        recipientCount: uniqueEmails.length,
        sentCount: queuedCount,
        openCount: 0,
        clickCount: 0,
        createdBy: session.user.id,
        filters: projectId ? { projectId } : undefined,
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
        console.error("Failed to log campaign activity:", activityError);
      }
    }

    return NextResponse.json({
      campaign: {
        id: campaign.id,
        subject: subject.trim(),
        status: "sent",
        recipientCount: uniqueEmails.length,
        sentCount: queuedCount,
        errorCount: errors.length,
        sentAt: new Date().toISOString(),
      },
      message: `Campaign sent to ${queuedCount} subscribers!`,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    });
  } catch (error) {
    console.error("Error sending campaign:", error);
    return NextResponse.json(
      { error: "Failed to send campaign" },
      { status: 500 }
    );
  }
}
