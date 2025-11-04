import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { createPaymentIntent } from "@/lib/payments/stripe"
import { generateCCBillPaymentUrl } from "@/lib/payments/ccbill"

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { projectId, rewardId, addOnIds, shippingAddress, amount } = await request.json()

    if (!projectId || !amount || amount <= 0) {
      return NextResponse.json(
        { error: "Project ID and valid amount are required" },
        { status: 400 }
      )
    }

    // Get project details
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        rewards: true,
        addons: true,
      },
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    if (project.status !== "LIVE") {
      return NextResponse.json(
        { error: "Project is not live" },
        { status: 400 }
      )
    }

    // Validate reward if provided
    let reward = null
    if (rewardId) {
      reward = project.rewards.find((r) => r.id === rewardId)
      if (!reward) {
        return NextResponse.json({ error: "Reward not found" }, { status: 404 })
      }

      // Check quantity limits
      if (reward.quantityLimit && reward.quantityClaimed >= reward.quantityLimit) {
        return NextResponse.json(
          { error: "This reward is sold out" },
          { status: 400 }
        )
      }
    }

    // Validate add-ons if provided
    let addOns: any[] = []
    if (addOnIds && Array.isArray(addOnIds) && addOnIds.length > 0) {
      addOns = project.addons.filter((a) => addOnIds.includes(a.id))
      if (addOns.length !== addOnIds.length) {
        return NextResponse.json(
          { error: "One or more add-ons not found" },
          { status: 404 }
        )
      }
    }

    // Calculate total amount
    const rewardAmount = reward?.pledgeAmount || 0
    const addOnsAmount = addOns.reduce((sum, addon) => sum + addon.price, 0)
    const shippingCost = reward?.shippingCost || 0
    const calculatedTotal = rewardAmount + addOnsAmount + shippingCost

    // Verify amount matches
    if (Math.abs(calculatedTotal - amount) > 0.01) {
      return NextResponse.json(
        { error: "Amount mismatch. Please refresh and try again." },
        { status: 400 }
      )
    }

    // Create pledge with PENDING status
    const pledge = await prisma.pledge.create({
      data: {
        projectId,
        userId: session.user.id,
        rewardId: rewardId || null,
        amount,
        currency: project.currency,
        status: "PENDING",
        shippingAddress: shippingAddress || null,
        addOns: addOnIds || [],
      },
    })

    // Create payment based on processor
    let paymentData: any = {}

    if (project.paymentProcessor === "STRIPE") {
      // Create Stripe payment intent
      const paymentIntent = await createPaymentIntent(
        amount,
        project.currency,
        {
          projectId: project.id,
          pledgeId: pledge.id,
          userId: session.user.id,
          projectTitle: project.title,
        }
      )

      paymentData = {
        processor: "STRIPE",
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      }
    } else if (project.paymentProcessor === "CCBILL") {
      // Generate CCBill payment URL
      const ccbillUrl = generateCCBillPaymentUrl(
        amount,
        project.currency,
        {
          projectId: project.id,
          pledgeId: pledge.id,
          userId: session.user.id,
        }
      )

      paymentData = {
        processor: "CCBILL",
        paymentUrl: ccbillUrl,
      }
    }

    return NextResponse.json({
      pledgeId: pledge.id,
      ...paymentData,
    }, { status: 201 })
  } catch (error: any) {
    console.error("Pledge creation error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to create pledge" },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get("projectId")

    const where: any = {
      userId: session.user.id,
    }

    if (projectId) {
      where.projectId = projectId
    }

    const pledges = await prisma.pledge.findMany({
      where,
      include: {
        project: {
          select: {
            id: true,
            title: true,
            slug: true,
            imageUrl: true,
            status: true,
          },
        },
        reward: {
          select: {
            id: true,
            title: true,
            description: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(pledges)
  } catch (error: any) {
    console.error("Pledges fetch error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch pledges" },
      { status: 500 }
    )
  }
}
