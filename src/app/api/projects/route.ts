import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { generateProjectSlug } from "@/lib/utils";

const createProjectSchema = z.object({
  title: z.string().min(1).max(200),
  subtitle: z.string().max(500).optional(),
  category: z.string().min(1),
  location: z.string().optional(),
  imageUrl: z.string().url().optional(),
  videoUrl: z.string().url().optional(),
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
    const search = searchParams.get("q");
    const sort = searchParams.get("sort") || "trending";
    const staffPicks = searchParams.get("staffPicks") === "true";
    const limit = parseInt(searchParams.get("limit") || "12");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build where clause
    const where: Record<string, unknown> = {};

    if (category) {
      where.category = category;
    }

    if (status) {
      where.status = status;
    } else {
      // Default to showing live projects
      where.status = "LIVE";
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { subtitle: { contains: search, mode: "insensitive" } },
      ];
    }

    if (staffPicks) {
      where.isStaffPick = true;
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

      return {
        id: project.id,
        title: project.title,
        subtitle: project.subtitle || "",
        slug: project.slug,
        category: project.category,
        imageUrl: project.imageUrl || "/placeholder-1.jpg",
        creator: {
          id: project.creator.id,
          name: project.creator.name || "Creator",
          image: project.creator.image,
        },
        goalAmount: project.goalAmount,
        currentAmount: project.currentAmount,
        backerCount: project.backerCount,
        daysRemaining,
        isStaffPick: project.isStaffPick,
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

    const slug = generateProjectSlug(validatedData.title);

    const project = await db.project.create({
      data: {
        creatorId: session.user.id,
        title: validatedData.title,
        subtitle: validatedData.subtitle,
        slug,
        category: validatedData.category,
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
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Failed to create project:", error);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}
