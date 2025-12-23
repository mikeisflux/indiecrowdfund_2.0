import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

export const dynamic = "force-dynamic";

// Secret key for signing unsubscribe tokens - requires proper secret in production
const UNSUBSCRIBE_SECRET = process.env.UNSUBSCRIBE_SECRET || process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
if (!UNSUBSCRIBE_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("UNSUBSCRIBE_SECRET or AUTH_SECRET environment variable is required in production");
}

/**
 * Verify and decode an unsubscribe token
 */
function verifyUnsubscribeToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const [email, hash] = decoded.split(":");

    if (!email || !hash) return null;

    // Verify the hash
    const expectedData = `${email}:${UNSUBSCRIBE_SECRET}`;
    const expectedHash = crypto.createHash("sha256").update(expectedData).digest("hex").slice(0, 32);

    if (hash === expectedHash) {
      return email;
    }
    return null;
  } catch {
    return null;
  }
}

// GET - Handle unsubscribe from email link (one-click)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return new NextResponse(renderUnsubscribePage(false, "Invalid unsubscribe link."), {
        status: 400,
        headers: { "Content-Type": "text/html" },
      });
    }

    const email = verifyUnsubscribeToken(token);
    if (!email) {
      return new NextResponse(renderUnsubscribePage(false, "Invalid or expired unsubscribe link."), {
        status: 400,
        headers: { "Content-Type": "text/html" },
      });
    }

    // Unsubscribe the user
    const result = await unsubscribeEmail(email);

    if (result.success) {
      return new NextResponse(renderUnsubscribePage(true, `You have been unsubscribed from all emails. (${email})`), {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    } else {
      return new NextResponse(renderUnsubscribePage(false, result.error || "Failed to unsubscribe."), {
        status: 500,
        headers: { "Content-Type": "text/html" },
      });
    }
  } catch (error) {
    console.error("Error in unsubscribe GET:", error);
    return new NextResponse(renderUnsubscribePage(false, "An error occurred. Please try again."), {
      status: 500,
      headers: { "Content-Type": "text/html" },
    });
  }
}

// POST - Handle unsubscribe via API
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, email } = body;

    let targetEmail: string | null = null;

    if (token) {
      targetEmail = verifyUnsubscribeToken(token);
    } else if (email) {
      // Direct email unsubscribe (for admin use)
      targetEmail = email;
    }

    if (!targetEmail) {
      return NextResponse.json({ error: "Invalid token or email" }, { status: 400 });
    }

    const result = await unsubscribeEmail(targetEmail);

    if (result.success) {
      return NextResponse.json({ success: true, message: "Successfully unsubscribed" });
    } else {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
  } catch (error) {
    console.error("Error in unsubscribe POST:", error);
    return NextResponse.json({ error: "Failed to process unsubscribe" }, { status: 500 });
  }
}

/**
 * Unsubscribe an email from all platform emails
 */
async function unsubscribeEmail(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Update User record if exists
    const user = await db.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (user) {
      await db.user.update({
        where: { email: normalizedEmail },
        data: { emailUnsubscribedAt: new Date() },
      });
    }

    // 2. Update NewsletterSubscriber if exists
    try {
      await db.newsletterSubscriber.updateMany({
        where: { email: normalizedEmail },
        data: {
          isActive: false,
          unsubscribedAt: new Date(),
        },
      });
    } catch {
      // Table might not exist or no record
    }

    console.log(`[Unsubscribe] Successfully unsubscribed: ${normalizedEmail}`);
    return { success: true };
  } catch (error) {
    console.error("[Unsubscribe] Error:", error);
    return { success: false, error: "Database error while unsubscribing" };
  }
}

/**
 * Render a simple HTML page for unsubscribe confirmation
 */
function renderUnsubscribePage(success: boolean, message: string): string {
  const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "IndieCrowdfund";
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${success ? "Unsubscribed" : "Error"} - ${APP_NAME}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 40px 20px;
            text-align: center;
          }
          .container {
            background: ${success ? "#f0fdf4" : "#fef2f2"};
            border: 1px solid ${success ? "#bbf7d0" : "#fecaca"};
            border-radius: 8px;
            padding: 40px;
            margin-top: 40px;
          }
          h1 {
            color: ${success ? "#15803d" : "#dc2626"};
            margin-bottom: 20px;
          }
          .icon {
            font-size: 48px;
            margin-bottom: 20px;
          }
          .message {
            color: #666;
            margin-bottom: 30px;
          }
          .link {
            display: inline-block;
            background: #333;
            color: #fff;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 500;
          }
          .link:hover {
            background: #555;
          }
        </style>
      </head>
      <body>
        <h2>${APP_NAME}</h2>
        <div class="container">
          <div class="icon">${success ? "✓" : "✕"}</div>
          <h1>${success ? "Unsubscribed" : "Error"}</h1>
          <p class="message">${message}</p>
          <a href="${APP_URL}" class="link">Return to ${APP_NAME}</a>
        </div>
      </body>
    </html>
  `;
}
