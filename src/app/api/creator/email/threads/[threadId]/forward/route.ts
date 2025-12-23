import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "IndieCrowdfund";

// POST - Forward a thread to another user
export async function POST(
  request: NextRequest,
  { params }: { params: { threadId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Thread ID format: senderId-projectId
    const [originalSenderId, projectId] = params.threadId.split("-");

    if (!originalSenderId || !projectId) {
      return NextResponse.json({ error: "Invalid thread ID" }, { status: 400 });
    }

    const body = await request.json();
    const { to, additionalMessage } = body;

    if (!to?.trim()) {
      return NextResponse.json({ error: "Recipient email is required" }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to.trim())) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
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

    // Can't forward to yourself
    if (to.trim().toLowerCase() === creator.email?.toLowerCase()) {
      return NextResponse.json(
        { error: "You cannot forward an email to yourself" },
        { status: 400 }
      );
    }

    // Get the original thread messages
    const originalMessages = await db.message.findMany({
      where: {
        projectId,
        OR: [
          {
            senderId: originalSenderId,
            recipientId: session.user.id,
          },
          {
            senderId: session.user.id,
            recipientId: originalSenderId,
          },
        ],
      },
      include: {
        sender: {
          select: { name: true, email: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    if (originalMessages.length === 0) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    // Build forwarded content
    const originalSubject = originalMessages[0]?.subject || "No Subject";
    const forwardedContent = originalMessages
      .map((msg: typeof originalMessages[number]) => {
        const senderName = msg.sender.name || msg.sender.email;
        const date = msg.createdAt.toLocaleString();
        return `--- Forwarded from ${senderName} on ${date} ---\n${msg.content}`;
      })
      .join("\n\n");

    const fullContent = additionalMessage
      ? `${additionalMessage}\n\n${forwardedContent}`
      : forwardedContent;

    const subject = `Fwd: ${originalSubject}`;

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
              Forwarded message from <strong>${creatorName}</strong>
            </p>
          </div>

          <div style="padding: 20px 0;">
            ${fullContent.replace(/\n/g, '<br>')}
          </div>

          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 20px; text-align: center; color: #999; font-size: 12px;">
            <p>This message was sent via ${APP_NAME}</p>
          </div>
        </body>
      </html>
    `;

    // Send the actual email
    const emailResult = await sendEmail({
      to: to.trim(),
      subject,
      html: htmlBody,
      text: fullContent,
      fromEmail: creatorEmail,
      fromName: creatorName,
      replyTo: creatorEmail,
    });

    if (!emailResult.success) {
      console.error("Failed to send forwarded email:", emailResult.error);
      return NextResponse.json(
        { error: emailResult.error || "Failed to send email" },
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
          projectId,
          subject,
          content: fullContent,
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
        recipient: messageRecord.recipient,
        createdAt: messageRecord.createdAt.toISOString(),
      } : {
        subject,
        recipient: { email: to.trim() },
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error forwarding email:", error);
    return NextResponse.json(
      { error: "Failed to forward email" },
      { status: 500 }
    );
  }
}
