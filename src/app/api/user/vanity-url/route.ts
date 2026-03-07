import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const userVanityUrlLogger = logger.child({ module: "user-vanity-url" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Reserved words that cannot be used as vanity URLs
const RESERVED_WORDS = [
  "admin",
  "api",
  "auth",
  "dashboard",
  "login",
  "logout",
  "register",
  "settings",
  "projects",
  "users",
  "user",
  "profile",
  "account",
  "help",
  "support",
  "about",
  "terms",
  "privacy",
  "contact",
  "blog",
  "news",
  "explore",
  "discover",
  "search",
  "categories",
  "category",
  "home",
  "index",
  "new",
  "create",
  "edit",
  "delete",
  "update",
  "static",
  "assets",
  "images",
  "css",
  "js",
  "fonts",
  "media",
  "uploads",
  "files",
  "public",
  "private",
  "www",
  "mail",
  "email",
  "ftp",
  "cdn",
  "app",
  "mobile",
  "android",
  "ios",
  "web",
  "null",
  "undefined",
  "true",
  "false",
  "moderator",
  "superadmin",
  "super-admin",
  "staff",
  "team",
  "official",
  "verified",
  "featured",
];

// Validation regex: 3-30 chars, a-z, 0-9, -, _, must start with letter
const VANITY_URL_REGEX = /^[a-z][a-z0-9_-]{2,29}$/;

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { vanityUrl: true },
    });

    return NextResponse.json({
      vanityUrl: user?.vanityUrl || null,
      isSet: !!user?.vanityUrl,
    });
  } catch (error) {
    userVanityUrlLogger.error({ err: String(error) }, "Vanity URL fetch error:");
    return NextResponse.json(
      { error: "Failed to fetch vanity URL" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user already has a vanity URL (cannot change once set)
    const existingUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: { vanityUrl: true },
    });

    if (existingUser?.vanityUrl) {
      return NextResponse.json(
        { error: "Vanity URL has already been set and cannot be changed" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { vanityUrl } = body;

    if (!vanityUrl) {
      return NextResponse.json(
        { error: "Vanity URL is required" },
        { status: 400 }
      );
    }

    // Normalize to lowercase
    const normalizedUrl = vanityUrl.toLowerCase().trim();

    // Validate format
    if (!VANITY_URL_REGEX.test(normalizedUrl)) {
      return NextResponse.json(
        {
          error:
            "Vanity URL must be 3-30 characters, start with a letter, and contain only lowercase letters, numbers, hyphens, and underscores",
        },
        { status: 400 }
      );
    }

    // Check reserved words
    if (RESERVED_WORDS.includes(normalizedUrl)) {
      return NextResponse.json(
        { error: "This URL is reserved and cannot be used" },
        { status: 400 }
      );
    }

    // Check if already taken by another user
    const existing = await db.user.findFirst({
      where: {
        vanityUrl: normalizedUrl,
        NOT: { id: session.user.id },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "This URL is already taken" },
        { status: 400 }
      );
    }

    // Set the vanity URL
    const updatedUser = await db.user.update({
      where: { id: session.user.id },
      data: { vanityUrl: normalizedUrl },
      select: { vanityUrl: true },
    });

    return NextResponse.json({
      vanityUrl: updatedUser.vanityUrl,
      success: true,
    });
  } catch (error) {
    userVanityUrlLogger.error({ err: String(error) }, "Vanity URL set error:");
    return NextResponse.json(
      { error: "Failed to set vanity URL" },
      { status: 500 }
    );
  }
}

// Check availability without setting
export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { vanityUrl } = body;

    if (!vanityUrl) {
      return NextResponse.json({ available: false, error: "URL is required" });
    }

    const normalizedUrl = vanityUrl.toLowerCase().trim();

    // Validate format
    if (!VANITY_URL_REGEX.test(normalizedUrl)) {
      return NextResponse.json({
        available: false,
        error:
          "Must be 3-30 characters, start with a letter, and contain only lowercase letters, numbers, hyphens, and underscores",
      });
    }

    // Check reserved words
    if (RESERVED_WORDS.includes(normalizedUrl)) {
      return NextResponse.json({
        available: false,
        error: "This URL is reserved",
      });
    }

    // Check if already taken
    const existing = await db.user.findFirst({
      where: {
        vanityUrl: normalizedUrl,
        NOT: { id: session.user.id },
      },
    });

    if (existing) {
      return NextResponse.json({
        available: false,
        error: "This URL is already taken",
      });
    }

    return NextResponse.json({ available: true });
  } catch (error) {
    userVanityUrlLogger.error({ err: String(error) }, "Vanity URL check error:");
    return NextResponse.json(
      { available: false, error: "Failed to check availability" },
      { status: 500 }
    );
  }
}
