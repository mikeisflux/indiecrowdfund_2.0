"use server";

import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createSession, deleteSession } from "./session";
import {
  checkLoginRateLimit,
  recordLoginAttempt,
  checkPasswordResetRateLimit,
  recordPasswordResetAttempt,
} from "./rate-limit";

/**
 * Get client IP address from request headers
 */
async function getClientIP(): Promise<string | null> {
  const headersList = await headers();
  // Check common headers for client IP (in order of reliability)
  return (
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headersList.get("x-real-ip") ||
    headersList.get("cf-connecting-ip") || // Cloudflare
    null
  );
}

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export async function register(formData: FormData, callbackUrl?: string | null) {
  const validatedFields = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validatedFields.success) {
    return { error: validatedFields.error.flatten().fieldErrors };
  }

  const { name, email, password } = validatedFields.data;

  // Check if user already exists
  const existingUser = await db.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    return { error: { email: ["Email already registered"] } };
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12);

  // Create user
  let user;
  try {
    user = await db.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
    });
  } catch {
    return { error: { _form: ["Something went wrong. Please try again."] } };
  }

  // Send welcome email if enabled
  try {
    const { sendWelcomeEmail, isEmailTypeEnabled, sendVerificationEmail, isEmailVerificationRequired } = await import("@/lib/email");

    // Check if welcome email is enabled and send it
    const welcomeEnabled = await isEmailTypeEnabled("welcome");
    if (welcomeEnabled) {
      await sendWelcomeEmail(email, name);
    }

    // Check if email verification is required and send verification email
    const verificationRequired = await isEmailVerificationRequired();
    if (verificationRequired) {
      // Generate verification token
      const verificationToken = crypto.randomUUID();
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Store the verification token
      await db.verificationToken.create({
        data: {
          identifier: email,
          token: verificationToken,
          expires,
        },
      });

      await sendVerificationEmail(email, name, verificationToken);
    }
  } catch (emailError) {
    // Don't fail registration if email fails
    console.error("Failed to send welcome/verification email:", emailError);
  }

  // Create session
  await createSession(user.id);

  // Determine redirect destination - go back to where they came from
  const redirectTo = callbackUrl || "/dashboard";

  // Return success with redirect URL - let client handle navigation
  // This ensures the Set-Cookie header is properly sent before redirect
  return { success: true, redirectTo };
}

export async function login(formData: FormData, callbackUrl?: string) {
  const validatedFields = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validatedFields.success) {
    return { error: validatedFields.error.flatten().fieldErrors };
  }

  const { email, password } = validatedFields.data;

  // Check rate limit before attempting login
  const clientIP = await getClientIP();
  const rateLimitCheck = await checkLoginRateLimit(clientIP, email);

  if (!rateLimitCheck.allowed) {
    return {
      error: {
        _form: [rateLimitCheck.message || "Too many login attempts. Please try again later."],
      },
      retryAfter: rateLimitCheck.retryAfter,
    };
  }

  // Find user
  const user = await db.user.findUnique({
    where: { email },
  });

  if (!user || !user.password) {
    // Record failed attempt (even for non-existent users to prevent enumeration timing attacks)
    await recordLoginAttempt(clientIP, email, false);
    return { error: { _form: ["Invalid email or password"] } };
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    // Record failed attempt
    await recordLoginAttempt(clientIP, email, false);

    // Calculate remaining attempts for user feedback
    const updatedCheck = await checkLoginRateLimit(clientIP, email);
    const remainingMsg = updatedCheck.remainingAttempts > 0
      ? ` (${updatedCheck.remainingAttempts} attempts remaining)`
      : "";

    return { error: { _form: [`Invalid email or password${remainingMsg}`] } };
  }

  // Record successful login (clears rate limit)
  await recordLoginAttempt(clientIP, email, true);

  // Create session
  await createSession(user.id);

  // Determine redirect destination based on role
  let redirectTo = callbackUrl || "/choose-role";

  // SUPER_ADMIN goes to admin panel by default
  if (user.role === "SUPER_ADMIN" && !callbackUrl) {
    redirectTo = "/admin";
  }

  // Return success with redirect URL - let client handle navigation
  // This ensures the Set-Cookie header is properly sent before redirect
  return { success: true, redirectTo };
}

export async function logout() {
  await deleteSession();
  redirect("/");
}

// Password reset schemas
const requestResetSchema = z.object({
  email: z.string().email("Invalid email address"),
});

const resetPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export async function requestPasswordReset(formData: FormData) {
  const validatedFields = requestResetSchema.safeParse({
    email: formData.get("email"),
  });

  if (!validatedFields.success) {
    return { error: validatedFields.error.flatten().fieldErrors };
  }

  const { email } = validatedFields.data;

  // Check rate limit before processing reset request
  const clientIP = await getClientIP();
  const rateLimitCheck = await checkPasswordResetRateLimit(clientIP, email);

  if (!rateLimitCheck.allowed) {
    // Still return success to prevent enumeration, but don't actually send email
    // The rate limit message will be shown on the frontend
    return {
      success: true,
      rateLimited: true,
      retryAfter: rateLimitCheck.retryAfter,
    };
  }

  try {
    // Record the reset attempt
    await recordPasswordResetAttempt(clientIP, email);

    // Check if user exists
    const user = await db.user.findUnique({
      where: { email },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return { success: true };
    }

    // Delete any existing tokens for this email
    await db.passwordResetToken.deleteMany({
      where: { email },
    });

    // Generate a secure token
    const token = crypto.randomUUID();
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Create the reset token
    await db.passwordResetToken.create({
      data: {
        email,
        token,
        expires,
      },
    });

    // Send the reset email
    const { sendPasswordResetEmail } = await import("@/lib/email");
    const emailResult = await sendPasswordResetEmail(email, token);

    if (!emailResult.success) {
      console.error("Failed to send password reset email:", emailResult.error);
      // Still return success to prevent email enumeration, but log the error
    }

    return { success: true };
  } catch (error) {
    console.error("Error requesting password reset:", error);
    return { error: { _form: ["Something went wrong. Please try again."] } };
  }
}

export async function verifyResetToken(token: string) {
  try {
    const resetToken = await db.passwordResetToken.findUnique({
      where: { token },
    });

    if (!resetToken) {
      return { valid: false };
    }

    if (resetToken.expires < new Date()) {
      // Token expired, delete it
      await db.passwordResetToken.delete({
        where: { token },
      });
      return { valid: false };
    }

    return { valid: true, email: resetToken.email };
  } catch {
    return { valid: false };
  }
}

export async function resetPassword(formData: FormData, token: string) {
  const validatedFields = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!validatedFields.success) {
    return { error: validatedFields.error.flatten().fieldErrors };
  }

  const { password } = validatedFields.data;

  try {
    // Verify token
    const resetToken = await db.passwordResetToken.findUnique({
      where: { token },
    });

    if (!resetToken || resetToken.expires < new Date()) {
      return { error: { _form: ["Invalid or expired reset link. Please request a new one."] } };
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update the user's password
    await db.user.update({
      where: { email: resetToken.email },
      data: { password: hashedPassword },
    });

    // Delete the used token
    await db.passwordResetToken.delete({
      where: { token },
    });

    return { success: true };
  } catch (error) {
    console.error("Error resetting password:", error);
    return { error: { _form: ["Something went wrong. Please try again."] } };
  }
}
