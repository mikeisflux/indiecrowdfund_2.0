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

    const project = await prisma.project.findUnique({
      where: { id: params.id },
    })

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      )
    }

    // Check permissions - must be creator or admin
    const isCreator = project.creatorId === session.user.id
    const isAdmin = session.user.role === "ADMIN"

    if (!isCreator && !isAdmin) {
      return NextResponse.json(
        { error: "Only project creator or admin can launch projects" },
        { status: 403 }
      )
    }

    // Check if project is APPROVED
    if (project.status !== "APPROVED") {
      return NextResponse.json(
        { error: "Only APPROVED projects can be launched" },
        { status: 400 }
      )
    }

    // Update project to LIVE
    const updatedProject = await prisma.project.update({
      where: { id: params.id },
      data: {
        status: "LIVE",
        launchedAt: new Date(),
      },
    })

    // Create notification for creator if admin launched it
    if (isAdmin && !isCreator) {
      await prisma.notification.create({
        data: {
          userId: project.creatorId,
          type: "PROJECT_LAUNCHED",
          title: "Project Launched!",
          message: `Your project "${project.title}" is now LIVE!`,
          link: `/project/${project.slug}`,
          metadata: {
            projectId: project.id,
          },
        },
      })
    }

    return NextResponse.json({
      message: "Project launched successfully",
      project: updatedProject,
    })
  } catch (error: any) {
    console.error("Failed to launch project:", error)
    return NextResponse.json(
      { error: error.message || "Failed to launch project" },
      { status: 500 }
    )
  }
}
