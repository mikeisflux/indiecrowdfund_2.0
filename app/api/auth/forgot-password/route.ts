import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { generateVerificationToken, deleteUserTokens } from "@/lib/verification-tokens"

export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      )
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({
        message: "If an account exists with that email, you will receive a password reset link.",
      })
    }

    // Delete any existing password reset tokens for this user
    await deleteUserTokens(user.id, "PASSWORD_RESET")

    // Generate new token
    const token = await generateVerificationToken(user.id, "PASSWORD_RESET")

    // Create reset URL
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/auth/reset-password/${token.token}`

    // TODO: Send email with reset link
    // For now, log it to console in development
    if (process.env.NODE_ENV === "development") {
      console.log("Password Reset URL:", resetUrl)
    }

    // In production, use your email service:
    // await sendEmail({
    //   to: user.email,
    //   subject: "Reset Your Password",
    //   html: `Click here to reset your password: ${resetUrl}`,
    // })

    return NextResponse.json({
      message: "If an account exists with that email, you will receive a password reset link.",
    })
  } catch (error: any) {
    console.error("Forgot password error:", error)
    return NextResponse.json(
      { error: "An error occurred. Please try again." },
      { status: 500 }
    )
  }
}
