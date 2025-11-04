import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get the reward
    const reward = await prisma.reward.findUnique({
      where: { id: params.id },
      include: { project: true },
    })

    if (!reward) {
      return NextResponse.json({ error: "Reward not found" }, { status: 404 })
    }

    // Verify project ownership
    if (reward.project.creatorId !== session.user.id && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Create add-on from reward
    const addon = await prisma.addOn.create({
      data: {
        projectId: reward.projectId,
        parentRewardId: reward.id,
        title: reward.title,
        description: reward.description,
        price: reward.pledgeAmount,
        imageUrl: reward.imageUrl,
        shippingCost: reward.shippingCost,
        quantityLimit: reward.quantityLimit,
        quantityAvailable: reward.quantityAvailable,
      },
    })

    return NextResponse.json(addon, { status: 201 })
  } catch (error: any) {
    console.error("Error copying reward to add-on:", error)
    return NextResponse.json(
      { error: error.message || "Failed to copy reward to add-on" },
      { status: 500 }
    )
  }
}
