import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { sendEmail } from "@/lib/email";

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

  const user = await db.user.findUnique({
    where: { id: session.user.id },
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
    console.error("Error fetching emails:", error);
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
    } = body;

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
        console.log(`[Admin Email] Sending email to ${toEmail}, subject: ${subject}`);
        const sendResult = await sendEmail({
          to: toEmail,
          subject,
          html: bodyHtml,
          text: bodyText || bodyHtml.replace(/<[^>]*>/g, ""),
        });

        if (sendResult.success) {
          console.log(`[Admin Email] Email sent successfully to ${toEmail}`);
          await db.adminEmail.update({
            where: { id: email.id },
            data: {
              status: "SENT",
              sentAt: new Date(),
            },
          });
        } else {
          console.error(`[Admin Email] Failed to send email: ${sendResult.error}`);
          await db.adminEmail.update({
            where: { id: email.id },
            data: { status: "FAILED" },
          });
        }
      } catch (sendError) {
        console.error(`[Admin Email] Exception sending email:`, sendError);
        await db.adminEmail.update({
          where: { id: email.id },
          data: { status: "FAILED" },
        });
      }
    }

    return NextResponse.json({ email });
  } catch (error) {
    console.error("Error creating email:", error);
    return NextResponse.json(
      { error: "Failed to create email" },
      { status: 500 }
    );
  }
}
