import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { rewardSchema } from "@/lib/validations"

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const rewards = await prisma.reward.findMany({
      where: { projectId: params.id },
      include: { items: true },
      orderBy: { pledgeAmount: "asc" },
    })

    return NextResponse.json(rewards)
  } catch (error) {
    console.error("Error fetching rewards:", error)
    return NextResponse.json(
      { error: "Failed to fetch rewards" },
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
    const validatedData = rewardSchema.parse(body)

    const reward = await prisma.reward.create({
      data: {
        projectId: params.id,
        title: validatedData.title,
        description: validatedData.description,
        pledgeAmount: validatedData.pledgeAmount,
        imageUrl: validatedData.imageUrl || null,
        estimatedDelivery: validatedData.estimatedDelivery || null,
        shippingType: validatedData.shippingType,
        shippingCost: validatedData.shippingCost || null,
        quantityLimit: validatedData.quantityLimit || null,
        quantityAvailable: validatedData.quantityAvailable || validatedData.quantityLimit || null,
      },
    })

    return NextResponse.json(reward, { status: 201 })
  } catch (error: any) {
    console.error("Error creating reward:", error)
    return NextResponse.json(
      { error: error.message || "Failed to create reward" },
      { status: 500 }
    )
  }
}
