import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const retailersLoginLogger = logger.child({ module: "retailers-login" });
import { db } from "@/lib/db";
import { compare } from "bcryptjs";
import { cookies } from "next/headers";
import { SignJWT } from "jose";
import {
  checkRetailerLoginRateLimit,
  recordRetailerLoginAttempt,
} from "@/lib/auth/rate-limit";
import { verifyRecaptcha } from "@/lib/auth/recaptcha";

function getJwtSecret(): Uint8Array {
  const secret = process.env.RETAILER_JWT_SECRET;
  if (!secret) {
    throw new Error("RETAILER_JWT_SECRET environment variable is required");
  }
  return new TextEncoder().encode(secret);
}

/**
 * Get client IP from request headers
 */
function getClientIP(req: NextRequest): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    null
  );
}

// POST - Retailer login
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { method, email, password, accessCode, recaptchaToken } = body;

    // Get client IP for rate limiting
    const clientIP = getClientIP(req);

    // Verify reCAPTCHA if token provided
    const recaptchaResult = await verifyRecaptcha(recaptchaToken, clientIP);
    if (!recaptchaResult.valid) {
      return NextResponse.json(
        { error: recaptchaResult.error || "CAPTCHA verification failed" },
        { status: 400 }
      );
    }

    // Determine identifier for rate limiting (email or access code)
    const identifier = method === "credentials" ? email : accessCode;

    if (!identifier) {
      return NextResponse.json(
        { error: method === "credentials" ? "Email is required" : "Access code is required" },
        { status: 400 }
      );
    }

    // Check rate limit before processing
    const rateLimitCheck = await checkRetailerLoginRateLimit(clientIP, identifier);
    if (!rateLimitCheck.allowed) {
      return NextResponse.json(
        {
          error: rateLimitCheck.message || "Too many login attempts. Please try again later.",
          retryAfter: rateLimitCheck.retryAfter,
        },
        { status: 429 }
      );
    }

    let retailer;

    if (method === "credentials") {
      // Email/Password login
      if (!email || !password) {
        return NextResponse.json(
          { error: "Email and password are required" },
          { status: 400 }
        );
      }

      retailer = await db.retailer.findUnique({
        where: { email: email.toLowerCase().trim() },
      });

      if (!retailer) {
        // Record failed attempt
        await recordRetailerLoginAttempt(clientIP, email, false);
        return NextResponse.json(
          { error: "Invalid email or password" },
          { status: 401 }
        );
      }

      if (!retailer.passwordHash) {
        return NextResponse.json(
          { error: "Please use your access code to login, or set a password in your account settings" },
          { status: 400 }
        );
      }

      const isPasswordValid = await compare(password, retailer.passwordHash);
      if (!isPasswordValid) {
        // Record failed attempt
        await recordRetailerLoginAttempt(clientIP, email, false);

        // Get remaining attempts for feedback
        const updatedCheck = await checkRetailerLoginRateLimit(clientIP, email);
        const remainingMsg = updatedCheck.remainingAttempts > 0
          ? ` (${updatedCheck.remainingAttempts} attempts remaining)`
          : "";

        return NextResponse.json(
          { error: `Invalid email or password${remainingMsg}` },
          { status: 401 }
        );
      }
    } else if (method === "accessCode") {
      // Access code login
      if (!accessCode) {
        return NextResponse.json(
          { error: "Access code is required" },
          { status: 400 }
        );
      }

      retailer = await db.retailer.findUnique({
        where: { accessCode: accessCode.toUpperCase() },
      });

      if (!retailer) {
        // Record failed attempt
        await recordRetailerLoginAttempt(clientIP, accessCode, false);
        return NextResponse.json(
          { error: "Invalid access code" },
          { status: 401 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "Invalid login method" },
        { status: 400 }
      );
    }

    // Check retailer status BEFORE recording success so a non-APPROVED
    // retailer with a correct password cannot clear the rate-limit counter
    // and effectively bypass brute-force protection.
    if (retailer.status === "PENDING") {
      return NextResponse.json(
        { error: "Your application is still under review. You will receive an email when approved." },
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
        { error: "Your retailer application was not approved. Please contact support for more information." },
        { status: 403 }
      );
    }

    if (retailer.status === "SUSPENDED") {
      return NextResponse.json(
        { error: "Your retailer account has been suspended. Please contact support." },
        { status: 403 }
      );
    }

    if (retailer.status !== "APPROVED") {
      return NextResponse.json(
        { error: "Your account is not active. Please contact support." },
        { status: 403 }
      );
    }

    // Record successful login (clears rate limit) — only after status is confirmed APPROVED
    await recordRetailerLoginAttempt(clientIP, identifier, true);

    // Update last login
    await db.retailer.update({
      where: { id: retailer.id },
      data: { lastLoginAt: new Date() },
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
  } catch (error) {
    retailersLoginLogger.error({ err: formatError(error) }, "Error logging in retailer:");
    return NextResponse.json(
      { error: "Failed to login" },
      { status: 500 }
    );
  }
}
