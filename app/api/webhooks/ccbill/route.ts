import { NextResponse } from "next/server"
import { verifyCCBillPostback, parseCCBillPostback } from "@/lib/payments/ccbill"
import { prisma } from "@/lib/db"
import { sendPledgeConfirmation } from "@/lib/email"
import { formatCurrency } from "@/lib/utils"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const postbackData: Record<string, string> = {}

    formData.forEach((value, key) => {
      postbackData[key] = value.toString()
    })

    // Verify postback
    if (!verifyCCBillPostback(postbackData)) {
      console.error("CCBill postback verification failed")
      return NextResponse.json(
        { error: "Verification failed" },
        { status: 400 }
      )
    }

    // Parse postback data
    const data = parseCCBillPostback(postbackData)

    if (!data.pledgeId) {
      console.error("No pledgeId in postback")
      return NextResponse.json(
        { error: "Missing pledgeId" },
        { status: 400 }
      )
    }

    // Update pledge
    const pledge = await prisma.pledge.update({
      where: { id: data.pledgeId },
      data: {
        paymentStatus: "COMPLETED",
        ccbillTransactionId: data.transactionId,
      },
      include: {
        project: true,
        backer: true,
        reward: true,
      },
    })

    // Update project stats
    await prisma.project.update({
      where: { id: pledge.projectId },
      data: {
        currentAmount: { increment: pledge.amount },
        backerCount: { increment: 1 },
      },
    })

    // Send confirmation email
    await sendPledgeConfirmation({
      to: pledge.backer.email,
      backerName: pledge.backer.name || "Backer",
      projectTitle: pledge.project.title,
      amount: formatCurrency(pledge.amount, pledge.project.currency),
      rewardTitle: pledge.reward?.title,
      projectSlug: pledge.project.slug,
    })

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error("CCBill webhook error:", error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
