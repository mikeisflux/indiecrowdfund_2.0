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
    const limit = parseInt(searchParams.get("limit") || "12");
    const offset = parseInt(searchParams.get("offset") || "0");

    const where: any = {};

    if (category) {
      where.category = category;
    }

    if (status) {
      where.status = status;
    } else {
      // Default to showing live projects
      where.status = "LIVE";
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
        orderBy: {
          createdAt: "desc",
        },
        take: limit,
        skip: offset,
      }),
      db.project.count({ where }),
    ]);

    return NextResponse.json({
      projects,
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
        { error: "Validation failed", details: error.errors },
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
