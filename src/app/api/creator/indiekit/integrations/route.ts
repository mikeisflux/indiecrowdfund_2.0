import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const creatorIndiekitIntegrationsLogger = logger.child({ module: "creator-indiekit-integrations" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { circuitBreaker } from "@/lib/circuit-breaker";
import {
  canManageShipStation,
  encryptShipStationCredentials,
  fetchShipStationStores,
  getShipStationStoreSelection,
  resolveShipStationCredentials,
  saveShipStationStore,
} from "@/lib/fulfillment/shipstation-credentials";

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
    type IntegrationState = {
      connected: boolean;
      status: string | null;
      lastSyncError: string | null;
      storeId?: number | null;
      storeName?: string | null;
    };
    const blank = (): IntegrationState => ({
      connected: false,
      status: null,
      lastSyncError: null,
    });
    const fulfillmentIntegrations = {
      shopify: blank(),
      shipstation: blank(),
      shippo: blank(),
      easypost: blank(),
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
          fulfillmentIntegrations: {
            select: {
              provider: true,
              status: true,
              lastSyncError: true,
              lastSyncAt: true,
              // Needed for the store selection only. Never returned as-is —
              // it also holds the encrypted API key and secret, and this
              // payload goes to the browser.
              credentials: true,
            },
          },
        },
      });

      // Check for connected fulfillment integrations
      if (project?.fulfillmentIntegrations) {
        for (const integration of project.fulfillmentIntegrations) {
          const provider = integration.provider.toLowerCase() as keyof typeof fulfillmentIntegrations;
          if (provider in fulfillmentIntegrations) {
            const stored = (integration.credentials ?? {}) as {
              storeId?: unknown;
              storeName?: unknown;
            };
            fulfillmentIntegrations[provider] = {
              connected: integration.status === "CONNECTED",
              status: integration.status,
              lastSyncError: integration.lastSyncError ?? null,
              storeId: typeof stored.storeId === "number" ? stored.storeId : null,
              storeName: typeof stored.storeName === "string" ? stored.storeName : null,
            };
          }
        }
      }

      // Only the two harmless fields. `project` used to be the raw rows,
      // encrypted API keys and all, handed straight to the client.
      projectIntegrations = project
        ? { id: project.id, stripeProductId: project.stripeProductId }
        : null;
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
    const { action, provider, service, projectId, apiKey, apiSecret, storeId } = body;

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

      if (!projectId) {
        return NextResponse.json({ error: "Project is required" }, { status: 400 });
      }

      // Every ShipStation action here can repoint where a campaign's orders
      // go, so they all sit behind the same permission check.
      if (!(await canManageShipStation(projectId, session.user.id))) {
        return NextResponse.json(
          {
            error:
              "You need to be the creator or an accepted collaborator on this campaign to manage ShipStation.",
          },
          { status: 403 }
        );
      }

      // --- Store selection -------------------------------------------------
      //
      // A ShipStation account has one store per selling channel. Until now
      // nothing asked which one, so pushed orders landed in whichever store
      // the account defaults to — the complaint that prompted this.

      if (action === "list_stores" || action === "set_store") {
        const project = await db.project.findFirst({
          where: { id: projectId, deletedAt: null },
          select: { creatorId: true },
        });
        if (!project) {
          return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        const existing = await resolveShipStationCredentials(projectId, project.creatorId);
        if (!existing) {
          return NextResponse.json(
            { error: "Connect ShipStation first, then choose a store." },
            { status: 400 }
          );
        }

        const stores = await fetchShipStationStores(existing.apiKey, existing.apiSecret);

        if (action === "list_stores") {
          return NextResponse.json({
            stores: stores ?? [],
            storeId: existing.storeId,
            storeName: existing.storeName,
            // Distinguishes "this account genuinely has no stores" from
            // "we could not ask", which need different messages in the UI.
            storesUnavailable: stores === null,
          });
        }

        // set_store. null clears the selection back to the account default.
        if (storeId === null) {
          await saveShipStationStore(projectId, null);
          return NextResponse.json({ success: true, storeId: null, storeName: null });
        }

        const chosen = (stores ?? []).find((s) => s.storeId === Number(storeId));
        if (!chosen) {
          return NextResponse.json(
            { error: "That store isn't on this ShipStation account." },
            { status: 400 }
          );
        }

        await saveShipStationStore(projectId, {
          storeId: chosen.storeId,
          storeName: chosen.storeName,
        });
        return NextResponse.json({
          success: true,
          storeId: chosen.storeId,
          storeName: chosen.storeName,
        });
      }

      if (action === "disconnect") {
        await db.fulfillmentIntegration.updateMany({
          where: { projectId, provider: "SHIPSTATION" },
          data: {
            credentials: {},
            status: "DISCONNECTED",
            lastSyncError: null,
          },
        });
        return NextResponse.json({ success: true, message: "Disconnected from ShipStation" });
      }

      // --- Connect ---------------------------------------------------------

      if (typeof apiKey !== "string" || typeof apiSecret !== "string") {
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

      // Permission was checked above: the creator or an accepted collaborator.
      // The fulfilment partner is usually a collaborator rather than the
      // creator, and they are the one holding the ShipStation account, so
      // locking this to the creator put the connection in the hands of the
      // person who does not do the shipping. Credentials are stored against
      // the project (below), so a collaborator connecting here cannot affect
      // the creator's other campaigns.

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

      // Which stores this account has, so the creator can say where orders
      // should import to instead of finding out after the first push. Asked
      // for before the write so a single-store account can be resolved in one
      // step; a null result (plan gating, a blip) just means no picker.
      const stores = await fetchShipStationStores(key, secret);

      // Re-entering keys must not silently move where orders go, so an
      // existing selection is kept as long as the account still has that
      // store. Otherwise: one store is not a choice, and selecting it is the
      // difference between "connected" and "connected, now answer a question
      // with one possible answer".
      const previous = await getShipStationStoreSelection(projectId);
      const keptStore =
        previous.storeId !== null
          ? (stores ?? []).find((s) => s.storeId === previous.storeId) ??
            // Nothing to check it against, so trust what was already chosen.
            (stores === null
              ? { storeId: previous.storeId, storeName: previous.storeName ?? "" }
              : null)
          : null;
      const soleStore = keptStore ?? (stores && stores.length === 1 ? stores[0] : null);

      // Stored against the project, encrypted, rather than on whoever happened
      // to submit the form. Scoping it this way is what makes it safe for a
      // collaborator to connect: it cannot reach the creator's other campaigns.
      const credentials: Record<string, unknown> = encryptShipStationCredentials(key, secret);
      if (soleStore) {
        credentials.storeId = soleStore.storeId;
        credentials.storeName = soleStore.storeName;
      }

      await db.fulfillmentIntegration.upsert({
        where: { projectId_provider: { projectId, provider: "SHIPSTATION" } },
        create: {
          projectId,
          provider: "SHIPSTATION",
          credentials,
          status: "CONNECTED",
          lastSyncError: null,
        },
        update: { credentials, status: "CONNECTED", lastSyncError: null },
      });

      return NextResponse.json({
        success: true,
        message: "Connected to ShipStation",
        stores: stores ?? [],
        storesUnavailable: stores === null,
        storeId: soleStore?.storeId ?? null,
        storeName: soleStore?.storeName ?? null,
      });
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
