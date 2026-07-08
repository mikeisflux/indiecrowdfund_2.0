/**
 * Feature Flags System
 * Simple database-backed feature flags for quickly enabling/disabling features.
 * Flags are cached in memory with a short TTL to reduce database load.
 *
 * Usage:
 *   import { isFeatureEnabled, getAllFlags } from "@/lib/feature-flags";
 *
 *   if (await isFeatureEnabled("new_checkout_flow")) {
 *     // new code path
 *   }
 */

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

interface FeatureFlag {
  name: string;
  enabled: boolean;
  description: string | null;
  updatedAt: Date;
}

// In-memory cache
let flagsCache: Map<string, FeatureFlag> = new Map();
let lastFetchedAt = 0;
const CACHE_TTL_MS = 30_000; // 30 seconds

/**
 * Fetch all feature flags from the database and refresh the cache.
 */
async function refreshCache(): Promise<void> {
  try {
    const flags = await db.featureFlag.findMany();
    const newCache = new Map<string, FeatureFlag>();
    for (const flag of flags) {
      newCache.set(flag.name, {
        name: flag.name,
        enabled: flag.enabled,
        description: flag.description,
        updatedAt: flag.updatedAt,
      });
    }
    flagsCache = newCache;
    lastFetchedAt = Date.now();
  } catch (error) {
    logger.warn({ err: error instanceof Error ? error.message : String(error) },
      "Failed to refresh feature flags cache, using stale cache");
  }
}

/**
 * Ensure the cache is fresh.
 */
async function ensureFresh(): Promise<void> {
  if (Date.now() - lastFetchedAt > CACHE_TTL_MS) {
    await refreshCache();
  }
}

/**
 * Check if a feature flag is enabled.
 * Returns false for unknown flags (safe default).
 */
export async function isFeatureEnabled(flagName: string): Promise<boolean> {
  await ensureFresh();
  return flagsCache.get(flagName)?.enabled ?? false;
}

/**
 * Get all feature flags (for admin dashboard).
 */
export async function getAllFlags(): Promise<FeatureFlag[]> {
  await ensureFresh();
  return Array.from(flagsCache.values());
}

/**
 * Set a feature flag (creates if it doesn't exist).
 */
export async function setFeatureFlag(
  name: string,
  enabled: boolean,
  description?: string
): Promise<void> {
  await db.featureFlag.upsert({
    where: { name },
    update: { enabled, ...(description !== undefined ? { description } : {}) },
    create: { name, enabled, description: description || null },
  });

  // Immediately update cache
  flagsCache.set(name, {
    name,
    enabled,
    description: description || null,
    updatedAt: new Date(),
  });

  logger.info({ flag: name, enabled }, "Feature flag updated");
}

/**
 * Delete a feature flag. Uses deleteMany for idempotency on
 * concurrent delete requests — the second call hits count=0 instead
 * of P2025 → 500.
 */
export async function deleteFeatureFlag(name: string): Promise<void> {
  await db.featureFlag.deleteMany({ where: { name } });
  flagsCache.delete(name);
  logger.info({ flag: name }, "Feature flag deleted");
}
