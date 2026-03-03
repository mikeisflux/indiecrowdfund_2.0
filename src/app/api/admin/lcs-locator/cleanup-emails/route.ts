import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Helper to check admin status
async function isAdmin(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
}

/**
 * GET - Preview invalid emails that would be cleaned up
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await isAdmin(session.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Find all comic shops with emails that don't contain "@" (invalid emails)
    const invalidEmailShops = await db.comicShop.findMany({
      where: {
        email: {
          not: null,
        },
        NOT: {
          email: {
            contains: "@",
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({
      count: invalidEmailShops.length,
      preview: invalidEmailShops.slice(0, 50),
      message: `Found ${invalidEmailShops.length} shops with invalid emails (missing @). Use POST to clean up.`,
    });
  } catch (error) {
    console.error("Error previewing invalid emails:", error);
    return NextResponse.json(
      { error: "Failed to preview invalid emails" },
      { status: 500 }
    );
  }
}

/**
 * POST - Clean up invalid emails by setting them to null
 */
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await isAdmin(session.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Update all invalid emails to null
    const result = await db.comicShop.updateMany({
      where: {
        email: {
          not: null,
        },
        NOT: {
          email: {
            contains: "@",
          },
        },
      },
      data: {
        email: null,
      },
    });

    return NextResponse.json({
      success: true,
      cleaned: result.count,
      message: `Successfully cleaned up ${result.count} invalid emails (set to null)`,
    });
  } catch (error) {
    console.error("Error cleaning up invalid emails:", error);
    return NextResponse.json(
      { error: "Failed to clean up invalid emails" },
      { status: 500 }
    );
  }
}
