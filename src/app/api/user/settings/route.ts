import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
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
    console.error("Settings fetch error:", error);
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

    // Validate vanity URL if provided
    if (vanityUrl) {
      const existing = await db.user.findFirst({
        where: {
          vanityUrl,
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
    console.error("Settings update error:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
