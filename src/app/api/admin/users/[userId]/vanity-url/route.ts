import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const adminUsersVanityUrlLogger = logger.child({ module: "admin-users-vanity-url" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// PUT - Update creator's vanity URL
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { vanityUrl } = body;

    if (!vanityUrl) {
      return NextResponse.json({ error: "Vanity URL is required" }, { status: 400 });
    }

    // Validate vanity URL format (alphanumeric, hyphens, underscores, 3-30 chars)
    const vanityRegex = /^[a-zA-Z0-9_-]{3,30}$/;
    if (!vanityRegex.test(vanityUrl)) {
      return NextResponse.json(
        { error: "Vanity URL must be 3-30 characters, alphanumeric with hyphens or underscores only" },
        { status: 400 }
      );
    }

    // Check reserved words
    const reservedWords = ["admin", "api", "new", "projects", "dashboard", "login", "signup", "settings", "_"];
    if (reservedWords.includes(vanityUrl.toLowerCase())) {
      return NextResponse.json(
        { error: "This vanity URL is reserved" },
        { status: 400 }
      );
    }

    // Update the user's vanity URL with P2002 catch on @unique.
    // The findFirst check is TOCTOU under concurrent admin edits.
    let updatedUser;
    try {
      updatedUser = await db.user.update({
        where: { id: userId },
        data: { vanityUrl: vanityUrl.toLowerCase() },
        select: {
          id: true,
          name: true,
          email: true,
          vanityUrl: true,
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
          { error: "This vanity URL is already taken" },
          { status: 409 }
        );
      }
      throw updateErr;
    }

    return NextResponse.json({
      success: true,
      user: updatedUser,
    });
  } catch (error) {
    adminUsersVanityUrlLogger.error({ err: formatError(error) }, "Error updating vanity URL:");
    return NextResponse.json(
      { error: "Failed to update vanity URL" },
      { status: 500 }
    );
  }
}

// GET - Get creator's current vanity URL and preview
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const user = await db.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        vanityUrl: true,
        createdProjects: {
          select: {
            id: true,
            title: true,
            slug: true,
            status: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    adminUsersVanityUrlLogger.error({ err: formatError(error) }, "Error fetching user vanity URL:");
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    );
  }
}
