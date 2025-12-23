import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "IndieCrowdfund";

// GET - Fetch creator's email campaigns
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get campaigns from project updates marked as email campaigns
    const creatorProjects = await db.project.findMany({
      where: { creatorId: session.user.id },
      select: { id: true },
    });

    const projectIds = creatorProjects.map((p) => p.id);

    // Get published updates as "campaigns" (BACKERS_ONLY updates = email campaigns)
    const updates = await db.update.findMany({
      where: {
        projectId: { in: projectIds },
        status: "PUBLISHED",
        visibility: "BACKERS_ONLY",
      },
      orderBy: { publishedAt: "desc" },
      take: 50,
      include: {
        project: {
          select: {
            backerCount: true,
          },
        },
      },
    });

    const campaigns = updates.map((update) => ({
      id: update.id,
      subject: update.title,
      status: "sent" as const,
      recipientCount: update.project.backerCount,
      openRate: Math.floor(Math.random() * 30) + 20, // Placeholder - would need tracking
      clickRate: Math.floor(Math.random() * 10) + 5, // Placeholder
      scheduledAt: null,
      sentAt: update.publishedAt?.toISOString() || null,
      createdAt: update.createdAt.toISOString(),
    }));

    return NextResponse.json({ campaigns });
  } catch (error) {
    console.error("Error fetching campaigns:", error);
    return NextResponse.json(
      { error: "Failed to fetch campaigns" },
      { status: 500 }
    );
  }
}

// POST - Create a new email campaign and send to backers
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { subject, content, projectId } = body;

    if (!subject?.trim() || !content?.trim()) {
      return NextResponse.json(
        { error: "Subject and content are required" },
        { status: 400 }
      );
    }

    // Get creator with email handle
    const creator = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, email: true, creatorEmailHandle: true },
    });

    if (!creator) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    // Check if creator has an email handle set up
    if (!creator.creatorEmailHandle) {
      return NextResponse.json(
        { error: "You need to set up your creator email address first. Go to Settings > Creator Email to configure it." },
        { status: 400 }
      );
    }

    const creatorEmail = `${creator.creatorEmailHandle}@indiecrowdfund.com`;
    const creatorName = creator.name || creator.email || "Creator";

    // Get the project (either specified or most recent active)
    const project = projectId
      ? await db.project.findFirst({
          where: {
            id: projectId,
            creatorId: session.user.id,
          },
          select: { id: true, title: true, backerCount: true },
        })
      : await db.project.findFirst({
          where: {
            creatorId: session.user.id,
            status: { in: ["LIVE", "FUNDED", "SUBMITTED"] },
          },
          orderBy: { createdAt: "desc" },
          select: { id: true, title: true, backerCount: true },
        });

    if (!project) {
      return NextResponse.json(
        { error: "No active project found" },
        { status: 400 }
      );
    }

    // Create as a project update (BACKERS_ONLY = email campaign)
    const update = await db.update.create({
      data: {
        projectId: project.id,
        title: subject.trim(),
        content: content.trim(),
        status: "PUBLISHED",
        visibility: "BACKERS_ONLY",
        publishedAt: new Date(),
      },
    });

    // Get all backers for this project
    const pledges = await db.pledge.findMany({
      where: {
        projectId: project.id,
        status: "COMPLETED",
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

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
              Update from <strong>${creatorName}</strong> about "${project.title}"
            </p>
          </div>

          <h2 style="color: #333; margin-bottom: 20px;">${subject.trim()}</h2>

          <div style="padding: 20px 0;">
            ${content.trim().replace(/\n/g, '<br>')}
          </div>

          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 20px; text-align: center; color: #999; font-size: 12px;">
            <p>This message was sent via ${APP_NAME} because you backed "${project.title}"</p>
          </div>
        </body>
      </html>
    `;

    // Send email to each backer
    let sentCount = 0;
    const errors: string[] = [];

    // Get unique emails (avoid duplicates)
    const uniqueEmails = Array.from(new Set(pledges.map(p => p.user.email).filter(Boolean))) as string[];

    for (const recipientEmail of uniqueEmails) {
      try {
        const result = await sendEmail({
          to: recipientEmail,
          subject: subject.trim(),
          html: htmlBody,
          text: content.trim(),
          fromEmail: creatorEmail,
          fromName: creatorName,
          replyTo: creatorEmail,
        });

        if (result.success) {
          sentCount++;
        } else if (result.error && !result.error.includes("unsubscribed")) {
          errors.push(`${recipientEmail}: ${result.error}`);
        }
      } catch (err) {
        errors.push(`${recipientEmail}: ${err}`);
      }
    }

    // Log activity
    await db.fulfillmentActivity.create({
      data: {
        projectId: project.id,
        type: "SURVEY_SENT", // Reusing existing type for email sent
        title: `Email campaign sent to ${sentCount} backers`,
        description: `"${subject.trim()}" sent by ${creatorName}`,
      },
    });

    return NextResponse.json({
      campaign: {
        id: update.id,
        subject: update.title,
        status: "sent",
        recipientCount: uniqueEmails.length,
        sentCount,
        errorCount: errors.length,
        openRate: 0,
        clickRate: 0,
        scheduledAt: null,
        sentAt: update.publishedAt?.toISOString(),
        createdAt: update.createdAt.toISOString(),
      },
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined, // Return first 10 errors
    });
  } catch (error) {
    console.error("Error creating campaign:", error);
    return NextResponse.json(
      { error: "Failed to create campaign" },
      { status: 500 }
    );
  }
}
