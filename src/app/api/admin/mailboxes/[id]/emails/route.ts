import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminMailboxesEmailsLogger = logger.child({ module: "admin-mailboxes-emails" });
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { sendEmail, EmailAttachment } from "@/lib/email";
import { getR2Storage } from "@/lib/r2";

export const dynamic = "force-dynamic";

// Type definitions
type EmailFolder = "INBOX" | "SENT" | "DRAFTS" | "TRASH" | "SPAM" | "ARCHIVE";
type AdminEmailStatus = "PENDING" | "SENDING" | "SENT" | "DELIVERED" | "FAILED" | "BOUNCED";

// Require admin access
async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  const user = await db.user.findFirst({
    where: { id: session.user.id, deletedAt: null },
    select: { role: true },
  });

  if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
    return null;
  }

  return session.user;
}

// GET - List emails in a mailbox
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const url = new URL(request.url);
    const folder = (url.searchParams.get("folder") || "INBOX") as EmailFolder;
    // Validate pagination parameters
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "50") || 50));
    const search = url.searchParams.get("search") || "";
    const unreadOnly = url.searchParams.get("unread") === "true";
    const starredOnly = url.searchParams.get("starred") === "true";

    // Verify mailbox exists
    const mailbox = await db.mailbox.findUnique({
      where: { id },
    });

    if (!mailbox) {
      return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });
    }

    // Build where clause
    const where: {
      mailboxId: string;
      folder: EmailFolder;
      isArchived: boolean;
      isRead?: boolean;
      isStarred?: boolean;
      OR?: Array<{
        subject?: { contains: string; mode: "insensitive" };
        fromEmail?: { contains: string; mode: "insensitive" };
        toEmail?: { contains: string; mode: "insensitive" };
        bodyText?: { contains: string; mode: "insensitive" };
      }>;
    } = {
      mailboxId: id,
      folder,
      isArchived: folder === "ARCHIVE",
    };

    if (unreadOnly) {
      where.isRead = false;
    }

    if (starredOnly) {
      where.isStarred = true;
    }

    if (search) {
      where.OR = [
        { subject: { contains: search, mode: "insensitive" } },
        { fromEmail: { contains: search, mode: "insensitive" } },
        { toEmail: { contains: search, mode: "insensitive" } },
        { bodyText: { contains: search, mode: "insensitive" } },
      ];
    }

    const [emails, total] = await Promise.all([
      db.adminEmail.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          fromEmail: true,
          fromName: true,
          toEmail: true,
          toName: true,
          subject: true,
          folder: true,
          status: true,
          isRead: true,
          isStarred: true,
          sentAt: true,
          receivedAt: true,
          createdAt: true,
          threadId: true,
          // Don't include body in list for performance
        },
      }),
      db.adminEmail.count({ where }),
    ]);

    return NextResponse.json({
      emails,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    adminMailboxesEmailsLogger.error({ err: String(error) }, "Error fetching emails:");
    return NextResponse.json(
      { error: "Failed to fetch emails" },
      { status: 500 }
    );
  }
}

// POST - Create/send an email
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const {
      toEmail,
      toName,
      ccEmails,
      bccEmails,
      replyTo,
      subject,
      bodyHtml,
      bodyText,
      folder,
      sendNow,
      inReplyTo,
      threadId,
      attachments: rawAttachments,
    } = body;

    // Process attachments if provided (from forwarded emails)
    // Attachments can either have data (base64) or r2Key (need to fetch from R2)
    const attachments: EmailAttachment[] = [];
    if (rawAttachments && rawAttachments.length > 0) {
      const r2Storage = await getR2Storage();

      for (const att of rawAttachments as Array<{ filename: string; data?: string; contentType?: string; r2Key?: string }>) {
        if (att.data) {
          // Already have the data
          attachments.push({
            filename: att.filename,
            data: att.data,
            contentType: att.contentType,
          });
        } else if (att.r2Key && r2Storage) {
          // Need to fetch from R2
          try {
            adminMailboxesEmailsLogger.info(`[Admin Email] Fetching attachment from R2: ${att.r2Key}`);
            const fileData = await r2Storage.getFile(att.r2Key);
            if (fileData) {
              // Convert Buffer to base64 string
              const base64Data = Buffer.from(fileData).toString("base64");
              attachments.push({
                filename: att.filename,
                data: base64Data,
                contentType: att.contentType,
              });
            }
          } catch (err) {
            adminMailboxesEmailsLogger.error({ err: String(err) }, `[Admin Email] Failed to fetch attachment ${att.r2Key}:`);
          }
        }
      }
    }

    // Verify mailbox exists
    const mailbox = await db.mailbox.findUnique({
      where: { id },
    });

    if (!mailbox) {
      return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });
    }

    if (!toEmail || !subject) {
      return NextResponse.json(
        { error: "To email and subject are required" },
        { status: 400 }
      );
    }

    const emailFolder: EmailFolder = folder === "DRAFTS" ? "DRAFTS" : "SENT";
    const emailStatus: AdminEmailStatus = folder === "DRAFTS" ? "PENDING" : (sendNow ? "SENDING" : "PENDING");

    const email = await db.adminEmail.create({
      data: {
        mailboxId: id,
        fromEmail: mailbox.email,
        fromName: mailbox.name,
        toEmail,
        toName: toName || null,
        ccEmails: ccEmails || [],
        bccEmails: bccEmails || [],
        replyTo: replyTo || null,
        subject,
        bodyHtml: bodyHtml || "",
        bodyText: bodyText || null,
        folder: emailFolder,
        status: emailStatus,
        isRead: true, // Sent emails are already read
        sentAt: folder !== "DRAFTS" ? new Date() : null,
        threadId: threadId || null,
        inReplyTo: inReplyTo || null,
      },
    });

    // If sendNow is true, actually send the email via the email service
    if (sendNow && folder !== "DRAFTS") {
      try {
        // Send email directly using the email library
        adminMailboxesEmailsLogger.info(`[Admin Email] Sending email to ${toEmail}, subject: ${subject}, attachments: ${attachments.length}`);
        const sendResult = await sendEmail({
          to: toEmail,
          subject,
          html: bodyHtml,
          text: bodyText || bodyHtml.replace(/<[^>]*>/g, ""),
          attachments: attachments.length > 0 ? attachments : undefined,
        });

        if (sendResult.success) {
          adminMailboxesEmailsLogger.info(`[Admin Email] Email sent successfully to ${toEmail}`);
          await db.adminEmail.update({
            where: { id: email.id },
            data: {
              status: "SENT",
              sentAt: new Date(),
            },
          });
        } else {
          adminMailboxesEmailsLogger.error(`[Admin Email] Failed to send email: ${sendResult.error}`);
          await db.adminEmail.update({
            where: { id: email.id },
            data: { status: "FAILED" },
          });
        }
      } catch (sendError) {
        adminMailboxesEmailsLogger.error({ err: String(sendError) }, `[Admin Email] Exception sending email:`);
        await db.adminEmail.update({
          where: { id: email.id },
          data: { status: "FAILED" },
        });
      }
    }

    return NextResponse.json({ email });
  } catch (error) {
    adminMailboxesEmailsLogger.error({ err: String(error) }, "Error creating email:");
    return NextResponse.json(
      { error: "Failed to create email" },
      { status: 500 }
    );
  }
}

// DELETE - Bulk delete all emails in a folder
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const url = new URL(request.url);
    const folder = url.searchParams.get("folder") as EmailFolder | null;

    if (!folder) {
      return NextResponse.json(
        { error: "Folder parameter is required" },
        { status: 400 }
      );
    }

    const validFolders: EmailFolder[] = ["INBOX", "SENT", "DRAFTS", "TRASH", "SPAM", "ARCHIVE"];
    if (!validFolders.includes(folder)) {
      return NextResponse.json(
        { error: "Invalid folder" },
        { status: 400 }
      );
    }

    // Verify mailbox exists
    const mailbox = await db.mailbox.findUnique({
      where: { id },
    });

    if (!mailbox) {
      return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });
    }

    // Permanently delete all emails in the specified folder
    const result = await db.adminEmail.deleteMany({
      where: {
        mailboxId: id,
        folder,
      },
    });

    adminMailboxesEmailsLogger.info(`[Admin Email] Emptied folder ${folder} for mailbox ${mailbox.name}: ${result.count} emails deleted`);

    return NextResponse.json({
      success: true,
      deletedCount: result.count,
    });
  } catch (error) {
    adminMailboxesEmailsLogger.error({ err: String(error) }, "Error emptying folder:");
    return NextResponse.json(
      { error: "Failed to empty folder" },
      { status: 500 }
    );
  }
}
