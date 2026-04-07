import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const retailersResetPasswordLogger = logger.child({ module: "retailers-reset-password" });
import { db } from "@/lib/db";
import { hash } from "bcryptjs";

// POST - Reset retailer password
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, password } = body;

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token and password are required" },
        { status: 400 }
      );
    }

    // Retailer tokens are prefixed with "rtl_" to prevent cross-system token
    // acceptance — a user-issued reset token must not be accepted here.
    if (!token.startsWith("rtl_")) {
      return NextResponse.json(
        { error: "Invalid or expired reset link" },
        { status: 400 }
      );
    }

    if (password.length < 8 || password.length > 1000) {
      return NextResponse.json(
        { error: "Password must be between 8 and 1000 characters" },
        { status: 400 }
      );
    }

    // Find the reset token
    const resetToken = await db.passwordResetToken.findUnique({
      where: { token },
    });

    if (!resetToken) {
      return NextResponse.json(
        { error: "Invalid or expired reset link" },
        { status: 400 }
      );
    }

    // Check if token has expired
    if (resetToken.expires < new Date()) {
      // Delete the expired token
      await db.passwordResetToken.delete({
        where: { token },
      });
      return NextResponse.json(
        { error: "Reset link has expired. Please request a new one." },
        { status: 400 }
      );
    }

    // Find the retailer by email
    const retailer = await db.retailer.findUnique({
      where: { email: resetToken.email },
    });

    if (!retailer) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    // Hash the new password
    const passwordHash = await hash(password, 12);

    // Update the retailer's password
    await db.retailer.update({
      where: { id: retailer.id },
      data: { passwordHash },
    });

    // Delete the used token
    await db.passwordResetToken.delete({
      where: { token },
    });

    return NextResponse.json({
      success: true,
      message: "Password has been reset successfully",
    });
  } catch (error) {
    retailersResetPasswordLogger.error({ err: String(error) }, "Error resetting retailer password:");
    return NextResponse.json(
      { error: "Failed to reset password" },
      { status: 500 }
    );
  }
}

// GET - Verify token is valid
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { valid: false, error: "Token is required" },
        { status: 400 }
      );
    }

    // Reject tokens that don't have the retailer prefix (cross-system guard)
    if (!token.startsWith("rtl_")) {
      return NextResponse.json({ valid: false, error: "Invalid token" });
    }

    const resetToken = await db.passwordResetToken.findUnique({
      where: { token },
    });

    if (!resetToken) {
      return NextResponse.json({ valid: false, error: "Invalid token" });
    }

    if (resetToken.expires < new Date()) {
      return NextResponse.json({ valid: false, error: "Token has expired" });
    }

    return NextResponse.json({ valid: true });
  } catch (error) {
    retailersResetPasswordLogger.error({ err: String(error) }, "Error verifying reset token:");
    return NextResponse.json(
      { valid: false, error: "Failed to verify token" },
      { status: 500 }
    );
  }
}
