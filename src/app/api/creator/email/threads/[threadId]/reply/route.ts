import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendEmail, escapeHtmlForEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "IndieCrowdfund";

// POST - Send a reply to a thread
export async function POST(
  request: NextRequest,
  { params }: { params: { threadId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Thread ID format: senderId-projectId (projectId may be "null" or empty for direct messages)
    const [recipientId, projectId] = params.threadId.split("-");

    if (!recipientId) {
      return NextResponse.json({ error: "Invalid thread ID" }, { status: 400 });
    }

    // Handle null/undefined/empty projectId (direct messages without project association)
    const hasProject = projectId && projectId !== "null" && projectId !== "undefined";

    const body = await request.json();
    const { content } = body;

    if (!content?.trim()) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
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
        { error: "You need to set up your creator email address first." },
        { status: 400 }
      );
    }

    const creatorEmail = `${creator.creatorEmailHandle}@indiecrowdfund.com`;
    const creatorName = creator.name || creator.email || "Creator";

    // For messages with a project, verify access
    let project: { id: string; title: string } | null = null;

    if (hasProject) {
      // Verify the project exists and user has access (creator or collaborator)
      project = await db.project.findFirst({
        where: {
          id: projectId,
          creatorId: session.user.id,
        },
        select: { id: true, title: true },
      });

      // If not creator, check if user is a collaborator with permission
      if (!project) {
        const collaborator = await db.projectCollaborator.findFirst({
          where: {
            projectId,
            userId: session.user.id,
            status: "ACCEPTED",
            canManageCommunity: true,
          },
          include: {
            project: {
              select: { id: true, title: true },
            },
          },
        });

        if (collaborator) {
          project = collaborator.project;
        }
      }

      if (!project) {
        return NextResponse.json(
          { error: "Project not found or you don't have permission to send emails for this project" },
          { status: 404 }
        );
      }
    }

    // Get the recipient's info
    const recipient = await db.user.findUnique({
      where: { id: recipientId },
      select: { id: true, name: true, email: true },
    });

    if (!recipient?.email) {
      return NextResponse.json({ error: "Recipient not found" }, { status: 404 });
    }

    // Get the original thread to copy the subject
    const originalMessage = await db.message.findFirst({
      where: {
        projectId: hasProject ? projectId : null,
        senderId: recipientId,
        recipientId: session.user.id,
      },
      orderBy: { createdAt: "desc" },
    });

    const subject = originalMessage?.subject
      ? `Re: ${originalMessage.subject}`
      : project
        ? `Reply about "${project.title}"`
        : "Reply";

    // Send the actual email
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
              Reply from <strong>${creatorName}</strong>${project ? ` about "${project.title}"` : ""}
            </p>
          </div>

          <div style="padding: 20px 0;">
            ${escapeHtmlForEmail(content.trim()).replace(/\n/g, '<br>')}
          </div>

          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 20px; text-align: center; color: #999; font-size: 12px;">
            <p>This message was sent via ${APP_NAME}</p>
          </div>
        </body>
      </html>
    `;

    const emailResult = await sendEmail({
      to: recipient.email,
      subject,
      html: htmlBody,
      text: content.trim(),
      fromEmail: creatorEmail,
      fromName: creatorName,
      replyTo: creatorEmail,
      isCreatorEmail: true, // Mark as creator email for mailbox filtering
    });

    if (!emailResult.success) {
      console.error("Failed to send reply email:", emailResult.error);
      return NextResponse.json(
        { error: emailResult.error || "Failed to send email" },
        { status: 500 }
      );
    }

    // Create the reply message record
    const message = await db.message.create({
      data: {
        projectId: hasProject ? projectId : null,
        senderId: session.user.id,
        recipientId,
        subject,
        content: content.trim(),
        read: false,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    return NextResponse.json({
      message: {
        id: message.id,
        threadId: params.threadId,
        content: message.content,
        sender: {
          id: message.sender.id,
          name: message.sender.name || "Unknown",
          email: message.sender.email || "",
          image: message.sender.image,
          isCreator: true,
        },
        createdAt: message.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error sending reply:", error);
    return NextResponse.json(
      { error: "Failed to send reply" },
      { status: 500 }
    );
  }
}
