/**
 * reCAPTCHA v2 verification utilities
 *
 * To enable reCAPTCHA, set these environment variables:
 * - NEXT_PUBLIC_RECAPTCHA_SITE_KEY: Your reCAPTCHA site key (for frontend)
 * - RECAPTCHA_SECRET_KEY: Your reCAPTCHA secret key (for server verification)
 *
 * Get keys from: https://www.google.com/recaptcha/admin
 */

const RECAPTCHA_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";

export interface RecaptchaVerifyResult {
  success: boolean;
  score?: number;
  action?: string;
  challenge_ts?: string;
  hostname?: string;
  "error-codes"?: string[];
}

/**
 * Check if reCAPTCHA is enabled (keys are configured)
 */
export function isRecaptchaEnabled(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY &&
    process.env.RECAPTCHA_SECRET_KEY
  );
}

/**
 * Get the reCAPTCHA site key for the frontend
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
  // If reCAPTCHA is not configured, skip verification
  if (!isRecaptchaEnabled()) {
    return { valid: true };
  }

  // Token is required when reCAPTCHA is enabled
  if (!token) {
    return { valid: false, error: "Please complete the CAPTCHA" };
  }

  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  if (!secretKey) {
    // This shouldn't happen if isRecaptchaEnabled returned true, but be safe
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
