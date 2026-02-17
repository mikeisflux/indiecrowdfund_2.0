import Stripe from "stripe";
import { db } from "@/lib/db";

/**
 * Create or get a Stripe Customer for the user
 */
export async function getOrCreateStripeCustomer(
  stripeClient: Stripe,
  userId: string,
  email: string
): Promise<string> {
  // Check if user already has a Stripe customer ID
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true, email: true, name: true },
  });

  if (user?.stripeCustomerId) {
    return user.stripeCustomerId;
  }

  // Create new Stripe customer
  const customer = await stripeClient.customers.create({
    email: email || user?.email || undefined,
    name: user?.name || undefined,
    metadata: {
      userId,
    },
  });

  // Save customer ID to user record
  await db.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}
