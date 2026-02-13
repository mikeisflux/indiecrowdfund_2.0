import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import crypto from "crypto";
import { validateCSRFToken } from "@/lib/csrf";
import {
  notifyPledgeReceived,
  notifyBackerPledgeConfirmed,
  notifyProjectFunded,
} from "@/lib/notifications";
import { processPendingPledgesForProject } from "@/lib/payments/stripe";
import { addToCreatorEmailList } from "@/lib/email";

// In-memory rate limiting (consider Redis for production clusters)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // Max 10 payment attempts per minute

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);

  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (userLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  userLimit.count++;
  return true;
}

interface TransactionResult {
  alreadyPaid: boolean;
  balance: number;
  paymentId?: string;
  projectId?: string;
  creatorId?: string;
  isCampaignFunded?: boolean;
  justReachedGoal?: boolean;
  isNowFunded?: boolean;
}

/**
 * POST /api/divinitycoin/pay
 *
 * Process a payment using DivinityCoin balance
 *
 * SECURITY MEASURES:
 * - Rate limiting to prevent brute force/flooding
 * - CSRF token validation
 * - All balance checks and modifications inside atomic transaction
 * - Pessimistic locking via row-level lock (SELECT FOR UPDATE)
 * - Idempotency check to prevent duplicate payments
 * - Comprehensive audit logging
 */
export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const session = await auth();

    if (!session?.user?.id) {
      console.warn(`[DivinityCoin Pay] [${requestId}] Unauthorized attempt`);
      return NextResponse.json(
        { error: "You must be logged in" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Rate limiting check
    if (!checkRateLimit(userId)) {
      console.warn(`[DivinityCoin Pay] [${requestId}] Rate limit exceeded for user ${userId}`);
      return NextResponse.json(
        { error: "Too many payment attempts. Please wait before trying again." },
        { status: 429 }
      );
    }

    // CSRF validation
    const csrfToken = req.headers.get("x-csrf-token");
    if (!csrfToken || !validateCSRFToken(csrfToken)) {
      console.warn(`[DivinityCoin Pay] [${requestId}] Invalid CSRF token for user ${userId}`);
      return NextResponse.json(
        { error: "Invalid request. Please refresh and try again." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { pledgeId, amount, idempotencyKey } = body;

    if (!pledgeId || typeof amount !== "number" || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid payment request" },
        { status: 400 }
      );
    }

    // Validate amount is reasonable (prevent integer overflow attacks)
    if (amount > 1000000 || !Number.isFinite(amount)) {
      console.warn(`[DivinityCoin Pay] [${requestId}] Invalid amount: ${amount} for user ${userId}`);
      return NextResponse.json(
        { error: "Invalid payment amount" },
        { status: 400 }
      );
    }

    console.log(`[DivinityCoin Pay] [${requestId}] Payment request: user=${userId}, pledge=${pledgeId}, amount=${amount}`);

    // Check if this is an add-items payment (pledge already completed with pending items)
    const existingPledge = await db.pledge.findUnique({
      where: { id: pledgeId },
      select: { status: true, userId: true, metadata: true, projectId: true },
    });

    if (existingPledge?.status === "COMPLETED") {
      // Check for pending additional items
      const pledgeMetadata = (typeof existingPledge.metadata === "object" && existingPledge.metadata !== null)
        ? existingPledge.metadata as Record<string, unknown>
        : {};
      const pendingItems = pledgeMetadata.pendingAdditionalItems as {
        paymentMethod: string;
        addons: { id: string; quantity: number }[];
        amount: number;
      } | undefined;

      if (pendingItems?.paymentMethod === "DIVINITYCOIN" && pendingItems.addons.length > 0) {
        // === ADD-ITEMS FLOW ===
        if (existingPledge.userId !== userId) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const addItemsAmount = pendingItems.amount;
        const addonsWithQuantity = pendingItems.addons;
        const addonIds = addonsWithQuantity.map(a => a.id);
        const quantityMap = new Map(addonsWithQuantity.map(a => [a.id, a.quantity]));

        const addItemsResult = await db.$transaction(async (tx) => {
          // Lock user row and check balance
          const userRows = await tx.$queryRaw<Array<{ id: string; divinityCoinBalance: string }>>`
            SELECT id, "divinityCoinBalance" FROM "User" WHERE id = ${userId} FOR UPDATE
          `;
          const userRow = userRows[0];
          if (!userRow) throw new Error("USER_NOT_FOUND");

          const currentBalance = Number(userRow.divinityCoinBalance);
          if (currentBalance < addItemsAmount) throw new Error("INSUFFICIENT_BALANCE");

          // Deduct balance
          await tx.user.update({
            where: { id: userId },
            data: { divinityCoinBalance: { decrement: addItemsAmount } },
          });

          // Get addon details
          const addons = await tx.reward.findMany({
            where: { id: { in: addonIds } },
          });

          // Create PledgeAddon records
          for (const addon of addons) {
            const quantity = quantityMap.get(addon.id) || 1;

            const existingAddon = await tx.pledgeAddon.findFirst({
              where: { pledgeId, addonId: addon.id },
            });

            if (existingAddon) {
              await tx.pledgeAddon.update({
                where: { id: existingAddon.id },
                data: {
                  quantity: existingAddon.quantity + quantity,
                  amount: (existingAddon.quantity + quantity) * Number(addon.amount),
                },
              });
            } else {
              await tx.pledgeAddon.create({
                data: {
                  pledgeId,
                  addonId: addon.id,
                  quantity,
                  amount: Number(addon.amount) * quantity,
                },
              });
            }

            // Claim addon slots
            await tx.reward.update({
              where: { id: addon.id },
              data: { quantityClaimed: { increment: quantity } },
            });
          }

          // Update pledge amount and clear pending items
          const currentPledge = await tx.pledge.findUnique({
            where: { id: pledgeId },
            select: { amount: true },
          });

          await tx.pledge.update({
            where: { id: pledgeId },
            data: {
              amount: Number(currentPledge!.amount) + addItemsAmount,
              metadata: {
                ...pledgeMetadata,
                pendingAdditionalItems: undefined,
                completedAdditionalItems: [
                  ...((pledgeMetadata.completedAdditionalItems as unknown[]) || []),
                  {
                    paymentMethod: "DIVINITYCOIN",
                    addons: addonsWithQuantity,
                    amount: addItemsAmount,
                    completedAt: new Date().toISOString(),
                  },
                ],
              },
            },
          });

          // Update project currentAmount (NOT backerCount)
          await tx.project.update({
            where: { id: existingPledge.projectId },
            data: { currentAmount: { increment: addItemsAmount } },
          });

          // Audit record
          const paymentId = `dc_additem_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
          await tx.divinityCoinTransaction.create({
            data: {
              userId,
              pledgeId,
              amount: -addItemsAmount,
              type: "PAYMENT",
              description: `Additional items payment for pledge ${pledgeId}`,
              metadata: JSON.stringify({
                requestId,
                paymentId,
                addItems: true,
                addons: addonsWithQuantity,
                previousBalance: currentBalance,
                newBalance: currentBalance - addItemsAmount,
              }),
            },
          });

          return { balance: currentBalance - addItemsAmount };
        });

        console.log(`[DivinityCoin Pay] [${requestId}] Add-items payment successful for pledge ${pledgeId}`);

        return NextResponse.json({
          success: true,
          newBalance: addItemsResult.balance,
          message: `Successfully paid $${addItemsAmount.toFixed(2)} for additional items`,
        });
      }

      // No pending items - normal idempotency
      return NextResponse.json({
        success: true,
        newBalance: 0,
        message: "Payment was already processed",
      });
    }

    // === NORMAL PLEDGE PAYMENT FLOW ===

    // Process the payment in a transaction to prevent race conditions
    const result: TransactionResult = await db.$transaction(async (tx) => {
      // First, lock the user row and get current balance (SELECT FOR UPDATE equivalent)
      // Using raw query for row-level locking
      const userRows = await tx.$queryRaw<Array<{ id: string; divinityCoinBalance: string }>>`
        SELECT id, "divinityCoinBalance"
        FROM "User"
        WHERE id = ${userId}
        FOR UPDATE
      `;

      const userRow = userRows[0];
      if (!userRow) {
        throw new Error("USER_NOT_FOUND");
      }

      const currentBalance = Number(userRow.divinityCoinBalance);

      // Check balance INSIDE the transaction with the locked row
      if (currentBalance < amount) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      // Get and lock the pledge
      const pledgeRows = await tx.$queryRaw<Array<{
        id: string;
        userId: string;
        projectId: string;
        status: string;
        amount: string;
      }>>`
        SELECT p.id, p."userId", p."projectId", p.status, p.amount
        FROM "Pledge" p
        WHERE p.id = ${pledgeId}
        FOR UPDATE
      `;

      const pledgeRow = pledgeRows[0];
      if (!pledgeRow) {
        throw new Error("PLEDGE_NOT_FOUND");
      }

      // Verify pledge belongs to this user
      if (pledgeRow.userId !== userId) {
        console.error(`[DivinityCoin Pay] [${requestId}] User ${userId} attempted to pay for pledge owned by ${pledgeRow.userId}`);
        throw new Error("UNAUTHORIZED");
      }

      // Check if pledge is already paid (idempotency)
      if (pledgeRow.status === "COMPLETED") {
        console.log(`[DivinityCoin Pay] [${requestId}] Pledge ${pledgeId} already completed - idempotent return`);
        return { alreadyPaid: true, balance: currentBalance };
      }

      // Get project info including goal for funded check
      const project = await tx.project.findUnique({
        where: { id: pledgeRow.projectId },
        select: {
          id: true,
          paymentProcessor: true,
          creatorId: true,
          title: true,
          goalAmount: true,
          currentAmount: true,
          fundedAt: true,
        },
      });

      if (!project) {
        throw new Error("PROJECT_NOT_FOUND");
      }

      // Verify project uses DivinityCoin
      if (project.paymentProcessor !== "DIVINITYCOIN") {
        throw new Error("INVALID_PAYMENT_PROCESSOR");
      }

      // Get the pledge details including rewardId
      const pledge = await tx.pledge.findUnique({
        where: { id: pledgeId },
        select: { rewardId: true },
      });

      // Check if campaign is already funded (determines if we charge immediately)
      const goalAmount = Number(project.goalAmount);
      const currentAmount = Number(project.currentAmount);
      const isCampaignFunded = currentAmount >= goalAmount;

      // Generate secure payment ID
      const paymentId = `dc_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;

      // Deduct from user's balance
      await tx.user.update({
        where: { id: userId },
        data: {
          divinityCoinBalance: {
            decrement: amount,
          },
        },
      });

      // Calculate backer number
      const existingBackerCount = await tx.pledge.count({
        where: {
          projectId: pledgeRow.projectId,
          backerNumber: { not: null },
        },
      });

      // Update pledge status
      // chargedImmediately = true if campaign was already funded, false otherwise
      // If false and campaign fails, user will be refunded
      await tx.pledge.update({
        where: { id: pledgeId },
        data: {
          status: "COMPLETED",
          backerNumber: existingBackerCount + 1,
          divinityCoinPaymentId: paymentId,
          chargedImmediately: isCampaignFunded,
        },
      });

      // Atomically claim reward slot if pledge has a reward (prevents overselling)
      if (pledge?.rewardId) {
        // Lock the reward row and check availability within this transaction
        const rewardRows = await tx.$queryRaw<Array<{
          id: string;
          quantityAvailable: number | null;
          quantityClaimed: number;
        }>>`
          SELECT id, "quantityAvailable", "quantityClaimed"
          FROM "Reward"
          WHERE id = ${pledge.rewardId}
          FOR UPDATE
        `;

        const reward = rewardRows[0];
        if (reward) {
          // Check if slot available (null means unlimited)
          const canClaim = reward.quantityAvailable === null ||
            reward.quantityClaimed < reward.quantityAvailable;

          if (canClaim) {
            await tx.reward.update({
              where: { id: pledge.rewardId },
              data: { quantityClaimed: { increment: 1 } },
            });
          } else {
            console.warn(`[DivinityCoin Pay] Reward ${pledge.rewardId} sold out - payment completed but reward unavailable`);
          }
        }
      }

      // Calculate new project total and check if just reached goal
      const newCurrentAmount = currentAmount + amount;
      const wasAlreadyFunded = isCampaignFunded;
      const isNowFunded = newCurrentAmount >= goalAmount;
      const justReachedGoal = isNowFunded && !wasAlreadyFunded && !project.fundedAt;

      // Update project funding
      await tx.project.update({
        where: { id: pledgeRow.projectId },
        data: {
          currentAmount: { increment: amount },
          backerCount: { increment: 1 },
          // Set fundedAt timestamp when project first reaches goal
          ...(justReachedGoal ? { fundedAt: new Date() } : {}),
        },
      });

      // Create detailed audit transaction record
      await tx.divinityCoinTransaction.create({
        data: {
          userId: userId,
          pledgeId: pledgeId,
          amount: -amount, // Negative for payment
          type: "PAYMENT",
          description: `Payment for pledge on "${project.title}"`,
          metadata: JSON.stringify({
            requestId,
            paymentId,
            projectId: project.id,
            previousBalance: currentBalance,
            newBalance: currentBalance - amount,
            idempotencyKey: idempotencyKey || null,
            timestamp: new Date().toISOString(),
            ip: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown",
          }),
        },
      });

      return {
        alreadyPaid: false,
        balance: currentBalance - amount,
        paymentId,
        projectId: project.id,
        creatorId: project.creatorId,
        isCampaignFunded,
        justReachedGoal,
        isNowFunded,
      };
    });

    const duration = Date.now() - startTime;
    console.log(`[DivinityCoin Pay] [${requestId}] Payment ${result.alreadyPaid ? "already completed" : "successful"} in ${duration}ms`);

    // === Post-transaction notifications (non-blocking - don't fail payment response) ===
    if (!result.alreadyPaid && result.projectId && result.creatorId) {
      // Send confirmation email to backer
      try {
        await notifyBackerPledgeConfirmed(pledgeId, result.isCampaignFunded || false);
      } catch (emailError) {
        console.error(`[DivinityCoin Pay] [${requestId}] Failed to send confirmation email:`, emailError);
      }

      // Notify creator of new pledge
      try {
        await notifyPledgeReceived(
          result.projectId,
          result.creatorId,
          session.user.name || "A backer",
          amount
        );
      } catch (notifyError) {
        console.error(`[DivinityCoin Pay] [${requestId}] Failed to notify creator:`, notifyError);
      }

      // Auto-add backer to creator's email list
      if (session.user.email) {
        try {
          await addToCreatorEmailList({
            creatorId: result.creatorId,
            email: session.user.email,
            name: session.user.name,
            source: "pledge",
            sourceProjectId: result.projectId,
          });
        } catch (emailListError) {
          console.error(`[DivinityCoin Pay] [${requestId}] Failed to add backer to email list:`, emailListError);
        }
      }

      // Handle project funding events
      if (result.justReachedGoal) {
        try {
          await notifyProjectFunded(result.projectId);
        } catch (fundedError) {
          console.error(`[DivinityCoin Pay] [${requestId}] Failed to notify project funded:`, fundedError);
        }
      }

      // Process pending Stripe pledges if project is now funded
      if (result.isNowFunded) {
        try {
          const pendingCount = await db.pledge.count({
            where: {
              projectId: result.projectId,
              status: "PENDING",
              chargedImmediately: false,
              stripePaymentMethodId: { not: null },
            },
          });
          if (pendingCount > 0) {
            console.log(`[DivinityCoin Pay] [${requestId}] Processing ${pendingCount} pending Stripe pledges`);
            await processPendingPledgesForProject(result.projectId);
          }
        } catch (processError) {
          console.error(`[DivinityCoin Pay] [${requestId}] Failed to process pending pledges:`, processError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      newBalance: result.balance,
      message: result.alreadyPaid
        ? "Payment was already processed"
        : `Successfully paid $${amount.toFixed(2)} with DivinityCoin`,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Map internal errors to user-friendly messages
    const errorResponses: Record<string, { message: string; status: number }> = {
      USER_NOT_FOUND: { message: "User not found", status: 404 },
      INSUFFICIENT_BALANCE: { message: "Insufficient DivinityCoin balance", status: 400 },
      PLEDGE_NOT_FOUND: { message: "Pledge not found", status: 404 },
      UNAUTHORIZED: { message: "Unauthorized", status: 403 },
      PROJECT_NOT_FOUND: { message: "Project not found", status: 404 },
      INVALID_PAYMENT_PROCESSOR: { message: "This project does not accept DivinityCoin payments", status: 400 },
    };

    const errorResponse = errorResponses[errorMessage];
    if (errorResponse) {
      console.log(`[DivinityCoin Pay] [${requestId}] ${errorMessage} in ${duration}ms`);
      return NextResponse.json(
        { error: errorResponse.message },
        { status: errorResponse.status }
      );
    }

    console.error(`[DivinityCoin Pay] [${requestId}] Error after ${duration}ms:`, error);
    return NextResponse.json(
      { error: "Failed to process payment. Please try again." },
      { status: 500 }
    );
  }
}
