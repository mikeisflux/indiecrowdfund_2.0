import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { markAllNotificationsAsRead } from "@/lib/notifications"

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const unreadOnly = searchParams.get("unreadOnly") === "true"
    const limit = parseInt(searchParams.get("limit") || "50")

    const notifications = await prisma.notification.findMany({
      where: {
        userId: session.user.id,
        ...(unreadOnly && { read: false }),
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
    })

    return NextResponse.json(notifications)
  } catch (error: any) {
    console.error("Notifications fetch error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch notifications" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { markAllAsRead } = await request.json()

    if (markAllAsRead) {
      await markAllNotificationsAsRead(session.user.id)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  } catch (error: any) {
    console.error("Notifications update error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to update notifications" },
      { status: 500 }
    )
  }
}
