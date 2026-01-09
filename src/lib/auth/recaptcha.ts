/**
 * reCAPTCHA v2 verification utilities
 *
 * reCAPTCHA can be configured in two ways:
 * 1. Database (Admin Panel > API Keys) - Preferred method
 * 2. Environment variables (fallback):
 *    - NEXT_PUBLIC_RECAPTCHA_SITE_KEY: Your reCAPTCHA site key (for frontend)
 *    - RECAPTCHA_SECRET_KEY: Your reCAPTCHA secret key (for server verification)
 *
 * Get keys from: https://www.google.com/recaptcha/admin
 */

import { db } from "@/lib/db";

const RECAPTCHA_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";

// Cache for settings to avoid hitting DB on every request
let settingsCache: {
  enabled: boolean;
  siteKey: string | null;
  secretKey: string | null;
  lastFetch: number;
} | null = null;

const CACHE_TTL = 60 * 1000; // 1 minute cache

export interface RecaptchaVerifyResult {
  success: boolean;
  score?: number;
  action?: string;
  challenge_ts?: string;
  hostname?: string;
  "error-codes"?: string[];
}

/**
 * Get reCAPTCHA settings from database (with caching) or fall back to env vars
 */
async function getRecaptchaSettings(): Promise<{
  enabled: boolean;
  siteKey: string | null;
  secretKey: string | null;
}> {
  // Check cache first
  if (settingsCache && Date.now() - settingsCache.lastFetch < CACHE_TTL) {
    return settingsCache;
  }

  try {
    const settings = await db.platformSettings.findUnique({
      where: { id: "default" },
      select: {
        recaptchaEnabled: true,
        recaptchaSiteKey: true,
        recaptchaSecretKey: true,
      },
    });

    if (settings && settings.recaptchaEnabled && settings.recaptchaSiteKey && settings.recaptchaSecretKey) {
      settingsCache = {
        enabled: true,
        siteKey: settings.recaptchaSiteKey,
        secretKey: settings.recaptchaSecretKey,
        lastFetch: Date.now(),
      };
      return settingsCache;
    }
  } catch (error) {
    console.warn("[reCAPTCHA] Error fetching settings from DB:", error);
  }

  // Fall back to environment variables
  const envSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  const envSecretKey = process.env.RECAPTCHA_SECRET_KEY;
  const envEnabled = !!(envSiteKey && envSecretKey);

  settingsCache = {
    enabled: envEnabled,
    siteKey: envSiteKey || null,
    secretKey: envSecretKey || null,
    lastFetch: Date.now(),
  };

  return settingsCache;
}

/**
 * Clear the settings cache (call when settings are updated)
 */
export function clearRecaptchaCache(): void {
  settingsCache = null;
}

/**
 * Check if reCAPTCHA is enabled (keys are configured)
 * Note: This is synchronous and uses env vars for client-side
 */
export function isRecaptchaEnabled(): boolean {
  // For client-side, we can only check env vars (synchronous)
  return !!(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY);
}

/**
 * Get the reCAPTCHA site key for the frontend
 * Note: This is synchronous and uses env vars for client-side
 */
export function getRecaptchaSiteKey(): string | null {
  return process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || null;
}

/**
 * Verify a reCAPTCHA token on the server
 * Returns true if valid, false if invalid or reCAPTCHA is not configured
 */
export async function verifyRecaptcha(
  token: string | null,
  clientIP?: string | null
): Promise<{ valid: boolean; error?: string }> {
  // Get settings from database (with fallback to env vars)
  const settings = await getRecaptchaSettings();

  // If reCAPTCHA is not configured/enabled, skip verification
  if (!settings.enabled) {
    return { valid: true };
  }

  // Token is required when reCAPTCHA is enabled
  if (!token) {
    return { valid: false, error: "Please complete the CAPTCHA" };
  }

  const secretKey = settings.secretKey;
  if (!secretKey) {
    // This shouldn't happen if enabled is true, but be safe
    console.warn("[reCAPTCHA] Secret key missing");
    return { valid: true };
  }

  try {
    const formData = new URLSearchParams();
    formData.append("secret", secretKey);
    formData.append("response", token);
    if (clientIP) {
      formData.append("remoteip", clientIP);
    }

    const response = await fetch(RECAPTCHA_VERIFY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      console.error("[reCAPTCHA] Verification request failed:", response.status);
      // Fail open - don't block users if Google's API is down
      return { valid: true };
    }

    const result: RecaptchaVerifyResult = await response.json();

    if (result.success) {
      return { valid: true };
    }

    // Log error codes for debugging
    if (result["error-codes"]) {
      console.log("[reCAPTCHA] Verification failed:", result["error-codes"]);
    }

    return {
      valid: false,
      error: "CAPTCHA verification failed. Please try again."
    };
  } catch (error) {
    console.error("[reCAPTCHA] Verification error:", error);
    // Fail open - don't block users if there's an error
    return { valid: true };
  }
}
