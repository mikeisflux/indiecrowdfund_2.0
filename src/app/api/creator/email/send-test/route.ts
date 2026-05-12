import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const creatorEmailSendTestLogger = logger.child({ module: "creator-email-send-test" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import {
  resolveTemplateVars,
  resolveTemplateVarsForSubject,
} from "@/lib/email/template-vars";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { to, subject, htmlContent, senderName, replyTo, projectId } = body;

    // Validate required fields
    if (!to || !to.includes("@")) {
      return NextResponse.json({ error: "Valid email address required" }, { status: 400 });
    }

    if (!subject) {
      return NextResponse.json({ error: "Subject is required" }, { status: 400 });
    }

    if (!htmlContent) {
      return NextResponse.json({ error: "Email content is required" }, { status: 400 });
    }

    // Resolve template variables the same way the batch send does, so
    // the test the creator sends themselves looks like what their
    // subscribers will receive. FIRST_NAME / NAME use the creator's
    // own profile name since they're sending to themselves.
    let projectName = "";
    let projectUrl = "";
    let prelaunchUrl = "";
    if (projectId && typeof projectId === "string") {
      const project = await db.project.findFirst({
        where: {
          id: projectId,
          deletedAt: null,
          OR: [
            { creatorId: session.user.id },
            { collaborators: { some: { userId: session.user.id, status: "ACCEPTED" } } },
          ],
        },
        select: { title: true, slug: true, creator: { select: { vanityUrl: true } } },
      });
      if (project) {
        projectName = project.title;
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const vanity = project.creator?.vanityUrl || "creator";
        projectUrl = `${appUrl}/projects/${vanity}/${project.slug}`;
        prelaunchUrl = `${appUrl}/projects/${vanity}/${project.slug}/prelaunch`;
      }
    }

    // Test emails go to the creator themselves, but we do NOT want
    // the creator's own name to substitute into {{FIRST_NAME}} —
    // that's misleading because the real batch send personalizes to
    // each subscriber. Use a clear placeholder so the creator can
    // verify the template renders correctly and then see real names
    // in the actual broadcast.
    const vars = {
      firstName: "Friend",
      fullName: "Friend",
      projectName,
      projectUrl,
      prelaunchUrl,
      creatorName: senderName || "IndieCrowdfund",
    };

    const resolvedSubject = resolveTemplateVarsForSubject(String(subject), vars);
    const resolvedHtml = resolveTemplateVars(String(htmlContent), vars);

    // Build the HTML email with basic styling
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${resolvedSubject}</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
            <div>${resolvedHtml}</div>
          </div>
          <div style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">
            <p style="margin: 0;">This is a test email sent from IndieCrowdfund.</p>
          </div>
        </body>
      </html>
    `;

    // Send the test email via SendGrid/Mailgun
    const result = await sendEmail({
      to,
      subject: `[TEST] ${resolvedSubject}`,
      html,
      fromName: senderName || "IndieCrowdfund",
      replyTo: replyTo || session.user.email || undefined,
      skipUnsubscribeCheck: true, // Test emails should always be sent
    });

    if (!result.success) {
      creatorEmailSendTestLogger.error({ err: String(result.error) }, "Failed to send test email:");
      return NextResponse.json(
        { error: result.error || "Failed to send test email" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: `Test email sent to ${to}` });
  } catch (error) {
    creatorEmailSendTestLogger.error({ err: String(error) }, "Send test email error:");
    return NextResponse.json(
      { error: "Failed to send test email" },
      { status: 500 }
    );
  }
}
