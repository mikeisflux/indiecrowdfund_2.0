import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminMailboxesEmailsLogger = logger.child({ module: "admin-mailboxes-emails" });
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Type definitions
type EmailFolder = "INBOX" | "SENT" | "DRAFTS" | "TRASH" | "SPAM" | "ARCHIVE";

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

// GET - Get a specific email
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; emailId: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id, emailId } = await params;

    const email = await db.adminEmail.findFirst({
      where: {
        id: emailId,
        mailboxId: id,
      },
      include: {
        mailbox: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!email) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    // Debug logging
    adminMailboxesEmailsLogger.info({ data: {
      subject: email.subject,
      bodyHtmlLength: email.bodyHtml?.length || 0,
      bodyTextLength: email.bodyText?.length || 0,
    } }, `Fetching email ${emailId}:`);

    // Mark as read when viewing
    if (!email.isRead) {
      await db.adminEmail.update({
        where: { id: emailId },
        data: { isRead: true },
      });
    }

    return NextResponse.json({
      email: {
        ...email,
        isRead: true,
      },
    });
  } catch (error) {
    adminMailboxesEmailsLogger.error({ err: String(error) }, "Error fetching email:");
    return NextResponse.json(
      { error: "Failed to fetch email" },
      { status: 500 }
    );
  }
}

// PUT - Update an email (mark read, star, move folder, etc.)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; emailId: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id, emailId } = await params;
    const body = await request.json();
    const { isRead, isStarred, folder, isArchived } = body;

    const existing = await db.adminEmail.findFirst({
      where: {
        id: emailId,
        mailboxId: id,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    const email = await db.adminEmail.update({
      where: { id: emailId },
      data: {
        ...(isRead !== undefined && { isRead }),
        ...(isStarred !== undefined && { isStarred }),
        ...(folder !== undefined && { folder: folder as EmailFolder }),
        ...(isArchived !== undefined && { isArchived }),
      },
    });

    return NextResponse.json({ email });
  } catch (error) {
    adminMailboxesEmailsLogger.error({ err: String(error) }, "Error updating email:");
    return NextResponse.json(
      { error: "Failed to update email" },
      { status: 500 }
    );
  }
}

// DELETE - Delete an email (move to trash or permanently delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; emailId: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id, emailId } = await params;
    const url = new URL(request.url);
    const permanent = url.searchParams.get("permanent") === "true";

    const existing = await db.adminEmail.findFirst({
      where: {
        id: emailId,
        mailboxId: id,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    if (permanent || existing.folder === "TRASH") {
      // Permanently delete
      await db.adminEmail.delete({
        where: { id: emailId },
      });
      return NextResponse.json({ success: true, action: "deleted" });
    } else {
      // Move to trash
      await db.adminEmail.update({
        where: { id: emailId },
        data: { folder: "TRASH" },
      });
      return NextResponse.json({ success: true, action: "trashed" });
    }
  } catch (error) {
    adminMailboxesEmailsLogger.error({ err: String(error) }, "Error deleting email:");
    return NextResponse.json(
      { error: "Failed to delete email" },
      { status: 500 }
    );
  }
}
