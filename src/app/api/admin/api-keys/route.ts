import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const adminApiKeysLogger = logger.child({ module: "admin-api-keys" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { randomBytes, createHash } from "crypto";

// Generate a secure API key
function generateApiKey(environment: "PRODUCTION" | "DEVELOPMENT" | "STAGING"): {
  key: string;
  keyHash: string;
  prefix: string;
  displayKey: string;
} {
  const prefix = environment === "PRODUCTION" ? "sk_live_" : environment === "DEVELOPMENT" ? "sk_test_" : "sk_stag_";
  const randomPart = randomBytes(24).toString("base64url");
  const key = `${prefix}${randomPart}`;
  const keyHash = createHash("sha256").update(key).digest("hex");

  // Display key shows prefix + first 4 chars + masked + last 4 chars
  const displayKey = `${key.slice(0, prefix.length + 4)}...${key.slice(-4)}`;

  return { key, keyHash, prefix, displayKey };
}

// GET /api/admin/api-keys - List all API keys
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const user = await db.user.findFirst({
      where: { id: session.user.id, deletedAt: null },
      select: { role: true },
    });

    if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const apiKeys = await db.apiKey.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        key: true, // This is the display key (masked)
        prefix: true,
        environment: true,
        status: true,
        lastUsedAt: true,
        usageCount: true,
        createdAt: true,
        expiresAt: true,
        // Public Data API fields. A key issued through /dashboard/api carries
        // the owning account and who to contact about the integration; keys
        // minted by an admin before the public API predate these and are null.
        secretPrefix: true,
        scopes: true,
        appName: true,
        appUrl: true,
        contactEmail: true,
        lastUsedIp: true,
        revokedAt: true,
        user: {
          select: { id: true, name: true, email: true },
        },
        createdBy: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    // Format for frontend
    const formattedKeys = apiKeys.map((key: {
      id: string;
      name: string;
      key: string;
      prefix: string;
      environment: string;
      status: string;
      lastUsedAt: Date | null;
      usageCount: number;
      createdAt: Date;
      expiresAt: Date | null;
      createdBy: { name: string | null; email: string } | null;
    }) => ({
      id: key.id,
      name: key.name,
      key: key.key,
      environment: key.environment,
      status: key.status.toLowerCase(),
      created: key.createdAt.toISOString().split("T")[0],
      lastUsed: key.lastUsedAt
        ? getRelativeTime(key.lastUsedAt)
        : "Never",
      usageCount: key.usageCount,
      createdBy: key.createdBy?.name || key.createdBy?.email || "Unknown",
    }));

    return NextResponse.json({ apiKeys: formattedKeys });
  } catch (error) {
    adminApiKeysLogger.error({ err: formatError(error) }, "Error fetching API keys:");
    return NextResponse.json(
      { error: "Failed to fetch API keys" },
      { status: 500 }
    );
  }
}

// POST /api/admin/api-keys - Create a new API key
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const user = await db.user.findFirst({
      where: { id: session.user.id, deletedAt: null },
      select: { role: true },
    });

    if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { name, environment = "PRODUCTION" } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    // Validate environment
    const validEnvironments = ["PRODUCTION", "DEVELOPMENT", "STAGING"];
    const normalizedEnv = environment.toUpperCase();
    if (!validEnvironments.includes(normalizedEnv)) {
      return NextResponse.json(
        { error: "Invalid environment" },
        { status: 400 }
      );
    }

    // Generate the API key
    const { key, keyHash, prefix, displayKey } = generateApiKey(
      normalizedEnv as "PRODUCTION" | "DEVELOPMENT" | "STAGING"
    );

    // Create the API key in database
    const apiKey = await db.apiKey.create({
      data: {
        name,
        key: displayKey, // Store the masked version for display
        keyHash, // Store the hash for verification
        prefix,
        environment: normalizedEnv as "PRODUCTION" | "DEVELOPMENT" | "STAGING",
        createdById: session.user.id,
      },
    });

    // Return the full key ONLY on creation (user must save it)
    return NextResponse.json({
      success: true,
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        key: key, // Return full key only on creation!
        displayKey,
        environment: apiKey.environment,
        created: apiKey.createdAt.toISOString().split("T")[0],
      },
      message: "API key created. Save this key now - you won't be able to see it again!",
    });
  } catch (error) {
    adminApiKeysLogger.error({ err: formatError(error) }, "Error creating API key:");
    return NextResponse.json(
      { error: "Failed to create API key" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/api-keys - Delete an API key
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const user = await db.user.findFirst({
      where: { id: session.user.id, deletedAt: null },
      select: { role: true },
    });

    if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const keyId = searchParams.get("id");

    if (!keyId) {
      return NextResponse.json(
        { error: "API key ID is required" },
        { status: 400 }
      );
    }

    // Delete the key via deleteMany so a concurrent second DELETE
    // request doesn't throw P2025 (record not found) — treat the
    // second delete as a success (idempotent).
    const deleted = await db.apiKey.deleteMany({
      where: { id: keyId },
    });

    if (deleted.count === 0) {
      return NextResponse.json(
        { error: "API key not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "API key deleted successfully",
    });
  } catch (error) {
    adminApiKeysLogger.error({ err: formatError(error) }, "Error deleting API key:");
    return NextResponse.json(
      { error: "Failed to delete API key" },
      { status: 500 }
    );
  }
}

// Helper function to get relative time
function getRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  if (days < 7) return `${days} day${days > 1 ? "s" : ""} ago`;

  return date.toLocaleDateString();
}
