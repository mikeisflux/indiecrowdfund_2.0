import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const data = await request.json()
    const { emailNotifications, allowTracking } = data

    // Update user preferences
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ...(emailNotifications !== undefined && { emailNotifications }),
        ...(allowTracking !== undefined && { allowTracking }),
      },
      select: {
        id: true,
        emailNotifications: true,
        allowTracking: true,
      },
    })

    return NextResponse.json({
      message: "Preferences updated successfully",
      preferences: updatedUser,
    })
  } catch (error: any) {
    console.error("Failed to update preferences:", error)
    return NextResponse.json(
      { error: error.message || "Failed to update preferences" },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        emailNotifications: true,
        allowTracking: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(user)
  } catch (error: any) {
    console.error("Failed to get preferences:", error)
    return NextResponse.json(
      { error: error.message || "Failed to get preferences" },
      { status: 500 }
    )
  }
}
