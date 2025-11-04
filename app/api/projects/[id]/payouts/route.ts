import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const project = await prisma.project.findUnique({
      where: { id: params.id },
      include: {
        creator: true,
        collaborators: true,
      },
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Verify user is creator or collaborator
    const isCreator = project.creatorId === session.user.id
    const isCollaborator = project.collaborators.some(
      (c) => c.userId === session.user.id
    )

    if (!isCreator && !isCollaborator) {
      return NextResponse.json(
        { error: "You don't have permission to view payouts for this project" },
        { status: 403 }
      )
    }

    const payouts = await prisma.payout.findMany({
      where: { projectId: params.id },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(payouts)
  } catch (error: any) {
    console.error("Payouts fetch error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch payouts" },
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

    const project = await prisma.project.findUnique({
      where: { id: params.id },
      include: {
        creator: true,
        collaborators: true,
      },
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Only creator can request payouts
    if (project.creatorId !== session.user.id) {
      return NextResponse.json(
        { error: "Only the project creator can request payouts" },
        { status: 403 }
      )
    }

    // Check if project is funded
    if (project.status !== "FUNDED" && project.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "Payouts can only be requested for funded projects" },
        { status: 400 }
      )
    }

    const { amount, description, bankAccount } = await request.json()

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Valid payout amount is required" },
        { status: 400 }
      )
    }

    // Check if there are sufficient funds
    const totalPayouts = await prisma.payout.aggregate({
      where: {
        projectId: params.id,
        status: { in: ["PENDING", "PROCESSING", "COMPLETED"] },
      },
      _sum: {
        amount: true,
      },
    })

    const totalPaidOut = totalPayouts._sum.amount || 0
    const availableFunds = project.currentAmount - totalPaidOut

    if (amount > availableFunds) {
      return NextResponse.json(
        { error: `Insufficient funds. Available: ${availableFunds}` },
        { status: 400 }
      )
    }

    const payout = await prisma.payout.create({
      data: {
        projectId: params.id,
        amount,
        currency: project.currency,
        description: description || null,
        status: "PENDING",
        bankAccount: bankAccount || null,
      },
    })

    return NextResponse.json(payout, { status: 201 })
  } catch (error: any) {
    console.error("Payout creation error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to create payout" },
      { status: 500 }
    )
  }
}
