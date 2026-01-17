import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStripeInstance, safeCancelSetupIntent, safeCancelPaymentIntent } from "@/lib/payments/stripe";

export const dynamic = "force-dynamic";

// GET - Get pledge details
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ pledgeId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { pledgeId } = await params;

    const pledge = await db.pledge.findFirst({
      where: {
        id: pledgeId,
        userId: session.user.id,
      },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            slug: true,
            status: true,
            currentAmount: true,
            goalAmount: true,
            creatorId: true,
            creator: {
              select: {
                id: true,
                name: true,
                vanityUrl: true,
              },
            },
          },
        },
        reward: {
          select: {
            id: true,
            title: true,
            amount: true,
          },
        },
        addons: {
          include: {
            addon: {
              select: {
                id: true,
                title: true,
                amount: true,
              },
            },
          },
        },
      },
    });

    if (!pledge) {
      return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
    }

    const isFunded = Number(pledge.project.currentAmount) >= Number(pledge.project.goalAmount) || pledge.project.status === "FUNDED";

    // Build project URL with vanity URL if available
    const projectUrl = pledge.project.creator.vanityUrl
      ? `/projects/${pledge.project.creator.vanityUrl}/${pledge.project.slug}`
      : `/projects/${pledge.project.slug}`;

    return NextResponse.json({
      pledge: {
        id: pledge.id,
        amount: Number(pledge.amount),
        status: pledge.status,
        createdAt: pledge.createdAt,
        backerNumber: pledge.backerNumber,
        project: {
          id: pledge.project.id,
          title: pledge.project.title,
          slug: pledge.project.slug,
          status: pledge.project.status,
          currentAmount: Number(pledge.project.currentAmount),
          goalAmount: Number(pledge.project.goalAmount),
          projectUrl,
          creatorId: pledge.project.creatorId,
          creatorName: pledge.project.creator.name,
        },
        reward: pledge.reward ? {
          id: pledge.reward.id,
          title: pledge.reward.title,
          amount: Number(pledge.reward.amount),
        } : null,
        addons: pledge.addons.map((a: { addon: { id: string; title: string; amount: number }; quantity: number }) => ({
          id: a.addon.id,
          title: a.addon.title,
          amount: Number(a.addon.amount),
          quantity: a.quantity,
        })),
        canCancel: !isFunded && pledge.status === "PENDING",
        canIncrease: pledge.project.status === "LIVE",
        isFunded,
      },
    });
  } catch (error) {
    console.error("Get pledge error:", error);
    return NextResponse.json(
      { error: "Failed to fetch pledge" },
      { status: 500 }
    );
  }
}

// PATCH - Update pledge (increase amount or cancel)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ pledgeId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { pledgeId } = await params;
    const body = await req.json();
    const { action, amount } = body;

    // Get pledge with project info
    const pledge = await db.pledge.findFirst({
      where: {
        id: pledgeId,
        userId: session.user.id,
      },
      include: {
        project: {
          select: {
            id: true,
            status: true,
            currentAmount: true,
            goalAmount: true,
            creator: {
              include: {
                stripeConfig: true,
              },
            },
          },
        },
      },
    });

    if (!pledge) {
      return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
    }

    const isFunded = Number(pledge.project.currentAmount) >= Number(pledge.project.goalAmount) || pledge.project.status === "FUNDED";

    if (action === "cancel") {
      // Can only cancel if NOT funded and pledge is pending
      if (isFunded) {
        return NextResponse.json(
          { error: "Cannot cancel pledge after project is funded" },
          { status: 400 }
        );
      }

      if (pledge.status !== "PENDING") {
        return NextResponse.json(
          { error: "Can only cancel pending pledges" },
          { status: 400 }
        );
      }

      // Cancel any Stripe intents (safely checks status first)
      const stripe = await getStripeInstance();
      if (pledge.stripeSetupIntentId) {
        await safeCancelSetupIntent(stripe, pledge.stripeSetupIntentId);
      }
      if (pledge.stripePaymentIntentId) {
        await safeCancelPaymentIntent(stripe, pledge.stripePaymentIntentId);
      }

      // Update pledge status
      await db.pledge.update({
        where: { id: pledgeId },
        data: { status: "CANCELLED" },
      });

      // Update project backer count and amount
      await db.project.update({
        where: { id: pledge.projectId },
        data: {
          backerCount: { decrement: 1 },
          currentAmount: { decrement: pledge.amount },
        },
      });

      return NextResponse.json({
        success: true,
        message: "Pledge cancelled successfully",
      });
    }

    if (action === "modify") {
      // Can only modify reward/addons for PENDING pledges when project is not funded
      if (isFunded) {
        return NextResponse.json(
          { error: "Cannot modify pledge after project is funded" },
          { status: 400 }
        );
      }

      if (pledge.status !== "PENDING") {
        return NextResponse.json(
          { error: "Can only modify pending pledges" },
          { status: 400 }
        );
      }

      if (pledge.project.status !== "LIVE") {
        return NextResponse.json(
          { error: "Can only modify pledge while project is live" },
          { status: 400 }
        );
      }

      const { rewardId, addonIds, addons, newAmount } = body;

      // Support both new format (addons with quantities) and legacy format (addonIds)
      const addonsWithQuantity: { id: string; quantity: number }[] = addons ||
        (addonIds ? addonIds.map((id: string) => ({ id, quantity: 1 })) : []);
      const addonIdList = addonsWithQuantity.map(a => a.id);

      // Validate new reward if provided
      let newReward = null;
      if (rewardId && rewardId !== "no-reward") {
        newReward = await db.reward.findUnique({
          where: { id: rewardId },
        });

        if (!newReward || newReward.projectId !== pledge.projectId) {
          return NextResponse.json({ error: "Invalid reward" }, { status: 400 });
        }

        // Check availability (but allow if it's the same reward)
        if (newReward.quantityAvailable !== null &&
            newReward.quantityClaimed >= newReward.quantityAvailable &&
            pledge.rewardId !== rewardId) {
          return NextResponse.json({ error: "Reward sold out" }, { status: 400 });
        }
      }

      // Validate addons if provided
      if (addonIdList.length > 0) {
        const validAddons = await db.addon.findMany({
          where: {
            id: { in: addonIdList },
            projectId: pledge.projectId,
          },
        });

        if (validAddons.length !== addonIdList.length) {
          return NextResponse.json({ error: "Invalid addons" }, { status: 400 });
        }
      }

      // Calculate old contribution for project update
      const oldAmount = pledge.amount;
      const amountDiff = newAmount - oldAmount;

      // If changing reward, update claimed counts
      if (pledge.rewardId && pledge.rewardId !== rewardId) {
        // Decrement old reward's claimed count
        await db.reward.update({
          where: { id: pledge.rewardId },
          data: { quantityClaimed: { decrement: 1 } },
        });
      }

      if (rewardId && rewardId !== "no-reward" && pledge.rewardId !== rewardId) {
        // Increment new reward's claimed count
        await db.reward.update({
          where: { id: rewardId },
          data: { quantityClaimed: { increment: 1 } },
        });
      }

      // Delete old addon associations
      await db.pledgeAddon.deleteMany({
        where: { pledgeId },
      });

      // Create new addon associations with quantities
      if (addonsWithQuantity.length > 0) {
        // Get addon prices
        const addonRecords = await db.addon.findMany({
          where: { id: { in: addonIdList } },
          select: { id: true, amount: true },
        });
        const addonPriceMap = new Map<string, number>(
          addonRecords.map((a: { id: string; amount: number }) => [a.id, Number(a.amount)])
        );

        await db.pledgeAddon.createMany({
          data: addonsWithQuantity.map((addon) => ({
            pledgeId,
            addonId: addon.id,
            quantity: addon.quantity,
            amount: (addonPriceMap.get(addon.id) ?? 0) * addon.quantity,
          })),
        });
      }

      // Update the pledge
      await db.pledge.update({
        where: { id: pledgeId },
        data: {
          rewardId: rewardId === "no-reward" ? null : rewardId || null,
          amount: newAmount,
        },
      });

      // Update project current amount
      if (amountDiff !== 0) {
        await db.project.update({
          where: { id: pledge.projectId },
          data: {
            currentAmount: { increment: amountDiff },
          },
        });
      }

      return NextResponse.json({
        success: true,
        message: "Pledge modified successfully",
        newAmount,
      });
    }

    if (action === "increase") {
      // Can always increase pledge amount while project is live
      if (pledge.project.status !== "LIVE") {
        return NextResponse.json(
          { error: "Can only increase pledge while project is live" },
          { status: 400 }
        );
      }

      if (!amount || amount <= 0) {
        return NextResponse.json(
          { error: "Additional amount must be positive" },
          { status: 400 }
        );
      }

      const additionalAmount = parseFloat(amount);
      const newTotal = Number(pledge.amount) + additionalAmount;

      // If project is funded, charge immediately
      if (isFunded && pledge.project.creator.stripeConfig?.stripeAccountId) {
        // Create a payment intent for the additional amount
        const amountInCents = Math.round(additionalAmount * 100);
        const platformFee = Math.round(additionalAmount * 0.03 * 100);

        try {
          const stripeClient = await getStripeInstance();
          const paymentIntent = await stripeClient.paymentIntents.create({
            amount: amountInCents,
            currency: "usd",
            customer: pledge.stripeCustomerId || undefined,
            payment_method: pledge.stripePaymentMethodId || undefined,
            confirm: !!pledge.stripePaymentMethodId,
            application_fee_amount: platformFee,
            transfer_data: {
              destination: pledge.project.creator.stripeConfig.stripeAccountId,
            },
            metadata: {
              pledgeId: pledge.id,
              projectId: pledge.projectId,
              userId: session.user.id,
              type: "pledge_increase",
            },
          });

          if (paymentIntent.status === "succeeded") {
            // Update pledge amount
            await db.pledge.update({
              where: { id: pledgeId },
              data: { amount: newTotal },
            });

            // Update project current amount
            await db.project.update({
              where: { id: pledge.projectId },
              data: {
                currentAmount: { increment: additionalAmount },
              },
            });

            return NextResponse.json({
              success: true,
              message: `Pledge increased by $${additionalAmount.toFixed(2)}`,
              newTotal,
              charged: true,
            });
          } else {
            return NextResponse.json({
              success: false,
              requiresAction: true,
              clientSecret: paymentIntent.client_secret,
              message: "Payment requires additional action",
            });
          }
        } catch (stripeError) {
          console.error("Stripe error:", stripeError);
          return NextResponse.json(
            { error: "Payment failed" },
            { status: 400 }
          );
        }
      } else {
        // Project not funded yet, just update the pledge amount
        await db.pledge.update({
          where: { id: pledgeId },
          data: { amount: newTotal },
        });

        return NextResponse.json({
          success: true,
          message: `Pledge increased to $${newTotal.toFixed(2)}`,
          newTotal,
          charged: false,
        });
      }
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Update pledge error:", error);
    return NextResponse.json(
      { error: "Failed to update pledge" },
      { status: 500 }
    );
  }
}

// DELETE - Cancel pledge (alias for PATCH cancel)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ pledgeId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { pledgeId } = await params;

    // Get pledge with project info
    const pledge = await db.pledge.findFirst({
      where: {
        id: pledgeId,
        userId: session.user.id,
      },
      include: {
        project: {
          select: {
            currentAmount: true,
            goalAmount: true,
            status: true,
          },
        },
      },
    });

    if (!pledge) {
      return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
    }

    const isFunded = Number(pledge.project.currentAmount) >= Number(pledge.project.goalAmount) || pledge.project.status === "FUNDED";

    if (isFunded) {
      return NextResponse.json(
        { error: "Cannot cancel pledge after project is funded" },
        { status: 400 }
      );
    }

    if (pledge.status !== "PENDING") {
      return NextResponse.json(
        { error: "Can only cancel pending pledges" },
        { status: 400 }
      );
    }

    // Cancel any Stripe intents (safely checks status first)
    const stripe = await getStripeInstance();
    if (pledge.stripeSetupIntentId) {
      await safeCancelSetupIntent(stripe, pledge.stripeSetupIntentId);
    }
    if (pledge.stripePaymentIntentId) {
      await safeCancelPaymentIntent(stripe, pledge.stripePaymentIntentId);
    }

    // Update pledge status
    await db.pledge.update({
      where: { id: pledgeId },
      data: { status: "CANCELLED" },
    });

    // Update project backer count and amount
    await db.project.update({
      where: { id: pledge.projectId },
      data: {
        backerCount: { decrement: 1 },
        currentAmount: { decrement: pledge.amount },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Pledge cancelled successfully",
    });
  } catch (error) {
    console.error("Cancel pledge error:", error);
    return NextResponse.json(
      { error: "Failed to cancel pledge" },
      { status: 500 }
    );
  }
}
