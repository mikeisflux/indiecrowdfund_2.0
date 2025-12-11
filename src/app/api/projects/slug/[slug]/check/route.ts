import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/projects/slug/[slug]/check - Check if a slug is available
export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const slug = params.slug;
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!slug) {
      return NextResponse.json(
        { error: "Slug is required" },
        { status: 400 }
      );
    }

    // Check if slug is already taken
    const existingProject = await db.project.findUnique({
      where: { slug },
      select: { id: true },
    });

    // If projectId is provided, check if the slug belongs to that project (for editing)
    if (existingProject) {
      if (projectId && existingProject.id === projectId) {
        // The slug belongs to the current project, so it's available
        return NextResponse.json({
          available: true,
          slug,
        });
      }

      // Slug is taken by another project
      return NextResponse.json({
        available: false,
        slug,
      });
    }

    // Slug is available
    return NextResponse.json({
      available: true,
      slug,
    });
  } catch (error) {
    console.error("Error checking slug availability:", error);
    return NextResponse.json(
      { error: "Failed to check slug availability" },
      { status: 500 }
    );
  }
}
