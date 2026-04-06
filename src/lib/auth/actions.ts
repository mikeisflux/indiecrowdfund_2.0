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
  checkRegistrationRateLimit,
  recordRegistrationAttempt,
  validateNameNotGibberish,
  checkHoneypot,
} from "./rate-limit";
import { verifyRecaptcha } from "./recaptcha";
import { BCRYPT_COST } from "./constants";

import { logger } from "@/lib/logger";

const authActionsLogger = logger.child({ module: "auth-actions" });


/**
 * Validate a redirect URL to prevent open redirect attacks.
 * Only allows relative URLs (starting with /) that stay on the same origin.
 */
function sanitizeRedirectUrl(url: string | null | undefined, fallback: string): string {
  if (!url) return fallback;
  // Only allow relative URLs — reject anything with a protocol or protocol-relative URLs
  if (!url.startsWith("/") || url.startsWith("//")) return fallback;
  // Reject URLs with embedded newlines or other control characters (CRLF injection)
  if (/[\r\n]/.test(url)) return fallback;
  return url;
}

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
  try {
    // Get client IP for rate limiting
    const clientIP = await getClientIP();

    // Check honeypot (bot detection) - should be empty
    const honeypotValue = formData.get("website") as string | null;
    if (!checkHoneypot(honeypotValue)) {
      // Bot detected - silently reject with generic error
      authActionsLogger.info({ data: clientIP }, "[Register] Bot detected via honeypot from IP:");
      return { error: { _form: ["Registration failed. Please try again."] } };
    }

    // Verify reCAPTCHA if token provided
    const recaptchaToken = formData.get("recaptchaToken") as string | null;
    const recaptchaResult = await verifyRecaptcha(recaptchaToken, clientIP);
    if (!recaptchaResult.valid) {
      authActionsLogger.info({ data: clientIP }, "[Register] reCAPTCHA failed from IP:");
      return { error: { _form: [recaptchaResult.error || "CAPTCHA verification failed"] } };
    }

    // Check rate limit before processing
    const rateLimitCheck = await checkRegistrationRateLimit(clientIP);
    if (!rateLimitCheck.allowed) {
      return {
        error: {
          _form: [rateLimitCheck.message || "Too many registration attempts. Please try again later."],
        },
      };
    }

    const validatedFields = registerSchema.safeParse({
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
    });

    if (!validatedFields.success) {
      return { error: validatedFields.error.flatten().fieldErrors };
    }

    const { name, email: rawEmail, password } = validatedFields.data;
    const email = rawEmail.toLowerCase();

    // Validate name is not gibberish (bot detection)
    const nameValidation = validateNameNotGibberish(name);
    if (!nameValidation.valid) {
      authActionsLogger.info({ name, ip: clientIP }, "Gibberish name rejected");
      return { error: { name: [nameValidation.reason || "Please enter a valid name"] } };
    }

    // Check if user already exists (case-insensitive to prevent duplicates)
    let existingUser;
    try {
      existingUser = await db.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" }, deletedAt: null },
      });
    } catch (dbError) {
      authActionsLogger.error({ err: dbError }, "[Register] Database error checking existing user:");
      return { error: { _form: ["Unable to connect to database. Please try again."] } };
    }

    if (existingUser) {
      return { error: { email: ["Email already registered"] } };
    }

    // Hash password
    let hashedPassword;
    try {
      hashedPassword = await bcrypt.hash(password, BCRYPT_COST);
    } catch (hashError) {
      authActionsLogger.error({ err: hashError }, "[Register] Password hashing error:");
      return { error: { _form: ["Something went wrong. Please try again."] } };
    }

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

      // Record registration attempt for rate limiting
      await recordRegistrationAttempt(clientIP);
    } catch (createError) {
      authActionsLogger.error({ err: createError }, "[Register] Error creating user:");
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
      authActionsLogger.error({ err: emailError }, "[Register] Failed to send welcome/verification email:");
    }

    // Create session
    try {
      await createSession(user.id);
    } catch (sessionError) {
      authActionsLogger.error({ err: sessionError }, "[Register] Error creating session:");
      return { error: { _form: ["Account created but failed to sign in. Please try logging in."] } };
    }

    // Determine redirect destination - go back to where they came from
    const redirectTo = sanitizeRedirectUrl(callbackUrl, "/dashboard");

    // Return success with redirect URL - let client handle navigation
    // This ensures the Set-Cookie header is properly sent before redirect
    authActionsLogger.info({ data: email }, "[Register] Success for email:");
    return { success: true, redirectTo };
  } catch (error) {
    // Catch-all for any unexpected errors
    authActionsLogger.error({ err: error }, "[Register] Unexpected error:");
    return { error: { _form: ["Something went wrong. Please try again."] } };
  }
}

export async function login(formData: FormData, callbackUrl?: string) {
  const validatedFields = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validatedFields.success) {
    return { error: validatedFields.error.flatten().fieldErrors };
  }

  const { email: rawEmail, password } = validatedFields.data;
  const email = rawEmail.toLowerCase();

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

  // Find user — explicit select avoids requesting columns that may not exist yet in DB
  // (e.g. failedLoginAttempts before migration is run)
  const user = await db.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, deletedAt: null },
    select: { id: true, password: true, role: true, lockedAt: true },
  });

  if (!user || !user.password) {
    // Record failed attempt (even for non-existent users to prevent enumeration timing attacks)
    await recordLoginAttempt(clientIP, email, false);
    return { error: { _form: ["Invalid email or password"] } };
  }

  // Check if account is locked
  if (user.lockedAt) {
    return { error: { _form: ["Your account has been locked. Please contact support."] } };
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    // Record failed attempt (in-memory/Redis rate limiter + persistent DB counter)
    await recordLoginAttempt(clientIP, email, false);
    await db.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: { increment: 1 },
        lastFailedLoginAt: new Date(),
      },
    }).catch(() => {}); // Non-fatal — don't break login flow

    // Calculate remaining attempts for user feedback
    const updatedCheck = await checkLoginRateLimit(clientIP, email);
    const remainingMsg = updatedCheck.remainingAttempts > 0
      ? ` (${updatedCheck.remainingAttempts} attempts remaining)`
      : "";

    return { error: { _form: [`Invalid email or password${remainingMsg}`] } };
  }

  // Record successful login (clears rate limit + reset DB counter)
  await recordLoginAttempt(clientIP, email, true);
  await db.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lastFailedLoginAt: null },
  }).catch(() => {}); // Non-fatal

  // Create session
  await createSession(user.id);

  // Determine redirect destination based on role
  const safeCallbackUrl = sanitizeRedirectUrl(callbackUrl, "");
  let redirectTo = safeCallbackUrl || "/choose-role";

  // SUPER_ADMIN goes to admin panel by default
  if (user.role === "SUPER_ADMIN" && !safeCallbackUrl) {
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

  const { email: rawEmail } = validatedFields.data;
  const email = rawEmail.toLowerCase();

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

    // Check if user exists (case-insensitive)
    const user = await db.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" }, deletedAt: null },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return { success: true };
    }

    // Use the actual user email (normalized to lowercase) for the token
    const normalizedEmail = user.email.toLowerCase();

    // Delete any existing tokens for this email (case-insensitive cleanup)
    await db.passwordResetToken.deleteMany({
      where: { email: { in: [email, normalizedEmail, user.email] } },
    });

    // Generate a secure token
    const token = crypto.randomUUID();
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Create the reset token (use normalized email so reset matches login lookup)
    await db.passwordResetToken.create({
      data: {
        email: normalizedEmail,
        token,
        expires,
      },
    });

    // Send the reset email
    const { sendPasswordResetEmail } = await import("@/lib/email");
    const emailResult = await sendPasswordResetEmail(normalizedEmail, token);

    if (!emailResult.success) {
      authActionsLogger.error({ err: emailResult.error }, "Failed to send password reset email:");
      // Still return success to prevent email enumeration, but log the error
    }

    return { success: true };
  } catch (error) {
    authActionsLogger.error({ err: error }, "Error requesting password reset:");
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
    const hashedPassword = await bcrypt.hash(password, BCRYPT_COST);

    // Find the user case-insensitively and update their password + normalize email
    const targetUser = await db.user.findFirst({
      where: { email: { equals: resetToken.email, mode: "insensitive" }, deletedAt: null },
    });

    if (!targetUser) {
      return { error: { _form: ["Invalid or expired reset link. Please request a new one."] } };
    }

    // Update password, normalize email, delete used token, and invalidate all sessions
    // Session invalidation ensures a compromised account can't be retained after password reset
    await db.$transaction([
      db.user.update({
        where: { id: targetUser.id },
        data: {
          password: hashedPassword,
          email: targetUser.email.toLowerCase(),
        },
      }),
      db.passwordResetToken.delete({ where: { token } }),
      db.session.deleteMany({ where: { userId: targetUser.id } }),
    ]);

    return { success: true };
  } catch (error) {
    authActionsLogger.error({ err: error }, "Error resetting password:");
    return { error: { _form: ["Something went wrong. Please try again."] } };
  }
}
