import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const verifyIdLogger = logger.child({ module: "verify-id" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getShuftiService } from "@/lib/shufti";

/**
 * GET /api/verify-id - Get user's verification status
 */
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user verification status
    const user = await db.user.findFirst({
      where: { id: session.user.id, deletedAt: null },
      select: {
        idVerified: true,
        idVerifiedAt: true,
        idVerifications: {
          orderBy: { requestedAt: "desc" },
          take: 1,
          select: {
            id: true,
            status: true,
            verificationUrl: true,
            requestedAt: true,
            completedAt: true,
            declineReason: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const latestVerification = user.idVerifications[0] || null;

    return NextResponse.json({
      verified: user.idVerified,
      verifiedAt: user.idVerifiedAt,
      latestVerification,
    });
  } catch (error) {
    verifyIdLogger.error({ err: formatError(error) }, "Error getting verification status:");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Validates returnUrl to prevent open redirect attacks.
 * Only allows relative paths starting with /
 */
function validateReturnUrl(url: string | undefined): string | undefined {
  if (!url || typeof url !== "string") return undefined;

  // Only allow relative paths starting with /
  // Reject absolute URLs, protocol-relative URLs, and dangerous schemes
  if (
    url.startsWith("/") &&
    !url.startsWith("//") &&
    !url.toLowerCase().startsWith("/\\") &&
    !url.toLowerCase().includes("javascript:") &&
    !url.toLowerCase().includes("data:")
  ) {
    return url;
  }

  return undefined;
}

/**
 * POST /api/verify-id - Start new verification
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get optional returnUrl from request body and validate it
    let returnUrl: string | undefined;
    try {
      const body = await req.json();
      returnUrl = validateReturnUrl(body.returnUrl);
    } catch {
      // No body or invalid JSON, that's fine
    }

    // Check if user is already verified
    const user = await db.user.findFirst({
      where: { id: session.user.id, deletedAt: null },
      select: {
        idVerified: true,
        email: true,
        name: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.idVerified) {
      return NextResponse.json({ error: "Already verified" }, { status: 400 });
    }

    // Get Shufti service
    const shufti = await getShuftiService();

    if (!shufti) {
      return NextResponse.json(
        { error: "ID verification is not enabled or configured" },
        { status: 503 }
      );
    }

    // Create verification request with optional returnUrl
    const result = await shufti.createVerification(
      session.user.id,
      user.email,
      user.name || undefined,
      returnUrl
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      verificationUrl: result.verificationUrl,
      reference: result.reference,
    });
  } catch (error) {
    verifyIdLogger.error({ err: formatError(error) }, "Error starting verification:");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
