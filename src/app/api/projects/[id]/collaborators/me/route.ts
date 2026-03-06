import { NextResponse } from "next/server";
import { validateSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/projects/[id]/collaborators/me - Check if current user is a collaborator
export async function GET(
  _: unknown,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await validateSession();
    if (!session) {
      return NextResponse.json({ isCollaborator: false });
    }

    const { id: projectId } = await params;

    const collaborator = await db.projectCollaborator.findFirst({
      where: {
        projectId,
        userId: session.user.id,
        status: "ACCEPTED",
      },
      select: { id: true, canManageCommunity: true },
    });

    return NextResponse.json({
      isCollaborator: !!collaborator,
      canManageCommunity: collaborator?.canManageCommunity ?? false,
    });
  } catch (error) {
    console.error("Error checking collaborator status:", error);
    return NextResponse.json({ isCollaborator: false });
  }
}
