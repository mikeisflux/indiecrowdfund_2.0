import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { generateCCBillPaymentUrl } from "@/lib/payments/ccbill"
import { prisma } from "@/lib/db"

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { projectId, rewardId, amount, addonIds } = body

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Create pledge record first
    const pledge = await prisma.pledge.create({
      data: {
        projectId,
        backerId: session.user.id,
        rewardId: rewardId || null,
        amount,
        paymentProcessor: "CCBILL",
        paymentStatus: "PENDING",
      },
    })

    // Generate CCBill payment URL
    const paymentUrl = generateCCBillPaymentUrl(
      amount,
      project.currency,
      {
        email: user.email,
        firstName: user.name?.split(" ")[0],
        lastName: user.name?.split(" ").slice(1).join(" "),
      },
      {
        projectId,
        pledgeId: pledge.id,
        ...(rewardId && { rewardId }),
      }
    )

    return NextResponse.json({
      paymentUrl,
      pledgeId: pledge.id,
    })
  } catch (error: any) {
    console.error("CCBill URL generation error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to generate payment URL" },
      { status: 500 }
    )
  }
}
