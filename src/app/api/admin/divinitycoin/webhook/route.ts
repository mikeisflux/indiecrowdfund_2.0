import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  registerWebhook,
  updateWebhookUrl,
  getWebhookConfig,
  clearDivinityCoinConfigCache,
} from "@/lib/payments/divinitycoin";

// Check if user is admin
async function isAdmin() {
  const session = await auth();
  if (!session?.user?.id) return false;

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  return user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
}

/**
 * GET /api/admin/divinitycoin/webhook
 *
 * Get current webhook configuration
 */
export async function GET() {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get stored webhook URL from platform settings
    const settings = await db.platformSettings.findUnique({
      where: { id: "default" },
      select: {
        divinityCoinEnabled: true,
        divinityCoinWebhookSecret: true,
      },
    });

    // Try to get configuration from DivinityCoin API
    const remoteConfig = await getWebhookConfig();

    // Generate the webhook URL for this platform
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const webhookUrl = `${appUrl}/api/webhooks/divinitycoin`;

    return NextResponse.json({
      enabled: settings?.divinityCoinEnabled || false,
      hasSecret: !!settings?.divinityCoinWebhookSecret,
      webhookUrl,
      remoteConfig: remoteConfig || {
        url: null,
        events: [],
        status: "not_configured",
      },
      supportedEvents: ["test.ping", "card.validate", "card.redeem"],
    });
  } catch (error) {
    console.error("Error fetching webhook config:", error);
    return NextResponse.json(
      { error: "Failed to fetch webhook configuration" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/divinitycoin/webhook
 *
 * Register or update webhook URL with DivinityCoin
 */
export async function POST(req: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { action, webhookUrl } = body;

    // Generate default webhook URL if not provided
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const defaultWebhookUrl = `${appUrl}/api/webhooks/divinitycoin`;
    const targetUrl = webhookUrl || defaultWebhookUrl;

    if (action === "register") {
      // Register new webhook with DivinityCoin
      const result = await registerWebhook(targetUrl);

      if (!result.success) {
        return NextResponse.json(
          { error: result.message || "Failed to register webhook" },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Webhook registered successfully",
        webhookId: result.webhookId,
        webhookUrl: targetUrl,
        hasNewSecret: !!result.secret,
      });
    } else if (action === "update") {
      // Update existing webhook URL
      const result = await updateWebhookUrl(targetUrl);

      if (!result.success) {
        return NextResponse.json(
          { error: result.message || "Failed to update webhook" },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Webhook URL updated successfully",
        webhookUrl: targetUrl,
      });
    } else if (action === "test") {
      // Test the webhook by sending a test.ping event to ourselves
      try {
        const response = await fetch(targetUrl, {
          method: "GET",
        });

        if (response.ok) {
          const data = await response.json();
          return NextResponse.json({
            success: true,
            message: "Webhook endpoint is reachable",
            status: data.status,
            sandboxMode: data.sandboxMode,
          });
        } else {
          return NextResponse.json({
            success: false,
            message: `Webhook endpoint returned ${response.status}`,
          });
        }
      } catch (testError) {
        return NextResponse.json({
          success: false,
          message: "Could not reach webhook endpoint",
          error: testError instanceof Error ? testError.message : "Unknown error",
        });
      }
    } else {
      return NextResponse.json(
        { error: "Invalid action. Use 'register', 'update', or 'test'" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error configuring webhook:", error);
    return NextResponse.json(
      { error: "Failed to configure webhook" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/divinitycoin/webhook
 *
 * Update webhook secret manually
 */
export async function PATCH(req: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { webhookSecret } = body;

    if (!webhookSecret) {
      return NextResponse.json(
        { error: "Webhook secret is required" },
        { status: 400 }
      );
    }

    // Update the webhook secret in platform settings
    await db.platformSettings.update({
      where: { id: "default" },
      data: {
        divinityCoinWebhookSecret: webhookSecret,
      },
    });

    // Clear cache to use new secret
    clearDivinityCoinConfigCache();

    return NextResponse.json({
      success: true,
      message: "Webhook secret updated successfully",
    });
  } catch (error) {
    console.error("Error updating webhook secret:", error);
    return NextResponse.json(
      { error: "Failed to update webhook secret" },
      { status: 500 }
    );
  }
}
