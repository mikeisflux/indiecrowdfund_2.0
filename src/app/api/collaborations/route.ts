import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET - Get all projects the current user is collaborating on
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const collaborations = await db.projectCollaborator.findMany({
      where: {
        userId: session.user.id,
        status: "ACCEPTED",
      },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            slug: true,
            imageUrl: true,
            status: true,
            currentAmount: true,
            goalAmount: true,
            category: true,
            creator: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
      },
      orderBy: { acceptedAt: "desc" },
    });

    return NextResponse.json({
      collaborations: collaborations.map((c) => ({
        id: c.id,
        title: c.title,
        email: c.email,
        canEditProject: c.canEditProject,
        canManageCommunity: c.canManageCommunity,
        canCoordinateFulfillment: c.canCoordinateFulfillment,
        canConfigurePledgeManager: c.canConfigurePledgeManager,
        acceptedAt: c.acceptedAt,
        project: c.project,
      })),
    });
  } catch (error) {
    console.error("Error fetching collaborations:", error);
    return NextResponse.json(
      { error: "Failed to fetch collaborations" },
      { status: 500 }
    );
  }
}
