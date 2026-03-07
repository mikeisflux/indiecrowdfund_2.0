import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const pledgesLogger = logger.child({ module: "pledges" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Stripe from "stripe";
import { getStripeInstance, safeCancelSetupIntent, safeCancelPaymentIntent } from "@/lib/payments/stripe";
import { callDivinityCoinAPI, getDivinityCoinConfig } from "@/lib/payments/divinitycoin";
import { notifyPledgeModified, notifyPledgeCancelled } from "@/lib/notifications/pledge-notifications";

export const dynamic = "force-dynamic";

// Helper to apply modification changes (reward swap, addon swap, amount update)
async function applyModificationChanges(
  pledgeId: string,
  pledge: { rewardId: string | null; projectId: string; amount: number | { toNumber?: () => number } },
  rewardId: string | undefined,
  addonsWithQuantity: { id: string; quantity: number }[],
  addonIdList: string[],
  newAmount: number,
  amountDiff: number
) {
  // If changing reward, update claimed counts
  if (pledge.rewardId && pledge.rewardId !== rewardId) {
    await db.reward.update({
      where: { id: pledge.rewardId },
      data: { quantityClaimed: { decrement: 1 } },
    });
  }

  if (rewardId && rewardId !== "no-reward" && pledge.rewardId !== rewardId) {
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
    const addonRecords = await db.reward.findMany({
      where: { id: { in: addonIdList }, type: "ADDON" },
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
}

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
            endDate: true,
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
    const campaignActive = pledge.project.status === "LIVE" &&
      !(pledge.project.endDate && new Date(pledge.project.endDate) < new Date());

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
        canCancel: (!isFunded && pledge.status === "PENDING") || pledge.status === "COMPLETED",
        canRefund: pledge.status === "COMPLETED",
        canModify: campaignActive && (pledge.status === "PENDING" || pledge.status === "COMPLETED"),
        canIncrease: campaignActive,
        isFunded,
      },
    });
  } catch (error) {
    pledgesLogger.error({ err: String(error) }, "Get pledge error:");
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
            title: true,
            status: true,
            endDate: true,
            currentAmount: true,
            goalAmount: true,
            paymentProcessor: true,
            stripeAccountId: true,
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
    const campaignEnded = pledge.project.endDate && new Date(pledge.project.endDate) < new Date();

    if (action === "cancel") {
      const paymentProcessor = pledge.project.paymentProcessor || "STRIPE";

      // COMPLETED pledges: cancel with refund
      if (pledge.status === "COMPLETED") {
        if (paymentProcessor === "DIVINITYCOIN") {
          try {
            const dcResult = await callDivinityCoinAPI("refund", {
              pledgeId: pledge.id,
              paymentId: pledge.divinityCoinPaymentId,
              amount: Math.round(Number(pledge.amount) * 100),
              reason: body.reason || "Cancelled by backer",
              requestedBy: "user",
            });

            if (!dcResult.success) {
              return NextResponse.json(
                { error: dcResult.error || "Refund failed" },
                { status: 400 }
              );
            }
          } catch (dcError) {
            pledgesLogger.error({ err: String(dcError) }, "DivinityCoin refund error:");
            return NextResponse.json(
              { error: "Failed to process refund" },
              { status: 500 }
            );
          }
        } else {
          // Stripe refund
          if (!pledge.stripePaymentIntentId) {
            return NextResponse.json(
              { error: "No payment found to refund" },
              { status: 400 }
            );
          }

          try {
            const stripe = await getStripeInstance();
            await stripe.refunds.create({
              payment_intent: pledge.stripePaymentIntentId,
              reason: "requested_by_customer",
              metadata: {
                pledgeId: pledge.id,
                cancelledBy: session.user.id,
                reason: body.reason || "Cancelled by backer",
              },
            });
          } catch (stripeError) {
            pledgesLogger.error({ err: String(stripeError) }, "Stripe refund error:");
            return NextResponse.json(
              { error: "Failed to process refund" },
              { status: 400 }
            );
          }
        }

        // Update pledge status to REFUNDED
        await db.pledge.update({
          where: { id: pledgeId },
          data: {
            status: "REFUNDED",
            lastFailureReason: body.reason || "Cancelled by backer",
          },
        });

        // Decrement project stats
        await db.project.update({
          where: { id: pledge.projectId },
          data: {
            backerCount: { decrement: 1 },
            currentAmount: { decrement: pledge.amount },
          },
        });

        // Send cancellation + refund notification (async, don't block response)
        notifyPledgeCancelled(pledgeId, true).catch(err =>
          pledgesLogger.error({ err: String(err) }, "[Cancel] Failed to send refund notification:")
        );

        return NextResponse.json({
          success: true,
          refunded: true,
          message: "Pledge cancelled and refund processed",
        });
      }

      // PENDING pledges: cancel (no charge has been made)
      if (pledge.status !== "PENDING") {
        return NextResponse.json(
          { error: "Can only cancel pending or completed pledges" },
          { status: 400 }
        );
      }

      if (isFunded) {
        return NextResponse.json(
          { error: "Cannot cancel pending pledge after project is funded. Your payment is being processed." },
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

      // Only decrement project stats if pledge was actually confirmed
      if (pledge.confirmationEmailSent) {
        await db.project.update({
          where: { id: pledge.projectId },
          data: {
            backerCount: { decrement: 1 },
            currentAmount: { decrement: pledge.amount },
          },
        });
      }

      // Send cancellation notification (async, don't block response)
      notifyPledgeCancelled(pledgeId, false).catch(err =>
        pledgesLogger.error({ err: String(err) }, "[Cancel] Failed to send cancellation notification:")
      );

      return NextResponse.json({
        success: true,
        refunded: false,
        message: "Pledge cancelled successfully",
      });
    }

    if (action === "modify") {
      // Can only modify while project is live and campaign hasn't ended
      if (pledge.project.status !== "LIVE" || campaignEnded) {
        return NextResponse.json(
          { error: "This campaign has ended. Pledge modifications are no longer available." },
          { status: 400 }
        );
      }

      // Allow modify for PENDING (unfunded) and COMPLETED pledges
      if (pledge.status !== "PENDING" && pledge.status !== "COMPLETED") {
        return NextResponse.json(
          { error: "Can only modify pending or completed pledges" },
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
        const validAddons = await db.reward.findMany({
          where: {
            id: { in: addonIdList },
            projectId: pledge.projectId,
            type: "ADDON",
          },
        });

        if (validAddons.length !== addonIdList.length) {
          return NextResponse.json({ error: "Invalid addons" }, { status: 400 });
        }
      }

      // Calculate price difference
      const oldAmount = Number(pledge.amount);
      const amountDiff = newAmount - oldAmount;
      const paymentProcessor = pledge.project.paymentProcessor || "STRIPE";
      const isAlreadyCharged = pledge.status === "COMPLETED";

      // If pledge is already charged (COMPLETED) and price changed, handle payment diff
      if (isAlreadyCharged && amountDiff > 0) {
        // Price went UP - need to collect additional payment
        const stripeAccountId = pledge.project.creator?.stripeConfig?.stripeAccountId || pledge.project.stripeAccountId;

        if (paymentProcessor === "DIVINITYCOIN") {
          // Call DC's create-payment-intent for the upcharge amount
          try {
            const dcConfig = await getDivinityCoinConfig();
            const userRecord = await db.user.findUnique({
              where: { id: session.user.id },
              select: { email: true, name: true },
            });

            const dcResponse = await fetch(`${dcConfig.baseUrl}?action=create-payment-intent`, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${dcConfig.apiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                amount: Math.round(amountDiff * 100), // difference in cents
                currency: "usd",
                platformUserId: session.user.id,
                email: userRecord?.email || "",
                name: userRecord?.name || "",
                pledgeId: pledge.id,
                projectId: pledge.projectId,
                type: "upcharge",
                originalPaymentId: pledge.divinityCoinPaymentId,
              }),
            });

            const dcResult = await dcResponse.json();
            if (!dcResponse.ok || !dcResult.success) {
              pledgesLogger.error({ err: String(dcResult) }, "[DivinityCoin Modify] Failed to create upcharge payment intent:");
              return NextResponse.json(
                { error: dcResult.error || "Failed to initialize upcharge payment" },
                { status: 502 }
              );
            }

            // Store pending modification in metadata (DON'T apply changes yet - wait for payment)
            const currentMetadata = (typeof pledge.metadata === "object" && pledge.metadata !== null)
              ? pledge.metadata as Record<string, unknown>
              : {};

            await db.pledge.update({
              where: { id: pledgeId },
              data: {
                metadata: {
                  ...currentMetadata,
                  pendingModification: {
                    paymentMethod: "DIVINITYCOIN",
                    paymentIntentId: dcResult.paymentIntentId,
                    rewardId: rewardId || null,
                    addons: addonsWithQuantity,
                    newAmount,
                    oldAmount,
                    amountDiff,
                    createdAt: new Date().toISOString(),
                  },
                },
              },
            });

            return NextResponse.json({
              success: true,
              requiresPayment: true,
              clientSecret: dcResult.clientSecret,
              publishableKey: dcResult.publishableKey,
              message: `Additional $${amountDiff.toFixed(2)} payment required`,
              newAmount,
            });
          } catch (dcError) {
            pledgesLogger.error({ err: String(dcError) }, "[DivinityCoin Modify] API error:");
            return NextResponse.json(
              { error: "Failed to connect to payment processor" },
              { status: 500 }
            );
          }
        }

        // Stripe: Create PaymentIntent for the difference
        const stripe = await getStripeInstance();
        if (!stripe) {
          return NextResponse.json({ error: "Payment system unavailable" }, { status: 500 });
        }

        const amountInCents = Math.round(amountDiff * 100);
        const platformFee = Math.round(amountDiff * 0.03 * 100); // 3% platform fee (matches charges.ts)

        const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
          amount: amountInCents,
          currency: "usd",
          metadata: {
            pledgeId: pledge.id,
            projectId: pledge.projectId,
            userId: session.user.id,
            type: "pledge_modification_upcharge",
            rewardId: rewardId || "",
            addons: JSON.stringify(addonsWithQuantity),
            newAmount: String(newAmount),
          },
        };

        if (stripeAccountId) {
          paymentIntentParams.application_fee_amount = platformFee;
          paymentIntentParams.transfer_data = { destination: stripeAccountId };
        }

        const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);

        // Store pending modification in metadata
        const currentMetadata = (typeof pledge.metadata === "object" && pledge.metadata !== null)
          ? pledge.metadata as Record<string, unknown>
          : {};

        await db.pledge.update({
          where: { id: pledgeId },
          data: {
            metadata: {
              ...currentMetadata,
              pendingModification: {
                paymentMethod: "STRIPE",
                paymentIntentId: paymentIntent.id,
                rewardId: rewardId || null,
                addons: addonsWithQuantity,
                newAmount,
                oldAmount,
                amountDiff,
                createdAt: new Date().toISOString(),
              },
            },
          },
        });

        return NextResponse.json({
          success: true,
          requiresPayment: true,
          clientSecret: paymentIntent.client_secret,
          message: `Additional $${amountDiff.toFixed(2)} payment required`,
          newAmount,
        });
      }

      if (isAlreadyCharged && amountDiff < 0) {
        // Price went DOWN - issue a refund for the difference
        const refundAmount = Math.abs(amountDiff);
        const stripeAccountId = pledge.project.creator?.stripeConfig?.stripeAccountId || pledge.project.stripeAccountId;

        if (paymentProcessor === "DIVINITYCOIN") {
          try {
            const dcResult = await callDivinityCoinAPI("refund", {
              pledgeId: pledge.id,
              paymentId: pledge.divinityCoinPaymentId,
              amount: Math.round(refundAmount * 100),
              reason: "Pledge modification - price decreased",
              requestedBy: "user",
              partial: true,
            });

            if (!dcResult.success) {
              return NextResponse.json(
                { error: dcResult.error || "Refund failed" },
                { status: 400 }
              );
            }
          } catch (dcError) {
            pledgesLogger.error({ err: String(dcError) }, "DivinityCoin partial refund error:");
            return NextResponse.json(
              { error: "Failed to process refund" },
              { status: 500 }
            );
          }
        } else {
          // Stripe partial refund
          if (!pledge.stripePaymentIntentId) {
            return NextResponse.json(
              { error: "No payment found to refund" },
              { status: 400 }
            );
          }

          try {
            const stripe = await getStripeInstance();
            await stripe.refunds.create({
              payment_intent: pledge.stripePaymentIntentId,
              amount: Math.round(refundAmount * 100), // Partial refund in cents
              reason: "requested_by_customer",
              metadata: {
                pledgeId: pledge.id,
                type: "pledge_modification_refund",
                stripeAccountId: stripeAccountId || "",
              },
            });
          } catch (stripeError) {
            pledgesLogger.error({ err: String(stripeError) }, "Stripe partial refund error:");
            return NextResponse.json(
              { error: "Failed to process refund" },
              { status: 400 }
            );
          }
        }

        // Apply the modification changes (addons, rewards, amounts)
        await applyModificationChanges(pledgeId, pledge, rewardId, addonsWithQuantity, addonIdList, newAmount, amountDiff);

        // Send refund notification
        notifyPledgeModified(pledgeId, oldAmount, newAmount, "refund").catch(err =>
          pledgesLogger.error({ err: String(err) }, "[Modify] Failed to send refund notification:")
        );

        return NextResponse.json({
          success: true,
          requiresPayment: false,
          refundAmount,
          message: `Pledge updated. $${refundAmount.toFixed(2)} has been refunded.`,
          newAmount,
        });
      }

      // No price change, or PENDING pledge (not yet charged) - just update directly
      await applyModificationChanges(pledgeId, pledge, rewardId, addonsWithQuantity, addonIdList, newAmount, amountDiff);

      // Send modification notification
      notifyPledgeModified(pledgeId, oldAmount, newAmount, "no_change").catch(err =>
        pledgesLogger.error({ err: String(err) }, "[Modify] Failed to send modification notification:")
      );

      return NextResponse.json({
        success: true,
        requiresPayment: false,
        message: "Pledge modified successfully",
        newAmount,
      });
    }

    if (action === "increase") {
      // Can only increase pledge amount while project is live and campaign hasn't ended
      if (pledge.project.status !== "LIVE" || campaignEnded) {
        return NextResponse.json(
          { error: "This campaign has ended. Pledge increases are no longer available." },
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
      const paymentProcessor = pledge.project.paymentProcessor || "STRIPE";
      const isCharged = pledge.status === "COMPLETED";

      // If pledge is already charged, collect the additional amount
      if (isCharged) {
        if (paymentProcessor === "DIVINITYCOIN") {
          // DC pledges require a payment form for upcharges - the dashboard doesn't have one.
          // Direct users to "Change Reward or Add-ons" which has full payment support.
          return NextResponse.json(
            { error: "To increase your pledge amount, please use 'Change Reward or Add-ons' from your pledge dashboard." },
            { status: 400 }
          );
        }

        // Stripe: charge immediately if creator has Stripe Connect
        const stripeAccountId = pledge.project.creator?.stripeConfig?.stripeAccountId || pledge.project.stripeAccountId;
        if (stripeAccountId) {
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
                destination: stripeAccountId,
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
            pledgesLogger.error({ err: String(stripeError) }, "Stripe error:");
            return NextResponse.json(
              { error: "Payment failed" },
              { status: 400 }
            );
          }
        }
      }

      // Not yet charged (PENDING) - just update the pledge amount
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

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    pledgesLogger.error({ err: String(error) }, "Update pledge error:");
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

    // Only decrement project stats if pledge was actually confirmed
    // (stats are only incremented when confirmationEmailSent = true)
    // This prevents negative values from incomplete checkouts being cancelled
    if (pledge.confirmationEmailSent) {
      await db.project.update({
        where: { id: pledge.projectId },
        data: {
          backerCount: { decrement: 1 },
          currentAmount: { decrement: pledge.amount },
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Pledge cancelled successfully",
    });
  } catch (error) {
    pledgesLogger.error({ err: String(error) }, "Cancel pledge error:");
    return NextResponse.json(
      { error: "Failed to cancel pledge" },
      { status: 500 }
    );
  }
}
