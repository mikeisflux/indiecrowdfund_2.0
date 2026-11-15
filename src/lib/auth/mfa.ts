import { cookies, headers } from "next/headers";
import { db } from "@/lib/db";
import { encryptCredential, decryptCredential } from "@/lib/encryption";
import { logger } from "@/lib/logger";
import { formatError } from "@/lib/errors";
import {
  generateTotpSecret,
  verifyTotp,
  otpauthUrl,
  generateBackupCodes,
  consumeBackupCode,
} from "./totp";

const log = logger.child({ module: "auth-mfa" });

export const MFA_COOKIE = "mfa_challenge";
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const MAX_CHALLENGE_ATTEMPTS = 5;
const ISSUER = process.env.NEXT_PUBLIC_APP_NAME || "IndieCrowdfund";

export type AdminRole = "ADMIN" | "SUPER_ADMIN";
export function isAdminRole(role: string | null | undefined): role is AdminRole {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

/** Settings → Security → "Require two-factor for admins". */
export async function adminMfaRequired(): Promise<boolean> {
  const s = await db.platformSettings.findUnique({ where: { id: "default" }, select: { twoFactorRequired: true } }).catch(() => null);
  return !!s?.twoFactorRequired;
}

/** True when this admin must enroll before using the admin area. */
export async function mfaSetupRequiredFor(user: { role: string; totpEnabledAt: Date | null }): Promise<boolean> {
  if (!isAdminRole(user.role)) return false;
  if (user.totpEnabledAt) return false;
  return adminMfaRequired();
}

export async function getMfaState(userId: string) {
  const u = await db.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { role: true, totpEnabledAt: true, totpBackupCodes: true, totpPendingSecretEncrypted: true },
  });
  if (!u) return null;
  return {
    enabled: !!u.totpEnabledAt,
    enabledAt: u.totpEnabledAt,
    backupCodesLeft: u.totpBackupCodes.length,
    pending: !!u.totpPendingSecretEncrypted,
    required: await mfaSetupRequiredFor(u),
    isAdmin: isAdminRole(u.role),
  };
}

/** Step 1 of enrollment: a new pending secret and the URL the app scans. */
export async function beginMfaEnrollment(userId: string, email: string) {
  const secret = generateTotpSecret();
  await db.user.update({ where: { id: userId }, data: { totpPendingSecretEncrypted: encryptCredential(secret) } });
  return { secret, url: otpauthUrl(ISSUER, email, secret) };
}

/** Step 2: the first code from the app proves the secret was captured. */
export async function confirmMfaEnrollment(userId: string, code: string): Promise<{ ok: true; backupCodes: string[] } | { ok: false; error: string }> {
  const u = await db.user.findUnique({ where: { id: userId }, select: { totpPendingSecretEncrypted: true } });
  if (!u?.totpPendingSecretEncrypted) return { ok: false, error: "No enrollment in progress. Start again." };
  const secret = decryptCredential(u.totpPendingSecretEncrypted);
  const v = verifyTotp(secret, code);
  if (!v.ok) return { ok: false, error: "That code didn't match. Check the time on your phone and try the next code." };
  const { plain, hashed } = generateBackupCodes();
  await db.user.update({
    where: { id: userId },
    data: {
      totpSecretEncrypted: u.totpPendingSecretEncrypted,
      totpPendingSecretEncrypted: null,
      totpEnabledAt: new Date(),
      totpLastUsedStep: v.step,
      totpBackupCodes: hashed,
    },
  });
  log.info({ userId }, "MFA enabled");
  return { ok: true, backupCodes: plain };
}

export async function regenerateBackupCodes(userId: string, code: string): Promise<{ ok: true; backupCodes: string[] } | { ok: false; error: string }> {
  const check = await verifyUserCode(userId, code, { allowBackup: false });
  if (!check.ok) return { ok: false, error: check.error };
  const { plain, hashed } = generateBackupCodes();
  await db.user.update({ where: { id: userId }, data: { totpBackupCodes: hashed } });
  return { ok: true, backupCodes: plain };
}

export async function disableMfa(userId: string, code: string): Promise<{ ok: boolean; error?: string }> {
  const check = await verifyUserCode(userId, code, { allowBackup: true });
  if (!check.ok) return { ok: false, error: check.error };
  await db.user.update({
    where: { id: userId },
    data: { totpSecretEncrypted: null, totpPendingSecretEncrypted: null, totpEnabledAt: null, totpLastUsedStep: null, totpBackupCodes: [] },
  });
  log.info({ userId }, "MFA disabled");
  return { ok: true };
}

/**
 * Check a TOTP or backup code for a user. A TOTP step is accepted once: the
 * same code replayed inside its window is refused. A backup code is
 * consumed.
 */
export async function verifyUserCode(
  userId: string,
  code: string,
  opts: { allowBackup: boolean }
): Promise<{ ok: true; method: "totp" | "backup" } | { ok: false; error: string }> {
  const u = await db.user.findUnique({
    where: { id: userId },
    select: { totpSecretEncrypted: true, totpLastUsedStep: true, totpBackupCodes: true },
  });
  if (!u?.totpSecretEncrypted) return { ok: false, error: "Two-factor authentication is not enabled on this account." };
  const clean = code.trim();

  if (/^\d{6}$/.test(clean.replace(/\s+/g, ""))) {
    const secret = decryptCredential(u.totpSecretEncrypted);
    const v = verifyTotp(secret, clean);
    if (v.ok) {
      if (u.totpLastUsedStep !== null && v.step <= u.totpLastUsedStep) {
        return { ok: false, error: "That code was already used. Wait for the next one." };
      }
      await db.user.update({ where: { id: userId }, data: { totpLastUsedStep: v.step } });
      return { ok: true, method: "totp" };
    }
  }

  if (opts.allowBackup) {
    const remaining = consumeBackupCode(clean, u.totpBackupCodes);
    if (remaining) {
      await db.user.update({ where: { id: userId }, data: { totpBackupCodes: remaining } });
      log.warn({ userId, left: remaining.length }, "MFA backup code used");
      return { ok: true, method: "backup" };
    }
  }
  return { ok: false, error: "Invalid code." };
}

// ── Sign-in challenge ────────────────────────────────────────────────────

/** After the password checks out: park the sign-in until a code arrives. */
export async function createMfaChallenge(userId: string): Promise<void> {
  await db.mfaChallenge.deleteMany({ where: { OR: [{ userId }, { expiresAt: { lt: new Date() } }] } });
  const challenge = await db.mfaChallenge.create({ data: { userId, expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS) } });
  const cookieStore = await cookies();
  cookieStore.set(MFA_COOKIE, challenge.id, {
    httpOnly: true,
    secure: process.env.SECURE_COOKIES !== "false" && process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: CHALLENGE_TTL_MS / 1000,
    path: "/",
  });
}

export async function resolveMfaChallenge(code: string): Promise<{ ok: true; userId: string; method: "totp" | "backup" } | { ok: false; error: string; expired?: boolean }> {
  const cookieStore = await cookies();
  const id = cookieStore.get(MFA_COOKIE)?.value;
  if (!id) return { ok: false, error: "Your sign-in timed out. Enter your password again.", expired: true };
  const challenge = await db.mfaChallenge.findUnique({ where: { id } });
  if (!challenge || challenge.expiresAt < new Date()) {
    cookieStore.delete(MFA_COOKIE);
    return { ok: false, error: "Your sign-in timed out. Enter your password again.", expired: true };
  }
  if (challenge.attempts >= MAX_CHALLENGE_ATTEMPTS) {
    await db.mfaChallenge.delete({ where: { id } }).catch(() => {});
    cookieStore.delete(MFA_COOKIE);
    return { ok: false, error: "Too many incorrect codes. Enter your password again.", expired: true };
  }
  const v = await verifyUserCode(challenge.userId, code, { allowBackup: true });
  if (!v.ok) {
    await db.mfaChallenge.update({ where: { id }, data: { attempts: { increment: 1 } } }).catch(() => {});
    return { ok: false, error: v.error };
  }
  await db.mfaChallenge.delete({ where: { id } }).catch(() => {});
  cookieStore.delete(MFA_COOKIE);
  return { ok: true, userId: challenge.userId, method: v.method };
}

// ── Sign-in events ───────────────────────────────────────────────────────

export async function requestOrigin(): Promise<{ ip: string | null; userAgent: string | null }> {
  try {
    const h = await headers();
    const xff = h.get("x-forwarded-for");
    const ip = (xff ? xff.split(",")[0].trim() : null) || h.get("x-real-ip") || null;
    return { ip, userAgent: h.get("user-agent")?.slice(0, 512) || null };
  } catch {
    return { ip: null, userAgent: null };
  }
}

export async function recordLoginEvent(input: { userId: string | null; email: string; success: boolean; reason?: string }): Promise<void> {
  const origin = await requestOrigin();
  await db.loginEvent
    .create({ data: { userId: input.userId, email: input.email.toLowerCase(), ip: origin.ip, userAgent: origin.userAgent, success: input.success, reason: input.reason ?? null } })
    .catch((err: unknown) => log.warn({ err: formatError(err) }, "login event write failed"));
}

/**
 * An admin signing in from an address that has never signed in to that
 * account before gets an email about it. "Evidence of authentication from
 * previously unseen infrastructure" is the first thing the FBI asks for.
 */
export async function alertAdminNewLocation(user: { id: string; email: string; name: string | null; role: string }): Promise<void> {
  if (!isAdminRole(user.role)) return;
  const origin = await requestOrigin();
  if (!origin.ip) return;
  const seen = await db.loginEvent.findFirst({
    where: { userId: user.id, success: true, ip: origin.ip, createdAt: { lt: new Date(Date.now() - 60 * 1000) } },
    select: { id: true },
  });
  if (seen) return;
  const priorLogins = await db.loginEvent.count({ where: { userId: user.id, success: true } });
  if (priorLogins <= 1) return; // first ever sign-in: nothing to compare against
  try {
    const { sendEmail } = await import("@/lib/email/email-config");
    await sendEmail({
      to: user.email,
      subject: `New sign-in to your ${ISSUER} admin account`,
      html: `<p>Hi ${user.name || ""},</p><p>Your admin account just signed in from an address it hasn't used before.</p><p><strong>IP:</strong> ${origin.ip}<br><strong>Browser:</strong> ${origin.userAgent || "unknown"}<br><strong>When:</strong> ${new Date().toUTCString()}</p><p>If this was you, no action is needed. If it wasn't, change your password now and sign out everywhere from Settings; then tell the other admins.</p>`,
      skipUnsubscribeCheck: true,
    });
  } catch (err) {
    log.warn({ err: formatError(err), userId: user.id }, "new-location alert failed");
  }
}
