import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import crypto from "crypto";

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

    // Cap password length to prevent bcrypt DoS
    if (password && (typeof password !== "string" || password.length > 1000)) {
      return NextResponse.json({ error: "Invalid password" }, { status: 400 });
    }

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
    const user = await db.user.findFirst({
      where: { id: session.user.id, deletedAt: null },
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

    // Check if email is already taken by another user (case-insensitive)
    const existingUser = await db.user.findFirst({
      where: {
        email: { equals: newEmail, mode: "insensitive" },
        id: { not: session.user.id },
        deletedAt: null,
      },
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

    // Update the user's email and reset verification status. Catch
    // P2002 on the email @unique constraint — the case-insensitive
    // existingUser check above is TOCTOU (case-sensitive constraint).
    let updatedUser;
    try {
      updatedUser = await db.user.update({
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
    } catch (updateErr) {
      const isUniqueViolation =
        updateErr &&
        typeof updateErr === "object" &&
        "code" in updateErr &&
        (updateErr as { code?: string }).code === "P2002";
      if (isUniqueViolation) {
        return NextResponse.json(
          { error: "This email is already in use" },
          { status: 409 }
        );
      }
      throw updateErr;
    }

    // Send verification email to the new address
    try {
      const { sendVerificationEmail, isEmailVerificationRequired } = await import("@/lib/email");
      const verificationRequired = await isEmailVerificationRequired();
      if (verificationRequired) {
        const verificationToken = crypto.randomUUID();
        const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        await db.verificationToken.create({
          data: {
            identifier: newEmail.toLowerCase(),
            token: verificationToken,
            expires,
          },
        });

        await sendVerificationEmail(newEmail, session.user.name || "User", verificationToken);
      }
    } catch (emailError) {
      userSettingsEmailLogger.error({ err: String(emailError) }, "Failed to send verification email after email change");
    }

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
