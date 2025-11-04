import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; updateId: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify project ownership
    const project = await prisma.project.findUnique({
      where: { id: params.id },
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    if (project.creatorId !== session.user.id && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { title, content, isDraft, backersOnly } = body

    // Check if transitioning from draft to published
    const existingUpdate = await prisma.update.findUnique({
      where: { id: params.updateId },
    })

    const wasPublished = !existingUpdate?.isDraft
    const isNowPublished = !isDraft

    const update = await prisma.update.update({
      where: { id: params.updateId },
      data: {
        ...(title && { title }),
        ...(content && { content }),
        ...(isDraft !== undefined && { isDraft }),
        ...(backersOnly !== undefined && { backersOnly }),
        // Set publishedAt when transitioning from draft to published
        ...(existingUpdate?.isDraft && !isDraft && { publishedAt: new Date() }),
      },
    })

    // Send notifications if newly published
    if (!wasPublished && isNowPublished) {
      const backers = await prisma.pledge.findMany({
        where: { projectId: params.id },
        include: { backer: true },
        distinct: ["backerId"],
      })

      const watchers = await prisma.watchlist.findMany({
        where: { projectId: params.id },
        include: { user: true },
      })

      const recipients = [
        ...backers.map((b) => ({
          email: b.backer.email,
          name: b.backer.name,
          isBacker: true,
        })),
        ...watchers.map((w) => ({
          email: w.user.email,
          name: w.user.name,
          isBacker: false,
        })),
      ]

      const finalRecipients = backersOnly
        ? recipients.filter((r) => r.isBacker)
        : recipients

      for (const recipient of finalRecipients) {
        console.log(
          `Sending update notification to ${recipient.email} for project ${project.title}`
        )
      }
    }

    return NextResponse.json(update)
  } catch (error: any) {
    console.error("Error updating update:", error)
    return NextResponse.json(
      { error: error.message || "Failed to update" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string; updateId: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify project ownership
    const project = await prisma.project.findUnique({
      where: { id: params.id },
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    if (project.creatorId !== session.user.id && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await prisma.update.delete({
      where: { id: params.updateId },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error deleting update:", error)
    return NextResponse.json(
      { error: error.message || "Failed to delete update" },
      { status: 500 }
    )
  }
}
