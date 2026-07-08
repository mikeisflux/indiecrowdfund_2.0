import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "admin-email-creator-sent-detail" });

// GET /api/admin/email/creator-sent/[id]
//
// Returns the full payload of a single creator-sent email, including
// the rendered HTML body — so admin can preview exactly what the
// recipient saw, not just metadata. Returns 404 for non-creator emails
// (system emails, password resets, etc.) so this endpoint can't be
// used as a generic queue inspector.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const me = await db.user.findFirst({
      where: { id: session.user.id, deletedAt: null },
      select: { role: true },
    });
    if (me?.role !== "ADMIN" && me?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const row = await db.emailQueue.findUnique({
      where: { id },
      select: {
        id: true,
        toEmail: true,
        subject: true,
        fromEmail: true,
        fromName: true,
        replyTo: true,
        bodyHtml: true,
        bodyText: true,
        isCreatorEmail: true,
        status: true,
        priority: true,
        attempts: true,
        maxAttempts: true,
        error: true,
        createdAt: true,
        processedAt: true,
        sentAt: true,
      },
    });
    if (!row || !row.isCreatorEmail) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    return NextResponse.json({ email: row });
  } catch (err) {
    log.error({ err: err instanceof Error ? err.message : String(err) }, "creator-sent detail error");
    return NextResponse.json({ error: "Failed to load email" }, { status: 500 });
  }
}
