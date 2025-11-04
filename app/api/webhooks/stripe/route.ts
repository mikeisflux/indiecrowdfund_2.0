import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { constructWebhookEvent } from "@/lib/payments/stripe"
import { prisma } from "@/lib/db"
import { sendPledgeConfirmation } from "@/lib/email"
import { formatCurrency } from "@/lib/utils"

export async function POST(request: Request) {
  const body = await request.text()
  const signature = headers().get("stripe-signature")

  if (!signature) {
    return NextResponse.json(
      { error: "No signature provided" },
      { status: 400 }
    )
  }

  try {
    const event = await constructWebhookEvent(body, signature)

    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object

        // Get metadata
        const projectId = paymentIntent.metadata.projectId
        const userId = paymentIntent.metadata.userId
        const rewardId = paymentIntent.metadata.rewardId

        if (!projectId || !userId) {
          console.error("Missing metadata in payment intent")
          return NextResponse.json({ error: "Missing metadata" }, { status: 400 })
        }

        // Create pledge
        const pledge = await prisma.pledge.create({
          data: {
            projectId,
            backerId: userId,
            rewardId: rewardId || null,
            amount: paymentIntent.amount / 100, // Convert from cents
            paymentProcessor: "STRIPE",
            paymentStatus: "COMPLETED",
            stripePaymentId: paymentIntent.id,
          },
          include: {
            project: true,
            backer: true,
            reward: true,
          },
        })

        // Update project stats
        await prisma.project.update({
          where: { id: projectId },
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

        break
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object
        console.error("Payment failed:", paymentIntent.id)
        // Handle failed payment
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error("Webhook error:", error)
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    )
  }
}
