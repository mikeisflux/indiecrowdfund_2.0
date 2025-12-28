import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { queueEmail, EMAIL_PRIORITY } from "@/lib/email";

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
    const { subject, content, projectId, senderName, replyTo } = body;

    if (!subject?.trim() || !content?.trim()) {
      return NextResponse.json(
        { error: "Subject and content are required" },
        { status: 400 }
      );
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

    // Get project info if provided (for tracking/logging)
    let projectTitle = "Email Campaign";
    if (projectId) {
      const project = await db.project.findFirst({
        where: {
          id: projectId,
          creatorId: session.user.id,
        },
        select: { title: true },
      });
      if (project) {
        projectTitle = project.title;
      }
    }

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
              From <strong>${fromName}</strong>
            </p>
          </div>

          <h2 style="color: #333; margin-bottom: 20px;">${subject.trim()}</h2>

          <div style="padding: 20px 0;">
            ${content.trim().replace(/\n/g, "<br>")}
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
          subject: subject.trim(),
          html: htmlBody,
          text: content.trim(),
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
        errors.push(`${recipientEmail}: ${err}`);
      }
    }

    // Log activity if project is provided
    if (projectId) {
      try {
        await db.fulfillmentActivity.create({
          data: {
            projectId,
            type: "SURVEY_SENT",
            title: `Email campaign queued for ${queuedCount} subscribers`,
            description: `"${subject.trim()}" queued by ${fromName}`,
          },
        });
      } catch (activityError) {
        console.error("Failed to log campaign activity:", activityError);
      }
    }

    return NextResponse.json({
      campaign: {
        subject: subject.trim(),
        status: "queued",
        recipientCount: uniqueEmails.length,
        queuedCount,
        errorCount: errors.length,
        queuedAt: new Date().toISOString(),
      },
      message: `${queuedCount} emails queued for delivery. They will be sent at a rate of 1 per second.`,
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
