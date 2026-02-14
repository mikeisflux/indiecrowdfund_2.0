import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { generateProjectSlug } from "@/lib/utils";

const createProjectSchema = z.object({
  title: z.string().min(1).max(200),
  subtitle: z.string().max(500).optional(),
  slug: z.string().min(3).max(100).regex(/^[a-z0-9-]+$/).optional(),
  category: z.string().min(1),
  subcategory: z.string().optional().nullable(),
  secondaryCategory: z.string().optional().nullable(),
  secondarySubcategory: z.string().optional().nullable(),
  location: z.string().optional(),
  imageUrl: z.string().url().optional().nullable(),
  videoUrl: z.string().url().optional().nullable(),
  goalAmount: z.number().positive(),
  durationType: z.enum(["FIXED_DAYS", "END_DATE"]),
  durationDays: z.number().min(1).max(60).optional(),
  endDate: z.string().datetime().optional(),
  launchDate: z.string().datetime().optional(),
});

// GET /api/projects - List projects
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const status = searchParams.get("status");
    const prelaunch = searchParams.get("prelaunch") === "true";
    const search = searchParams.get("q");
    const sort = searchParams.get("sort") || "trending";
    const staffPicks = searchParams.get("staffPicks") === "true";
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

    // Handle prelaunch vs live projects
    if (prelaunch) {
      // Show prelaunch projects (coming soon)
      where.prelaunchActive = true;
      where.status = { notIn: ["LIVE", "FUNDED"] }; // Exclude projects that are already live or funded
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

      return {
        id: project.id,
        title: project.title,
        subtitle: project.subtitle || "",
        slug: project.slug,
        category: project.category,
        imageUrl: project.imageUrl || "",
        creator: {
          id: project.creator.id,
          name: project.creator.name || "Creator",
          image: project.creator.image,
        },
        goalAmount: Number(project.goalAmount),
        currentAmount: Number(project.currentAmount),
        backerCount: project.backerCount,
        followerCount: project.followerCount,
        daysRemaining,
        endDate: project.endDate?.toISOString() || null,
        launchDate: project.launchDate?.toISOString() || null,
        isStaffPick: project.isStaffPick,
        isPrelaunch,
        projectUrl,
      };
    });

    return NextResponse.json({
      projects: formattedProjects,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error("Failed to fetch projects:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    );
  }
}

// POST /api/projects - Create a new project
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
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

    const project = await db.project.create({
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

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ');
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    console.error("Failed to create project:", error);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}
