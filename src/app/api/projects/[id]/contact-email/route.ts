import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

const emailSchema = z.object({
  contactEmail: z.string().email("Please enter a valid email address"),
});

// POST - Save contact email for a project
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

    // Get the project and verify ownership or collaborator access
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { creatorId: true, title: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Check if user is creator or collaborator with edit permission
    const isCreator = project.creatorId === session.user.id;
    let canEdit = isCreator;

    if (!isCreator) {
      const collaborator = await db.projectCollaborator.findFirst({
        where: {
          projectId,
          userId: session.user.id,
          status: "ACCEPTED",
          canEditProject: true,
        },
      });
      canEdit = !!collaborator;
    }

    if (!canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse and validate the request body
    const body = await req.json();
    const { contactEmail } = emailSchema.parse(body);

    // Directly update ONLY the contact email field
    const updated = await db.project.update({
      where: { id: projectId },
      data: { contactEmail },
      select: { id: true, contactEmail: true },
    });

    console.log(`Contact email saved for project ${projectId}: ${contactEmail}`);

    return NextResponse.json({
      success: true,
      contactEmail: updated.contactEmail,
      message: "Contact email saved successfully",
    });
  } catch (error) {
    console.error("Save contact email error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid email" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to save contact email" },
      { status: 500 }
    );
  }
}

// GET - Get current contact email for a project
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

    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { creatorId: true, contactEmail: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Check if user is creator or collaborator
    const isCreator = project.creatorId === session.user.id;
    let canView = isCreator;

    if (!isCreator) {
      const collaborator = await db.projectCollaborator.findFirst({
        where: {
          projectId,
          userId: session.user.id,
          status: "ACCEPTED",
        },
      });
      canView = !!collaborator;
    }

    if (!canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
      contactEmail: project.contactEmail || "",
    });
  } catch (error) {
    console.error("Get contact email error:", error);
    return NextResponse.json(
      { error: "Failed to get contact email" },
      { status: 500 }
    );
  }
}
