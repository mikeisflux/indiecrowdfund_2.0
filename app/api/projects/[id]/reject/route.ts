import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Check if user is admin
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only admins can reject projects" },
        { status: 403 }
      )
    }

    const { reason } = await request.json()

    if (!reason || reason.trim().length < 10) {
      return NextResponse.json(
        { error: "Rejection reason must be at least 10 characters" },
        { status: 400 }
      )
    }

    const project = await prisma.project.findUnique({
      where: { id: params.id },
      include: {
        creator: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      )
    }

    // Check if project is in PENDING_APPROVAL status
    if (project.status !== "PENDING_APPROVAL") {
      return NextResponse.json(
        { error: "Only PENDING_APPROVAL projects can be rejected" },
        { status: 400 }
      )
    }

    // Update project back to DRAFT
    const updatedProject = await prisma.project.update({
      where: { id: params.id },
      data: {
        status: "DRAFT",
      },
    })

    // Create notification for creator with rejection reason
    await prisma.notification.create({
      data: {
        userId: project.creatorId,
        type: "PROJECT_REJECTED",
        title: "Project Needs Revision",
        message: `Your project "${project.title}" needs some changes before it can be approved. Reason: ${reason}`,
        link: `/dashboard/projects/${project.id}/edit`,
        metadata: {
          projectId: project.id,
          rejectionReason: reason,
        },
      },
    })

    // TODO: Send rejection email with feedback

    return NextResponse.json({
      message: "Project rejected and returned to draft",
      project: updatedProject,
    })
  } catch (error: any) {
    console.error("Failed to reject project:", error)
    return NextResponse.json(
      { error: error.message || "Failed to reject project" },
      { status: 500 }
    )
  }
}
