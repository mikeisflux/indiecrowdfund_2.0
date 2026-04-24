/**
 * Bot Blocker - Database-backed IP blocking for malicious requests
 *
 * Uses database for persistence with in-memory caching for performance.
 * Tracks suspicious activity and auto-blocks repeat offenders.
 * Writes blocked IPs to a pending file for near-instant firewall application.
 */

import { db } from "@/lib/db";
import { appendFile } from "fs/promises";

import { logger } from "@/lib/logger";

const botBlockerLogger = logger.child({ module: "bot-blocker" });


// Configuration
const BOT_BLOCK_THRESHOLD = 3; // Block after this many violations
const SUSPICIOUS_WINDOW_MS = 60 * 60 * 1000; // 1 hour window for counting violations
const BLOCK_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hour block duration

// In-memory cache to reduce database hits (refreshed periodically)
const blockedIPCache = new Map<string, { expiresAt: Date; checkedAt: number }>();

/**
 * Check if an IP is currently blocked
 * Uses cache first, falls back to database
 */
export async function isIPBlocked(ip: string): Promise<boolean> {
  if (!ip || ip === "unknown") return false;

  const now = Date.now();

  // Check cache first
  const cached = blockedIPCache.get(ip);
  if (cached) {
    // Cache hit - check if block is still valid
    if (cached.expiresAt.getTime() > now) {
      return true;
    }
    // Block expired, remove from cache
    blockedIPCache.delete(ip);
  }

  // Check database (only if cache miss or expired check)
  try {
    const blocked = await db.blockedIP.findUnique({
      where: { ipAddress: ip },
      select: { expiresAt: true },
    });

    if (blocked && blocked.expiresAt.getTime() > now) {
      // Update cache
      blockedIPCache.set(ip, { expiresAt: blocked.expiresAt, checkedAt: now });
      return true;
    }

    // Not blocked or expired - clean up if needed
    if (blocked) {
      // Delete expired block asynchronously (deleteMany for idempotency
      // in case two concurrent checks both try to clean up the same row).
      db.blockedIP.deleteMany({ where: { ipAddress: ip } }).catch(() => {});
    }

    return false;
  } catch (error) {
    botBlockerLogger.error({ err: error }, "[Bot Blocker] Database error checking blocked IP:");
    // On database error, fall back to cache or allow
    return false;
  }
}

/**
 * Record suspicious activity and potentially block the IP
 * Returns true if the IP is now blocked
 */
export async function recordSuspiciousActivity(
  ip: string,
  reason: string,
  metadata?: {
    actionId?: string;
    path?: string;
    userAgent?: string;
  }
): Promise<boolean> {
  if (!ip || ip === "unknown") return false;

  try {
    // Log the suspicious activity
    await db.suspiciousActivity.create({
      data: {
        ipAddress: ip,
        reason,
        actionId: metadata?.actionId,
        path: metadata?.path,
        userAgent: metadata?.userAgent,
      },
    });

    // Count recent violations from this IP
    const windowStart = new Date(Date.now() - SUSPICIOUS_WINDOW_MS);
    const recentCount = await db.suspiciousActivity.count({
      where: {
        ipAddress: ip,
        createdAt: { gte: windowStart },
      },
    });

    botBlockerLogger.info(`[Bot Blocker] Suspicious activity from ${ip}: ${reason} (${recentCount} recent violations)`);

    // Block if threshold reached
    if (recentCount >= BOT_BLOCK_THRESHOLD) {
      return await blockIP(ip, reason, metadata);
    }

    return false;
  } catch (error) {
    botBlockerLogger.error({ err: error }, "[Bot Blocker] Database error recording suspicious activity:");
    return false;
  }
}

/**
 * Block an IP address
 */
export async function blockIP(
  ip: string,
  reason: string,
  metadata?: {
    actionId?: string;
    path?: string;
    userAgent?: string;
  }
): Promise<boolean> {
  if (!ip || ip === "unknown") return false;
  // Never persist a block for loopback — internal self-fetches use
  // these addresses and a rogue entry would 403 the app's own
  // bot-blocker sync, health checks, and crons.
  if (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip === "::ffff:127.0.0.1" ||
    ip === "localhost"
  ) {
    return false;
  }

  const expiresAt = new Date(Date.now() + BLOCK_DURATION_MS);

  try {
    await db.blockedIP.upsert({
      where: { ipAddress: ip },
      create: {
        ipAddress: ip,
        reason,
        expiresAt,
        lastUserAgent: metadata?.userAgent,
        lastPath: metadata?.path,
        lastActionId: metadata?.actionId,
      },
      update: {
        reason,
        expiresAt,
        violationCount: { increment: 1 },
        lastUserAgent: metadata?.userAgent,
        lastPath: metadata?.path,
        lastActionId: metadata?.actionId,
      },
    });

    // Update cache
    blockedIPCache.set(ip, { expiresAt, checkedAt: Date.now() });

    // Write to pending file for immediate firewall application
    // The botblock-watcher service picks this up within seconds and adds iptables DROP rule
    try {
      await appendFile("/tmp/botblock-pending", `${ip}\n`);
    } catch {
      // Non-fatal — the 5-minute cron sync is the safety net
      botBlockerLogger.error(`[Bot Blocker] Could not write to pending file for ${ip}`);
    }

    botBlockerLogger.info(`[Bot Blocker] IP BLOCKED: ${ip} - Reason: ${reason} - Expires: ${expiresAt.toISOString()}`);
    return true;
  } catch (error) {
    botBlockerLogger.error({ err: error }, "[Bot Blocker] Database error blocking IP:");
    return false;
  }
}

/**
 * Unblock an IP address (for admin use)
 */
export async function unblockIP(ip: string): Promise<boolean> {
  try {
    // deleteMany for idempotency — two concurrent unblock calls collapse
    // to { count: 0 } instead of P2025.
    await db.blockedIP.deleteMany({ where: { ipAddress: ip } });
    blockedIPCache.delete(ip);
    botBlockerLogger.info(`[Bot Blocker] IP UNBLOCKED: ${ip}`);
    return true;
  } catch (error) {
    botBlockerLogger.error({ err: error }, "[Bot Blocker] Error unblocking IP:");
    return false;
  }
}

/**
 * Get list of currently blocked IPs (for admin dashboard)
 */
export async function getBlockedIPs(): Promise<
  Array<{
    ipAddress: string;
    reason: string;
    violationCount: number;
    blockedAt: Date;
    expiresAt: Date;
  }>
> {
  try {
    const now = new Date();
    return await db.blockedIP.findMany({
      where: { expiresAt: { gt: now } },
      select: {
        ipAddress: true,
        reason: true,
        violationCount: true,
        blockedAt: true,
        expiresAt: true,
      },
      orderBy: { blockedAt: "desc" },
    });
  } catch (error) {
    botBlockerLogger.error({ err: error }, "[Bot Blocker] Error fetching blocked IPs:");
    return [];
  }
}

/**
 * Get recent suspicious activity (for admin dashboard)
 */
export async function getRecentSuspiciousActivity(
  limit = 100
): Promise<
  Array<{
    id: string;
    ipAddress: string;
    reason: string;
    actionId: string | null;
    path: string | null;
    userAgent: string | null;
    createdAt: Date;
  }>
> {
  try {
    return await db.suspiciousActivity.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  } catch (error) {
    botBlockerLogger.error({ err: error }, "[Bot Blocker] Error fetching suspicious activity:");
    return [];
  }
}

/**
 * Clean up expired blocks and old activity logs
 */
export async function cleanupExpiredData(): Promise<void> {
  try {
    const now = new Date();
    const oldActivityCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days

    // Delete expired blocks
    const deletedBlocks = await db.blockedIP.deleteMany({
      where: { expiresAt: { lt: now } },
    });

    // Delete old activity logs
    const deletedActivity = await db.suspiciousActivity.deleteMany({
      where: { createdAt: { lt: oldActivityCutoff } },
    });

    if (deletedBlocks.count > 0 || deletedActivity.count > 0) {
      botBlockerLogger.info(`[Bot Blocker] Cleanup: removed ${deletedBlocks.count} expired blocks, ${deletedActivity.count} old activity logs`);
    }

    // Clear cache for expired entries
    Array.from(blockedIPCache.entries()).forEach(([ip, data]) => {
      if (data.expiresAt.getTime() < now.getTime()) {
        blockedIPCache.delete(ip);
      }
    });
  } catch (error) {
    botBlockerLogger.error({ err: error }, "[Bot Blocker] Error during cleanup:");
  }
}

/**
 * Validate server action ID format
 * Valid Next.js action IDs are 40-character hex strings
 */
export function isValidServerActionId(actionId: string): boolean {
  if (!actionId || actionId.length < 10) return false;
  return /^[a-f0-9]+$/i.test(actionId);
}
