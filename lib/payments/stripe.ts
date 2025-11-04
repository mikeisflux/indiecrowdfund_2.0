import Stripe from "stripe"

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not defined")
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-11-20.acacia",
  typescript: true,
})

export async function createPaymentIntent(
  amount: number,
  currency: string = "USD",
  metadata: Record<string, string> = {}
) {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency.toLowerCase(),
      metadata,
      automatic_payment_methods: {
        enabled: true,
      },
    })

    return paymentIntent
  } catch (error: any) {
    console.error("Stripe payment intent creation failed:", error)
    throw new Error(error.message || "Failed to create payment intent")
  }
}

export async function confirmPayment(paymentIntentId: string) {
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
    return paymentIntent
  } catch (error: any) {
    console.error("Stripe payment confirmation failed:", error)
    throw new Error(error.message || "Failed to confirm payment")
  }
}

export async function createRefund(
  paymentIntentId: string,
  amount?: number
) {
  try {
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      ...(amount && { amount: Math.round(amount * 100) }),
    })

    return refund
  } catch (error: any) {
    console.error("Stripe refund failed:", error)
    throw new Error(error.message || "Failed to create refund")
  }
}

export async function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
) {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not defined")
  }

  try {
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    )

    return event
  } catch (error: any) {
    console.error("Stripe webhook verification failed:", error)
    throw new Error(error.message || "Failed to verify webhook")
  }
}
