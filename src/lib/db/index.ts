import { Prisma, PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Check if we're in build mode (no DATABASE_URL or Prisma not generated)
const isBuildTime = process.env.NEXT_PHASE === "phase-production-build";

// Transient error codes that should be retried (P1017 = server closed connection)
const TRANSIENT_ERROR_CODES = ["P1017", "P1001", "P1002", "P1008"];
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 500;

function isTransientError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return TRANSIENT_ERROR_CODES.includes(error.code);
  }
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
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
    const client = new PrismaClient({
      log:
        process.env.NODE_ENV === "development"
          ? ["query", "error", "warn"]
          : ["error"],
    });

    // Reconnect on transient errors by wrapping with retry logic
    globalForPrisma.prisma = client.$extends({
      query: {
        async $allOperations({ args, query }) {
          for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
              return await query(args);
            } catch (error) {
              if (attempt < MAX_RETRIES && isTransientError(error)) {
                console.warn(
                  `[Prisma] Transient error (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying in ${RETRY_DELAY_MS}ms...`,
                  error instanceof Error ? error.message : error
                );
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
