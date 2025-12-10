import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Fetch backed projects (projects user has pledged to)
    const backedPledges = await db.pledge.findMany({
      where: {
        userId,
        status: { in: ["PENDING", "COMPLETED"] },
      },
      select: {
        project: {
          select: {
            id: true,
            title: true,
            slug: true,
            imageUrl: true,
            status: true,
          },
        },
      },
      distinct: ["projectId"],
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    // Fetch created projects
    const createdProjects = await db.project.findMany({
      where: { creatorId: userId },
      select: {
        id: true,
        title: true,
        slug: true,
        imageUrl: true,
        status: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    // Fetch collaborating projects (accepted) - lookup by userId OR email
    const userEmail = session.user.email?.toLowerCase();

    // Debug: Log the lookup criteria
    console.log("[Profile Dropdown] Looking for collaborations for userId:", userId, "email:", userEmail);

    const collaborations = await db.projectCollaborator.findMany({
      where: {
        status: "ACCEPTED",
        OR: [
          { userId },
          ...(userEmail ? [{ email: { equals: userEmail, mode: "insensitive" as const } }] : []),
        ],
      },
      select: {
        id: true,
        userId: true,
        email: true,
        status: true,
        project: {
          select: {
            id: true,
            title: true,
            slug: true,
            imageUrl: true,
            status: true,
          },
        },
      },
      orderBy: { acceptedAt: "desc" },
      take: 5,
    });

    // Debug: Log what was found
    console.log("[Profile Dropdown] Found collaborations:", collaborations.length, collaborations.map((c: { id: string; email: string | null; status: string; userId: string | null; project: { title: string } }) => ({ id: c.id, email: c.email, status: c.status, userId: c.userId, projectTitle: c.project.title })));

    // Link userId if not set (for collaborators found by email)
    for (const collab of collaborations) {
      if (!collab.userId && userEmail) {
        await db.projectCollaborator.update({
          where: { id: collab.id },
          data: { userId },
        });
      }
    }

    // Fetch pending invitations (by email since userId might not be set yet)
    const pendingInvites = userEmail ? await db.projectCollaborator.findMany({
      where: {
        OR: [
          { userId, status: "PENDING" },
          { email: { equals: userEmail, mode: "insensitive" }, status: "PENDING" },
        ],
      },
      select: {
        id: true,
        project: {
          select: {
            id: true,
            title: true,
            slug: true,
            imageUrl: true,
            status: true,
          },
        },
      },
      orderBy: { invitedAt: "desc" },
      take: 5,
    }) : [];

    return NextResponse.json({
      backedProjects: backedPledges.map((p: { project: { id: string; title: string; slug: string; imageUrl: string | null; status: string } }) => p.project),
      createdProjects,
      collaboratingProjects: collaborations.map((c: { project: { id: string; title: string; slug: string; imageUrl: string | null; status: string } }) => c.project),
      pendingInvites: pendingInvites.map((c: { id: string; project: { id: string; title: string; slug: string; imageUrl: string | null; status: string } }) => ({
        inviteId: c.id,
        ...c.project,
      })),
    });
  } catch (error) {
    console.error("Profile dropdown error:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile data" },
      { status: 500 }
    );
  }
}
