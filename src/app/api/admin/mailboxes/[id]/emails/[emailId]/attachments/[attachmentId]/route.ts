import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const adminMailboxesAttachmentsLogger = logger.child({ module: "admin-mailboxes-attachments" });
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getR2Storage } from "@/lib/r2";

export const dynamic = "force-dynamic";

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

interface StoredAttachment {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  r2Key: string;
}

interface AttachmentsData {
  count: number;
  files?: StoredAttachment[];
}

// GET - Download an attachment
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; emailId: string; attachmentId: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id, emailId, attachmentId } = await params;

    // Get the email to find attachment metadata
    const email = await db.adminEmail.findFirst({
      where: {
        id: emailId,
        mailboxId: id,
      },
      select: {
        attachments: true,
      },
    });

    if (!email) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    // Parse attachments JSON
    const attachments = email.attachments as AttachmentsData | null;
    if (!attachments?.files) {
      return NextResponse.json({ error: "No attachments found" }, { status: 404 });
    }

    // Find the specific attachment
    const attachment = attachments.files.find((a) => a.id === attachmentId);
    if (!attachment) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    // Get file from R2
    const r2Storage = await getR2Storage();
    if (!r2Storage) {
      return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
    }

    // Generate a presigned download URL
    const downloadUrl = await r2Storage.getDownloadUrl(attachment.r2Key, {
      expiresIn: 3600, // 1 hour
    });

    // Redirect to the presigned URL
    return NextResponse.redirect(downloadUrl);
  } catch (error) {
    adminMailboxesAttachmentsLogger.error({ err: formatError(error) }, "Error downloading attachment:");
    return NextResponse.json(
      { error: "Failed to download attachment" },
      { status: 500 }
    );
  }
}
