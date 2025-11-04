import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const project = await prisma.project.findUnique({
      where: { id: params.id },
      include: {
        creator: true,
      },
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Only creator can view collaborators
    if (project.creatorId !== session.user.id) {
      return NextResponse.json(
        { error: "Only the project creator can view collaborators" },
        { status: 403 }
      )
    }

    const collaborators = await prisma.collaborator.findMany({
      where: { projectId: params.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(collaborators)
  } catch (error: any) {
    console.error("Collaborators fetch error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch collaborators" },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const project = await prisma.project.findUnique({
      where: { id: params.id },
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Only creator can add collaborators
    if (project.creatorId !== session.user.id) {
      return NextResponse.json(
        { error: "Only the project creator can add collaborators" },
        { status: 403 }
      )
    }

    const { userIdentifier, role, permissions } = await request.json()

    if (!userIdentifier) {
      return NextResponse.json(
        { error: "User email or username is required" },
        { status: 400 }
      )
    }

    // Find user by email or username
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: userIdentifier },
          { username: userIdentifier },
        ],
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: "User not found. Please check the email or username." },
        { status: 404 }
      )
    }

    // Check if user is the creator
    if (user.id === project.creatorId) {
      return NextResponse.json(
        { error: "Cannot add project creator as collaborator" },
        { status: 400 }
      )
    }

    // Check if already a collaborator
    const existing = await prisma.collaborator.findUnique({
      where: {
        projectId_userId: {
          projectId: params.id,
          userId: user.id,
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: "User is already a collaborator on this project" },
        { status: 400 }
      )
    }

    const collaborator = await prisma.collaborator.create({
      data: {
        projectId: params.id,
        userId: user.id,
        role: role || "CONTRIBUTOR",
        permissions: permissions || {
          canEdit: false,
          canManageRewards: false,
          canManageBackers: false,
          canPostUpdates: true,
          canRespondToMessages: true,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
            avatar: true,
          },
        },
      },
    })

    // TODO: Send email notification to collaborator

    return NextResponse.json(collaborator, { status: 201 })
  } catch (error: any) {
    console.error("Collaborator creation error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to add collaborator" },
      { status: 500 }
    )
  }
}
