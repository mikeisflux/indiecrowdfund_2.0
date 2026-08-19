import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import crypto from "crypto";
import { pushOrdersToShopify } from "@/lib/shopify-push";
import { syncShopifyTracking } from "@/lib/shopify-push";
import { decryptCredential } from "@/lib/encryption";
import { logger } from "@/lib/logger";
import { sendSurveyAvailableEmail } from "@/lib/email";

const backersLogger = logger.child({ module: "indiekit-backers" });

export const dynamic = "force-dynamic";

// Bulk action schema
const bulkActionSchema = z.object({
  action: z.enum([
    "send_survey_reminder",
    "charge_cards",
    "lock_orders",
    "lock_addresses",
    "push_to_fulfillment",
    "mark_shipped",
    "sync_tracking",
  ]),
  pledgeIds: z.array(z.string()).optional(),
  sendToAll: z.boolean().optional(),
  projectId: z.string(),
  idempotencyKey: z.string().optional(),
});

// POST - Perform bulk actions on backers
// Carrier routes that accept { projectId, action: "sync_tracking" }. Shopify
// is absent on purpose — it is not a carrier and its tracking comes from a
// completed order rather than a shipments endpoint, so it has its own path.
const PROVIDER_SYNC_ENDPOINTS: Record<string, string> = {
  SHIPSTATION: "/api/creator/indiekit/shipstation",
  SHIPPO: "/api/creator/indiekit/shippo",
  EASYPOST: "/api/creator/indiekit/easypost",
  STAMPS: "/api/creator/indiekit/stamps",
};

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { action, pledgeIds: rawPledgeIds, sendToAll, projectId, idempotencyKey } = bulkActionSchema.parse(body);

    // For non-survey actions, pledgeIds is required
    // sync_tracking is campaign-wide: it asks the carriers which shipments
    // have tracking now, and there is no sensible way to select that in
    // advance. Everything else operates on a chosen set of backers.
    const ACTIONS_WITHOUT_PLEDGE_IDS = new Set(["send_survey_reminder", "sync_tracking"]);
    if (!ACTIONS_WITHOUT_PLEDGE_IDS.has(action) && (!rawPledgeIds || rawPledgeIds.length === 0)) {
      return NextResponse.json({ error: "pledgeIds is required for this action" }, { status: 400 });
    }

    // For survey reminders with sendToAll, fetch all pending pledges for this project
    let pledgeIds: string[] = rawPledgeIds || [];
    if (action === "send_survey_reminder" && sendToAll) {
      const allPledges = await db.pledge.findMany({
        where: { projectId, status: "COMPLETED", deletedAt: null },
        select: { id: true },
      });
      pledgeIds = allPledges.map(p => p.id);
    } else if (action === "send_survey_reminder" && pledgeIds.length === 0) {
      return NextResponse.json({ error: "No backers selected" }, { status: 400 });
    }

    // Verify user has access to this project FIRST (before idempotency check to prevent info leakage)
    const project = await db.project.findFirst({
      where: {
        id: projectId,
        deletedAt: null,
        OR: [
          { creatorId: session.user.id },
          {
            collaborators: {
              some: {
                userId: session.user.id,
                status: "ACCEPTED",
              },
            },
          },
        ],
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 403 });
    }

    // Idempotency check for charge_cards to prevent duplicate charges
    if (action === "charge_cards") {
      const key = idempotencyKey || crypto.randomUUID();
      const existingActivity = await db.fulfillmentActivity.findFirst({
        where: {
          projectId,
          type: "CARDS_CHARGED",
          metadata: { path: ["idempotencyKey"], equals: key },
        },
      });

      if (existingActivity) {
        return NextResponse.json({
          success: true,
          action,
          results: { success: 0, failed: 0 },
          message: "Duplicate request - charge already processed",
          idempotencyKey: key,
        });
      }
    }

    // Get pledges
    const pledges = await db.pledge.findMany({
      where: {
        id: { in: pledgeIds },
        projectId,
        deletedAt: null,
      },
      include: {
        user: { select: { email: true, name: true } },
      },
    });

    if (pledges.length === 0) {
      return NextResponse.json({ error: "No valid pledges found" }, { status: 400 });
    }

    const results: { success: number; failed: number; errors?: string[] } = {
      success: 0,
      failed: 0,
      errors: [],
    };

    switch (action) {
      case "send_survey_reminder": {
        // Get survey for project
        const survey = await db.survey.findUnique({
          where: { projectId },
          select: { id: true },
        });

        if (!survey) {
          return NextResponse.json({ error: "No survey found for this project" }, { status: 400 });
        }

        // Find which pledges already have a completed survey response
        const completedResponses = await db.surveyResponse.findMany({
          where: { surveyId: survey.id, pledgeId: { in: pledgeIds }, isComplete: true },
          select: { pledgeId: true },
        });
        const completedPledgeIds = new Set(completedResponses.map(sr => sr.pledgeId));

        // Get the pending pledges with user data so we can email them
        const pendingPledges = await db.pledge.findMany({
          where: {
            id: { in: pledgeIds.filter(id => !completedPledgeIds.has(id)) },
            status: "COMPLETED",
          },
          select: {
            id: true,
            user: { select: { email: true, name: true } },
          },
        });

        // Get project title and creator name for email
        const projectForEmail = await db.project.findFirst({
          where: { id: projectId , deletedAt: null },
          select: {
            title: true,
            creator: { select: { name: true } },
          },
        });

        const creatorName = projectForEmail?.creator?.name || "The Creator";
        const projectTitle = projectForEmail?.title || "";

        // Send reminder emails
        let emailsSent = 0;
        const emailErrors: string[] = [];

        for (const pledge of pendingPledges) {
          if (pledge.user?.email) {
            try {
              await sendSurveyAvailableEmail(
                pledge.user.email,
                pledge.user.name || "Backer",
                projectTitle,
                creatorName,
                pledge.id
              );
              emailsSent++;
            } catch (emailError) {
              const errMsg = `Failed to email ${pledge.user.email}: ${String(emailError)}`;
              backersLogger.error({ err: String(emailError) }, errMsg);
              emailErrors.push(errMsg);
            }
          }
        }

        // Log activity
        await db.fulfillmentActivity.create({
          data: {
            projectId,
            type: "SURVEY_REMINDER",
            title: `Survey reminder sent to ${emailsSent} backers`,
            affectedCount: emailsSent,
            metadata: { pledgeIds: pendingPledges.map(p => p.id) },
          },
        });

        results.success = emailsSent;
        results.failed = pledgeIds.length - emailsSent;
        if (emailErrors.length > 0) results.errors = emailErrors;
        break;
      }

      case "lock_orders": {
        // Update survey to locked status
        await db.survey.update({
          where: { projectId },
          data: { status: "LOCKED", lockedAt: new Date() },
        });

        // Log activity
        await db.fulfillmentActivity.create({
          data: {
            projectId,
            type: "ORDERS_LOCKED",
            title: `Orders locked for ${pledgeIds.length} backers`,
            affectedCount: pledgeIds.length,
          },
        });

        results.success = pledgeIds.length;
        break;
      }

      case "lock_addresses": {
        // Lock addresses in survey responses
        await db.surveyResponse.updateMany({
          where: {
            pledgeId: { in: pledgeIds },
            survey: { projectId },
          },
          data: { addressLocked: true },
        });

        // Log activity
        await db.fulfillmentActivity.create({
          data: {
            projectId,
            type: "ADDRESSES_LOCKED",
            title: `Addresses locked for ${pledgeIds.length} backers`,
            affectedCount: pledgeIds.length,
          },
        });

        results.success = pledgeIds.length;
        break;
      }

      case "push_to_fulfillment": {
        backersLogger.info({ projectId, pledgeCount: pledgeIds.length }, "push_to_fulfillment starting");

        // Get ALL connected fulfillment integrations for this project
        let connectedIntegrations = await db.fulfillmentIntegration.findMany({
          where: {
            projectId,
            status: "CONNECTED",
          },
        });
        backersLogger.info({ count: connectedIntegrations.length }, "Found integrations");

        // Check if project has Shopify integration yet
        const hasShopifyIntegration = connectedIntegrations.some((i: { provider: string }) => i.provider === "SHOPIFY");
        backersLogger.info({ hasShopifyIntegration }, "Shopify integration check");

        if (!hasShopifyIntegration) {
          // Get the project creator's Shopify credentials (collaborators use creator's connection)
          const projectWithCreator = await db.project.findFirst({
            where: { id: projectId , deletedAt: null },
            select: {
              creatorId: true,
              creator: {
                select: {
                  shopifyAccessToken: true,
                  shopifyShopDomain: true,
                },
              },
            },
          });

          const creator = projectWithCreator?.creator;
          backersLogger.info({ hasToken: !!creator?.shopifyAccessToken, hasDomain: !!creator?.shopifyShopDomain }, "Creator Shopify credentials");
          if (creator?.shopifyAccessToken && creator?.shopifyShopDomain) {
            // Decrypt access token (backwards compatible with legacy unencrypted values)
            let decryptedToken: string;
            try {
              decryptedToken = decryptCredential(creator.shopifyAccessToken);
            } catch {
              decryptedToken = creator.shopifyAccessToken;
            }
            // Auto-create FulfillmentIntegration for this project using creator's credentials
            const integration = await db.fulfillmentIntegration.upsert({
              where: {
                projectId_provider: {
                  projectId,
                  provider: "SHOPIFY",
                },
              },
              create: {
                projectId,
                provider: "SHOPIFY",
                status: "CONNECTED",
                credentials: {
                  shopDomain: creator.shopifyShopDomain,
                  accessToken: decryptedToken,
                },
              },
              update: {
                status: "CONNECTED",
                credentials: {
                  shopDomain: creator.shopifyShopDomain,
                  accessToken: decryptedToken,
                },
              },
            });
            connectedIntegrations = [...connectedIntegrations, integration];
          }
        }

        const pushedProviders: string[] = [];
        let totalPushed = 0;
        let totalFailed = 0;
        const allErrors: string[] = [];

        backersLogger.info({ count: connectedIntegrations.length }, "Total integrations to process");

        // Push to each connected provider - continue on failure to handle partial success
        for (const integration of connectedIntegrations) {
          try {
          if (integration.provider === "SHOPIFY") {
            const shopifyResult = await pushOrdersToShopify(projectId, pledgeIds);

            if (shopifyResult.success) {
              totalPushed += shopifyResult.pushed || 0;
              totalFailed += shopifyResult.failed || 0;
              if (shopifyResult.errors) {
                allErrors.push(...shopifyResult.errors.map((e: string) => `Shopify: ${e}`));
              }
              pushedProviders.push("Shopify");
            } else {
              allErrors.push(`Shopify: ${shopifyResult.message || "Push failed"}`);
            }
          } else if (integration.provider === "SHIPSTATION") {
            // Push to ShipStation
            const shipstationResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ""}/api/creator/indiekit/shipstation`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Cookie": req.headers.get("cookie") || "",
              },
              body: JSON.stringify({
                projectId,
                action: "push_orders",
                backerIds: pledgeIds,
              }),
            });

            if (shipstationResponse.ok) {
              const shipstationResult = await shipstationResponse.json();
              totalPushed += shipstationResult.pushed || 0;
              totalFailed += shipstationResult.failed || 0;
              if (shipstationResult.errors) {
                allErrors.push(...shipstationResult.errors.map((e: string) => `ShipStation: ${e}`));
              }
              pushedProviders.push("ShipStation");
            } else {
              const errorResult = await shipstationResponse.json().catch(() => ({}));
              allErrors.push(`ShipStation: ${errorResult.error || "Push failed"}`);
            }
          } else if (integration.provider === "SHIPPO") {
            // Push to Shippo
            const shippoResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ""}/api/creator/indiekit/shippo`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Cookie": req.headers.get("cookie") || "",
              },
              body: JSON.stringify({
                projectId,
                action: "push_orders",
                backerIds: pledgeIds,
              }),
            });

            if (shippoResponse.ok) {
              const shippoResult = await shippoResponse.json();
              totalPushed += shippoResult.pushed || 0;
              totalFailed += shippoResult.failed || 0;
              if (shippoResult.errors) {
                allErrors.push(...shippoResult.errors.map((e: string) => `Shippo: ${e}`));
              }
              pushedProviders.push("Shippo");
            } else {
              const errorResult = await shippoResponse.json().catch(() => ({}));
              allErrors.push(`Shippo: ${errorResult.error || "Push failed"}`);
            }
          } else if (integration.provider === "EASYPOST") {
            // Push to EasyPost
            const easypostResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ""}/api/creator/indiekit/easypost`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Cookie": req.headers.get("cookie") || "",
              },
              body: JSON.stringify({
                projectId,
                action: "push_orders",
                backerIds: pledgeIds,
              }),
            });

            if (easypostResponse.ok) {
              const easypostResult = await easypostResponse.json();
              totalPushed += easypostResult.pushed || 0;
              totalFailed += easypostResult.failed || 0;
              if (easypostResult.errors) {
                allErrors.push(...easypostResult.errors.map((e: string) => `EasyPost: ${e}`));
              }
              pushedProviders.push("EasyPost");
            } else {
              const errorResult = await easypostResponse.json().catch(() => ({}));
              allErrors.push(`EasyPost: ${errorResult.error || "Push failed"}`);
            }
          } else if (integration.provider === "STAMPS_COM") {
            // Push to Stamps.com
            const stampsResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ""}/api/creator/indiekit/stamps`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Cookie": req.headers.get("cookie") || "",
              },
              body: JSON.stringify({
                projectId,
                action: "push_orders",
                backerIds: pledgeIds,
              }),
            });

            if (stampsResponse.ok) {
              const stampsResult = await stampsResponse.json();
              totalPushed += stampsResult.pushed || 0;
              totalFailed += stampsResult.failed || 0;
              if (stampsResult.errors) {
                allErrors.push(...stampsResult.errors.map((e: string) => `Stamps.com: ${e}`));
              }
              pushedProviders.push("Stamps.com");
            } else {
              const errorResult = await stampsResponse.json().catch(() => ({}));
              allErrors.push(`Stamps.com: ${errorResult.error || "Push failed"}`);
            }
          }
          } catch (providerError) {
            // Catch individual provider failures so remaining providers still get processed
            const providerName = integration.provider || "Unknown";
            const errorMsg = providerError instanceof Error ? providerError.message : "Unknown error";
            allErrors.push(`${providerName}: ${errorMsg}`);
            backersLogger.error({ provider: providerName, err: errorMsg }, "Fulfillment provider failed");
          }
        }

        // If no integrations connected, just update local status
        if (connectedIntegrations.length === 0) {
          await db.pledge.updateMany({
            where: {
              id: { in: pledgeIds },
              projectId,
            },
            data: { fulfillmentStatus: "IN_PROGRESS" },
          });
          results.success = pledgeIds.length;
        } else {
          results.success = totalPushed > 0 ? totalPushed : pledgeIds.length;
          results.failed = totalFailed;
          if (allErrors.length > 0) {
            results.errors = allErrors.slice(0, 10); // Limit to 10 errors
          }
        }

        // Log activity with partial-success details
        const providerList = pushedProviders.length > 0 ? ` to ${pushedProviders.join(", ")}` : "";
        const pushTitle = results.failed > 0
          ? `${results.success} orders pushed${providerList} (${results.failed} failed)`
          : `${results.success} orders pushed${providerList}`;
        await db.fulfillmentActivity.create({
          data: {
            projectId,
            type: "ORDERS_PUSHED",
            title: pushTitle,
            affectedCount: results.success,
            metadata: {
              providers: pushedProviders,
              successCount: results.success,
              failedCount: results.failed,
              errors: allErrors.slice(0, 20),
              pledgeIds,
            },
          },
        });

        break;
      }

      case "sync_tracking": {
        // Pull tracking numbers back from whichever carriers this campaign is
        // connected to, and write them onto the pledges so backers can see
        // them. Nothing called this before: the per-provider sync endpoints
        // existed but had no button and no cron, so a creator could buy a
        // hundred labels and every backer would still read "not shipped".
        //
        // Unlike push_to_fulfillment this takes no pledge selection — there is
        // no sensible partial answer to "which shipments have tracking yet".
        const integrations = await db.fulfillmentIntegration.findMany({
          where: { projectId, status: "CONNECTED" },
        });

        if (integrations.length === 0) {
          return NextResponse.json({
            success: true,
            synced: 0,
            message: "No fulfillment service is connected to this campaign.",
          });
        }

        let totalSynced = 0;
        let totalRemaining = 0;
        let totalAwaiting = 0;
        const syncedProviders: string[] = [];
        const syncErrors: string[] = [];

        for (const integration of integrations) {
          try {
            if (integration.provider === "SHOPIFY") {
              const result = await syncShopifyTracking(projectId);
              totalSynced += result.synced;
              totalRemaining += result.remaining;
              totalAwaiting += result.awaitingCompletion;
              if (result.errors) syncErrors.push(...result.errors.map((e) => `Shopify: ${e}`));
              if (result.success) syncedProviders.push("Shopify");
              continue;
            }

            // The carrier routes each expose the same sync_tracking action.
            const endpoint = PROVIDER_SYNC_ENDPOINTS[integration.provider];
            if (!endpoint) continue;

            const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ""}${endpoint}`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Cookie: req.headers.get("cookie") || "",
              },
              body: JSON.stringify({ projectId, action: "sync_tracking" }),
            });
            const data = await response.json().catch(() => ({}));
            if (response.ok) {
              totalSynced += data.synced || 0;
              totalRemaining += data.remaining || 0;
              syncedProviders.push(integration.provider);
            } else {
              syncErrors.push(`${integration.provider}: ${data.error || "Sync failed"}`);
            }
          } catch (providerError) {
            const message = providerError instanceof Error ? providerError.message : "Unknown error";
            syncErrors.push(`${integration.provider}: ${message}`);
            backersLogger.error({ provider: integration.provider, err: message }, "Tracking sync failed");
          }
        }

        if (totalSynced > 0) {
          await db.fulfillmentActivity.create({
            data: {
              projectId,
              // ORDER_SHIPPED rather than a new enum member: tracking
              // arriving IS the order shipping, and adding a value to a
              // Postgres enum would mean another migration for no gain.
              type: "ORDER_SHIPPED",
              title: `Tracking synced for ${totalSynced} order(s)`,
              affectedCount: totalSynced,
              metadata: {
                providers: syncedProviders,
                synced: totalSynced,
                remaining: totalRemaining,
                awaitingCompletion: totalAwaiting,
                errors: syncErrors.slice(0, 20),
              },
            },
          });
        }

        const parts = [
          totalSynced > 0
            ? `Tracking updated for ${totalSynced} order(s).`
            : "No new tracking numbers were available.",
        ];
        if (totalAwaiting > 0) {
          parts.push(
            `${totalAwaiting} Shopify draft order(s) still need completing before they can be fulfilled.`
          );
        }
        if (totalRemaining > 0) {
          parts.push(`${totalRemaining} order(s) not checked yet — run it again to continue.`);
        }

        return NextResponse.json({
          success: true,
          synced: totalSynced,
          remaining: totalRemaining,
          awaitingCompletion: totalAwaiting,
          providers: syncedProviders,
          errors: syncErrors.length > 0 ? syncErrors.slice(0, 10) : undefined,
          message: parts.join(" "),
        });
      }

      case "mark_shipped": {
        await db.pledge.updateMany({
          where: {
            id: { in: pledgeIds },
            projectId,
          },
          data: { fulfillmentStatus: "SHIPPED" },
        });

        // Log activity
        await db.fulfillmentActivity.create({
          data: {
            projectId,
            type: "ORDER_SHIPPED",
            title: `${pledgeIds.length} orders marked as shipped`,
            affectedCount: pledgeIds.length,
          },
        });

        results.success = pledgeIds.length;
        break;
      }

      case "charge_cards": {
        // Stripe saved-card charging is no longer supported.
        // DC/PayPal/Whop process payments through their own flows;
        // there is no creator-initiated bulk charge for those.
        return NextResponse.json(
          { error: "Bulk card charging is no longer supported on this platform." },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      action,
      results,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ');
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
    backersLogger.error({ err: error instanceof Error ? error.message : String(error) }, "IndieKit backers bulk action error");
    return NextResponse.json(
      { error: "Failed to perform bulk action" },
      { status: 500 }
    );
  }
}
