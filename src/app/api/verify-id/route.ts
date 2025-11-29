import { NextRequest, NextResponse } from "next/server";
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
    const user = await db.user.findUnique({
      where: { id: session.user.id },
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
    console.error("Error getting verification status:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
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

    // Get optional returnUrl from request body
    let returnUrl: string | undefined;
    try {
      const body = await req.json();
      returnUrl = body.returnUrl;
    } catch {
      // No body or invalid JSON, that's fine
    }

    // Check if user is already verified
    const user = await db.user.findUnique({
      where: { id: session.user.id },
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
    console.error("Error starting verification:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
