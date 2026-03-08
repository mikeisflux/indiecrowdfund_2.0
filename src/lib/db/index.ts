import { PrismaClient, PrismaClientKnownRequestError, PrismaClientInitializationError } from "@prisma/client";
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
      client = new PrismaClient({
        log:
          process.env.NODE_ENV === "development"
            ? ["query", { emit: "event", level: "error" }, { emit: "event", level: "warn" }]
            : [{ emit: "event", level: "error" }],
      });

      // Filter out noisy connection termination errors from Prisma engine logs.
      // These flood the logs during normal PostgreSQL restarts (57P01).
      const IGNORED_PRISMA_PATTERNS = [
        "terminating connection due to administrator command",
        "server closed the connection unexpectedly",
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
              throw error;
            }
          }
          // Should not reach here, but satisfy TypeScript
          throw new Error("Prisma retry exhausted");
        },
      },
    }) as unknown as PrismaClient;

    // Start periodic keepalive to prevent stale connections (P1017 errors)
    if (!keepaliveTimer) {
      keepaliveTimer = setInterval(async () => {
        try {
          await client.$queryRawUnsafe("SELECT 1");
        } catch {
          // Connection is stale, disconnect to force fresh connections on next query
          try { await client.$disconnect(); } catch { /* ignore */ }
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
