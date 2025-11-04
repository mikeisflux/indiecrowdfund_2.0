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

    const { searchParams } = new URL(request.url)
    const threadId = searchParams.get("threadId")

    if (threadId) {
      // Get messages for a specific thread
      const messages = await prisma.message.findMany({
        where: {
          threadId,
          OR: [
            { senderId: session.user.id },
            { receiverId: session.user.id },
          ],
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              username: true,
              avatar: true,
            },
          },
          receiver: {
            select: {
              id: true,
              name: true,
              username: true,
              avatar: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      })

      return NextResponse.json(messages)
    } else {
      // Get all conversations (threads)
      const messages = await prisma.message.findMany({
        where: {
          OR: [
            { senderId: session.user.id },
            { receiverId: session.user.id },
          ],
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              username: true,
              avatar: true,
            },
          },
          receiver: {
            select: {
              id: true,
              name: true,
              username: true,
              avatar: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      })

      // Group by threadId and get the latest message for each conversation
      const threads = new Map()
      messages.forEach((message) => {
        const threadId = message.threadId || message.id
        if (!threads.has(threadId)) {
          threads.set(threadId, message)
        }
      })

      return NextResponse.json(Array.from(threads.values()))
    }
  } catch (error) {
    console.error("Messages fetch error:", error)
    return NextResponse.json(
      { error: "Failed to fetch messages" },
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

    const { receiverId, subject, content, threadId } = await request.json()

    if (!receiverId || !content) {
      return NextResponse.json(
        { error: "Receiver ID and content are required" },
        { status: 400 }
      )
    }

    // Generate threadId if not provided (format: userId1_userId2)
    const finalThreadId = threadId || [session.user.id, receiverId].sort().join("_")

    const message = await prisma.message.create({
      data: {
        senderId: session.user.id,
        receiverId,
        subject: subject || null,
        content,
        threadId: finalThreadId,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          },
        },
        receiver: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          },
        },
      },
    })

    return NextResponse.json(message, { status: 201 })
  } catch (error: any) {
    console.error("Message send error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to send message" },
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

    const { threadId } = await request.json()

    // Mark all messages in thread as read
    await prisma.message.updateMany({
      where: {
        threadId,
        receiverId: session.user.id,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Message mark as read error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to mark messages as read" },
      { status: 500 }
    )
  }
}
