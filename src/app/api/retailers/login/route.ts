import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { compare } from "bcryptjs";
import { cookies } from "next/headers";
import { SignJWT } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.RETAILER_JWT_SECRET || "retailer-secret-key-change-in-production"
);

// POST - Retailer login
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { method, email, password, accessCode } = body;

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
        where: { email },
      });

      if (!retailer) {
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
        return NextResponse.json(
          { error: "Invalid email or password" },
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

    // Check retailer status
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
      .sign(JWT_SECRET);

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
    console.error("Error logging in retailer:", error);
    return NextResponse.json(
      { error: "Failed to login" },
      { status: 500 }
    );
  }
}
