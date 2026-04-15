import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const creatorEmailSetupLogger = logger.child({ module: "creator-email-setup" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET - Check if user has set up their creator email
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findFirst({
      where: { id: session.user.id, deletedAt: null },
      select: {
        creatorEmailHandle: true,
        name: true,
        createdProjects: {
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if user is a creator (has at least one project)
    const isCreator = user.createdProjects.length > 0;

    return NextResponse.json({
      hasEmailSetup: !!user.creatorEmailHandle,
      emailHandle: user.creatorEmailHandle,
      fullEmail: user.creatorEmailHandle ? `${user.creatorEmailHandle}@indiecrowdfund.com` : null,
      isCreator,
      suggestedHandle: user.creatorEmailHandle || generateSuggestedHandle(user.name),
    });
  } catch (error) {
    creatorEmailSetupLogger.error({ err: String(error) }, "Error checking creator email setup:");
    return NextResponse.json(
      { error: "Failed to check email setup" },
      { status: 500 }
    );
  }
}

// POST - Set up creator email address
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { handle } = body;

    if (!handle) {
      return NextResponse.json(
        { error: "Email handle is required" },
        { status: 400 }
      );
    }

    // Validate handle format
    const handleLower = handle.toLowerCase().trim();

    // Must be alphanumeric with optional dots, hyphens, underscores
    // Min 3 chars, max 30 chars
    const handleRegex = /^[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]$/;
    if (!handleRegex.test(handleLower)) {
      return NextResponse.json(
        { error: "Invalid email handle. Use 3-30 characters: letters, numbers, dots, hyphens, underscores. Must start and end with letter/number." },
        { status: 400 }
      );
    }

    // Check for reserved handles
    const reservedHandles = [
      "admin", "support", "help", "info", "contact", "sales", "billing",
      "noreply", "no-reply", "postmaster", "webmaster", "hostmaster",
      "abuse", "security", "privacy", "legal", "team", "hello",
      "newsletter", "updates", "notifications", "alerts", "system",
      "root", "administrator", "mail", "email", "inbox", "www",
    ];

    if (reservedHandles.includes(handleLower)) {
      return NextResponse.json(
        { error: "This email handle is reserved. Please choose another." },
        { status: 400 }
      );
    }

    // Check if handle is already taken
    const existing = await db.user.findUnique({
      where: { creatorEmailHandle: handleLower },
      select: { id: true },
    });

    if (existing && existing.id !== session.user.id) {
      return NextResponse.json(
        { error: "This email handle is already taken. Please choose another." },
        { status: 409 }
      );
    }

    // Update user with new email handle. Catch P2002 on
    // creatorEmailHandle @unique — the findUnique check above is
    // TOCTOU under concurrent claims of the same handle.
    let updatedUser;
    try {
      updatedUser = await db.user.update({
        where: { id: session.user.id },
        data: { creatorEmailHandle: handleLower },
        select: { creatorEmailHandle: true },
      });
    } catch (updateErr) {
      const isUniqueViolation =
        updateErr &&
        typeof updateErr === "object" &&
        "code" in updateErr &&
        (updateErr as { code?: string }).code === "P2002";
      if (isUniqueViolation) {
        return NextResponse.json(
          { error: "This email handle is already taken. Please choose another." },
          { status: 409 }
        );
      }
      throw updateErr;
    }

    return NextResponse.json({
      success: true,
      emailHandle: updatedUser.creatorEmailHandle,
      fullEmail: `${updatedUser.creatorEmailHandle}@indiecrowdfund.com`,
    });
  } catch (error) {
    creatorEmailSetupLogger.error({ err: String(error) }, "Error setting up creator email:");
    return NextResponse.json(
      { error: "Failed to set up email" },
      { status: 500 }
    );
  }
}

// Helper to generate a suggested handle from user's name
function generateSuggestedHandle(name: string | null): string {
  if (!name) return "";

  // Convert to lowercase, replace spaces with dots, remove special chars
  const handle = name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9.-]/g, "")
    .slice(0, 30);

  // Ensure it starts and ends with alphanumeric
  return handle.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
}
