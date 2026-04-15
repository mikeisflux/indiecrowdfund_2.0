import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const unsubscribeLogger = logger.child({ module: "unsubscribe" });
import { db } from "@/lib/db";
import crypto from "crypto";

export const dynamic = "force-dynamic";

// Secret key for signing unsubscribe tokens - requires proper secret in production
// Lazily get the secret to avoid build-time errors
function getUnsubscribeSecret(): string {
  const secret = process.env.UNSUBSCRIBE_SECRET || process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("UNSUBSCRIBE_SECRET or AUTH_SECRET environment variable is required in production");
  }
  return secret || "development-secret";
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
    const expectedData = `${email}:${getUnsubscribeSecret()}`;
    const expectedHash = crypto.createHash("sha256").update(expectedData).digest("hex").slice(0, 32);

    try {
      if (crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(expectedHash))) {
        return email;
      }
    } catch {
      // Buffer lengths differ — hashes don't match
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
    unsubscribeLogger.error({ err: String(error) }, "Error in unsubscribe GET:");
    return new NextResponse(renderUnsubscribePage(false, "An error occurred. Please try again."), {
      status: 500,
      headers: { "Content-Type": "text/html" },
    });
  }
}

// POST - Handle unsubscribe via API (supports both JSON and RFC 8058 one-click unsubscribe)
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let targetEmail: string | null = null;

    // Check for RFC 8058 one-click unsubscribe (form-encoded with token in URL)
    // Mail clients send POST with body "List-Unsubscribe=One-Click" to the URL with token
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const { searchParams } = new URL(request.url);
      const token = searchParams.get("token");

      if (token) {
        targetEmail = verifyUnsubscribeToken(token);
      }

      // If this is a valid one-click unsubscribe, process it
      if (targetEmail) {
        const result = await unsubscribeEmail(targetEmail);
        unsubscribeLogger.info(`[Unsubscribe] One-click unsubscribe for: ${targetEmail}, success: ${result.success}`);

        if (result.success) {
          // Return 200 OK for successful one-click unsubscribe
          return new NextResponse("Unsubscribed successfully", { status: 200 });
        } else {
          return new NextResponse("Failed to unsubscribe", { status: 500 });
        }
      }
    }

    // Handle JSON API requests - token is always required for security
    if (contentType.includes("application/json")) {
      const body = await request.json();
      const { token } = body;

      if (token) {
        targetEmail = verifyUnsubscribeToken(token);
      }
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
    unsubscribeLogger.error({ err: String(error) }, "Error in unsubscribe POST:");
    return NextResponse.json({ error: "Failed to process unsubscribe" }, { status: 500 });
  }
}

/**
 * Unsubscribe an email from all platform emails (site-wide, including creator lists)
 */
async function unsubscribeEmail(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Update User record if exists (site-wide unsubscribe).
    // updateMany is idempotent and avoids the findUnique+update
    // TOCTOU + P2025 on missing rows.
    await db.user.updateMany({
      where: { email: normalizedEmail },
      data: { emailUnsubscribedAt: new Date() },
    });

    // 2. Update NewsletterSubscriber if exists (platform newsletter)
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

    // 3. Update EmailListSubscriber (creator email lists from IndieKit)
    try {
      await db.emailListSubscriber.updateMany({
        where: { email: normalizedEmail },
        data: {
          status: "unsubscribed",
        },
      });
    } catch {
      // Table might not exist or no record
    }

    // 4. Delete ProjectFollower records (prelaunch email signups)
    // Note: ProjectFollower doesn't have an isActive field, so we delete the records
    try {
      await db.projectFollower.deleteMany({
        where: { email: normalizedEmail },
      });
    } catch {
      // Table might not exist or no record
    }

    // 5. Cancel any pending emails in the queue for this address
    try {
      const cancelled = await db.emailQueue.updateMany({
        where: {
          toEmail: normalizedEmail,
          status: { in: ["PENDING", "PROCESSING"] },
        },
        data: {
          status: "FAILED",
          error: "Recipient unsubscribed",
        },
      });
      if (cancelled.count > 0) {
        unsubscribeLogger.info(`[Unsubscribe] Cancelled ${cancelled.count} pending queue email(s) for ${normalizedEmail}`);
      }
    } catch {
      // Queue table might not exist
    }

    unsubscribeLogger.info(`[Unsubscribe] Successfully unsubscribed from all lists: ${normalizedEmail}`);
    return { success: true };
  } catch (error) {
    unsubscribeLogger.error({ err: String(error) }, "[Unsubscribe] Error:");
    return { success: false, error: "Database error while unsubscribing" };
  }
}

// Escape HTML special characters to prevent XSS
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Render a simple HTML page for unsubscribe confirmation
 */
function renderUnsubscribePage(success: boolean, message: string): string {
  const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "IndieCrowdfund";
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const safeMessage = escapeHtml(message);
  const safeAppName = escapeHtml(APP_NAME);
  const safeAppUrl = escapeHtml(APP_URL);

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${success ? "Unsubscribed" : "Error"} - ${safeAppName}</title>
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
        <h2>${safeAppName}</h2>
        <div class="container">
          <div class="icon">${success ? "✓" : "✕"}</div>
          <h1>${success ? "Unsubscribed" : "Error"}</h1>
          <p class="message">${safeMessage}</p>
          <a href="${safeAppUrl}" class="link">Return to ${safeAppName}</a>
        </div>
      </body>
    </html>
  `;
}
