"use server";

import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { checkBanEvasion, BAN_EVASION_MESSAGE } from "@/lib/moderation/ban-evasion";
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

    // Refuse sign-ups from a banned person coming back for another go.
    //
    // Terms 11a says a ban attaches to the person and that registering again
    // is a breach. Until now nothing enforced it: every writer to IPBlocklist
    // added rows that no code ever read.
    const evasion = await checkBanEvasion(clientIP);
    if (evasion.blocked) {
      authActionsLogger.warn(
        { ip: clientIP, reason: evasion.reason },
        "[Register] Blocked sign-up attempt from banned source"
      );
      return { error: { _form: [BAN_EVASION_MESSAGE] } };
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
      // Deleted accounts keep their email so creators retain backer records,
      // so "already registered" reads as a bug to someone who just closed
      // their account. Tell them what actually happened.
      if (existingUser.accountDeletedAt) {
        return {
          error: {
            email: [
              "This email belonged to a deleted account and can't be reused. Please sign up with a different email.",
            ],
          },
        };
      }
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

    // Create user. Catch P2002 on email @unique specifically so the
    // existingUser check above (TOCTOU under concurrent double-click
    // submissions) gets a targeted "email registered" error instead
    // of a generic "Something went wrong".
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
      const isUniqueViolation =
        createError &&
        typeof createError === "object" &&
        "code" in createError &&
        (createError as { code?: string }).code === "P2002";
      if (isUniqueViolation) {
        return { error: { email: ["Email already registered"] } };
      }
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

  // Verify reCAPTCHA if token provided
  const recaptchaToken = formData.get("recaptchaToken") as string | null;
  const recaptchaResult = await verifyRecaptcha(recaptchaToken, clientIP);
  if (!recaptchaResult.valid) {
    authActionsLogger.info({ data: clientIP }, "[Login] reCAPTCHA failed from IP:");
    return { error: { _form: [recaptchaResult.error || "CAPTCHA verification failed"] } };
  }

  // Find user — explicit select avoids requesting columns that may not exist yet in DB
  // (e.g. failedLoginAttempts before migration is run)
  const user = await db.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, deletedAt: null },
    select: { id: true, password: true, role: true, lockedAt: true, accountDeletedAt: true },
  });

  if (!user || !user.password) {
    // Record failed attempt (even for non-existent users to prevent enumeration timing attacks)
    await recordLoginAttempt(clientIP, email, false);
    return { error: { _form: ["Invalid email or password"] } };
  }

  // Self-deleted accounts stay in the table so creators keep their backer
  // records, but the person can never sign back in. Checked before the
  // password compare so a reset-then-login can't resurrect the account.
  if (user.accountDeletedAt) {
    return {
      error: {
        _form: [
          "This account has been deleted and cannot be used to sign in. Create a new account to continue.",
        ],
      },
    };
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

// How long an emailed reset link stays usable. This was one hour, which is
// tight for a link that goes out through the email queue and then waits for
// someone to check their inbox — any queue lag ate straight into it. A day
// is the common default and the link is still single-use.
// Not exported: this file is "use server", which permits async function
// exports only.
const PASSWORD_RESET_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

// Live tokens kept per address. See the pruning note in requestPasswordReset.
const MAX_LIVE_RESET_TOKENS = 3;

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

    // Always return success to prevent email enumeration. A deleted
    // account is treated the same as a missing one — otherwise a reset
    // would hand back a working password on an account that's meant to
    // be permanently closed.
    if (!user || user.accountDeletedAt) {
      return { success: true };
    }

    // Use the actual user email (normalized to lowercase) for the token
    const normalizedEmail = user.email.toLowerCase();

    // Generate a secure token
    const token = crypto.randomUUID();
    const expires = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS);

    // Create the reset token (use normalized email so reset matches login lookup)
    await db.passwordResetToken.create({
      data: {
        email: normalizedEmail,
        token,
        expires,
      },
    });

    // Requesting a new link used to delete every previous one for this
    // address. That turned the common "I didn't see it, send another"
    // behaviour into a trap: every earlier email in the thread became a
    // dead link, and people reliably click the wrong one out of a stack of
    // identical messages — which read as "your reset links never work".
    //
    // Recent links now stay valid until used or expired. Each is still
    // single-use (the consume step deletes by token), so this doesn't widen
    // the window on any individual link. Older ones beyond the newest few
    // are pruned so a scripted flood can't accumulate live tokens.
    const stale = await db.passwordResetToken.findMany({
      where: { email: { in: [email, normalizedEmail, user.email] } },
      orderBy: { createdAt: "desc" },
      skip: MAX_LIVE_RESET_TOKENS,
      select: { id: true },
    });
    if (stale.length > 0) {
      await db.passwordResetToken.deleteMany({
        where: { id: { in: stale.map((t: { id: string }) => t.id) } },
      });
    }

    authActionsLogger.info(
      { userId: user.id, expiresAt: expires.toISOString(), pruned: stale.length },
      "Password reset token issued"
    );

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

// Why a reset link couldn't be used. The form used to collapse all of
// these — including "the check itself blew up" — into a single "this link
// is invalid or has expired", which sent people off to request another link
// that would fail exactly the same way. The reason lets the UI tell someone
// to retry when retrying might actually work.
export type ResetTokenFailure = "not_found" | "expired" | "error";

export async function verifyResetToken(
  token: string
): Promise<{ valid: boolean; email?: string; reason?: ResetTokenFailure }> {
  try {
    const resetToken = await db.passwordResetToken.findUnique({
      where: { token },
    });

    if (!resetToken) {
      authActionsLogger.info(
        { tokenPrefix: token.slice(0, 8) },
        "Password reset check: token not found (already used, pruned, or never issued)"
      );
      return { valid: false, reason: "not_found" };
    }

    if (resetToken.expires < new Date()) {
      // Token expired, delete it (deleteMany is idempotent on
      // concurrent second calls so we don't P2025).
      await db.passwordResetToken.deleteMany({
        where: { token },
      });
      authActionsLogger.info(
        { tokenPrefix: token.slice(0, 8), expiredAt: resetToken.expires.toISOString() },
        "Password reset check: token expired"
      );
      return { valid: false, reason: "expired" };
    }

    return { valid: true, email: resetToken.email };
  } catch (error) {
    // A DB hiccup is not a bad link. Say so, so the user retries instead of
    // burning another request on a new link that lands in the same state.
    authActionsLogger.error(
      { err: error, tokenPrefix: token.slice(0, 8) },
      "Password reset check failed"
    );
    return { valid: false, reason: "error" };
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
      authActionsLogger.warn(
        {
          tokenPrefix: token.slice(0, 8),
          found: !!resetToken,
          expiredAt: resetToken?.expires?.toISOString(),
        },
        "Password reset rejected: token missing or expired"
      );
      return { error: { _form: ["Invalid or expired reset link. Please request a new one."] } };
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, BCRYPT_COST);

    // Find the user case-insensitively and update their password + normalize email
    const targetUser = await db.user.findFirst({
      where: { email: { equals: resetToken.email, mode: "insensitive" }, deletedAt: null },
    });

    // Also covers a token issued before the user deleted their account —
    // requestPasswordReset refuses to mint new ones, but an in-flight link
    // must not be able to set a working password on a closed account.
    if (!targetUser || targetUser.accountDeletedAt) {
      authActionsLogger.warn(
        {
          tokenEmail: resetToken.email,
          found: !!targetUser,
          accountDeleted: !!targetUser?.accountDeletedAt,
        },
        "Password reset rejected: no live user for the token's email"
      );
      return { error: { _form: ["Invalid or expired reset link. Please request a new one."] } };
    }

    // Atomically consume the token, update the password, and invalidate
    // all sessions. We delete the token FIRST inside an interactive
    // transaction and check the count — only the caller whose deleteMany
    // returns 1 actually wins the race. Without this, two concurrent
    // resetPassword calls with the same token (double-click or refresh)
    // would both pass the findUnique above and both write a password,
    // with last-write-wins nondeterministically picking which one sticks.
    // Session invalidation ensures any compromised session can't be
    // retained after a password reset.
    const consumed = await db.$transaction(async (tx) => {
      const deleted = await tx.passwordResetToken.deleteMany({
        where: { token },
      });
      if (deleted.count === 0) {
        return false;
      }
      await tx.user.update({
        where: { id: targetUser.id },
        data: {
          password: hashedPassword,
          email: targetUser.email.toLowerCase(),
        },
      });
      await tx.session.deleteMany({ where: { userId: targetUser.id } });
      return true;
    });

    if (!consumed) {
      // Lost the race to consume the token — almost always a double-submit,
      // where the first request already set the password.
      authActionsLogger.info(
        { userId: targetUser.id, tokenPrefix: token.slice(0, 8) },
        "Password reset token already consumed by a concurrent request"
      );
      return { error: { _form: ["Invalid or expired reset link. Please request a new one."] } };
    }

    authActionsLogger.info({ userId: targetUser.id }, "Password reset completed");
    return { success: true };
  } catch (error) {
    authActionsLogger.error({ err: error }, "Error resetting password:");
    return { error: { _form: ["Something went wrong. Please try again."] } };
  }
}
