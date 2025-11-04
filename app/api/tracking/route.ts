import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { trackBehavior } from "@/lib/tracking"

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { eventType, entityType, entityId, metadata } = body

    await trackBehavior({
      userId: session.user.id,
      eventType,
      entityType,
      entityId,
      metadata,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Tracking error:", error)
    return NextResponse.json(
      { error: "Failed to track event" },
      { status: 500 }
    )
  }
}
