import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { queueEmail } from "@/lib/email";

const log = logger.child({ module: "admin-grant-agreement-request" });

export const dynamic = "force-dynamic";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "IndieCrowdfund";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://indiecrowdfund.com";

// POST - Email a creator asking them to sign the Grant Agreement for a
// project (used from admin payouts for campaigns that ended without one on
// file). Safe to resend; each call queues one email.
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const admin = await db.user.findFirst({
      where: { id: session.user.id, deletedAt: null },
      select: { role: true },
    });
    if (admin?.role !== "ADMIN" && admin?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const projectId = typeof body?.projectId === "string" ? body.projectId : "";
    if (!projectId) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
    }

    const project = await db.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: {
        id: true,
        title: true,
        creator: { select: { id: true, name: true, email: true } },
        grantAgreement: { select: { id: true } },
      },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    if (project.grantAgreement) {
      return NextResponse.json(
        { error: "The grant agreement for this project has already been signed." },
        { status: 400 }
      );
    }
    if (!project.creator?.email) {
      return NextResponse.json({ error: "Creator has no email on file" }, { status: 400 });
    }

    const firstName = project.creator.name?.split(" ")[0] || "there";
    const dashboardUrl = `${APP_URL}/dashboard`;
    const safeTitle = project.title.replace(/[\r\n]/g, " ");

    const html = `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #333; margin: 0;">${APP_NAME}</h1>
          </div>
          <div style="background: linear-gradient(135deg, #028858 0%, #10b981 100%); border-radius: 8px; padding: 30px; margin-bottom: 20px; color: white;">
            <h2 style="margin-top: 0; color: white; text-align: center;">Action needed: sign your Grant Agreement</h2>
            <p style="text-align: center; margin-bottom: 0;">Hi ${firstName} — your campaign <strong>${safeTitle}</strong> has ended, and one piece of paperwork stands between you and your funds.</p>
          </div>
          <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <p style="margin: 0 0 10px 0;">Funds on ${APP_NAME} are disbursed as grants through the Divinity Comics Grant Program. Before we can create your payout, you need to:</p>
            <ol style="margin: 0 0 10px 0; padding-left: 20px;">
              <li>Review and accept the Grant Agreement</li>
              <li>Confirm your tax information (most fields are pre-filled from your campaign setup)</li>
            </ol>
            <p style="margin: 0;">It takes about two minutes — open your dashboard and follow the banner at the top.</p>
          </div>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${dashboardUrl}" style="display: inline-block; background: #028858; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 500;">
              Sign the Grant Agreement
            </a>
          </div>
          <div style="text-align: center; color: #999; font-size: 12px; margin-top: 30px;">
            <p>You can read the agreement anytime at ${APP_URL}/terms?tab=grant.</p>
            <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
          </div>
        </body>
      </html>
    `;

    const result = await queueEmail({
      to: project.creator.email,
      subject: `Action needed: sign your Grant Agreement for "${safeTitle}"`,
      html,
      text: `Hi ${firstName} — your campaign "${safeTitle}" has ended. Before we can create your payout, please sign the Grant Agreement and confirm your tax information at ${dashboardUrl}. It takes about two minutes.`,
      skipUnsubscribeCheck: true, // Transactional: required to receive funds
      priority: 8,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to queue email" }, { status: 500 });
    }

    log.info({ projectId, to: project.creator.email }, "Grant agreement request emailed");
    return NextResponse.json({ sent: true, to: project.creator.email });
  } catch (error) {
    log.error({ err: formatError(error) }, "Failed to send grant agreement request");
    return NextResponse.json({ error: "Failed to send request" }, { status: 500 });
  }
}
