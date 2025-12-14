/**
 * Rate limiting for brute force protection
 * Uses in-memory storage with sliding window algorithm
 * Reads configuration from database with caching
 * For production with multiple instances, consider using Redis
 */

import { db } from "@/lib/db";

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
    console.error("Error loading rate limit settings:", error);
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
 * Check if a login attempt is allowed based on IP and account
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

  // Check IP-based rate limit
  if (ip && settings.globalRateLimitEnabled) {
    const ipCheck = checkRateLimit(ipAttempts, ip, ipConfig);
    if (!ipCheck.allowed) {
      return {
        allowed: false,
        remainingAttempts: 0,
        retryAfter: ipCheck.retryAfter,
        message: `Too many login attempts from this IP. Please try again in ${formatRetryTime(ipCheck.retryAfter || 0)}.`,
      };
    }
  }

  // Check account-based rate limit
  const accountCheck = checkRateLimit(accountAttempts, normalizedEmail, loginConfig);
  if (!accountCheck.allowed) {
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfter: accountCheck.retryAfter,
      message: `Too many failed login attempts. Please try again in ${formatRetryTime(accountCheck.retryAfter || 0)}.`,
    };
  }

  return {
    allowed: true,
    remainingAttempts: Math.min(
      ip && settings.globalRateLimitEnabled ? checkRateLimit(ipAttempts, ip, ipConfig).remainingAttempts : loginConfig.maxAttempts,
      accountCheck.remainingAttempts
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
 * Check if password reset request is allowed
 */
export async function checkPasswordResetRateLimit(
  ip: string | null,
  email: string
): Promise<RateLimitResult> {
  const normalizedEmail = email.toLowerCase().trim();
  const key = `reset:${normalizedEmail}`;
  const passwordResetConfig = await getPasswordResetConfig();

  // Check IP-based rate limit for reset requests
  if (ip) {
    const ipKey = `reset:${ip}`;
    const ipCheck = checkRateLimit(ipAttempts, ipKey, passwordResetConfig);
    if (!ipCheck.allowed) {
      return {
        allowed: false,
        remainingAttempts: 0,
        retryAfter: ipCheck.retryAfter,
        message: `Too many password reset requests. Please try again in ${formatRetryTime(ipCheck.retryAfter || 0)}.`,
      };
    }
  }

  // Check account-based rate limit
  const accountCheck = checkRateLimit(accountAttempts, key, passwordResetConfig);
  if (!accountCheck.allowed) {
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfter: accountCheck.retryAfter,
      message: `Too many password reset requests for this email. Please try again in ${formatRetryTime(accountCheck.retryAfter || 0)}.`,
    };
  }

  return {
    allowed: true,
    remainingAttempts: accountCheck.remainingAttempts,
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
 * Check retailer login rate limit (uses same logic but separate tracking)
 */
export async function checkRetailerLoginRateLimit(
  ip: string | null,
  identifier: string // email or access code
): Promise<RateLimitResult> {
  const key = `retailer:${identifier.toLowerCase().trim()}`;
  const settings = await getSettings();

  // Check if login rate limiting is enabled
  if (!settings.loginRateLimitEnabled) {
    return { allowed: true, remainingAttempts: 999 };
  }

  const loginConfig = await getLoginConfig();
  const ipConfig = await getIpConfig();

  // Check IP-based rate limit
  if (ip && settings.globalRateLimitEnabled) {
    const ipKey = `retailer:${ip}`;
    const ipCheck = checkRateLimit(ipAttempts, ipKey, ipConfig);
    if (!ipCheck.allowed) {
      return {
        allowed: false,
        remainingAttempts: 0,
        retryAfter: ipCheck.retryAfter,
        message: `Too many login attempts from this IP. Please try again in ${formatRetryTime(ipCheck.retryAfter || 0)}.`,
      };
    }
  }

  // Check account-based rate limit
  const accountCheck = checkRateLimit(accountAttempts, key, loginConfig);
  if (!accountCheck.allowed) {
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfter: accountCheck.retryAfter,
      message: `Too many failed login attempts. Please try again in ${formatRetryTime(accountCheck.retryAfter || 0)}.`,
    };
  }

  return {
    allowed: true,
    remainingAttempts: accountCheck.remainingAttempts,
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

// Export for testing
export const _internal = {
  ipAttempts,
  accountAttempts,
  lockoutCounts,
  cleanup,
  LOGIN_CONFIG,
  IP_CONFIG,
  PASSWORD_RESET_CONFIG,
};
