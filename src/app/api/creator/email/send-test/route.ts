import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { to, subject, htmlContent, senderName, replyTo } = body;

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

    // Build the HTML email with basic styling
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
            <div style="white-space: pre-wrap;">${htmlContent.replace(/\n/g, "<br>")}</div>
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
      subject: `[TEST] ${subject}`,
      html,
      fromName: senderName || "IndieCrowdfund",
      replyTo: replyTo || session.user.email || undefined,
      skipUnsubscribeCheck: true, // Test emails should always be sent
    });

    if (!result.success) {
      console.error("Failed to send test email:", result.error);
      return NextResponse.json(
        { error: result.error || "Failed to send test email" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: `Test email sent to ${to}` });
  } catch (error) {
    console.error("Send test email error:", error);
    return NextResponse.json(
      { error: "Failed to send test email" },
      { status: 500 }
    );
  }
}
