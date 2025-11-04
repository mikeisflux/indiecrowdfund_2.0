import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const watchlist = await prisma.watchlist.findMany({
      where: { userId: session.user.id },
      include: {
        project: {
          include: {
            creator: {
              select: {
                name: true,
                username: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(watchlist.map((w) => w.project))
  } catch (error) {
    console.error("Watchlist fetch error:", error)
    return NextResponse.json(
      { error: "Failed to fetch watchlist" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { projectId } = await request.json()

    // Check if already in watchlist
    const existing = await prisma.watchlist.findUnique({
      where: {
        userId_projectId: {
          userId: session.user.id,
          projectId,
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: "Project already in watchlist" },
        { status: 400 }
      )
    }

    const watchlistItem = await prisma.watchlist.create({
      data: {
        userId: session.user.id,
        projectId,
      },
      include: {
        project: true,
      },
    })

    return NextResponse.json(watchlistItem, { status: 201 })
  } catch (error: any) {
    console.error("Watchlist add error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to add to watchlist" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get("projectId")

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID required" },
        { status: 400 }
      )
    }

    await prisma.watchlist.delete({
      where: {
        userId_projectId: {
          userId: session.user.id,
          projectId,
        },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Watchlist remove error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to remove from watchlist" },
      { status: 500 }
    )
  }
}
