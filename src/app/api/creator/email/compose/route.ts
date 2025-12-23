import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "IndieCrowdfund";

// POST - Compose and send a new email
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { to, subject, content, projectId } = body;

    if (!to?.trim()) {
      return NextResponse.json({ error: "Recipient email is required" }, { status: 400 });
    }

    if (!content?.trim()) {
      return NextResponse.json({ error: "Message content is required" }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to.trim())) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    // Get sender info including their creator email handle
    const sender = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, email: true, creatorEmailHandle: true },
    });

    if (!sender) {
      return NextResponse.json({ error: "Sender not found" }, { status: 404 });
    }

    // Check if creator has an email handle set up
    if (!sender.creatorEmailHandle) {
      return NextResponse.json(
        { error: "You need to set up your creator email address first. Go to Settings > Creator Email to configure it." },
        { status: 400 }
      );
    }

    // Creator's email address (e.g., divinitycomics@indiecrowdfund.com)
    const creatorEmail = `${sender.creatorEmailHandle}@indiecrowdfund.com`;

    // Can't send to yourself
    if (to.trim().toLowerCase() === sender.email?.toLowerCase()) {
      return NextResponse.json(
        { error: "You cannot send an email to yourself" },
        { status: 400 }
      );
    }

    // If projectId provided, verify creator owns it
    let project = null;
    if (projectId) {
      project = await db.project.findFirst({
        where: {
          id: projectId,
          creatorId: session.user.id,
        },
        select: { id: true, title: true },
      });

      if (!project) {
        return NextResponse.json(
          { error: "Project not found or you're not the creator" },
          { status: 404 }
        );
      }
    }

    // Build email HTML
    const senderName = sender.name || sender.email || "Creator";
    const emailSubject = subject?.trim() || (project ? `Message about "${project.title}"` : "Message from creator");

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
              Message from <strong>${senderName}</strong>${project ? ` about "${project.title}"` : ""}
            </p>
          </div>

          <div style="padding: 20px 0;">
            ${content.trim().replace(/\n/g, '<br>')}
          </div>

          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 20px; text-align: center; color: #999; font-size: 12px;">
            <p>This message was sent via ${APP_NAME}</p>
          </div>
        </body>
      </html>
    `;

    // Send the actual email from the creator's email address
    const result = await sendEmail({
      to: to.trim(),
      subject: emailSubject,
      html: htmlBody,
      text: content.trim(),
      fromEmail: creatorEmail,
      fromName: senderName,
      replyTo: creatorEmail, // Replies go to the creator's email
      isCreatorEmail: true, // Mark as creator email for mailbox filtering
    });

    if (!result.success) {
      console.error("Failed to send email:", result.error);
      return NextResponse.json(
        { error: result.error || "Failed to send email" },
        { status: 500 }
      );
    }

    // Also create an internal message record if recipient has an account
    const recipient = await db.user.findUnique({
      where: { email: to.trim().toLowerCase() },
      select: { id: true, name: true, email: true },
    });

    let messageRecord = null;
    if (recipient) {
      messageRecord = await db.message.create({
        data: {
          senderId: session.user.id,
          recipientId: recipient.id,
          projectId: projectId || null,
          subject: emailSubject,
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
          recipient: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: messageRecord ? {
        id: messageRecord.id,
        subject: messageRecord.subject,
        content: messageRecord.content,
        recipient: messageRecord.recipient,
        createdAt: messageRecord.createdAt.toISOString(),
      } : {
        subject: emailSubject,
        content: content.trim(),
        recipient: { email: to.trim() },
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error composing email:", error);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}
