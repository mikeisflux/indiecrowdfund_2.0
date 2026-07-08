import { NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const userProfileLogger = logger.child({ module: "user-profile" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findFirst({
      where: { id: session.user.id, deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        heroImage: true,
        bio: true,
        location: true,
        vanityUrl: true,
        websites: true,
        socialLinks: true,
        showNameOnly: true,
        createdAt: true,
        _count: {
          select: {
            createdProjects: true,
            pledges: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    userProfileLogger.error({ err: formatError(error) }, "Profile fetch error:");
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      image,
      heroImage,
      bio,
      location,
      vanityUrl,
      websites,
      socialLinks,
      showNameOnly,
    } = body;

    // Validate vanity URL if provided
    if (vanityUrl) {
      // Check format: must start with a letter, then letters/numbers/hyphens/underscores, 3-30 chars total
      if (!/^[a-z][a-z0-9_-]{2,29}$/.test(vanityUrl)) {
        return NextResponse.json(
          { error: "Username must start with a letter and contain only lowercase letters, numbers, hyphens, and underscores (3-30 characters)" },
          { status: 400 }
        );
      }

      // Check if taken by an active (non-deleted) user
      const existing = await db.user.findFirst({
        where: {
          vanityUrl,
          deletedAt: null,
          NOT: { id: session.user.id },
        },
      });
      if (existing) {
        return NextResponse.json(
          { error: "This username is already taken" },
          { status: 400 }
        );
      }
    }

    // Validate bio length
    if (bio && bio.length > 500) {
      return NextResponse.json(
        { error: "Bio must be less than 500 characters" },
        { status: 400 }
      );
    }

    // Update user profile. Catch P2002 on vanityUrl @unique — the
    // findFirst check above is TOCTOU under concurrent vanity URL
    // claims.
    let updatedUser;
    try {
      updatedUser = await db.user.update({
        where: { id: session.user.id },
        data: {
          name,
          image,
          heroImage,
          bio,
          location,
          vanityUrl: vanityUrl || null,
          websites: websites || [],
          socialLinks: socialLinks || null,
          showNameOnly: showNameOnly ?? false,
        },
        select: {
          id: true,
          name: true,
          image: true,
          heroImage: true,
          bio: true,
          location: true,
          vanityUrl: true,
          websites: true,
          socialLinks: true,
          showNameOnly: true,
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
          { error: "This username is already taken" },
          { status: 409 }
        );
      }
      throw updateErr;
    }

    return NextResponse.json(updatedUser);
  } catch (error) {
    userProfileLogger.error({ err: formatError(error) }, "Profile update error:");
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
