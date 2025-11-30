/**
 * Rate limiting for brute force protection
 * Uses in-memory storage with sliding window algorithm
 * For production with multiple instances, consider using Redis
 */

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

// Default configurations
const LOGIN_CONFIG: RateLimitConfig = {
  maxAttempts: 5,              // 5 failed attempts
  windowMs: 15 * 60 * 1000,    // within 15 minutes
  lockoutMs: 15 * 60 * 1000,   // lockout for 15 minutes
  blockAfterLockouts: 3,       // after 3 lockouts
  extendedBlockMs: 60 * 60 * 1000, // block for 1 hour
};

const PASSWORD_RESET_CONFIG: RateLimitConfig = {
  maxAttempts: 3,              // 3 reset requests
  windowMs: 60 * 60 * 1000,    // within 1 hour
  lockoutMs: 60 * 60 * 1000,   // lockout for 1 hour
};

const IP_CONFIG: RateLimitConfig = {
  maxAttempts: 20,             // 20 total attempts from one IP
  windowMs: 15 * 60 * 1000,    // within 15 minutes
  lockoutMs: 30 * 60 * 1000,   // lockout for 30 minutes
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
export function checkLoginRateLimit(
  ip: string | null,
  email: string
): RateLimitResult {
  const normalizedEmail = email.toLowerCase().trim();

  // Check IP-based rate limit
  if (ip) {
    const ipCheck = checkRateLimit(ipAttempts, ip, IP_CONFIG);
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
  const accountCheck = checkRateLimit(accountAttempts, normalizedEmail, LOGIN_CONFIG);
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
      ip ? checkRateLimit(ipAttempts, ip, IP_CONFIG).remainingAttempts : LOGIN_CONFIG.maxAttempts,
      accountCheck.remainingAttempts
    ),
  };
}

/**
 * Record a login attempt (success or failure)
 */
export function recordLoginAttempt(
  ip: string | null,
  email: string,
  success: boolean
): void {
  const normalizedEmail = email.toLowerCase().trim();

  if (ip) {
    recordAttempt(ipAttempts, ip, IP_CONFIG, success);
  }

  recordAttempt(accountAttempts, normalizedEmail, LOGIN_CONFIG, success);
}

/**
 * Check if password reset request is allowed
 */
export function checkPasswordResetRateLimit(
  ip: string | null,
  email: string
): RateLimitResult {
  const normalizedEmail = email.toLowerCase().trim();
  const key = `reset:${normalizedEmail}`;

  // Check IP-based rate limit for reset requests
  if (ip) {
    const ipKey = `reset:${ip}`;
    const ipCheck = checkRateLimit(ipAttempts, ipKey, PASSWORD_RESET_CONFIG);
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
  const accountCheck = checkRateLimit(accountAttempts, key, PASSWORD_RESET_CONFIG);
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
export function recordPasswordResetAttempt(
  ip: string | null,
  email: string
): void {
  const normalizedEmail = email.toLowerCase().trim();
  const key = `reset:${normalizedEmail}`;

  if (ip) {
    const ipKey = `reset:${ip}`;
    recordAttempt(ipAttempts, ipKey, PASSWORD_RESET_CONFIG, false);
  }

  recordAttempt(accountAttempts, key, PASSWORD_RESET_CONFIG, false);
}

/**
 * Check retailer login rate limit (uses same logic but separate tracking)
 */
export function checkRetailerLoginRateLimit(
  ip: string | null,
  identifier: string // email or access code
): RateLimitResult {
  const key = `retailer:${identifier.toLowerCase().trim()}`;

  // Check IP-based rate limit
  if (ip) {
    const ipKey = `retailer:${ip}`;
    const ipCheck = checkRateLimit(ipAttempts, ipKey, IP_CONFIG);
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
  const accountCheck = checkRateLimit(accountAttempts, key, LOGIN_CONFIG);
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
export function recordRetailerLoginAttempt(
  ip: string | null,
  identifier: string,
  success: boolean
): void {
  const key = `retailer:${identifier.toLowerCase().trim()}`;

  if (ip) {
    const ipKey = `retailer:${ip}`;
    recordAttempt(ipAttempts, ipKey, IP_CONFIG, success);
  }

  recordAttempt(accountAttempts, key, LOGIN_CONFIG, success);
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
export function getAccountLockoutInfo(email: string): {
  isLocked: boolean;
  retryAfter?: number;
  attemptsRemaining?: number;
} {
  const normalizedEmail = email.toLowerCase().trim();
  const entry = accountAttempts.get(normalizedEmail);

  if (!entry) {
    return { isLocked: false, attemptsRemaining: LOGIN_CONFIG.maxAttempts };
  }

  const now = Date.now();

  if (entry.lockedUntil && now < entry.lockedUntil) {
    return {
      isLocked: true,
      retryAfter: Math.ceil((entry.lockedUntil - now) / 1000),
    };
  }

  // Check if window has expired
  if (now - entry.firstAttempt > LOGIN_CONFIG.windowMs) {
    return { isLocked: false, attemptsRemaining: LOGIN_CONFIG.maxAttempts };
  }

  return {
    isLocked: false,
    attemptsRemaining: Math.max(0, LOGIN_CONFIG.maxAttempts - entry.attempts),
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
