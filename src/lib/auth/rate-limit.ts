/**
 * Rate limiting for brute force protection
 * Uses Redis (via @/lib/rate-limiter) when available for multi-instance scaling,
 * falls back to in-memory storage with sliding window algorithm.
 * Reads configuration from database with caching.
 */

import { db } from "@/lib/db";
import { rateLimiter as redisRateLimiter } from "@/lib/rate-limiter";
import { logger } from "@/lib/logger";
import { metrics } from "@/lib/metrics";

const rateLimitLogger = logger.child({ module: "rate-limit" });

interface RateLimitEntry {
  attempts: number;
  firstAttempt: number;
  lastAttempt: number;
  lockedUntil?: number;
}

interface RateLimitConfig {
  maxAttempts: number;       // Max attempts before lockout
  windowMs: number;          // Time window in milliseconds
  lockoutMs: number;         // Lockout duration in milliseconds
  blockAfterLockouts?: number; // Number of lockouts before extended block
  extendedBlockMs?: number;  // Extended block duration
}

// In-memory stores for rate limiting
const ipAttempts = new Map<string, RateLimitEntry>();
const accountAttempts = new Map<string, RateLimitEntry>();
const lockoutCounts = new Map<string, { count: number; lastLockout: number }>();
const registrationAttempts = new Map<string, RateLimitEntry>();

// Cached settings from database
let cachedSettings: {
  globalRateLimitEnabled: boolean;
  globalRateLimitRequests: number;
  globalRateLimitWindow: number;
  loginRateLimitEnabled: boolean;
  loginRateLimitRequests: number;
  loginRateLimitWindow: number;
  passwordResetRateLimitRequests: number;
  passwordResetRateLimitWindow: number;
  maxLoginAttempts: number;
} | null = null;
let settingsCacheTime = 0;
const SETTINGS_CACHE_TTL = 60 * 1000; // 1 minute cache

// Load settings from database with caching
async function getSettings() {
  const now = Date.now();
  if (cachedSettings && now - settingsCacheTime < SETTINGS_CACHE_TTL) {
    return cachedSettings;
  }

  try {
    const settings = await db.platformSettings.findUnique({
      where: { id: "default" },
      select: {
        globalRateLimitEnabled: true,
        globalRateLimitRequests: true,
        globalRateLimitWindow: true,
        loginRateLimitEnabled: true,
        loginRateLimitRequests: true,
        loginRateLimitWindow: true,
        passwordResetRateLimitRequests: true,
        passwordResetRateLimitWindow: true,
        maxLoginAttempts: true,
      },
    });

    if (settings) {
      cachedSettings = settings;
      settingsCacheTime = now;
      return settings;
    }
  } catch (error) {
    rateLimitLogger.error({ err: error instanceof Error ? error.message : String(error) },
      "Error loading rate limit settings");
  }

  // Return defaults if database query fails
  return {
    globalRateLimitEnabled: true,
    globalRateLimitRequests: 100,
    globalRateLimitWindow: 60,
    loginRateLimitEnabled: true,
    loginRateLimitRequests: 5,
    loginRateLimitWindow: 300,
    passwordResetRateLimitRequests: 3,
    passwordResetRateLimitWindow: 900,
    maxLoginAttempts: 5,
  };
}

// Clear the settings cache (call this when settings are updated)
export function clearRateLimitSettingsCache() {
  cachedSettings = null;
  settingsCacheTime = 0;
}

// Get dynamic configurations based on database settings
async function getLoginConfig(): Promise<RateLimitConfig> {
  const settings = await getSettings();
  return {
    maxAttempts: settings.loginRateLimitRequests,
    windowMs: settings.loginRateLimitWindow * 1000,
    lockoutMs: settings.loginRateLimitWindow * 1000,
    blockAfterLockouts: 3,
    extendedBlockMs: 60 * 60 * 1000, // 1 hour extended block
  };
}

async function getPasswordResetConfig(): Promise<RateLimitConfig> {
  const settings = await getSettings();
  return {
    maxAttempts: settings.passwordResetRateLimitRequests,
    windowMs: settings.passwordResetRateLimitWindow * 1000,
    lockoutMs: settings.passwordResetRateLimitWindow * 1000,
  };
}

async function getIpConfig(): Promise<RateLimitConfig> {
  const settings = await getSettings();
  return {
    maxAttempts: settings.globalRateLimitRequests,
    windowMs: settings.globalRateLimitWindow * 1000,
    lockoutMs: settings.globalRateLimitWindow * 2 * 1000, // Double the window for lockout
  };
}

// Default configurations (used as fallback)
const LOGIN_CONFIG: RateLimitConfig = {
  maxAttempts: 5,              // 5 failed attempts
  windowMs: 5 * 60 * 1000,     // within 5 minutes (300 seconds)
  lockoutMs: 5 * 60 * 1000,    // lockout for 5 minutes
  blockAfterLockouts: 3,       // after 3 lockouts
  extendedBlockMs: 60 * 60 * 1000, // block for 1 hour
};

const PASSWORD_RESET_CONFIG: RateLimitConfig = {
  maxAttempts: 3,              // 3 reset requests
  windowMs: 15 * 60 * 1000,    // within 15 minutes (900 seconds)
  lockoutMs: 15 * 60 * 1000,   // lockout for 15 minutes
};

const IP_CONFIG: RateLimitConfig = {
  maxAttempts: 100,            // 100 total attempts from one IP
  windowMs: 60 * 1000,         // within 1 minute (60 seconds)
  lockoutMs: 2 * 60 * 1000,    // lockout for 2 minutes
};

// Cleanup old entries periodically (every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;

  lastCleanup = now;
  const maxAge = 2 * 60 * 60 * 1000; // 2 hours

  // Clean up IP attempts
  ipAttempts.forEach((entry, key) => {
    if (now - entry.lastAttempt > maxAge && (!entry.lockedUntil || now > entry.lockedUntil)) {
      ipAttempts.delete(key);
    }
  });

  // Clean up account attempts
  accountAttempts.forEach((entry, key) => {
    if (now - entry.lastAttempt > maxAge && (!entry.lockedUntil || now > entry.lockedUntil)) {
      accountAttempts.delete(key);
    }
  });

  // Clean up lockout counts
  lockoutCounts.forEach((data, key) => {
    if (now - data.lastLockout > 24 * 60 * 60 * 1000) { // 24 hours
      lockoutCounts.delete(key);
    }
  });
}

function checkRateLimit(
  store: Map<string, RateLimitEntry>,
  key: string,
  config: RateLimitConfig
): { allowed: boolean; remainingAttempts: number; retryAfter?: number } {
  cleanup();

  const now = Date.now();
  const entry = store.get(key);

  if (!entry) {
    return { allowed: true, remainingAttempts: config.maxAttempts };
  }

  // Check if currently locked out
  if (entry.lockedUntil && now < entry.lockedUntil) {
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfter: Math.ceil((entry.lockedUntil - now) / 1000),
    };
  }

  // Check if window has expired
  if (now - entry.firstAttempt > config.windowMs) {
    // Reset the window
    store.set(key, {
      attempts: 0,
      firstAttempt: now,
      lastAttempt: now,
    });
    return { allowed: true, remainingAttempts: config.maxAttempts };
  }

  // Check attempts within window
  const remaining = config.maxAttempts - entry.attempts;
  return {
    allowed: remaining > 0,
    remainingAttempts: Math.max(0, remaining),
    retryAfter: remaining <= 0 ? Math.ceil((entry.firstAttempt + config.windowMs - now) / 1000) : undefined,
  };
}

function recordAttempt(
  store: Map<string, RateLimitEntry>,
  key: string,
  config: RateLimitConfig,
  success: boolean
): void {
  const now = Date.now();
  const entry = store.get(key);

  if (success) {
    // On successful login, clear the entry
    store.delete(key);
    return;
  }

  if (!entry || now - entry.firstAttempt > config.windowMs) {
    // Start new window
    store.set(key, {
      attempts: 1,
      firstAttempt: now,
      lastAttempt: now,
    });
    return;
  }

  // Increment attempts
  entry.attempts++;
  entry.lastAttempt = now;

  // Check if we need to lock out
  if (entry.attempts >= config.maxAttempts) {
    // Check for extended lockout
    let lockoutDuration = config.lockoutMs;

    if (config.blockAfterLockouts && config.extendedBlockMs) {
      const lockoutData = lockoutCounts.get(key) || { count: 0, lastLockout: 0 };
      lockoutData.count++;
      lockoutData.lastLockout = now;
      lockoutCounts.set(key, lockoutData);

      if (lockoutData.count >= config.blockAfterLockouts) {
        lockoutDuration = config.extendedBlockMs;
      }
    }

    entry.lockedUntil = now + lockoutDuration;
  }

  store.set(key, entry);
}

export interface RateLimitResult {
  allowed: boolean;
  remainingAttempts: number;
  retryAfter?: number; // seconds until retry is allowed
  message?: string;
}

/**
 * Check if a login attempt is allowed based on IP and account.
 * Tries Redis first for multi-instance consistency, falls back to in-memory.
 */
export async function checkLoginRateLimit(
  ip: string | null,
  email: string
): Promise<RateLimitResult> {
  const normalizedEmail = email.toLowerCase().trim();
  const settings = await getSettings();

  // Check if login rate limiting is enabled
  if (!settings.loginRateLimitEnabled) {
    return { allowed: true, remainingAttempts: 999 };
  }

  const loginConfig = await getLoginConfig();
  const ipConfig = await getIpConfig();

  // Check IP-based rate limit (try Redis first)
  if (ip && settings.globalRateLimitEnabled) {
    const redisIpResult = await redisRateLimiter.check("login-ip", ip, {
      limit: ipConfig.maxAttempts,
      windowSec: Math.ceil(ipConfig.windowMs / 1000),
    });
    if (!redisIpResult.allowed) {
      const retryAfter = Math.max(0, redisIpResult.resetAt - Math.floor(Date.now() / 1000));
      metrics.rateLimitHits.inc({ type: "login_ip" });
      return {
        allowed: false,
        remainingAttempts: 0,
        retryAfter,
        message: `Too many login attempts from this IP. Please try again in ${formatRetryTime(retryAfter)}.`,
      };
    }
  }

  // Check account-based rate limit (try Redis first)
  const redisAccountResult = await redisRateLimiter.check("login-account", normalizedEmail, {
    limit: loginConfig.maxAttempts,
    windowSec: Math.ceil(loginConfig.windowMs / 1000),
  });
  if (!redisAccountResult.allowed) {
    const retryAfter = Math.max(0, redisAccountResult.resetAt - Math.floor(Date.now() / 1000));
    metrics.rateLimitHits.inc({ type: "login_account" });
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfter,
      message: `Too many failed login attempts. Please try again in ${formatRetryTime(retryAfter)}.`,
    };
  }

  return {
    allowed: true,
    remainingAttempts: Math.min(
      ip && settings.globalRateLimitEnabled ? redisAccountResult.remaining : loginConfig.maxAttempts,
      redisAccountResult.remaining
    ),
  };
}

/**
 * Record a login attempt (success or failure)
 */
export async function recordLoginAttempt(
  ip: string | null,
  email: string,
  success: boolean
): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();
  const loginConfig = await getLoginConfig();
  const ipConfig = await getIpConfig();

  if (ip) {
    recordAttempt(ipAttempts, ip, ipConfig, success);
  }

  recordAttempt(accountAttempts, normalizedEmail, loginConfig, success);
}

/**
 * Check if password reset request is allowed.
 * Tries Redis first for multi-instance consistency, falls back to in-memory.
 */
export async function checkPasswordResetRateLimit(
  ip: string | null,
  email: string
): Promise<RateLimitResult> {
  const normalizedEmail = email.toLowerCase().trim();
  const passwordResetConfig = await getPasswordResetConfig();
  const windowSec = Math.ceil(passwordResetConfig.windowMs / 1000);

  // Check IP-based rate limit for reset requests (via Redis)
  if (ip) {
    const ipResult = await redisRateLimiter.check("password-reset-ip", ip, {
      limit: passwordResetConfig.maxAttempts,
      windowSec,
    });
    if (!ipResult.allowed) {
      const retryAfter = Math.max(0, ipResult.resetAt - Math.floor(Date.now() / 1000));
      return {
        allowed: false,
        remainingAttempts: 0,
        retryAfter,
        message: `Too many password reset requests. Please try again in ${formatRetryTime(retryAfter)}.`,
      };
    }
  }

  // Check account-based rate limit (via Redis)
  const accountResult = await redisRateLimiter.check("password-reset-account", normalizedEmail, {
    limit: passwordResetConfig.maxAttempts,
    windowSec,
  });
  if (!accountResult.allowed) {
    const retryAfter = Math.max(0, accountResult.resetAt - Math.floor(Date.now() / 1000));
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfter,
      message: `Too many password reset requests for this email. Please try again in ${formatRetryTime(retryAfter)}.`,
    };
  }

  return {
    allowed: true,
    remainingAttempts: accountResult.remaining,
  };
}

/**
 * Record a password reset request
 */
export async function recordPasswordResetAttempt(
  ip: string | null,
  email: string
): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();
  const key = `reset:${normalizedEmail}`;
  const passwordResetConfig = await getPasswordResetConfig();

  if (ip) {
    const ipKey = `reset:${ip}`;
    recordAttempt(ipAttempts, ipKey, passwordResetConfig, false);
  }

  recordAttempt(accountAttempts, key, passwordResetConfig, false);
}

/**
 * Check retailer login rate limit (uses same logic but separate tracking).
 * Tries Redis first for multi-instance consistency, falls back to in-memory.
 */
export async function checkRetailerLoginRateLimit(
  ip: string | null,
  identifier: string // email or access code
): Promise<RateLimitResult> {
  const normalizedId = identifier.toLowerCase().trim();
  const settings = await getSettings();

  // Check if login rate limiting is enabled
  if (!settings.loginRateLimitEnabled) {
    return { allowed: true, remainingAttempts: 999 };
  }

  const loginConfig = await getLoginConfig();
  const ipConfig = await getIpConfig();

  // Check IP-based rate limit (via Redis)
  if (ip && settings.globalRateLimitEnabled) {
    const ipResult = await redisRateLimiter.check("retailer-login-ip", ip, {
      limit: ipConfig.maxAttempts,
      windowSec: Math.ceil(ipConfig.windowMs / 1000),
    });
    if (!ipResult.allowed) {
      const retryAfter = Math.max(0, ipResult.resetAt - Math.floor(Date.now() / 1000));
      return {
        allowed: false,
        remainingAttempts: 0,
        retryAfter,
        message: `Too many login attempts from this IP. Please try again in ${formatRetryTime(retryAfter)}.`,
      };
    }
  }

  // Check account-based rate limit (via Redis)
  const accountResult = await redisRateLimiter.check("retailer-login-account", normalizedId, {
    limit: loginConfig.maxAttempts,
    windowSec: Math.ceil(loginConfig.windowMs / 1000),
  });
  if (!accountResult.allowed) {
    const retryAfter = Math.max(0, accountResult.resetAt - Math.floor(Date.now() / 1000));
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfter,
      message: `Too many failed login attempts. Please try again in ${formatRetryTime(retryAfter)}.`,
    };
  }

  return {
    allowed: true,
    remainingAttempts: accountResult.remaining,
  };
}

/**
 * Record retailer login attempt
 */
export async function recordRetailerLoginAttempt(
  ip: string | null,
  identifier: string,
  success: boolean
): Promise<void> {
  const key = `retailer:${identifier.toLowerCase().trim()}`;
  const loginConfig = await getLoginConfig();
  const ipConfig = await getIpConfig();

  if (ip) {
    const ipKey = `retailer:${ip}`;
    recordAttempt(ipAttempts, ipKey, ipConfig, success);
  }

  recordAttempt(accountAttempts, key, loginConfig, success);
}

/**
 * Format retry time for user-friendly display
 */
function formatRetryTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} seconds`;
  } else if (seconds < 3600) {
    const minutes = Math.ceil(seconds / 60);
    return `${minutes} minute${minutes > 1 ? "s" : ""}`;
  } else {
    const hours = Math.ceil(seconds / 3600);
    return `${hours} hour${hours > 1 ? "s" : ""}`;
  }
}

/**
 * Get remaining lockout time for an account (for display purposes)
 */
export async function getAccountLockoutInfo(email: string): Promise<{
  isLocked: boolean;
  retryAfter?: number;
  attemptsRemaining?: number;
}> {
  const normalizedEmail = email.toLowerCase().trim();
  const entry = accountAttempts.get(normalizedEmail);
  const loginConfig = await getLoginConfig();

  if (!entry) {
    return { isLocked: false, attemptsRemaining: loginConfig.maxAttempts };
  }

  const now = Date.now();

  if (entry.lockedUntil && now < entry.lockedUntil) {
    return {
      isLocked: true,
      retryAfter: Math.ceil((entry.lockedUntil - now) / 1000),
    };
  }

  // Check if window has expired
  if (now - entry.firstAttempt > loginConfig.windowMs) {
    return { isLocked: false, attemptsRemaining: loginConfig.maxAttempts };
  }

  return {
    isLocked: false,
    attemptsRemaining: Math.max(0, loginConfig.maxAttempts - entry.attempts),
  };
}

// =====================
// REGISTRATION BOT PROTECTION
// =====================

const REGISTRATION_CONFIG: RateLimitConfig = {
  maxAttempts: 5,              // 5 registrations
  windowMs: 60 * 60 * 1000,    // within 1 hour
  lockoutMs: 60 * 60 * 1000,   // lockout for 1 hour
};

/**
 * Check if a registration attempt is allowed based on IP.
 * Tries Redis first for multi-instance consistency, falls back to in-memory.
 */
export async function checkRegistrationRateLimit(
  ip: string | null
): Promise<RateLimitResult> {
  if (!ip) {
    return { allowed: true, remainingAttempts: REGISTRATION_CONFIG.maxAttempts };
  }

  const result = await redisRateLimiter.check("registration", ip, {
    limit: REGISTRATION_CONFIG.maxAttempts,
    windowSec: Math.ceil(REGISTRATION_CONFIG.windowMs / 1000),
  });

  if (!result.allowed) {
    const retryAfter = Math.max(0, result.resetAt - Math.floor(Date.now() / 1000));
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfter,
      message: `Too many registration attempts. Please try again in ${formatRetryTime(retryAfter)}.`,
    };
  }

  return {
    allowed: true,
    remainingAttempts: result.remaining,
  };
}

/**
 * Record a registration attempt
 */
export async function recordRegistrationAttempt(ip: string | null): Promise<void> {
  if (!ip) return;

  const key = `register:${ip}`;
  recordAttempt(registrationAttempts, key, REGISTRATION_CONFIG, false);
}

/**
 * Calculate Shannon entropy of a string (measures randomness)
 * High entropy = more random/gibberish
 */
function calculateEntropy(str: string): number {
  if (!str || str.length === 0) return 0;

  const len = str.length;
  const frequencies: Record<string, number> = {};

  for (const char of str.toLowerCase()) {
    frequencies[char] = (frequencies[char] || 0) + 1;
  }

  let entropy = 0;
  for (const char in frequencies) {
    const probability = frequencies[char] / len;
    entropy -= probability * Math.log2(probability);
  }

  return entropy;
}

/**
 * Validate a name to detect bot-like gibberish
 * Returns { valid: boolean, reason?: string }
 */
export function validateNameNotGibberish(name: string): { valid: boolean; reason?: string } {
  if (!name || name.trim().length < 2) {
    return { valid: false, reason: "Name must be at least 2 characters" };
  }

  const trimmedName = name.trim();

  // Check 1: Must contain at least one space (real names usually have first + last)
  // Exception: Allow single names that look real (lowercase, reasonable length)
  const hasSpace = trimmedName.includes(" ");
  const isSingleWord = !hasSpace;

  if (isSingleWord) {
    // Single word names are OK if they look like real names
    // But reject if they're too long or look random
    if (trimmedName.length > 15) {
      return { valid: false, reason: "Name appears to be invalid" };
    }

    // Check for mixed case gibberish like "KntiDZfojckmvTjNGOcBK"
    const hasRandomMixedCase = /[a-z][A-Z]|[A-Z][a-z][A-Z]/.test(trimmedName) &&
      trimmedName.length > 8;
    if (hasRandomMixedCase) {
      return { valid: false, reason: "Please enter a valid name" };
    }
  }

  // Check 2: Only alphanumeric (no spaces, punctuation) is suspicious for long strings
  if (/^[a-zA-Z0-9]+$/.test(trimmedName) && trimmedName.length > 12) {
    return { valid: false, reason: "Please enter a valid name" };
  }

  // Check 3: High entropy suggests random string
  const entropy = calculateEntropy(trimmedName.replace(/\s/g, ""));
  // Real names typically have entropy < 3.5, random strings > 4.0
  if (entropy > 4.0 && trimmedName.length > 10) {
    return { valid: false, reason: "Please enter a valid name" };
  }

  // Check 4: Unusual character distribution
  // Names have vowels - pure consonant strings are suspicious
  const letters = trimmedName.replace(/[^a-zA-Z]/g, "").toLowerCase();
  if (letters.length > 5) {
    const vowelCount = (letters.match(/[aeiou]/g) || []).length;
    const vowelRatio = vowelCount / letters.length;
    // Real names typically have 25-50% vowels
    if (vowelRatio < 0.15 && letters.length > 8) {
      return { valid: false, reason: "Please enter a valid name" };
    }
  }

  // Check 5: No repeated random patterns (like "asdfasdf")
  if (/(.{3,})\1{2,}/.test(trimmedName.toLowerCase())) {
    return { valid: false, reason: "Please enter a valid name" };
  }

  // Check 6: Reject obvious test/fake patterns
  const suspiciousPatterns = [
    /^test/i,
    /^asdf/i,
    /^qwerty/i,
    /^12345/i,
    /^admin/i,
    /^user\d+$/i,
    /^[a-z]{20,}$/i,  // 20+ lowercase letters
    /^[A-Za-z]{1,2}\d{5,}$/,  // Like A123456
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(trimmedName)) {
      return { valid: false, reason: "Please enter your real name" };
    }
  }

  return { valid: true };
}

/**
 * Check if honeypot field was filled (indicates bot)
 */
export function checkHoneypot(honeypotValue: string | null): boolean {
  // Honeypot should be empty - bots fill it, humans don't see it
  return !honeypotValue || honeypotValue.trim() === "";
}

// Export for testing
export const _internal = {
  ipAttempts,
  accountAttempts,
  lockoutCounts,
  registrationAttempts,
  cleanup,
  LOGIN_CONFIG,
  IP_CONFIG,
  PASSWORD_RESET_CONFIG,
  REGISTRATION_CONFIG,
  calculateEntropy,
};
