import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminEmailBlocklistLogger = logger.child({ module: "admin-email-blocklist" });
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Require admin access
async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  const user = await db.user.findFirst({
    where: { id: session.user.id, deletedAt: null },
    select: { role: true },
  });

  if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
    return null;
  }

  return session.user;
}

// GET - List all blocklist entries
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const entries = await db.emailBlocklist.findMany({
      orderBy: [
        { isActive: "desc" },
        { blockedCount: "desc" },
        { createdAt: "desc" },
      ],
    });

    return NextResponse.json({ entries });
  } catch (error) {
    adminEmailBlocklistLogger.error({ err: String(error) }, "Error fetching blocklist:");
    return NextResponse.json(
      { error: "Failed to fetch blocklist" },
      { status: 500 }
    );
  }
}

// POST - Create a new blocklist entry
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { type, value, reason, source, isActive, expiresAt } = body;

    if (!type || !value) {
      return NextResponse.json(
        { error: "Type and value are required" },
        { status: 400 }
      );
    }

    // Validate type
    const validTypes = ["EMAIL", "DOMAIN", "IP", "PATTERN"];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: "Invalid type. Must be EMAIL, DOMAIN, IP, or PATTERN" },
        { status: 400 }
      );
    }

    // Create with P2002 catch on @@unique([type, value]) — findUnique
    // + create is TOCTOU under concurrent adds.
    let entry;
    try {
      entry = await db.emailBlocklist.create({
        data: {
          type,
          value: value.toLowerCase().trim(),
          reason: reason || null,
          source: source || "manual",
          isActive: isActive !== undefined ? isActive : true,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
        },
      });
    } catch (createErr) {
      const isUniqueViolation =
        createErr &&
        typeof createErr === "object" &&
        "code" in createErr &&
        (createErr as { code?: string }).code === "P2002";
      if (isUniqueViolation) {
        return NextResponse.json(
          { error: "This entry already exists in the blocklist" },
          { status: 409 }
        );
      }
      throw createErr;
    }

    return NextResponse.json({ entry });
  } catch (error) {
    adminEmailBlocklistLogger.error({ err: String(error) }, "Error creating blocklist entry:");
    return NextResponse.json(
      { error: "Failed to create blocklist entry" },
      { status: 500 }
    );
  }
}
