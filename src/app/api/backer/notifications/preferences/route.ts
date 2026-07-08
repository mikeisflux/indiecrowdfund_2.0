import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const backerNotificationsPreferencesLogger = logger.child({ module: "backer-notifications-preferences" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Type for project notification preferences
interface ProjectPref {
  id: string;
  userId: string;
  projectId: string;
  updates: boolean;
  comments: boolean;
  surveys: boolean;
  shipping: boolean;
  messages: boolean;
  digestFrequency: string;
  createdAt: Date;
  updatedAt: Date;
  project: {
    id: string;
    title: string;
    slug: string;
    imageUrl: string | null;
    status: string;
    creator: { name: string | null };
  };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// GET: Get all notification preferences
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    // Get per-project notification preferences
    const projectPrefs = await db.projectNotificationPreference.findMany({
      where: { userId: session.user.id },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            slug: true,
            imageUrl: true,
            status: true,
            creator: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Get all backed projects for preference management
    const backedProjects = await db.pledge.findMany({
      where: {
        userId: session.user.id,
        deletedAt: null,
        status: "COMPLETED",
      },
      select: {
        project: {
          select: {
            id: true,
            title: true,
            slug: true,
            imageUrl: true,
            status: true,
            creator: {
              select: { name: true },
            },
          },
        },
      },
      distinct: ["projectId"],
    });

    // Map project preferences
    const projectPrefsMap = new Map<string, ProjectPref>(
      (projectPrefs as ProjectPref[]).map((p) => [p.projectId, p])
    );

    // Return the flat shape the client expects (projectId/projectTitle/
    // projectImage + per-channel toggles at top level). The previous
    // shape (id + nested preferences object) made every
    // p.projectId === undefined on the client, which built request
    // URLs like /api/backer/notifications/preferences/undefined and
    // 404'd on every toggle click.
    const projects = backedProjects.map(({ project }) => {
      const pref = projectPrefsMap.get(project.id);
      return {
        projectId: project.id,
        projectTitle: project.title,
        projectSlug: project.slug,
        projectImage: project.imageUrl,
        status: project.status,
        creatorName: project.creator.name,
        updates: pref?.updates ?? true,
        comments: pref?.comments ?? true,
        surveys: pref?.surveys ?? true,
        shipping: pref?.shipping ?? true,
        messages: pref?.messages ?? true,
        digestFrequency: pref?.digestFrequency ?? "instant",
        hasCustomPrefs: !!pref,
      };
    });

    return NextResponse.json({
      global: {
        emailNotifications: true,  // Default - could be stored in UserPreference
        marketingEmails: false,    // Default - could be stored in UserPreference
      },
      projects,
      totalProjects: projects.length,
    }, { headers: corsHeaders });
  } catch (error) {
    backerNotificationsPreferencesLogger.error({ err: formatError(error) }, "Error fetching notification preferences:");
    return NextResponse.json(
      { error: "Failed to fetch preferences" },
      { status: 500, headers: corsHeaders }
    );
  }
}

// POST: Create or update project notification preferences
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const body = await request.json();
    const { projectId, updates, comments, surveys, shipping, messages, digestFrequency } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Verify user has backed this project
    const pledge = await db.pledge.findFirst({
      where: {
        userId: session.user.id,
        deletedAt: null,
        projectId,
        status: "COMPLETED",
      },
    });

    if (!pledge) {
      return NextResponse.json(
        { error: "You must be a backer to set preferences" },
        { status: 403, headers: corsHeaders }
      );
    }

    // Upsert preferences
    const pref = await db.projectNotificationPreference.upsert({
      where: {
        userId_projectId: {
          userId: session.user.id,
          projectId,
        },
      },
      create: {
        userId: session.user.id,
        projectId,
        updates: updates ?? true,
        comments: comments ?? true,
        surveys: surveys ?? true,
        shipping: shipping ?? true,
        messages: messages ?? true,
        digestFrequency: digestFrequency ?? "instant",
      },
      update: {
        ...(updates !== undefined && { updates }),
        ...(comments !== undefined && { comments }),
        ...(surveys !== undefined && { surveys }),
        ...(shipping !== undefined && { shipping }),
        ...(messages !== undefined && { messages }),
        ...(digestFrequency !== undefined && { digestFrequency }),
      },
    });

    return NextResponse.json({ preference: pref }, { headers: corsHeaders });
  } catch (error) {
    backerNotificationsPreferencesLogger.error({ err: formatError(error) }, "Error updating notification preferences:");
    return NextResponse.json(
      { error: "Failed to update preferences" },
      { status: 500, headers: corsHeaders }
    );
  }
}

// PATCH: Update global notification settings
// Note: These fields don't exist in the schema yet - return defaults for now
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const body = await request.json();
    const { emailNotifications, marketingEmails } = body;

    // TODO: Store these in UserPreference model when fields are added
    // For now, acknowledge the update but return defaults
    return NextResponse.json({
      global: {
        emailNotifications: emailNotifications ?? true,
        marketingEmails: marketingEmails ?? false,
      },
    }, { headers: corsHeaders });
  } catch (error) {
    backerNotificationsPreferencesLogger.error({ err: formatError(error) }, "Error updating global preferences:");
    return NextResponse.json(
      { error: "Failed to update preferences" },
      { status: 500, headers: corsHeaders }
    );
  }
}
