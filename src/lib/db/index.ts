import { PrismaClient, PrismaClientKnownRequestError, PrismaClientInitializationError } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { logger } from "@/lib/logger";

const dbLogger = logger.child({ module: "prisma" });

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Check if we're in build mode (no DATABASE_URL or Prisma not generated)
const isBuildTime = process.env.NEXT_PHASE === "phase-production-build";

// Transient error codes that should be retried (P1017 = server closed connection)
const TRANSIENT_ERROR_CODES = ["P1017", "P1001", "P1002", "P1008", "P1009"];
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 300;

// Periodic connection pool keepalive interval (5 minutes)
const KEEPALIVE_INTERVAL_MS = 5 * 60 * 1000;
let keepaliveTimer: ReturnType<typeof setInterval> | null = null;

// Track initialization failures to avoid spamming logs every request
let lastInitErrorTime = 0;
const INIT_ERROR_COOLDOWN_MS = 30_000; // Only log init errors every 30 seconds

// Track transient retry warnings to avoid log flooding
let lastTransientWarnTime = 0;
const TRANSIENT_WARN_COOLDOWN_MS = 10_000; // Only log transient retry warnings every 10 seconds

// Patterns in PrismaClientInitializationError that are genuinely transient
const TRANSIENT_INIT_PATTERNS = [
  "server has closed the connection",
  "connection reset",
  "econnreset",
  "econnrefused",
  "connection timed out",
  "too many connections",
];

function isTransientError(error: unknown): boolean {
  if (error instanceof PrismaClientKnownRequestError) {
    return TRANSIENT_ERROR_CODES.includes(error.code);
  }
  if (error instanceof PrismaClientInitializationError) {
    // Only retry init errors that look like transient connection issues,
    // not permanent problems like "Can't reach database server"
    const msg = error.message.toLowerCase();
    return TRANSIENT_INIT_PATTERNS.some((pattern) => msg.includes(pattern));
  }
  // Check for generic connection reset errors
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes("server has closed the connection") ||
      msg.includes("connection reset") ||
      msg.includes("econnreset");
  }
  return false;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Reset the cached Prisma client so the next request builds a fresh
// PrismaClient + adapter + connection pool. Called when:
//   1. The keepalive ping fails (connection dropped — Postgres restart,
//      idle timeout, network blip, etc).
//   2. A user query exhausts its retries against a transient error
//      (means the pool is dead and retrying inside the same client
//      will keep failing).
//
// Without this reset, every subsequent request hits the disconnected
// pool, the retry layer fires 4 times against the same dead pool, and
// the route 500s indefinitely until the process restarts. That's the
// bug we used to "fix" with a nightly VM reboot.
function resetPrismaClient(reason: string): void {
  dbLogger.warn({ reason }, "Resetting Prisma client to recover from stale connection");
  // Snapshot the dead refs.
  const stale = globalForPrisma.prisma;
  const oldTimer = keepaliveTimer;
  // Synchronously (no awaits) clear both module-level slots so any
  // concurrent request entering getPrismaClient() sees an empty cache
  // and rebuilds before our async cleanup runs.
  globalForPrisma.prisma = undefined;
  keepaliveTimer = null;
  // Async cleanup — fire and forget, the pool is probably already
  // dead so $disconnect() may throw and we don't care.
  if (oldTimer) clearInterval(oldTimer);
  if (stale) {
    Promise.resolve()
      .then(() => stale.$disconnect())
      .catch(() => { /* ignore — pool likely already shut down */ });
  }
}

// Lazy initialization to avoid build-time errors when Prisma client isn't generated
function getPrismaClient(): PrismaClient {
  if (isBuildTime) {
    // Return a mock during build time to prevent initialization errors
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return {} as any;
  }

  if (!globalForPrisma.prisma) {
    let client: PrismaClient;
    try {
      // Prisma 7 requires a driver adapter on every PrismaClient. We
      // use @prisma/adapter-pg which wraps node-postgres. `ssl:
      // rejectUnauthorized: false` matches the pre-Prisma-7 Rust
      // engine behavior, which silently ignored self-signed certs.
      // Our production DB uses a self-signed cert, and without this
      // opt-out Prisma 7 throws P1010 "User was denied access on the
      // database" even though the credentials are correct. The
      // connection itself is still TCP-direct to PostgreSQL on
      // localhost so this doesn't weaken anything in practice.
      // Connection pool sizing. With pm2 running 8 cluster workers
      // (see ecosystem.config.js), each worker gets its own pool. Set
      // max=10 explicitly so total connection demand is bounded at
      // 8 * 10 = 80, comfortably under Postgres max_connections=150
      // (default 100 won't have headroom — see scripts/setup-server-
      // tuning.sh). idleTimeoutMillis releases connections back to
      // the pool after 1 minute idle so a brief burst doesn't pin
      // connections forever. connectionTimeoutMillis bounds how long
      // a query waits for a pool slot before erroring out, which
      // surfaces pool exhaustion as a clear error instead of a
      // mystery hang on the request.
      const adapter = new PrismaPg({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        max: 10,
        idleTimeoutMillis: 60_000,
        connectionTimeoutMillis: 5_000,
      });
      client = new PrismaClient({
        adapter,
        log:
          process.env.NODE_ENV === "development"
            ? ["query", { emit: "event", level: "error" }, { emit: "event", level: "warn" }]
            : [{ emit: "event", level: "error" }],
      });

      // Filter out noisy connection termination errors from Prisma engine logs.
      // These flood the logs during normal PostgreSQL restarts (57P01).
      // Also filter the errorGroup fingerprint P2002 race — captureError
      // recovers from it via findUnique + update fallback, so the engine
      // log is pure noise.
      const IGNORED_PRISMA_PATTERNS = [
        "terminating connection due to administrator command",
        "server closed the connection unexpectedly",
        "Unique constraint failed on the fields: (`fingerprint`)",
        // ProjectFollower has a (projectId, userId) unique. Re-clicking
        // "Follow" or rapid double-submit races both pass the existing-
        // follow check and race to insert. The POST handler at
        // /api/user/following catches P2002 and returns 200 with
        // alreadyFollowing:true, so the engine log is pure noise.
        "Unique constraint failed on the fields: (`\"projectId\"`, `\"userId\"`)",
        // CreatorFollow has a (followerId, creatorId) unique — same race
        // class as ProjectFollower above. /api/backer/following catches
        // P2002 and returns alreadyFollowing:true.
        "Unique constraint failed on the fields: (`\"followerId\"`, `\"creatorId\"`)",
        // Session cleanup races: session.delete() after validation finds
        // the row was already reaped (expiry, logout, signout-everywhere).
        // Our callers already .catch(() => {}) these at the app level,
        // but the engine-level log still emits through the $on("error")
        // hook. Suppress — benign.
        "An operation failed because it depends on one or more records that were required but not found. No record was found for a delete.",
      ];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client.$on as any)("error", (e: { message: string }) => {
        if (IGNORED_PRISMA_PATTERNS.some((p) => e.message.includes(p))) return;
        dbLogger.error({ err: e.message }, "Prisma engine error");
      });

      if (process.env.NODE_ENV === "development") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (client.$on as any)("warn", (e: { message: string }) => {
          dbLogger.warn({ err: e.message }, "Prisma engine warning");
        });
      }
    } catch (error) {
      const now = Date.now();
      if (now - lastInitErrorTime > INIT_ERROR_COOLDOWN_MS) {
        lastInitErrorTime = now;
        dbLogger.error(
          { err: error instanceof Error ? error.message : String(error) },
          "Failed to initialize PrismaClient. Run 'npx prisma generate' and restart PM2."
        );
      }
      throw new Error("Database client not available. Please try again later.");
    }

    // Reconnect on transient errors by wrapping with retry logic
    globalForPrisma.prisma = client.$extends({
      query: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async $allOperations({ args, query }: { args: any; query: (args: any) => Promise<any> }) {
          for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
              return await query(args);
            } catch (error) {
              if (attempt < MAX_RETRIES && isTransientError(error)) {
                // Throttle retry warnings to avoid log flooding during outages
                const now = Date.now();
                if (now - lastTransientWarnTime > TRANSIENT_WARN_COOLDOWN_MS) {
                  lastTransientWarnTime = now;
                  dbLogger.warn(
                    { attempt: attempt + 1, maxRetries: MAX_RETRIES + 1, err: error instanceof Error ? error.message : String(error) },
                    "Transient error, retrying"
                  );
                }
                await sleep(RETRY_DELAY_MS * (attempt + 1));
                continue;
              }
              // Out of retries (or non-transient). If the error was
              // transient, the pool is almost certainly dead — reset
              // the cached client so the NEXT request builds a fresh
              // PrismaClient + adapter + pool. Without this, every
              // subsequent request would hit the same dead pool and
              // 500 forever (which is exactly the failure mode the
              // nightly reboot cron was masking).
              if (isTransientError(error)) {
                resetPrismaClient(
                  `retry exhausted (${attempt + 1} attempts): ${
                    error instanceof Error ? error.message : String(error)
                  }`
                );
              }
              throw error;
            }
          }
          // Should not reach here, but satisfy TypeScript
          throw new Error("Prisma retry exhausted");
        },
      },
    }) as unknown as PrismaClient;

    // Start periodic keepalive to prevent stale connections (P1017 errors).
    // On failure we reset the entire client — disconnecting the pool
    // alone wasn't enough because globalForPrisma.prisma still pointed
    // at the now-dead extended client, so every subsequent request
    // rolled queries against the disconnected pool until the process
    // was restarted.
    if (!keepaliveTimer) {
      keepaliveTimer = setInterval(async () => {
        try {
          await client.$queryRawUnsafe("SELECT 1");
        } catch (err) {
          resetPrismaClient(
            `keepalive ping failed: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }, KEEPALIVE_INTERVAL_MS);
      // Don't prevent Node.js from exiting
      if (keepaliveTimer && typeof keepaliveTimer === "object" && "unref" in keepaliveTimer) {
        keepaliveTimer.unref();
      }
    }
  }
  return globalForPrisma.prisma;
}

// Create a proxy that lazily initializes the Prisma client
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop: string | symbol) {
    const client = getPrismaClient();
    const value = client[prop as keyof PrismaClient];
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});

export default db;
