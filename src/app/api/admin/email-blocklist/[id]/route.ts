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

// GET - Get a single blocklist entry
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const entry = await db.emailBlocklist.findUnique({
      where: { id },
    });

    if (!entry) {
      return NextResponse.json(
        { error: "Entry not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ entry });
  } catch (error) {
    adminEmailBlocklistLogger.error({ err: String(error) }, "Error fetching blocklist entry:");
    return NextResponse.json(
      { error: "Failed to fetch blocklist entry" },
      { status: 500 }
    );
  }
}

// PATCH - Update a blocklist entry
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { type, value, reason, isActive, expiresAt } = body;

    // Check if entry exists
    const existing = await db.emailBlocklist.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Entry not found" },
        { status: 404 }
      );
    }

    // If changing type or value, check for duplicates. The findUnique
    // below is TOCTOU — two admins could both pass the check — so we
    // also catch P2002 on the update.
    if ((type && type !== existing.type) || (value && value !== existing.value)) {
      const duplicate = await db.emailBlocklist.findUnique({
        where: {
          type_value: {
            type: type || existing.type,
            value: value ? value.toLowerCase().trim() : existing.value,
          },
        },
      });

      if (duplicate && duplicate.id !== id) {
        return NextResponse.json(
          { error: "An entry with this type and value already exists" },
          { status: 400 }
        );
      }
    }

    let entry;
    try {
      entry = await db.emailBlocklist.update({
        where: { id },
        data: {
          ...(type !== undefined && { type }),
          ...(value !== undefined && { value: value.toLowerCase().trim() }),
          ...(reason !== undefined && { reason }),
          ...(isActive !== undefined && { isActive }),
          ...(expiresAt !== undefined && {
            expiresAt: expiresAt ? new Date(expiresAt) : null,
          }),
        },
      });
    } catch (updateErr) {
      const isUniqueViolation =
        updateErr &&
        typeof updateErr === "object" &&
        "code" in updateErr &&
        (updateErr as { code?: string }).code === "P2002";
      if (isUniqueViolation) {
        return NextResponse.json(
          { error: "An entry with this type and value already exists" },
          { status: 409 }
        );
      }
      throw updateErr;
    }

    return NextResponse.json({ entry });
  } catch (error) {
    adminEmailBlocklistLogger.error({ err: String(error) }, "Error updating blocklist entry:");
    return NextResponse.json(
      { error: "Failed to update blocklist entry" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a blocklist entry
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    // deleteMany for idempotency on concurrent double-clicks
    // (avoids P2025 if the row was already deleted).
    const deleted = await db.emailBlocklist.deleteMany({
      where: { id },
    });

    if (deleted.count === 0) {
      return NextResponse.json(
        { error: "Entry not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    adminEmailBlocklistLogger.error({ err: String(error) }, "Error deleting blocklist entry:");
    return NextResponse.json(
      { error: "Failed to delete blocklist entry" },
      { status: 500 }
    );
  }
}
