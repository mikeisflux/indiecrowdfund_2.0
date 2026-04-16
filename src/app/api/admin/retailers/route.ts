import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminRetailersLogger = logger.child({ module: "admin-retailers" });
import { revalidateTag } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendRetailerApprovalEmail, sendRetailerRejectionEmail } from "@/lib/email";
import crypto from "crypto";

// Force dynamic - this route uses auth/headers
export const dynamic = "force-dynamic";

// Generate a random access code
function generateAccessCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const segments = [];
  for (let s = 0; s < 3; s++) {
    let segment = "";
    for (let i = 0; i < 4; i++) {
      segment += chars.charAt(crypto.randomInt(chars.length));
    }
    segments.push(segment);
  }
  return segments.join("-");
}

// GET - Get retailer applications
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user is admin
    const user = await db.user.findFirst({ where: { id: session.user.id, deletedAt: null } });
    if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "PENDING";

    // Validate pagination parameters
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20") || 20));

    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status !== "all") {
      where.status = status;
    }

    const [retailers, total, statusCounts] = await Promise.all([
      db.retailer.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          userId: true,
          businessName: true,
          businessType: true,
          contactName: true,
          email: true,
          phone: true,
          address: true,
          city: true,
          state: true,
          zipCode: true,
          country: true,
          taxId: true,
          taxIdType: true,
          resaleCertificate: true,
          yearsInBusiness: true,
          numberOfLocations: true,
          annualRevenue: true,
          websiteUrl: true,
          status: true,
          verificationNotes: true,
          verifiedAt: true,
          accessCode: true,
          createdAt: true,
          _count: {
            select: {
              pledges: true,
            },
          },
        },
      }),
      db.retailer.count({ where }),
      Promise.all([
        db.retailer.count({ where: { status: "PENDING" } }),
        db.retailer.count({ where: { status: "UNDER_REVIEW" } }),
        db.retailer.count({ where: { status: "APPROVED" } }),
        db.retailer.count({ where: { status: "REJECTED" } }),
        db.retailer.count({ where: { status: "SUSPENDED" } }),
      ]),
    ]);

    return NextResponse.json({
      retailers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        pending: statusCounts[0],
        underReview: statusCounts[1],
        approved: statusCounts[2],
        rejected: statusCounts[3],
        suspended: statusCounts[4],
      },
    });
  } catch (error) {
    adminRetailersLogger.error({ err: String(error) }, "Error fetching retailers:");
    return NextResponse.json(
      { error: "Failed to fetch retailers" },
      { status: 500 }
    );
  }
}

// PUT - Edit retailer information
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user is admin
    const user = await db.user.findFirst({ where: { id: session.user.id, deletedAt: null } });
    if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { retailerId, ...fields } = body;

    if (!retailerId) {
      return NextResponse.json({ error: "Retailer ID is required" }, { status: 400 });
    }

    const retailer = await db.retailer.findUnique({
      where: { id: retailerId },
    });

    if (!retailer) {
      return NextResponse.json({ error: "Retailer not found" }, { status: 404 });
    }

    // Only allow updating specific fields
    const allowedFields = [
      "businessName", "businessType", "contactName", "email", "phone",
      "address", "city", "state", "zipCode", "country",
      "taxId", "taxIdType", "websiteUrl", "yearsInBusiness",
      "numberOfLocations", "annualRevenue",
    ];

    const updateData: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in fields && fields[key] !== undefined) {
        updateData[key] = fields[key];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    // If email is being changed, check for uniqueness
    if (updateData.email && updateData.email !== retailer.email) {
      const existingRetailer = await db.retailer.findUnique({
        where: { email: updateData.email as string },
      });
      if (existingRetailer) {
        return NextResponse.json({ error: "A retailer with this email already exists" }, { status: 409 });
      }
    }

    const updatedRetailer = await db.retailer.update({
      where: { id: retailerId },
      data: updateData,
    });

    adminRetailersLogger.info(`[Admin] Retailer ${retailerId} updated by ${session.user.id}: ${Object.keys(updateData).join(", ")}`);

    revalidateTag("retailer-stats", "max");

    return NextResponse.json({
      success: true,
      retailer: updatedRetailer,
    });
  } catch (error) {
    adminRetailersLogger.error({ err: String(error) }, "Error editing retailer:");
    return NextResponse.json(
      { error: "Failed to update retailer" },
      { status: 500 }
    );
  }
}

// PATCH - Update retailer status
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user is admin
    const user = await db.user.findFirst({ where: { id: session.user.id, deletedAt: null } });
    if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { retailerId, action, notes } = body;

    if (!retailerId || !action) {
      return NextResponse.json(
        { error: "Retailer ID and action are required" },
        { status: 400 }
      );
    }

    const retailer = await db.retailer.findUnique({
      where: { id: retailerId },
    });

    if (!retailer) {
      return NextResponse.json(
        { error: "Retailer not found" },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {
      verificationNotes: notes || null,
    };

    // Track if we need to update user's retailerAccess
    let updateUserRetailerAccess: boolean | null = null;

    switch (action) {
      case "APPROVE":
        updateData.status = "APPROVED";
        updateData.verifiedAt = new Date();
        updateData.verifiedBy = session.user.id;
        // Generate access code if not exists
        if (!retailer.accessCode) {
          updateData.accessCode = generateAccessCode();
        }
        // Enable retailer access for linked user
        updateUserRetailerAccess = true;
        break;

      case "REJECT":
        updateData.status = "REJECTED";
        // Disable retailer access for linked user
        updateUserRetailerAccess = false;
        break;

      case "REQUEST_INFO":
        updateData.status = "UNDER_REVIEW";
        break;

      case "SUSPEND":
        updateData.status = "SUSPENDED";
        // Disable retailer access for linked user
        updateUserRetailerAccess = false;
        break;

      case "REACTIVATE":
        updateData.status = "APPROVED";
        // Re-enable retailer access for linked user
        updateUserRetailerAccess = true;
        break;

      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }

    // On approval, find or create a User account and link it to the retailer
    let linkedUserId = retailer.userId;
    let passwordSetupToken: string | null = null;

    if (action === "APPROVE" && !retailer.userId) {
      // Check if a User account already exists with this email
      const existingUser = await db.user.findFirst({
        where: { email: retailer.email, deletedAt: null },
      });

      if (existingUser) {
        // Link existing user to the retailer
        linkedUserId = existingUser.id;
        adminRetailersLogger.info(`[Admin] Linked retailer ${retailerId} to existing user ${existingUser.id}`);
      } else {
        // Create a new User account for the retailer.
        // Catch P2002 unique violation in case a concurrent approval
        // request already created the user with this email.
        let newUser;
        try {
          newUser = await db.user.create({
            data: {
              email: retailer.email,
              name: retailer.contactName,
              emailVerified: new Date(),
              retailerAccess: true,
            },
          });
        } catch (createErr) {
          const isUniqueViolation =
            createErr &&
            typeof createErr === "object" &&
            "code" in createErr &&
            (createErr as { code?: string }).code === "P2002";
          if (isUniqueViolation) {
            // Another request created the user first — look it up instead.
            const raceUser = await db.user.findFirst({
              where: { email: retailer.email, deletedAt: null },
            });
            if (!raceUser) throw createErr;
            newUser = raceUser;
          } else {
            throw createErr;
          }
        }
        linkedUserId = newUser.id;
        adminRetailersLogger.info(`[Admin] Created new user account ${newUser.id} for retailer ${retailerId}`);
      }

      // Link the retailer to the user
      updateData.userId = linkedUserId;

      // Generate a password setup token so they can set their password
      await db.passwordResetToken.deleteMany({
        where: { email: retailer.email },
      });

      passwordSetupToken = crypto.randomUUID();
      const expires = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours for initial setup

      await db.passwordResetToken.create({
        data: {
          email: retailer.email,
          token: passwordSetupToken,
          expires,
        },
      });
    }

    // CAS on retailer.status matching the value we read above. Without
    // this, two admins concurrently approving the same retailer would
    // both generate access codes, create duplicate User accounts (one
    // hitting P2002), and fire duplicate approval emails.
    const casResult = await db.retailer.updateMany({
      where: { id: retailerId, status: retailer.status },
      data: updateData,
    });

    if (casResult.count === 0) {
      return NextResponse.json(
        { error: "Retailer status has already changed — please refresh and try again." },
        { status: 409 }
      );
    }

    const updatedRetailer = await db.retailer.findUnique({
      where: { id: retailerId },
    });

    // Invalidate the retailer stats cache so counts update immediately
    revalidateTag("retailer-stats", "max");

    // Update linked user's retailerAccess if applicable
    if (updateUserRetailerAccess !== null && linkedUserId) {
      await db.user.update({
        where: { id: linkedUserId },
        data: { retailerAccess: updateUserRetailerAccess },
      });
    }

    // Send notification email based on action
    try {
      if (action === "APPROVE") {
        const accessCode = (updateData.accessCode as string) || retailer.accessCode;
        if (accessCode) {
          await sendRetailerApprovalEmail(
            retailer.email,
            retailer.businessName,
            retailer.contactName,
            accessCode,
            passwordSetupToken
          );
          adminRetailersLogger.info(`[Admin] Sent retailer approval email to ${retailer.email}`);
        }
      } else if (action === "REJECT") {
        await sendRetailerRejectionEmail(
          retailer.email,
          retailer.businessName,
          retailer.contactName,
          notes || undefined
        );
        adminRetailersLogger.info(`[Admin] Sent retailer rejection email to ${retailer.email}`);
      }
    } catch (emailError) {
      // Don't fail the action if email fails, just log it
      adminRetailersLogger.error({ err: String(emailError) }, "[Admin] Failed to send retailer notification email:");
    }

    return NextResponse.json({
      success: true,
      retailer: updatedRetailer,
    });
  } catch (error) {
    adminRetailersLogger.error({ err: String(error) }, "Error updating retailer:");
    return NextResponse.json(
      { error: "Failed to update retailer" },
      { status: 500 }
    );
  }
}
