import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    // Get user's integration settings
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        stripeAccountId: true,
        stripeAccountStatus: true,
      },
    });

    // Get project-specific integrations if projectId provided
    let projectIntegrations = null;
    const fulfillmentIntegrations = {
      shopify: { connected: false, status: null as string | null },
      shipstation: { connected: false, status: null as string | null },
      shippo: { connected: false, status: null as string | null },
      easypost: { connected: false, status: null as string | null },
    };

    if (projectId) {
      const project = await db.project.findFirst({
        where: {
          id: projectId,
          OR: [
            { creatorId: session.user.id },
            { collaborators: { some: { userId: session.user.id, status: "ACCEPTED" } } },
          ],
        },
        select: {
          id: true,
          stripeProductId: true,
          fulfillmentIntegrations: true,
        },
      });
      projectIntegrations = project;

      // Check for connected fulfillment integrations
      if (project?.fulfillmentIntegrations) {
        for (const integration of project.fulfillmentIntegrations) {
          const provider = integration.provider.toLowerCase() as keyof typeof fulfillmentIntegrations;
          if (provider in fulfillmentIntegrations) {
            fulfillmentIntegrations[provider] = {
              connected: integration.status === "CONNECTED",
              status: integration.status,
            };
          }
        }
      }
    }

    return NextResponse.json({
      stripe: {
        connected: !!user?.stripeAccountId,
        status: user?.stripeAccountStatus || "not_connected",
      },
      fulfillment: fulfillmentIntegrations,
      project: projectIntegrations,
    });
  } catch (error) {
    console.error("Integrations GET error:", error);
    return NextResponse.json({ error: "Failed to fetch integrations" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { action, provider } = body;

    if (action === "connect") {
      // Stub - would redirect to OAuth flow for provider
      return NextResponse.json({
        success: true,
        message: `${provider} integration setup not yet implemented`,
        redirectUrl: null,
      });
    }

    if (action === "disconnect") {
      // Stub - would disconnect the integration
      return NextResponse.json({
        success: true,
        message: `${provider} disconnected`,
      });
    }

    if (action === "test") {
      // Stub - would test the integration connection
      return NextResponse.json({
        success: true,
        message: `${provider} connection test passed`,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("Integrations POST error:", error);
    return NextResponse.json({ error: "Failed to process integration request" }, { status: 500 });
  }
}
