import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "admin-email-queue-detail" });

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized", status: 401 } as const;
  const user = await db.user.findFirst({
    where: { id: session.user.id, deletedAt: null },
    select: { role: true },
  });
  if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
    return { error: "Forbidden - Admin access required", status: 403 } as const;
  }
  return { ok: true } as const;
}

// GET /api/admin/email-queue/[id]
// Returns the full row for a single queued email, including bodyHtml and
// bodyText, so admins can preview the email exactly as it would render
// to the recipient.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const email = await db.emailQueue.findUnique({
      where: { id },
      select: {
        id: true,
        toEmail: true,
        subject: true,
        bodyHtml: true,
        bodyText: true,
        fromEmail: true,
        fromName: true,
        replyTo: true,
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

    if (!email) {
      return NextResponse.json({ error: "Email not found in queue" }, { status: 404 });
    }

    return NextResponse.json({ email });
  } catch (err) {
    log.error({ err: String(err) }, "Failed to load queued email detail");
    return NextResponse.json(
      { error: "Failed to load email detail" },
      { status: 500 }
    );
  }
}
