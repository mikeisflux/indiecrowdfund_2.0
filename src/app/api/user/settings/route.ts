import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const userSettingsLogger = logger.child({ module: "user-settings" });
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
        bio: true,
        location: true,
        timezone: true,
        vanityUrl: true,
        websites: true,
        showNameOnly: true,
        emailVerified: true,
        createdAt: true,
        accounts: {
          select: {
            provider: true,
          },
        },
        preferences: {
          select: {
            emailPreferences: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get default email preferences if none set
    const defaultEmailPreferences = {
      // Backer notifications
      backedProjectUpdates: true,
      projectFunded: true,
      commentReplies: true,
      surveyReminders: true,
      // Creator messages
      creatorMessages: true,
      // Following
      projectUpdates: true,
      creatorLaunches: true,
      // Discovery
      newProjects: true,
      endingSoon: false,
      fundingMilestones: false,
      // Digest & Marketing
      weeklyDigest: false,
      marketingEmails: false,
    };

    return NextResponse.json({
      ...user,
      emailPreferences: user.preferences?.emailPreferences || defaultEmailPreferences,
      connectedAccounts: user.accounts.map((a: { provider: string }) => a.provider),
    });
  } catch (error) {
    userSettingsLogger.error({ err: String(error) }, "Settings fetch error:");
    return NextResponse.json(
      { error: "Failed to fetch settings" },
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
      bio,
      location,
      timezone,
      vanityUrl,
      websites,
      showNameOnly,
      emailPreferences,
    } = body;

    // Validate bio length
    if (bio !== undefined && bio !== null && typeof bio === "string" && bio.length > 500) {
      return NextResponse.json({ error: "Bio must be 500 characters or less" }, { status: 400 });
    }

    // Validate name length
    if (name !== undefined && name !== null && typeof name === "string" && name.length > 100) {
      return NextResponse.json({ error: "Name must be 100 characters or less" }, { status: 400 });
    }

    // Validate websites array
    if (websites !== undefined && websites !== null) {
      if (!Array.isArray(websites)) {
        return NextResponse.json({ error: "Websites must be an array" }, { status: 400 });
      }
      if (websites.length > 10) {
        return NextResponse.json({ error: "Maximum 10 websites allowed" }, { status: 400 });
      }
      for (const site of websites) {
        if (typeof site !== "string" || site.length > 255) {
          return NextResponse.json({ error: "Each website URL must be a string of 255 characters or less" }, { status: 400 });
        }
      }
    }

    // Validate vanity URL if provided
    if (vanityUrl) {
      if (!/^[a-z][a-z0-9_-]{2,29}$/.test(vanityUrl)) {
        return NextResponse.json(
          { error: "Username must start with a letter and contain only lowercase letters, numbers, hyphens, and underscores (3-30 characters)" },
          { status: 400 }
        );
      }
      const existing = await db.user.findFirst({
        where: {
          vanityUrl,
          deletedAt: null,
          NOT: { id: session.user.id },
        },
      });
      if (existing) {
        return NextResponse.json(
          { error: "This URL is already taken" },
          { status: 400 }
        );
      }
    }

    // Update user profile
    const updatedUser = await db.user.update({
      where: { id: session.user.id },
      data: {
        name,
        image,
        bio,
        location,
        timezone,
        vanityUrl: vanityUrl || null,
        websites: websites || [],
        showNameOnly: showNameOnly ?? false,
      },
      select: {
        id: true,
        name: true,
        image: true,
        bio: true,
        location: true,
        timezone: true,
        vanityUrl: true,
        websites: true,
        showNameOnly: true,
      },
    });

    // Update email preferences if provided
    if (emailPreferences) {
      await db.userPreference.upsert({
        where: { userId: session.user.id },
        update: {
          emailPreferences,
        },
        create: {
          userId: session.user.id,
          categoryScores: {},
          emailPreferences,
        },
      });
    }

    return NextResponse.json(updatedUser);
  } catch (error) {
    userSettingsLogger.error({ err: String(error) }, "Settings update error:");
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
