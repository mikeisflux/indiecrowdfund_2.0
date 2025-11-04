import { NextResponse } from "next/server"
import bcrypt from "bcrypt"
import { prisma } from "@/lib/db"
import { registerSchema } from "@/lib/validations"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validatedData = registerSchema.parse(body)

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: validatedData.email },
          { username: validatedData.username },
        ],
      },
    })

    if (existingUser) {
      return NextResponse.json(
        { message: "User with this email or username already exists" },
        { status: 400 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(validatedData.password, 10)

    // Create user
    const user = await prisma.user.create({
      data: {
        email: validatedData.email,
        password: hashedPassword,
        name: validatedData.name,
        username: validatedData.username,
        role: "CREATOR", // Default role
      },
    })

    return NextResponse.json(
      { message: "User created successfully", userId: user.id },
      { status: 201 }
    )
  } catch (error: any) {
    console.error("Registration error:", error)
    return NextResponse.json(
      { message: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
