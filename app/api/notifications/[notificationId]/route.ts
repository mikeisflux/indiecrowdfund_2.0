import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function PATCH(
  request: Request,
  { params }: { params: { notificationId: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const notification = await prisma.notification.findUnique({
      where: { id: params.notificationId },
    })

    if (!notification) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      )
    }

    if (notification.userId !== session.user.id) {
      return NextResponse.json(
        { error: "You can only update your own notifications" },
        { status: 403 }
      )
    }

    const updated = await prisma.notification.update({
      where: { id: params.notificationId },
      data: { read: true },
    })

    return NextResponse.json(updated)
  } catch (error: any) {
    console.error("Notification update error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to update notification" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { notificationId: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const notification = await prisma.notification.findUnique({
      where: { id: params.notificationId },
    })

    if (!notification) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      )
    }

    if (notification.userId !== session.user.id) {
      return NextResponse.json(
        { error: "You can only delete your own notifications" },
        { status: 403 }
      )
    }

    await prisma.notification.delete({
      where: { id: params.notificationId },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Notification deletion error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to delete notification" },
      { status: 500 }
    )
  }
}
