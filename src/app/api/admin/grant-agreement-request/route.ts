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

// POST - Email a creator their Grant Agreement for a project.
//
// Unsigned: a request to sign it (used from admin payouts for campaigns that
// ended without one on file). Already signed: a copy of what they accepted,
// with the version and date, and a link to the agreement text. Safe to
// resend; each call queues one email.
//
// Auth: ADMIN/SUPER_ADMIN session, or `Authorization: Bearer $CRON_SECRET`
// so it can be run from the server terminal. The project is identified by
// id, slug, or an exact (case-insensitive) title.
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    const hasBearer = !!cronSecret && authHeader === `Bearer ${cronSecret}`;
    if (!hasBearer) {
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
    }

    const body = await request.json().catch(() => ({}));
    const projectId = typeof body?.projectId === "string" ? body.projectId.trim() : "";
    const projectSlug = typeof body?.projectSlug === "string" ? body.projectSlug.trim() : "";
    const projectTitle = typeof body?.projectTitle === "string" ? body.projectTitle.trim() : "";
    if (!projectId && !projectSlug && !projectTitle) {
      return NextResponse.json({ error: "projectId, projectSlug, or projectTitle is required" }, { status: 400 });
    }

    const select = {
      id: true,
      title: true,
      slug: true,
      creator: { select: { id: true, name: true, email: true } },
      grantAgreement: { select: { id: true, version: true, acceptedAt: true } },
    } as const;

    let project = null;
    if (projectId || projectSlug) {
      project = await db.project.findFirst({
        where: projectId ? { id: projectId, deletedAt: null } : { slug: projectSlug, deletedAt: null },
        select,
      });
    } else {
      const matches = await db.project.findMany({
        where: { title: { equals: projectTitle, mode: "insensitive" }, deletedAt: null },
        select,
        take: 2,
      });
      if (matches.length > 1) {
        return NextResponse.json(
          { error: `More than one project is titled "${projectTitle}" — use projectSlug instead` },
          { status: 400 }
        );
      }
      project = matches[0] ?? null;
    }
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    if (!project.creator?.email) {
      return NextResponse.json({ error: "Creator has no email on file" }, { status: 400 });
    }

    const firstName = project.creator.name?.split(" ")[0] || "there";
    const dashboardUrl = `${APP_URL}/dashboard`;
    const safeTitle = project.title.replace(/[\r\n]/g, " ");
    const agreementUrl = `${APP_URL}/terms?tab=grant`;

    if (project.grantAgreement) {
      // Already signed: send them their copy rather than asking again.
      const signed = project.grantAgreement;
      const acceptedOn = signed.acceptedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      const copyHtml = `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #333; margin: 0;">${APP_NAME}</h1>
          </div>
          <div style="background: linear-gradient(135deg, #028858 0%, #10b981 100%); border-radius: 8px; padding: 30px; margin-bottom: 20px; color: white;">
            <h2 style="margin-top: 0; color: white; text-align: center;">Your Grant Agreement</h2>
            <p style="text-align: center; margin-bottom: 0;">Hi ${firstName} — here is your copy of the Grant Agreement for <strong>${safeTitle}</strong>.</p>
          </div>
          <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <p style="margin: 0 0 10px 0;">You accepted the Divinity Comics Grant Program agreement for this campaign on <strong>${acceptedOn}</strong> (agreement version ${signed.version}). Funds on ${APP_NAME} are disbursed as grants under its terms.</p>
            <p style="margin: 0;">The full text of the version you signed is available at the link below. You can also see your signed agreements anytime from your dashboard.</p>
          </div>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${agreementUrl}" style="display: inline-block; background: #028858; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 500;">
              Read the Grant Agreement
            </a>
          </div>
          <div style="text-align: center; color: #999; font-size: 12px; margin-top: 30px;">
            <p>Questions about your payout? Reply to this email.</p>
            <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
          </div>
        </body>
      </html>
      `;
      const copyResult = await queueEmail({
        to: project.creator.email,
        subject: `Your Grant Agreement for "${safeTitle}"`,
        html: copyHtml,
        text: `Hi ${firstName} — here is your copy of the Grant Agreement for "${safeTitle}". You accepted it on ${acceptedOn} (version ${signed.version}). Read the full text at ${agreementUrl}.`,
        skipUnsubscribeCheck: true, // Transactional: their own signed agreement
        priority: 8,
      });
      if (!copyResult.success) {
        return NextResponse.json({ error: copyResult.error || "Failed to queue email" }, { status: 500 });
      }
      log.info({ projectId: project.id, to: project.creator.email }, "Signed grant agreement copy emailed");
      return NextResponse.json({ sent: true, to: project.creator.email, alreadySigned: true, acceptedAt: signed.acceptedAt, version: signed.version });
    }

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
            <p>You can read the agreement anytime at ${agreementUrl}.</p>
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

    log.info({ projectId: project.id, to: project.creator.email }, "Grant agreement request emailed");
    return NextResponse.json({ sent: true, to: project.creator.email, alreadySigned: false });
  } catch (error) {
    log.error({ err: formatError(error) }, "Failed to send grant agreement request");
    return NextResponse.json({ error: "Failed to send request" }, { status: 500 });
  }
}
