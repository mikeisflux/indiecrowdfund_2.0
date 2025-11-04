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

    // Check if user is creator/collaborator to see drafts
    const project = await prisma.project.findUnique({
      where: { id: params.id },
    })

    const isCreator = session?.user?.id === project?.creatorId
    const isAdmin = session?.user?.role === "ADMIN"

    const updates = await prisma.update.findMany({
      where: {
        projectId: params.id,
        // Only show drafts to creator/admin
        ...(!(isCreator || isAdmin) && { isDraft: false }),
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(updates)
  } catch (error) {
    console.error("Error fetching updates:", error)
    return NextResponse.json(
      { error: "Failed to fetch updates" },
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

    const update = await prisma.update.create({
      data: {
        projectId: params.id,
        title,
        content,
        isDraft: isDraft ?? true,
        backersOnly: backersOnly ?? false,
        publishedAt: isDraft ? null : new Date(),
      },
    })

    // If published (not draft), send notifications to backers and watchers
    if (!isDraft) {
      // Get all backers
      const backers = await prisma.pledge.findMany({
        where: { projectId: params.id },
        include: { backer: true },
        distinct: ["backerId"],
      })

      // Get all watchers
      const watchers = await prisma.watchlist.findMany({
        where: { projectId: params.id },
        include: { user: true },
      })

      // Send notifications (implement actual email sending)
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

      // Filter recipients if backers-only
      const finalRecipients = backersOnly
        ? recipients.filter((r) => r.isBacker)
        : recipients

      // Queue emails (simplified - in production use a job queue)
      for (const recipient of finalRecipients) {
        // TODO: Send update notification email
        console.log(
          `Sending update notification to ${recipient.email} for project ${project.title}`
        )
      }
    }

    return NextResponse.json(update, { status: 201 })
  } catch (error: any) {
    console.error("Error creating update:", error)
    return NextResponse.json(
      { error: error.message || "Failed to create update" },
      { status: 500 }
    )
  }
}
