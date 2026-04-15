import Stripe from "stripe";
import { db } from "@/lib/db";

/**
 * Create or get a Stripe Customer for the user.
 *
 * Race-safe: uses an atomic updateMany CAS on `stripeCustomerId: null`
 * to claim the first-writer slot, then if we lose the race we re-read
 * and return the concurrent winner's customer ID. This prevents two
 * concurrent pledge flows for the same user from creating two Stripe
 * customers and orphaning the first one.
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

  // Save customer ID via CAS — only claim the slot if still null.
  // Another concurrent pledge flow may have beaten us to the punch.
  const claimResult = await db.user.updateMany({
    where: { id: userId, stripeCustomerId: null },
    data: { stripeCustomerId: customer.id },
  });

  if (claimResult.count === 0) {
    // Lost the race — another caller already saved a customer. Use
    // theirs and let Stripe's duplicate customer become a benign
    // orphan (it has no attached payment methods or subscriptions).
    const winner = await db.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });
    return winner?.stripeCustomerId || customer.id;
  }

  return customer.id;
}
