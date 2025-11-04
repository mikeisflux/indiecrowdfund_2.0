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
      include: {
        rewards: true,
      },
    })

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      )
    }

    // Check if user is the creator
    if (project.creatorId !== session.user.id) {
      return NextResponse.json(
        { error: "Only project creator can submit for review" },
        { status: 403 }
      )
    }

    // Check if project is in DRAFT status
    if (project.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Only DRAFT projects can be submitted for review" },
        { status: 400 }
      )
    }

    // Validate required fields for submission
    const validationErrors: string[] = []

    if (!project.title || project.title.trim().length < 5) {
      validationErrors.push("Title must be at least 5 characters")
    }

    if (!project.tagline || project.tagline.trim().length < 10) {
      validationErrors.push("Tagline must be at least 10 characters")
    }

    if (!project.story || project.story.trim().length < 100) {
      validationErrors.push("Story must be at least 100 characters")
    }

    if (!project.imageUrl) {
      validationErrors.push("Project image is required")
    }

    if (project.fundingGoal < 100) {
      validationErrors.push("Funding goal must be at least 100")
    }

    if (!project.endDate) {
      validationErrors.push("End date is required")
    } else if (project.endDate <= new Date()) {
      validationErrors.push("End date must be in the future")
    }

    if (!project.contactEmail) {
      validationErrors.push("Contact email is required")
    }

    if (project.rewards.length === 0) {
      validationErrors.push("At least one reward is required")
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          error: "Project validation failed",
          validationErrors,
        },
        { status: 400 }
      )
    }

    // Update project status to PENDING_APPROVAL
    const updatedProject = await prisma.project.update({
      where: { id: params.id },
      data: {
        status: "PENDING_APPROVAL",
      },
    })

    // Create notification for admin
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true },
    })

    await prisma.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        type: "PROJECT_SUBMITTED",
        title: "New Project Submitted for Review",
        message: `Project "${project.title}" has been submitted for approval`,
        link: `/admin/projects/${project.id}`,
        metadata: {
          projectId: project.id,
          projectTitle: project.title,
        },
      })),
    })

    // Create notification for creator
    await prisma.notification.create({
      data: {
        userId: session.user.id,
        type: "PROJECT_SUBMITTED",
        title: "Project Submitted",
        message: `Your project "${project.title}" has been submitted for review`,
        link: `/dashboard/projects/${project.id}`,
        metadata: {
          projectId: project.id,
        },
      },
    })

    return NextResponse.json({
      message: "Project submitted for review successfully",
      project: updatedProject,
    })
  } catch (error: any) {
    console.error("Failed to submit project for review:", error)
    return NextResponse.json(
      { error: error.message || "Failed to submit project" },
      { status: 500 }
    )
  }
}
