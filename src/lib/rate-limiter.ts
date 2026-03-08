/**
 * Redis-backed Rate Limiter
 * Scales across multiple instances using Upstash Redis (already a dependency).
 * Falls back to in-memory rate limiting when Redis is unavailable.
 *
 * Usage:
 *   import { rateLimiter } from "@/lib/rate-limiter";
 *
 *   const result = await rateLimiter.check("api", clientIP, { limit: 100, windowSec: 60 });
 *   if (!result.allowed) {
 *     return NextResponse.json({ error: "Too many requests" }, { status: 429 });
 *   }
 */

import { logger } from "@/lib/logger";

interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  limit: number;
  /** Window size in seconds */
  windowSec: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // Unix timestamp in seconds
}

// In-memory fallback
const memoryStore = new Map<string, { count: number; windowStart: number }>();
let lastCleanup = 0;

// Redis client (lazy-initialized)
let redisClient: { incr: (key: string) => Promise<number>; expire: (key: string, seconds: number) => Promise<number>; ttl: (key: string) => Promise<number> } | null = null;
let redisInitialized = false;

async function getRedis() {
  if (redisInitialized) return redisClient;
  redisInitialized = true;

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) {
    logger.debug({}, "Redis not configured, using in-memory rate limiting");
    return null;
  }

  try {
    const { Redis } = await import("@upstash/redis");
    redisClient = new Redis({ url: redisUrl, token: redisToken });
    logger.info({}, "Redis rate limiter initialized");
    return redisClient;
  } catch (error) {
    logger.warn({ err: error instanceof Error ? error.message : String(error) },
      "Failed to initialize Redis, using in-memory rate limiting");
    return null;
  }
}

function cleanupMemoryStore(): void {
  const now = Date.now();
  if (now - lastCleanup < 60_000) return; // cleanup every minute max
  lastCleanup = now;

  for (const [key, entry] of memoryStore) {
    if (now - entry.windowStart > 300_000) { // 5 min staleness
      memoryStore.delete(key);
    }
  }
}

async function checkRedis(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult | null> {
  const redis = await getRedis();
  if (!redis) return null;

  try {
    const redisKey = `rl:${key}`;
    const count = await redis.incr(redisKey);

    // Set expiry on first request in window
    if (count === 1) {
      await redis.expire(redisKey, config.windowSec);
    }

    const ttl = await redis.ttl(redisKey);
    const resetAt = Math.floor(Date.now() / 1000) + Math.max(ttl, 0);

    return {
      allowed: count <= config.limit,
      remaining: Math.max(0, config.limit - count),
      resetAt,
    };
  } catch (error) {
    logger.warn({ err: error instanceof Error ? error.message : String(error), key },
      "Redis rate limit check failed, falling back to memory");
    return null;
  }
}

function checkMemory(key: string, config: RateLimitConfig): RateLimitResult {
  cleanupMemoryStore();

  const now = Date.now();
  const windowMs = config.windowSec * 1000;
  const entry = memoryStore.get(key);

  if (!entry || now - entry.windowStart > windowMs) {
    memoryStore.set(key, { count: 1, windowStart: now });
    return {
      allowed: true,
      remaining: config.limit - 1,
      resetAt: Math.floor((now + windowMs) / 1000),
    };
  }

  entry.count++;
  const resetAt = Math.floor((entry.windowStart + windowMs) / 1000);

  return {
    allowed: entry.count <= config.limit,
    remaining: Math.max(0, config.limit - entry.count),
    resetAt,
  };
}

export const rateLimiter = {
  /**
   * Check rate limit for a given namespace and identifier.
   * @param namespace - Category of the rate limit (e.g., "api", "login", "password-reset")
   * @param identifier - Unique identifier (e.g., IP address, user ID)
   * @param config - Rate limit configuration
   */
  async check(
    namespace: string,
    identifier: string,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    const key = `${namespace}:${identifier}`;

    // Try Redis first
    const redisResult = await checkRedis(key, config);
    if (redisResult) return redisResult;

    // Fall back to in-memory
    return checkMemory(key, config);
  },
};
