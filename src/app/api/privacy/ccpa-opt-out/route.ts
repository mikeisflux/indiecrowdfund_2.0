import { NextResponse } from "next/server";
import { validateSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * POST /api/privacy/ccpa-opt-out
 * CCPA: "Do Not Sell or Share My Personal Information" opt-out.
 * Works for both authenticated and anonymous users.
 */
export async function POST(req: Request) {
  const session = await validateSession();
  const body = await req.json().catch(() => ({}));

  const optOutType = body.optOutType || "analytics"; // "analytics", "sale", "all"
  const email = body.email || null;

  // For authenticated users
  if (session?.user) {
    // Check for existing opt-out
    const existing = await db.ccpaOptOut.findFirst({
      where: { userId: session.user.id, reinstatedAt: null },
    });

    if (existing) {
      // Update the opt-out type if changed
      await db.ccpaOptOut.update({
        where: { id: existing.id },
        data: { optOutType },
      });

      return NextResponse.json({
        success: true,
        message: "Your CCPA opt-out preference has been updated",
      });
    }

    await db.ccpaOptOut.create({
      data: {
        userId: session.user.id,
        email: session.user.email,
        optOutType,
      },
    });

    logger.info({ userId: session.user.id, optOutType }, "CCPA opt-out recorded");

    return NextResponse.json({
      success: true,
      message: "You have been opted out. We will no longer sell or share your personal information for the selected categories.",
    });
  }

  // For anonymous users — use IP address
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") || "unknown";

  if (!email && ip === "unknown") {
    return NextResponse.json({
      error: "Please provide an email address for verification, or log in to your account",
    }, { status: 400 });
  }

  await db.ccpaOptOut.create({
    data: {
      email,
      ipAddress: ip,
      optOutType,
    },
  });

  logger.info({ email: email ? "[redacted]" : null, optOutType }, "Anonymous CCPA opt-out recorded");

  return NextResponse.json({
    success: true,
    message: "Your opt-out preference has been recorded. For verification, please check your email.",
  });
}

/**
 * GET /api/privacy/ccpa-opt-out
 * Check current CCPA opt-out status.
 */
export async function GET() {
  const session = await validateSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Please log in to check your opt-out status" }, { status: 401 });
  }

  const optOut = await db.ccpaOptOut.findFirst({
    where: { userId: session.user.id, reinstatedAt: null },
    select: {
      id: true,
      optOutType: true,
      optedOutAt: true,
    },
  });

  return NextResponse.json({
    optedOut: !!optOut,
    optOutType: optOut?.optOutType || null,
    optedOutAt: optOut?.optedOutAt || null,
  });
}

/**
 * DELETE /api/privacy/ccpa-opt-out
 * Reinstate data collection (opt back in).
 */
export async function DELETE() {
  const session = await validateSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const optOut = await db.ccpaOptOut.findFirst({
    where: { userId: session.user.id, reinstatedAt: null },
  });

  if (!optOut) {
    return NextResponse.json({ error: "No active opt-out found" }, { status: 404 });
  }

  await db.ccpaOptOut.update({
    where: { id: optOut.id },
    data: { reinstatedAt: new Date() },
  });

  logger.info({ userId: session.user.id }, "CCPA opt-out reinstated");

  return NextResponse.json({
    success: true,
    message: "Your data collection preferences have been reinstated",
  });
}
