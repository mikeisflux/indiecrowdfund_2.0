import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Check if we're in build mode (no DATABASE_URL or Prisma not generated)
const isBuildTime = process.env.NEXT_PHASE === "phase-production-build";

// Lazy initialization to avoid build-time errors when Prisma client isn't generated
function getPrismaClient(): PrismaClient {
  if (isBuildTime) {
    // Return a mock during build time to prevent initialization errors
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return {} as any;
  }

  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({
      log:
        process.env.NODE_ENV === "development"
          ? ["query", "error", "warn"]
          : ["error"],
    });
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
