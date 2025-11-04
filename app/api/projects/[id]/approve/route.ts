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
        { error: "Only admins can approve projects" },
        { status: 403 }
      )
    }

    const { launchDate, featured } = await request.json()

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
        { error: "Only PENDING_APPROVAL projects can be approved" },
        { status: 400 }
      )
    }

    // Determine if project should go directly to LIVE or stay APPROVED
    const now = new Date()
    const parsedLaunchDate = launchDate ? new Date(launchDate) : null

    let newStatus: "APPROVED" | "LIVE" = "APPROVED"
    let launchedAt = null

    // If no launch date specified, or launch date is in the past/now, go live immediately
    if (!parsedLaunchDate || parsedLaunchDate <= now) {
      newStatus = "LIVE"
      launchedAt = now
    }

    // Update project
    const updatedProject = await prisma.project.update({
      where: { id: params.id },
      data: {
        status: newStatus,
        launchedAt,
        featured: featured || false,
      },
    })

    // Create notification for creator
    await prisma.notification.create({
      data: {
        userId: project.creatorId,
        type: "PROJECT_APPROVED",
        title: "Project Approved!",
        message:
          newStatus === "LIVE"
            ? `Congratulations! Your project "${project.title}" has been approved and is now LIVE!`
            : `Congratulations! Your project "${project.title}" has been approved and will launch on ${parsedLaunchDate?.toLocaleDateString()}`,
        link: `/dashboard/projects/${project.id}`,
        metadata: {
          projectId: project.id,
          status: newStatus,
          launchDate: parsedLaunchDate?.toISOString(),
        },
      },
    })

    // TODO: Send approval email

    return NextResponse.json({
      message: `Project ${newStatus === "LIVE" ? "approved and launched" : "approved"}`,
      project: updatedProject,
    })
  } catch (error: any) {
    console.error("Failed to approve project:", error)
    return NextResponse.json(
      { error: error.message || "Failed to approve project" },
      { status: 500 }
    )
  }
}
