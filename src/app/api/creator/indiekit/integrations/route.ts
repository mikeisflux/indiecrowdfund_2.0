import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const creatorIndiekitIntegrationsLogger = logger.child({ module: "creator-indiekit-integrations" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { encryptCredential } from "@/lib/encryption";
import { circuitBreaker } from "@/lib/circuit-breaker";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    // Get user's integration settings
    const user = await db.user.findFirst({
      where: { id: session.user.id, deletedAt: null },
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
          deletedAt: null,
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
    creatorIndiekitIntegrationsLogger.error({ err: formatError(error) }, "Integrations GET error:");
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
    const { action, provider, service, projectId, apiKey, apiSecret } = body;

    // Credential connect from the IndieKit Integrations tab.
    //
    // That UI posts { projectId, service, apiKey, apiSecret } and no `action`,
    // so every attempt fell past the action branches below and came back
    // "Unknown action" with a 400 — which the button surfaced verbatim as its
    // failure toast. Even matching the action name would not have helped: all
    // three branches are stubs that store nothing. This is the real handler.
    if (service) {
      if (service !== "shipstation") {
        return NextResponse.json(
          { error: `Connecting ${service} from this screen isn't supported yet.` },
          { status: 400 }
        );
      }

      if (!projectId || typeof apiKey !== "string" || typeof apiSecret !== "string") {
        return NextResponse.json(
          { error: "Project, API key and API secret are all required" },
          { status: 400 }
        );
      }

      const key = apiKey.trim();
      const secret = apiSecret.trim();
      if (!key || !secret) {
        return NextResponse.json(
          { error: "API key and API secret cannot be blank" },
          { status: 400 }
        );
      }

      // Credentials live on the creator's user record — that is where the
      // order push and tracking sync read them from, for collaborators too —
      // so only the creator may set them.
      const project = await db.project.findFirst({
        where: { id: projectId, deletedAt: null, creatorId: session.user.id },
        select: { id: true },
      });

      if (!project) {
        return NextResponse.json(
          {
            error:
              "Only the project creator can connect ShipStation. Collaborators use the creator's connection.",
          },
          { status: 403 }
        );
      }

      // Prove the credentials work before storing them. Saving unverified keys
      // is how "connected" ends up meaning nothing and the failure only
      // surfaces later, in the middle of a fulfilment run.
      let check: Response;
      try {
        check = await circuitBreaker.execute("shipstation", () =>
          fetch("https://ssapi.shipstation.com/carriers", {
            headers: {
              Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}`,
            },
          })
        );
      } catch (error) {
        creatorIndiekitIntegrationsLogger.error(
          { err: formatError(error), projectId },
          "ShipStation credential check could not reach the API"
        );
        return NextResponse.json(
          { error: "Couldn't reach ShipStation just now. Try again in a minute." },
          { status: 502 }
        );
      }

      if (!check.ok) {
        // Say which failure it was. "Can't connect" with no reason is what
        // sent this back to us as a support ticket in the first place.
        const reason =
          check.status === 401 || check.status === 403
            ? "ShipStation rejected those credentials. Check the API Key and API Secret in ShipStation under Settings > Account > API Settings."
            : check.status === 429
              ? "ShipStation is rate limiting this account right now. Wait a minute and try again."
              : `ShipStation returned ${check.status} ${check.statusText || ""}`.trim();

        creatorIndiekitIntegrationsLogger.warn(
          { projectId, status: check.status },
          "ShipStation credential check failed"
        );

        await db.fulfillmentIntegration.upsert({
          where: { projectId_provider: { projectId, provider: "SHIPSTATION" } },
          create: {
            projectId,
            provider: "SHIPSTATION",
            credentials: {},
            status: "ERROR",
            lastSyncError: reason,
          },
          update: { status: "ERROR", lastSyncError: reason },
        });

        return NextResponse.json({ error: reason }, { status: 400 });
      }

      await db.user.update({
        where: { id: session.user.id },
        data: {
          shipstationApiKey: encryptCredential(key),
          shipstationApiSecret: encryptCredential(secret),
        },
      });

      // The row is what the GET above reports as "connected". The secrets are
      // deliberately not copied into its credentials column — one encrypted
      // home for them, not two to keep in step.
      await db.fulfillmentIntegration.upsert({
        where: { projectId_provider: { projectId, provider: "SHIPSTATION" } },
        create: {
          projectId,
          provider: "SHIPSTATION",
          credentials: { storedOn: "user" },
          status: "CONNECTED",
          lastSyncError: null,
        },
        update: {
          credentials: { storedOn: "user" },
          status: "CONNECTED",
          lastSyncError: null,
        },
      });

      return NextResponse.json({ success: true, message: "Connected to ShipStation" });
    }

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
    creatorIndiekitIntegrationsLogger.error({ err: formatError(error) }, "Integrations POST error:");
    return NextResponse.json({ error: "Failed to process integration request" }, { status: 500 });
  }
}
