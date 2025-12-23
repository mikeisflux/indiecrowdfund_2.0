import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import crypto from "crypto";
import { validateCSRFToken } from "@/lib/csrf";

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

      // Get project info
      const project = await tx.project.findUnique({
        where: { id: pledgeRow.projectId },
        select: { id: true, paymentProcessor: true, creatorId: true, title: true },
      });

      if (!project) {
        throw new Error("PROJECT_NOT_FOUND");
      }

      // Verify project uses DivinityCoin
      if (project.paymentProcessor !== "DIVINITYCOIN") {
        throw new Error("INVALID_PAYMENT_PROCESSOR");
      }

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
      await tx.pledge.update({
        where: { id: pledgeId },
        data: {
          status: "COMPLETED",
          backerNumber: existingBackerCount + 1,
          divinityCoinPaymentId: paymentId,
        },
      });

      // Update project funding
      await tx.project.update({
        where: { id: pledgeRow.projectId },
        data: {
          currentAmount: { increment: amount },
          backerCount: { increment: 1 },
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
      };
    });

    const duration = Date.now() - startTime;
    console.log(`[DivinityCoin Pay] [${requestId}] Payment ${result.alreadyPaid ? "already completed" : "successful"} in ${duration}ms`);

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
