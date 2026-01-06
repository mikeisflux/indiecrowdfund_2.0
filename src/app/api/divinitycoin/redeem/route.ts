import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import crypto from "crypto";
import { Decimal } from "@prisma/client/runtime/library";
import { validateCSRFToken } from "@/lib/csrf";
import { applyRedemptionBonus, checkAndAwardBadges, getAvailableBonusPercent } from "@/lib/redemption-bonus";

interface RedemptionResult {
  newBalance: number;
  redemptionId: string;
}

// Rate limiting for redemption attempts (stricter than payments)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 5; // Max 5 redemption attempts per minute

// Failed attempt tracking to detect brute force
const failedAttempts = new Map<string, { count: number; lockoutUntil: number }>();
const MAX_FAILED_ATTEMPTS = 10; // Lock out after 10 failed attempts
const LOCKOUT_DURATION_MS = 900000; // 15 minute lockout

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

function checkLockout(userId: string): { locked: boolean; remainingMs: number } {
  const now = Date.now();
  const attempts = failedAttempts.get(userId);

  if (!attempts) return { locked: false, remainingMs: 0 };

  if (now < attempts.lockoutUntil) {
    return { locked: true, remainingMs: attempts.lockoutUntil - now };
  }

  // Lockout expired, clear the record
  failedAttempts.delete(userId);
  return { locked: false, remainingMs: 0 };
}

function recordFailedAttempt(userId: string): void {
  const now = Date.now();
  const attempts = failedAttempts.get(userId) || { count: 0, lockoutUntil: 0 };

  attempts.count++;

  if (attempts.count >= MAX_FAILED_ATTEMPTS) {
    attempts.lockoutUntil = now + LOCKOUT_DURATION_MS;
    console.warn(`[DivinityCoin Redeem] User ${userId} locked out due to ${attempts.count} failed attempts`);
  }

  failedAttempts.set(userId, attempts);
}

function clearFailedAttempts(userId: string): void {
  failedAttempts.delete(userId);
}

/**
 * POST /api/divinitycoin/redeem
 *
 * Redeem a DivinityCoin code and add credits to the user's account
 *
 * SECURITY MEASURES:
 * - Rate limiting to prevent brute force code guessing
 * - Lockout after repeated failed attempts
 * - CSRF token validation
 * - Atomic transaction for redemption + balance update
 * - Local duplicate check before external API call
 * - Comprehensive audit logging
 */
export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "You must be logged in to redeem codes" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Check for lockout first
    const lockoutStatus = checkLockout(userId);
    if (lockoutStatus.locked) {
      const minutesRemaining = Math.ceil(lockoutStatus.remainingMs / 60000);
      console.warn(`[DivinityCoin Redeem] [${requestId}] User ${userId} is locked out`);
      return NextResponse.json(
        { error: `Too many failed attempts. Please try again in ${minutesRemaining} minutes.` },
        { status: 429 }
      );
    }

    // Rate limiting check
    if (!checkRateLimit(userId)) {
      console.warn(`[DivinityCoin Redeem] [${requestId}] Rate limit exceeded for user ${userId}`);
      return NextResponse.json(
        { error: "Too many redemption attempts. Please wait before trying again." },
        { status: 429 }
      );
    }

    // CSRF validation
    const csrfToken = req.headers.get("x-csrf-token");
    if (!csrfToken || !validateCSRFToken(csrfToken)) {
      console.warn(`[DivinityCoin Redeem] [${requestId}] Invalid CSRF token for user ${userId}`);
      return NextResponse.json(
        { error: "Invalid request. Please refresh and try again." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { code } = body;

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { error: "Redemption code is required" },
        { status: 400 }
      );
    }

    // Clean up the code (remove dashes, spaces, etc.)
    const cleanCode = code.replace(/[-\s]/g, "").toUpperCase();

    if (cleanCode.length < 8 || cleanCode.length > 32) {
      recordFailedAttempt(userId);
      return NextResponse.json(
        { error: "Invalid redemption code format" },
        { status: 400 }
      );
    }

    // Validate code contains only alphanumeric characters
    if (!/^[A-Z0-9]+$/.test(cleanCode)) {
      recordFailedAttempt(userId);
      return NextResponse.json(
        { error: "Invalid redemption code format" },
        { status: 400 }
      );
    }

    console.log(`[DivinityCoin Redeem] [${requestId}] Redemption attempt: user=${userId}, code=${cleanCode.substring(0, 4)}****`);

    // Check if code was already redeemed locally FIRST (before external API)
    const existingRedemption = await db.divinityCoinRedemption.findUnique({
      where: { code: cleanCode },
      select: { id: true, userId: true, redeemedAt: true },
    });

    if (existingRedemption) {
      recordFailedAttempt(userId);
      console.log(`[DivinityCoin Redeem] [${requestId}] Code already redeemed locally`);
      return NextResponse.json(
        { error: "This code has already been redeemed" },
        { status: 400 }
      );
    }

    // Check if DivinityCoin is enabled
    const settings = await db.platformSettings.findUnique({
      where: { id: "default" },
      select: {
        divinityCoinEnabled: true,
        divinityCoinApiKey: true,
        divinityCoinPartnerId: true,
      },
    });

    if (!settings?.divinityCoinEnabled) {
      return NextResponse.json(
        { error: "DivinityCoin is not enabled on this platform" },
        { status: 400 }
      );
    }

    if (!settings.divinityCoinApiKey) {
      return NextResponse.json(
        { error: "DivinityCoin API key not configured" },
        { status: 500 }
      );
    }

    if (!settings.divinityCoinPartnerId) {
      console.error("[DivinityCoin Redeem] Partner ID not configured in platform settings");
      return NextResponse.json(
        { error: "DivinityCoin is not properly configured" },
        { status: 500 }
      );
    }

    // Call DivinityCoin API to validate and redeem the code
    let divinityResult;
    try {
      const divinityResponse = await fetch("https://divinitycoin.com/internal?action=validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${settings.divinityCoinApiKey}`,
          "X-Partner-ID": settings.divinityCoinPartnerId || "",
        },
        body: JSON.stringify({
          code: cleanCode,
          platformUserId: userId,
          partnerId: settings.divinityCoinPartnerId || "", // Always use site's partner ID
          requestId, // Include for cross-system audit trail
        }),
      });

      const responseText = await divinityResponse.text();

      try {
        divinityResult = JSON.parse(responseText);
      } catch {
        console.error(`[DivinityCoin Redeem] [${requestId}] Non-JSON response:`, responseText);
        return NextResponse.json(
          { error: "Invalid response from DivinityCoin" },
          { status: 502 }
        );
      }

      if (!divinityResponse.ok) {
        recordFailedAttempt(userId);

        // Map DivinityCoin error codes to user-friendly messages
        const errorMessages: Record<string, string> = {
          INVALID_CODE_FORMAT: "Invalid code format",
          CODE_NOT_FOUND: "This code does not exist",
          ALREADY_REDEEMED: "This code has already been redeemed",
          CODE_EXPIRED: "This code has expired",
          CODE_REVOKED: "This code has been revoked",
          RATE_LIMITED: "Too many attempts. Please try again later.",
        };
        const errorMessage = errorMessages[divinityResult?.code] || divinityResult?.error || "Failed to validate code";

        console.log(`[DivinityCoin Redeem] [${requestId}] API error: ${divinityResult?.code || "unknown"}`);

        return NextResponse.json(
          { error: errorMessage },
          { status: divinityResponse.status }
        );
      }
    } catch (fetchError) {
      console.error(`[DivinityCoin Redeem] [${requestId}] Fetch error:`, fetchError);
      return NextResponse.json(
        { error: "Unable to connect to DivinityCoin" },
        { status: 503 }
      );
    }

    const amount = divinityResult.amount;

    if (typeof amount !== "number" || amount <= 0 || amount > 100000) {
      console.error(`[DivinityCoin Redeem] [${requestId}] Invalid amount from API: ${amount}`);
      return NextResponse.json(
        { error: "Invalid amount from DivinityCoin" },
        { status: 400 }
      );
    }

    // Get available bonus percent before redemption
    const bonusInfo = await getAvailableBonusPercent(userId);

    // Process redemption in atomic transaction
    const result = await db.$transaction(async (tx) => {
      // Double-check the code hasn't been redeemed (race condition protection)
      const doubleCheck = await tx.divinityCoinRedemption.findUnique({
        where: { code: cleanCode },
      });

      if (doubleCheck) {
        throw new Error("CODE_ALREADY_REDEEMED");
      }

      // Get current balance for audit
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { divinityCoinBalance: true },
      });

      const previousBalance = user ? Number(user.divinityCoinBalance) : 0;

      // Create redemption record
      const redemption = await tx.divinityCoinRedemption.create({
        data: {
          code: cleanCode,
          userId: userId,
          amount,
          redeemedAt: new Date(),
        },
      });

      // Update user's DivinityCoin balance
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          divinityCoinBalance: {
            increment: amount,
          },
        },
        select: { divinityCoinBalance: true },
      });

      // Create audit transaction record
      const codeSuffix = cleanCode.slice(-4);
      await tx.divinityCoinTransaction.create({
        data: {
          userId: userId,
          amount: amount, // Positive for credit
          type: "REDEMPTION",
          description: `Gift card redeemed ****${codeSuffix}`,
          metadata: JSON.stringify({
            requestId,
            codePrefix: cleanCode.substring(0, 4),
            codeSuffix: codeSuffix,
            previousBalance,
            newBalance: Number(updatedUser.divinityCoinBalance),
            timestamp: new Date().toISOString(),
            ip: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown",
            externalTransactionId: divinityResult.transactionId || null,
          }),
        },
      });

      return {
        newBalance: Number(updatedUser.divinityCoinBalance),
        redemptionId: redemption.id,
      };
    }) as RedemptionResult;

    // Apply achievement badge bonus (outside transaction for non-critical operation)
    let bonusApplied = {
      bonusPercentApplied: new Decimal(0),
      bonusAmountSaved: new Decimal(0),
    };

    if (bonusInfo.availablePercent.gt(0)) {
      try {
        bonusApplied = await applyRedemptionBonus(
          userId,
          result.redemptionId,
          new Decimal(amount)
        );

        // If bonus was applied, add it to the balance
        if (Number(bonusApplied.bonusAmountSaved) > 0) {
          await db.user.update({
            where: { id: userId },
            data: {
              divinityCoinBalance: {
                increment: bonusApplied.bonusAmountSaved,
              },
            },
          });

          // Create bonus transaction record
          await db.divinityCoinTransaction.create({
            data: {
              userId,
              amount: Number(bonusApplied.bonusAmountSaved),
              type: "BONUS",
              description: `Achievement badge bonus (${(Number(bonusApplied.bonusPercentApplied) * 100).toFixed(2)}%)`,
              metadata: JSON.stringify({
                redemptionId: result.redemptionId,
                bonusPercent: Number(bonusApplied.bonusPercentApplied),
                originalAmount: amount,
              }),
            },
          });

          result.newBalance += Number(bonusApplied.bonusAmountSaved);
        }
      } catch (bonusError) {
        console.error(`[DivinityCoin Redeem] [${requestId}] Bonus application error:`, bonusError);
        // Don't fail the redemption if bonus fails
      }
    }

    // Check and award any new badges after redemption
    try {
      await checkAndAwardBadges(userId);
    } catch (badgeError) {
      console.error(`[DivinityCoin Redeem] [${requestId}] Badge check error:`, badgeError);
    }

    // Clear failed attempts on successful redemption
    clearFailedAttempts(userId);

    const duration = Date.now() - startTime;
    const bonusAmount = Number(bonusApplied.bonusAmountSaved);
    console.log(`[DivinityCoin Redeem] [${requestId}] Redemption successful: amount=${amount}, bonus=${bonusAmount.toFixed(2)} in ${duration}ms`);

    // Build response message
    let message = `Successfully redeemed $${amount.toFixed(2)} in DivinityCoin credits`;
    if (bonusAmount > 0) {
      message += ` (+$${bonusAmount.toFixed(2)} badge bonus!)`;
    }

    return NextResponse.json({
      success: true,
      amount,
      newBalance: result.newBalance,
      message,
      bonus: bonusAmount > 0 ? {
        amount: bonusAmount,
        percent: `${(Number(bonusApplied.bonusPercentApplied) * 100).toFixed(2)}%`,
      } : null,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    if (errorMessage === "CODE_ALREADY_REDEEMED") {
      console.log(`[DivinityCoin Redeem] [${requestId}] Code already redeemed (race condition caught) in ${duration}ms`);
      return NextResponse.json(
        { error: "This code has already been redeemed" },
        { status: 400 }
      );
    }

    console.error(`[DivinityCoin Redeem] [${requestId}] Error after ${duration}ms:`, error);
    return NextResponse.json(
      { error: "Failed to redeem code. Please try again." },
      { status: 500 }
    );
  }
}

/**
 * GET /api/divinitycoin/redeem
 *
 * Get user's DivinityCoin balance and redemption history
 */
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "You must be logged in" },
        { status: 401 }
      );
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        divinityCoinBalance: true,
        divinityCoinRedemptions: {
          orderBy: { redeemedAt: "desc" },
          take: 10,
          select: {
            id: true,
            amount: true,
            redeemedAt: true,
          },
        },
      },
    });

    return NextResponse.json({
      balance: Number(user?.divinityCoinBalance) || 0,
      redemptions: user?.divinityCoinRedemptions || [],
    });
  } catch (error) {
    console.error("[DivinityCoin Balance] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch balance" },
      { status: 500 }
    );
  }
}
