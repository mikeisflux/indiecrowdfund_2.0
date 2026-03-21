import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const resendApprovalLogger = logger.child({ module: "admin-retailers-resend-approval" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendRetailerApprovalEmail } from "@/lib/email";
import crypto from "crypto";

export const dynamic = "force-dynamic";

// POST - Resend approval email with new password setup token
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({ where: { id: session.user.id } });
    if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { retailerId } = body;

    if (!retailerId) {
      return NextResponse.json({ error: "Retailer ID is required" }, { status: 400 });
    }

    const retailer = await db.retailer.findUnique({
      where: { id: retailerId },
    });

    if (!retailer) {
      return NextResponse.json({ error: "Retailer not found" }, { status: 404 });
    }

    if (retailer.status !== "APPROVED") {
      return NextResponse.json({ error: "Retailer must be approved first" }, { status: 400 });
    }

    // Ensure the retailer has a linked user account
    let linkedUserId = retailer.userId;
    if (!linkedUserId) {
      // Check if a User account exists with this email
      const existingUser = await db.user.findFirst({
        where: { email: retailer.email, deletedAt: null },
      });

      if (existingUser) {
        linkedUserId = existingUser.id;
      } else {
        // Create a new User account
        const newUser = await db.user.create({
          data: {
            email: retailer.email,
            name: retailer.contactName,
            emailVerified: new Date(),
            retailerAccess: true,
          },
        });
        linkedUserId = newUser.id;
        resendApprovalLogger.info(`[Admin] Created new user account ${newUser.id} for retailer ${retailerId} during resend`);
      }

      // Link the retailer to the user
      await db.retailer.update({
        where: { id: retailerId },
        data: { userId: linkedUserId },
      });

      // Ensure retailerAccess is enabled
      await db.user.update({
        where: { id: linkedUserId },
        data: { retailerAccess: true },
      });
    }

    // Generate a new password setup token
    await db.passwordResetToken.deleteMany({
      where: { email: retailer.email },
    });

    const passwordSetupToken = crypto.randomUUID();
    const expires = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours

    await db.passwordResetToken.create({
      data: {
        email: retailer.email,
        token: passwordSetupToken,
        expires,
      },
    });

    // Send the approval email with password setup link
    if (!retailer.accessCode) {
      return NextResponse.json({ error: "Retailer has no access code" }, { status: 400 });
    }

    await sendRetailerApprovalEmail(
      retailer.email,
      retailer.businessName,
      retailer.contactName,
      retailer.accessCode,
      passwordSetupToken
    );

    resendApprovalLogger.info(`[Admin] Resent approval email to retailer ${retailerId} (${retailer.email})`);

    return NextResponse.json({
      success: true,
      message: `Approval email sent to ${retailer.email}`,
    });
  } catch (error) {
    resendApprovalLogger.error({ err: String(error) }, "Error resending retailer approval email:");
    return NextResponse.json(
      { error: "Failed to resend approval email" },
      { status: 500 }
    );
  }
}
