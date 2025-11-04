import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; collaboratorId: string } }
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

    // Only creator can update collaborators
    if (project.creatorId !== session.user.id) {
      return NextResponse.json(
        { error: "Only the project creator can update collaborators" },
        { status: 403 }
      )
    }

    const collaborator = await prisma.collaborator.findUnique({
      where: { id: params.collaboratorId },
    })

    if (!collaborator || collaborator.projectId !== params.id) {
      return NextResponse.json(
        { error: "Collaborator not found" },
        { status: 404 }
      )
    }

    const { role, permissions } = await request.json()

    const updateData: any = {}
    if (role !== undefined) updateData.role = role
    if (permissions !== undefined) updateData.permissions = permissions

    const updated = await prisma.collaborator.update({
      where: { id: params.collaboratorId },
      data: updateData,
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

    return NextResponse.json(updated)
  } catch (error: any) {
    console.error("Collaborator update error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to update collaborator" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string; collaboratorId: string } }
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

    // Only creator can remove collaborators
    if (project.creatorId !== session.user.id) {
      return NextResponse.json(
        { error: "Only the project creator can remove collaborators" },
        { status: 403 }
      )
    }

    const collaborator = await prisma.collaborator.findUnique({
      where: { id: params.collaboratorId },
    })

    if (!collaborator || collaborator.projectId !== params.id) {
      return NextResponse.json(
        { error: "Collaborator not found" },
        { status: 404 }
      )
    }

    await prisma.collaborator.delete({
      where: { id: params.collaboratorId },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Collaborator deletion error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to remove collaborator" },
      { status: 500 }
    )
  }
}
