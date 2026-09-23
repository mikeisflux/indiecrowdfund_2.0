import { db } from "@/lib/db";

/**
 * Admin-configured password policy (Settings > Security), enforced at
 * the three places a password is SET: registration, password reset,
 * and account password change. Login is never policy-checked — an old
 * password that predates a stricter policy must still sign in.
 *
 * These two settings sat in the admin UI for months backed by columns
 * nothing read; every password was accepted at a hardcoded 8 chars.
 */

interface PasswordPolicy {
  minLength: number;
  requireSpecialChars: boolean;
}

const DEFAULTS: PasswordPolicy = { minLength: 8, requireSpecialChars: true };

let cached: { value: PasswordPolicy; at: number } | null = null;
const TTL_MS = 60 * 1000;

export async function getPasswordPolicy(): Promise<PasswordPolicy> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
  try {
    const settings = await db.platformSettings.findFirst({
      select: { passwordMinLength: true, requireSpecialChars: true },
    });
    const value: PasswordPolicy = {
      // Floor of 8 no matter what's stored — an admin typo must not
      // open the door to 1-character passwords.
      minLength: Math.max(8, settings?.passwordMinLength ?? DEFAULTS.minLength),
      requireSpecialChars: settings?.requireSpecialChars ?? DEFAULTS.requireSpecialChars,
    };
    cached = { value, at: Date.now() };
    return value;
  } catch {
    return DEFAULTS;
  }
}

const SPECIAL_CHAR_RE = /[^a-zA-Z0-9]/;

/** Human-readable violation, or null when the password passes. */
export async function checkPasswordPolicy(password: string): Promise<string | null> {
  const policy = await getPasswordPolicy();
  if (password.length < policy.minLength) {
    return `Password must be at least ${policy.minLength} characters`;
  }
  if (policy.requireSpecialChars && !SPECIAL_CHAR_RE.test(password)) {
    return "Password must include at least one special character (e.g. ! @ # $ %)";
  }
  return null;
}
