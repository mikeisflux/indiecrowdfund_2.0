import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// Helper to check admin role
async function requireAdmin() {
  const session = await auth();

  if (!session?.user?.id) {
    return { error: "Unauthorized", status: 401 };
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
    return { error: "Forbidden - Admin access required", status: 403 };
  }

  return { user: session.user };
}

// Replace template variables in content
function replaceTemplateVariables(content: string, email: string, name: string | null): string {
  let result = content;

  // Replace user name - use first name or "there" if no name
  const displayName = name
    ? name.split(' ')[0] // First name only
    : "there";

  result = result.replace(/\{\{USER_NAME\}\}/gi, displayName);
  result = result.replace(/\{\{NAME\}\}/gi, displayName);
  result = result.replace(/\{\{FIRST_NAME\}\}/gi, displayName);
  result = result.replace(/\{\{USER_EMAIL\}\}/gi, email);
  result = result.replace(/\{\{EMAIL\}\}/gi, email);

  return result;
}

// Convert relative URLs to absolute URLs for images and links
function convertRelativeUrls(html: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://indiecrowdfund.com";

  // Convert relative src attributes (images, etc.) to absolute URLs
  let result = html.replace(/src="\/([^"]*)"/gi, `src="${baseUrl}/$1"`);
  result = result.replace(/src='\/([^']*)'/gi, `src='${baseUrl}/$1'`);

  // Convert relative href attributes to absolute URLs (but not anchors like #section)
  result = result.replace(/href="\/([^#"][^"]*)"/gi, `href="${baseUrl}/$1"`);
  result = result.replace(/href='\/([^#'][^']*)'/gi, `href='${baseUrl}/$1'`);

  // Convert url() in inline styles (for background images)
  result = result.replace(/url\(["']?\/([^"')]+)["']?\)/gi, `url("${baseUrl}/$1")`);

  return result;
}


// POST - Send test email
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { id } = await params;
    const body = await request.json();
    const { email, name } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    // Get campaign
    const campaign = await db.emailCampaign.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        subject: true,
        htmlContent: true,
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Replace template variables (same as regular send)
    const personalizedSubject = `[TEST] ${replaceTemplateVariables(campaign.subject, email, name || null)}`;
    let personalizedHtml = replaceTemplateVariables(campaign.htmlContent, email, name || null);

    // Convert relative URLs to absolute URLs for images
    personalizedHtml = convertRelativeUrls(personalizedHtml);

    console.log(`Sending test email for campaign "${campaign.name}" to ${email}`);

    // Send the test email
    const result = await sendEmail({
      to: email,
      subject: personalizedSubject,
      html: personalizedHtml,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to send test email" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Test email sent to ${email}`,
    });
  } catch (error) {
    console.error("Error sending test email:", error);
    return NextResponse.json(
      { error: "Failed to send test email" },
      { status: 500 }
    );
  }
}
