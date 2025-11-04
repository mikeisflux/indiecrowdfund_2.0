import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import bcrypt from "bcryptjs"

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { password, confirmation } = await request.json()

    // Validate required fields
    if (!password || !confirmation) {
      return NextResponse.json(
        { error: "Password and confirmation are required" },
        { status: 400 }
      )
    }

    // Check confirmation text
    if (confirmation !== "DELETE") {
      return NextResponse.json(
        { error: "Please type DELETE to confirm account deletion" },
        { status: 400 }
      )
    }

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        password: true,
        createdProjects: {
          where: {
            status: {
              in: ["LIVE", "PENDING_APPROVAL", "APPROVED"],
            },
          },
          select: { id: true },
        },
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password)

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Incorrect password" },
        { status: 400 }
      )
    }

    // Check for active projects
    if (user.createdProjects.length > 0) {
      return NextResponse.json(
        {
          error:
            "Cannot delete account with active projects. Please cancel or complete all your projects first.",
        },
        { status: 400 }
      )
    }

    // Delete user (cascading deletes will handle related records)
    await prisma.user.delete({
      where: { id: session.user.id },
    })

    return NextResponse.json({
      message: "Account deleted successfully",
    })
  } catch (error: any) {
    console.error("Failed to delete account:", error)
    return NextResponse.json(
      { error: error.message || "Failed to delete account" },
      { status: 500 }
    )
  }
}
