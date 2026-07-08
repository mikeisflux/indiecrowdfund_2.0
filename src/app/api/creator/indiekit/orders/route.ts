import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const creatorIndiekitOrdersLogger = logger.child({ module: "creator-indiekit-orders" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// GET - Fetch available addons for a project (used by EditOrderDialog)
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    // Verify user has access to this project
    const project = await db.project.findFirst({
      where: {
        id: projectId,
        deletedAt: null,
        OR: [
          { creatorId: session.user.id },
          {
            collaborators: {
              some: {
                OR: [
                  { userId: session.user.id, status: "ACCEPTED" },
                  ...(session.user.email ? [{ email: { equals: session.user.email, mode: "insensitive" as const }, status: "ACCEPTED" as const }] : []),
                ],
              },
            },
          },
        ],
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 403 });
    }

    // Get reward IDs that are used as pledge-level tiers (main reward on pledges)
    // These should NOT appear in the add-ons checklist even if typed as ADDON.
    // Prisma 7 rejects `{ field: { not: null } }` on nullable string fields
    // at runtime — use `NOT: { field: null }` wrapper syntax instead.
    const pledgeTierIds = await db.pledge.findMany({
      where: { projectId, NOT: { rewardId: null }, deletedAt: null },
      select: { rewardId: true },
      distinct: ["rewardId"],
    });
    const tierRewardIds = pledgeTierIds.map(p => p.rewardId).filter((id): id is string => id !== null);

    // Get all ADDON type rewards, excluding those used as pledge tiers
    const addons = await db.reward.findMany({
      where: {
        projectId,
        type: "ADDON",
        ...(tierRewardIds.length > 0 ? { id: { notIn: tierRewardIds } } : {}),
      },
      select: {
        id: true,
        title: true,
        amount: true,
        isEnded: true,
        visibility: true,
      },
      orderBy: { amount: "asc" },
    });

    return NextResponse.json({
      addons: addons.map(a => ({
        id: a.id,
        name: a.title,
        price: Number(a.amount),
      })),
    });
  } catch (error) {
    creatorIndiekitOrdersLogger.error({ err: formatError(error) }, "Fetch addons error:");
    return NextResponse.json({ error: "Failed to fetch addons" }, { status: 500 });
  }
}

const editOrderSchema = z.object({
  pledgeId: z.string(),
  projectId: z.string(),
  addons: z.array(z.object({
    addonId: z.string(),
    quantity: z.number().int().min(0),
  })),
  shippingAmount: z.number().min(0).optional(),
});

// PATCH - Edit order addons and shipping
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { pledgeId, projectId, addons, shippingAmount } = editOrderSchema.parse(body);

    // Verify user has access to this project
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

    // Get the pledge and verify it belongs to this project
    const pledge = await db.pledge.findFirst({
      where: {
        id: pledgeId,
        deletedAt: null,
        projectId,
        status: "COMPLETED",
      },
      include: {
        addons: true,
      },
    });

    if (!pledge) {
      return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
    }

    // Get all the addon rewards to validate and get prices
    const addonIds = addons.filter(a => a.quantity > 0).map(a => a.addonId);
    const addonRewards = await db.reward.findMany({
      where: {
        id: { in: addonIds },
        projectId,
        type: "ADDON",
      },
    });

    const addonRewardMap = new Map(addonRewards.map(r => [r.id, r]));

    // Validate all addon IDs exist
    for (const addon of addons.filter(a => a.quantity > 0)) {
      if (!addonRewardMap.has(addon.addonId)) {
        return NextResponse.json(
          { error: `Addon ${addon.addonId} not found in project` },
          { status: 400 }
        );
      }
    }

    // Build a map of existing addons
    type ExistingAddon = { id: string; addonId: string; quantity: number; amount: unknown };
    const existingAddonMap = new Map<string, ExistingAddon>(
      pledge.addons.map((a: ExistingAddon) => [a.addonId, a])
    );

    // Calculate new addons total
    let newAddonsAmount = 0;
    for (const addon of addons.filter(a => a.quantity > 0)) {
      const reward = addonRewardMap.get(addon.addonId)!;
      newAddonsAmount += Number(reward.amount) * addon.quantity;
    }

    // Calculate the financial diff based on ITEMS total change (not pledge.amount which may include overpayment/tips)
    const chargedAmount = Number(pledge.amount);
    const rewardAmount = Number(pledge.rewardAmount);
    const newShipping = shippingAmount !== undefined ? shippingAmount : Number(pledge.shippingAmount);

    // Perform all changes in a transaction that re-reads the pledge
    // metadata INSIDE the transaction (using a FOR UPDATE row lock via
    // $queryRaw) so two concurrent edits to the same order can't both
    // read the same stale balanceDue and lose one edit's delta.
    let newBalanceDue = 0;
    let balanceChange = 0;
    let previousItemsTotal = 0;
    let newTotal = 0;
    await db.$transaction(async (tx) => {
      // Lock the pledge row and re-read the current balanceDue/shipping/
      // addonsAmount state inside the transaction.
      await tx.$executeRaw`SELECT id FROM "Pledge" WHERE id = ${pledgeId} FOR UPDATE`;
      const freshPledge = await tx.pledge.findUnique({
        where: { id: pledgeId },
        select: { metadata: true, addonsAmount: true, shippingAmount: true },
      });
      if (!freshPledge) {
        throw new Error("PLEDGE_DISAPPEARED");
      }

      const freshAddons = Number(freshPledge.addonsAmount);
      const freshShipping = Number(freshPledge.shippingAmount);
      previousItemsTotal = rewardAmount + freshAddons + freshShipping;
      newTotal = rewardAmount + newAddonsAmount + newShipping;
      balanceChange = newTotal - previousItemsTotal;

      const freshMetadata = (freshPledge.metadata as Record<string, unknown>) || {};
      const previousBalanceDue = Number(freshMetadata.balanceDue || 0);
      newBalanceDue = Math.max(0, previousBalanceDue + balanceChange);

      // Remove addons that have quantity 0 or aren't in the new list
      const addonsToRemove = addons.filter(a => a.quantity === 0).map(a => a.addonId);
      const addonsInNewList = new Set(addons.map(a => a.addonId));

      // Delete addons that are removed (quantity 0 or not in new list)
      for (const existing of pledge.addons) {
        if (addonsToRemove.includes(existing.addonId) || !addonsInNewList.has(existing.addonId)) {
          await tx.pledgeAddon.deleteMany({
            where: { id: existing.id },
          });
        }
      }

      // Upsert addons with quantity > 0
      for (const addon of addons.filter(a => a.quantity > 0)) {
        const reward = addonRewardMap.get(addon.addonId)!;
        const amount = Number(reward.amount) * addon.quantity;
        const existing = existingAddonMap.get(addon.addonId);

        if (existing) {
          await tx.pledgeAddon.update({
            where: { id: existing.id },
            data: {
              quantity: addon.quantity,
              amount,
            },
          });
        } else {
          await tx.pledgeAddon.create({
            data: {
              pledgeId,
              addonId: addon.addonId,
              quantity: addon.quantity,
              amount,
            },
          });
        }
      }

      // Update pledge addon/shipping amounts and balance due in metadata
      await tx.pledge.update({
        where: { id: pledgeId },
        data: {
          addonsAmount: newAddonsAmount,
          ...(shippingAmount !== undefined ? { shippingAmount } : {}),
          metadata: {
            ...freshMetadata,
            balanceDue: newBalanceDue,
          },
        },
      });

      // Log the activity with financial details
      const balanceNote = balanceChange < 0
        ? ` Credit of $${Math.abs(balanceChange).toFixed(2)} owed to backer.`
        : balanceChange > 0
          ? ` Additional $${balanceChange.toFixed(2)} owed by backer.`
          : "";

      await tx.fulfillmentActivity.create({
        data: {
          projectId,
          type: "BALANCE_ADJUSTED",
          title: "Order Edited",
          description: `Add-ons updated for pledge ${pledgeId}. New add-ons total: $${newAddonsAmount.toFixed(2)}${shippingAmount !== undefined ? `, Shipping: $${newShipping.toFixed(2)}` : ""}.${balanceNote}`,
          pledgeId,
          metadata: {
            previousItemsTotal,
            newTotal,
            balanceChange,
            previousAddonsAmount: freshAddons,
            newAddonsAmount,
            previousShipping: freshShipping,
            newShipping,
            balanceDue: newBalanceDue,
          },
        },
      });
    });

    // Return updated pledge data
    const updatedPledge = await db.pledge.findFirst({
      where: { id: pledgeId, deletedAt: null },
      include: {
        addons: {
          include: {
            addon: {
              select: {
                id: true,
                title: true,
                amount: true,
                isModifier: true,
              },
            },
          },
        },
      },
    });

    const updatedAddons = updatedPledge?.addons.map((a: { addon: { id: string; title: string; amount: unknown; isModifier: boolean }; quantity: number }) => ({
      id: a.addon.id,
      name: a.addon.title,
      quantity: a.quantity,
      amount: Number(a.addon.amount),
      isModifier: a.addon.isModifier || false,
    })) || [];

    return NextResponse.json({
      success: true,
      addons: updatedAddons,
      balance: {
        pledgeAmount: chargedAmount,
        pledgeLevelAmount: Number(updatedPledge?.rewardAmount || 0),
        addonsAmount: Number(updatedPledge?.addonsAmount || 0),
        shippingAmount: Number(updatedPledge?.shippingAmount || 0),
        balanceDue: newBalanceDue,
      },
      // Financial diff: negative means refund owed, positive means additional charge needed
      balanceChange,
      previousItemsTotal,
      newTotal,
      balanceDue: newBalanceDue,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 }
      );
    }
    creatorIndiekitOrdersLogger.error({ err: formatError(error) }, "Edit order error:");
    return NextResponse.json(
      { error: "Failed to update order" },
      { status: 500 }
    );
  }
}

const addTrackingSchema = z.object({
  action: z.literal("add_tracking"),
  pledgeId: z.string(),
  projectId: z.string(),
  carrier: z.string().min(1),
  trackingNumber: z.string().min(1),
  notifyBacker: z.boolean().optional().default(false),
  markAsShipped: z.boolean().optional().default(true),
});

const adjustBalanceSchema = z.object({
  action: z.literal("adjust_balance"),
  pledgeId: z.string(),
  projectId: z.string(),
  adjustmentType: z.enum(["credit", "charge"]),
  amount: z.number().positive(),
  reason: z.string().optional(),
});

// POST - Add tracking info or adjust balance for a pledge
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { action } = body;

    if (action === "add_tracking") {
      const data = addTrackingSchema.parse(body);

      // Verify creator access
      const project = await db.project.findFirst({
        where: {
          id: data.projectId,
          deletedAt: null,
          OR: [
            { creatorId: session.user.id },
            { collaborators: { some: { userId: session.user.id, status: "ACCEPTED" } } },
          ],
        },
        select: { id: true, title: true },
      });
      if (!project) {
        return NextResponse.json({ error: "Project not found or access denied" }, { status: 403 });
      }

      const pledge = await db.pledge.findFirst({
        where: { id: data.pledgeId, projectId: data.projectId, deletedAt: null, status: "COMPLETED" },
        include: { user: { select: { email: true, name: true } } },
      });
      if (!pledge) {
        return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
      }

      const tracking = {
        carrier: data.carrier,
        trackingNumber: data.trackingNumber,
        addedAt: new Date().toISOString(),
        addedBy: session.user.id,
      };

      // Wrap metadata read-modify-write in a transaction with FOR UPDATE
      // to prevent concurrent tracking updates from losing each other's writes.
      await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT id FROM "Pledge" WHERE id = ${data.pledgeId} FOR UPDATE`;
        const freshPledge = await tx.pledge.findUnique({
          where: { id: data.pledgeId },
          select: { metadata: true },
        });
        const freshMeta = (freshPledge?.metadata as Record<string, unknown>) || {};

        await tx.pledge.update({
          where: { id: data.pledgeId },
          data: {
            metadata: { ...freshMeta, tracking },
            ...(data.markAsShipped ? { fulfillmentStatus: "SHIPPED" } : {}),
          },
        });
      });

      // Send backer notification email
      if (data.notifyBacker && pledge.user.email) {
        try {
          await sendEmail({
            to: pledge.user.email,
            subject: `Your order has shipped!`,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2>Your order is on its way!</h2>
                <p>Hi ${pledge.user.name || "Backer"},</p>
                <p>Great news! Your order for <strong>${project.title}</strong> has shipped.</p>
                <div style="background: #f5f5f5; border-radius: 8px; padding: 16px; margin: 16px 0;">
                  <p style="margin: 0;"><strong>Carrier:</strong> ${data.carrier.toUpperCase()}</p>
                  <p style="margin: 8px 0 0;"><strong>Tracking Number:</strong> <code>${data.trackingNumber}</code></p>
                </div>
                <p>Thank you for your support!</p>
              </div>
            `,
          });
        } catch (emailErr) {
          creatorIndiekitOrdersLogger.error({ err: String(emailErr) }, "Failed to send tracking notification email");
        }
      }

      return NextResponse.json({ success: true, tracking });
    }

    if (action === "adjust_balance") {
      const data = adjustBalanceSchema.parse(body);

      // Verify creator access
      const project = await db.project.findFirst({
        where: {
          id: data.projectId,
          deletedAt: null,
          OR: [
            { creatorId: session.user.id },
            { collaborators: { some: { userId: session.user.id, status: "ACCEPTED" } } },
          ],
        },
        select: { id: true },
      });
      if (!project) {
        return NextResponse.json({ error: "Project not found or access denied" }, { status: 403 });
      }

      // Verify pledge exists before entering transaction
      const pledgeCheck = await db.pledge.findFirst({
        where: { id: data.pledgeId, projectId: data.projectId, deletedAt: null, status: "COMPLETED" },
        select: { id: true },
      });
      if (!pledgeCheck) {
        return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
      }

      // MONEY OPERATION: wrap in $transaction with FOR UPDATE to prevent
      // concurrent balance adjustments from reading stale metadata and
      // overwriting each other's changes.
      const newBalanceDue = await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT id FROM "Pledge" WHERE id = ${data.pledgeId} FOR UPDATE`;
        const freshPledge = await tx.pledge.findUnique({
          where: { id: data.pledgeId },
          select: { metadata: true, amount: true, rewardAmount: true, addonsAmount: true, shippingAmount: true },
        });
        if (!freshPledge) {
          throw new Error("PLEDGE_DISAPPEARED");
        }

        const freshMeta = (freshPledge.metadata as Record<string, unknown>) || {};

        // Compute current balanceDue (same logic as compute-stats.ts)
        const storedBalanceDue = freshMeta.balanceDue != null ? Number(freshMeta.balanceDue) : null;
        const pledgeTotal = Number(freshPledge.amount);
        const expectedTotal = Number(freshPledge.rewardAmount) + Number(freshPledge.addonsAmount) + Number(freshPledge.shippingAmount);
        const computedBalanceDue = storedBalanceDue !== null ? storedBalanceDue : Math.max(0, expectedTotal - pledgeTotal);

        // Apply adjustment: credit reduces balance, charge increases it
        const delta = data.adjustmentType === "credit" ? -data.amount : data.amount;
        const resultBalanceDue = Math.round((computedBalanceDue + delta) * 100) / 100;

        // Record adjustment history
        const adjustments = Array.isArray(freshMeta.adjustments) ? [...freshMeta.adjustments] : [];
        adjustments.push({
          type: data.adjustmentType,
          amount: data.amount,
          reason: data.reason || "",
          previousBalance: computedBalanceDue,
          newBalance: resultBalanceDue,
          adjustedAt: new Date().toISOString(),
          adjustedBy: session.user.id,
        });

        await tx.pledge.update({
          where: { id: data.pledgeId },
          data: {
            metadata: { ...freshMeta, balanceDue: resultBalanceDue, adjustments },
          },
        });

        return resultBalanceDue;
      });

      return NextResponse.json({ success: true, newBalanceDue });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 }
      );
    }
    creatorIndiekitOrdersLogger.error({ err: formatError(error) }, "Orders POST error:");
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
