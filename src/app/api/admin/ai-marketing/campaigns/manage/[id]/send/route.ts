import { NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendCampaignNow } from "@/lib/email/campaign-send";

const log = logger.child({ module: "admin-ai-marketing-campaigns-manage-send" });

export const dynamic = "force-dynamic";

// Helper to check admin role
async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized", status: 401 };
  const user = await db.user.findFirst({ where: { id: session.user.id, deletedAt: null }, select: { role: true } });
  if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") return { error: "Forbidden - Admin access required", status: 403 };
  return { user: session.user };
}

// POST - Send campaign now.
//
// The audience resolution, per-recipient personalisation, tracking and the
// SENDING status handshake live in lib/email/campaign-send so the Agent API's
// send_email_campaign tool and this button are the same code path.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const isResend = body?.resend === true;
    if (isResend) log.info({ campaignId: id }, "Resending campaign");

    const result = await sendCampaignNow(id, { resend: isResend });
    if (!result.ok) {
      const status = result.code === "not_found" ? 404 : result.code === "conflict" ? 409 : 400;
      return NextResponse.json({ error: result.message }, { status });
    }

    return NextResponse.json({
      success: true,
      message: `Campaign queued for ${result.queued} recipients. Emails will be sent at 1 per second.`,
      queuedCount: result.queued,
      failedCount: result.failed,
      totalRecipients: result.totalRecipients,
    });
  } catch (error) {
    log.error({ err: formatError(error) }, "Error queueing campaign:");
    return NextResponse.json({ error: "Failed to queue campaign" }, { status: 500 });
  }
}
