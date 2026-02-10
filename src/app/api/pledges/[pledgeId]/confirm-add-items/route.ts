import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStripeInstance } from "@/lib/payments/stripe";

/**
 * POST /api/pledges/[pledgeId]/confirm-add-items
 *
 * Called by the frontend after successful payment for additional items.
 * This endpoint:
 * 1. Verifies the payment was successful
 * 2. Creates addon associations
 * 3. Updates addon claimed counts
 * 4. Updates project currentAmount (but NOT backerCount)
 * 5. Updates the pledge total amount
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ pledgeId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { pledgeId } = await params;

    // Get the pledge with metadata
    const pledge = await db.pledge.findUnique({
      where: { id: pledgeId },
      include: {
        project: {
          select: {
            id: true,
            currentAmount: true,
          },
        },
      },
    });

    if (!pledge) {
      return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
    }

    // Verify the pledge belongs to the current user
    if (pledge.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get pending additional items from metadata
    const metadata = pledge.metadata as {
      pendingAdditionalItems?: {
        paymentIntentId: string;
        addons?: { id: string; quantity: number }[]; // New format with quantities
        addonIds?: string[]; // Legacy format
        amount: number;
        createdAt: string;
      };
    } | null;

    const pendingItems = metadata?.pendingAdditionalItems;

    if (!pendingItems) {
      return NextResponse.json(
        { error: "No pending additional items found" },
        { status: 400 }
      );
    }

    // Support both new format (addons with quantities) and legacy format (addonIds)
    const addonsWithQuantity: { id: string; quantity: number }[] = pendingItems.addons ||
      (pendingItems.addonIds ? pendingItems.addonIds.map(id => ({ id, quantity: 1 })) : []);

    if (addonsWithQuantity.length === 0) {
      return NextResponse.json(
        { error: "No addons found in pending items" },
        { status: 400 }
      );
    }

    const addonIds = addonsWithQuantity.map(a => a.id);
    const quantityMap = new Map(addonsWithQuantity.map(a => [a.id, a.quantity]));

    // Verify payment was successful
    const stripe = await getStripeInstance();
    if (!stripe) {
      return NextResponse.json(
        { error: "Payment system unavailable" },
        { status: 500 }
      );
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(pendingItems.paymentIntentId);

    if (paymentIntent.status !== "succeeded") {
      return NextResponse.json(
        { error: "Payment not yet completed" },
        { status: 400 }
      );
    }

    // Get the addons
    const addons = await db.addon.findMany({
      where: {
        id: { in: addonIds },
      },
    });

    // Calculate total quantity for logging
    const totalQuantity = addonsWithQuantity.reduce((sum, a) => sum + a.quantity, 0);

    // Perform all updates in a transaction
    await db.$transaction(async (tx) => {
      // Create PledgeAddon records for each addon with quantity
      for (const addon of addons) {
        const quantity = quantityMap.get(addon.id) || 1;

        // Check if this addon already exists for this pledge
        const existingAddon = await tx.pledgeAddon.findFirst({
          where: {
            pledgeId: pledge.id,
            addonId: addon.id,
          },
        });

        if (existingAddon) {
          // Increment quantity
          await tx.pledgeAddon.update({
            where: { id: existingAddon.id },
            data: {
              quantity: existingAddon.quantity + quantity,
              amount: (existingAddon.quantity + quantity) * addon.amount,
            },
          });
        } else {
          // Create new
          await tx.pledgeAddon.create({
            data: {
              pledgeId: pledge.id,
              addonId: addon.id,
              quantity,
              amount: Number(addon.amount) * quantity,
            },
          });
        }

        // Atomically claim addon slots (prevents overselling)
        // Lock the row and check availability within this transaction
        const addonRows = await tx.$queryRaw<Array<{
          id: string;
          quantityAvailable: number | null;
          quantityClaimed: number;
        }>>`
          SELECT id, "quantityAvailable", "quantityClaimed"
          FROM "Addon"
          WHERE id = ${addon.id}
          FOR UPDATE
        `;

        const addonInfo = addonRows[0];
        if (addonInfo) {
          // Check if enough slots available (null means unlimited)
          const availableSlots = addonInfo.quantityAvailable === null
            ? Infinity
            : addonInfo.quantityAvailable - addonInfo.quantityClaimed;

          if (availableSlots >= quantity) {
            await tx.addon.update({
              where: { id: addon.id },
              data: { quantityClaimed: { increment: quantity } },
            });
          } else {
            console.warn(`[ConfirmAddItems] Addon ${addon.id} has only ${availableSlots} available but ${quantity} requested`);
            throw new Error(`Not enough ${addon.title || 'addon'} available`);
          }
        }
      }

      // Update pledge amount
      await tx.pledge.update({
        where: { id: pledge.id },
        data: {
          amount: pledge.amount + pendingItems.amount,
          // Clear the pending items from metadata
          metadata: {
            ...(typeof pledge.metadata === "object" && pledge.metadata !== null
              ? { ...pledge.metadata, pendingAdditionalItems: undefined }
              : {}),
            completedAdditionalItems: [
              ...((metadata as Record<string, unknown>)?.completedAdditionalItems as unknown[] || []),
              {
                paymentIntentId: pendingItems.paymentIntentId,
                addons: addonsWithQuantity,
                amount: pendingItems.amount,
                completedAt: new Date().toISOString(),
              },
            ],
          },
        },
      });

      // Update project currentAmount (but NOT backerCount!)
      await tx.project.update({
        where: { id: pledge.projectId },
        data: {
          currentAmount: { increment: pendingItems.amount },
        },
      });
    });

    console.log(`[ConfirmAddItems] Successfully added ${totalQuantity} items (${addons.length} unique) to pledge ${pledgeId}, amount: $${pendingItems.amount}`);

    return NextResponse.json({
      success: true,
      message: "Additional items added successfully",
      addedAmount: pendingItems.amount,
      addedItems: addons.map((a: { title: string }) => a.title),
    });
  } catch (error) {
    console.error("Failed to confirm additional items:", error);
    return NextResponse.json(
      { error: "Failed to confirm additional items" },
      { status: 500 }
    );
  }
}
