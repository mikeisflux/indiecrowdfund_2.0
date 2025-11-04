import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { addonSchema } from "@/lib/validations"

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const addons = await prisma.addOn.findMany({
      where: { projectId: params.id },
      include: { parentReward: true },
      orderBy: { price: "asc" },
    })

    return NextResponse.json(addons)
  } catch (error) {
    console.error("Error fetching add-ons:", error)
    return NextResponse.json(
      { error: "Failed to fetch add-ons" },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify project ownership
    const project = await prisma.project.findUnique({
      where: { id: params.id },
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    if (project.creatorId !== session.user.id && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = addonSchema.parse(body)

    const addon = await prisma.addOn.create({
      data: {
        projectId: params.id,
        parentRewardId: body.parentRewardId || null,
        title: validatedData.title,
        description: validatedData.description,
        price: validatedData.price,
        imageUrl: validatedData.imageUrl || null,
        shippingCost: validatedData.shippingCost || null,
        quantityLimit: validatedData.quantityLimit || null,
        quantityAvailable: validatedData.quantityAvailable || validatedData.quantityLimit || null,
      },
    })

    return NextResponse.json(addon, { status: 201 })
  } catch (error: any) {
    console.error("Error creating add-on:", error)
    return NextResponse.json(
      { error: error.message || "Failed to create add-on" },
      { status: 500 }
    )
  }
}
