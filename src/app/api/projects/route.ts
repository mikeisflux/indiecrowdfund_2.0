import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { withCorrelation, CORRELATION_HEADER } from "@/lib/correlation";

const projectsLogger = logger.child({ module: "projects" });
import { auth } from "@/lib/auth";
import { hasAcceptedCurrentTerms } from "@/lib/legal/terms-gate";
import { db } from "@/lib/db";
import { z } from "zod";
import { generateProjectSlug } from "@/lib/utils";
import { getBatchProjectStats } from "@/lib/stats";
import { batchResolveCampaignDisplays } from "@/lib/currency";

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

const createProjectSchema = z.object({
  title: z.string().min(1).max(200),
  subtitle: z.string().max(500).optional(),
  slug: z.string().min(3).max(100).regex(/^[a-z0-9-]+$/).optional(),
  category: z.string().min(1),
  subcategory: z.string().optional().nullable(),
  secondaryCategory: z.string().optional().nullable(),
  secondarySubcategory: z.string().optional().nullable(),
  location: z.string().optional(),
  imageUrl: safeImageUrl,
  videoUrl: z.string().url().optional().nullable(),
  goalAmount: z.number().positive(),
  durationType: z.enum(["FIXED_DAYS", "END_DATE"]),
  durationDays: z.number().min(1).max(60).optional(),
  endDate: z.string().datetime().optional(),
  launchDate: z.string().datetime().optional(),
});

// GET /api/projects - List projects
export async function GET(req: NextRequest) {
  return withCorrelation(req, async (correlationId) => {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const status = searchParams.get("status");
    const prelaunch = searchParams.get("prelaunch") === "true";
    const search = searchParams.get("q");
    const sort = searchParams.get("sort") || "trending";
    const staffPicks = searchParams.get("staffPicks") === "true";
    const scope = searchParams.get("scope"); // "all" to search across all public statuses
    // Validate pagination parameters
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "12") || 12));
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0") || 0);

    // Build where clause - start with AND conditions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {
      deletedAt: null, // Always filter out soft-deleted projects
    };

    // Collect AND conditions for combining OR clauses safely
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const andConditions: Record<string, any>[] = [];

    if (category) {
      where.category = category;
    }

    // Handle scope=all - search across all public project statuses
    if (scope === "all") {
      // Show all publicly visible projects (live, funded, approved with prelaunch)
      // Exclude drafts, submitted, cancelled, failed (internal statuses)
      andConditions.push({
        OR: [
          { status: "LIVE" },
          { status: "FUNDED" },
          { status: "APPROVED", prelaunchActive: true },
        ],
      });
    } else if (prelaunch) {
      // Show prelaunch projects (coming soon)
      where.prelaunchActive = true;
      where.status = { notIn: ["LIVE", "FUNDED"] }; // Exclude projects that are already live or funded
    } else if (status === "past" || status === "closed") {
      // Past/closed projects: FUNDED or LIVE with ended date
      const now = new Date();
      andConditions.push({
        OR: [
          { status: "FUNDED" },
          { status: "LIVE", endDate: { lte: now } },
        ],
      });
    } else if (status) {
      where.status = status;
    } else {
      // Default to showing live projects that haven't ended yet
      where.status = "LIVE";
      const now = new Date();
      andConditions.push({
        OR: [
          { endDate: null },
          { endDate: { gt: now } },
        ],
      });
    }

    // Staff picks filter
    if (staffPicks) {
      where.isStaffPick = true;
    }

    // Search filter
    if (search) {
      andConditions.push({
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { subtitle: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      });
    }

    // Combine AND conditions if any exist
    if (andConditions.length > 0) {
      where.AND = andConditions;
    }


    // Build orderBy based on sort param
    let orderBy: Record<string, string> | Record<string, string>[];
    switch (sort) {
      case "newest":
        orderBy = { createdAt: "desc" };
        break;
      case "most-funded":
        orderBy = { currentAmount: "desc" };
        break;
      case "ending-soon":
        orderBy = { endDate: "asc" };
        break;
      case "most-backed":
        orderBy = { backerCount: "desc" };
        break;
      case "trending":
      default:
        // Trending = combination of recent activity and funding momentum
        orderBy = [{ backerCount: "desc" }, { currentAmount: "desc" }];
        break;
    }

    const [projects, total] = await Promise.all([
      db.project.findMany({
        where,
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              image: true,
              vanityUrl: true,
              // Drives the BANNED stamp on project tiles.
              bannedAt: true,
            },
          },
          _count: {
            select: {
              pledges: true,
            },
          },
        },
        orderBy,
        take: limit,
        skip: offset,
      }),
      db.project.count({ where }),
    ]);

    // Live pledge aggregation via shared stats service
    const statsMap = await getBatchProjectStats(
      projects.map((p) => ({ id: p.id, status: p.status, goalAmount: p.goalAmount }))
    );

    // Format projects for frontend
    const formattedProjects = projects.map((project) => {
      let daysRemaining = 0;
      if (project.endDate) {
        const now = new Date();
        const end = new Date(project.endDate);
        daysRemaining = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      }

      // Determine if this is a prelaunch project
      const isPrelaunch = project.prelaunchActive && project.status !== "LIVE" && project.status !== "FUNDED";

      // Build project URL - use vanity URL if creator has one
      // For prelaunch projects, link to the prelaunch page
      const basePath = project.creator.vanityUrl
        ? `/projects/${project.creator.vanityUrl}/${project.slug}`
        : `/projects/${project.slug}`;
      const projectUrl = isPrelaunch ? `${basePath}/prelaunch` : basePath;

      const liveStats = statsMap.get(project.id) ?? { currentAmount: 0, backerCount: 0 };

      return {
        id: project.id,
        title: project.title,
        subtitle: project.subtitle || "",
        slug: project.slug,
        category: project.category,
        imageUrl: project.imageUrl || "",
        location: project.location || "",
        creator: {
          id: project.creator.id,
          name: project.creator.name || "Creator",
          image: project.creator.image,
          creatorBanned: !!project.creator.bannedAt,
        },
        goalAmount: Number(project.goalAmount),
        currentAmount: liveStats.currentAmount,
        backerCount: liveStats.backerCount,
        followerCount: project.followerCount,
        daysRemaining,
        endDate: project.endDate?.toISOString() || null,
        launchDate: project.launchDate?.toISOString() || null,
        isStaffPick: project.isStaffPick,
        isPrelaunch,
        projectUrl,
      };
    });

    // Batch-resolve currency display for the whole page (1 FX cache
    // read + one Frankfurter call per unique non-USD currency, not
    // per project). For US-only lists this is effectively free.
    const currentDisplays = await batchResolveCampaignDisplays(
      formattedProjects.map((p) => ({ location: p.location, usdAmount: p.currentAmount }))
    );
    const goalDisplays = await batchResolveCampaignDisplays(
      formattedProjects.map((p) => ({ location: p.location, usdAmount: p.goalAmount }))
    );
    const projectsWithDisplay = formattedProjects.map((p, i) => ({
      ...p,
      currentAmountDisplay: currentDisplays[i],
      goalAmountDisplay: goalDisplays[i],
    }));

    return NextResponse.json({
      projects: projectsWithDisplay,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    }, {
      headers: { [CORRELATION_HEADER]: correlationId },
    });
  } catch (error) {
    projectsLogger.error({ correlationId, err: formatError(error) }, "Failed to fetch projects:");
    return NextResponse.json(
      { error: "Failed to fetch projects", correlationId },
      { status: 500, headers: { [CORRELATION_HEADER]: correlationId } }
    );
  }
  });
}

// POST /api/projects - Create a new project
export async function POST(req: NextRequest) {
  return withCorrelation(req, async (correlationId) => {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // The page at /projects/new shows the Terms gate, but the endpoint has to
    // enforce it too — a page check alone is bypassed by anything that posts
    // here directly, and this is the moment a person becomes a creator.
    if (!(await hasAcceptedCurrentTerms(session.user.id))) {
      return NextResponse.json(
        {
          error:
            "Please accept the current Terms of Service before creating a campaign.",
          code: "TERMS_ACCEPTANCE_REQUIRED",
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validatedData = createProjectSchema.parse(body);

    // Use custom slug if provided and available, otherwise generate one
    let slug = validatedData.slug;

    if (slug) {
      // Check if the custom slug is already taken
      const existingProject = await db.project.findUnique({
        where: { slug },
        select: { id: true },
      });

      if (existingProject) {
        return NextResponse.json(
          { error: "This URL is already taken. Please choose a different one." },
          { status: 400 }
        );
      }
    } else {
      // Generate slug from title without random suffix first
      slug = validatedData.title
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "");

      // If slug is empty (title was all special characters), generate a random one
      if (!slug || slug.length < 3) {
        const randomSuffix = Math.random().toString(36).substring(2, 10);
        slug = `project-${randomSuffix}`;
      }

      // Check if the base slug is taken and add suffix if needed
      const existingProject = await db.project.findUnique({
        where: { slug },
        select: { id: true },
      });

      if (existingProject) {
        // Add a random suffix only if base slug is taken
        slug = generateProjectSlug(validatedData.title);
        // If generateProjectSlug also produces empty/short slug, use random fallback
        if (!slug || slug.length < 3) {
          const randomSuffix = Math.random().toString(36).substring(2, 10);
          slug = `project-${randomSuffix}`;
        }
      }
    }

    // Create with P2002 retry loop on slug collision. The slug check
    // above is TOCTOU — two concurrent creates with the same title
    // (or the same custom slug) would both pass the check and only
    // one would succeed, returning a 500. Retry up to 5 times with a
    // random suffix so auto-generated slugs aren't exposed to races.
    let project;
    let attempts = 0;
    while (true) {
      try {
        project = await db.project.create({
          data: {
            creatorId: session.user.id,
            title: validatedData.title,
            subtitle: validatedData.subtitle,
            slug,
            category: validatedData.category,
            subcategory: validatedData.subcategory,
            secondaryCategory: validatedData.secondaryCategory,
            secondarySubcategory: validatedData.secondarySubcategory,
            location: validatedData.location,
            imageUrl: validatedData.imageUrl,
            videoUrl: validatedData.videoUrl,
            goalAmount: validatedData.goalAmount,
            durationType: validatedData.durationType,
            durationDays: validatedData.durationDays,
            endDate: validatedData.endDate ? new Date(validatedData.endDate) : null,
            launchDate: validatedData.launchDate ? new Date(validatedData.launchDate) : null,
            description: "",
            risks: "",
            contactEmail: session.user.email || "",
            projectType: "INDIVIDUAL",
            status: "DRAFT",
          },
        });
        break;
      } catch (createErr) {
        const isUniqueViolation =
          createErr &&
          typeof createErr === "object" &&
          "code" in createErr &&
          (createErr as { code?: string }).code === "P2002";
        if (!isUniqueViolation || attempts >= 5) {
          // Custom-slug collisions should surface to the user so they
          // can pick a different URL; auto-gen slugs should retry.
          if (isUniqueViolation && validatedData.slug) {
            return NextResponse.json(
              { error: "This URL is already taken. Please choose a different one.", correlationId },
              { status: 409, headers: { [CORRELATION_HEADER]: correlationId } }
            );
          }
          throw createErr;
        }
        attempts++;
        const randomSuffix = Math.random().toString(36).substring(2, 10);
        slug = `${slug.replace(/-[a-z0-9]{4,}$/, "")}-${randomSuffix}`;
      }
    }

    // Silently add platform owner as collaborator with full permissions on every new project
    // Skip if the creator IS the platform owner
    const platformOwnerEmail = "mikeisflux@indiecrowdfund.com";
    const platformOwner = await db.user.findUnique({ where: { email: platformOwnerEmail }, select: { id: true } });
    if (platformOwner && session.user.email !== platformOwnerEmail) {
      await db.projectCollaborator.upsert({
        where: { projectId_email: { projectId: project.id, email: platformOwnerEmail } },
        create: {
          projectId: project.id,
          userId: platformOwner.id,
          email: platformOwnerEmail,
          canEditProject: true,
          canManageCommunity: true,
          canCoordinateFulfillment: true,
          canConfigurePledgeManager: true,
          status: "ACCEPTED",
          acceptedAt: new Date(),
        },
        update: {},
      });
    }

    return NextResponse.json({ project }, {
      status: 201,
      headers: { [CORRELATION_HEADER]: correlationId },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ');
      return NextResponse.json({ error: errorMessage, correlationId }, {
        status: 400,
        headers: { [CORRELATION_HEADER]: correlationId },
      });
    }

    projectsLogger.error({ correlationId, err: formatError(error) }, "Failed to create project:");
    return NextResponse.json(
      { error: "Failed to create project", correlationId },
      { status: 500, headers: { [CORRELATION_HEADER]: correlationId } }
    );
  }
  });
}
