import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

// Require RETAILER_JWT_SECRET in production - no weak fallback
// Lazily get the secret to avoid build-time errors
function getJwtSecret(): Uint8Array {
  const secret = process.env.RETAILER_JWT_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("RETAILER_JWT_SECRET environment variable is required in production");
  }
  return new TextEncoder().encode(secret || "dev-only-secret-not-for-production");
}

interface RetailerTokenData {
  retailerId: string;
  email: string;
  businessName: string;
}

interface RetailerAuthResult {
  authorized: boolean;
  retailerId?: string;
  isSuperAdmin?: boolean;
  error?: string;
}

/**
 * Authenticate a request for retailer API access.
 * Checks for:
 * 1. Valid retailer JWT token in cookies
 * 2. NextAuth session with SUPER_ADMIN role
 * 3. NextAuth session with retailerAccess enabled and linked retailer
 */
export async function authenticateRetailerRequest(): Promise<RetailerAuthResult> {
  // First, try to get retailer from JWT token
  const tokenData = await getRetailerFromToken();
  if (tokenData) {
    return {
      authorized: true,
      retailerId: tokenData.retailerId,
    };
  }

  // No token, check NextAuth session
  const session = await auth();
  if (!session?.user?.id) {
    return {
      authorized: false,
      error: "Unauthorized",
    };
  }

  // Get user with role and retailerAccess
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      role: true,
      retailerAccess: true,
    },
  });

  if (!user) {
    return {
      authorized: false,
      error: "User not found",
    };
  }

  // Super admins can access retailer APIs in preview mode
  if (user.role === "SUPER_ADMIN") {
    return {
      authorized: true,
      isSuperAdmin: true,
    };
  }

  // Check if user has retailerAccess
  if (!user.retailerAccess) {
    return {
      authorized: false,
      error: "Retailer access not enabled",
    };
  }

  // Find linked retailer
  let retailer = await db.retailer.findFirst({
    where: { userId: user.id },
  });

  // If no linked retailer, try to find by email
  if (!retailer && user.email) {
    retailer = await db.retailer.findUnique({
      where: { email: user.email },
    });

    // Link the retailer to the user
    if (retailer) {
      await db.retailer.update({
        where: { id: retailer.id },
        data: { userId: user.id },
      });
    }
  }

  if (!retailer) {
    return {
      authorized: false,
      error: "No retailer profile found",
    };
  }

  if (retailer.status !== "APPROVED") {
    return {
      authorized: false,
      error: "Retailer account not approved",
    };
  }

  return {
    authorized: true,
    retailerId: retailer.id,
  };
}

/**
 * Get retailer data from JWT token in cookies
 */
async function getRetailerFromToken(): Promise<RetailerTokenData | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("retailer_token")?.value;

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload as unknown as RetailerTokenData;
  } catch {
    return null;
  }
}
