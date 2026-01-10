import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { SignJWT } from "jose";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

function getJwtSecret(): Uint8Array {
  const secret = process.env.RETAILER_JWT_SECRET;
  if (!secret) {
    throw new Error("RETAILER_JWT_SECRET environment variable is required");
  }
  return new TextEncoder().encode(secret);
}

// POST - Authenticate retailer via NextAuth session
export async function POST() {
  try {
    // Check if user is logged in via NextAuth
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Not logged in", requiresLogin: true },
        { status: 401 }
      );
    }

    // Check if user has retailerAccess enabled
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        retailerAccess: true,
        role: true
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found", requiresLogin: true },
        { status: 404 }
      );
    }

    // Super admins can access retailer dashboard in preview mode (no token needed)
    if (user.role === "SUPER_ADMIN") {
      return NextResponse.json({
        success: true,
        isAdmin: true,
        message: "Admin access granted"
      });
    }

    // Check retailerAccess flag
    if (!user.retailerAccess) {
      return NextResponse.json(
        {
          error: "Retailer access not enabled for your account",
          requiresApplication: true
        },
        { status: 403 }
      );
    }

    // Find linked retailer record
    const retailer = await db.retailer.findFirst({
      where: { userId: user.id }
    });

    if (!retailer) {
      // User has retailerAccess but no linked retailer - try to find by email
      const retailerByEmail = await db.retailer.findUnique({
        where: { email: user.email! }
      });

      if (!retailerByEmail) {
        return NextResponse.json(
          {
            error: "No retailer profile found. Please apply for retailer access.",
            requiresApplication: true
          },
          { status: 404 }
        );
      }

      // Link the retailer to the user if not already linked
      await db.retailer.update({
        where: { id: retailerByEmail.id },
        data: { userId: user.id }
      });

      // Continue with the linked retailer
      return await authenticateRetailer(retailerByEmail);
    }

    return await authenticateRetailer(retailer);
  } catch (error) {
    console.error("Error in session auth:", error);
    return NextResponse.json(
      { error: "Failed to authenticate" },
      { status: 500 }
    );
  }
}

async function authenticateRetailer(retailer: {
  id: string;
  email: string;
  businessName: string;
  status: string;
}) {
  // Check retailer status
  if (retailer.status === "PENDING") {
    return NextResponse.json(
      { error: "Your retailer application is still under review." },
      { status: 403 }
    );
  }

  if (retailer.status === "UNDER_REVIEW") {
    return NextResponse.json(
      { error: "Your application is being reviewed. Please check back soon." },
      { status: 403 }
    );
  }

  if (retailer.status === "REJECTED") {
    return NextResponse.json(
      { error: "Your retailer application was not approved." },
      { status: 403 }
    );
  }

  if (retailer.status === "SUSPENDED") {
    return NextResponse.json(
      { error: "Your retailer account has been suspended." },
      { status: 403 }
    );
  }

  if (retailer.status !== "APPROVED") {
    return NextResponse.json(
      { error: "Your account is not active." },
      { status: 403 }
    );
  }

  // Update last login
  await db.retailer.update({
    where: { id: retailer.id },
    data: { lastLoginAt: new Date() }
  });

  // Create JWT token
  const token = await new SignJWT({
    retailerId: retailer.id,
    email: retailer.email,
    businessName: retailer.businessName,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtSecret());

  // Set cookie
  const cookieStore = await cookies();
  cookieStore.set("retailer_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });

  return NextResponse.json({
    success: true,
    retailer: {
      id: retailer.id,
      businessName: retailer.businessName,
      email: retailer.email,
      status: retailer.status,
    },
  });
}

// GET - Check if current session can access retailer portal
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({
        hasAccess: false,
        reason: "not_logged_in"
      });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        retailerAccess: true,
        role: true
      }
    });

    if (!user) {
      return NextResponse.json({
        hasAccess: false,
        reason: "user_not_found"
      });
    }

    // Super admins always have access
    if (user.role === "SUPER_ADMIN") {
      return NextResponse.json({
        hasAccess: true,
        isAdmin: true
      });
    }

    return NextResponse.json({
      hasAccess: user.retailerAccess === true,
      reason: user.retailerAccess ? undefined : "no_retailer_access"
    });
  } catch (error) {
    console.error("Error checking session access:", error);
    return NextResponse.json({
      hasAccess: false,
      reason: "error"
    });
  }
}
