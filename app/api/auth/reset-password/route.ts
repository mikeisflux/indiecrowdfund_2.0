import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { verifyToken, markTokenAsUsed } from "@/lib/verification-tokens"
import bcrypt from "bcryptjs"

export async function POST(request: Request) {
  try {
    const { token, password } = await request.json()

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token and password are required" },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      )
    }

    // Verify token
    const verification = await verifyToken(token, "PASSWORD_RESET")

    if (!verification.valid) {
      return NextResponse.json(
        { error: verification.error },
        { status: 400 }
      )
    }

    const verificationToken = verification.token!

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Update user password
    await prisma.user.update({
      where: { id: verificationToken.userId },
      data: { password: hashedPassword },
    })

    // Mark token as used
    await markTokenAsUsed(verificationToken.id)

    // TODO: Send password changed confirmation email

    return NextResponse.json({
      message: "Password reset successfully",
    })
  } catch (error: any) {
    console.error("Reset password error:", error)
    return NextResponse.json(
      { error: "An error occurred. Please try again." },
      { status: 500 }
    )
  }
}
