import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

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

    // Perform all changes in a transaction
    await db.$transaction(async (tx) => {
      // Remove addons that have quantity 0 or aren't in the new list
      const addonsToRemove = addons.filter(a => a.quantity === 0).map(a => a.addonId);
      const addonsInNewList = new Set(addons.map(a => a.addonId));

      // Delete addons that are removed (quantity 0 or not in new list)
      for (const existing of pledge.addons) {
        if (addonsToRemove.includes(existing.addonId) || !addonsInNewList.has(existing.addonId)) {
          await tx.pledgeAddon.delete({
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

      // Update pledge amounts
      const updateData: { addonsAmount: number; shippingAmount?: number; amount?: number } = {
        addonsAmount: newAddonsAmount,
      };

      if (shippingAmount !== undefined) {
        updateData.shippingAmount = shippingAmount;
      }

      // Recalculate total amount
      const rewardAmount = Number(pledge.rewardAmount);
      const shipping = shippingAmount !== undefined ? shippingAmount : Number(pledge.shippingAmount);
      updateData.amount = rewardAmount + newAddonsAmount + shipping;

      await tx.pledge.update({
        where: { id: pledgeId },
        data: updateData,
      });

      // Log the activity
      await tx.fulfillmentActivity.create({
        data: {
          projectId,
          type: "BALANCE_ADJUSTED",
          title: "Order Edited",
          description: `Add-ons updated for pledge ${pledgeId}. New add-ons total: $${newAddonsAmount.toFixed(2)}${shippingAmount !== undefined ? `, Shipping: $${shippingAmount.toFixed(2)}` : ""}`,
        },
      });
    });

    // Return updated pledge data
    const updatedPledge = await db.pledge.findUnique({
      where: { id: pledgeId },
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
        pledgeAmount: Number(updatedPledge?.amount || 0),
        pledgeLevelAmount: Number(updatedPledge?.rewardAmount || 0),
        addonsAmount: Number(updatedPledge?.addonsAmount || 0),
        shippingAmount: Number(updatedPledge?.shippingAmount || 0),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Edit order error:", error);
    return NextResponse.json(
      { error: "Failed to update order" },
      { status: 500 }
    );
  }
}
