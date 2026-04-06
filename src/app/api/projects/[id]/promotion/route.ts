import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const projectsPromotionLogger = logger.child({ module: "projects-promotion" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { checkProjectEditPermission } from "@/lib/project-permissions";

export const dynamic = "force-dynamic";

const promotionSchema = z.object({
  customReferralTags: z.array(z.string()).optional(),
  googleAnalyticsId: z.string().optional().nullable(),
  metaPixelId: z.string().optional().nullable(),
});

// POST - Update promotion settings
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = id;
    const permissionCheck = await checkProjectEditPermission(projectId, session.user.id);

    if (!permissionCheck.allowed) {
      return NextResponse.json(
        { error: permissionCheck.error },
        { status: permissionCheck.status }
      );
    }

    // Promotion settings (analytics, referral tags) can be edited even on launched projects
    const body = await req.json();
    const data = promotionSchema.parse(body);

    const updateData: Record<string, unknown> = {};

    if (data.customReferralTags !== undefined) updateData.customReferralTags = data.customReferralTags;
    if (data.googleAnalyticsId !== undefined) updateData.googleAnalyticsId = data.googleAnalyticsId;
    if (data.metaPixelId !== undefined) updateData.metaPixelId = data.metaPixelId;

    const updated = await db.project.update({
      where: { id: projectId },
      data: updateData,
      select: {
        id: true,
        customReferralTags: true,
        googleAnalyticsId: true,
        metaPixelId: true,
      },
    });

    projectsPromotionLogger.info(`Project promotion settings updated for ${projectId}`);

    return NextResponse.json({
      success: true,
      project: updated,
    });
  } catch (error) {
    projectsPromotionLogger.error({ err: String(error) }, "Update promotion error:");

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid data" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update promotion settings" },
      { status: 500 }
    );
  }
}

// GET - Get promotion settings
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = id;
    const permissionCheck = await checkProjectEditPermission(projectId, session.user.id);

    if (!permissionCheck.allowed) {
      return NextResponse.json(
        { error: permissionCheck.error },
        { status: permissionCheck.status }
      );
    }

    const project = await db.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: {
        id: true,
        customReferralTags: true,
        googleAnalyticsId: true,
        metaPixelId: true,
      },
    });

    return NextResponse.json(project);
  } catch (error) {
    projectsPromotionLogger.error({ err: String(error) }, "Get promotion error:");
    return NextResponse.json(
      { error: "Failed to get promotion settings" },
      { status: 500 }
    );
  }
}
