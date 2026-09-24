import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const creatorIndiekitSettingsLogger = logger.child({ module: "creator-indiekit-settings" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { SUPPORTED_DISPLAY_CURRENCIES } from "@/lib/currency";
import {
  getIndiekitSettings,
  updateIndiekitSettings,
  type IndiekitSettings,
} from "@/lib/indiekit-settings";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "Project ID required" }, { status: 400 });
    }

    const project = await db.project.findFirst({
      where: {
        id: projectId,
        deletedAt: null,
        OR: [
          { creatorId: session.user.id },
          { collaborators: { some: { userId: session.user.id, status: "ACCEPTED" } } },
        ],
      },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        imageUrl: true,
        description: true,
        subtitle: true,
        category: true,
        goalAmount: true,
        endDate: true,
        currency: true,
        indiekitSettings: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
    }

    const [survey, settings] = await Promise.all([
      db.survey.findUnique({
        where: { projectId },
        select: {
          id: true,
          status: true,
          addressesLocked: true,
          introTitle: true,
          introMessage: true,
        },
      }),
      getIndiekitSettings(projectId),
    ]);

    return NextResponse.json({ project, survey, settings });
  } catch (error) {
    creatorIndiekitSettingsLogger.error({ err: formatError(error) }, "Settings GET error:");
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { projectId, action, field, value } = body;

    if (!projectId) {
      return NextResponse.json({ error: "Project ID required" }, { status: 400 });
    }

    // Verify user has access to this project
    const project = await db.project.findFirst({
      where: {
        id: projectId,
        deletedAt: null,
        OR: [
          { creatorId: session.user.id },
          { collaborators: { some: { userId: session.user.id, status: "ACCEPTED" } } },
        ],
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
    }

    if (action === "update_field" && field) {
      // Only allow updating certain fields
      // "subtitle" is the real column; "shortDescription" does not exist, so an
      // update naming it threw instead of saving.
      const allowedFields = ["title", "description", "subtitle", "category"];
      if (!allowedFields.includes(field)) {
        return NextResponse.json({ error: "Field not allowed" }, { status: 400 });
      }

      await db.project.update({
        where: { id: projectId },
        data: { [field]: value },
      });

      return NextResponse.json({ success: true });
    }

    if (action === "update_survey_settings") {
      // Update survey settings
      const survey = await db.survey.findUnique({
        where: { projectId },
      });

      if (survey) {
        // collectAddresses is not settable. A survey for a pledge that ships
        // always collects the address — see the note in
        // /api/projects/[id]/survey. This was the second way to turn it off.
        const allowedSurveyFields = ["status", "addressesLocked", "introTitle", "introMessage"];
        const safeData = Object.fromEntries(
          Object.entries((body.surveySettings as Record<string, unknown>) || {}).filter(([key]) =>
            allowedSurveyFields.includes(key)
          )
        );
        if (Object.keys(safeData).length > 0) {
          await db.survey.update({
            where: { id: survey.id },
            data: safeData,
          });
        }
      }

      return NextResponse.json({ success: true });
    }

    // General section: campaign name + display currency together.
    if (action === "update_general") {
      const data: Record<string, string> = {};
      if (typeof body.title === "string" && body.title.trim()) {
        data.title = body.title.trim().slice(0, 200);
      }
      if (typeof body.currency === "string") {
        if (!SUPPORTED_DISPLAY_CURRENCIES.includes(body.currency)) {
          return NextResponse.json(
            { error: `Unsupported display currency: ${body.currency}` },
            { status: 400 }
          );
        }
        data.currency = body.currency;
      }
      if (Object.keys(data).length === 0) {
        return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
      }
      await db.project.update({ where: { id: projectId }, data });
      return NextResponse.json({ success: true });
    }

    // Survey / Payments / Notifications toggle sections — persisted on
    // Project.indiekitSettings and read by the real senders (see
    // src/lib/indiekit-settings.ts for who reads what).
    if (action === "update_section_settings") {
      const section = String(body.section || "");
      if (!["survey", "payments", "notifications"].includes(section)) {
        return NextResponse.json({ error: `Unknown settings section: ${section}` }, { status: 400 });
      }
      const settings = await updateIndiekitSettings(
        projectId,
        section as keyof IndiekitSettings,
        (body.settings as Record<string, unknown>) || {}
      );
      return NextResponse.json({ success: true, settings });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    creatorIndiekitSettingsLogger.error({ err: formatError(error) }, "Settings POST error:");
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
