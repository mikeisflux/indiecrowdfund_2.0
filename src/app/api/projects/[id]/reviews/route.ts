import { NextRequest, NextResponse } from "next/server";
import { getServerSession, authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// GET - Get review history for a project
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = params.id;

    // Get the project to verify ownership
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true, creatorId: true, status: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Only allow creator or admin to see review history
    // In production, also check for admin role
    if (project.creatorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get review history
    const reviews = await db.projectReview.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        action: true,
        previousStatus: true,
        newStatus: true,
        notes: true,
        rejectionReason: true,
        flagsRaised: true,
        aiConfidenceScore: true,
        createdAt: true,
        // Don't expose internal notes to creators
        // internalNotes: true,
      },
    });

    return NextResponse.json({
      projectId,
      currentStatus: project.status,
      reviews,
    });
  } catch (error) {
    console.error("Error fetching project reviews:", error);
    return NextResponse.json(
      { error: "Failed to fetch review history" },
      { status: 500 }
    );
  }
}
