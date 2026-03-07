import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const userSettingsEmailLogger = logger.child({ module: "user-settings-email" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { newEmail, password } = body;

    if (!newEmail) {
      return NextResponse.json(
        { error: "New email is required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Get the current user
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        password: true,
        accounts: {
          select: {
            provider: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if the new email is the same as the current one
    if (user.email.toLowerCase() === newEmail.toLowerCase()) {
      return NextResponse.json(
        { error: "New email must be different from current email" },
        { status: 400 }
      );
    }

    // Check if email is already taken by another user
    const existingUser = await db.user.findUnique({
      where: { email: newEmail.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "This email is already in use" },
        { status: 400 }
      );
    }

    // If user has a password set, verify it (unless they only have social login)
    const hasSocialLoginOnly = user.accounts.length > 0 && !user.password;

    if (user.password && password) {
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return NextResponse.json(
          { error: "Incorrect password" },
          { status: 400 }
        );
      }
    } else if (user.password && !password && !hasSocialLoginOnly) {
      // User has a password but didn't provide one, and they're not social-only
      return NextResponse.json(
        { error: "Password is required to change email" },
        { status: 400 }
      );
    }

    // Update the user's email and reset verification status
    const updatedUser = await db.user.update({
      where: { id: session.user.id },
      data: {
        email: newEmail.toLowerCase(),
        emailVerified: null, // Reset email verification
      },
      select: {
        id: true,
        email: true,
        emailVerified: true,
      },
    });

    // TODO: Send verification email to the new address
    // await sendEmailVerification(newEmail, user.name);

    return NextResponse.json({
      success: true,
      message: "Email changed successfully. Please verify your new email address.",
      user: updatedUser,
    });
  } catch (error) {
    userSettingsEmailLogger.error({ err: String(error) }, "Email change error:");
    return NextResponse.json(
      { error: "Failed to change email" },
      { status: 500 }
    );
  }
}
