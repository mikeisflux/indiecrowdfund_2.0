import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const projectsBasicsLogger = logger.child({ module: "projects-basics" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { checkProjectEditPermission } from "@/lib/project-permissions";

export const dynamic = "force-dynamic";

// Reject base64 data URIs and other inline content — imageUrl must be a
// real URL/path, otherwise we get multi-MB rows that break og:image generation.
const safeImageUrl = z
  .string()
  .max(8192)
  .refine((v) => !v.startsWith("data:"), {
    message: "imageUrl must be a URL or path, not an inline data URI",
  })
  .refine((v) => /^https?:\/\//i.test(v) || v.startsWith("/"), {
    message: "imageUrl must start with http(s):// or /",
  })
  .optional()
  .nullable();

const basicsSchema = z.object({
  title: z.string().optional(),
  subtitle: z.string().optional(),
  slug: z.string().min(3).max(100).regex(/^[a-z0-9-]+$/).optional(),
  category: z.string().optional(),
  subcategory: z.string().optional().nullable(),
  secondaryCategory: z.string().optional().nullable(),
  secondarySubcategory: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  imageUrl: safeImageUrl,
  videoUrl: z.string().optional().nullable(),
  goalAmount: z.number().positive().optional(),
  durationType: z.enum(["FIXED_DAYS", "END_DATE"]).optional(),
  durationDays: z.number().min(1).max(60).optional().nullable(),
  endDate: z.string().optional().nullable(),
  launchDate: z.string().optional().nullable(),
});

// POST - Update project basics
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

    const { permission } = permissionCheck;

    const body = await req.json();
    const data = basicsSchema.parse(body);

    // For launched projects, only allow certain fields to be updated
    const launchedAllowedFields = ["videoUrl", "imageUrl"];

    if (permission.isLaunched) {
      const requestedFields = Object.keys(data).filter(key => data[key as keyof typeof data] !== undefined);
      const disallowedFields = requestedFields.filter(f => !launchedAllowedFields.includes(f));

      if (disallowedFields.length > 0) {
        return NextResponse.json(
          { error: `Cannot edit ${disallowedFields.join(", ")} on a launched campaign` },
          { status: 400 }
        );
      }
    }

    const updateData: Record<string, unknown> = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.subtitle !== undefined) updateData.subtitle = data.subtitle;

    // Handle slug - check if already taken
    if (data.slug !== undefined) {
      const existingProject = await db.project.findFirst({
        where: {
          slug: data.slug,
          id: { not: projectId },
        },
        select: { id: true },
      });

      if (existingProject) {
        return NextResponse.json(
          { error: "This URL is already taken. Please choose a different one." },
          { status: 400 }
        );
      }
      updateData.slug = data.slug;
    }

    if (data.category !== undefined) updateData.category = data.category;
    if (data.subcategory !== undefined) updateData.subcategory = data.subcategory;
    if (data.secondaryCategory !== undefined) updateData.secondaryCategory = data.secondaryCategory;
    if (data.secondarySubcategory !== undefined) updateData.secondarySubcategory = data.secondarySubcategory;
    if (data.location !== undefined) updateData.location = data.location;
    if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
    if (data.videoUrl !== undefined) updateData.videoUrl = data.videoUrl;
    if (data.goalAmount !== undefined) updateData.goalAmount = data.goalAmount;
    if (data.durationType !== undefined) updateData.durationType = data.durationType;
    if (data.durationDays !== undefined) updateData.durationDays = data.durationDays;
    if (data.endDate !== undefined) updateData.endDate = data.endDate ? new Date(data.endDate) : null;
    if (data.launchDate !== undefined) updateData.launchDate = data.launchDate ? new Date(data.launchDate) : null;

    let updated;
    try {
      updated = await db.project.update({
        where: { id: projectId },
        data: updateData,
        select: {
          id: true,
          title: true,
          subtitle: true,
          slug: true,
          category: true,
          subcategory: true,
          secondaryCategory: true,
          secondarySubcategory: true,
          location: true,
          imageUrl: true,
          videoUrl: true,
          goalAmount: true,
          durationType: true,
          durationDays: true,
          endDate: true,
          launchDate: true,
        },
      });
    } catch (updateErr) {
      // P2002 on the slug @unique — the findFirst check above is TOCTOU.
      const isUniqueViolation =
        updateErr &&
        typeof updateErr === "object" &&
        "code" in updateErr &&
        (updateErr as { code?: string }).code === "P2002";
      if (isUniqueViolation && updateData.slug) {
        return NextResponse.json(
          { error: "This URL is already taken. Please choose a different one." },
          { status: 409 }
        );
      }
      throw updateErr;
    }

    projectsBasicsLogger.info(`Project basics updated for ${projectId}`);

    return NextResponse.json({
      success: true,
      project: {
        ...updated,
        goalAmount: Number(updated.goalAmount),
      },
    });
  } catch (error) {
    projectsBasicsLogger.error({ err: formatError(error) }, "Update basics error:");

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid data" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update project basics" },
      { status: 500 }
    );
  }
}

// GET - Get project basics
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
        title: true,
        subtitle: true,
        slug: true,
        category: true,
        subcategory: true,
        secondaryCategory: true,
        secondarySubcategory: true,
        location: true,
        imageUrl: true,
        videoUrl: true,
        goalAmount: true,
        durationType: true,
        durationDays: true,
        endDate: true,
        launchDate: true,
      },
    });

    return NextResponse.json({
      ...project,
      goalAmount: project ? Number(project.goalAmount) : 0,
    });
  } catch (error) {
    projectsBasicsLogger.error({ err: formatError(error) }, "Get basics error:");
    return NextResponse.json(
      { error: "Failed to get project basics" },
      { status: 500 }
    );
  }
}
